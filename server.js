/*
 * Sablier D&D — "Votre première heure à l'école"
 * Serveur de synchronisation, sans aucune dépendance (Node.js pur).
 *
 * Lancement :   node server.js
 * Interface joueur :  http://localhost:3000/
 * Interface MJ    :  http://localhost:3000/gm
 *
 * Pour jouer sur plusieurs appareils du même réseau Wi-Fi, les joueurs
 * ouvrent  http://<IP-de-ta-machine>:3000/  (l'IP s'affiche au démarrage).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const TOTAL_MS = 60 * 60 * 1000; // 1 heure
const PUBLIC = __dirname;
const STATIC = { '/app.js': 'app.js', '/style.css': 'style.css' };

let nextEventId = 1;
let nextReminderId = 1;

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
};

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
    serverNow: now(),
  };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

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
    if (pathname === '/gm' || pathname === '/gm.html') return serveFile(res, path.join(PUBLIC, 'gm.html'));
    if (pathname === '/state') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(snapshot()));
    }
    // fichiers statiques autorisés (app.js, style.css)
    if (STATIC[pathname]) return serveFile(res, path.join(PUBLIC, STATIC[pathname]));
    res.writeHead(404);
    return res.end('Not found');
  }

  if (req.method === 'POST' && pathname === '/action') {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 1e5) req.destroy();
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
  console.log('  Interface MJ     :  http://localhost:' + PORT + '/gm\n');
  if (ips.length) {
    console.log('  Pour les joueurs sur le même Wi-Fi :');
    ips.forEach((ip) => console.log('     http://' + ip + ':' + PORT + '/'));
    console.log('');
  }
});
