/* Warden — la face MJ du Chronovestigation Board.
   Servie sous l'adresse privee : toutes les requetes sont relatives, elles
   restent donc sous cette adresse. Le tableau des joueurs, lui, ne repond
   meme pas tant que `open` est faux. */
(function () {
'use strict';

var SPAN = 60;
var ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV',
             'XVI','XVII','XVIII','XIX','XX','XXI','XXII','XXIII','XXIV','XXV'];
var W = { rev: -1, open: false, loop: 1, cast: [], rooms: [], entries: [] };
var $ = function (id) { return document.getElementById(id); };
var esc = function (s) { return String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var GEM = '<svg class="gem"><use href="#gem"></use></svg>';
function clock(m) { m = Math.round(m); return m >= SPAN ? '10:00' : '09:' + String(m).padStart(2, '0'); }
function roman(n) { return ROMAN[n - 1] || String(n); }
function nameOf(k) { var c = W.cast.find(function (x) { return x.key === k; }); return c ? c.name : '?'; }
function labelOf(r) { var x = W.rooms.find(function (y) { return y.rid === r; }); return x ? x.label : ''; }

/* marbre : meme fond que le tableau des joueurs */
(function marble() {
  var N = 300, cv = document.createElement('canvas'); cv.width = cv.height = N;
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
    var n = fbm(x / 52, y / 52);
    var m = Math.abs(Math.sin((x / 52 + y / 140 + n * 2.6) * Math.PI));
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
  el.style.backgroundSize = '640px 640px';
})();

function act(payload) {
  return fetch('board/act', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload) })
    .then(function (r) { return r.json(); })
    .then(function (v) { render(v); })
    .catch(function () { toast('The server did not answer. Try again.'); });
}
function pull() {
  fetch('board/state', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (v) { $('syncdot').classList.remove('stale'); if (v.rev !== W.rev) render(v); })
    .catch(function () { $('syncdot').classList.add('stale'); });
}

/* ---------- le sceau ---------- */
function renderSeal() {
  var row = $('sealRow');
  row.classList.toggle('open', W.open);
  $('sealState').textContent = W.open ? 'Open to the table' : 'Sealed';
  $('sealText').textContent = W.open
    ? 'The players can reach the board and edit it. Everything they see is still limited to the faces and places you have unlocked.'
    : 'The board does not exist for anyone but you. Its address answers 404, exactly like an unknown page — a player who has the URL learns nothing, not even that a page is there.';
  $('sealBtn').textContent = W.open ? 'Seal it again' : 'Open to the table';
  $('sealBtn').classList.toggle('primary', !W.open);
  $('sealBtn').classList.toggle('seal', W.open);
  $('playerUrl').textContent = location.origin + '/board';
  $('playerUrl').style.opacity = W.open ? '1' : '.45';
}
$('sealBtn').addEventListener('click', function () {
  if (W.open) { act({ action: 'seal' }); toast('Sealed. Their page is gone.'); }
  else if (confirm('Open the Chronovestigation Board to the players?\n\nThey will be able to reach ' 
      + location.origin + '/board and edit it together.')) {
    act({ action: 'open' }); toast('Open. They can reach it now.');
  }
});

/* ---------- visages ---------- */
function renderCast() {
  $('castToggles').innerHTML = W.cast.map(function (c) {
    return '<button class="tog" data-cast="' + c.key + '" aria-pressed="' + (c.unlocked ? 'true' : 'false')
      + '">' + GEM + esc(c.name) + (c.staff ? ' <span class="opt">staff</span>' : '') + '</button>';
  }).join('') || '<p class="muted">No cast in timeline.json yet.</p>';
}
$('castToggles').addEventListener('click', function (e) {
  var b = e.target.closest('[data-cast]'); if (!b) return;
  act({ action: 'setCast', key: b.dataset.cast, on: b.getAttribute('aria-pressed') !== 'true' });
});
Array.prototype.forEach.call(document.querySelectorAll('[data-all]'), function (b) {
  b.addEventListener('click', function () {
    var g = b.dataset.all;
    act({ action: 'setAllCast', group: g === '' ? null : g, on: b.dataset.on === '1' });
  });
});

/* ---------- lieux ---------- */
function renderRooms() {
  var floors = [], byFloor = {};
  W.rooms.forEach(function (r) {
    if (!byFloor[r.etage]) { byFloor[r.etage] = []; floors.push(r.etage); }
    byFloor[r.etage].push(r);
  });
  $('roomToggles').innerHTML = floors.map(function (f) {
    var all = byFloor[f].every(function (r) { return r.unlocked; });
    return '<div class="floorgroup"><div class="floorlab">' + esc(f)
      + ' <button class="rowbtn" data-floor="' + esc(f) + '" data-on="' + (all ? '0' : '1') + '">'
      + (all ? 'lock floor' : 'unlock floor') + '</button></div><div class="toggles">'
      + byFloor[f].map(function (r) {
          return '<button class="tog" data-room="' + r.rid + '" aria-pressed="'
            + (r.unlocked ? 'true' : 'false') + '" title="' + esc(r.id) + '">' + GEM + esc(r.label) + '</button>';
        }).join('') + '</div></div>';
  }).join('');
}
$('roomToggles').addEventListener('click', function (e) {
  var f = e.target.closest('[data-floor]');
  if (f) return act({ action: 'setFloor', etage: f.dataset.floor, on: f.dataset.on === '1' });
  var b = e.target.closest('[data-room]'); if (!b) return;
  act({ action: 'setRoom', rid: Number(b.dataset.room), on: b.getAttribute('aria-pressed') !== 'true' });
});

/* ---------- remettre une preuve ---------- */
function renderPickers() {
  var keepP = $('pPerson').value, keepR = $('pRoom').value;
  $('pPerson').innerHTML = '<option value="">about nobody</option>' + W.cast.map(function (c) {
    return '<option value="' + c.key + '">' + esc(c.name) + (c.unlocked ? '' : ' — locked') + '</option>';
  }).join('');
  $('pRoom').innerHTML = '<option value="">no place</option>' + W.rooms.map(function (r) {
    return '<option value="' + r.rid + '">' + esc(r.label) + (r.unlocked ? '' : ' — locked') + '</option>';
  }).join('');
  $('pPerson').value = keepP; $('pRoom').value = keepR;
}
$('pPush').addEventListener('click', function () {
  var text = $('pText').value.trim();
  if (!text) { toast('Write the clue first.'); return; }
  act({ action: 'pushClue', kind: $('pKind').value, person: $('pPerson').value || null,
        rid: $('pRoom').value === '' ? null : Number($('pRoom').value), text: text });
  $('pText').value = '';
  toast('Handed over.');
});
$('pText').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('pPush').click(); });

/* ---------- le miroir : leurs voies, sur ta grille ---------- */
function liveSpans() { return W.entries.filter(function (e) { return e.kind === 'span' && !e.dead; }); }
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
/* la grille de 5 minutes n'existe que sur cette page */
function fiveLines() {
  var s = '', m;
  for (m = 5; m < SPAN; m += 5) s += '<div class="fiveline" style="left:' + (m / SPAN * 100) + '%"></div>';
  for (m = 15; m < SPAN; m += 15) s += '<div class="qline" style="left:' + (m / SPAN * 100) + '%"></div>';
  return s;
}
function renderMirror() {
  var bad = clashSet(), live = liveSpans();
  var order = W.cast.filter(function (c) { return c.unlocked; })
    .sort(function (a, b) { return (a.staff ? 1 : 0) - (b.staff ? 1 : 0); });
  $('lanes').innerHTML = order.map(function (c) {
    var mine = live.filter(function (x) { return x.person === c.key; });
    var rows = rowsFor(mine).map(function (row) {
      return '<div class="subrow">' + row.map(function (bk) {
        return '<div class="blk ' + bk.trust + (bad[bk.id] ? ' clash' : '') + '" style="cursor:default;left:'
          + (bk.a / SPAN * 100) + '%;width:' + ((bk.b - bk.a) / SPAN * 100) + '%" title="'
          + esc(labelOf(bk.rid) + ' · ' + clock(bk.a) + '-' + clock(bk.b)
            + (bk.author ? ' · ' + bk.author : '')) + '">'
          + GEM + '<span class="nmtxt">' + esc(labelOf(bk.rid)) + '</span></div>';
      }).join('') + '</div>';
    }).join('') || '<div class="subrow"></div>';
    return '<div class="lane' + (c.staff ? ' staff' : '') + '"><div class="who"><span class="nm">'
      + esc(c.name) + '</span></div><div class="track" style="cursor:default">' + fiveLines() + rows + '</div></div>';
  }).join('');
  $('mirrorEmpty').hidden = order.length > 0;
  var unlockedCast = W.cast.filter(function (c) { return c.unlocked; }).length;
  var unlockedRooms = W.rooms.filter(function (r) { return r.unlocked; }).length;
  $('foot').innerHTML =
      '<span><b>' + live.length + '</b> spans</span>'
    + '<span><b class="bad">' + Math.floor(Object.keys(bad).length / 2) + '</b> contradictions</span>'
    + '<span><b>' + unlockedCast + '</b> / ' + W.cast.length + ' faces unlocked</span>'
    + '<span><b>' + unlockedRooms + '</b> / ' + W.rooms.length + ' rooms unlocked</span>'
    + '<span>They are in <b>Loop ' + roman(W.loop) + '</b></span>';
}
function renderRuler() {
  var s = '', m;
  for (m = 0; m <= SPAN; m += 15) {
    s += '<div class="mark' + (m === SPAN ? ' last' : '') + '" style="left:' + (m / SPAN * 100) + '%">'
       + '<span>' + clock(m) + '</span></div>';
  }
  $('ruler').innerHTML = s;
}
function render(v) {
  if (v) W = v;
  renderSeal(); renderCast(); renderRooms(); renderPickers(); renderMirror();
  snapshot();
}

/* ---------- filet de securite ----------
   Render redemarre sans disque : le serveur peut repartir vide. On garde donc
   une copie du dernier etat vu dans ce navigateur, en plus du fichier a
   telecharger apres chaque session. */
function snapshot() {
  try {
    if (W.entries && W.entries.length) {
      localStorage.setItem('chrono.board', JSON.stringify(W));
      localStorage.setItem('chrono.board.at', new Date().toISOString());
    }
    var at = localStorage.getItem('chrono.board.at');
    $('localInfo').textContent = at ? 'browser copy: ' + at.replace('T', ' ').slice(0, 16) : 'no browser copy yet';
  } catch (e) {}
}
function restore(obj, from) {
  if (!obj || !Array.isArray(obj.cast) || !Array.isArray(obj.entries)) { toast('That file is not a board.'); return; }
  if (!confirm('Replace the board with ' + from + '?\n\n' + obj.entries.length
      + ' entries would take the place of the ' + W.entries.length + ' on the server.')) return;
  act({ action: 'import', board: obj }).then(function () { toast('Restored from ' + from + '.'); });
}
$('impFile').addEventListener('change', function (e) {
  var f = e.target.files && e.target.files[0]; if (!f) return;
  var rd = new FileReader();
  rd.onload = function () {
    try { restore(JSON.parse(rd.result), f.name); } catch (x) { toast('That file will not parse.'); }
  };
  rd.readAsText(f);
  e.target.value = '';
});
$('impLocal').addEventListener('click', function () {
  try {
    var raw = localStorage.getItem('chrono.board');
    if (!raw) { toast('This browser has no copy.'); return; }
    restore(JSON.parse(raw), 'this browser\'s copy');
  } catch (e) { toast('The browser copy is unreadable.'); }
});

var toastTimer = null;
function toast(msg) {
  var el = $('toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 3000);
}

$('backLink').href = location.pathname.replace(/\/warden$/, '');
renderRuler();
render(null);
pull();
setInterval(pull, 1500);
})();
