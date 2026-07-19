/* Logique client partagée : son, formatage, sablier, synchronisation. */

/* ---------- Audio (WebAudio, aucun fichier requis) ---------- */
let audioCtx = null;
var soundMuted = false;      // basculé par l'interface joueur
let masterGain = null;
function unlockAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(audioCtx.destination);
    } catch (e) { return; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
// une "note" = fondamentale + octave inférieure pour un son riche et fort
function tone(freq, start, dur, vol, type) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime + start;
  const peak = vol || 0.7;
  const g = audioCtx.createGain();
  g.connect(masterGain || audioCtx.destination);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  [[freq, type || 'sine', 1], [freq / 2, 'sine', 0.5], [freq * 2, 'triangle', 0.28]].forEach(function (v) {
    const o = audioCtx.createOscillator();
    const og = audioCtx.createGain();
    o.type = v[1]; o.frequency.value = v[0]; og.gain.value = v[2];
    o.connect(og); og.connect(g);
    o.start(t); o.stop(t + dur + 0.04);
  });
}
function playAlert(kind) {
  if (soundMuted) return;
  unlockAudio();
  const V = 0.75;
  if (kind === 'timer') {
    // triade ascendante urgente, jouée deux fois
    [0, 0.55].forEach(function (o) {
      tone(988, o, 0.24, V); tone(1319, o + 0.17, 0.24, V); tone(1760, o + 0.34, 0.34, V);
    });
  } else if (kind === 'reminder') {
    // « ding-dong » clair, deux fois
    [0, 0.62].forEach(function (o) {
      tone(784, o, 0.30, V, 'triangle'); tone(1047, o + 0.24, 0.40, V, 'triangle');
    });
  } else if (kind === 'end') {
    tone(523, 0, 0.5, V); tone(392, 0.42, 0.7, V); tone(262, 0.9, 1.1, V);
  }
}

/* ---------- Formatage ---------- */
function fmt(ms) {
  ms = Math.max(0, ms);
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}

/* ---------- Sablier ---------- */
const HG = { yTop: 42, yNeck: 150, yBottom: 258 };
function hourglassSVG(cls) {
  return `
<svg class="hourglass ${cls || ''}" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="topClip-${cls}"><polygon points="42,42 158,42 100,150"/></clipPath>
    <clipPath id="botClip-${cls}"><polygon points="100,150 42,258 158,258"/></clipPath>
    <linearGradient id="sand-${cls}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f0cd85"/><stop offset="100%" stop-color="#d99f41"/>
    </linearGradient>
  </defs>
  <!-- Montants bois -->
  <rect x="26" y="30" width="148" height="14" rx="5" fill="#8a643c"/>
  <rect x="26" y="256" width="148" height="14" rx="5" fill="#8a643c"/>
  <rect x="30" y="34" width="140" height="4" rx="2" fill="#a67c4d"/>
  <rect x="30" y="262" width="140" height="4" rx="2" fill="#6b4a2b"/>
  <line x1="40" y1="44" x2="40" y2="256" stroke="#6b4a2b" stroke-width="6" stroke-linecap="round"/>
  <line x1="160" y1="44" x2="160" y2="256" stroke="#6b4a2b" stroke-width="6" stroke-linecap="round"/>
  <!-- Verre -->
  <polygon points="42,44 158,44 100,150 42,44" fill="rgba(180,205,255,0.06)" stroke="rgba(180,205,255,0.25)" stroke-width="1.5"/>
  <polygon points="100,150 42,256 158,256 100,150" fill="rgba(180,205,255,0.06)" stroke="rgba(180,205,255,0.25)" stroke-width="1.5"/>
  <!-- Sable haut -->
  <g clip-path="url(#topClip-${cls})">
    <rect class="sand-top" x="42" y="42" width="116" height="108" fill="url(#sand-${cls})"/>
  </g>
  <!-- Filet de sable -->
  <rect class="sand-stream" x="98.5" y="150" width="3" height="106" fill="#e8b559" opacity="0.9"/>
  <!-- Sable bas -->
  <g clip-path="url(#botClip-${cls})">
    <rect class="sand-bot" x="42" y="258" width="116" height="0" fill="url(#sand-${cls})"/>
  </g>
  <!-- Reflets verre -->
  <line x1="66" y1="52" x2="92" y2="140" stroke="rgba(255,255,255,0.10)" stroke-width="4" stroke-linecap="round"/>
</svg>`;
}
function updateHourglass(root, fraction, running) {
  const f = Math.max(0, Math.min(1, fraction));
  const top = root.querySelector('.sand-top');
  const bot = root.querySelector('.sand-bot');
  const stream = root.querySelector('.sand-stream');
  const ySurf = HG.yTop + f * (HG.yNeck - HG.yTop);
  top.setAttribute('y', ySurf);
  top.setAttribute('height', Math.max(0, HG.yNeck - ySurf));
  const yFill = HG.yBottom - f * (HG.yBottom - HG.yNeck);
  bot.setAttribute('y', yFill);
  bot.setAttribute('height', Math.max(0, HG.yBottom - yFill));
  stream.style.display = running && f > 0.0005 && f < 0.9995 ? 'block' : 'none';
}

/* ---------- Actions serveur ---------- */
async function sendAction(payload) {
  try {
    const r = await fetch('/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await r.json();
  } catch (e) { return null; }
}

/* ---------- Synchronisation (polling + interpolation fluide) ---------- */
function startSync({ onState, onEvent, onFrame }) {
  let last = null;
  let fetchedAt = Date.now();
  let lastEventId = null;

  async function poll() {
    try {
      const r = await fetch('/state', { cache: 'no-store' });
      const s = await r.json();
      applyState(s);
    } catch (e) {}
  }
  function applyState(s) {
    last = s;
    fetchedAt = Date.now();
    if (lastEventId === null) {
      lastEventId = s.events.length ? s.events[s.events.length - 1].id : 0;
    } else {
      for (const e of s.events) {
        if (e.id > lastEventId) {
          lastEventId = e.id;
          onEvent && onEvent(e);
        }
      }
    }
    onState && onState(s);
  }

  poll();
  setInterval(poll, 400);

  function frame() {
    if (last) {
      const rem = last.running
        ? Math.max(0, last.remainingMs - (Date.now() - fetchedAt))
        : last.remainingMs;
      onFrame && onFrame(rem, last);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return { applyState };
}
