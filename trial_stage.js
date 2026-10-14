/*
 * trial_stage.js — the Class Trial stage (what the players watch).
 * Used full-screen by trial.html and as the live preview in trial_gm.html.
 *
 * The courtroom is a stage seen from the front: defense on the left, the jury in
 * the centre, the prosecution on the right (TrialCore.LINE), and the bench —
 * Polychroma and her two specialists — raised above the jury's centre. The
 * camera pans left/right and tilts up/down at the same time, so jury → bench is
 * straight up and prosecution → bench is diagonally up-left. Clicking someone
 * pans past everyone in between, then slows down and settles. When one of the
 * five prosecution seats speaks, the other four step in behind them, blurred.
 *
 * Everything is drawn with plain DOM + CSS transforms, recomputed every frame.
 */
(function (root) {
  'use strict';
  const CORE = root.TrialCore;
  const DEG = Math.PI / 180;

  const CFG = {
    R: 3.4,           // distance from the camera to the line (world units; a human is ~1.75 tall)
    eye: 1.45,        // camera eye height
    hfov: 46,         // horizontal field of view at rest (degrees)
    horizon: 0.30,    // where the eye line sits on screen (fraction of height)
    podiumH: 0.70, podiumW: 1.06,
    PPU: 400,         // local px per world unit inside a stand
    maxSpacing: 24,   // max degrees between two neighbours (few people on stage)
    lineSpan: 250,    // the whole line, defense to prosecution, fits in this many degrees
    bankGap: 0.6,     // extra spacing between defense / jury / prosecution
    pushIn: 0.06,     // dolly-in once the camera has settled
    layoutMs: 1300,   // time for someone to walk to a new seat
    benchRise: 2.5,   // the bench stands on a ledge this high above the floor: just out of frame when looking at the jury
    benchDepth: 1.3,  // ...and further back than the line
    benchSpread: 1.15,// spacing of the three bench seats, in line steps
    benchZoom: 1.08,  // zoom when looking up at the bench
    bgUpShift: 0.77,  // how far (× screen height) the hall slides down as the camera looks up: the thrones come in behind the bench
  };
  const SIDE_COLOR = { defense: '#e2465c', prosecution: '#3fd0ea', jury: '#e7b54d', bench: '#b38cff' };
  const SIDE_LABEL = { L1: 'Defense', L2: 'Support' };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap180 = (d) => { d = ((d + 180) % 360 + 360) % 360 - 180; return d; };
  const mod = (a, n) => ((a % n) + n) % n;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /* CSS cubic-bezier(x1,y1,x2,y2) as a function of t */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x;
        if (Math.abs(e) < 1e-5) break;
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      t = clamp(t, 0, 1);
      return sy(t);
    };
  }
  const PAN_EASE = bezier(0.38, 0, 0.1, 1);   // quick whip, long settle

  /* ------------------------------------------------------------------ CSS */
  const CSS = `
.ts-root{position:absolute;overflow:hidden;background:#07060a;color:#fff;--sh:1080px;--sw:1920px;
  font-family:'Cinzel',Georgia,serif;user-select:none;-webkit-user-select:none;contain:strict}
.ts-shaker,.ts-cam{position:absolute;inset:0}
.ts-shake{animation:tsShake .5s linear}
@keyframes tsShake{0%{transform:translate(0,0)}10%{transform:translate(-1.4%,.9%)}20%{transform:translate(1.2%,-1.1%)}
 30%{transform:translate(-.9%,-.6%)}40%{transform:translate(.8%,.9%)}55%{transform:translate(-.5%,.3%)}70%{transform:translate(.3%,-.3%)}100%{transform:none}}
.ts-bg{position:absolute;inset:0;overflow:hidden}
.ts-strip{position:absolute;left:0;top:0;background-repeat:repeat-x;will-change:transform}
.ts-world{position:absolute;inset:0}
.ts-stand{position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;will-change:transform}
.ts-body{position:absolute;left:0;bottom:0;width:0;height:0;transform-origin:0 -300px}
.ts-sprite{position:absolute;bottom:0;transform:translateX(-50%);max-width:none;pointer-events:none;
  filter:drop-shadow(0 12px 18px rgba(0,0,0,.55))}
.ts-podium{position:absolute;bottom:0;clip-path:polygon(5% 0,95% 0,100% 100%,0 100%);
  background:linear-gradient(180deg,var(--side) 0 2.4%,#1c1420 2.4% 4.2%,#3a2a20 4.2%,#24180f 55%,#120b07 100%);
  box-shadow:inset 0 0 0 4px rgba(0,0,0,.35)}
.ts-podium::before{content:'';position:absolute;left:9%;right:9%;top:14%;bottom:12%;
  border:3px solid rgba(214,170,96,.38);border-radius:6px;
  background:radial-gradient(ellipse at 50% 0%,rgba(255,220,150,.14),transparent 70%)}
.ts-plateName{position:absolute;left:50%;top:22%;transform:translateX(-50%);white-space:nowrap;
  font:700 30px/1 'Cinzel',Georgia,serif;letter-spacing:2px;color:#f3d9a0;
  text-shadow:0 2px 0 #000,0 0 12px rgba(0,0,0,.8);padding:8px 18px;border-radius:4px;
  background:linear-gradient(180deg,rgba(60,40,22,.9),rgba(25,16,9,.9));border:2px solid rgba(214,170,96,.6)}
.ts-speed{position:absolute;inset:-60%;opacity:0;mix-blend-mode:screen;pointer-events:none;background-repeat:repeat}
.ts-vignette{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse at 50% 42%,transparent 52%,rgba(0,0,0,.62) 100%),
             linear-gradient(180deg,rgba(0,0,0,.35),transparent 18%,transparent 78%,rgba(0,0,0,.5))}
/* name banner, bottom-left */
.ts-plate{position:absolute;left:calc(var(--sw)*.035);bottom:calc(var(--sh)*.06);transform:translateX(-120%) skewX(-12deg);
  transition:transform .35s cubic-bezier(.2,1.3,.4,1),opacity .25s;opacity:0;pointer-events:none;
  padding:calc(var(--sh)*.012) calc(var(--sw)*.022) calc(var(--sh)*.014);
  background:linear-gradient(100deg,rgba(10,8,14,.92) 60%,rgba(10,8,14,.55));
  border-left:calc(var(--sh)*.012) solid var(--side,#e7b54d);box-shadow:0 8px 30px rgba(0,0,0,.6)}
.ts-plate.on{transform:skewX(-12deg);opacity:1}
.ts-plate .side{font:700 calc(var(--sh)*.022)/1 'Anton',Impact,sans-serif;letter-spacing:.32em;color:var(--side,#e7b54d);
  text-transform:uppercase;transform:skewX(12deg)}
.ts-plate .name{font:800 calc(var(--sh)*.058)/1.05 'Cinzel',Georgia,serif;letter-spacing:.04em;color:#fff;
  text-shadow:0 3px 0 rgba(0,0,0,.6);transform:skewX(12deg);margin-top:calc(var(--sh)*.006)}
/* waiting screen */
.ts-idle{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at 50% 45%,rgba(20,12,30,.72),rgba(4,3,8,.97));opacity:0;pointer-events:none;
  transition:opacity .8s}
.ts-idle.on{opacity:1}
.ts-idle .t1{font:400 calc(var(--sh)*.16)/1 'Anton',Impact,sans-serif;letter-spacing:.06em;color:#f1c66e;
  transform:skewX(-8deg);text-shadow:0 0 calc(var(--sh)*.04) rgba(241,198,110,.35),calc(var(--sh)*.008) calc(var(--sh)*.008) 0 #3b0d2a}
.ts-idle .t2{margin-top:calc(var(--sh)*.03);font:600 calc(var(--sh)*.034)/1.2 'Cinzel',Georgia,serif;color:#cbb8e6;letter-spacing:.12em}
.ts-badge{position:absolute;top:10px;left:10px;font:700 12px/1 system-ui,sans-serif;letter-spacing:.08em;
  padding:6px 10px;border-radius:20px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.25);color:#ffd27a;display:none}
.ts-badge.on{display:block}
/* ---------- banners ---------- */
.ts-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.ts-fxi{position:absolute;inset:0}
.ts-flash{position:absolute;inset:0;background:#fff;opacity:0;animation:tsFlash .5s ease-out forwards}
@keyframes tsFlash{0%{opacity:.9}100%{opacity:0}}
.ts-flash.soft{background:#ffb347;animation-name:tsFlashSoft;animation-duration:.4s}
@keyframes tsFlashSoft{0%{opacity:.35}100%{opacity:0}}
.ts-band{position:absolute;left:-20%;width:140%;top:calc(var(--y,50%) - var(--bh,15%));height:calc(var(--bh,15%) * 2);
  transform:rotate(var(--rot,-6deg)) scaleY(0);background:var(--band);
  box-shadow:0 0 0 calc(var(--sh)*.007) var(--edge,#000),0 calc(var(--sh)*.03) calc(var(--sh)*.08) rgba(0,0,0,.7);
  animation:tsBandIn .26s cubic-bezier(.2,1.5,.4,1) var(--d0,0s) forwards,tsBandOut .4s cubic-bezier(.6,0,.9,.4) var(--d1,2.2s) forwards}
@keyframes tsBandIn{from{transform:rotate(var(--rot,-6deg)) scaleY(0)}to{transform:rotate(var(--rot,-6deg)) scaleY(1)}}
@keyframes tsBandOut{from{transform:rotate(var(--rot,-6deg)) scaleY(1)}to{transform:rotate(var(--rot,-6deg)) translateX(55%) scaleY(.5);opacity:0}}
.ts-ww{position:absolute;left:0;right:0;top:var(--y,50%);height:0;transform:rotate(var(--rot,-6deg))}
.ts-word{position:absolute;left:0;right:0;top:0;transform:translateY(-50%) skewX(-11deg);text-align:center;white-space:nowrap;
  font:400 var(--fs,calc(var(--sh)*.17))/1 'Anton',Impact,'Arial Black',sans-serif;letter-spacing:.02em;color:var(--ink,#fff);
  -webkit-text-stroke:calc(var(--sh)*.007) #10050c;paint-order:stroke fill;
  text-shadow:calc(var(--sh)*.012) calc(var(--sh)*.012) 0 var(--shadow,#5b0c2c),0 0 calc(var(--sh)*.05) var(--glow,rgba(255,255,255,.35));
  animation:tsWordOut .35s ease-in var(--d1,2.25s) forwards}
@keyframes tsWordOut{to{opacity:0;transform:translateY(-50%) skewX(-11deg) translateX(-35%)}}
.ts-word>span{display:inline-block;opacity:0;animation:tsLetter .34s cubic-bezier(.2,1.6,.35,1) forwards;
  animation-delay:calc(var(--i) * 42ms + var(--d0,0s) + 110ms)}
@keyframes tsLetter{from{opacity:0;transform:scale(3.2) rotate(var(--r))}to{opacity:1;transform:none}}
.ts-word.slide>span{animation-name:tsSlideL}
.ts-word.slideR>span{animation-name:tsSlideR}
@keyframes tsSlideL{from{opacity:0;transform:translateX(calc(var(--sw)*-.6)) skewX(-25deg)}to{opacity:1;transform:none}}
@keyframes tsSlideR{from{opacity:0;transform:translateX(calc(var(--sw)*.6)) skewX(-25deg)}to{opacity:1;transform:none}}
.ts-sub{position:absolute;left:0;right:0;top:calc(var(--sh)*.11);transform:skewX(-11deg);text-align:center;
  font:700 calc(var(--sh)*.032)/1 'Cinzel',Georgia,serif;letter-spacing:.5em;color:#fff3cf;opacity:0;
  text-shadow:0 2px 0 #000;animation:tsFade .4s ease-out .6s forwards,tsWordOut .3s ease-in var(--d1,2.25s) forwards}
@keyframes tsFade{to{opacity:1}}
.ts-streaks{position:absolute;inset:0;opacity:0;animation:tsStreaks 2.5s linear forwards;background-repeat:repeat-y}
@keyframes tsStreaks{0%{opacity:0}10%{opacity:.9}80%{opacity:.6}100%{opacity:0;background-position-x:calc(var(--sw)*-3)}}
/* BREAK! */
.ts-half{animation:tsSlam .3s cubic-bezier(.2,1.4,.4,1) .08s both,tsSplit 1.5s cubic-bezier(.2,.8,.3,1) .95s forwards}
.ts-half.top{clip-path:polygon(0 0,100% 0,100% 38%,0 64%)}
.ts-half.bot{clip-path:polygon(0 64%,100% 38%,100% 100%,0 100%);--sx:1;--sy:1}
.ts-half.top{--sx:-1;--sy:-1}
@keyframes tsSlam{from{transform:translateY(-50%) skewX(-11deg) scale(3.4);opacity:0;filter:blur(8px)}
  to{transform:translateY(-50%) skewX(-11deg) scale(1);opacity:1;filter:none}}
@keyframes tsSplit{0%{transform:translateY(-50%) skewX(-11deg)}
  55%{transform:translateY(-50%) skewX(-11deg) translate(calc(var(--sx)*3%),calc(var(--sy)*var(--sh)*.07)) rotate(calc(var(--sx)*3deg));opacity:1}
  100%{transform:translateY(-50%) skewX(-11deg) translate(calc(var(--sx)*5%),calc(var(--sy)*var(--sh)*.14)) rotate(calc(var(--sx)*5deg));opacity:0}}
.ts-crack{position:absolute;left:5%;right:5%;top:50%;height:calc(var(--sh)*.008);background:#fff;
  transform:rotate(-14deg) scaleX(0);box-shadow:0 0 calc(var(--sh)*.03) #fff,0 0 calc(var(--sh)*.08) #ff4d6d;
  animation:tsCrack .5s ease-out .88s forwards}
@keyframes tsCrack{0%{transform:rotate(-14deg) scaleX(0);opacity:1}35%{transform:rotate(-14deg) scaleX(1);opacity:1}100%{transform:rotate(-14deg) scaleX(1.1);opacity:0}}
.ts-shard{position:absolute;left:50%;top:50%;width:calc(var(--sh)*var(--sz));height:calc(var(--sh)*var(--sz));
  background:var(--c);clip-path:polygon(50% 0,100% 80%,10% 100%);opacity:0;
  animation:tsShard 1.1s cubic-bezier(.1,.7,.3,1) .92s forwards}
@keyframes tsShard{0%{opacity:1;transform:translate(-50%,-50%) rotate(0)}
  100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--rt))}}
/* ABOUT TO TIP */
.ts-tip .ts-ww{animation:tsTip 2.1s cubic-bezier(.4,0,.3,1) .35s both}
@keyframes tsTip{0%{transform:rotate(-6deg)}14%{transform:rotate(-15deg)}32%{transform:rotate(4deg)}50%{transform:rotate(-11deg)}
  68%{transform:rotate(-2deg)}84%{transform:rotate(-8deg)}100%{transform:rotate(-6deg)}}
.ts-beam{position:absolute;left:22%;right:22%;top:calc(var(--sh)*.115);height:calc(var(--sh)*.014);background:#fff2c4;
  border-radius:4px;box-shadow:0 0 0 3px #2b1600}
.ts-beam::after{content:'';position:absolute;left:50%;top:100%;transform:translateX(-50%);
  border-left:calc(var(--sh)*.03) solid transparent;border-right:calc(var(--sh)*.03) solid transparent;
  border-top:calc(var(--sh)*.045) solid #fff2c4}
/* the bench's dais: black and white marble, split down the middle like the tribunal */
.ts-podium.dais{clip-path:polygon(0 0,100% 0,95% 100%,5% 100%);
  background:
    linear-gradient(180deg,var(--side) 0 8%,#f3d9a0 8% 11%,transparent 11%),
    linear-gradient(180deg,rgba(255,255,255,.14),rgba(0,0,0,.5)),
    linear-gradient(90deg,#141019 0 50%,#a9a2b6 50% 100%);
  box-shadow:inset 0 0 0 4px rgba(0,0,0,.3)}
.ts-podium.dais::before{display:none}
.ts-podium.dais .ts-plateName{top:26%;font-size:26px;padding:5px 14px}
/* an emote just changed */
.ts-pop{animation:tsPop .38s cubic-bezier(.2,1.6,.4,1)}
@keyframes tsPop{0%{transform:scale(.86)}100%{transform:none}}
/* REACTION! */
.ts-react-burst{position:absolute;left:-50%;top:-50%;width:200%;height:200%;opacity:0;mix-blend-mode:screen;
  background:repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,200,40,0) 0 7deg,rgba(255,170,30,.38) 7deg 11deg);
  animation:tsBurst 2s ease-out forwards}
.ts-react-name{position:absolute;left:0;right:0;top:calc(var(--sh)*.6);text-align:center;transform:skewX(-11deg);
  font:800 calc(var(--sh)*.045)/1 'Cinzel',Georgia,serif;letter-spacing:.2em;color:#fff;text-shadow:0 3px 0 #000;
  opacity:0;animation:tsFade .3s ease-out .35s forwards,tsWordOut .3s ease-in 1.65s forwards}
/* REVEAL: cinematic bars, slow golden serif */
.ts-letterbox{position:absolute;inset:0;background:rgba(5,3,10,.5);opacity:0;animation:tsFade .6s ease-out forwards,tsOut .7s ease-in var(--d1,3.3s) forwards}
.ts-letterbox::before,.ts-letterbox::after{content:'';position:absolute;left:0;right:0;height:13%;background:#000;animation:tsBarIn .55s cubic-bezier(.2,.9,.3,1) both}
.ts-letterbox::before{top:0;transform-origin:top}
.ts-letterbox::after{bottom:0;transform-origin:bottom}
@keyframes tsBarIn{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes tsOut{to{opacity:0}}
.ts-reveal{position:absolute;left:4%;right:4%;top:50%;transform:translateY(-50%);text-align:center;
  font:800 var(--fs)/1.18 'Cinzel',Georgia,serif;letter-spacing:.08em;color:#f6dc9a;
  text-shadow:0 0 calc(var(--sh)*.035) rgba(246,220,154,.45),0 calc(var(--sh)*.004) 0 #000;animation:tsOut .7s ease-in var(--d1,3.3s) forwards}
.ts-reveal span{display:inline-block;opacity:0;filter:blur(10px);animation:tsRevealL .8s ease-out forwards;animation-delay:calc(var(--i)*55ms + .4s)}
@keyframes tsRevealL{to{opacity:1;filter:blur(0)}}
/* SHOCK: red flash, sunburst, chromatic split */
.ts-shockflash{position:absolute;inset:0;background:#ff1636;mix-blend-mode:screen;opacity:0;animation:tsShockF .55s ease-out forwards}
@keyframes tsShockF{0%{opacity:.9}30%{opacity:.2}45%{opacity:.65}100%{opacity:0}}
.ts-burst{position:absolute;left:-50%;top:-50%;width:200%;height:200%;mix-blend-mode:screen;opacity:0;
  background:repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,0) 0 6deg,rgba(255,40,70,.3) 6deg 9deg);
  animation:tsBurst 2.5s ease-out forwards}
@keyframes tsBurst{0%{opacity:0;transform:scale(.6) rotate(0)}10%{opacity:1}75%{opacity:.7}100%{opacity:0;transform:scale(1.15) rotate(18deg)}}
.ts-word.ts-shockw{text-shadow:calc(var(--sh)*-.009) 0 0 rgba(0,255,255,.85),calc(var(--sh)*.009) 0 0 rgba(255,0,60,.9),0 0 calc(var(--sh)*.06) rgba(255,0,60,.6)}
.ts-word.ts-shockw>span{animation-name:tsShockL;animation-duration:.24s;animation-delay:calc(var(--i)*18ms + 60ms)}
@keyframes tsShockL{from{opacity:0;transform:scale(2.6)}60%{opacity:1;transform:scale(.9)}to{opacity:1;transform:none}}
/* WHISPER: quiet line low on screen, no flash */
.ts-whisper{position:absolute;left:0;right:0;bottom:calc(var(--sh)*.19);padding:calc(var(--sh)*.022) 7%;text-align:center;
  background:linear-gradient(90deg,transparent,rgba(8,6,14,.8) 18%,rgba(8,6,14,.8) 82%,transparent);
  font:italic 600 var(--fs)/1.3 'Cinzel',Georgia,serif;color:#ddd1f3;letter-spacing:.05em;
  opacity:0;animation:tsFade .5s ease-out forwards,tsOut .9s ease-in var(--d1,3.8s) forwards}
.ts-whisper span{display:inline-block;opacity:0;animation:tsFade .25s ease-out forwards;animation-delay:calc(var(--i)*36ms + .2s)}
/* COUNTER cut-in */
.ts-cutin{position:absolute;inset:0;background:#000;overflow:hidden;
  animation:tsCutIn .3s cubic-bezier(.2,1,.3,1) both,tsCutOut .35s ease-in 2.6s forwards}
.ts-cutin img{width:100%;height:100%;object-fit:cover;display:block}
@keyframes tsCutIn{from{transform:translateX(105%) skewX(-16deg)}to{transform:none}}
@keyframes tsCutOut{to{transform:translateX(-105%) skewX(-16deg)}}
`;
  function injectCss() {
    if (document.getElementById('ts-css')) return;
    const s = document.createElement('style');
    s.id = 'ts-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------------- sound
     Synthesised, no files. Browsers only allow audio after a click on the page,
     so the player page calls SFX.unlock() from its "enter" button. */
  const SFX = {
    ctx: null, out: null, enabled: false, _noise: null,
    unlock() {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) {
        this.ctx = new AC();
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.55;
        this.out.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.enabled = true;
    },
    noise() {
      if (this._noise) return this._noise;
      const n = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return (this._noise = b);
    },
    ok() { return this.enabled && this.ctx && this.ctx.state === 'running'; },
    whoosh(ms, strength) {
      if (!this.ok()) return;
      const c = this.ctx, t = c.currentTime, dur = Math.max(0.25, ms / 1000);
      const src = c.createBufferSource(); src.buffer = this.noise(); src.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(350, t);
      bp.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.3);
      bp.frequency.exponentialRampToValueAtTime(420, t + dur);
      const g = c.createGain(); const peak = 0.22 + 0.25 * clamp(strength, 0, 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp); bp.connect(g); g.connect(this.out);
      src.start(t); src.stop(t + dur + 0.05);
    },
    slam() {
      if (!this.ok()) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.32);
      const g = c.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.5);
      const n = c.createBufferSource(); n.buffer = this.noise();
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      const ng = c.createGain(); ng.gain.setValueAtTime(0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      n.connect(lp); lp.connect(ng); ng.connect(this.out); n.start(t); n.stop(t + 0.2);
    },
    shatter(delay) {
      if (!this.ok()) return;
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const n = c.createBufferSource(); n.buffer = this.noise();
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      n.connect(hp); hp.connect(g); g.connect(this.out); n.start(t); n.stop(t + 0.6);
      for (let i = 0; i < 7; i++) {
        const o = c.createOscillator(); o.type = 'triangle';
        const f = 2200 + Math.random() * 3800, at = t + Math.random() * 0.25;
        o.frequency.setValueAtTime(f, at);
        const og = c.createGain(); og.gain.setValueAtTime(0.0001, at);
        og.gain.exponentialRampToValueAtTime(0.12, at + 0.005); og.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        o.connect(og); og.connect(this.out); o.start(at); o.stop(at + 0.25);
      }
    },
    sting() {
      if (!this.ok()) return;
      const c = this.ctx, t = c.currentTime;
      [523.25, 659.25, 783.99].forEach((f, i) => {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
        const g = c.createGain(); const at = t + i * 0.03;
        g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.09, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
        o.connect(lp); lp.connect(g); g.connect(this.out); o.start(at); o.stop(at + 1);
      });
    },
  };

  /* ---------------------------------------------------------------- Stage */
  function Stage(host, opts) {
    injectCss();
    this.opts = Object.assign({ gm: false, sound: false, assets: '/' }, opts || {});
    this.A = this.opts.assets;
    this.host = host;
    this.root = el('div', 'ts-root');
    this.shaker = el('div', 'ts-shaker');
    this.camEl = el('div', 'ts-cam');
    this.bg = el('div', 'ts-bg');
    this.strip = el('div', 'ts-strip');
    this.world = el('div', 'ts-world');
    this.speed = el('div', 'ts-speed');
    this.vignette = el('div', 'ts-vignette');
    this.plate = el('div', 'ts-plate');
    this.plate.innerHTML = '<div class="side"></div><div class="name"></div>';
    this.fx = el('div', 'ts-fx');
    this.idle = el('div', 'ts-idle');
    this.idle.innerHTML = '<div class="t1">CLASS TRIAL</div><div class="t2">The court is not in session</div>';
    this.badge = el('div', 'ts-badge');
    this.badge.textContent = 'COURT CLOSED — players see the waiting screen';
    this.bg.appendChild(this.strip);
    this.camEl.append(this.bg, this.world, this.speed);
    this.shaker.append(this.camEl, this.vignette);
    this.root.append(this.shaker, this.plate, this.fx, this.idle, this.badge);
    host.appendChild(this.root);

    this.actors = {};          // key -> actor
    this.slots = {};
    this.route = 'jury';
    this.first = true;
    this.open = false;
    this.seq = { focus: -1, fx: -1, sweep: -1 };
    this.layoutT0 = -1e9;
    this.cam = { th: 0, pitch: 0, pan: null, key: null, settleT0: -1e9, punchT0: -1e9, tilt: 0, tiltTo: 0, prevTh: 0, prevShift: 0 };
    this.g = 0;                // group-shot blend
    this.speedX = 0;
    this.W = 0; this.H = 0;
    this.bgImg = new Image();
    this.bgImg.onload = () => this.buildBackground(true);
    this.bgImg.onerror = () => { if (!this._bgFallback) { this._bgFallback = true; this.bgImg.src = this.A + 'hall_bg.jpg'; } };
    this.bgImg.src = this.A + 'trial_bg.jpg';
    this.bench = { phi: 0, step: 16, half: 64, has: false };
    this.benchFrom = 0; this.benchNow = 0;
    this.buildSpeedLines();
    this.resize();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(host);
    this._last = performance.now();
    (root.__trialStages = root.__trialStages || []).push(this);   // handy for debugging from the console
    const loop = (t) => { try { this.frame(t); } catch (e) { console.error(e); } this._raf = requestAnimationFrame(loop); };
    this._raf = requestAnimationFrame(loop);
  }

  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  Stage.prototype.resize = function () {
    const hw = this.host.clientWidth, hh = this.host.clientHeight;
    if (!hw || !hh) return;
    let W = hw, H = Math.round(hw * 9 / 16);
    if (H > hh) { H = hh; W = Math.round(hh * 16 / 9); }
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    Object.assign(this.root.style, { width: W + 'px', height: H + 'px', left: ((hw - W) / 2) + 'px', top: ((hh - H) / 2) + 'px' });
    this.root.style.setProperty('--sw', W + 'px');
    this.root.style.setProperty('--sh', H + 'px');
    this.F0 = (W / 2) / Math.tan(CFG.hfov / 2 * DEG);
    clearTimeout(this._bgT);
    this._bgT = setTimeout(() => this.buildBackground(), this.bgBuilt ? 200 : 0);
  };

  /* The tribunal, unrolled into one full turn of the camera.
     The picture sits once, behind the jury and the bench above it: its black half
     towards the defense (left), its white half towards the prosecution (right).
     The room goes on with the picture's own side walls, repeated in mirrored
     strips — black marble round the defense side, white round the prosecution
     side — until the two meet behind the camera. Mirrored bands of ceiling and
     floor above and below give the tilt room to move. Drawn small, blurred, then
     stretched: the eye never sees the difference. */
  Stage.prototype.buildBackground = function () {
    const img = this.bgImg;
    if (!img.complete || !img.naturalWidth || !this.W) return;
    const C = 2 * Math.PI * this.F0;                       // one full turn, in screen px
    const Hd = Math.round(this.H * 1.45);                  // displayed height of the picture
    const Wd = Math.round(Hd * img.naturalWidth / img.naturalHeight);
    const Et = Math.round(Hd * 0.32), Eb = Math.round(Hd * 0.46);   // mirrored ceiling / floor
    const q = Math.min(1, 4096 / C);
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const frac = 0.30;                                     // how much of each side wall a strip takes
    const side = Math.max(0, (C - Wd) / 2);
    const n = Math.max(1, Math.round(side / (frac * Wd)));
    const sw = side / n;
    const P = Math.round(C * 0.05);                        // wrap padding so the blur has neighbours
    const A = document.createElement('canvas');
    A.width = Math.round((C + 2 * P) * q); A.height = Math.round((Et + Hd + Eb) * q);
    const a = A.getContext('2d');
    const piece = (sx, sWid, dx, dw, flipX) => {
      a.save();
      a.translate(dx + (flipX ? dw : 0), 0);
      a.scale(flipX ? -1 : 1, 1);
      a.drawImage(img, sx, 0, sWid, ih, 0, Et, dw + 1.5, Hd);
      a.restore();
    };
    const layout = () => {
      piece(0, iw, 0, Wd, false);                                                                   // the tribunal
      for (let j = 0; j < n; j++) piece((1 - frac) * iw, frac * iw, Wd + j * sw, sw, j % 2 === 0);   // white walls →
      for (let k = 0; k < n; k++) piece(0, frac * iw, C - (k + 1) * sw, sw, k % 2 === 0);            // ← black walls
    };
    a.scale(q, q);
    [-C, 0, C].forEach((off) => {
      a.save(); a.translate(P + off, 0); layout(); a.restore();
      a.save(); a.translate(P + off, 2 * Et); a.scale(1, -1); layout(); a.restore();          // ceiling
      a.save(); a.translate(P + off, 2 * (Et + Hd)); a.scale(1, -1); layout(); a.restore();   // floor
    });
    const cv = document.createElement('canvas');
    cv.width = Math.round(C * q); cv.height = A.height;
    const x = cv.getContext('2d');
    x.fillStyle = '#0b0812'; x.fillRect(0, 0, cv.width, cv.height);
    x.filter = 'blur(' + Math.max(1.5, this.H * 0.0075 * q).toFixed(1) + 'px) brightness(0.8) saturate(1.12)';
    x.drawImage(A, -P * q, 0);
    x.filter = 'none';
    const T = Et + Hd + Eb;
    const gr = x.createLinearGradient(0, 0, 0, cv.height);
    gr.addColorStop(0, 'rgba(20,10,40,0.5)'); gr.addColorStop(Et / T, 'rgba(30,15,60,0.12)');
    gr.addColorStop((Et + Hd * 0.6) / T, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(8,4,16,0.55)');
    x.fillStyle = gr; x.fillRect(0, 0, cv.width, cv.height);
    this.bgC = C; this.bgCenterX = Wd / 2; this.bgE = Et; this.bgHd = Hd;
    const st = this.strip.style;
    st.backgroundImage = 'url(' + cv.toDataURL('image/jpeg', 0.86) + ')';
    st.backgroundSize = C.toFixed(1) + 'px ' + T + 'px';
    st.width = Math.ceil(C + this.W + 4) + 'px';
    st.height = T + 'px';
    // where the picture's top sits with no tilt: lower behind the jury (thrones
    // just out of frame, above), higher behind the two sides (their windows show)
    this.bgTopCentre = Math.round(-0.02 * this.H - 0.68 * Hd);
    this.bgTopSides = Math.round(0.30 * this.H - 0.38 * Hd);
    this.bgBuilt = true;
  };

  Stage.prototype.buildSpeedLines = function () {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
    const x = cv.getContext('2d');
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * 512, len = 120 + Math.random() * 700, h = 1 + Math.random() * 3.5;
      const x0 = Math.random() * 1024, a = 0.08 + Math.random() * 0.32;
      const g = x.createLinearGradient(x0, 0, x0 + len, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(x0, y, len, h); x.fillRect(x0 - 1024, y, len, h);
    }
    this.speed.style.backgroundImage = 'url(' + cv.toDataURL() + ')';
    this.speed.style.backgroundSize = '1024px 512px';
  };

  /* ------------------------------------------------------------ the line */
  Stage.prototype.computeAngles = function (slots) {
    const occ = CORE.LINE.filter((sid) => slots[sid]);
    const pos = {};
    let units = 0, prev = null;
    occ.forEach((sid, i) => {
      const side = CORE.SLOT[sid].side;
      if (i > 0 && side !== prev) units += CFG.bankGap;
      pos[slots[sid]] = units;
      units += 1;
      prev = side;
    });
    const span = Math.max(units - 1, 1);
    const step = Math.min(CFG.lineSpan / span, CFG.maxSpacing);
    const out = {};
    Object.keys(pos).forEach((k) => { out[k] = (pos[k] - (units - 1) / 2) * step; });   // the line is centred on 0
    // the jury's centre (or the middle of the line): the bench sits right above it
    const jury = occ.filter((sid) => CORE.SLOT[sid].side === 'jury').map((sid) => out[slots[sid]]);
    const centre = jury.length ? (Math.min.apply(null, jury) + Math.max.apply(null, jury)) / 2 : 0;
    const half = jury.length ? (Math.max.apply(null, jury) - Math.min.apply(null, jury)) / 2 : step;
    let has = false;
    CORE.BENCH.forEach((sid, i) => {
      if (!slots[sid]) return;
      out[slots[sid]] = centre + (i - 1) * step * CFG.benchSpread;
      has = true;
    });
    return { ang: out, bench: { phi: centre, step, half, has } };
  };

  Stage.prototype.makeActor = function (key) {
    const c = CORE.BY_KEY[key];
    const P = CFG.PPU;
    const stand = el('div', 'ts-stand');
    const body = el('div', 'ts-body');
    const img = el('img', 'ts-sprite');
    img.alt = '';
    img.decoding = 'async';
    img.src = this.A + 'sprites/' + key + '.webp';
    img.style.height = Math.round(c.h * P) + 'px';
    img.style.bottom = Math.round((c.lift || 0) * P) + 'px';
    body.appendChild(img);
    const pod = el('div', 'ts-podium');
    const nm = el('div', 'ts-plateName');
    nm.textContent = c.name;
    pod.appendChild(nm);
    stand.append(body, pod);
    this.world.appendChild(stand);
    return { key, c, stand, body, img, pod, phi: 0, phiFrom: 0, phiTo: 0, slot: null, moving: false,
      appear: 0, leaving: false, cache: {} };
  };

  /* A podium on the floor for everyone; a raised ledge for the bench. */
  Stage.prototype.dress = function (a) {
    const P = CFG.PPU, bench = a.side === 'bench';
    if (a.dressed === bench) return;
    a.dressed = bench;
    a.img.style.bottom = Math.round((a.c.lift || 0) * P) + 'px';
    const w = bench ? 1.7 : CFG.podiumW, h = bench ? 0.34 : CFG.podiumH;
    a.pod.classList.toggle('dais', bench);
    a.pod.style.width = Math.round(w * P) + 'px';
    a.pod.style.height = Math.round(h * P) + 'px';
    a.pod.style.left = Math.round(-w * P / 2) + 'px';
    a.pod.style.top = bench ? '0px' : 'auto';         // the ledge hangs under their feet
    a.pod.style.bottom = bench ? 'auto' : '0px';
  };

  /* --------------------------------------------------------- state input */
  Stage.prototype.setState = function (st) {
    if (!st) return;
    const now = performance.now();
    const age = (at) => (st.serverNow && at ? st.serverNow - at : 0);
    this.open = !!st.open;
    this.idle.classList.toggle('on', !this.opts.gm && !this.open);
    this.badge.classList.toggle('on', !!this.opts.gm && !this.open);
    if (!this.opts.gm && !this.open) {
      // court closed: players get nothing of the room, not even a glimpse behind the curtain
      Object.keys(this.actors).forEach((k) => { this.actors[k].stand.remove(); delete this.actors[k]; });
      this._sig = null; this.slots = {}; this.cam.key = null; this.cam.pan = null; this.hidePlate();
      this.fx.innerHTML = '';
      this.first = true; this.seq = { focus: -1, fx: -1, sweep: -1 };
      return;
    }
    this.route = st.route || 'jury';

    // ---- the room
    const slots = st.slots || {};
    const sig = JSON.stringify(slots);
    if (sig !== this._sig) {
      this._sig = sig;
      const lay = this.computeAngles(slots);
      const ang = lay.ang;
      this.benchFrom = this.first ? lay.bench.phi : this.benchNow;
      this.bench = lay.bench;
      const slotOf = {};
      Object.keys(slots).forEach((sid) => { slotOf[slots[sid]] = sid; });
      let anyMove = false;
      Object.keys(ang).forEach((k) => {
        let a = this.actors[k];
        if (!a) {
          a = this.actors[k] = this.makeActor(k);
          a.phi = a.phiFrom = a.phiTo = ang[k];
          a.appear = this.first ? 1 : 0;
        } else {
          a.leaving = false;
          a.phiFrom = a.phi;
          a.phiTo = ang[k];
          a.moving = !this.first && a.slot !== slotOf[k];
          if (Math.abs(a.phiTo - a.phiFrom) > 0.01) anyMove = true;
        }
        a.slot = slotOf[k];
        a.side = CORE.SLOT[a.slot].side;
        a.pod.style.setProperty('--side', SIDE_COLOR[a.side]);
        this.dress(a);
      });
      Object.keys(this.actors).forEach((k) => { if (!(k in ang)) this.actors[k].leaving = true; });
      if (this.first) Object.values(this.actors).forEach((a) => { a.phi = a.phiFrom = a.phiTo; });
      if (anyMove) this.layoutT0 = now;
      this.slots = slots;
      if (this.cam.key && !(this.cam.key in ang)) { this.cam.key = null; this.hidePlate(); }
      if (this.cam.pan && this.cam.pan.key && !(this.cam.pan.key in ang)) this.cam.pan.key = null;
      this.updatePlate();
    }

    // ---- emotes: a player may be wearing another picture than their sprite
    const pl = st.players || {};
    Object.keys(this.actors).forEach((k) => {
      const a = this.actors[k];
      const n = (pl.emoteOn || {})[k] || 1;
      const meta = n > 1 && ((pl.emotes || {})[k] || []).find((e) => e.n === n);
      const want = !meta ? this.A + 'sprites/' + k + '.webp'
        : this.opts.emoteSrc ? this.opts.emoteSrc(k, n, meta.ver)
        : this.A + 'trial/emote/' + encodeURIComponent(k) + '/' + n + '?v=' + meta.ver;
      if (a.want === want) return;
      a.want = want;
      if (this.first) { a.img.src = want; return; }
      const im = new Image();
      im.onload = () => { if (a.want !== want) return; a.img.src = want; a.body.classList.remove('ts-pop'); void a.body.offsetWidth; a.body.classList.add('ts-pop'); };
      im.onerror = () => { if (a.want === want) a.img.src = this.A + 'sprites/' + k + '.webp'; };
      im.src = want;
    });

    // ---- who has the floor
    const f = st.focus || {};
    if (f.seq !== this.seq.focus) {
      this.seq.focus = f.seq;
      if (this.first) this.jumpTo(f.key);
      else if (!f.key) { this.cam.key = null; this.cam.pan = null; this.hidePlate(); }
      else if (f.key === this.cam.key && !this.cam.pan) this.punch();
      else this.panTo(f.key);
    }
    // ---- sweep the room
    const sw = st.sweep || {};
    if (sw.seq !== this.seq.sweep) {
      this.seq.sweep = sw.seq;
      if (!this.first && sw.seq) this.startSweep();
    }
    // ---- banners
    const fx = st.fx || {};
    if (fx.seq !== this.seq.fx) {
      this.seq.fx = fx.seq;
      if (fx.seq && fx.kind && (!this.first || age(fx.at) < 3500)) {
        // a REACTION waits for the camera to land on whoever reacted
        if (fx.kind === 'reaction' && this.cam.pan && this.cam.pan.key === fx.key) {
          this._pendingFx = fx;
          const left = this.cam.pan.t0 + this.cam.pan.dur - performance.now();
          setTimeout(() => { if (this._pendingFx === fx) { this._pendingFx = null; this.playFx(fx); } }, Math.max(0, left) + 400);
        } else this.playFx(fx);
      }
    }
    this.first = false;
  };

  Stage.prototype.phiOf = function (key) {
    const a = this.actors[key];
    return a ? a.phi : null;
  };

  const pitchOf = (a) => (a && a.side === 'bench' ? 1 : 0);

  Stage.prototype.jumpTo = function (key) {
    const a = key && this.actors[key];
    this.cam.pan = null;
    if (!a) { this.cam.key = null; this.hidePlate(); return; }
    this.cam.th = a.phiTo; this.cam.prevTh = a.phiTo; this.cam.pitch = pitchOf(a);
    this.cam.key = key; this.cam.settleT0 = performance.now() - 2000;
    this.showPlate(key);
  };

  /* One camera move. seg = { key } (follow someone, even if they walk) or
     { th, pitch } (a fixed point); optional dur, ease, sweep, next (the
     following segments). Yaw and tilt move together: a straight line, so going
     from the prosecution to the bench is diagonal. */
  Stage.prototype.startPan = function (seg) {
    const cam = this.cam, now = performance.now();
    const a = seg.key && this.actors[seg.key];
    const toTh = a ? a.phi : seg.th, toPitch = a ? pitchOf(a) : seg.pitch;
    const dTh = toTh - cam.th, dP = (toPitch - cam.pitch) * 24;     // a full tilt "weighs" like 24°
    const dist = Math.hypot(dTh, dP);
    const dur = seg.dur || clamp(300 + 82 * Math.sqrt(dist), 480, 2200);   // 1 seat ≈ 0.6 s, half the room ≈ 1.4 s
    cam.pan = { fromTh: cam.th, fromPitch: cam.pitch, key: a ? seg.key : null, th: seg.th, pitch: seg.pitch,
      t0: now, dur, ease: seg.ease || PAN_EASE, pull: seg.sweep ? 0.12 : clamp(dist / 380, 0.06, 0.22),
      sweep: !!seg.sweep, next: seg.next || null };
    cam.key = null;
    cam.tiltTo = 0;
    this.hidePlate();
    if (this.opts.sound) SFX.whoosh(Math.min(dur, 1600), seg.sweep ? 0.2 : dist / 180);
  };

  Stage.prototype.panTo = function (key) {
    if (this.actors[key]) this.startPan({ key });
  };

  /* Look along the Primes (the 16 students), starting from where the camera is:
     slowly to the nearer end of the line, slowly across to the other end, then
     back to whoever had the floor. The camera stays at their level (no bench). */
  Stage.prototype.startSweep = function () {
    const primes = Object.values(this.actors).filter((a) => !a.leaving && a.side !== 'bench'
      && (a.c.group === 'pc' || a.c.group === 'prime')).map((a) => a.phi);
    if (!primes.length) return;
    const lo = Math.min.apply(null, primes), hi = Math.max.apply(null, primes);
    const th = clamp(this.cam.th, lo, hi);
    const [first, second] = th - lo <= hi - th ? [lo, hi] : [hi, lo];      // nearer end first
    const slow = (a, b) => clamp(Math.abs(b - a) * 30, 900, 8000);         // ≈ 33° per second
    const back = this.cam.key ? { key: this.cam.key } : { th: this.cam.th, pitch: this.cam.pitch };
    this.startPan({ th: first, pitch: 0, dur: slow(this.cam.th, first), ease: easeInOut, sweep: true, next: [
      { th: second, pitch: 0, dur: slow(first, second), ease: easeInOut, sweep: true },
      back,
    ] });
  };

  Stage.prototype.punch = function () {
    this.cam.punchT0 = performance.now();
    this.shake(true);
    if (this.opts.sound) SFX.slam();
  };

  Stage.prototype.shake = function (small) {
    const s = this.shaker;
    s.classList.remove('ts-shake');
    void s.offsetWidth;
    s.style.animationDuration = small ? '.32s' : '.5s';
    s.classList.add('ts-shake');
  };

  Stage.prototype.showPlate = function (key) {
    const a = this.actors[key];
    if (!a) return;
    const label = SIDE_LABEL[a.slot] || ({ defense: 'Defense', prosecution: 'Prosecution', jury: 'Jury', bench: 'Bench' })[a.side];
    this.plate.querySelector('.side').textContent = label;
    this.plate.querySelector('.name').textContent = a.c.name;
    this.plate.style.setProperty('--side', SIDE_COLOR[a.side]);
    this.plate.classList.add('on');
    this._plateKey = key;
  };
  Stage.prototype.hidePlate = function () { this.plate.classList.remove('on'); this._plateKey = null; };
  Stage.prototype.updatePlate = function () { if (this._plateKey) this.showPlate(this._plateKey); };

  /* ------------------------------------------------------------- banners
     Every style takes the GM's own words; '/' splits two lines; no words = the
     style's default text. Long text shrinks to fit the screen. */
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
  function splitLines(text) {
    return String(text || '').split('/').map((t) => t.trim()).filter(Boolean).slice(0, 2);
  }
  function lettersLines(lines) {
    let i = 0;
    return lines.map((line) => Array.from(line).map((ch) =>
      '<span style="--i:' + (i++) + ';--r:' + (Math.random() * 50 - 25).toFixed(1) + 'deg">' + (ch === ' ' ? '&nbsp;' : esc(ch)) + '</span>'
    ).join('')).join('<br>');
  }
  // font size (fraction of stage height): never above `base`, small enough for the longest line
  function fit(lines, base, k) {
    const n = Math.max.apply(null, lines.map((l) => Array.from(l).length).concat([1]));
    return Math.min(base, k / n);
  }
  const BANDS = {
    agree:   { dflt: 'I AGREE!', bg: 'linear-gradient(90deg,#002612,#13a35a 45%,#002612)', edge: '#001a0c', ink: '#fff', shadow: '#00381b' },
    counter: { dflt: 'COUNTER!', bg: 'linear-gradient(90deg,#00222c,#0aa6c8 45%,#00222c)', edge: '#001017', ink: '#fff', shadow: '#00303d' },
    custom:  { dflt: '…', bg: 'linear-gradient(90deg,#1a0a2e,#5b2a9c 45%,#1a0a2e)', edge: '#f1c66e', ink: '#fff', shadow: '#2a0b45' },
  };
  const band = (y, bh, rot, bg, edge, d0, d1) =>
    '<div class="ts-band" style="--y:' + y + ';--bh:' + bh + ';--rot:' + rot + ';--band:' + bg + ';--edge:' + edge
    + (d0 ? ';--d0:' + d0 : '') + (d1 ? ';--d1:' + d1 : '') + '"></div>';
  const word = (y, rot, lines, style, cls, sub) =>
    '<div class="ts-ww" style="--y:' + y + ';--rot:' + rot + '"><div class="ts-word ' + (cls || '') + '" style="' + (style || '') + '">'
    + lettersLines(lines) + '</div>' + (sub ? '<div class="ts-sub">' + esc(sub) + '</div>' : '') + '</div>';

  Stage.prototype.playFx = function (fx) {
    const L = this.fx;
    L.innerHTML = '';
    const box = el('div', 'ts-fxi fx-' + fx.kind);     // fx- prefix: never collide with the inner ts-* styles
    const own = splitLines(fx.text);
    let html = '<div class="ts-flash"></div>';
    let shake = 'big', life = 3100, sound = 'slam';
    switch (fx.kind) {
      case 'trial': {
        const title = own[0] || 'CLASS TRIAL', sub = own.length ? (own[1] || '') : 'IN SESSION';
        html += band('50%', '17%', '-5deg', 'linear-gradient(90deg,#1b0b33,#3a1663 40%,#1b0b33)', '#f1c66e')
          + word(sub ? '46%' : '50%', '-5deg', [title], '--ink:#f7d684;--shadow:#4a1030;--fs:calc(var(--sh)*' + fit([title], 0.19, 3.0).toFixed(3) + ')', '', sub);
        sound = 'sting';
        break;
      }
      case 'nsd': {
        let lines = own.length ? own : ['NON-STOP', 'DEBATE'];
        if (lines.length === 1 && fx.text && fx.text.indexOf('/') < 0) {
          const w = lines[0].split(/\s+/);
          if (w.length > 1) { const h = Math.ceil(w.length / 2); lines = [w.slice(0, h).join(' '), w.slice(h).join(' ')]; }
        }
        const fs = '--fs:calc(var(--sh)*' + fit(lines, 0.155, 3.0).toFixed(3) + ')';
        html += '<div class="ts-streaks" style="background-image:' + this.speed.style.backgroundImage + ';background-size:100% 50%"></div>';
        if (lines.length > 1) {
          html += band('37%', '11%', '-6deg', 'repeating-linear-gradient(90deg,#ff2e7e 0 6%,#d4135f 6% 12%)', '#120610', '', '2.3s')
            + band('63%', '11%', '-6deg', 'repeating-linear-gradient(90deg,#2a1036 0 6%,#1b0a24 6% 12%)', '#ff2e7e', '.12s', '2.3s')
            + word('37%', '-6deg', [lines[0]], fs + ';--shadow:#3a0018', 'slide')
            + word('63%', '-6deg', [lines[1]], fs + ';--ink:#ff7fb0;--shadow:#000;--d0:.12s', 'slideR');
        } else {
          html += band('50%', '13%', '-6deg', 'repeating-linear-gradient(90deg,#ff2e7e 0 6%,#d4135f 6% 12%)', '#120610', '', '2.3s')
            + word('50%', '-6deg', lines, fs + ';--shadow:#3a0018', 'slide');
        }
        break;
      }
      case 'break': {
        const text = own.length ? own.join(' ') : 'BREAK!';
        const fs = '--fs:calc(var(--sh)*' + fit([text], 0.24, 3.2).toFixed(3) + ');--ink:#fff;--shadow:#3a0010';
        html += band('50%', '16%', '-6deg', 'linear-gradient(90deg,#4a000f,#b3122e 45%,#4a000f)', '#ffd36b', '', '1.6s')
          + '<div class="ts-ww" style="--y:50%;--rot:-6deg">'
          + '<div class="ts-word ts-half top" style="' + fs + '">' + esc(text) + '</div>'
          + '<div class="ts-word ts-half bot" style="' + fs + '">' + esc(text) + '</div>'
          + '</div><div class="ts-crack"></div>';
        for (let i = 0; i < 18; i++) {
          const ang = Math.random() * Math.PI * 2, dist = 0.25 + Math.random() * 0.5;
          html += '<div class="ts-shard" style="--sz:' + (0.02 + Math.random() * 0.05).toFixed(3)
            + ';--dx:calc(var(--sw)*' + (Math.cos(ang) * dist).toFixed(3) + ');--dy:calc(var(--sh)*' + (Math.sin(ang) * dist * 1.2).toFixed(3)
            + ');--rt:' + Math.round(Math.random() * 720 - 360) + 'deg;--c:' + (i % 3 ? '#fff' : '#ff3355') + '"></div>';
        }
        sound = 'break';
        break;
      }
      case 'tip': {
        const lines = own.length ? own : ['ABOUT TO TIP'];
        html += band('50%', lines.length > 1 ? '21%' : '15%', '-6deg', 'linear-gradient(90deg,#3d2300,#c98a12 45%,#3d2300)', '#120800')
          + '<div class="ts-tip" style="position:absolute;inset:0">'
          + '<div class="ts-ww" style="--y:47%;--rot:-6deg"><div class="ts-word" style="--fs:calc(var(--sh)*' + fit(lines, 0.15, 3.0).toFixed(3) + ');--ink:#fff6d8;--shadow:#4a2600">'
          + lettersLines(lines) + '</div><div class="ts-beam"' + (lines.length > 1 ? ' style="top:calc(var(--sh)*.2)"' : '') + '></div></div></div>';
        break;
      }
      case 'reveal': {
        const lines = own.length ? own : ['THE TRUTH IS…'];
        html = '<div class="ts-letterbox"></div><div class="ts-reveal" style="--fs:calc(var(--sh)*' + fit(lines, 0.09, 2.0).toFixed(3) + ')">'
          + lettersLines(lines) + '</div>';
        shake = null; life = 4200; sound = 'reveal';
        break;
      }
      case 'shock': {
        const lines = own.length ? own : ['WHAT?!'];
        html = '<div class="ts-shockflash"></div><div class="ts-burst"></div>'
          + word('50%', '-4deg', lines, '--fs:calc(var(--sh)*' + fit(lines, lines.length > 1 ? 0.15 : 0.22, 3.0).toFixed(3) + ');--d1:2.2s', 'ts-shockw');
        shake = 'shock'; life = 2800; sound = 'shock';
        break;
      }
      case 'reaction': {
        const c = fx.key && CORE.BY_KEY[fx.key];
        html = '<div class="ts-flash soft"></div><div class="ts-react-burst"></div>'
          + band('50%', '12%', '-7deg', 'linear-gradient(90deg,#3a1400,#ff8a1e 45%,#3a1400)', '#1a0700', '', '1.6s')
          + word('48%', '-7deg', ['REACTION!'], '--fs:calc(var(--sh)*.15);--ink:#fff7da;--shadow:#5a1f00;--d1:1.65s')
          + (c ? '<div class="ts-react-name">' + esc(c.name.toUpperCase()) + '</div>' : '');
        life = 2300; sound = 'sting';
        break;
      }
      case 'whisper': {
        const lines = own.length ? own : ['…something here doesn’t add up.'];
        html = '<div class="ts-whisper" style="--fs:calc(var(--sh)*' + fit(lines, 0.05, 2.4).toFixed(3) + ')">' + lettersLines(lines) + '</div>';
        shake = null; life = 5000; sound = null;
        break;
      }
      case 'counter': {
        const c = fx.key && CORE.BY_KEY[fx.key];
        if (!own.length && c && c.cutin) {
          html += '<div class="ts-cutin"><img src="' + this.A + 'cutins/' + fx.key + '.webp" alt=""></div>';
          life = 3200;
          break;
        }
      }
      // falls through: COUNTER! as a banner
      default: {
        const b = BANDS[fx.kind] || BANDS.custom;
        const lines = own.length ? own : [b.dflt];
        html += band('50%', lines.length > 1 ? '21%' : '15%', '-6deg', b.bg, b.edge)
          + word('50%', '-6deg', lines, '--fs:calc(var(--sh)*' + fit(lines, 0.17, 3.0).toFixed(3) + ');--ink:' + b.ink + ';--shadow:' + b.shadow);
        if (fx.kind === 'agree') sound = 'sting';
      }
    }
    box.innerHTML = html;
    L.appendChild(box);
    if (shake === 'big') setTimeout(() => this.shake(false), fx.kind === 'break' ? 900 : 140);
    if (shake === 'shock') { setTimeout(() => this.shake(false), 40); setTimeout(() => this.shake(true), 560); }
    if (this.opts.sound && sound) {
      if (sound === 'sting') { SFX.sting(); SFX.slam(); }
      else if (sound === 'break') { SFX.slam(); SFX.shatter(0.88); }
      else if (sound === 'reveal') SFX.sting();
      else if (sound === 'shock') { SFX.slam(); SFX.shatter(0); }
      else SFX.slam();
    }
    clearTimeout(this._fxT);
    this._fxT = setTimeout(() => { if (box.parentNode) box.remove(); }, life);
  };

  /* ----------------------------------------------------------- the frame */
  Stage.prototype.frame = function (now) {
    const dt = Math.min(64, now - this._last);
    this._last = now;
    if (!this.W) return;
    const W = this.W, H = this.H, cam = this.cam;

    // walking to new seats
    const lp = clamp((now - this.layoutT0) / CFG.layoutMs, 0, 1);
    const le = easeInOut(lp);
    Object.keys(this.actors).forEach((k) => {
      const a = this.actors[k];
      a.phi = lerp(a.phiFrom, a.phiTo, le);
      if (lp >= 1) a.moving = false;
      a.walk = a.moving ? Math.sin(Math.PI * lp) : 0;
      if (a.leaving) a.appear = Math.max(0, a.appear - dt / 280);
      else a.appear = Math.min(1, a.appear + dt / 380);
      if (a.leaving && a.appear <= 0) { a.stand.remove(); delete this.actors[k]; }
    });

    this.benchNow = lerp(this.benchFrom, this.bench.phi, le);

    // camera
    let pull = 0;
    if (cam.pan) {
      const pan = cam.pan;
      const t = clamp((now - pan.t0) / pan.dur, 0, 1);
      const p = pan.ease(t);
      const ta = pan.key && this.actors[pan.key];
      const toTh = ta ? ta.phi : pan.th, toPitch = ta ? pitchOf(ta) : pan.pitch;
      cam.th = lerp(pan.fromTh, toTh, p);
      cam.pitch = lerp(pan.fromPitch, toPitch, p);
      pull = pan.pull * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.8);
      if (t >= 1) {
        cam.pan = null;
        if (pan.next && pan.next.length) this.startPan(Object.assign({}, pan.next[0], { next: pan.next.slice(1) }));
        else if (ta) {
          cam.key = pan.key; cam.settleT0 = now;
          cam.tiltTo = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 1.2);
          this.showPlate(pan.key);
          if (this._pendingFx && this._pendingFx.key === pan.key) { const f = this._pendingFx; this._pendingFx = null; this.playFx(f); }
        }
      }
    } else if (cam.key && this.actors[cam.key]) {
      const a = this.actors[cam.key];
      cam.th = a.phi;                                            // follow them if they walk
      cam.pitch = lerp(cam.pitch, pitchOf(a), Math.min(1, dt / 300));
    }
    const settle = cam.key ? easeOut(clamp((now - cam.settleT0) / 650, 0, 1)) : 0;
    const pt = (now - cam.punchT0) / 520;
    const punch = pt >= 0 && pt < 1 ? Math.sin(Math.PI * Math.min(1, pt * 2.2)) * (1 - pt) * 0.11 : 0;
    const pitch = cam.pitch;
    const Fflat = this.F0 * (1 - pull) * (1 + CFG.pushIn * settle + punch);
    const F = Fflat * (1 + (CFG.benchZoom - 1) * pitch);
    cam.tilt = lerp(cam.tilt, cam.key ? cam.tiltTo : 0, Math.min(1, dt / 260));

    // looking up: everything slides down until the bench's feet sit at the bottom of the frame
    const sB = F / (CFG.R * CFG.benchDepth);
    const benchFeet = H * CFG.horizon + sB * (CFG.eye - CFG.benchRise);
    const shiftY = pitch * (H * 0.97 - benchFeet);
    this.pitch = pitch;
    // screen speed in px per 60fps-frame, whatever the real frame rate (slow machines must not blur more)
    const calm = cam.pan && cam.pan.sweep ? 0.35 : 1;           // the sweep is a slow look around: keep it clear
    const norm = 16.67 / Math.max(dt, 1);
    const vx = (cam.th - cam.prevTh) * DEG * this.F0 * norm * calm;
    const vy = (shiftY - cam.prevShift) * norm * calm;
    cam.prevTh = cam.th; cam.prevShift = shiftY;
    const vel = vx;

    // the PC group shot
    const speaker = cam.key && this.actors[cam.key];
    const core = CORE.PROSECUTION_CORE;
    const groupOn = !!(speaker && core.indexOf(speaker.slot) >= 0 && !cam.pan);
    const members = groupOn ? core.map((sid) => this.slots[sid]).filter((k) => k && k !== cam.key && this.actors[k]) : [];
    const gTarget = groupOn && members.length ? 1 : 0;
    this.g = lerp(this.g, gTarget, Math.min(1, dt / (gTarget ? 170 : 110)));
    if (Math.abs(this.g - gTarget) < 0.002) this.g = gTarget;
    const g = this.g;
    const groupPos = {};
    if (g > 0 && this._groupMembers !== members.join()) this._groupMembers = members.join();
    if (g > 0) {
      const list = (members.length ? members : (this._lastMembers || [])).slice();
      if (members.length) this._lastMembers = members.slice();
      list.sort((x, y) => wrap180(this.actors[x].phi - cam.th) - wrap180(this.actors[y].phi - cam.th));
      const nL = Math.ceil(list.length / 2);
      const xsL = nL === 1 ? [0.27] : [0.12, 0.29];
      const xsR = list.length - nL === 1 ? [0.73] : [0.71, 0.88];
      list.forEach((k, i) => { groupPos[k] = { x: (i < nL ? xsL[i] : xsR[i - nL]) * W, rank: i < nL ? i : list.length - i }; });
    }

    // background: the tribunal centred on the jury; lower in the centre (thrones
    // above, out of frame), higher on the sides; it slides down as we look up
    if (this.bgBuilt) {
      const C = this.bgC;
      const tx = mod(W / 2 + (this.benchNow - cam.th) * C / 360 - this.bgCenterX, C) - C;
      const off = Math.abs(cam.th - this.benchNow);
      const inner = this.bench.step * 1.5, outer = this.bench.half + this.bench.step * 2.5;
      const u = clamp((off - inner) / Math.max(1, outer - inner), 0, 1);
      const top = lerp(this.bgTopCentre, this.bgTopSides, u * u * (3 - 2 * u)) + pitch * CFG.bgUpShift * H;
      const ty = top - this.bgE;
      this.strip.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0)';
      this.bg.style.transformOrigin = (W / 2) + 'px ' + (H * CFG.horizon) + 'px';
      this.bg.style.transform = 'scale(' + Math.max(1, Fflat / this.F0).toFixed(4) + ')';   // never zoom the hall out: its edges would show
    }
    this.camEl.style.transform = 'rotate(' + cam.tilt.toFixed(3) + 'deg)';

    // speed lines, along the direction of motion (sideways, up, or diagonal)
    const sp = Math.hypot(vx, vy);
    if (sp > 1) this.speedAng = Math.atan2(vy, vx) * 180 / Math.PI;
    this.speedX -= sp * 2.2;
    this.speed.style.opacity = clamp((sp - 6) / 55, 0, 0.85).toFixed(3);
    this.speed.style.transform = 'rotate(' + ((this.speedAng || 0) + 180).toFixed(1) + 'deg)';
    this.speed.style.backgroundPosition = this.speedX.toFixed(0) + 'px 0';

    // everyone on the ring
    const sBase = F / CFG.R;
    const blurMotion = clamp(sp / 26, 0, 5);
    const skew = clamp(-vel * 0.11, -13, 13);
    Object.keys(this.actors).forEach((k) => {
      const a = this.actors[k];
      const isSpeaker = speaker && k === cam.key;
      const gp = groupPos[k];
      const d = wrap180(a.phi - cam.th);
      const onBench = a.side === 'bench';
      const r = CFG.R * (onBench ? CFG.benchDepth : 1) + 0.75 * a.walk;
      const cosd = Math.cos(d * DEG);
      let x, s, vis = true;
      if (cosd < 0.22) { vis = false; x = 0; s = 0; }
      else {
        const depth = r * cosd;
        x = W / 2 + F * (r * Math.sin(d * DEG)) / depth;
        s = F / depth;
      }
      let op = a.appear, blur = 0, bright = 1, z = (onBench ? 150 : 400) - Math.round(Math.abs(d) * 2);
      if (g > 0) {
        if (isSpeaker) { x = lerp(x, W / 2, g); s = lerp(s, sBase * 1.1, g); z = 900; }
        else if (gp) {
          if (!vis) { x = gp.x; s = sBase * 0.66; vis = true; op *= g; }
          else { x = lerp(x, gp.x, g); s = lerp(s, sBase * 0.66, g); }
          blur += 3.6 * g; bright -= 0.42 * g; z = 300 - gp.rank;
        } else op *= (1 - g);
      }
      if (vis && (x < -W * 0.7 || x > W * 1.7)) vis = false;
      if (!vis || op <= 0.01) {
        if (a.cache.vis !== false) { a.stand.style.visibility = 'hidden'; a.cache.vis = false; }
        return;
      }
      if (a.cache.vis !== true) { a.stand.style.visibility = 'visible'; a.cache.vis = true; }
      if (!isSpeaker && !gp && speaker) { blur += 2 * settle; bright -= 0.36 * settle; }
      blur += blurMotion;
      const y = H * CFG.horizon + s * (CFG.eye - (onBench ? CFG.benchRise : 0)) + shiftY
        - (a.walk ? Math.abs(Math.sin(now / 95)) * 0.05 * s : 0);
      const sc = s / CFG.PPU;
      a.stand.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')';
      const fStr = (blur > 0.05 ? 'blur(' + (blur / sc).toFixed(1) + 'px) ' : '') + (bright < 0.99 ? 'brightness(' + bright.toFixed(2) + ')' : '');
      if (a.cache.f !== fStr) { a.stand.style.filter = fStr || 'none'; a.cache.f = fStr; }
      const skStr = Math.abs(skew) > 0.3 ? 'skewX(' + skew.toFixed(1) + 'deg)' : 'none';
      if (a.cache.sk !== skStr) { a.body.style.transform = skStr; a.cache.sk = skStr; }
      const opStr = op.toFixed(2);
      if (a.cache.op !== opStr) { a.stand.style.opacity = opStr; a.cache.op = opStr; }
      if (a.cache.z !== z) { a.stand.style.zIndex = z; a.cache.z = z; }
    });
  };

  Stage.prototype.destroy = function () {
    cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    this.root.remove();
  };

  root.TrialStage = Stage;
  root.TrialSFX = SFX;
  root.TrialStageCFG = CFG;
})(window);
