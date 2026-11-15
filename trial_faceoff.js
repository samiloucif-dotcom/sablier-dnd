/*
 * trial_faceoff.js — ABOUT TO TIP: the face-off, on every stage (the players'
 * screens and the GM's preview).
 *
 * After the ABOUT TO TIP banner the courtroom fades back (blurred, darkened)
 * and the two sides face each other: the defense and its ally on the left, the
 * five prosecutors on the right, three empty sockets on top of each side.
 * Each round (the GM drives it, trial_core.js holds the rules):
 *   1. the defense or the ally speaks: they step forward;
 *   2. a die picks the prosecutor who answers — it carries the faces of those
 *      who have not spoken yet (d10 for five, d12 for four, d6 for three, d20
 *      for two; the last one needs no die). The server throws it; every screen
 *      shows the same tumble and the same face;
 *   3. the chosen prosecutor comes to the centre, face to face;
 *   4. BREAK: a Polychroma token flies to the prosecution's sockets; FAIL: to
 *      the defense's. First to 3 wins; the scene fades and the courtroom is back.
 *
 * The dice are drawn here (no image files): dark lacquer, gold edges, each
 * face showing its prosecutor's token in their colour.
 *
 *   const fo = TrialFaceoff.create(stage);   // trial_stage.js does it
 *   fo.update(view.faceoff, { age, pl, first });  fo.frame(now);  fo.visible()
 */
(function (root) {
  'use strict';
  const C = root.TrialCore;
  const PHI = (1 + Math.sqrt(5)) / 2;

  /* ======================= vectors, rotations ======================= */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => mul(a, 1 / len(a));
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
  function matq(m) {
    const t = m[0][0] + m[1][1] + m[2][2];
    let w, x, y, z;
    if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = s / 4; x = (m[2][1] - m[1][2]) / s; y = (m[0][2] - m[2][0]) / s; z = (m[1][0] - m[0][1]) / s; }
    else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; w = (m[2][1] - m[1][2]) / s; x = s / 4; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s; }
    else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = s / 4; z = (m[1][2] + m[2][1]) / s; }
    else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = s / 4; }
    return [w, x, y, z];
  }
  const rot = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /* ======================= the four dice ======================= */
  const SOLIDS = {};
  function solid(sides) {
    if (SOLIDS[sides]) return SOLIDS[sides];
    const V = [], F = [];
    if (sides === 6) {                                           // cube
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
      for (let a = 0; a < 3; a++) for (const s of [1, -1]) F.push(V.map((v, i) => (v[a] === s ? i : -1)).filter((i) => i >= 0));
    } else if (sides === 20) {                                   // icosahedron
      [[0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI]].forEach(([a, b, c]) => V.push([a, b, c], [b, c, a], [c, a, b]));
      for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
        if ([[i, j], [j, k], [i, k]].every(([p, q]) => Math.abs(len(sub(V[p], V[q])) - 2) < 1e-6)) F.push([i, j, k]);
      }
    } else if (sides === 12) {                                   // dodecahedron: one face per icosahedron vertex
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
      const q = 1 / PHI;
      for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) V.push([0, s1 * q, s2 * PHI], [s1 * q, s2 * PHI, 0], [s2 * PHI, 0, s1 * q]);
      const N = [];
      for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) N.push([0, s1 * PHI, s2], [s1 * PHI, s2, 0], [s2, 0, s1 * PHI]);
      N.forEach((n) => {
        const d = V.map((v) => dot(v, n)), mx = Math.max.apply(null, d);
        F.push(d.map((x, i) => (x > mx - 1e-6 ? i : -1)).filter((i) => i >= 0));
      });
    } else {                                                     // d10: pentagonal trapezohedron (kites)
      const z0 = 0.12, c36 = Math.cos(Math.PI / 5), h = z0 * (1 + c36) / (1 - c36);
      V.push([0, 0, h], [0, 0, -h]);
      for (let j = 0; j < 5; j++) V.push([Math.cos(j * 2 * Math.PI / 5), Math.sin(j * 2 * Math.PI / 5), z0]);
      for (let j = 0; j < 5; j++) V.push([Math.cos(Math.PI / 5 + j * 2 * Math.PI / 5), Math.sin(Math.PI / 5 + j * 2 * Math.PI / 5), -z0]);
      for (let j = 0; j < 5; j++) F.push([0, 2 + j, 7 + j, 2 + (j + 1) % 5]);
      for (let j = 0; j < 5; j++) F.push([1, 7 + j, 2 + (j + 1) % 5, 7 + (j + 1) % 5]);
    }
    const faces = F.map((ix) => {
      const pts = ix.map((i) => V[i]);
      const c = mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length);
      const n0 = norm(c), e1 = norm(sub(pts[0], c)), e2 = cross(n0, e1);
      let v = ix.slice().sort((a, b) => {
        const pa = sub(V[a], c), pb = sub(V[b], c);
        return Math.atan2(dot(pa, e2), dot(pa, e1)) - Math.atan2(dot(pb, e2), dot(pb, e1));
      });
      let n = [0, 0, 0];                                          // Newell's normal
      v.forEach((a, t) => { const p = V[a], q = V[v[(t + 1) % v.length]]; n = add(n, [(p[1] - q[1]) * (p[2] + q[2]), (p[2] - q[2]) * (p[0] + q[0]), (p[0] - q[0]) * (p[1] + q[1])]); });
      n = norm(n);
      if (dot(n, c) < 0) { v = v.reverse(); n = mul(n, -1); }
      // which way is "up" on the face: the kite's tip, the middle of a square's edge, a corner otherwise
      let far = v[0];
      if (sides === 10) far = v.reduce((m, a) => (len(sub(V[a], c)) > len(sub(V[m], c)) ? a : m), v[0]);
      const upPt = sides === 6 ? mul(add(V[v[0]], V[v[1]]), 0.5) : V[far];
      const up = norm(sub(upPt, c)), right = cross(up, n);
      let r = Infinity;                                           // the largest circle around c inside the face
      v.forEach((a, t) => {
        const p = V[a], q = V[v[(t + 1) % v.length]], d = sub(q, p), w = sub(c, p);
        r = Math.min(r, len(cross(d, w)) / len(d));
      });
      // kites: the circle sits a little towards the wide end
      return { v, c, n, up, right, r };
    });
    const R = Math.max.apply(null, V.map(len));
    return (SOLIDS[sides] = { sides, V, faces, R });
  }
  /* the orientation that shows face i to the viewer, upright, a little tilted */
  function restFor(S, i, tilt) {
    const f = S.faces[i];
    return qmul(qaxis([1, 0, 0], -0.16), qmul(qaxis([0, 1, 0], tilt || 0.14), matq([f.right, f.up, f.n])));
  }

  const COLOR = { angele: '#a26bff', askii: '#d9a24c', pryah: '#ff6a1a', mune: '#8fd46a', bardik: '#8a78c0' };
  const LIGHT = norm([-0.45, 0.65, 0.75]);
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const faceFill = (col) => { const [r, g, b] = hexRgb(col); return 'rgb(' + Math.round(22 + r * 0.32) + ',' + Math.round(14 + g * 0.24) + ',' + Math.round(30 + b * 0.3) + ')'; };

  /* one die: q orientation, (cx, cy) centre and size (radius) in canvas pixels */
  function drawSolid(g, S, owners, q, cx, cy, size, imgs, alpha, ring) {
    const m = qmat(q), D = 7, k = size / S.R;
    const P = (v) => { const p = rot(m, v), s = D / (D - p[2]); return [cx + p[0] * k * s, cy - p[1] * k * s, p[2]]; };
    const pv = S.V.map(P);
    const vis = S.faces.map((f, i) => {
      const n = rot(m, f.n), c = rot(m, f.c);
      return { f, i, n, z: c[2], ok: dot(n, sub([0, 0, D], c)) > 0 };
    }).filter((x) => x.ok).sort((a, b) => a.z - b.z);
    g.save();
    g.globalAlpha = alpha == null ? 1 : alpha;
    const au = g.createRadialGradient(cx, cy, size * 0.4, cx, cy, size * 1.5);
    au.addColorStop(0, 'rgba(179,140,255,.45)'); au.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = au; g.beginPath(); g.arc(cx, cy, size * 1.5, 0, 7); g.fill();
    vis.forEach(({ f, i, n }) => {
      const key = owners[i], col = COLOR[key] || '#b38cff';
      const path = () => { g.beginPath(); f.v.forEach((j, t) => { const p = pv[j]; if (t) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); };
      path(); g.fillStyle = faceFill(col); g.fill();
      if (n[2] > 0.04) {                                          // the token, in the face's own plane
        const e = 0.05, c0 = P(f.c), px = P(add(f.c, mul(f.right, e))), py = P(add(f.c, mul(f.up, -e)));
        g.save();
        path(); g.clip();
        g.setTransform((px[0] - c0[0]) / e, (px[1] - c0[1]) / e, (py[0] - c0[0]) / e, (py[1] - c0[1]) / e, c0[0], c0[1]);
        const rr = f.r * 0.8;
        g.beginPath(); g.arc(0, 0, rr, 0, 7); g.closePath();
        g.save(); g.clip();
        const im = imgs[key];
        if (im && im.complete && im.naturalWidth) g.drawImage(im, -rr, -rr, 2 * rr, 2 * rr);
        else {
          g.fillStyle = col; g.fill();
          g.fillStyle = '#fff'; g.font = '700 ' + (rr * 1.1).toFixed(3) + 'px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(((C.BY_KEY[key] || {}).name || '?').charAt(0), 0, rr * 0.06);
        }
        g.restore();
        g.lineWidth = rr * 0.1; g.strokeStyle = col; g.stroke();
        g.restore();
      }
      const lam = dot(n, LIGHT);
      path();
      if (lam > 0.55) { g.fillStyle = 'rgba(255,255,255,' + ((lam - 0.55) * 0.45).toFixed(3) + ')'; g.fill(); }
      const shade = (1 - Math.max(0, lam)) * 0.62;
      if (shade > 0.02) { g.fillStyle = 'rgba(0,0,0,' + shade.toFixed(3) + ')'; g.fill(); }
      g.lineJoin = 'round'; g.lineWidth = Math.max(1, size * 0.04); g.strokeStyle = '#f1c66e'; g.stroke();
    });
    if (ring) {
      g.globalAlpha = 1; g.lineWidth = Math.max(2, size * 0.05); g.strokeStyle = ring; g.shadowColor = ring; g.shadowBlur = size * 0.3;
      g.beginPath(); g.arc(cx, cy, size * 1.18, 0, 7); g.stroke();
    }
    g.restore();
  }

  /* ======================= the scene ======================= */
  const CSS = `
.fo-layer{position:absolute;inset:0;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .55s,visibility 0s .55s;overflow:hidden;font-family:'Cinzel',Georgia,serif}
.fo-layer.on{opacity:1;visibility:visible;transition:opacity .55s,visibility 0s}
.fo-bg{position:absolute;inset:0;-webkit-backdrop-filter:blur(9px) brightness(.42) saturate(.75);backdrop-filter:blur(9px) brightness(.42) saturate(.75);background:rgba(6,4,10,.35)}
.fo-tint{position:absolute;inset:0;background:linear-gradient(100deg,rgba(160,12,40,.5) 0,rgba(110,8,30,.28) 44%,rgba(10,8,16,.15) 50%,rgba(0,90,115,.28) 56%,rgba(0,130,160,.48) 100%)}
.fo-layer.intro .fo-tint{animation:foWipe .7s cubic-bezier(.2,.9,.3,1) both}
@keyframes foWipe{from{clip-path:polygon(48% 0,52% 0,52% 100%,48% 100%);opacity:0}to{clip-path:polygon(0 0,100% 0,100% 100%,0 100%);opacity:1}}
.fo-split{position:absolute;left:50%;top:-8%;bottom:-8%;width:calc(var(--sh)*.006);margin-left:calc(var(--sh)*-.003);transform:skewX(-9deg);
  background:linear-gradient(180deg,rgba(255,255,255,0),#fff 20%,#f1c66e 50%,#fff 80%,rgba(255,255,255,0));box-shadow:0 0 calc(var(--sh)*.03) #fff,0 0 calc(var(--sh)*.07) rgba(241,198,110,.8)}
.fo-layer.intro .fo-split{animation:foSplit .5s ease-out both}
@keyframes foSplit{from{transform:skewX(-9deg) scaleY(0)}to{transform:skewX(-9deg) scaleY(1)}}
.fo-vs{position:absolute;left:50%;top:56%;transform:translate(-50%,-50%) skewX(-10deg);font:400 calc(var(--sh)*.13)/1 'Anton',Impact,sans-serif;color:#fff;letter-spacing:.02em;
  -webkit-text-stroke:calc(var(--sh)*.005) #10050c;paint-order:stroke fill;text-shadow:calc(var(--sh)*.01) calc(var(--sh)*.01) 0 #5b2a9c,0 0 calc(var(--sh)*.05) rgba(241,198,110,.6);
  transition:opacity .4s,transform .4s;z-index:3}
.fo-vs.off{opacity:0;transform:translate(-50%,-50%) skewX(-10deg) scale(.6)}
.fo-title{position:absolute;left:0;right:0;top:3%;text-align:center;z-index:12}
.fo-title b{display:block;font:400 calc(var(--sh)*.06)/1 'Anton',Impact,sans-serif;letter-spacing:.14em;color:#f7d684;text-shadow:0 calc(var(--sh)*.005) 0 #3b0d2a,0 0 calc(var(--sh)*.03) rgba(241,198,110,.45)}
.fo-title span{display:block;margin-top:calc(var(--sh)*.008);font:700 calc(var(--sh)*.024)/1 'Cinzel',Georgia,serif;letter-spacing:.3em;color:#e9e0ff}
.fo-step{position:absolute;left:0;right:0;top:16%;text-align:center;font:700 calc(var(--sh)*.03)/1.1 'Cinzel',Georgia,serif;letter-spacing:.18em;color:#fff;z-index:12;
  text-shadow:0 2px 0 #000,0 0 calc(var(--sh)*.02) rgba(0,0,0,.9);transition:opacity .3s}
.fo-step.flash{animation:foStep .45s ease-out}
@keyframes foStep{from{opacity:0;transform:translateY(calc(var(--sh)*-.02))}to{opacity:1;transform:none}}
/* the sockets flank the title: the stage's corners belong to the players' Credibility Points and powers */
.fo-score{position:absolute;top:3.2%;display:flex;flex-direction:column;gap:calc(var(--sh)*.01);z-index:12}
.fo-score.def{right:64%;align-items:flex-end}
.fo-score.pro{left:64%;align-items:flex-start}
.fo-score b{font:400 calc(var(--sh)*.027)/1 'Anton',Impact,sans-serif;letter-spacing:.12em;text-shadow:0 2px 0 #000}
.fo-score.def b{color:#ff8296}.fo-score.pro b{color:#7fe6f7}
.fo-sk{display:flex;gap:calc(var(--sh)*.012)}
.fo-sk i{width:calc(var(--sh)*.085);height:calc(var(--sh)*.085);border-radius:50%;border:calc(var(--sh)*.004) dashed rgba(255,255,255,.4);background:rgba(0,0,0,.35) center/cover no-repeat;
  box-shadow:inset 0 0 calc(var(--sh)*.02) rgba(0,0,0,.6)}
.fo-sk i.on{border:calc(var(--sh)*.004) solid #f1c66e;box-shadow:0 0 0 calc(var(--sh)*.004) rgba(0,0,0,.6),0 0 calc(var(--sh)*.03) rgba(241,198,110,.9);animation:foGem .55s cubic-bezier(.2,1.6,.4,1)}
@keyframes foGem{from{transform:scale(1.9)}to{transform:none}}
.fo-fig{position:absolute;bottom:3%;height:60%;transform:translateX(-50%);z-index:5;opacity:1;
  transition:left .8s cubic-bezier(.3,.85,.25,1),bottom .8s cubic-bezier(.3,.85,.25,1),height .8s cubic-bezier(.3,.85,.25,1),filter .6s,opacity .6s}
.fo-fig img{height:100%;width:auto;display:block;filter:drop-shadow(0 calc(var(--sh)*.015) calc(var(--sh)*.02) rgba(0,0,0,.6))}
.fo-fig.spot img{filter:drop-shadow(0 0 calc(var(--sh)*.022) var(--glow)) drop-shadow(0 calc(var(--sh)*.015) calc(var(--sh)*.02) rgba(0,0,0,.6))}
.fo-fig.dim{filter:brightness(.45) blur(1.5px)}
.fo-fig.spoke{filter:grayscale(.85) brightness(.5)}
.fo-fig.lose{filter:grayscale(.6) brightness(.38)}
.fo-fig.out{opacity:0}
.fo-nm{position:absolute;left:50%;bottom:calc(var(--sh)*-.012);transform:translateX(-50%) skewX(-10deg);white-space:nowrap;padding:calc(var(--sh)*.006) calc(var(--sh)*.016);
  background:rgba(8,6,14,.86);border-left:calc(var(--sh)*.007) solid var(--c);font:800 calc(var(--sh)*.026)/1 'Cinzel',Georgia,serif;letter-spacing:.06em;color:#fff}
.fo-nm small{display:block;font:400 calc(var(--sh)*.016)/1 'Anton',Impact,sans-serif;letter-spacing:.3em;color:var(--c);margin-bottom:calc(var(--sh)*.004)}
.fo-res{position:absolute;left:50%;top:38%;transform:translateX(-50%) rotate(-10deg);padding:calc(var(--sh)*.005) calc(var(--sh)*.012);border-radius:calc(var(--sh)*.008);
  font:400 calc(var(--sh)*.03)/1 'Anton',Impact,sans-serif;letter-spacing:.06em;white-space:nowrap}
.fo-res.break{background:#f1c66e;color:#2a1500}.fo-res.fail{background:#7a0614;color:#fff}
.fo-die{position:absolute;left:50%;top:14%;transform:translateX(-50%);z-index:10;transition:opacity .4s}
.fo-die.off{opacity:0}
.fo-call{position:absolute;left:0;right:0;top:44%;transform:translateY(-50%);text-align:center;z-index:11;pointer-events:none}
.fo-call .nm+.sb{display:table;margin-left:auto;margin-right:auto}
.fo-call .nm{display:inline-block;font:400 calc(var(--sh)*.13)/1 'Anton',Impact,sans-serif;color:#fff;letter-spacing:.03em;transform:skewX(-10deg);
  -webkit-text-stroke:calc(var(--sh)*.006) #10050c;paint-order:stroke fill;text-shadow:calc(var(--sh)*.01) calc(var(--sh)*.01) 0 var(--sh2,#00303d),0 0 calc(var(--sh)*.05) var(--gl,rgba(63,208,234,.7));
  animation:foSlam .45s cubic-bezier(.2,1.5,.4,1) both,foOut .4s ease-in var(--out,1.9s) forwards}
.fo-call .sb{display:inline-block;margin-top:calc(var(--sh)*.014);padding:calc(var(--sh)*.008) calc(var(--sh)*.022);border-radius:calc(var(--sh)*.01);background:rgba(6,4,10,.82);
  font:700 calc(var(--sh)*.03)/1 'Cinzel',Georgia,serif;letter-spacing:.3em;color:#fff;text-shadow:0 2px 0 #000;
  animation:foFade .4s ease-out .25s both,foOut .4s ease-in var(--out,1.9s) forwards}
.fo-call.big .nm{font-size:calc(var(--sh)*.1);line-height:1.05}
.fo-call.low{top:78%}
.fo-call .fl{position:absolute;left:-10%;right:-10%;top:50%;height:calc(var(--sh)*.2);transform:translateY(-50%) rotate(-6deg) scaleY(0);background:var(--band);z-index:-1;
  box-shadow:0 0 0 calc(var(--sh)*.006) #000;animation:foBand .3s cubic-bezier(.2,1.5,.4,1) forwards,foOut .4s ease-in var(--out,1.9s) forwards}
@keyframes foBand{to{transform:translateY(-50%) rotate(-6deg) scaleY(1)}}
@keyframes foSlam{from{transform:skewX(-10deg) scale(2.6);opacity:0;filter:blur(6px)}to{transform:skewX(-10deg) scale(1);opacity:1;filter:none}}
@keyframes foFade{from{opacity:0}to{opacity:1}}
@keyframes foOut{to{opacity:0}}
.fo-fly{position:absolute;left:0;top:0;width:calc(var(--sh)*.2);height:calc(var(--sh)*.2);border-radius:50%;z-index:13;background:center/cover no-repeat;
  box-shadow:0 0 0 calc(var(--sh)*.006) #f1c66e,0 0 calc(var(--sh)*.06) rgba(241,198,110,.95);
  transition:transform .85s cubic-bezier(.5,0,.3,1),width .85s cubic-bezier(.5,0,.3,1),height .85s cubic-bezier(.5,0,.3,1)}
.fo-flash{position:absolute;inset:0;z-index:9;opacity:0;animation:foFl .6s ease-out forwards;background:var(--c,#fff);mix-blend-mode:screen}
@keyframes foFl{0%{opacity:.75}100%{opacity:0}}
`;

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NAME = (k) => (C.BY_KEY[k] ? C.BY_KEY[k].name : '?');

  /* where everyone stands (fractions of the stage): the defense left, the five
     prosecutors right (three in front, two behind), and the two duel spots */
  const POS = {
    def: { x: 0.2, b: 0.03, h: 0.7, z: 6 },
    ally: { x: 0.07, b: 0.11, h: 0.58, z: 4 },
    pro: [{ x: 0.585, b: 0.03, h: 0.62, z: 6 }, { x: 0.75, b: 0.03, h: 0.62, z: 6 }, { x: 0.915, b: 0.03, h: 0.62, z: 6 },
      { x: 0.665, b: 0.12, h: 0.52, z: 4 }, { x: 0.835, b: 0.12, h: 0.52, z: 4 }],
    duelDef: { x: 0.32, b: 0.02, h: 0.8, z: 9 },
    duelPro: { x: 0.68, b: 0.02, h: 0.8, z: 9 },
  };
  const INTRO_WAIT = 2400;      // the ABOUT TO TIP banner plays first
  const END_SHOW = 5200;        // the winner's banner, then the courtroom is back
  const ROLL_MS = 2100;

  function create(stage) {
    if (!document.getElementById('fo-css')) { const s = el('style'); s.id = 'fo-css'; s.textContent = CSS; document.head.appendChild(s); }
    const A = stage.A;
    const L = el('div', 'fo-layer');
    L.innerHTML = '<div class="fo-bg"></div><div class="fo-tint"></div><div class="fo-split"></div><div class="fo-vs">VS</div>'
      + '<div class="fo-title"><b>FACE-OFF</b><span></span></div><div class="fo-step"></div>'
      + '<div class="fo-score def"><b>DEFENSE</b><div class="fo-sk"><i></i><i></i><i></i></div></div>'
      + '<div class="fo-score pro"><b>PROSECUTION</b><div class="fo-sk"><i></i><i></i><i></i></div></div>'
      + '<canvas class="fo-die off"></canvas><div class="fo-call"></div>';
    stage.root.insertBefore(L, stage.brainEl || stage.plate);
    const cv = L.querySelector('.fo-die'), call = L.querySelector('.fo-call'), step = L.querySelector('.fo-step');
    const polyToken = A + 'tokens/token_polychroma.webp';
    L.querySelectorAll('.fo-sk i').forEach((i) => { i.dataset.bg = 'url("' + polyToken + '")'; });
    const imgs = {};
    C.PCS.forEach((k) => { const im = new Image(); im.src = A + 'tokens/' + encodeURIComponent(C.BY_KEY[k].token); imgs[k] = im; });
    const SFX = root.TrialSFX, loud = () => stage.opts.sound && SFX && SFX.ok && SFX.ok();

    let F = null, seq = -1, shown = false, showT = 0, hideT = 0, ctx = null;
    let rseq = -1, die = null, proShown = null, hseq = -1, hold = null, flying = { def: 0, pro: 0 };
    const figs = {};
    const timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const clearLater = () => { timers.forEach(clearTimeout); timers.length = 0; };

    function show(intro) {
      shown = true;
      L.classList.toggle('intro', !!intro);
      L.classList.add('on');
      if (intro && loud()) { SFX.slam(); SFX.whoosh(700, 0.5); }
      layout(intro);
    }
    function hide() {
      shown = false;
      L.classList.remove('on', 'intro');
      clearTimeout(showT); clearTimeout(hideT); clearLater();
      die = null; hold = null; flying = { def: 0, pro: 0 };
      cv.classList.add('off'); call.innerHTML = '';
    }

    function fig(k) {
      let f = figs[k];
      if (!f) {
        f = figs[k] = { el: el('div', 'fo-fig'), src: null };
        f.el.innerHTML = '<img alt=""><div class="fo-nm"></div>';
        f.el.style.left = '50%';
        L.appendChild(f.el);
      }
      const src = stage.spriteFor(k, ctx && ctx.pl);
      if (f.src !== src) { f.src = src; f.el.querySelector('img').src = src; }
      return f;
    }
    function place(k, p, cls, side, label, from) {
      const f = fig(k), c = C.BY_KEY[k] || { h: 1.8 };
      const h = p.h * clamp(c.h / 1.8, 0.82, 1.1);
      const e = f.el;
      if (from != null) {                                          // the intro: they slide in from their side
        e.style.transition = 'none';
        e.style.left = ((p.x + from) * 100).toFixed(2) + '%'; e.style.bottom = (p.b * 100).toFixed(2) + '%'; e.style.height = (h * 100).toFixed(2) + '%';
        e.classList.add('out');
        void e.offsetWidth;
        e.style.transition = '';
      }
      e.style.left = (p.x * 100).toFixed(2) + '%';
      e.style.bottom = (p.b * 100).toFixed(2) + '%';
      e.style.height = (h * 100).toFixed(2) + '%';
      e.style.zIndex = p.z;
      e.className = 'fo-fig ' + (cls || '');
      e.style.setProperty('--c', side === 'def' ? '#e2465c' : '#3fd0ea');
      e.style.setProperty('--glow', side === 'def' ? 'rgba(255,80,110,.95)' : 'rgba(80,220,255,.95)');
      const nm = e.querySelector('.fo-nm');
      const html = (label ? '<small>' + esc(label) + '</small>' : '') + esc(NAME(k));
      if (nm._h !== html) { nm._h = html; nm.innerHTML = html; }
      let res = e.querySelector('.fo-res');
      const r = side === 'pro' && F && F.phase !== 'end' ? (F.log.find((x) => x.pro === k) || {}).r : null;
      if (r) { if (!res) { res = el('div', 'fo-res'); e.appendChild(res); } res.className = 'fo-res ' + r; res.textContent = r === 'break' ? 'BREAK' : 'FAIL'; }
      else if (res) res.remove();
    }

    /* everyone's spot for the current moment */
    function layout(intro) {
      if (!F || !shown) return;
      const ended = F.phase === 'end';
      const spk = hold ? hold.speaker : F.speaker;
      // the prosecutor at the centre: once the die has shown them (straight away after an undo)
      const pro = hold ? hold.pro : F.phase === 'duel' && F.pro && (!F.roll || proShown === F.roll.seq) ? F.pro : null;
      const used = Object.keys(figs).filter((k) => [F.def, F.ally].concat(F.pros).indexOf(k) < 0);
      used.forEach((k) => { figs[k].el.remove(); delete figs[k]; });
      [['def', F.def, 'DEFENSE'], ['ally', F.ally, 'ALLY']].forEach(([role, k, label]) => {
        if (!k) return;
        let cls = '';
        if (spk === k) cls = 'spot';
        else if (spk) cls = 'dim';
        if (ended && !hold) cls = F.result === 'def' ? 'spot' : 'lose';
        place(k, spk === k ? POS.duelDef : POS[role], cls, 'def', label, intro ? -0.35 : null);
      });
      F.pros.forEach((k, i) => {
        const spoke = F.left.indexOf(k) < 0 && k !== pro;
        let cls = spoke ? 'spoke' : '';
        if (k === pro) cls = 'spot';
        else if (pro || (die && !die.done)) cls += ' dim';
        if (ended && !hold) cls = F.result === 'pro' ? 'spot' : 'lose';
        place(k, k === pro ? POS.duelPro : POS.pro[i], cls, 'pro', null, intro ? 0.35 : null);
      });
      if (intro) requestAnimationFrame(() => Object.keys(figs).forEach((k) => figs[k].el.classList.remove('out')));
      // the sockets
      ['def', 'pro'].forEach((side) => {
        const n = (F.score[side] || 0) - (flying[side] || 0);
        L.querySelectorAll('.fo-score.' + side + ' i').forEach((i, j) => {
          const on = j < n;
          if (i.classList.contains('on') === on) return;
          i.classList.toggle('on', on);
          i.style.backgroundImage = on ? i.dataset.bg : '';
        });
      });
      L.querySelector('.fo-vs').classList.toggle('off', !!(pro || spk || die || ended));
      const round = Math.max(1, Math.min(F.pros.length, F.log.length + 1 - (hold ? 1 : 0)));
      L.querySelector('.fo-title span').textContent = ended ? 'THE VERDICT' : 'ROUND ' + round;
      let s;
      if (ended) s = '';
      else if (hold) s = '';
      else if (F.phase === 'defense') s = 'THE DEFENSE SPEAKS';
      else if (F.phase === 'roll') s = NAME(F.speaker).toUpperCase() + ' SPEAKS — WHO WILL ANSWER?';
      else if (F.phase === 'duel') s = pro ? NAME(F.speaker).toUpperCase() + '  VS  ' + NAME(F.pro).toUpperCase() : (F.roll && F.roll.auto ? 'THE LAST PROSECUTOR…' : 'THE DIE DECIDES…');
      else s = '';
      if (step._s !== s) { step._s = s; step.textContent = s; step.classList.remove('flash'); void step.offsetWidth; step.classList.add('flash'); }
    }

    function callout(html, cls, vars, out) {
      call.className = 'fo-call ' + (cls || '');
      call.style.cssText = (vars || '') + ';--out:' + (out || 1.9) + 's';
      call.innerHTML = html;
    }

    /* ---- the die ---- */
    function startRoll(R, animate) {
      if (R.auto) {                                               // the last one: no die
        die = null; cv.classList.add('off');
        later(() => { proShown = R.seq; callout('<div class="nm">' + esc(NAME(R.key).toUpperCase()) + '!</div><span class="sb">THE LAST PROSECUTOR</span>', 'low', '', 2.2); if (loud()) SFX.sting(); layout(); }, animate ? 300 : 0);
        if (!animate) proShown = R.seq;
        return;
      }
      const S = solid(R.sides);
      die = { R, S, t0: performance.now() - (animate ? 0 : 1e5), done: !animate,
        rest: restFor(S, R.face, (Math.random() - 0.5) * 0.3),
        a1: norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]), t1: (3 + Math.random() * 2.5) * Math.PI * 2 * (Math.random() < 0.5 ? -1 : 1),
        a2: norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]), t2: (1 + Math.random() * 1.5) * Math.PI * 2,
        from: Math.random() < 0.5 ? -1 : 1 };
      cv.classList.remove('off');
      if (animate) {
        if (loud()) SFX.whoosh(900, 0.35);
        later(() => {                                              // landed: the name, then they come to the centre
          die.done = true;
          if (loud()) { SFX.slam(); SFX.sting(); }
          callout('<div class="nm">' + esc(NAME(R.key).toUpperCase()) + '!</div><span class="sb">TAKES THE STAND</span>', 'low', '', 1.7);
          later(() => { proShown = R.seq; cv.classList.add('off'); layout(); }, 1300);
          later(() => { if (die && die.R === R) die = null; }, 1800);
          layout();
        }, ROLL_MS);
      } else { proShown = R.seq; cv.classList.add('off'); die = null; }
      layout();
    }
    function drawDie(now) {
      if (!die) return;
      const H = stage.H || 400, dpr = Math.min(2, root.devicePixelRatio || 1);
      const cw = Math.round(H * 0.5), ch = Math.round(H * 0.56);
      if (cv._w !== cw || cv._h !== ch) { cv._w = cw; cv._h = ch; cv.style.width = cw + 'px'; cv.style.height = ch + 'px'; cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
      const g = cv.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      const tt = clamp((now - die.t0) / ROLL_MS, 0, 1), e = easeOut(tt);
      const spin = qmul(qaxis(die.a1, die.t1 * (1 - e)), qaxis(die.a2, die.t2 * (1 - e)));
      const q = qmul(die.rest, spin);
      const size = cv.height * 0.24, floor = cv.height * 0.55;
      const hop = Math.abs(Math.cos(tt * Math.PI * 3.2)) * Math.pow(1 - tt, 2.2) * cv.height * 0.42;
      const x = cv.width / 2 + die.from * cv.width * 0.4 * (1 - e), y = floor - hop;
      g.save(); g.globalAlpha = 0.5 * (1 - hop / (cv.height * 0.5));
      g.fillStyle = 'rgba(0,0,0,.85)'; g.beginPath(); g.ellipse(x, floor + size * 1.05, size * 0.95, size * 0.22, 0, 0, 7); g.fill(); g.restore();
      drawSolid(g, die.S, die.R.owners, q, x, y, size, imgs, 1, die.done ? (COLOR[die.R.key] || '#fff') : null);
    }

    /* ---- BREAK / FAIL: a Polychroma token flies to its side ---- */
    function startHit(h, animate) {
      if (!animate) { hold = null; return; }
      const brk = h.r === 'break';
      hold = { speaker: h.speaker, pro: h.pro };
      flying[h.side] = (flying[h.side] || 0) + 1;
      callout('<div class="fl"></div><div class="nm">' + (brk ? 'BREAK!' : 'FAIL') + '</div>', brk ? 'big' : 'big',
        brk ? '--band:linear-gradient(90deg,#4a000f,#b3122e 45%,#4a000f);--sh2:#3a0010;--gl:rgba(255,211,107,.8)'
          : '--band:linear-gradient(90deg,#140c18,#3b2a44 45%,#140c18);--sh2:#000;--gl:rgba(160,120,200,.5)', 1.3);
      const fl = el('div', 'fo-flash'); fl.style.setProperty('--c', brk ? '#ffd36b' : '#7a0614'); L.appendChild(fl); later(() => fl.remove(), 700);
      if (loud()) { SFX.slam(); if (brk) SFX.shatter(0.05); }
      layout();
      later(() => {
        const sock = L.querySelectorAll('.fo-score.' + h.side + ' i')[Math.max(0, Math.min(2, (F ? F.score[h.side] : 1) - 1))];
        const fly = el('div', 'fo-fly'); fly.style.backgroundImage = 'url("' + polyToken + '")';
        const Lr = L.getBoundingClientRect(), sz = (stage.H || 400) * 0.2;
        fly.style.transform = 'translate(' + (Lr.width / 2 - sz / 2).toFixed(1) + 'px,' + (Lr.height * 0.42 - sz / 2).toFixed(1) + 'px)';
        L.appendChild(fly);
        void fly.offsetWidth;
        if (sock) {
          const r = sock.getBoundingClientRect();
          fly.style.width = r.width + 'px'; fly.style.height = r.height + 'px';
          fly.style.transform = 'translate(' + (r.left - Lr.left).toFixed(1) + 'px,' + (r.top - Lr.top).toFixed(1) + 'px)';
        }
        later(() => {
          fly.remove();
          flying[h.side] = Math.max(0, (flying[h.side] || 0) - 1);
          if (loud()) chime();
          layout();
        }, 880);
      }, 650);
      later(() => { hold = null; layout(); }, 1900);
    }
    function chime() {
      const c = SFX.ctx, t = c.currentTime;
      [1047, 1319, 1568].forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.06); g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.06 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.6);
        o.connect(g); g.connect(SFX.out); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.7);
      });
    }
    function showEnd(animate) {
      const pro = F.result === 'pro';
      const sc = pro ? F.score.pro + ' – ' + F.score.def : F.score.def + ' – ' + F.score.pro;
      const go = () => {
        callout('<div class="fl"></div><div class="nm">' + (pro ? 'THE PROSECUTION' : 'THE DEFENSE') + '<br>WINS THE FACE-OFF</div><span class="sb">' + sc + '</span>', 'big',
          pro ? '--band:linear-gradient(90deg,#00222c,#0a9cbc 45%,#00222c);--sh2:#00303d;--gl:rgba(63,208,234,.8)'
            : '--band:linear-gradient(90deg,#3a0010,#c21f3c 45%,#3a0010);--sh2:#4a0012;--gl:rgba(255,80,110,.8)', 3.9);
        if (loud()) { SFX.sting(); SFX.slam(); }
        layout();
      };
      if (animate) later(go, 1500); else go();
    }

    return {
      update(f, c) {
        ctx = c || ctx;
        if (!f || !f.on) {
          F = f && f.on ? f : null;
          if (shown || showT) { clearTimeout(showT); showT = 0; hide(); }
          seq = f ? f.seq : seq;
          return;
        }
        const age = (at) => (ctx && ctx.age ? ctx.age(at) : 0);
        const first = !!(ctx && ctx.first);
        F = f;
        if (f.seq !== seq) {                                      // a new face-off
          seq = f.seq;
          hide();
          rseq = f.roll ? f.roll.seq : -1; hseq = f.hit ? f.hit.seq : -1; proShown = f.roll ? f.roll.seq : null;
          const wait = first ? 0 : INTRO_WAIT - age(f.at);
          if (f.phase === 'end' && age(f.endAt) > END_SHOW) return;  // long over
          if (wait > 40) showT = setTimeout(() => { showT = 0; show(true); }, wait);
          else show(!first && wait > -1500);
        }
        if (!shown && !showT && f.phase !== 'end') show(false);   // e.g. the GM took back the winning point
        if (f.roll && f.roll.seq !== rseq) { rseq = f.roll.seq; startRoll(f.roll, age(f.roll.at) < 2500); }
        if (!f.roll) { die = null; cv.classList.add('off'); }
        if (f.hit && f.hit.seq !== hseq) { hseq = f.hit.seq; startHit(f.hit, age(f.hit.at) < 3000); }
        if (f.phase === 'end') {
          const left = END_SHOW + (f.hit && age(f.hit.at) < 3000 ? 1500 : 0) - age(f.endAt);
          if (!L._end || L._end !== f.endAt) { L._end = f.endAt; showEnd(age(f.endAt) < 3000); }
          clearTimeout(hideT);
          hideT = setTimeout(() => { hide(); }, Math.max(0, left));
        } else { L._end = 0; clearTimeout(hideT); }
        layout();
      },
      frame(now) { if (shown && die) drawDie(now); },
      visible() { return shown; },
      el: L,
    };
  }

  root.TrialFaceoff = { create, solid, restFor, drawSolid, COLOR };
})(window);
