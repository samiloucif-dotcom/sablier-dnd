/*
 * trial_dice.js — skill checks on the players' side (the trial page /trial and
 * the hourglass page /).
 *
 *  - When the GM asks a character for a roll, that character's player gets a
 *    "Roll for <skill>" window: modifier (− 0 +), then Roll / Roll with
 *    advantage / Roll with disadvantage.
 *  - The server throws the d20s; every screen shows the same dice tumbling on
 *    "the table" (a band at the bottom of the screen), then the result:
 *    die + modifier = total. Advantage / disadvantage throw two and keep the
 *    higher / lower.
 *  - Each PC has their own die, drawn here (no image files): Angèle violet and
 *    gold, Askii brass and gears, Pryah obsidian and lava, Müne moss and leaves,
 *    Bardik smoke and shadow.
 *  - On the hourglass page, a small "Who are you?" chip lets a player pick
 *    their character (the same choice as on /trial).
 *
 * Usage:  const dice = TrialDice.mount({ cid, post, identity, soundOn, bottom });
 *         dice.update(view)    // view = what /trial/state?cid= returns
 */
(function (root) {
  'use strict';
  const C = root.TrialCore;
  const PHI = (1 + Math.sqrt(5)) / 2;

  /* ======================= the d20 (geometry) ======================= */
  const V = [];
  [[0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI]].forEach(([a, b, c]) => {
    V.push([a, b, c], [b, c, a], [c, a, b]);
  });
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const FACES = [];
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
    if ([[i, j], [j, k], [i, k]].every(([p, q]) => Math.abs(len(sub(V[p], V[q])) - 2) < 1e-6)) {
      let f = [i, j, k];
      const c = mul(addv(addv(V[i], V[j]), V[k]), 1 / 3);
      if (dot(cross(sub(V[j], V[i]), sub(V[k], V[i])), c) < 0) f = [i, k, j];
      FACES.push({ v: f, c, n: norm(c) });
    }
  }
  // numbers: opposite faces add up to 21, like a real d20
  (function number() {
    const used = new Array(20).fill(false);
    let next = 1;
    FACES.forEach((f, i) => {
      if (used[i]) return;
      const o = FACES.findIndex((g, j) => !used[j] && j !== i && dot(g.n, f.n) < -0.999);
      used[i] = used[o] = true;
      f.num = next; FACES[o].num = 21 - next; next++;
    });
    FACES.forEach((f) => {
      f.up = norm(sub(V[f.v[0]], f.c));          // the number's top points at a corner
      f.right = cross(f.up, f.n);
    });
  })();
  const R_CIRC = len(V[0]);                       // circumradius (≈1.902)

  /* ---------- rotations (quaternions [w,x,y,z]) ---------- */
  const qmul = (a, b) => [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
  const qaxis = (ax, ang) => { const s = Math.sin(ang / 2), n = norm(ax); return [Math.cos(ang / 2), n[0] * s, n[1] * s, n[2] * s]; };
  function qmat(q) {
    const [w, x, y, z] = q;
    return [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
            [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
            [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]];
  }
  function matq(m) {                              // rotation matrix -> quaternion
    const t = m[0][0] + m[1][1] + m[2][2];
    let w, x, y, z;
    if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = s / 4; x = (m[2][1] - m[1][2]) / s; y = (m[0][2] - m[2][0]) / s; z = (m[1][0] - m[0][1]) / s; }
    else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; w = (m[2][1] - m[1][2]) / s; x = s / 4; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s; }
    else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = s / 4; z = (m[1][2] + m[2][1]) / s; }
    else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = s / 4; }
    return [w, x, y, z];
  }
  const rot = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
  /* the orientation that shows face `num` to the viewer, upright, slightly tilted for depth */
  function restFor(num, tilt) {
    const f = FACES.find((g) => g.num === num);
    const m = [f.right, f.up, f.n];               // rows: the face's frame -> screen x, y, z
    return qmul(qaxis([1, 0, 0], -0.13), qmul(qaxis([0, 1, 0], tilt || 0.12), matq(m)));
  }

  /* ======================= the five dice (textures) ======================= */
  function noiseFn(seed) {
    const h = (x, y) => { let n = x * 374761393 + y * 668265263 + seed * 2147483647; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967295; };
    const sm = (t) => t * t * (3 - 2 * t);
    const v = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      return a + (b - a) * sm(xf) + (c - a) * sm(yf) + (a - b - c + d) * sm(xf) * sm(yf);
    };
    return (x, y, oct) => { let s = 0, amp = 0.5, f = 1; for (let i = 0; i < (oct || 4); i++) { s += amp * v(x * f, y * f); amp /= 2; f *= 2; } return s; };
  }
  const TEX = 384;
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function pixels(paint) {
    const c = canvas(TEX, TEX), g = c.getContext('2d'), img = g.createImageData(TEX, TEX);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const [r, gg, b] = paint(x, y), i = (y * TEX + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const cl01 = (t) => Math.max(0, Math.min(1, t));

  const STYLES = {
    /* Angèle — classy: deep violet marble, thin gold veins, gold edges */
    angele: {
      edge: '#f1c66e', edgeW: 0.022, ink: '#ffe7a6', inkLine: '#2a0d45', font: "700 64px Cinzel, Georgia, serif",
      aura: 'rgba(190,140,255,.55)', label: 'violet & gold',
      tex() {
        const n = noiseFn(11);
        const c = pixels((x, y) => {
          const f = n(x / 70, y / 70, 5);
          const vein = Math.abs(Math.sin((x * 0.018 + y * 0.011) + f * 7.5));
          let col = mix([58, 20, 104], [118, 62, 178], cl01(f * 1.3 - 0.2));
          if (vein < 0.05) col = mix(col, [241, 198, 110], 1 - vein / 0.05);
          return col;
        });
        const g = c.getContext('2d');
        for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,230,160,' + (0.25 + Math.random() * 0.6) + ')'; g.beginPath(); g.arc(Math.random() * TEX, Math.random() * TEX, Math.random() * 1.3 + 0.3, 0, 7); g.fill(); }
        return c;
      },
    },
    /* Askii — steampunk: brushed brass, rivets, gears */
    askii: {
      edge: '#3b2408', edgeW: 0.03, ink: '#2a1606', inkLine: '#f6d79a', font: "400 70px Anton, Impact, sans-serif",
      aura: 'rgba(255,190,90,.35)', label: 'brass & gears',
      tex() {
        const n = noiseFn(23);
        const c = pixels((x, y) => {
          const streak = n(x / 140, y / 3, 3), f = n(x / 60, y / 60, 4);
          return mix([110, 70, 24], [214, 160, 72], cl01(0.25 + streak * 0.7 + (f - 0.5) * 0.5));
        });
        const g = c.getContext('2d');
        const gear = (x, y, r, teeth, col) => {
          g.save(); g.translate(x, y); g.fillStyle = col; g.beginPath();
          for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r : r * 1.18; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, 0, r * 0.38, 0, 7); g.fill(); g.restore();
        };
        for (let i = 0; i < 9; i++) gear(Math.random() * TEX, Math.random() * TEX, 18 + Math.random() * 30, 8 + (i % 5), 'rgba(70,40,10,.32)');
        for (let i = 0; i < 70; i++) {
          const x = Math.random() * TEX, y = Math.random() * TEX, r = 3 + Math.random() * 2;
          const rg = g.createRadialGradient(x - r / 3, y - r / 3, 0.5, x, y, r);
          rg.addColorStop(0, '#fff1c4'); rg.addColorStop(0.5, '#b07a30'); rg.addColorStop(1, '#4a2c0c');
          g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        }
        g.strokeStyle = 'rgba(255,240,200,.18)'; g.lineWidth = 1;
        for (let i = 0; i < 40; i++) { const x = Math.random() * TEX, y = Math.random() * TEX; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + Math.random() * 60, y + Math.random() * 6 - 3); g.stroke(); }
        return c;
      },
    },
    /* Pryah — volcanic: obsidian with glowing lava cracks */
    pryah: {
      edge: '#d9480f', edgeW: 0.018, ink: '#ffd27a', inkLine: '#3a0c02', font: "700 64px Cinzel, Georgia, serif",
      aura: 'rgba(255,90,20,.6)', glowInk: '#ff5a10', label: 'obsidian & lava',
      tex() {
        const n = noiseFn(37);
        const pts = []; for (let i = 0; i < 46; i++) pts.push([Math.random() * TEX, Math.random() * TEX]);
        return pixels((x, y) => {
          let d1 = 1e9, d2 = 1e9;
          for (const p of pts) {
            for (let ox = -TEX; ox <= TEX; ox += TEX) for (let oy = -TEX; oy <= TEX; oy += TEX) {
              const d = Math.hypot(x - p[0] - ox, y - p[1] - oy);
              if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
            }
          }
          const f = n(x / 40, y / 40, 4);
          const crack = d2 - d1 + (f - 0.5) * 9;
          let col = mix([14, 9, 8], [46, 26, 22], f);
          if (crack < 4.5) { const t = 1 - crack / 4.5; col = mix(col, t > 0.75 ? [255, 196, 90] : [235, 70, 14], Math.pow(t, 1.1)); }
          return col;
        });
      },
    },
    /* Müne — forest: moss, leaf veins */
    mune: {
      edge: '#6b4a26', edgeW: 0.026, ink: '#f4efd2', inkLine: '#16300f', font: "700 64px Cinzel, Georgia, serif",
      aura: 'rgba(140,220,110,.45)', label: 'moss & leaves',
      tex() {
        const n = noiseFn(51);
        const c = pixels((x, y) => {
          const f = n(x / 50, y / 50, 5), m = n(x / 9, y / 9, 2);
          let col = mix([22, 52, 24], [58, 104, 44], cl01(f * 1.4 - 0.2));
          if (m > 0.66) col = mix(col, [120, 160, 70], (m - 0.66) * 2.2);
          return col;
        });
        const g = c.getContext('2d');
        for (let i = 0; i < 14; i++) {
          const x = Math.random() * TEX, y = Math.random() * TEX, L = 40 + Math.random() * 50, a = Math.random() * 7;
          g.save(); g.translate(x, y); g.rotate(a);
          g.fillStyle = 'rgba(150,200,90,.22)'; g.beginPath(); g.ellipse(0, 0, L / 2, L / 5, 0, 0, 7); g.fill();
          g.strokeStyle = 'rgba(214,236,160,.45)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
          g.lineWidth = 0.9;
          for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * L / 7, 0); g.lineTo(k * L / 7 + L / 9, -L / 6); g.moveTo(k * L / 7, 0); g.lineTo(k * L / 7 + L / 9, L / 6); g.stroke(); }
          g.restore();
        }
        return c;
      },
    },
    /* Bardik — dark and shadowy: smoke swirling in black */
    bardik: {
      edge: '#6d5a99', edgeW: 0.016, ink: '#d8c8ff', inkLine: '#07060b', font: "700 64px Cinzel, Georgia, serif",
      aura: 'rgba(20,10,40,.9)', glowInk: '#9a7cff', smoke: true, label: 'smoke & shadow',
      tex() {
        const n = noiseFn(77);
        return pixels((x, y) => {
          const w = n(x / 90 + n(x / 40, y / 40, 3) * 2, y / 90, 5);
          const s = Math.pow(cl01((w - 0.42) * 2.6), 1.6);
          return mix([9, 8, 13], [92, 78, 122], s);
        });
      },
    },
  };
  const texCache = {};
  const texOf = (k) => texCache[k] || (texCache[k] = STYLES[k].tex());

  /* ======================= drawing one die ======================= */
  function affine(u0, v0, u1, v1, u2, v2, x0, y0, x1, y1, x2, y2) {
    const du1 = u1 - u0, dv1 = v1 - v0, du2 = u2 - u0, dv2 = v2 - v0, det = du1 * dv2 - du2 * dv1;
    const a = ((x1 - x0) * dv2 - (x2 - x0) * dv1) / det, b = ((y1 - y0) * dv2 - (y2 - y0) * dv1) / det;
    const c = ((x2 - x0) * du1 - (x1 - x0) * du2) / det, d = ((y2 - y0) * du1 - (y1 - y0) * du2) / det;
    return [a, b, c, d, x0 - a * u0 - c * v0, y0 - b * u0 - d * v0];
  }
  const LIGHT = norm([-0.45, 0.65, 0.75]);
  /* q orientation; (cx, cy) centre in px; size = radius in px; alpha for the discarded die */
  function drawDie(g, key, q, cx, cy, size, alpha, ring) {
    const S = STYLES[key] || STYLES.angele, tex = texOf(key in STYLES ? key : 'angele');
    const m = qmat(q), D = 7, k = size / R_CIRC;
    const P = (v) => { const p = rot(m, v), s = D / (D - p[2]); return [cx + p[0] * k * s, cy - p[1] * k * s, p[2]]; };
    const pv = V.map(P);
    const faces = FACES.map((f, i) => {
      const n = rot(m, f.n), c = rot(m, f.c);
      return { f, i, n, z: c[2], vis: dot(n, sub([0, 0, D], c)) > 0 };
    }).filter((x) => x.vis).sort((a, b) => a.z - b.z);
    g.save();
    g.globalAlpha = alpha == null ? 1 : alpha;
    // aura
    const au = g.createRadialGradient(cx, cy, size * 0.4, cx, cy, size * 1.45);
    au.addColorStop(0, S.aura); au.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = au; g.beginPath(); g.arc(cx, cy, size * 1.45, 0, 7); g.fill();
    faces.forEach(({ f, i, n }) => {
      const [a, b, c] = f.v.map((j) => pv[j]);
      // texture: each face takes its own patch of the die's texture
      const ox = 40 + ((i * 97) % 220), oy = 40 + ((i * 61) % 220), T = 120;
      g.save();
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath(); g.clip();
      g.setTransform.apply(g, affine(ox, oy + T, ox + T, oy + T, ox + T / 2, oy + T * 0.134, a[0], a[1], b[0], b[1], c[0], c[1]).map((x, j) => x));
      g.drawImage(tex, 0, 0);
      g.restore();
      // light
      const lam = dot(n, LIGHT);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath();
      if (lam > 0.55) { g.fillStyle = 'rgba(255,255,255,' + ((lam - 0.55) * 0.55).toFixed(3) + ')'; g.fill(); }
      const shade = (1 - Math.max(0, lam)) * 0.62;
      if (shade > 0.02) { g.fillStyle = 'rgba(0,0,0,' + shade.toFixed(3) + ')'; g.fill(); }
      g.lineJoin = 'round'; g.lineWidth = Math.max(1, size * S.edgeW * 2); g.strokeStyle = S.edge; g.stroke();
      // the number, in the face's own plane
      if (n[2] > 0.18) {
        const c0 = P(f.c), u = 0.01;
        const pr = P(addv(f.c, mul(f.right, u * 100))), pd = P(addv(f.c, mul(f.up, -u * 100)));
        g.save();
        const ex = [(pr[0] - c0[0]) / 100, (pr[1] - c0[1]) / 100], ey = [(pd[0] - c0[0]) / 100, (pd[1] - c0[1]) / 100];
        g.setTransform(ex[0], ex[1], ey[0], ey[1], c0[0], c0[1] + 0);
        g.translate(0, 6); g.scale(0.8, 0.8);
        g.font = S.font; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.globalAlpha = (alpha == null ? 1 : alpha) * Math.min(1, (n[2] - 0.18) * 3);
        if (S.glowInk) { g.shadowColor = S.glowInk; g.shadowBlur = 18; }
        g.lineWidth = 9; g.strokeStyle = S.inkLine; g.strokeText(String(f.num), 0, 0);
        g.fillStyle = S.ink; g.fillText(String(f.num), 0, 0);
        if (f.num === 6 || f.num === 9) { g.fillRect(-18, 36, 36, 6); }
        g.restore();
      }
    });
    if (ring) {
      g.globalAlpha = 1; g.lineWidth = 3; g.strokeStyle = ring; g.shadowColor = ring; g.shadowBlur = 16;
      g.beginPath(); g.arc(cx, cy, size * 1.12, 0, 7); g.stroke();
    }
    g.restore();
  }

  /* ======================= sound: the rattle ======================= */
  let actx = null;
  let soundOK = () => true;           // each page says whether its sound is on
  function audio() {
    if (!actx) { try { actx = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { return null; } }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  root.addEventListener('pointerdown', () => { audio(); }, { once: false, passive: true });
  function clack(t0, vol) {
    const c = actx; if (!c) return;
    const dur = 0.06, buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = c.createBufferSource(); s.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400 + Math.random() * 1600; bp.Q.value = 3;
    const gn = c.createGain(); gn.gain.value = vol;
    s.connect(bp); bp.connect(gn); gn.connect(c.destination); s.start(c.currentTime + t0);
  }
  function rattle(n) { if (!actx || actx.state !== 'running' || !soundOK()) return; [0, 0.32, 0.6, 0.83, 1.0, 1.12].forEach((t, i) => { for (let k = 0; k < n; k++) clack(t + k * 0.03 + Math.random() * 0.02, 0.5 * Math.pow(0.72, i)); }); }
  function chime(good) {
    if (!actx || actx.state !== 'running' || !soundOK()) return;
    const c = actx, t = c.currentTime;
    (good ? [784, 988, 1319, 1568] : [330, 262, 196]).forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = good ? 'triangle' : 'sawtooth'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = good ? 6000 : 900;
      g.gain.setValueAtTime(0.0001, t + i * 0.09); g.gain.exponentialRampToValueAtTime(good ? 0.22 : 0.25, t + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + (good ? 0.9 : 0.7));
      o.connect(lp); lp.connect(g); g.connect(c.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 1);
    });
  }

  /* ======================= the page parts ======================= */
  const CSS = `
.dz-table{position:fixed;left:0;right:0;margin:0 auto;width:max-content;transform:translateY(20px);z-index:70;display:flex;gap:14px;align-items:flex-end;
  padding:12px 16px 10px;border-radius:18px;background:linear-gradient(180deg,rgba(16,11,25,.97),rgba(8,6,14,.985));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(241,198,110,.35);
  box-shadow:0 18px 50px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:opacity .35s,transform .35s;max-width:calc(100vw - 16px);overflow-x:auto}
.dz-table.on{opacity:1;transform:none;pointer-events:auto}
.dz-seat{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:170px;font-family:system-ui,sans-serif;color:#eee}
.dz-seat.mine .dz-who span{color:#f7d684}
.dz-who{display:flex;align-items:center;gap:7px;font:700 13px/1 Cinzel,Georgia,serif;letter-spacing:.04em}
.dz-who img{width:26px;height:26px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--dc,#888)}
.dz-skill{font:600 11px/1.2 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#bdb3cf}
.dz-cv{width:190px;height:140px;display:block}
.dz-res{min-height:34px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.dz-res .w{font:600 12px/1 system-ui,sans-serif;color:#8d849c;letter-spacing:.06em}
.dz-res .two{font:600 11px/1 system-ui,sans-serif;color:#bdb3cf;letter-spacing:.05em;margin-bottom:3px}
.dz-res .two b{color:#fff}.dz-res .two s{color:#7a7187}
.dz-res .tot{font:400 22px/1 Anton,Impact,sans-serif;letter-spacing:.04em;color:#fff;animation:dzPop .45s cubic-bezier(.2,1.6,.4,1)}
.dz-res .tot em{font-style:normal;color:#f7d684;font-size:30px;margin-left:4px}
.dz-seat.n20 .dz-res .tot em{color:#ffe08a;text-shadow:0 0 14px #ffb800}
.dz-seat.n1 .dz-res .tot em{color:#ff5a6e;text-shadow:0 0 12px #c1001a}
.dz-flag{position:absolute;top:48px;left:50%;transform:translateX(-50%) rotate(-8deg);white-space:nowrap;font:400 26px/1 Anton,Impact,sans-serif;letter-spacing:.06em;
  padding:4px 12px;border-radius:8px;pointer-events:none;animation:dzSlam .5s cubic-bezier(.2,1.5,.4,1) both, dzFade .6s ease-in 3.2s forwards}
.dz-seat.n20 .dz-flag{color:#2a1500;background:linear-gradient(180deg,#ffe9a0,#f1b62e);box-shadow:0 0 24px rgba(255,190,40,.8)}
.dz-seat.n1 .dz-flag{color:#fff;background:linear-gradient(180deg,#d8203a,#7a0614);box-shadow:0 0 20px rgba(220,20,50,.7)}
.dz-seat.absent{opacity:.42}
.dz-mode{font:700 10px/1 system-ui,sans-serif;letter-spacing:.12em;padding:3px 6px;border-radius:6px;margin-left:6px}
.dz-mode.adv{background:#1d4d33;color:#9ff0c1}.dz-mode.dis{background:#5a1622;color:#ffb3bf}
@keyframes dzPop{from{transform:scale(.5);opacity:0}to{transform:none;opacity:1}}
@keyframes dzSlam{from{transform:translateX(-50%) rotate(-8deg) scale(2.4);opacity:0}to{transform:translateX(-50%) rotate(-8deg) scale(1);opacity:1}}
@keyframes dzFade{to{opacity:0}}
.dz-ask{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.96);z-index:75;width:min(430px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;
  padding:18px 18px 16px;border-radius:18px;background:linear-gradient(180deg,#1c1230,#100a1c);border:2px solid #f1c66e;box-shadow:0 30px 80px rgba(0,0,0,.75),0 0 40px rgba(150,90,255,.25);
  color:#eee;font-family:system-ui,sans-serif;text-align:center;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s}
.dz-ask.on{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1)}
.dz-ask .k{font:700 12px/1 Cinzel,Georgia,serif;letter-spacing:.3em;color:#bdb3cf;text-transform:uppercase}
.dz-ask h2{margin:8px 0 2px;font:400 clamp(26px,6vw,38px)/1.05 Anton,Impact,sans-serif;letter-spacing:.03em;color:#f7d684;transform:skewX(-6deg)}
.dz-ask .mod{display:flex;align-items:center;justify-content:center;gap:10px;margin:14px 0 6px}
.dz-ask .mod button{width:48px;height:48px;border-radius:12px;border:1px solid #5a4a7a;background:#22183a;color:#fff;font:700 24px/1 system-ui;cursor:pointer}
.dz-ask .mod input{width:86px;height:52px;text-align:center;border-radius:12px;border:1px solid #f1c66e;background:#0c0814;color:#fff;font:400 30px/1 Anton,Impact,sans-serif}
.dz-ask .ml{font:600 11px/1 system-ui;letter-spacing:.14em;color:#8d849c;text-transform:uppercase}
.dz-ask .go{display:grid;gap:8px;margin-top:14px}
.dz-ask .go button{border-radius:12px;padding:12px;font:400 19px/1 Anton,Impact,sans-serif;letter-spacing:.06em;cursor:pointer;border:2px solid;color:#fff}
.dz-ask .go .n{background:linear-gradient(180deg,#5b2a9c,#34165e);border-color:#f1c66e;font-size:24px;padding:14px}
.dz-ask .go .a{background:linear-gradient(180deg,#1f7a4c,#0f4a2c);border-color:#7ff0b0}
.dz-ask .go .d{background:linear-gradient(180deg,#9a1f33,#5a0c1a);border-color:#ff9db0}
.dz-ask .go button:disabled{filter:grayscale(.8) brightness(.6);cursor:wait}
.dz-ask .row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dz-chip{position:fixed;bottom:14px;left:14px;z-index:72;display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:22px;cursor:pointer;
  background:rgba(14,10,22,.78);border:1px solid rgba(241,198,110,.4);color:#eadbff;font:700 12px/1 Cinzel,Georgia,serif;letter-spacing:.06em}
.dz-chip img{width:26px;height:26px;border-radius:50%;object-fit:cover}
.dz-chip .q{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#2a1d40;font:16px/1 system-ui}
.dz-chip.call{animation:dzCall 1.1s ease-in-out infinite;border-color:#f1c66e;color:#f7d684}
@keyframes dzCall{50%{box-shadow:0 0 0 6px rgba(241,198,110,.25),0 0 24px rgba(241,198,110,.5)}}
.dz-pick{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:18px;
  background:rgba(6,4,10,.86);color:#eee;font-family:system-ui,sans-serif;overflow:auto}
.dz-pick[hidden]{display:none}
.dz-pick h3{margin:0;font:400 clamp(28px,6vw,48px)/1 Anton,Impact,sans-serif;letter-spacing:.04em;color:#f7d684}
.dz-pick .cards{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.dz-pick .card{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px;border-radius:14px;border:1px solid #3a2d55;background:#160f24;cursor:pointer;width:110px;color:#eee;font:700 13px/1 Cinzel,Georgia,serif}
.dz-pick .card img{width:80px;height:80px;border-radius:50%;object-fit:cover}
.dz-pick .card:disabled{opacity:.35;cursor:not-allowed}
.dz-pick .card.me{border-color:#f1c66e}
.dz-pick .lnk{background:none;border:0;color:#bdb3cf;text-decoration:underline;cursor:pointer;font:600 13px/1 system-ui}
`;
  const DIE_COLOR = { angele: '#a26bff', askii: '#d9a24c', pryah: '#ff6a1a', mune: '#8fd46a', bardik: '#7a68a8' };

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tokenSrc = (k) => (root.TRIAL_ASSETS != null ? root.TRIAL_ASSETS : '/') + 'tokens/' + encodeURIComponent(C.BY_KEY[k].token);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const MODE_TXT = { normal: '', adv: 'Advantage', dis: 'Disadvantage' };

  function mount(opts) {
    opts = opts || {};
    if (opts.soundOn) soundOK = opts.soundOn;
    const say = opts.toast || ((m) => alert(m));
    if (!document.getElementById('dz-css')) { const st = el('style'); st.id = 'dz-css'; st.textContent = CSS; document.head.appendChild(st); }
    const table = el('div', 'dz-table'); document.body.appendChild(table);
    const ask = el('div', 'dz-ask'); document.body.appendChild(ask);
    const seats = {};             // key -> { el, cv, anim }
    let view = null, checkId = null, skew = 0, lastRoll = {}, sending = false;
    let chip = null, pick = null;

    const bottom = () => (typeof opts.bottom === 'function' ? opts.bottom() : opts.bottom) || 18;
    const now = () => Date.now() + skew;                 // ≈ server time

    /* ---------- the "who are you" chip (hourglass page) ---------- */
    if (opts.identity) {
      chip = el('button', 'dz-chip'); chip.type = 'button'; document.body.appendChild(chip);
      pick = el('div', 'dz-pick'); pick.hidden = true; document.body.appendChild(pick);
      chip.onclick = () => { paintPick(); pick.hidden = false; };
      pick.onclick = (e) => {
        if (e.target === pick) pick.hidden = true;
        const b = e.target.closest('[data-pick]');
        if (b) {
          const k = b.dataset.pick;
          if (k === '-') opts.post({ action: 'unclaim' }).then(done);
          else if (k === 'x') pick.hidden = true;
          else opts.post({ action: 'claim', key: k }).then((j) => { if (j && j.error) say(j.error); done(j); });
        }
      };
    }
    function done(j) { if (j && j.state) update(j.state); if (pick) pick.hidden = true; }
    function paintPick() {
      const P = (view && view.players) || { taken: [] };
      pick.innerHTML = '<h3>Who are you?</h3><div class="cards">' + C.PCS.map((k) => {
        const taken = P.taken.indexOf(k) >= 0 && P.mine !== k;
        return '<button class="card' + (P.mine === k ? ' me' : '') + '" data-pick="' + k + '"' + (taken ? ' disabled title="Already taken"' : '') + '>'
          + '<img src="' + tokenSrc(k) + '" alt="">' + esc(C.BY_KEY[k].name) + '</button>';
      }).join('') + '</div>' + (P.mine ? '<button class="lnk" data-pick="-">I am not ' + esc(C.BY_KEY[P.mine].name) + ' any more</button>' : '')
        + '<button class="lnk" data-pick="x">Close</button>';
    }
    function paintChip(c) {
      if (!chip) return;
      const P = (view && view.players) || {};
      const k = P.mine;
      const wanted = c && !k && Object.keys(c.items).some((x) => !c.items[x].roll && P.taken.indexOf(x) < 0);
      chip.classList.toggle('call', !!wanted);
      chip.innerHTML = k ? '<img src="' + tokenSrc(k) + '" alt="">' + esc(C.BY_KEY[k].name)
        : '<span class="q">🎲</span>' + (wanted ? 'A roll is asked — who are you?' : 'Who are you?');
    }

    /* ---------- the "Roll for …" window ---------- */
    let askFor = null;            // `${checkId}:${key}` currently shown
    function modKey(k, skill) { return 'm1_dice_mod_' + k + '_' + skill; }
    function paintAsk(c) {
      const P = (view && view.players) || {};
      const k = P.mine, it = c && k && c.items[k];
      const want = it && !it.roll ? c.id + ':' + k : null;
      if (want === askFor) return;
      askFor = want;
      if (!want) { ask.classList.remove('on'); return; }
      let m = 0; try { m = Number(localStorage.getItem(modKey(k, it.skill))) || 0; } catch (e) {}
      ask.innerHTML = '<div class="k">' + esc(C.BY_KEY[k].name) + '</div><h2>Roll for ' + esc(it.skill) + '</h2>'
        + '<div class="mod"><button type="button" data-d="-1" aria-label="minus">−</button><input type="number" inputmode="numeric" value="' + m + '" aria-label="modifier"><button type="button" data-d="1" aria-label="plus">+</button></div>'
        + '<div class="ml">your modifier</div>'
        + '<div class="go"><button class="n" data-m="normal">Roll</button><div class="row2"><button class="a" data-m="adv">Roll with advantage</button><button class="d" data-m="dis">Roll with disadvantage</button></div></div>';
      const inp = ask.querySelector('input');
      ask.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => { inp.value = (Number(inp.value) || 0) + Number(b.dataset.d); }; });
      ask.querySelectorAll('[data-m]').forEach((b) => {
        b.onclick = async () => {
          if (sending) return;
          sending = true;
          audio();
          ask.querySelectorAll('button').forEach((x) => { x.disabled = true; });
          const mod = Math.max(-20, Math.min(30, Math.round(Number(inp.value) || 0)));
          try { localStorage.setItem(modKey(k, it.skill), String(mod)); } catch (e) {}
          const j = await opts.post({ action: 'roll', mode: b.dataset.m, mod });
          sending = false;
          if (j && j.error) { ask.querySelectorAll('button').forEach((x) => { x.disabled = false; }); say(j.error); return; }
          ask.classList.remove('on');
          if (j && j.state) update(j.state);
        };
      });
      ask.classList.add('on');
    }

    /* ---------- the table (everyone) ---------- */
    function seat(k, it, mine) {
      let s = seats[k];
      if (!s) {
        const e = el('div', 'dz-seat');
        e.style.setProperty('--dc', DIE_COLOR[k]);
        e.innerHTML = '<div class="dz-who"><img src="' + tokenSrc(k) + '" alt=""><span>' + esc(C.BY_KEY[k].name) + '</span></div>'
          + '<div class="dz-skill"></div><canvas class="dz-cv"></canvas><div class="dz-res"></div>';
        table.appendChild(e);
        s = seats[k] = { key: k, el: e, cv: e.querySelector('canvas'), roll: null, anim: null, idle: Math.random() * 6 };
      }
      s.el.classList.toggle('mine', !!mine);
      s.el.querySelector('.dz-skill').innerHTML = esc(it.skill) + (it.roll && it.roll.mode !== 'normal' ? '<span class="dz-mode ' + it.roll.mode + '">' + (it.roll.mode === 'adv' ? 'ADV' : 'DIS') + '</span>' : '');
      s.el.classList.toggle('absent', !!it.absent && !it.roll);
      const sig = it.roll ? it.roll.at + ':' + it.roll.dice.join(',') : null;
      if (sig !== s.sig) {
        s.sig = sig; s.roll = it.roll;
        s.el.classList.remove('n20', 'n1');
        const f = s.el.querySelector('.dz-flag'); if (f) f.remove();
        const res = s.el.querySelector('.dz-res');
        if (!it.roll) {
          s.anim = null;
          res.innerHTML = '<span class="w">' + (it.absent ? 'not at the table' : 'waiting…') + '</span>';
        } else {
          const age = now() - (it.roll.at || 0);
          s.anim = makeAnim(k, it.roll, age > 2500);
          res.innerHTML = '<span class="w">…</span>';
          if (age <= 2500) setTimeout(() => rattle(it.roll.dice.length), 30);
        }
      }
    }
    function makeAnim(k, r, settled) {
      const n = r.dice.length;
      return {
        k, r, t0: performance.now() - (settled ? 5000 : 0), dur: 1650, shown: false,
        dice: r.dice.map((v, i) => ({
          v, rest: restFor(v, (i ? -0.12 : 0.12) + (Math.random() - 0.5) * 0.1),
          a1: norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]), t1: (3 + Math.random() * 2.5) * Math.PI * 2 * (Math.random() < 0.5 ? -1 : 1),
          a2: norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]), t2: (1 + Math.random() * 1.5) * Math.PI * 2,
          from: (i ? 1 : -1) * (0.9 + Math.random() * 0.4), delay: i * 90,
        })),
        keep: n === 2 ? r.dice.indexOf(r.kept) : 0,
      };
    }
    function paintResult(s) {
      const r = s.roll, res = s.el.querySelector('.dz-res');
      const sign = r.mod >= 0 ? '+ ' + r.mod : '− ' + Math.abs(r.mod);
      const two = r.dice.length === 2
        ? '<div class="two">' + MODE_TXT[r.mode] + ': ' + r.dice.map((d, i) => (i === s.anim.keep ? '<b>' + d + '</b>' : '<s>' + d + '</s>')).join(' · ') + '</div>' : '';
      res.innerHTML = two + '<div class="tot">' + r.kept + ' ' + sign + ' =<em>' + r.total + '</em></div>';
      if (r.kept === 20 || r.kept === 1) {
        s.el.classList.add(r.kept === 20 ? 'n20' : 'n1');
        s.el.appendChild(el('div', 'dz-flag', r.kept === 20 ? 'NATURAL 20!' : 'NATURAL 1'));
        if (performance.now() - s.anim.t0 < 4000) chime(r.kept === 20);
      }
    }
    function drawSeat(s, t) {
      const cv = s.cv, dpr = Math.min(2, root.devicePixelRatio || 1);
      const W = cv.clientWidth || 170, H = cv.clientHeight || 132;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const g = cv.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      const k = s.anim ? s.anim.k : null;
      if (!s.anim) {                               // waiting: a ghost die turning slowly
        s.idle += 0.008;
        const q = qmul(qaxis([0.3, 1, 0.2], s.idle), qaxis([1, 0, 0], s.idle * 0.6));
        drawDie(g, s.key, q, cv.width / 2, cv.height * 0.5, Math.min(cv.width, cv.height) * 0.3, 0.32);
        return;
      }
      const A = s.anim, n = A.dice.length, floor = cv.height * 0.56;
      const size = Math.min(cv.width / (n === 2 ? 4.1 : 2.5), cv.height * 0.38);
      A.dice.forEach((d, i) => {
        const tt = Math.max(0, Math.min(1, (t - A.t0 - d.delay) / A.dur));
        const e = easeOut(tt);
        const spin = qmul(qaxis(d.a1, d.t1 * (1 - e)), qaxis(d.a2, d.t2 * (1 - e)));
        const q = qmul(d.rest, spin);
        const xEnd = n === 2 ? cv.width * (i ? 0.73 : 0.27) : cv.width / 2;
        const x = xEnd + d.from * cv.width * 0.45 * (1 - e);
        const hop = Math.abs(Math.cos(tt * Math.PI * 3.2)) * Math.pow(1 - tt, 2.2) * cv.height * 0.42;
        const y = floor - hop;
        // shadow
        g.save(); g.globalAlpha = 0.45 * (1 - hop / (cv.height * 0.5));
        g.fillStyle = 'rgba(0,0,0,.8)'; g.beginPath(); g.ellipse(x, floor + size * 0.95, size * 0.9, size * 0.22, 0, 0, 7); g.fill(); g.restore();
        const settledAll = t - A.t0 > A.dur + 200;
        const dim = n === 2 && settledAll && i !== A.keep;
        const ring = n === 2 && settledAll && i === A.keep ? (A.r.mode === 'adv' ? '#7ff0b0' : '#ff9db0') : null;
        drawDie(g, k, q, x, y, size, dim ? 0.35 : 1, ring);
      });
      if (!A.shown && t - A.t0 > A.dur + 120) { A.shown = true; paintResult(s); }
    }

    let raf = 0;
    function loop(t) {
      raf = 0;
      const on = table.classList.contains('on');
      Object.keys(seats).forEach((k) => drawSeat(seats[k], t));
      if (on) raf = requestAnimationFrame(loop);
    }

    function update(v) {
      const fresh = v !== view;
      view = v;
      if (fresh && v && v.serverNow) skew = v.serverNow - Date.now();     // only from a new answer: an old one would freeze the clock
      const c = v && v.dice && v.dice.check;
      paintChip(c);
      if (fresh && pick && !pick.hidden) paintPick();
      paintAsk(c);
      const P = (v && v.players) || {};
      const live = c && !(c.doneAt && now() - c.doneAt > 4800);
      if (!c || c.id !== checkId) {               // a new check: clear the table
        Object.keys(seats).forEach((k) => { seats[k].el.remove(); delete seats[k]; });
        checkId = c ? c.id : null;
      }
      if (live) {
        C.PCS.filter((k) => c.items[k]).forEach((k) => seat(k, c.items[k], P.mine === k));
        table.style.bottom = bottom() + 'px';
      }
      table.classList.toggle('on', !!live);
      placeAsk();
      if (live && !raf) raf = requestAnimationFrame(loop);
    }

    /* the roll window sits above the table, never on it */
    function placeAsk() {
      if (!ask.classList.contains('on')) return;
      const H = root.innerHeight, h = ask.offsetHeight;
      const tableTop = table.classList.contains('on') ? H - bottom() - table.offsetHeight : H;
      const mid = Math.min(H / 2, tableTop - 14 - h / 2);
      ask.style.top = Math.max(h / 2 + 8, mid) + 'px';
    }
    // keep the table's position right when the page around it changes
    root.addEventListener('resize', () => { table.style.bottom = bottom() + 'px'; placeAsk(); });
    setInterval(() => { if (view) update(view); }, 1000);     // lets a finished check fade out on time

    return { update, el: table };
  }

  /* a still die, for previews */
  function snapshot(key, num, size) {
    const c = canvas(size * 2.6, size * 2.6), g = c.getContext('2d');
    drawDie(g, key, restFor(num, 0.2), c.width / 2, c.height / 2, size);
    return c;
  }

  root.TrialDice = { mount, STYLES, snapshot, FACES, restFor };
})(typeof window !== 'undefined' ? window : this);
