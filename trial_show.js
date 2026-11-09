/*
 * trial_show.js — a slideshow playing, as the players see it (and, small, in
 * the GM's preview).
 *
 *  - The picture fills the screen (whole picture, never cropped), over a
 *    blurred copy of itself; pages crossfade.
 *  - The player the GM handed the slideshow to ("Pryah presents") gets
 *    ◀ Previous / Next ▶ — also the arrow keys and a swipe.
 *  - The slideshow's music plays hidden, started where it should be for
 *    someone who arrives late; it fades out when the slideshow ends. If the
 *    browser refuses sound before a first tap, a "Tap for the music" button
 *    appears.
 *  - Every screen plays the music in step: they all follow the server's
 *    clock (TrialShow.clock, fed by the page's polls), jump when more than
 *    0.4 s off and otherwise speed up / slow down by a few % (pitch kept)
 *    until they are within a few hundredths of a second.
 *
 *   const show = TrialShow.mount({ base, post, gm, container, soundOn, toast });
 *   show.update(slides, serverNow)      // slides = view.slides (or null)
 *   TrialShow.clock(serverNow, t0, t1)  // after each poll: sent at t0, answered at t1 (Date.now())
 */
(function (root) {
  'use strict';
  const C = root.TrialCore;
  const CSS = `
.sh-ov{position:fixed;inset:0;z-index:65;background:#000;opacity:0;visibility:hidden;transition:opacity .6s,visibility 0s .6s;overflow:hidden;
  font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#eee;touch-action:pan-y}
.sh-ov.on{opacity:1;visibility:visible;transition:opacity .6s,visibility 0s}
.sh-ov.mini{position:absolute;z-index:30}
.sh-bg{position:absolute;inset:-60px;background:#000 center/cover no-repeat;filter:blur(34px) brightness(.32) saturate(1.2);transform:scale(1.05);transition:background-image .2s}
.sh-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity .55s ease}
.sh-img.vis{opacity:1}
.sh-top{position:absolute;left:16px;top:14px;display:flex;align-items:center;gap:10px;padding:6px 14px 6px 6px;border-radius:24px;background:rgba(0,0,0,.55);
  font:700 13px/1 Cinzel,Georgia,serif;letter-spacing:.08em;opacity:.92;max-width:calc(100% - 32px)}
.sh-top img{width:30px;height:30px;border-radius:50%;object-fit:cover}
.sh-top .nm{color:#f7d684;white-space:nowrap}.sh-top .ti{color:#cfc4e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sh-top.solo{padding-left:14px}
.sh-count{position:absolute;right:18px;top:16px;padding:6px 12px;border-radius:14px;background:rgba(0,0,0,.55);font:400 18px/1 Anton,Impact,sans-serif;letter-spacing:.08em}
.sh-ctl{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:none;gap:12px}
.sh-ov.ctl .sh-ctl{display:flex}
.sh-ctl button{min-width:150px;padding:14px 20px;border-radius:14px;border:2px solid #f1c66e;cursor:pointer;color:#f7d684;
  background:linear-gradient(180deg,rgba(85,32,154,.92),rgba(42,17,80,.92));font:400 22px/1 Anton,Impact,sans-serif;letter-spacing:.06em;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.sh-ctl button:disabled{opacity:.35;cursor:default}
.sh-ctl button:not(:disabled):active{transform:translateY(3px)}
.sh-hint{position:absolute;left:50%;bottom:86px;transform:translateX(-50%);font:600 12px/1 system-ui;letter-spacing:.12em;color:#f7d684;text-transform:uppercase;
  background:rgba(0,0,0,.55);padding:6px 12px;border-radius:10px;white-space:nowrap;opacity:0;transition:opacity .4s;pointer-events:none}
.sh-ov.ctl .sh-hint.show{opacity:1}
.sh-snd{position:absolute;left:50%;top:16px;transform:translateX(-50%);padding:8px 16px;border-radius:18px;border:1px solid #f1c66e;background:rgba(20,12,34,.92);
  color:#f7d684;font:700 13px/1 system-ui;cursor:pointer}
.sh-snd[hidden]{display:none}
.sh-ov.mini .sh-top,.sh-ov.mini .sh-count{transform:scale(.8);transform-origin:left top}
.sh-ov.mini .sh-count{transform-origin:right top}
@media (max-width:640px){.sh-ctl button{min-width:120px;font-size:19px;padding:12px 14px}}
`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const assets = () => (root.TRIAL_ASSETS != null ? root.TRIAL_ASSETS : '/');

  /* ---------- the server's clock, as well as this page can tell it ----------
   * A reading timed by the page (sent at t0, answered at t1) is off by at most
   * half its round trip, so the quickest recent one wins. Untimed readings
   * (a view's serverNow) always arrive late, so the one that came quickest —
   * the largest offset — wins. A view painted twice is not a new reading. */
  const CLOCK = { samples: [], last: 0 };
  function clockSample(serverNow, t0, t1) {
    if (!serverNow || serverNow === CLOCK.last) return;
    CLOCK.last = serverNow;
    const at = Date.now(), timed = t0 != null && t1 != null && t1 >= t0;
    CLOCK.samples.push({ at, off: timed ? serverNow - (t0 + t1) / 2 : serverNow - at, err: timed ? (t1 - t0) / 2 : null });
    CLOCK.samples = CLOCK.samples.filter((x) => at - x.at < 90000).slice(-80);
  }
  function clockOffset() {
    const S = CLOCK.samples;
    if (!S.length) return 0;
    const timed = S.filter((x) => x.err != null);
    if (timed.length) return timed.reduce((a, b) => (b.err < a.err ? b : a)).off;
    return S.reduce((a, b) => (b.off > a.off ? b : a)).off;
  }

  function mount(o) {
    o = o || {};
    if (!document.getElementById('sh-css')) { const s = document.createElement('style'); s.id = 'sh-css'; s.textContent = CSS; document.head.appendChild(s); }
    const host = o.container || document.body;
    const ov = document.createElement('div');
    ov.className = 'sh-ov' + (o.container ? ' mini' : '');
    ov.innerHTML = '<div class="sh-bg"></div><img class="sh-img" alt=""><img class="sh-img" alt="">'
      + '<div class="sh-top"></div><div class="sh-count"></div>'
      + '<div class="sh-hint">You present — tell the story</div>'
      + '<div class="sh-ctl"><button type="button" data-d="-1">◀ Previous</button><button type="button" data-d="1">Next ▶</button></div>'
      + '<button type="button" class="sh-snd" hidden>🔊 Tap for the music</button>';
    host.appendChild(ov);
    const imgs = ov.querySelectorAll('.sh-img'), bg = ov.querySelector('.sh-bg');
    const au = new Audio(); au.preload = 'auto';
    au.preservesPitch = au.mozPreservesPitch = au.webkitPreservesPitch = true;   // nudging the speed never changes the key
    let cur = null, shownSrc = null, front = 0, mineCtl = false, busy = false, fadeT = null, lastSeq = null, hintT = null;
    const url = (id) => (o.src ? o.src(id) : (o.base || '') + '/trial/slide/' + id);
    const now = () => Date.now() + clockOffset();

    /* ---------- pictures ---------- */
    function show(src) {
      if (src === shownSrc) return;
      shownSrc = src;
      const back = imgs[1 - front];
      let fired = false;
      // A picture already loaded (the next page, fetched ahead) is ready at once AND still fires
      // "load": the swap must happen only once, or the second time hides the picture again.
      const done = () => {
        if (fired || shownSrc !== src) return;
        fired = true; back.onload = back.onerror = null;
        imgs.forEach((im) => im.classList.toggle('vis', im === back));
        front = back === imgs[0] ? 0 : 1;
        bg.style.backgroundImage = 'url("' + src + '")';
      };
      back.onload = done; back.onerror = done;
      back.src = src;
      if (back.complete && back.naturalWidth) done();
    }
    const preload = (id) => { if (id) { const i = new Image(); i.src = url(id); } };

    /* ---------- the presenter's controls ---------- */
    async function go(d) {
      if (!cur || busy) return;
      if (!o.gm && !mineCtl) return;
      busy = true;
      const j = await o.post(o.gm ? { action: 'slideGo', delta: d } : { action: 'slide', delta: d });
      busy = false;
      if (j && j.error && o.toast) o.toast(j.error);
    }
    ov.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => go(Number(b.dataset.d)); });
    if (!o.container) {
      root.addEventListener('keydown', (e) => {
        if (!cur || !mineCtl || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      });
      let sx = null;
      ov.addEventListener('pointerdown', (e) => { sx = e.clientX; });
      ov.addEventListener('pointerup', (e) => {
        if (sx == null || !mineCtl) return;
        const dx = e.clientX - sx; sx = null;
        if (Math.abs(dx) > 70 && !e.target.closest('button')) go(dx < 0 ? 1 : -1);
      });
    }

    /* ---------- music ---------- */
    const sndBtn = ov.querySelector('.sh-snd');
    sndBtn.onclick = () => { sndBtn.hidden = true; syncAudio(true); };
    let fadeAim = null;                        // where the fade running now is going (null: none)
    function fadeTo(v, ms, then) {
      clearInterval(fadeT);
      fadeAim = v;
      const from = au.volume, t0 = performance.now();
      fadeT = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        au.volume = Math.max(0, Math.min(1, from + (v - from) * k));
        if (k >= 1) { clearInterval(fadeT); fadeT = null; fadeAim = null; if (then) then(); }
      }, 40);
    }
    let lead = 0.05, lastSeek = 0, heldSince = 0, confirmedAt = null, metaWait = false, refused = false;
    const setRate = (r) => { if (Math.abs(au.playbackRate - r) > 0.001) au.playbackRate = r; };
    function seekTo(t, dur) {
      let x = t + lead;
      if (isFinite(dur) && dur > 0) x = cur.loop ? x % dur : Math.min(x, dur - 0.05);
      try { au.currentTime = x; lastSeek = Date.now(); } catch (e) {}
      setRate(1);
    }
    function syncAudio(force) {
      const want = cur && cur.audio && cur.music && (o.gm || cur.audioAll) && (!o.soundOn || o.soundOn());
      if (!want) {
        setRate(1);
        if (!au.paused && fadeAim !== 0) fadeTo(0, 1200, () => au.pause());   // (once: the checks come faster than the fade)
        sndBtn.hidden = true;
        return;
      }
      // The GM's own click is applied here before the server has it, with this computer's clock:
      // wait (a moment) for the server's start time instead of starting off-beat.
      if (o.gm && CLOCK.samples.length && cur.audioAt !== confirmedAt) {
        if (!heldSince) heldSince = Date.now();
        if (Date.now() - heldSince < 2500) return;
      } else heldSince = 0;
      const src = url(cur.audio);
      if (au.dataset.src !== src) { au.dataset.src = src; au.src = src; au.volume = 0; lead = 0.05; lastSeek = 0; }
      au.loop = !!cur.loop;
      let t = Math.max(0, (now() - cur.audioAt) / 1000);
      const dur = au.duration;
      if (isFinite(dur) && dur > 0) {
        if (cur.loop) t = t % dur;
        else if (t >= dur - 0.25) { setRate(1); if (!au.paused && fadeAim !== 0) fadeTo(0, 800, () => au.pause()); return; }
      }
      if (au.readyState < 1) {
        if (!metaWait) { metaWait = true; au.addEventListener('loadedmetadata', () => { metaWait = false; syncAudio(); }, { once: true }); }
      } else if (au.paused) {                                          // about to start (not while waiting for a tap)
        if ((!refused || force) && Math.abs(au.currentTime - t - lead) > 0.03) seekTo(t, dur);
      } else if (!au.seeking && au.readyState >= 3) {                  // playing: measure, then correct
        let d = au.currentTime - t;                                     // > 0: ahead of the others
        if (cur.loop && isFinite(dur) && dur > 0) { if (d > dur / 2) d -= dur; else if (d < -dur / 2) d += dur; }
        if (Math.abs(d) > 0.4) {
          if (Date.now() - lastSeek > 1500) {
            // still off just after a jump: the jump itself takes time here, so aim that much further
            if (lastSeek && Date.now() - lastSeek < 8000) lead = Math.max(0, Math.min(1.5, lead - d));
            seekTo(t, dur);
          }
        } else if (Math.abs(d) > 0.025) setRate(1 - Math.max(-0.06, Math.min(0.06, d * 0.35)));
        else setRate(1);
      }
      if (au.paused || force) {
        const p = au.play();
        if (p && p.then) p.then(() => { refused = false; sndBtn.hidden = true; fadeTo(0.9, 1500); }).catch(() => { refused = true; if (!o.container) sndBtn.hidden = false; });
      } else if ((au.volume < 0.85 && !fadeT) || fadeAim === 0) fadeTo(0.9, 800);
    }
    au.addEventListener('playing', () => { if (cur) syncAudio(); });
    setInterval(() => { if (cur) syncAudio(); }, 500);

    /* ---------- state ---------- */
    function update(v, serverNow) {
      clockSample(serverNow);
      const was = cur;
      cur = v && v.n ? v : null;
      if (cur && serverNow) confirmedAt = cur.audioAt;
      ov.classList.toggle('on', !!cur);
      if (!cur) {
        if (was) { syncAudio(); shownSrc = null; setTimeout(() => { if (!cur) imgs.forEach((i) => { i.classList.remove('vis'); i.removeAttribute('src'); }); }, 700); }
        mineCtl = false;
        return;
      }
      const P = o.players ? o.players() : {};
      mineCtl = !o.gm && !!P.mine && cur.ctrl === P.mine;
      ov.classList.toggle('ctl', mineCtl);
      const id = cur.ids[cur.idx];
      if (id) show(url(id));
      preload(cur.ids[cur.idx + 1]); preload(cur.ids[cur.idx - 1]);
      ov.querySelector('.sh-count').textContent = (cur.idx + 1) + ' / ' + cur.n;
      const who = cur.ctrl && C.BY_KEY[cur.ctrl];
      const top = ov.querySelector('.sh-top');
      top.classList.toggle('solo', !who);
      top.innerHTML = (who ? '<img src="' + assets() + 'tokens/' + encodeURIComponent(who.token) + '" alt=""><span class="nm">' + esc(who.name) + ' presents</span><span class="ti">· ' + esc(cur.name) + '</span>'
        : '<span class="ti">' + esc(cur.name) + '</span>');
      const [pv, nx] = ov.querySelectorAll('.sh-ctl button');
      pv.disabled = cur.idx <= 0; nx.disabled = cur.idx >= cur.n - 1;
      if (mineCtl && (!was || was.ctrl !== cur.ctrl || was.id !== cur.id)) {        // just handed over: say so
        const h = ov.querySelector('.sh-hint'); h.classList.add('show'); clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove('show'), 4000);
      }
      if (lastSeq !== cur.seq) lastSeq = cur.seq;
      syncAudio();
    }

    return { update, el: ov, audio: au };
  }

  root.TrialShow = { mount, clock: clockSample, offset: clockOffset };
})(typeof window !== 'undefined' ? window : this);
