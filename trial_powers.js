/*
 * trial_powers.js — trial powers.
 *
 * GM (trial_gm.html): a table — who grants the power (an NPC), its name, what
 * it does — with an Unlock button per row.
 * Players (trial.html): when the GM unlocks one, every screen plays "You
 * unlocked …" and it becomes a button top-left of the stage (hover = what it
 * does). A player who clicks it proposes it: every player at the table gets
 * "[PC] proposes to use [power]" with Accept / Deny. One deny cancels it; when
 * everyone has accepted, the power is used ("… activated!" on every screen),
 * leaves the players' screens and is locked again on the GM's table.
 *
 * Players' screens only ever learn about unlocked powers (trial_core.js
 * powersPublic). No secrets in this file.
 *
 *   const pw = TrialPowers.mount({ host, post, toast, sound });   pw.update(view)
 *   const gm = TrialPowers.mountGM(box, { getState, act });       gm.update()
 */
(function (root) {
  'use strict';
  const C = root.TrialCore;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const assets = () => (root.TRIAL_ASSETS != null ? root.TRIAL_ASSETS : '/');
  const tokenSrc = (k) => (C.BY_KEY[k] ? assets() + 'tokens/' + encodeURIComponent(C.BY_KEY[k].token) : '');
  const NAME = (k) => (C.BY_KEY[k] ? C.BY_KEY[k].name : '');
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function css(id, text) { if (!document.getElementById(id)) { const s = el('style'); s.id = id; s.textContent = text; document.head.appendChild(s); } }

  /* ======================= players ======================= */
  const CSS = `
.pw-hud{position:absolute;left:10px;top:10px;z-index:2000;display:flex;flex-direction:column;align-items:flex-start;gap:6px;max-width:min(300px,46%);pointer-events:none}
.pw-hud[hidden]{display:none}
.pw-hud .h{font:400 clamp(11px,1.1vw,14px)/1 Anton,Impact,sans-serif;letter-spacing:.24em;color:#f7d684;text-shadow:0 2px 0 #000;padding-left:4px}
.pw-btn{pointer-events:auto;position:relative;display:flex;align-items:center;gap:8px;max-width:100%;padding:5px 12px 5px 5px;border-radius:22px;cursor:pointer;
  background:linear-gradient(90deg,rgba(60,26,110,.94),rgba(24,12,44,.94));border:1px solid #f1c66e;color:#fff;font:700 clamp(12px,1.15vw,15px)/1.1 Cinzel,Georgia,serif;
  letter-spacing:.03em;text-align:left;box-shadow:0 4px 14px rgba(0,0,0,.5),0 0 14px rgba(241,198,110,.25);transition:transform .12s,box-shadow .12s}
.pw-btn:hover{transform:translateX(3px);box-shadow:0 4px 14px rgba(0,0,0,.5),0 0 20px rgba(241,198,110,.6)}
.pw-btn:disabled{cursor:default;filter:saturate(.6) brightness(.8)}
.pw-btn .ic{width:28px;height:28px;flex:none;border-radius:50%;background:#2a1d40 center/cover no-repeat;box-shadow:0 0 0 2px #f1c66e;display:grid;place-items:center;font-size:15px}
.pw-btn .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pw-btn.new{animation:pwNew 1.6s ease-out 3}
@keyframes pwNew{0%{box-shadow:0 0 0 0 rgba(241,198,110,.9)}100%{box-shadow:0 0 0 16px rgba(241,198,110,0)}}
.pw-tip{position:absolute;left:0;top:calc(100% + 6px);width:min(320px,70vw);padding:10px 12px;border-radius:12px;background:rgba(12,8,22,.97);border:1px solid #f1c66e;
  box-shadow:0 10px 30px rgba(0,0,0,.6);font:500 13px/1.4 system-ui,sans-serif;color:#eee;letter-spacing:0;white-space:normal;opacity:0;pointer-events:none;
  transform:translateY(-4px);transition:opacity .15s,transform .15s;z-index:3}
.pw-tip b{display:block;font:700 14px/1.2 Cinzel,Georgia,serif;color:#f7d684;margin-bottom:4px}
.pw-tip small{display:block;margin-top:6px;color:#bdb3cf;font-size:11.5px}
.pw-tip i{display:block;margin-top:6px;color:#f7d684;font-style:normal;font-size:11.5px;letter-spacing:.04em}
.pw-btn:hover .pw-tip,.pw-btn:focus-visible .pw-tip{opacity:1;transform:none}
/* the vote */
.pw-vote{position:fixed;left:50%;top:50%;z-index:78;width:min(470px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;
  transform:translate(-50%,-50%) scale(.95);opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;
  padding:18px 18px 16px;border-radius:18px;background:linear-gradient(180deg,#1f1236,#0f0a1c);border:2px solid #f1c66e;color:#eee;text-align:center;
  box-shadow:0 30px 80px rgba(0,0,0,.75),0 0 40px rgba(241,198,110,.25);font-family:system-ui,sans-serif}
.pw-vote.on{opacity:1;transform:translate(-50%,-50%) scale(1);pointer-events:auto}
.pw-vote .by{display:flex;align-items:center;justify-content:center;gap:10px;font:700 13px/1.2 Cinzel,Georgia,serif;letter-spacing:.2em;color:#cfc3e6;text-transform:uppercase}
.pw-vote .by img{width:34px;height:34px;border-radius:50%;box-shadow:0 0 0 2px #3fd0ea}
.pw-vote h2{margin:10px 0 4px;font:400 clamp(26px,6vw,40px)/1.05 Anton,Impact,sans-serif;letter-spacing:.03em;color:#f7d684;transform:skewX(-6deg)}
.pw-vote .tx{margin:6px 0 2px;font:500 14px/1.45 system-ui,sans-serif;color:#eee}
.pw-vote .gr{font-size:12px;color:#a99cc4}
.pw-vote .who{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:14px 0 4px}
.pw-vote .who span{display:flex;align-items:center;gap:6px;padding:4px 10px 4px 4px;border-radius:16px;background:#1a1229;border:1px solid #3a2d55;font:700 12px/1 Cinzel,Georgia,serif}
.pw-vote .who img{width:24px;height:24px;border-radius:50%}
.pw-vote .who span.y{border-color:#46c98b;color:#9ff0c1}.pw-vote .who span.n{border-color:#e2465c;color:#ffb3bf}
.pw-vote .go{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.pw-vote .go button{border-radius:12px;padding:13px;font:400 22px/1 Anton,Impact,sans-serif;letter-spacing:.06em;cursor:pointer;border:2px solid;color:#fff}
.pw-vote .go .y{background:linear-gradient(180deg,#1f7a4c,#0f4a2c);border-color:#7ff0b0}
.pw-vote .go .n{background:linear-gradient(180deg,#9a1f33,#5a0c1a);border-color:#ff9db0}
.pw-vote .go button:disabled{filter:grayscale(.8) brightness(.6);cursor:wait}
.pw-vote .wait{margin-top:12px;font:600 13px/1.3 system-ui;color:#cfc3e6}
.pw-vote .wait button{margin-left:8px;background:none;border:1px solid #5a4a7a;border-radius:8px;color:#cfc3e6;padding:4px 10px;cursor:pointer}
.pw-vote .end{margin-top:14px;font:400 26px/1 Anton,Impact,sans-serif;letter-spacing:.06em}
.pw-vote .end.n{color:#ff7a8a}.pw-vote .end.w{color:#bdb3cf;font-size:20px}
/* unlocked / activated */
.pw-fx{position:fixed;inset:0;z-index:79;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;
  font-family:system-ui,sans-serif;color:#fff;animation:pwOut .7s ease-in var(--out,4.2s) forwards}
.pw-fx .dim{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(40,16,70,.86),rgba(4,2,8,.93));animation:pwFade .4s ease-out both}
.pw-fx .burst{position:absolute;left:50%;top:50%;width:160vmax;height:160vmax;margin:-80vmax 0 0 -80vmax;opacity:0;mix-blend-mode:screen;
  background:repeating-conic-gradient(from 0deg,rgba(241,198,110,0) 0 8deg,rgba(241,198,110,.11) 8deg 11deg);animation:pwBurst 4s ease-out forwards}
.pw-fx>*:not(.dim):not(.burst){position:relative}
.pw-fx .k{font:700 clamp(14px,2.2vw,24px)/1 Cinzel,Georgia,serif;letter-spacing:.42em;color:#d9cdf3;animation:pwFade .4s ease-out .25s both}
.pw-fx .n{max-width:92vw;font:400 clamp(40px,8vw,104px)/1.02 Anton,Impact,sans-serif;letter-spacing:.03em;color:#f7d684;transform:skewX(-8deg);
  -webkit-text-stroke:2px #1a0a2e;paint-order:stroke fill;text-shadow:5px 5px 0 #3b0d2a,0 0 40px rgba(241,198,110,.6);animation:pwSlam .55s cubic-bezier(.2,1.5,.4,1) .45s both}
.pw-fx .t{max-width:min(640px,88vw);font:500 clamp(14px,1.7vw,19px)/1.45 system-ui,sans-serif;color:#eee;animation:pwFade .5s ease-out 1s both}
.pw-fx .g{display:flex;align-items:center;gap:8px;font:600 clamp(12px,1.3vw,15px)/1 Cinzel,Georgia,serif;letter-spacing:.12em;color:#cfc3e6;animation:pwFade .5s ease-out 1.2s both}
.pw-fx .g img{width:34px;height:34px;border-radius:50%;box-shadow:0 0 0 2px #f1c66e}
.pw-fx.used .n{color:#9ff0f7;text-shadow:5px 5px 0 #00303d,0 0 40px rgba(63,208,234,.7)}
.pw-fx.used .k{color:#7fe6f7}
.pw-fx .a{font:400 clamp(30px,5vw,64px)/1 Anton,Impact,sans-serif;letter-spacing:.08em;color:#fff;transform:skewX(-8deg);text-shadow:4px 4px 0 #00303d;animation:pwSlam .5s cubic-bezier(.2,1.5,.4,1) .9s both}
@keyframes pwFade{from{opacity:0}to{opacity:1}}
@keyframes pwOut{to{opacity:0}}
@keyframes pwSlam{from{opacity:0;transform:skewX(-8deg) scale(2.4)}to{opacity:1;transform:skewX(-8deg) scale(1)}}
@keyframes pwBurst{0%{opacity:0;transform:scale(.6) rotate(0)}12%{opacity:1}80%{opacity:.6}100%{opacity:0;transform:scale(1.1) rotate(22deg)}}
/* a small stage (a phone): a compact list */
.pw-hud.compact{left:6px;top:6px;gap:4px;max-width:40%}
.pw-hud.compact .h{display:none}
.pw-hud.compact .pw-btn{font-size:10.5px;padding:3px 9px 3px 3px;gap:5px;border-radius:14px}
.pw-hud.compact .pw-btn .ic{width:18px;height:18px;font-size:11px;box-shadow:0 0 0 1.5px #f1c66e}
.pw-hud.compact .pw-tip{width:min(240px,80vw);font-size:12px}
`;

  function mount(o) {
    o = o || {};
    css('pw-css', CSS);
    const host = o.host || document.body;
    const say = o.toast || (() => {});
    const hud = el('div', 'pw-hud'); hud.hidden = true; host.appendChild(hud);
    if (root.ResizeObserver) new ResizeObserver(() => hud.classList.toggle('compact', host.clientWidth < 700)).observe(host);
    const vote = el('div', 'pw-vote'); document.body.appendChild(vote);
    let view = null, skew = 0, fxSeq = null, voteSig = null, voteT = 0, busy = false, knownIds = null, seenVote = null;
    const now = () => Date.now() + skew;
    const SFX = () => root.TrialSFX;
    const loud = () => (o.sound ? o.sound() : true) && SFX() && SFX().ok && SFX().ok();

    function paintHud() {
      const P = (view && view.players) || {};
      const list = (view && view.powers) || [];
      hud.hidden = !list.length;
      const open = view && view.vote && view.vote.state === 'open';
      const sig = JSON.stringify([list, !!P.mine, open]);
      if (hud._sig === sig) return;
      hud._sig = sig;
      const fresh = knownIds ? list.filter((p) => knownIds.indexOf(p.id) < 0).map((p) => p.id) : [];
      knownIds = list.map((p) => p.id);
      hud.innerHTML = '<div class="h">⚡ POWERS</div>' + list.map((p) => '<button type="button" class="pw-btn' + (fresh.indexOf(p.id) >= 0 ? ' new' : '') + '" data-id="' + esc(p.id) + '"'
        + (P.mine ? '' : ' aria-disabled="true"') + '><span class="ic"' + (p.npc ? ' style="background-image:url(&quot;' + esc(tokenSrc(p.npc)) + '&quot;)"' : '') + '>' + (p.npc ? '' : '⚡') + '</span>'
        + '<span class="nm">' + esc(p.name) + '</span>'
        + '<span class="pw-tip"><b>' + esc(p.name) + '</b>' + esc(p.text || '—') + (p.npc ? '<small>Granted by ' + esc(NAME(p.npc)) + '</small>' : '')
        + '<i>' + (P.mine ? (open ? 'A vote is open' : 'Click to propose it to the table') : 'Pick a character to use it') + '</i></span></button>').join('');
    }
    hud.addEventListener('click', async (e) => {
      const b = e.target.closest('.pw-btn');
      if (!b || busy) return;
      const P = (view && view.players) || {};
      if (!P.mine) { say('Pick a character first.'); return; }
      if (view.vote && view.vote.state === 'open') { say('A vote is already open.'); return; }
      busy = true;
      const j = await o.post({ action: 'propose', id: b.dataset.id });
      busy = false;
      if (j && j.state) update(j.state);
    });

    /* ---- the vote ---- */
    function paintVote() {
      const V = view && view.vote, P = (view && view.players) || {};
      clearTimeout(voteT);
      const endAge = V && V.state !== 'open' ? now() - V.endAt : 0;
      const visible = !!V && (V.state === 'open' || (V.state !== 'passed' && endAge < 3200));
      if (!visible) { vote.classList.remove('on'); voteSig = null; return; }
      if (V.state !== 'open') voteT = setTimeout(paintVote, Math.max(50, 3200 - endAge));
      const sig = JSON.stringify([V, P.mine]);
      if (sig === voteSig) return;
      voteSig = sig;
      const p = V.power || {}, mine = P.mine, mayVote = V.state === 'open' && mine && V.need.indexOf(mine) >= 0 && V.votes[mine] == null;
      let foot = '';
      if (V.state === 'open') {
        if (mayVote) foot = '<div class="go"><button type="button" class="y" data-v="1">ACCEPT</button><button type="button" class="n" data-v="0">DENY</button></div>';
        else if (mine === V.by) foot = '<div class="wait">Waiting for the others…<button type="button" data-w="1">Withdraw</button></div>';
        else if (mine && V.votes[mine] === true) foot = '<div class="wait">You accepted — waiting for the others…</div>';
        else foot = '<div class="wait">' + (mine ? 'You joined after this vote started.' : 'The players are voting…') + '</div>';
      } else if (V.state === 'denied') foot = '<div class="end n">DENIED' + (V.deniedBy ? ' BY ' + esc(NAME(V.deniedBy).toUpperCase()) : '') + '</div>';
      else foot = '<div class="end w">' + (V.state === 'withdrawn' ? 'WITHDRAWN' : 'CANCELLED') + '</div>';
      vote.innerHTML = '<div class="by"><img alt="" src="' + esc(tokenSrc(V.by)) + '">' + esc(NAME(V.by)) + ' proposes to use</div>'
        + '<h2>⚡ ' + esc(p.name) + '</h2>' + (p.text ? '<div class="tx">' + esc(p.text) + '</div>' : '') + (p.npc ? '<div class="gr">granted by ' + esc(NAME(p.npc)) + '</div>' : '')
        + '<div class="who">' + V.need.map((k) => {
          const v = V.votes[k];
          return '<span class="' + (v === true ? 'y' : v === false ? 'n' : '') + '"><img alt="" src="' + esc(tokenSrc(k)) + '">' + esc(NAME(k)) + ' ' + (v === true ? '✓' : v === false ? '✗' : '…') + '</span>';
        }).join('') + '</div>' + foot;
      vote.classList.add('on');
      if (V.state === 'open' && V.id !== seenVote) { seenVote = V.id; if (loud()) SFX().sting(); }
    }
    vote.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-v],[data-w]');
      if (!b || busy) return;
      busy = true;
      vote.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      const j = await o.post(b.dataset.w ? { action: 'withdraw' } : { action: 'vote', yes: b.dataset.v === '1' });
      busy = false;
      if (j && j.error) say(j.error);
      voteSig = null;
      if (j && j.state) update(j.state); else paintVote();
    });

    /* ---- "You unlocked …" / "… activated!" ---- */
    function playFx(fx) {
      const p = fx.power || {};
      const box = el('div', 'pw-fx ' + (fx.kind === 'used' ? 'used' : 'unlock'));
      const granted = p.npc ? '<div class="g"><img alt="" src="' + esc(tokenSrc(p.npc)) + '">granted by ' + esc(NAME(p.npc)) + '</div>' : '';
      if (fx.kind === 'used') {
        box.style.setProperty('--out', '3.6s');
        box.innerHTML = '<div class="dim"></div><div class="burst"></div><div class="k">' + (fx.by ? esc(NAME(fx.by).toUpperCase()) + '’S PROPOSAL — THE TABLE AGREES' : 'THE TABLE AGREES') + '</div>'
          + '<div class="n">⚡ ' + esc(p.name) + '</div><div class="a">ACTIVATED!</div>' + (p.text ? '<div class="t">' + esc(p.text) + '</div>' : '');
      } else {
        box.innerHTML = '<div class="dim"></div><div class="burst"></div><div class="k">YOU UNLOCKED</div><div class="n">' + esc(p.name) + '</div>'
          + (p.text ? '<div class="t">' + esc(p.text) + '</div>' : '') + granted;
      }
      document.body.appendChild(box);
      setTimeout(() => box.remove(), fx.kind === 'used' ? 4400 : 5000);
      if (loud()) { SFX().sting(); SFX().slam(); }
    }

    function update(v) {
      const fresh = v !== view;
      view = v;
      if (fresh && v && v.serverNow) skew = v.serverNow - Date.now();
      const fx = v && v.powerFx;
      if (fx && fx.seq !== fxSeq) {
        const first = fxSeq === null;
        fxSeq = fx.seq;
        if (fx.seq && fx.at && now() - fx.at < 6000 && (!first || now() - fx.at < 4000)) playFx(fx);
      }
      paintHud();
      paintVote();
    }
    return { update, hud, vote };
  }

  /* ======================= the GM's table ======================= */
  const GM_CSS = `
.pg{background:#131824;border:1px solid #2a3349;border-radius:12px;padding:10px 12px}
.pg-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.pg-head h3{margin:0;font:700 13px/1 Cinzel,Georgia,serif;letter-spacing:.18em;text-transform:uppercase;color:#f1c66e}
.pg-head span{color:#8b96b3;font-size:12px;flex:1;min-width:200px}
.pg-head button,.pg-row button{background:#1a2130;border:1px solid #3a4562;border-radius:8px;color:#e8ecf6;padding:6px 11px;cursor:pointer;font:600 12.5px system-ui,sans-serif;white-space:nowrap}
.pg-head button:hover,.pg-row button:hover{border-color:#e8b559}
.pg-grid{display:grid;grid-template-columns:minmax(150px,190px) minmax(160px,1fr) minmax(220px,2fr) minmax(170px,auto);gap:6px 10px;align-items:start}
.pg-grid .th{font:600 10.5px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8b96b3;padding:2px 2px 0}
.pg-row{display:contents}
.pg-row select,.pg-row input,.pg-row textarea{width:100%;background:#1a2130;border:1px solid #3a4562;border-radius:8px;padding:7px 9px;color:#e8ecf6;font:13px/1.35 system-ui,sans-serif}
.pg-row textarea{resize:vertical;min-height:36px;height:36px}
.pg-row .npc{display:flex;align-items:center;gap:6px}
.pg-row .npc img{width:30px;height:30px;border-radius:50%;flex:none;background:#222a3c}
.pg-row .act{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.pg-row .un{background:linear-gradient(90deg,#5b2a9c,#3a1663);border-color:#f1c66e;color:#f7d684;font:400 14px/1 Anton,Impact,sans-serif;letter-spacing:.08em;padding:8px 14px}
.pg-row .un:disabled{opacity:.45;cursor:not-allowed}
.pg-row .st{font-size:12px;color:#46c98b;font-weight:600}
.pg-row .st.vote{color:#e8b559}
.pg-row .used{font-size:11px;color:#8b96b3}
.pg-row .del{color:#ff9a9a}
.pg-row.on input,.pg-row.on textarea,.pg-row.on select{border-color:#46c98b}
.pg-empty{color:#6b7390;font-size:12.5px;padding:6px 2px}
.pg-toast{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:90;background:#141a28;border:1px solid #e8b559;color:#f7d684;border-radius:12px;padding:10px 16px;
  font:600 13px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;transition:opacity .3s;pointer-events:none}
.pg-toast.on{opacity:1}
@media (max-width:980px){.pg-grid{grid-template-columns:1fr 1fr}.pg-grid .th{display:none}}
`;
  function newId() { return Array.from(crypto.getRandomValues(new Uint8Array(10))).map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); }

  function mountGM(box, o) {
    css('pg-css', GM_CSS);
    const S = () => o.getState() || {};
    box.classList.add('pg');
    box.innerHTML = '<div class="pg-head"><h3>⚡ Trial powers</h3><span>Unlock one: every player sees “You unlocked …” and gets it as a button. They use it only when they all accept.</span>'
      + '<button type="button" data-add>+ Add a power</button></div><div class="pg-grid"></div>';
    const grid = box.querySelector('.pg-grid');
    const toast = el('div', 'pg-toast'); document.body.appendChild(toast);
    const say = (m) => { toast.textContent = m; toast.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove('on'), 4200); };
    const npcOpts = '<option value="">— nobody —</option>' + C.CAST.filter((c) => c.group !== 'pc').map((c) => '<option value="' + c.key + '">' + esc(c.name) + '</option>').join('');
    const rows = {};
    const timers = {};
    let fxSeq = null;
    box.querySelector('[data-add]').onclick = () => {
      const id = newId();
      o.act({ action: 'powerAdd', id });
      setTimeout(() => { const r = rows[id]; if (r) r.name.focus(); }, 60);
    };
    const pend = {};                       // edits typed but not sent yet: the poll must not undo them
    function send(id, field, value) {
      const k = id + field;
      clearTimeout(timers[k]); pend[k] = true;
      timers[k] = setTimeout(() => { delete pend[k]; o.act({ action: 'powerEdit', id, [field]: value }); }, field === 'npc' ? 0 : 450);
    }
    const pending = (id, f) => !!pend[id + f];
    function makeRow(p) {
      const r = { el: el('div', 'pg-row') };
      r.el.innerHTML = '<div class="npc"><img alt=""><select>' + npcOpts + '</select></div>'
        + '<input type="text" maxlength="60" placeholder="Power name">'
        + '<textarea maxlength="500" rows="1" placeholder="What it does (the players read this)"></textarea><div class="act"></div>';
      r.img = r.el.querySelector('img'); r.sel = r.el.querySelector('select'); r.name = r.el.querySelector('input'); r.text = r.el.querySelector('textarea'); r.act = r.el.querySelector('.act');
      r.sel.onchange = () => { send(p.id, 'npc', r.sel.value); paintImg(r, r.sel.value); };
      r.name.oninput = () => { send(p.id, 'name', r.name.value); r.un && (r.un.disabled = !r.name.value.trim()); };
      r.text.oninput = () => send(p.id, 'text', r.text.value);
      r.act.onclick = (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const a = b.dataset.a;
        if (a === 'unlock') {
          clearTimeout(timers[p.id + 'name']); clearTimeout(timers[p.id + 'text']); delete pend[p.id + 'name']; delete pend[p.id + 'text'];
          o.act({ action: 'powerEdit', id: p.id, name: r.name.value, text: r.text.value });
          o.act({ action: 'powerUnlock', id: p.id });
        } else if (a === 'lock') o.act({ action: 'powerLock', id: p.id });
        else if (a === 'cancel') o.act({ action: 'voteCancel' });
        else if (a === 'del') {
          if (Date.now() - (b._armed || 0) < 3000) o.act({ action: 'powerDelete', id: p.id });
          else { b._armed = Date.now(); b.textContent = 'Sure? ✕'; setTimeout(() => { if (b.isConnected) b.textContent = '🗑'; }, 3000); }
        }
      };
      return r;
    }
    function paintImg(r, k) { r.img.style.visibility = k ? 'visible' : 'hidden'; if (k) r.img.src = assets() + 'tokens/' + encodeURIComponent(C.BY_KEY[k].token); }
    function update() {
      const st = S(), list = st.powers || [], V = st.vote && st.vote.state === 'open' ? st.vote : null;
      // the GM hears about a power used (or unlocked)
      const fx = st.powerFx;
      if (fx && fx.seq !== fxSeq) {
        if (fxSeq !== null && fx.kind === 'used' && fx.power) say('⚡ ' + fx.power.name + ' activated — ' + (fx.by ? NAME(fx.by) + ' proposed it, ' : '') + 'the table agreed.');
        fxSeq = fx.seq;
      }
      if (!grid._head) {
        grid._head = true;
        grid.innerHTML = '<div class="th">Granted by</div><div class="th">Power</div><div class="th">What it does</div><div class="th"></div>';
      }
      const ids = list.map((p) => p.id);
      Object.keys(rows).forEach((id) => { if (ids.indexOf(id) < 0) { rows[id].el.remove(); delete rows[id]; } });
      list.forEach((p) => {
        let r = rows[p.id];
        if (!r) { r = rows[p.id] = makeRow(p); grid.appendChild(r.el); }
        const focus = document.activeElement;
        if (focus !== r.sel && !pending(p.id, 'npc') && r.sel.value !== (p.npc || '')) r.sel.value = p.npc || '';
        if (focus !== r.name && r.name.value !== p.name && !pending(p.id, 'name')) r.name.value = p.name;
        if (focus !== r.text && r.text.value !== p.text && !pending(p.id, 'text')) r.text.value = p.text;
        paintImg(r, r.sel.value);
        r.el.classList.toggle('on', !!p.on);
        const vote = V && V.power === p.id ? V : null;
        const sig = JSON.stringify([p.on, p.used, vote && [vote.by, vote.votes, vote.need]]);
        if (r._sig !== sig) {
          r._sig = sig;
          let h = '';
          if (vote) {
            h = '<span class="st vote">Vote: ' + esc(NAME(vote.by)) + ' proposed · ' + vote.need.map((k) => esc(NAME(k)) + (vote.votes[k] === true ? ' ✓' : ' …')).join(', ') + '</span>'
              + '<button type="button" data-a="cancel">Cancel the vote</button>';
          } else if (p.on) h = '<span class="st">● In the players’ hands</span><button type="button" data-a="lock" title="Take it back (no animation)">Take back</button>';
          else h = '<button type="button" class="un" data-a="unlock">⚡ Unlock</button>';
          h += '<button type="button" class="del" data-a="del" title="Delete this power (click twice)">🗑</button>' + (p.used ? '<span class="used">used ×' + p.used + '</span>' : '');
          r.act.innerHTML = h;
          r.un = r.act.querySelector('.un');
        }
        if (r.un) r.un.disabled = !r.name.value.trim();
      });
      let empty = grid.querySelector('.pg-empty');
      if (!list.length && !empty) { empty = el('div', 'pg-empty', 'No power yet — “+ Add a power”, pick who grants it, name it, say what it does.'); empty.style.gridColumn = '1 / -1'; grid.appendChild(empty); }
      else if (list.length && empty) empty.remove();
    }
    return { update };
  }

  root.TrialPowers = { mount, mountGM };
})(typeof window !== 'undefined' ? window : this);
