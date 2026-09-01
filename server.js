/*
 * Sablier D&D — "Votre première heure à l'école"
 * Serveur de synchronisation, sans aucune dépendance (Node.js pur).
 *
 * Lancement :   node server.js
 * Interface joueur :  http://localhost:3000/
 * Interface MJ    :  http://localhost:3000 + GM_PATH (adresse privee, affichee au demarrage)
 *
 * Pour jouer sur plusieurs appareils du même réseau Wi-Fi, les joueurs
 * ouvrent  http://<IP-de-ta-machine>:3000/  (l'IP s'affiche au démarrage).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { M1_LOCATIONS } = require('./locations.js');

const PORT = process.env.PORT || 3000;
/* Adresse du cockpit MJ. Elle n'est PAS devinable depuis l'adresse joueur :
   /gm ne repond plus rien. Modifiable sans toucher au code via la variable
   d'environnement GM_PATH (Render : Settings > Environment). */
const GM_PATH = process.env.GM_PATH || '/mj-chrysaldus-7f3a';
const TOTAL_MS = 60 * 60 * 1000; // 1 heure
const PUBLIC = __dirname;
const STATIC = {
  '/app.js': 'app.js',
  '/style.css': 'style.css',
  '/data.js': 'data.js',
  '/locations.js': 'locations.js',
  '/frame_hourglass.png': 'frame_hourglass.png',
  '/hall_bg.jpg': 'hall_bg.jpg',
};

const TIMELINE_FILE = path.join(PUBLIC, 'timeline.json');

/* Les routines (qui est ou, et fait quoi, tranche par tranche) sont editees
   dans le cockpit et vivent dans timeline.json. Ce fichier fait foi ; data.js
   (genere depuis l'Excel) ne sert plus que d'amorce si le JSON est absent. */
function seedTimelineFromData() {
  try {
    const src = fs.readFileSync(path.join(PUBLIC, 'data.js'), 'utf8');
    const D = eval(src + '; MJ_DATA');
    const slots = D.tranches.filter((t) => t.start < 60).map((t) => ({
      label: `${String(9 + Math.floor(t.start / 60)).padStart(2, '0')}:${String(t.start % 60).padStart(2, '0')}`
           + ` → ${String(9 + Math.floor(t.end / 60)).padStart(2, '0')}:${String(t.end % 60).padStart(2, '0')}`,
      start: t.start, end: t.end, marque: t.marque || '',
    }));
    const cols = D.order.filter((n) => D.chars[n] && D.chars[n].type === 'prime' && !D.chars[n].horsCasting)
                        .concat(D.staffOrder || []);
    const routines = {};
    cols.forEach((n) => { routines[n] = slots.map(() => ({ loc: '', act: '' })); });
    return { version: 1, updated: new Date().toISOString(), source: 'amorce vide', slots, cols, routines };
  } catch (e) {
    return { version: 1, updated: new Date().toISOString(), source: 'vide', slots: [], cols: [], routines: {} };
  }
}

function loadTimeline() {
  try {
    const t = JSON.parse(fs.readFileSync(TIMELINE_FILE, 'utf8'));
    if (t && Array.isArray(t.slots) && t.routines) {
      console.log(`  Routines chargees depuis timeline.json (${t.cols.length} personnages).`);
      return t;
    }
  } catch (e) {}
  console.log('  Pas de timeline.json : routines vides (amorcees depuis data.js).');
  return seedTimelineFromData();
}

let saveTimer = null;
let saveWarned = false;
function persistTimeline() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmp = TIMELINE_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state.timeline, null, 1), 'utf8');
      try { fs.copyFileSync(TIMELINE_FILE, TIMELINE_FILE + '.bak'); } catch (e) {}
      fs.renameSync(tmp, TIMELINE_FILE);
      saveWarned = false;
    } catch (e) {
      if (!saveWarned) {
        saveWarned = true;
        console.warn('  /!\\ timeline.json non enregistrable (' + e.code + ').'
          + ' Les modifications restent en memoire : utilise « Exporter » pour les recuperer.');
      }
    }
  }, 400);
}

function emptyRow() { return state.timeline.slots.map(() => ({ loc: '', act: '' })); }

let nextEventId = 1;
let nextReminderId = 1;
let nextImproId = 1;

const state = {
  totalMs: TOTAL_MS,
  running: false,
  remainingMs: TOTAL_MS,
  endsAt: null,                 // epoch ms de fin (quand running = true)
  reminders: [],                // {id, atMs, text, fired}
  timers: [0, 1, 2, 3].map((i) => ({
    label: 'Minuteur secret ' + (i + 1),
    durationMs: 5 * 60 * 1000,  // 5 min par défaut
    running: false,
    remainingMs: 5 * 60 * 1000,
    endsAt: null,
  })),
  events: [],                   // {id, kind:'timer'|'reminder'|'end', text}
  overrides: {},                // cockpit MJ : nom -> {lieu, act} (dérogations au plan)
  improEvents: [],              // cockpit MJ : {id, min, who, lieu, act} (événements à la volée)
  timeline: null,               // routines editables (chargees juste apres)
  timelineRev: 1,               // incremente a chaque modif : les clients rechargent /timeline
  saveOk: true,                 // false si l'ecriture disque a echoue (hebergement en lecture seule)
};
state.timeline = loadTimeline();

const now = () => Date.now();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mainRemaining = () =>
  state.running ? Math.max(0, state.endsAt - now()) : state.remainingMs;
const timerRemaining = (t) =>
  t.running ? Math.max(0, t.endsAt - now()) : t.remainingMs;

function pushEvent(kind, text) {
  state.events.push({ id: nextEventId++, kind, text: text || '' });
  if (state.events.length > 60) state.events.shift();
}

// Boucle d'horloge côté serveur : déclenche fins de timers et rappels.
function tick() {
  // Sablier principal
  if (state.running && state.endsAt - now() <= 0) {
    state.running = false;
    state.remainingMs = 0;
    state.endsAt = null;
    pushEvent('end', 'Le sablier est vide');
  }
  const rem = mainRemaining();

  // Rappels (déclenchés quand le temps restant passe sous le seuil)
  for (const r of state.reminders) {
    if (!r.fired && rem <= r.atMs) {
      r.fired = true;
      pushEvent('reminder', r.text);
    }
  }

  // Minuteurs secrets
  for (const t of state.timers) {
    if (t.running && t.endsAt - now() <= 0) {
      t.running = false;
      t.remainingMs = 0;
      t.endsAt = null;
      pushEvent('timer', t.label);
    }
  }
}
setInterval(tick, 150);

function adjustMain(deltaMs) {
  const rem = clamp(mainRemaining() + deltaMs, 0, TOTAL_MS);
  if (state.running) state.endsAt = now() + rem;
  else state.remainingMs = rem;
  // Répercuter le saut temporel sur les minuteurs secrets en cours :
  // avancer (deltaMs < 0) réduit leur temps restant, reculer l'augmente.
  for (const t of state.timers) {
    if (t.running) {
      t.endsAt += deltaMs;
    } else if (t.remainingMs > 0 && t.remainingMs < t.durationMs) {
      // minuteur démarré puis mis en pause : décalé aussi, borné à [0, durée]
      t.remainingMs = clamp(t.remainingMs + deltaMs, 0, t.durationMs);
    }
  }
}

function handleAction(body) {
  switch (body.action) {
    case 'start':
    case 'resume':
      if (!state.running && mainRemaining() > 0) {
        state.endsAt = now() + mainRemaining();
        state.running = true;
      }
      break;
    case 'pause':
      if (state.running) {
        state.remainingMs = mainRemaining();
        state.running = false;
        state.endsAt = null;
      }
      break;
    case 'toggle':
      handleAction({ action: state.running ? 'pause' : 'resume' });
      break;
    case 'reset':
      state.running = false;
      state.remainingMs = TOTAL_MS;
      state.endsAt = null;
      state.reminders.forEach((r) => (r.fired = false));
      state.overrides = {}; // reset de boucle : tous les PNJ reviennent au plan
      break;
    case 'skip': // avancer dans le temps => réduire le temps restant
      adjustMain(-Math.abs(Number(body.ms) || 0));
      break;
    case 'rewind': // reculer => ajouter du temps restant
      adjustMain(Math.abs(Number(body.ms) || 0));
      break;
    case 'addReminder': {
      const atMs = clamp(Number(body.atMs) || 0, 0, TOTAL_MS);
      const text = String(body.text || '').slice(0, 200) || 'Rappel';
      state.reminders.push({ id: nextReminderId++, atMs, text, fired: mainRemaining() <= atMs ? false : false });
      // trié par seuil décroissant (déclenchés dans l'ordre chronologique)
      state.reminders.sort((a, b) => b.atMs - a.atMs);
      break;
    }
    case 'removeReminder':
      state.reminders = state.reminders.filter((r) => r.id !== Number(body.id));
      break;
    case 'timerSetLabel': {
      const t = state.timers[Number(body.index)];
      if (t) t.label = String(body.label || '').slice(0, 60) || t.label;
      break;
    }
    case 'timerSetDuration': {
      const t = state.timers[Number(body.index)];
      if (t) {
        t.durationMs = clamp(Number(body.durationMs) || 0, 1000, 3 * 60 * 60 * 1000);
        if (!t.running) t.remainingMs = t.durationMs;
      }
      break;
    }
    case 'timerStart': {
      const t = state.timers[Number(body.index)];
      if (t && !t.running) {
        if (t.remainingMs <= 0) t.remainingMs = t.durationMs;
        t.endsAt = now() + t.remainingMs;
        t.running = true;
      }
      break;
    }
    case 'timerPause': {
      const t = state.timers[Number(body.index)];
      if (t && t.running) {
        t.remainingMs = timerRemaining(t);
        t.running = false;
        t.endsAt = null;
      }
      break;
    }
    case 'timerReset': {
      const t = state.timers[Number(body.index)];
      if (t) {
        t.running = false;
        t.endsAt = null;
        t.remainingMs = t.durationMs;
      }
      break;
    }
    /* ----- Cockpit MJ : dérogations & événements à la volée ----- */
    case 'setOverride': {
      const name = String(body.name || '').slice(0, 60);
      if (name) state.overrides[name] = {
        lieu: String(body.lieu || '').slice(0, 80),
        act: String(body.act || '').slice(0, 200),
      };
      break;
    }
    case 'clearOverride':
      delete state.overrides[String(body.name || '')];
      break;
    case 'addImpro': {
      state.improEvents.push({
        id: nextImproId++,
        min: clamp(Number(body.min) || 0, 0, 60),
        who: String(body.who || '').slice(0, 60) || null,
        lieu: String(body.lieu || '').slice(0, 80),
        act: String(body.act || '').slice(0, 200),
      });
      if (state.improEvents.length > 100) state.improEvents.shift();
      break;
    }
    /* ---- Routines (grille editable du cockpit) ---- */
    case 'setCell': {
      const tl = state.timeline;
      const name = String(body.name || '');
      const i = Number(body.i);
      if (!tl.routines[name] || !(i >= 0 && i < tl.slots.length)) break;
      const cell = tl.routines[name][i] || (tl.routines[name][i] = { loc: '', act: '' });
      if (typeof body.loc === 'string') cell.loc = body.loc.slice(0, 120);
      if (typeof body.act === 'string') cell.act = body.act.slice(0, 400);
      tl.updated = new Date().toISOString();
      state.timelineRev++;
      persistTimeline();
      break;
    }
    case 'addCol': {
      const tl = state.timeline;
      const name = String(body.name || '').trim();
      if (!name || tl.cols.includes(name)) break;
      tl.cols.push(name);
      tl.routines[name] = emptyRow();
      tl.updated = new Date().toISOString();
      state.timelineRev++;
      persistTimeline();
      break;
    }
    case 'removeCol': {
      const tl = state.timeline;
      const name = String(body.name || '');
      tl.cols = tl.cols.filter((n) => n !== name);
      delete tl.routines[name];
      tl.updated = new Date().toISOString();
      state.timelineRev++;
      persistTimeline();
      break;
    }
    case 'importTimeline': {
      const t = body.timeline;
      if (t && Array.isArray(t.slots) && Array.isArray(t.cols) && t.routines) {
        state.timeline = t;
        state.timeline.updated = new Date().toISOString();
        state.timelineRev++;
        persistTimeline();
      }
      break;
    }
    case 'removeImpro':
      state.improEvents = state.improEvents.filter((e) => e.id !== Number(body.id));
      break;
    default:
      break;
  }
}

function snapshot() {
  return {
    totalMs: state.totalMs,
    running: state.running,
    remainingMs: mainRemaining(),
    reminders: state.reminders.map((r) => ({ id: r.id, atMs: r.atMs, text: r.text, fired: r.fired })),
    timers: state.timers.map((t) => ({
      label: t.label,
      durationMs: t.durationMs,
      running: t.running,
      remainingMs: timerRemaining(t),
    })),
    events: state.events.slice(-30),
    overrides: state.overrides,
    improEvents: state.improEvents,
    timelineRev: state.timelineRev,
    timelineUpdated: state.timeline ? state.timeline.updated : null,
    saveOk: !saveWarned,
    serverNow: now(),
  };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (req.method === 'GET') {
    if (pathname === '/' ) return serveFile(res, path.join(PUBLIC, 'player.html'));
    if (pathname === GM_PATH) return serveFile(res, path.join(PUBLIC, 'gm.html'));
    if (pathname === '/timeline') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(state.timeline));
    }
    if (pathname === '/timeline.json') {          // telechargement (sauvegarde locale)
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="timeline.json"' });
      return res.end(JSON.stringify(state.timeline, null, 1));
    }
    if (pathname === '/timeline.csv') {           // export lisible dans Excel
      const tl = state.timeline;
      const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const head = ['Heure'].concat(...tl.cols.map((n) => [n + ' — lieu', n + ' — action']));
      const rows = tl.slots.map((s2, i) => [s2.label].concat(...tl.cols.map((n) => {
        const c = (tl.routines[n] || [])[i] || {};
        return [c.loc || '', c.act || ''];
      })));
      const csv = '\ufeff' + [head].concat(rows).map((r) => r.map(esc).join(';')).join('\r\n');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="routines.csv"' });
      return res.end(csv);
    }
    if (pathname === '/locations') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(M1_LOCATIONS));
    }
    if (pathname === '/state') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(snapshot()));
    }
    // fichiers statiques autorisés (app.js, style.css)
    if (STATIC[pathname]) return serveFile(res, path.join(PUBLIC, STATIC[pathname]));
    // portraits du cockpit MJ (public/portraits/*.webp), nom décodé et sécurisé
    if (pathname.startsWith('/portraits/')) {
      const name = path.basename(decodeURIComponent(pathname));
      return serveFile(res, path.join(PUBLIC, 'public', 'portraits', name));
    }
    res.writeHead(404);
    return res.end('Not found');
  }

  if (req.method === 'POST' && pathname === '/action') {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 4e6) req.destroy();
    });
    req.on('end', () => {
      try {
        handleAction(JSON.parse(body || '{}'));
      } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(snapshot()));
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  console.log('\n  ⏳  Sablier D&D lancé !\n');
  console.log('  Interface joueur :  http://localhost:' + PORT + '/');
  console.log('  Interface MJ     :  http://localhost:' + PORT + GM_PATH + '   (adresse privee)\n');
  if (ips.length) {
    console.log('  Pour les joueurs sur le même Wi-Fi :');
    ips.forEach((ip) => console.log('     http://' + ip + ':' + PORT + '/'));
    console.log('');
  }
});
