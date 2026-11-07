/*
 * trial_dice_gm.js — skill checks on the GM's side: the SKILL CHECK window and
 * the roll log. Used by the trial dashboard (GM_PATH/trial) and the cockpit
 * (GM_PATH, as a small dock bottom-left).
 *
 *   SKILL CHECK → pick the PCs (click a portrait), a skill under each (A→Z),
 *   or "Same skill for all", or "Opening checks" (each PC's detective style);
 *   optional DC, judged on each roll or on the sum → "Ask for the roll".
 *   The log lists every roll as it lands: die (both for advantage /
 *   disadvantage), modifier, total, pass/fail against the DC, the sum and
 *   the successes.
 *
 *   TrialDiceGM.mount(container, { getState, act })   // the trial dashboard
 *   TrialDiceGM.dock()                                 // the cockpit (polls by itself)
 */
(function (root) {
  'use strict';
  const C = root.TrialCore;
  const CSS = `
.dg{font:13px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;color:#e8e3f0}
.dg-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:11px 12px;border-radius:12px;cursor:pointer;
  font:400 18px/1 Anton,Impact,sans-serif;letter-spacing:.08em;color:#f7d684;background:linear-gradient(180deg,#4a1c80,#2a1150);border:2px solid #f1c66e}
.dg-btn:hover{filter:brightness(1.15)}
.dg-log{margin-top:10px;display:grid;gap:8px;max-height:var(--dg-max,340px);overflow:auto;padding-right:2px}
.dg-empty{color:#8d849c;font-size:12px;text-align:center;padding:8px}
.dg-chk{border:1px solid #2e2540;border-radius:10px;background:#120d1c;padding:8px 9px}
.dg-chk.open{border-color:#6a4fa0;box-shadow:0 0 0 1px rgba(150,110,230,.25)}
.dg-h{display:flex;align-items:center;gap:6px;font-size:11px;color:#9a90ab;letter-spacing:.04em;margin-bottom:5px}
.dg-h b{color:#d8cff0}.dg-h .sp{flex:1}
.dg-h button{background:none;border:1px solid #4a3d66;color:#cfc4e8;border-radius:7px;padding:2px 8px;font-size:11px;cursor:pointer}
.dg-r{display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:7px;padding:3px 0;border-top:1px dashed #241c33}
.dg-r:first-of-type{border-top:0}
.dg-r img{width:22px;height:22px;border-radius:50%;object-fit:cover}
.dg-r .who{min-width:0}.dg-r .who b{font-weight:700}.dg-r .who .sk{display:block;font-size:11px;color:#9a90ab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dg-r .res{text-align:right;white-space:nowrap}
.dg-r .res .tot{font:400 19px/1 Anton,Impact,sans-serif;letter-spacing:.03em;color:#fff}
.dg-r .res .det{display:block;font-size:10.5px;color:#9a90ab}
.dg-r .res .det s{color:#5f566e}
.dg-r .wait{color:#8d849c;font-size:12px;font-style:italic}
.dg-r.new{animation:dgNew 1.4s ease-out}
@keyframes dgNew{0%{background:rgba(241,198,110,.35)}100%{background:transparent}}
.dg-ok{color:#5fe0a0}.dg-ko{color:#ff7a8a}.dg-n20{color:#ffd45a}.dg-n1{color:#ff5a6e}
.dg-m{font-size:9.5px;font-weight:700;letter-spacing:.1em;padding:1px 5px;border-radius:5px;margin-left:4px;vertical-align:2px}
.dg-m.adv{background:#1d4d33;color:#9ff0c1}.dg-m.dis{background:#5a1622;color:#ffb3bf}
.dg-f{display:flex;gap:10px;flex-wrap:wrap;margin-top:5px;padding-top:5px;border-top:1px solid #2a2238;font-size:12px;color:#cfc4e8}
.dg-f b{color:#fff}
.dg-clear{display:block;margin:6px auto 0;background:none;border:0;color:#7d7390;font-size:11px;text-decoration:underline;cursor:pointer}
/* the window */
.dg-modal{position:fixed;inset:0;z-index:200;display:flex;padding:16px;background:rgba(5,3,10,.78);overflow:auto}
.dg-modal[hidden]{display:none}
.dg-win{margin:auto;width:min(860px,100%);background:#140e1f;border:1px solid #4a3d66;border-radius:18px;padding:18px;box-shadow:0 30px 90px rgba(0,0,0,.7)}
.dg-win h2{margin:0 0 4px;font:400 30px/1 Anton,Impact,sans-serif;letter-spacing:.06em;color:#f7d684}
.dg-win .sub{color:#9a90ab;font-size:12px;margin-bottom:12px}
.dg-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
.dg-tools select,.dg-tools input{background:#0c0814;color:#eee;border:1px solid #4a3d66;border-radius:8px;padding:6px 8px;font:13px system-ui}
.dg-tools input{width:70px}
.dg-tools button,.dg-seg button{background:#22183a;color:#e8e3f0;border:1px solid #4a3d66;border-radius:8px;padding:6px 10px;cursor:pointer;font:600 12px system-ui}
.dg-seg{display:inline-flex}.dg-seg button{border-radius:0}.dg-seg button:first-child{border-radius:8px 0 0 8px}.dg-seg button:last-child{border-radius:0 8px 8px 0}
.dg-seg button.on{background:#5b2a9c;border-color:#f1c66e;color:#fff}
.dg-pcs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
@media (max-width:640px){.dg-pcs{grid-template-columns:repeat(2,minmax(0,1fr))}}
.dg-pc{border:2px solid #2e2540;border-radius:14px;padding:10px 8px;background:#100b19;display:flex;flex-direction:column;align-items:center;gap:7px;opacity:.55;transition:opacity .15s,border-color .15s}
.dg-pc.sel{opacity:1;border-color:#f1c66e;background:#1c1330}
.dg-pc .pt{position:relative;width:84px;height:84px;border-radius:50%;cursor:pointer;border:0;padding:0;background:none}
.dg-pc .pt img{width:84px;height:84px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 3px var(--dc,#555)}
.dg-pc .pt i{position:absolute;right:-2px;bottom:-2px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font:700 15px/1 system-ui;font-style:normal;background:#2a2040;color:#9a90ab;border:2px solid #140e1f}
.dg-pc.sel .pt i{background:#f1c66e;color:#1a1205}
.dg-pc .nm{font:700 14px/1 Cinzel,Georgia,serif}
.dg-pc .tag{font-size:10.5px;color:#ff9db0;letter-spacing:.04em;min-height:13px}
.dg-pc .tag.ok{color:#7fd8a8}
.dg-pc select{width:100%;background:#0c0814;color:#eee;border:1px solid #4a3d66;border-radius:8px;padding:6px 4px;font:12.5px system-ui}
.dg-pc select:disabled{opacity:.4}
.dg-go{display:flex;gap:10px;justify-content:flex-end;align-items:center;margin-top:14px;flex-wrap:wrap}
.dg-go .why{color:#9a90ab;font-size:12px;margin-right:auto}
.dg-go button{padding:11px 18px;border-radius:12px;cursor:pointer;font:400 18px/1 Anton,Impact,sans-serif;letter-spacing:.06em}
.dg-go .ask{background:linear-gradient(180deg,#5b2a9c,#34165e);border:2px solid #f1c66e;color:#f7d684}
.dg-go .ask:disabled{filter:grayscale(.9) brightness(.6);cursor:not-allowed}
.dg-go .cancel{background:none;border:1px solid #4a3d66;color:#cfc4e8;font:600 13px system-ui}
/* the cockpit dock */
.dg-dock{position:fixed;left:14px;bottom:14px;z-index:150;width:290px;background:rgba(16,11,25,.96);border:1px solid #4a3d66;border-radius:14px;padding:10px;box-shadow:0 14px 40px rgba(0,0,0,.55)}
.dg-dock.min .dg-log{display:none}.dg-dock.min .dg-btn{padding:8px;font-size:16px}
.dg-dock .dh{display:flex;align-items:center;gap:6px;margin-bottom:8px;font:700 12px/1 Cinzel,Georgia,serif;letter-spacing:.08em;color:#cfc4e8;cursor:pointer;user-select:none}

.dg-dock .dh .sp{flex:1}.dg-dock .dh .n{background:#5b2a9c;color:#fff;border-radius:9px;padding:2px 7px;font:700 10px system-ui}
`;
  const DIE_COLOR = { angele: '#a26bff', askii: '#d9a24c', pryah: '#ff6a1a', mune: '#8fd46a', bardik: '#7a68a8' };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tokenSrc = (k) => (root.TRIAL_ASSETS != null ? root.TRIAL_ASSETS : '/') + 'tokens/' + encodeURIComponent(C.BY_KEY[k].token);
  const hhmm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  function css() { if (!document.getElementById('dg-css')) { const s = document.createElement('style'); s.id = 'dg-css'; s.textContent = CSS; document.head.appendChild(s); } }

  /* ---------- the log ---------- */
  function rowHtml(k, it, c, fresh) {
    const r = it.roll;
    let res;
    if (!r) res = '<span class="wait">' + (it.absent ? 'not at the table' : 'waiting…') + '</span>';
    else {
      const sign = r.mod >= 0 ? '+' + r.mod : '−' + Math.abs(r.mod);
      const dice = r.dice.length === 2
        ? r.dice.map((d, i) => (i === r.dice.indexOf(r.kept) ? d : '<s>' + d + '</s>')).join(' · ') : String(r.kept);
      const nat = r.kept === 20 ? ' <span class="dg-n20">nat 20</span>' : r.kept === 1 ? ' <span class="dg-n1">nat 1</span>' : '';
      const pf = c.dc != null && c.dcMode === 'each' ? (r.total >= c.dc ? ' <span class="dg-ok">✓</span>' : ' <span class="dg-ko">✗</span>') : '';
      res = '<span class="tot">' + r.total + pf + '</span><span class="det">' + dice + ' ' + sign + nat + '</span>';
    }
    const mode = r && r.mode !== 'normal' ? '<span class="dg-m ' + r.mode + '">' + (r.mode === 'adv' ? 'ADV' : 'DIS') + '</span>' : '';
    return '<div class="dg-r' + (fresh ? ' new' : '') + '"><img src="' + tokenSrc(k) + '" alt=""><div class="who"><b>' + esc(C.BY_KEY[k].name) + '</b>' + mode
      + '<span class="sk">' + esc(it.skill) + '</span></div><div class="res">' + res + '</div></div>';
  }
  function checkHtml(c, active, seen) {
    const keys = C.PCS.filter((k) => c.items[k]);
    const rolls = keys.map((k) => c.items[k].roll).filter(Boolean);
    const sum = rolls.reduce((s, r) => s + r.total, 0);
    const open = c.id === active;
    let foot = '';
    if (rolls.length) {
      foot = '<span>Sum <b>' + sum + '</b>' + (c.dc != null && c.dcMode === 'sum' ? ' vs DC ' + c.dc + ' ' + (sum >= c.dc ? '<span class="dg-ok">✓ reached</span>' : '<span class="dg-ko">✗ short by ' + (c.dc - sum) + '</span>') : '') + '</span>';
      if (c.dc != null && c.dcMode === 'each') foot += '<span>Successes <b>' + rolls.filter((r) => r.total >= c.dc).length + '/' + keys.length + '</b></span>';
    }
    const dc = c.dc != null ? ' · DC <b>' + c.dc + '</b>' + (c.dcMode === 'sum' ? ' (sum)' : '') : '';
    return '<div class="dg-chk' + (open ? ' open' : '') + '"><div class="dg-h"><b>' + hhmm(c.at) + '</b>' + dc + '<span class="sp"></span>'
      + (open ? '<button type="button" data-close="1" title="Close the windows on the players\' screens">Close</button>' : '') + '</div>'
      + keys.map((k) => rowHtml(k, c.items[k], c, seen && c.items[k].roll && !seen[c.id + k])).join('')
      + (foot ? '<div class="dg-f">' + foot + '</div>' : '') + '</div>';
  }

  /* ---------- the SKILL CHECK window (one per page) ---------- */
  let modal = null, mState = null, mAct = null, sel = {}, skillOf = {}, dcMode = 'each';
  function openWindow(state, act) {
    css();
    mState = state; mAct = act;
    if (!modal) {
      modal = document.createElement('div'); modal.className = 'dg dg-modal'; modal.hidden = true;
      document.body.appendChild(modal);
      modal.addEventListener('click', onModalClick);
      modal.addEventListener('change', onModalChange);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal && !modal.hidden) modal.hidden = true; });
    }
    const taken = ((state && state.players) || {}).taken || [];
    sel = {};
    C.PCS.forEach((k) => { sel[k] = taken.indexOf(k) >= 0; skillOf[k] = store.get('m1_dg_skill_' + k, skillOf[k] || ''); });
    if (!C.PCS.some((k) => sel[k])) C.PCS.forEach((k) => { sel[k] = true; });
    dcMode = store.get('m1_dg_dcmode', 'each') === 'sum' ? 'sum' : 'each';
    paintWindow();
    modal.hidden = false;
  }
  const opts = (cur) => '<option value="">— skill —</option>' + C.SKILLS.map((s) => '<option' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
  function paintWindow() {
    const taken = ((mState && mState.players) || {}).taken || [];
    modal.innerHTML = '<div class="dg-win" role="dialog" aria-label="Skill check"><h2>SKILL CHECK</h2>'
      + '<div class="sub">Click a portrait to select or deselect. Selected players get a "Roll for …" window; everyone sees the dice.</div>'
      + '<div class="dg-tools"><label>Same skill for all <select data-all>' + opts('') + '</select></label>'
      + '<button type="button" data-preset="open" title="Müne Investigation · Askii Intelligence · Angèle Persuasion · Pryah Intimidation · Bardik Insight">Opening checks</button>'
      + '<span style="flex:1"></span><label>DC <input type="number" min="1" max="300" placeholder="none" data-dc value="' + esc(store.get('m1_dg_dc', '')) + '"></label>'
      + '<span class="dg-seg"><button type="button" data-mode="each" class="' + (dcMode === 'each' ? 'on' : '') + '" title="Each roll is judged against the DC: pass/fail and successes">each roll</button>'
      + '<button type="button" data-mode="sum" class="' + (dcMode === 'sum' ? 'on' : '') + '" title="The sum of all rolls is judged against the DC (group roll)">the sum</button></span></div>'
      + '<div class="dg-pcs">' + C.PCS.map((k) => {
        const here = taken.indexOf(k) >= 0;
        return '<div class="dg-pc' + (sel[k] ? ' sel' : '') + '" data-k="' + k + '" style="--dc:' + DIE_COLOR[k] + '">'
          + '<button type="button" class="pt" data-tog="' + k + '" aria-pressed="' + !!sel[k] + '"><img src="' + tokenSrc(k) + '" alt=""><i>' + (sel[k] ? '✓' : '+') + '</i></button>'
          + '<div class="nm">' + esc(C.BY_KEY[k].name) + '</div><div class="tag' + (here ? ' ok' : '') + '">' + (here ? 'at the table' : 'not at the table') + '</div>'
          + '<select data-skill="' + k + '"' + (sel[k] ? '' : ' disabled') + '>' + opts(skillOf[k]) + '</select></div>';
      }).join('') + '</div>'
      + '<div class="dg-go"><span class="why"></span><button type="button" class="cancel" data-cancel>Cancel</button><button type="button" class="ask" data-ask>Ask for the roll</button></div></div>';
    paintGo();
  }
  function paintGo() {
    const chosen = C.PCS.filter((k) => sel[k]);
    const missing = chosen.filter((k) => !skillOf[k]);
    const why = !chosen.length ? 'Select at least one player.' : missing.length ? 'Pick a skill for ' + missing.map((k) => C.BY_KEY[k].name).join(', ') + '.' : '';
    modal.querySelector('.why').textContent = why;
    modal.querySelector('[data-ask]').disabled = !!why;
  }
  function onModalClick(e) {
    if (e.target === modal || e.target.closest('[data-cancel]')) { modal.hidden = true; return; }
    const t = e.target.closest('[data-tog]');
    if (t) { const k = t.dataset.tog; sel[k] = !sel[k]; keepDc(); paintWindow(); return; }
    const m = e.target.closest('[data-mode]');
    if (m) { dcMode = m.dataset.mode; store.set('m1_dg_dcmode', dcMode); keepDc(); paintWindow(); return; }
    if (e.target.closest('[data-preset]')) {
      C.PCS.forEach((k) => { if (sel[k]) { skillOf[k] = C.OPENING_CHECKS[k]; store.set('m1_dg_skill_' + k, skillOf[k]); } });
      keepDc(); paintWindow(); return;
    }
    if (e.target.closest('[data-ask]')) {
      const items = {};
      C.PCS.forEach((k) => { if (sel[k] && skillOf[k]) items[k] = skillOf[k]; });
      const dcv = modal.querySelector('[data-dc]').value.trim();
      store.set('m1_dg_dc', dcv);
      mAct({ action: 'check', items, dc: dcv === '' ? null : Number(dcv), dcMode });
      modal.hidden = true;
    }
  }
  function keepDc() { const i = modal.querySelector('[data-dc]'); if (i) store.set('m1_dg_dc', i.value.trim()); }
  function onModalChange(e) {
    const s = e.target.closest('[data-skill]');
    if (s) { skillOf[s.dataset.skill] = s.value; store.set('m1_dg_skill_' + s.dataset.skill, s.value); paintGo(); return; }
    const a = e.target.closest('[data-all]');
    if (a && a.value) {
      C.PCS.forEach((k) => { if (sel[k]) { skillOf[k] = a.value; store.set('m1_dg_skill_' + k, a.value); } });
      keepDc(); paintWindow();
    }
  }

  /* ---------- a panel: the button + the log ---------- */
  function mount(box, o) {
    css();
    box.classList.add('dg');
    box.innerHTML = '<button type="button" class="dg-btn">🎲 SKILL CHECK</button><div class="dg-log"></div>';
    const log = box.querySelector('.dg-log');
    const seen = {};
    let sig = null, first = true;
    box.querySelector('.dg-btn').onclick = () => openWindow(o.getState(), o.act);
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) o.act({ action: 'checkClose' });
      if (e.target.closest('[data-clear]') && confirm('Clear the roll log?')) o.act({ action: 'diceClear' });
    });
    function update(state) {
      const D = (state && state.dice) || { checks: [], active: null };
      const s = JSON.stringify([D.active, D.checks]);
      if (s === sig) return;
      sig = s;
      const checks = D.checks.slice().reverse();
      log.innerHTML = checks.length ? checks.map((c) => checkHtml(c, D.active, first ? null : seen)).join('')
        + '<button type="button" class="dg-clear" data-clear>Clear the log</button>'
        : '<div class="dg-empty">No rolls yet.</div>';
      checks.forEach((c) => Object.keys(c.items).forEach((k) => { if (c.items[k].roll) seen[c.id + k] = 1; }));
      first = false;
      if (o.onCount) o.onCount(D.active ? 1 : 0);
    }
    return { update };
  }

  /* ---------- the cockpit dock (polls the trial state by itself) ---------- */
  function dock() {
    css();
    const base = root.SYNC_BASE || '';
    const d = document.createElement('div');
    d.className = 'dg dg-dock' + (store.get('m1_dg_dock_min', '0') === '1' ? ' min' : '');
    d.innerHTML = '<div class="dh"><span>🎲 Skill checks</span><span class="n" hidden>open</span><span class="sp"></span><span class="tg">▾</span></div><div class="body"></div>';
    document.body.appendChild(d);
    let state = null;
    const act = async (a) => {
      try {
        const r = await fetch(base + '/trial/act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
        state = await r.json(); panel.update(state);
      } catch (e) {}
    };
    const panel = mount(d.querySelector('.body'), { getState: () => state, act,
      onCount: (n) => { d.querySelector('.n').hidden = !n; } });
    d.style.setProperty('--dg-max', '42vh');
    d.querySelector('.dh').title = 'Show / hide the log';
    d.querySelector('.dh').onclick = () => { d.classList.toggle('min'); store.set('m1_dg_dock_min', d.classList.contains('min') ? '1' : '0'); };
    async function poll() {
      try { const r = await fetch(base + '/trial/state', { cache: 'no-store' }); state = await r.json(); panel.update(state); } catch (e) {}
    }
    poll(); setInterval(poll, 1000);
    return d;
  }

  root.TrialDiceGM = { mount, dock, openWindow };
})(typeof window !== 'undefined' ? window : this);
