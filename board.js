/* The Chronovestigation Board — logique client (joueurs).
   Le temps est CONTINU : une presence est un intervalle [a,b] en minutes apres
   neuf heures. Aucune tranche de 5 minutes ne doit apparaitre ici, ni dans les
   graduations (qui s'arretent au quart d'heure), ni dans un pas de deplacement. */
(function () {
'use strict';

var SPAN = 60;
var TRUST_LABEL = { conf: 'Confirmed', rep: 'Reported', susp: 'Suspected', disp: 'Disproved' };
var KIND_LABEL = { span: 'Span', clue: 'Clue', stmt: 'Statement', note: 'Note' };
var ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV',
             'XVI','XVII','XVIII','XIX','XX','XXI','XXII','XXIII','XXIV','XXV'];

var S = { rev: -1, loop: 1, cast: [], rooms: [], entries: [] };
var me = '', sel = null, filter = 'all';
var drag = null, pending = null, editing = null, deferred = null;

var $ = function (id) { return document.getElementById(id); };
var esc = function (s) { return String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var GEM = '<svg class="gem"><use href="#gem"></use></svg>';
function clock(m) { m = Math.round(m); return m >= SPAN ? '10:00' : '09:' + String(m).padStart(2, '0'); }
function roman(n) { return ROMAN[n - 1] || String(n); }
function nameOf(k) { var c = S.cast.find(function (x) { return x.key === k; }); return c ? c.name : ''; }
function roomOf(r) { var x = S.rooms.find(function (y) { return y.rid === r; }); return x ? x.label : ''; }

/* ---------- marbre veloute, genere une fois ---------- */
(function marble() {
  var N = 360, cv = document.createElement('canvas'); cv.width = cv.height = N;
  var ctx = cv.getContext('2d'), img = ctx.createImageData(N, N), d = img.data;
  var P = new Uint8Array(512), i, j, t;
  for (i = 0; i < 256; i++) P[i] = i;
  for (i = 255; i > 0; i--) { j = (i * 7919 + 13) % (i + 1); t = P[i]; P[i] = P[j]; P[j] = t; }
  for (i = 0; i < 256; i++) P[256 + i] = P[i];
  var fade = function (x) { return x * x * x * (x * (x * 6 - 15) + 10); };
  var grad = function (h, x, y) { var u = (h & 1) ? x : y, v = (h & 2) ? y : x;
    return ((h & 4) ? -u : u) + ((h & 8) ? -v : v); };
  function noise(x, y) {
    var X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    var u = fade(x), v = fade(y), A = P[X] + Y, B = P[X + 1] + Y;
    var l = function (a, b, k) { return a + k * (b - a); };
    return l(l(grad(P[A], x, y), grad(P[B], x - 1, y), u),
             l(grad(P[A + 1], x, y - 1), grad(P[B + 1], x - 1, y - 1), u), v);
  }
  function fbm(x, y) { var s = 0, a = 0.5, f = 1, q;
    for (q = 0; q < 5; q++) { s += a * noise(x * f, y * f); f *= 2; a *= 0.5; } return s; }
  var base = [26, 18, 24], velvet = [47, 30, 42], vein = [128, 104, 60];
  for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
    var n = fbm(x / 58, y / 58);
    var m = Math.abs(Math.sin((x / 58 + y / 150 + n * 2.6) * Math.PI));
    var soft = Math.pow(1 - m, 2.1), thin = Math.pow(Math.max(0, 1 - m * 7.5), 3), p = (y * N + x) * 4;
    for (var c = 0; c < 3; c++) {
      var v = base[c] + (velvet[c] - base[c]) * soft * 0.9;
      v += (vein[c] - v) * thin * 0.5;
      d[p + c] = Math.max(0, Math.min(255, v + (Math.random() - 0.5) * 5));
    }
    d[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  var el = $('marble');
  el.style.backgroundImage = 'url(' + cv.toDataURL() + ')';
  el.style.backgroundSize = '720px 720px';
})();

/* ---------- reseau ---------- */
function post(payload) {
  payload.author = me; payload.loop = S.loop;
  return fetch('/board/act', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).then(function (r) { return r.json(); }).then(function (v) { apply(v, true); })
    .catch(function () { toast('Lost the server for a moment — try again.'); });
}
function pull() {
  fetch('/board/state', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (v) { $('syncdot').classList.remove('stale'); apply(v, false); })
    .catch(function () { $('syncdot').classList.add('stale'); });
}
/* Ne jamais redessiner sous les doigts de quelqu'un : si une presence est en
   cours de deplacement ou le tiroir ouvert, on garde l'etat pour plus tard. */
function busy() { return !!drag || $('drawer').classList.contains('on'); }
function apply(v, force) {
  if (!v || typeof v.rev !== 'number') return;
  if (busy() && !force) { deferred = v; return; }
  deferred = null;
  if (v.rev === S.rev && !force) return;
  S = v; renderAll();
}
function flush() { if (deferred) { var v = deferred; deferred = null; apply(v, true); } }

/* horloge de la Citadelle, calee sur le sablier du MJ */
function pullClock() {
  fetch('/state', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (s) {
    var done = Math.max(0, s.totalMs - s.remainingMs) / s.totalMs * SPAN;
    $('clock').textContent = clock(done);
    $('roman').textContent = done >= SPAN ? 'X' : 'IX';
    window.__nowMin = Math.min(SPAN, done);
    var l = document.querySelector('.nowline');
    if (l) l.style.left = (window.__nowMin / SPAN * 100) + '%';
  }).catch(function () {});
}

/* ---------- identite ---------- */
function askWho(first) {
  var n = prompt(first ? 'Who is writing? (your character, so the table knows who recorded what)'
                       : 'Signing as', me || '');
  if (n === null) return;
  me = String(n).slice(0, 40).trim();
  try { localStorage.setItem('chrono.me', me); } catch (e) {}
  paintWho();
}
function paintWho() { $('whoBtn').textContent = me ? 'Signing as ' + me : 'Sign your name'; }

/* ---------- rendu : l'heure ---------- */
function liveSpans() { return S.entries.filter(function (e) { return e.kind === 'span' && !e.dead; }); }
function clashSet() {
  var out = {}, L = liveSpans(), i, j, x, y;
  for (i = 0; i < L.length; i++) for (j = i + 1; j < L.length; j++) {
    x = L[i]; y = L[j];
    if (x.person === y.person && x.rid !== y.rid && x.a < y.b && y.a < x.b) { out[x.id] = 1; out[y.id] = 1; }
  }
  return out;
}
function rowsFor(list) {
  var rows = [];
  list.slice().sort(function (p, q) { return p.a - q.a; }).forEach(function (bk) {
    var r = null, i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].every(function (o) { return bk.a >= o.b || bk.b <= o.a; })) { r = rows[i]; break; }
    }
    if (!r) { r = []; rows.push(r); }
    r.push(bk);
  });
  return rows;
}
function blockHTML(bk, bad) {
  return '<div class="blk ' + bk.trust + (bad ? ' clash' : '') + '" data-id="' + bk.id + '" '
    + 'title="' + esc(roomOf(bk.rid) + ' · ' + clock(bk.a) + '-' + clock(bk.b)
      + (bk.source ? ' · ' + bk.source : '')) + '" '
    + 'style="left:' + (bk.a / SPAN * 100) + '%;width:' + ((bk.b - bk.a) / SPAN * 100) + '%">'
    + '<span class="grip l"></span>' + GEM + '<span class="nmtxt">' + esc(roomOf(bk.rid)) + '</span>'
    + '<span class="grip r"></span></div>';
}
function qlines() {
  var s = '', m;
  for (m = 15; m < SPAN; m += 15) s += '<div class="qline" style="left:' + (m / SPAN * 100) + '%"></div>';
  return s;
}
function trackHTML(list, bad) {
  var rows = rowsFor(list).map(function (row) {
    return '<div class="subrow">' + row.map(function (bk) { return blockHTML(bk, bad[bk.id]); }).join('') + '</div>';
  }).join('');
  return rows || '<div class="subrow"></div>';
}
function renderRuler(el) {
  var s = '', m;
  for (m = 0; m <= SPAN; m += 15) {
    s += '<div class="mark' + (m === SPAN ? ' last' : '') + '" style="left:' + (m / SPAN * 100) + '%">'
       + '<span>' + clock(m) + '</span></div>';
  }
  el.innerHTML = s;
}
function renderHour() {
  var bad = clashSet();
  var order = S.cast.slice().sort(function (a, b) { return (a.staff ? 1 : 0) - (b.staff ? 1 : 0); });
  var liars = {};
  S.entries.forEach(function (e) { if (e.liar && e.person) liars[e.person] = 1; });
  var now = window.__nowMin, live = liveSpans();
  $('lanes').innerHTML = order.map(function (c, i) {
    var mine = live.filter(function (x) { return x.person === c.key; });
    return '<div class="lane' + (c.staff ? ' staff' : '') + '" data-k="' + c.key + '">'
      + '<div class="who"><span class="nm">' + esc(c.name) + '</span>'
      + (liars[c.key] ? '<span class="flag">liar</span>' : '') + '</div>'
      + '<div class="track">' + qlines() + trackHTML(mine, bad)
      + (i === 0 && now != null ? '<div class="nowline" style="left:' + (now / SPAN * 100) + '%"></div>' : '')
      + '</div></div>';
  }).join('');
  $('hourEmpty').hidden = S.cast.length > 0;
  var nClash = Object.keys(bad).length;
  $('hourFoot').innerHTML =
      '<span><b>' + live.length + '</b> spans laid down</span>'
    + '<span><b class="bad">' + Math.floor(nClash / 2) + '</b> contradictions open</span>'
    + '<span><b>' + S.cast.length + '</b> people met</span>'
    + '<span><b>' + S.rooms.length + '</b> places on your map</span>';
}

/* ---------- rendu : dossiers ---------- */
function renderCasterList() {
  var liars = {};
  S.entries.forEach(function (e) { if ((e.liar || e.dead) && e.person) liars[e.person] = 1; });
  var primes = S.cast.filter(function (c) { return !c.staff; });
  var staff = S.cast.filter(function (c) { return c.staff; });
  if ((!sel || !S.cast.some(function (c) { return c.key === sel; })) && S.cast.length) sel = S.cast[0].key;
  function one(c) {
    return '<button class="caster' + (liars[c.key] ? ' warn' : '') + '" data-k="' + c.key + '"'
      + (c.key === sel ? ' aria-current="true"' : '') + '>' + GEM + esc(c.name)
      + (liars[c.key] ? '<span class="liar">liar</span>' : '') + '</button>';
  }
  $('casterlist').innerHTML =
      (primes.length ? '<p class="grouplab">Primes</p>' + primes.map(one).join('') : '')
    + (staff.length ? '<p class="grouplab">Staff</p>' + staff.map(one).join('') : '')
    + (S.cast.length ? '' : '<p class="muted">No one yet.</p>');
}
function entryHTML(e) {
  var cls = e.dead ? 'dead' : (e.trust || '');
  var body = e.kind === 'span'
    ? '<span class="said">' + esc(roomOf(e.rid)) + ', ' + clock(e.a) + '&ndash;' + clock(e.b) + '</span>'
    : '<span class="said">' + esc(e.text) + '</span>';
  var meta = [];
  if (e.kind !== 'span') meta.push(KIND_LABEL[e.kind]);
  if (e.trust && e.kind === 'span') meta.push(TRUST_LABEL[e.trust]);
  if (e.source) meta.push(esc(e.source));
  meta.push('Loop ' + roman(e.loop || 1));
  if (e.fromGm) meta.push('from the Warden');
  else if (e.author) meta.push('added by ' + esc(e.author));
  return '<li class="entry ' + cls + '">' + body
    + (e.dead ? '<span class="verdict">disproved</span>' : '')
    + (e.liar ? '<span class="verdict liar">liar</span>' : '')
    + '<div class="meta">' + meta.join(' &middot; ') + '</div></li>';
}
function renderDossier() {
  var c = S.cast.find(function (x) { return x.key === sel; });
  var box = $('dossier');
  var frame = '<span class="cnr tl"></span><span class="cnr tr"></span>'
            + '<span class="cnr bl"></span><span class="cnr br"></span>';
  if (!c) { box.innerHTML = frame + '<p class="empty-note">No one to open yet.</p>'; return; }
  var mine = S.entries.filter(function (e) { return e.person === c.key; });
  var spans = mine.filter(function (e) { return e.kind === 'span' && !e.dead; });
  var lies = mine.filter(function (e) { return e.dead || e.liar; });
  var about = mine.filter(function (e) { return e.kind !== 'span' && !e.dead && !e.liar; });
  var bad = clashSet();
  box.innerHTML = frame
    + '<div class="dosshead"><div class="portrait">' + esc(c.name.slice(0, 1)) + '</div>'
    + '<div><h3>' + esc(c.name) + '</h3><div class="role">' + (c.staff ? 'Staff' : 'Prime') + '</div></div>'
    + '<div class="counters">'
    + '<div class="counter"><b>' + spans.length + '</b><span>spans</span></div>'
    + '<div class="counter"><b>' + mine.length + '</b><span>entries</span></div>'
    + '<div class="counter bad"><b>' + lies.length + '</b><span>lies</span></div>'
    + '</div></div>'
    + '<div class="dosshour"><p class="lab">Their hour</p>'
    + '<div class="ruler"><div class="track" id="ruler2"></div></div>'
    + '<div class="lane" style="border:0"><div class="track" style="cursor:default">'
    + qlines() + trackHTML(spans, bad) + '</div></div></div>'
    + '<div class="sections">'
    + '<div class="sect"><p class="lab">Lies &amp; concealments <span class="n">' + lies.length + '</span></p>'
    + '<ul class="entries">' + (lies.map(entryHTML).join('') || '<li class="entry muted">Nothing yet.</li>') + '</ul></div>'
    + '<div class="sect"><p class="lab">Said about them <span class="n">' + about.length + '</span></p>'
    + '<ul class="entries">' + (about.map(entryHTML).join('') || '<li class="entry muted">Nothing yet.</li>') + '</ul></div>'
    + '</div>';
  renderRuler($('ruler2'));
}

/* ---------- rendu : registre ---------- */
function renderLedger() {
  var rows = S.entries.slice().reverse().filter(function (e) {
    if (filter === 'all') return true;
    if (filter === 'dead') return e.dead;
    if (filter === 'liar') return e.liar;
    return e.kind === filter;
  });
  $('ledgerBody').innerHTML = rows.map(function (e) {
    var what = e.kind === 'span'
      ? esc(nameOf(e.person)) + ' &mdash; ' + esc(roomOf(e.rid)) + ', ' + clock(e.a) + ' to ' + clock(e.b)
        + (e.dead ? '' : ' &middot; ' + TRUST_LABEL[e.trust || 'rep'])
      : (e.person ? '<b>' + esc(nameOf(e.person)) + '</b> &mdash; ' : '') + esc(e.text)
        + (e.rid != null ? ' <span class="src">(' + esc(roomOf(e.rid)) + ')</span>' : '');
    return '<tr class="' + (e.dead ? 'dead' : '') + '">'
      + '<td class="lp">' + roman(e.loop || 1) + '</td>'
      + '<td><span class="kind ' + e.kind + '">' + KIND_LABEL[e.kind] + '</span></td>'
      + '<td class="what">' + what + (e.dead ? '<span class="verdict">disproved</span>' : '')
        + (e.liar ? '<span class="verdict liar">liar</span>' : '') + '</td>'
      + '<td class="src">' + (e.fromGm ? '<span class="fromgm">' + GEM + 'from the Warden</span>'
        : esc(e.source || '—')) + '</td>'
      + '<td class="src">' + esc(e.author || '—') + '</td>'
      + '<td><button class="rowbtn" data-liar="' + e.id + '" aria-pressed="'
        + (e.liar ? 'true' : 'false') + '">liar</button></td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="6" class="muted" style="padding:24px">Nothing recorded yet.</td></tr>';
}

function fillSelect(el, opts, blank) {
  el.innerHTML = (blank ? '<option value="">' + blank + '</option>' : '')
    + opts.map(function (o) { return '<option value="' + o.v + '">' + esc(o.t) + '</option>'; }).join('');
}
function renderPickers() {
  var people = S.cast.map(function (c) { return { v: c.key, t: c.name }; });
  var rooms = S.rooms.map(function (r) { return { v: r.rid, t: r.label }; });
  var keepP = $('adPerson').value, keepR = $('adRoom').value, keepD = $('dRoom').value;
  fillSelect($('adPerson'), people, 'about nobody');
  fillSelect($('adRoom'), rooms, 'no place');
  fillSelect($('dRoom'), rooms, null);
  $('adPerson').value = keepP; $('adRoom').value = keepR;
  if (keepD) $('dRoom').value = keepD;
}
function renderAll() {
  $('loopBtn').textContent = 'Loop ' + roman(S.loop);
  renderPickers(); renderHour(); renderCasterList(); renderDossier(); renderLedger();
}

/* ---------- peindre, deplacer, etirer ---------- */
function minsAtRect(r, x) {
  if (!r || !r.width) return 0;
  return Math.max(0, Math.min(SPAN, Math.round((x - r.left) / r.width * SPAN)));
}
$('lanes').addEventListener('pointerdown', function (e) {
  if (!me) { askWho(true); if (!me) return; }
  var lane = e.target.closest('.lane'); if (!lane) return;
  var track = lane.querySelector('.track'); if (!track || !track.contains(e.target)) return;
  var key = lane.dataset.k, rect = track.getBoundingClientRect();
  var blk = e.target.closest('.blk');
  track.setPointerCapture(e.pointerId);
  if (blk) {
    var bk = S.entries.find(function (x) { return x.id === +blk.dataset.id; });
    if (!bk) return;
    var grip = e.target.closest('.grip');
    drag = { mode: grip ? (grip.classList.contains('l') ? 'L' : 'R') : 'move',
             bk: bk, el: blk, rect: rect, key: key,
             start: minsAtRect(rect, e.clientX), a0: bk.a, b0: bk.b, moved: false };
  } else {
    var m = minsAtRect(rect, e.clientX);
    var ghost = document.createElement('div');
    ghost.className = 'ghost';
    ghost.style.left = (m / SPAN * 100) + '%'; ghost.style.width = '0%'; ghost.style.top = '5px';
    track.appendChild(ghost);
    drag = { mode: 'new', rect: rect, key: key, start: m, a: m, b: m, ghost: ghost, moved: false };
  }
  e.preventDefault();
});
document.addEventListener('pointermove', function (e) {
  if (!drag) return;
  var m = minsAtRect(drag.rect, e.clientX);
  if (m !== drag.start) drag.moved = true;
  if (drag.mode === 'new') {
    var a = Math.min(drag.start, m), b = Math.max(drag.start, m);
    drag.a = a; drag.b = b;
    drag.ghost.style.left = (a / SPAN * 100) + '%';
    drag.ghost.style.width = ((b - a) / SPAN * 100) + '%';
  } else {
    /* On ne bouge que l'element. Un rendu complet ici detacherait le noeud que
       l'on traine : l'evenement suivant mesurerait un element sans largeur et
       la presence sauterait en fin d'heure. */
    var d = m - drag.start, bk = drag.bk;
    if (drag.mode === 'move') {
      var len = drag.b0 - drag.a0;
      bk.a = Math.max(0, Math.min(SPAN - len, drag.a0 + d)); bk.b = bk.a + len;
    } else if (drag.mode === 'L') {
      bk.a = Math.max(0, Math.min(drag.b0 - 1, drag.a0 + d)); bk.b = drag.b0;
    } else {
      bk.a = drag.a0; bk.b = Math.min(SPAN, Math.max(drag.a0 + 1, drag.b0 + d));
    }
    drag.el.style.left = (bk.a / SPAN * 100) + '%';
    drag.el.style.width = ((bk.b - bk.a) / SPAN * 100) + '%';
  }
});
function endDrag() {
  if (!drag) return;
  var d = drag; drag = null;
  if (d.mode === 'new') {
    if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    if (d.moved && d.b - d.a >= 1) {
      pending = { key: d.key, a: d.a, b: d.b };
      openDrawer(nameOf(d.key), d.a, d.b, true, null);
    }
  } else if (d.moved) {
    post({ action: 'editSpan', id: d.bk.id, a: d.bk.a, b: d.bk.b });
  } else {
    editing = d.bk.id;
    openDrawer(nameOf(d.bk.person), d.bk.a, d.bk.b, false, d.bk);
  }
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

/* ---------- tiroir ---------- */
function setTrust(t) {
  Array.prototype.forEach.call($('dTrust').children, function (b) {
    b.setAttribute('aria-pressed', b.dataset.t === t ? 'true' : 'false');
  });
}
function currentTrust() {
  var b = $('dTrust').querySelector('[aria-pressed="true"]');
  return b ? b.dataset.t : 'rep';
}
function openDrawer(who, a, b, isNew, bk) {
  $('dTitle').textContent = isNew ? 'Lay down a span' : 'This span';
  $('dWho').textContent = who;
  $('dFrom').textContent = clock(a); $('dTo').textContent = clock(b);
  var n = Math.round(b - a);
  $('dDur').textContent = n === 1 ? 'one minute' : n + ' minutes';
  $('dRoom').value = bk && bk.rid != null ? bk.rid : (S.rooms[0] ? S.rooms[0].rid : '');
  setTrust(bk && bk.trust ? bk.trust : 'conf');
  $('dSource').value = bk ? (bk.source || '') : '';
  $('dNote').value = bk ? (bk.text || '') : '';
  $('dDisprove').hidden = !!isNew;
  $('drawer').classList.add('on');
}
function closeDrawer() {
  $('drawer').classList.remove('on');
  pending = null; editing = null;
  flush();
}
$('dCancel').addEventListener('click', closeDrawer);
$('dTrust').addEventListener('click', function (e) {
  var b = e.target.closest('.trustbtn'); if (b) setTrust(b.dataset.t);
});
$('dSave').addEventListener('click', function () {
  var rid = $('dRoom').value;
  if (rid === '') { toast('Pick a place first.'); return; }
  var payload = { rid: Number(rid), trust: currentTrust(),
                  source: $('dSource').value, text: $('dNote').value };
  if (pending) {
    payload.action = 'addSpan'; payload.person = pending.key;
    payload.a = pending.a; payload.b = pending.b;
  } else if (editing) {
    payload.action = 'editSpan'; payload.id = editing;
  } else { closeDrawer(); return; }
  post(payload); closeDrawer();
});
/* Refuter, c'est supprimer : la presence quitte le tableau et la declaration
   reste au Registre, au nom de qui l'a faite. */
$('dDisprove').addEventListener('click', function () {
  if (editing) post({ action: 'disprove', id: editing, by: me });
  closeDrawer();
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

/* ---------- registre ---------- */
$('adAdd').addEventListener('click', function () {
  if (!me) { askWho(true); if (!me) return; }
  var text = $('adText').value.trim();
  if (!text) { toast('Say what was found, or what was said.'); return; }
  post({ action: 'addEntry', kind: $('adKind').value, person: $('adPerson').value || null,
         rid: $('adRoom').value === '' ? null : Number($('adRoom').value),
         text: text, source: $('adSource').value });
  $('adText').value = ''; $('adSource').value = '';
});
$('adText').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('adAdd').click(); });
$('ledgerBody').addEventListener('click', function (e) {
  var b = e.target.closest('[data-liar]'); if (!b) return;
  post({ action: 'tagLiar', id: Number(b.dataset.liar), on: b.getAttribute('aria-pressed') !== 'true' });
});
$('filters').addEventListener('click', function (e) {
  var c = e.target.closest('.chip'); if (!c) return;
  filter = c.dataset.f;
  Array.prototype.forEach.call($('filters').children, function (x) {
    x.setAttribute('aria-pressed', x === c ? 'true' : 'false');
  });
  renderLedger();
});
$('casterlist').addEventListener('click', function (e) {
  var c = e.target.closest('.caster'); if (!c) return;
  sel = c.dataset.k; renderCasterList(); renderDossier();
});
$('loopBtn').addEventListener('click', function () {
  var n = prompt('Which loop are you in?', S.loop);
  if (n === null) return;
  var v = Math.max(1, Math.min(99, parseInt(n, 10) || 1));
  S.loop = v; $('loopBtn').textContent = 'Loop ' + roman(v);
  post({ action: 'setLoop', loop: v });
});
$('whoBtn').addEventListener('click', function () { askWho(false); });

Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
  t.addEventListener('click', function () {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (x) {
      x.setAttribute('aria-selected', 'false');
    });
    t.setAttribute('aria-selected', 'true');
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) {
      v.classList.remove('on');
    });
    $('v-' + t.dataset.view).classList.add('on');
    closeDrawer();
  });
});

var toastTimer = null;
function toast(msg) {
  var el = $('toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
}

/* ---------- demarrage ---------- */
try { me = localStorage.getItem('chrono.me') || ''; } catch (e) {}
paintWho();
renderRuler($('ruler'));
renderAll();
pull(); pullClock();
setInterval(pull, 1000);
setInterval(pullClock, 1000);
if (!me) setTimeout(function () { askWho(true); }, 500);
})();
