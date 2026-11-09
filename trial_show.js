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
 *
 *   const show = TrialShow.mount({ base, post, gm, container, soundOn, toast });
 *   show.update(slides, serverNow)      // slides = view.slides (or null)
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
    let cur = null, shownSrc = null, front = 0, skew = 0, mineCtl = false, busy = false, fadeT = null, lastSeq = null, hintT = null;
    const url = (id) => (o.src ? o.src(id) : (o.base || '') + '/trial/slide/' + id);
    const now = () => Date.now() + skew;

    /* ---------- pictures ---------- */
    function show(src) {
      if (src === shownSrc) return;
      shownSrc = src;
      const back = imgs[1 - front];
      const done = () => {
        if (shownSrc !== src) return;
        back.classList.add('vis'); imgs[front].classList.remove('vis'); front = 1 - front;
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
    function fadeTo(v, ms, then) {
      clearInterval(fadeT);
      const from = au.volume, t0 = performance.now();
      fadeT = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        au.volume = Math.max(0, Math.min(1, from + (v - from) * k));
        if (k >= 1) { clearInterval(fadeT); fadeT = null; if (then) then(); }
      }, 40);
    }
    function syncAudio(force) {
      const want = cur && cur.audio && cur.music && (o.gm || cur.audioAll) && (!o.soundOn || o.soundOn());
      if (!want) {
        if (!au.paused) fadeTo(0, 1200, () => au.pause());
        sndBtn.hidden = true;
        return;
      }
      const src = url(cur.audio);
      if (au.dataset.src !== src) { au.dataset.src = src; au.src = src; au.volume = 0; }
      au.loop = !!cur.loop;
      let t = Math.max(0, (now() - cur.audioAt) / 1000);
      const dur = au.duration;
      if (isFinite(dur) && dur > 0) {
        if (cur.loop) t = t % dur;
        else if (t >= dur - 0.25) { if (!au.paused) fadeTo(0, 800, () => au.pause()); return; }
      }
      if (au.readyState >= 1 && Math.abs(au.currentTime - t) > 1.5) { try { au.currentTime = t; } catch (e) {} }
      else if (au.readyState < 1) au.addEventListener('loadedmetadata', () => syncAudio(), { once: true });
      if (au.paused || force) {
        const p = au.play();
        if (p && p.then) p.then(() => { sndBtn.hidden = true; fadeTo(0.9, 1500); }).catch(() => { if (!o.container) sndBtn.hidden = false; });
      } else if (au.volume < 0.85 && !fadeT) fadeTo(0.9, 800);
    }
    setInterval(() => { if (cur) syncAudio(); }, 2000);

    /* ---------- state ---------- */
    function update(v, serverNow) {
      if (serverNow) skew = serverNow - Date.now();
      const was = cur;
      cur = v && v.n ? v : null;
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

  root.TrialShow = { mount };
})(typeof window !== 'undefined' ? window : this);
