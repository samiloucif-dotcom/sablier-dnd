/*
 * trial_core.js — Class Trial stage: cast, courtroom slots, camera order, the
 * state reducer and the player actions. Shared by the server (require) and the
 * pages (<script>).
 *
 * PUBLIC FILE: players' browsers load it. Never put GM-only information here
 * (no hidden identities, no juror stats). Names, sprite files and sides only.
 *
 * Courtroom, seen from above on the GM dashboard:
 *
 *                 T1  T2  T3                    (bench)
 *   L1 defense                       R1 ┐
 *   L2 support                       R2 │ prosecution (the 5 PCs)
 *   L3..L11 (joined the defense)     R3 │
 *                                    R4 │
 *                                    R5 ┘
 *                                    R6..R14 (joined the prosecution)
 *          B1  B2  B3  B4  B5  B6  B7  B8  B9   (jury, one line)
 *
 * On the players' screen the courtroom is a stage seen from the front:
 * defense on the left, the jury in the centre, the prosecution on the right, and
 * the bench (Polychroma and her two specialists) raised above the jury.
 * The camera pans left/right along that line and tilts up to the bench, so
 * jury → Polychroma goes straight up and prosecution → Polychroma goes
 * diagonally up-left. Only occupied seats take a place on the line.
 */
(function (root) {
  'use strict';

  /* ---------- the cast ----------
     key     stable id (files: sprites/<key>.webp, tokens/<token>)
     h       height on stage in world units (1.75 = a human) — evens out the art
     lift    float above the floor (fairies), world units
     cutin   full-screen COUNTER art in cutins/<key>.webp                      */
  const CAST = [
    // the five players
    { key: 'askii',  name: 'Askii',   group: 'pc', token: 'token_askii.webp',       h: 1.85, cutin: true },
    { key: 'bardik', name: 'Bardik',  group: 'pc', token: 'token_bardik.webp',      h: 1.75, cutin: true },
    { key: 'angele', name: 'Angèle',  group: 'pc', token: 'token_angele.webp',      h: 1.72, cutin: true },
    { key: 'mune',   name: 'Müne',    group: 'pc', token: 'token_müne.webp',        h: 1.82, cutin: true },
    { key: 'pryah',  name: 'Pryah',   group: 'pc', token: 'token_pryah_final.webp', h: 1.76, cutin: true },
    // the other Primes
    { key: 'balerion',    name: 'Balerion',    group: 'prime', token: 'token_balerion.webp',    h: 1.86 },
    { key: 'carnage',     name: 'Carnage',     group: 'prime', token: 'token_carnage.webp',     h: 1.95 },
    { key: 'citello',     name: 'Citello',     group: 'prime', token: 'token_citello.webp',     h: 1.72 },
    { key: 'doulahex',    name: "Doula'hex",   group: 'prime', token: 'token_doulahex.webp',    h: 1.84 },
    { key: 'esteban',     name: 'Esteban',     group: 'prime', token: 'token_esteban.webp',     h: 1.80 },
    { key: 'framschtak',  name: 'Framschtak',  group: 'prime', token: 'token_framschtak.webp',  h: 1.58 },
    { key: 'gasper',      name: 'Gasper',      group: 'prime', token: 'token_gasper.webp',      h: 1.56 },
    { key: 'hayeva',      name: 'Hayeva',      group: 'prime', token: 'token_hayeva.webp',      h: 1.76 },
    { key: 'nerasho',     name: 'Nerasho',     group: 'prime', token: 'token_nerasho.webp',     h: 1.74 },
    { key: 'norvodavius', name: 'Norvodavius', group: 'prime', token: 'token_norvodavius.webp', h: 1.80 },
    { key: 'paxel',       name: 'Paxel',       group: 'prime', token: 'token_paxel.webp',       h: 1.82 },
    // staff & entities
    { key: 'polychroma', name: 'Polychroma',   group: 'staff', token: 'token_polychroma.webp',  h: 1.30, lift: 0.38 },
    { key: 'aesterias',  name: 'Aesterias',    group: 'staff', token: 'token_aesterias.webp',   h: 1.95 },
    { key: 'maevis',     name: 'Mrs Maevis',   group: 'staff', token: 'token_maevis.webp',      h: 1.22, lift: 0.45 },
    { key: 'myst',       name: 'Myst & Alky',  group: 'staff', token: 'token_alky_and_myst.webp', h: 1.42, lift: 0.12 },
    { key: 'eve',        name: 'Djetecht Eve', group: 'staff', token: 'token_djetecht_eve.webp', h: 1.78 },
    { key: 'sitrip',     name: 'Sitrip Ayo',   group: 'staff', token: 'token_sitrip_ayo.webp',  h: 1.36, lift: 0.18 },
    { key: 'jacques',    name: 'Mr Jacques',   group: 'staff', token: 'token_mr_jacque.webp',   h: 1.78 },
  ];
  const BY_KEY = {};
  CAST.forEach((c) => { BY_KEY[c.key] = c; });

  /* ---------- the slots ---------- */
  const SLOTS = [];
  const add = (id, side, label, major) => SLOTS.push({ id, side, label, major: !!major });
  ['T1', 'T2', 'T3'].forEach((id) => add(id, 'bench', 'Bench', true));
  add('L1', 'defense', 'Defense', true);
  add('L2', 'defense', 'Support', true);
  for (let i = 3; i <= 11; i++) add('L' + i, 'defense', 'Defense', false);
  for (let i = 1; i <= 9; i++) add('B' + i, 'jury', 'Jury', true);
  for (let i = 1; i <= 5; i++) add('R' + i, 'prosecution', 'Prosecution', true);
  for (let i = 6; i <= 14; i++) add('R' + i, 'prosecution', 'Prosecution', false);
  const SLOT = {};
  SLOTS.forEach((s) => { SLOT[s.id] = s; });

  /* The line, left to right on the players' screen: the defense (its two main
     seats on the outside, the jurors who joined it nearer the jury), the jury,
     the prosecution (jurors who joined it nearer the jury, the five PCs on the
     outside). The bench is not on the line: it sits above the jury's centre. */
  const LINE = []
    .concat(range(1, 11).map((i) => 'L' + i))
    .concat(range(1, 9).map((i) => 'B' + i))
    .concat(range(14, 1).map((i) => 'R' + i));
  const BENCH = ['T1', 'T2', 'T3'];       // left, centre, right above the jury
  const RING = LINE.concat(['T3', 'T2', 'T1']);   // kept for older code
  /* The PC group shot: when someone standing in one of these five speaks, the
     other four come in behind them, out of focus. */
  const PROSECUTION_CORE = ['R1', 'R2', 'R3', 'R4', 'R5'];

  function range(a, b) {
    const out = [];
    if (a <= b) for (let i = a; i <= b; i++) out.push(i);
    else for (let i = a; i >= b; i--) out.push(i);
    return out;
  }

  /* Banner styles. Every style takes the GM's own words (a '/' splits two lines);
     with no words it plays its default text. 'custom' is the plain violet slam. */
  const FX_KINDS = ['trial', 'nsd', 'break', 'tip', 'counter', 'agree', 'custom', 'reveal', 'shock', 'whisper', 'reaction'];

  /* ---------- players ----------
     Each player's browser has a random id (kept in its own storage). A player
     claims one of the five PCs; the claim locks that PC for everyone else until
     the player lets go or the GM releases it. */
  const PCS = CAST.filter((c) => c.group === 'pc').map((c) => c.key);
  const EMOTE_SLOTS = [2, 3, 4, 5];       // emote 1 is always the character's own sprite
  const REACT_COOLDOWN = 2500;            // ms between two REACTIONs of the same player
  const SPEAK_COOLDOWN = 1200;            // ms between two SPEAKs of the same player
  const validCid = (cid) => typeof cid === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(cid);

  /* ---------- taking sides ----------
     An NPC (anyone but the five PCs) who goes from one area to another:
       jury → defense        'defense'      "[Name] joined the Defense team"
       jury → prosecution    'prosecution'  "[Name] joined the Prosecution team"
       defense/prosecution → jury  'jury'   "[Name] is back on the Jury pool"
       defense ↔ prosecution 'switch'       "[Name] switched sides!"
     While the court is in session each one becomes a moment every screen
     stages the same way: the camera goes to them, follows them to their new
     seat, and the banner plays. */
  const AREA = { defense: 0, jury: 1, prosecution: 2 };
  function sideShift(key, from, to) {
    const c = BY_KEY[key];
    if (!c || c.group === 'pc' || !from || !to || !SLOT[from] || !SLOT[to]) return null;
    const a = SLOT[from].side, b = SLOT[to].side;
    if (a === b || !(a in AREA) || !(b in AREA)) return null;
    return b === 'jury' ? 'jury' : a === 'jury' ? b : 'switch';
  }
  /* "Wavering" (a juror's Resolve has reached 4 in the GM's tracker): their
     sprite and token tremble. Only an NPC seated on the floor can waver; taking
     a side, leaving the room or a new seating clears it. */
  const canWaver = (st, key) => {
    const c = BY_KEY[key], sid = slotOf(st, key);
    return !!(c && c.group !== 'pc' && sid && SLOT[sid].side !== 'bench');
  };

  function initialState() {
    return {
      v: 1,
      rev: 1,
      open: false,            // players see the waiting screen until the GM opens the court
      route: 'jury',          // 'jury' = between the two sides, always pan along the jury; 'short' = shortest way round
      slots: {},              // slotId -> cast key
      focus: { key: null, seq: 0, at: 0 },
      fx: { kind: null, text: '', key: null, seq: 0, at: 0 },
      sweep: { seq: 0, at: 0 },
      waver: {},              // cast key -> 1: trembling, about to take a side
      moves: { seq: 0, list: [] },   // the last side changes (moments, never saved)
      invite: { on: false, at: 0 },  // "Invite players": the hourglass stops and shows JOIN CLASS TRIAL
      players: { claims: {}, react: true, speak: true, emotes: {}, emoteOn: {}, lastReact: {}, lastSpeak: {} },
      updated: '',
    };
  }

  /* What survives a restart: the room, not the moment. */
  function persistable(st) {
    const p = st.players;
    return {
      v: 1, open: !!st.open, route: st.route, slots: Object.assign({}, st.slots), updated: st.updated,
      waver: Object.assign({}, st.waver || {}),
      invite: { on: !!(st.invite && st.invite.on), at: (st.invite && st.invite.at) || 0 },
      players: { claims: Object.assign({}, p.claims), react: p.react !== false, speak: p.speak !== false,
        emotes: JSON.parse(JSON.stringify(p.emotes)), emoteOn: Object.assign({}, p.emoteOn) },
    };
  }

  function sanitize(raw) {
    const st = initialState();
    if (!raw || typeof raw !== 'object') return st;
    st.open = !!raw.open;
    st.route = raw.route === 'short' ? 'short' : 'jury';
    const seen = {};
    Object.keys(raw.slots || {}).forEach((sid) => {
      const k = raw.slots[sid];
      if (SLOT[sid] && BY_KEY[k] && !seen[k]) { st.slots[sid] = k; seen[k] = true; }
    });
    st.updated = String(raw.updated || '');
    Object.keys(raw.waver || {}).forEach((k) => { if (raw.waver[k] && canWaver(st, k)) st.waver[k] = 1; });
    if (raw.invite && typeof raw.invite === 'object') st.invite = { on: !!raw.invite.on, at: Number(raw.invite.at) || 0 };
    const rp = raw.players || {};
    const used = {};
    Object.keys(rp.claims || {}).forEach((k) => {
      const cid = rp.claims[k];
      if (PCS.indexOf(k) >= 0 && validCid(cid) && !used[cid]) { st.players.claims[k] = cid; used[cid] = true; }
    });
    st.players.react = rp.react !== false;
    st.players.speak = rp.speak !== false;
    Object.keys(rp.emotes || {}).forEach((k) => {
      if (PCS.indexOf(k) < 0) return;
      EMOTE_SLOTS.forEach((n) => {
        const e = (rp.emotes[k] || {})[n];
        if (e && typeof e === 'object') {
          (st.players.emotes[k] = st.players.emotes[k] || {})[n] =
            { name: String(e.name || '').slice(0, 24), ver: Number(e.ver) || 1 };
        }
      });
    });
    Object.keys(rp.emoteOn || {}).forEach((k) => {
      const n = Number(rp.emoteOn[k]);
      if (PCS.indexOf(k) >= 0 && (n === 1 || (st.players.emotes[k] || {})[n])) st.players.emoteOn[k] = n;
    });
    return st;
  }

  function claimOf(st, cid) {
    if (!validCid(cid)) return null;
    for (const k in st.players.claims) if (st.players.claims[k] === cid) return k;
    return null;
  }

  function slotOf(st, key) {
    for (const sid in st.slots) if (st.slots[sid] === key) return sid;
    return null;
  }

  /* Applies one GM action. Returns { changed, persist }. Mutates st. */
  function reduce(st, a, now) {
    a = a || {};
    now = now || Date.now();
    if (!st.players) st.players = initialState().players;
    if (!st.waver) st.waver = {};
    if (!st.moves) st.moves = { seq: 0, list: [] };
    if (!st.invite) st.invite = { on: false, at: 0 };
    let persist = false;
    switch (a.action) {
      case 'place': {
        const key = String(a.key || ''), to = String(a.slot || '');
        if (!BY_KEY[key] || !SLOT[to]) return { changed: false };
        const from = slotOf(st, key);
        if (from === to) return { changed: false };
        const other = st.slots[to] || null;
        st.slots[to] = key;
        if (from) { if (other) st.slots[from] = other; else delete st.slots[from]; }
        else if (other) {                                   // bumped back to the pool
          if (st.focus.key === other) st.focus.key = null;
          delete st.waver[other];
        }
        // taking sides
        const k1 = sideShift(key, from, to), k2 = from && other ? sideShift(other, to, from) : null;
        if (k1) delete st.waver[key];
        if (k2) delete st.waver[other];
        if (st.slots[to] === key && SLOT[to].side === 'bench') delete st.waver[key];
        if (st.open && (k1 || k2)) {
          const one = { key, from, to, kind: k1 };
          const two = from && other ? { key: other, from: to, to: from, kind: k2 } : null;
          const main = k1 ? one : two, mate = k1 ? two : one;
          const id = st.moves.seq + 1;
          st.moves = { seq: id, list: st.moves.list.concat([Object.assign({ id, at: now, with: mate }, main)]).slice(-6) };
          st.focus.key = main.key;     // the camera ends on them; no new focus seq: every screen stages the move itself
        }
        persist = true;
        break;
      }
      case 'unplace': {
        const from = slotOf(st, String(a.key || ''));
        if (!from) return { changed: false };
        delete st.slots[from];
        delete st.waver[a.key];
        if (st.focus.key === a.key) st.focus.key = null;
        persist = true;
        break;
      }
      case 'clear':
        st.slots = {};
        st.waver = {};
        st.focus.key = null;
        persist = true;
        break;
      case 'load': {
        const clean = sanitize({ slots: a.slots, open: st.open, route: st.route });
        st.slots = clean.slots;
        st.waver = {};
        if (st.focus.key && !slotOf(st, st.focus.key)) st.focus.key = null;
        persist = true;
        break;
      }
      case 'waver': {
        const key = String(a.key || '');
        if (a.on) {
          if (!canWaver(st, key) || st.waver[key]) return { changed: false };
          st.waver[key] = 1;
        } else {
          if (!st.waver[key]) return { changed: false };
          delete st.waver[key];
        }
        persist = true;
        break;
      }
      case 'focus': {
        const key = a.key == null ? null : String(a.key);
        if (key !== null && !slotOf(st, key)) return { changed: false };
        st.focus = { key, seq: st.focus.seq + 1, at: now };
        break;
      }
      case 'fx': {
        const kind = FX_KINDS.indexOf(a.kind) >= 0 ? a.kind : 'custom';
        st.fx = {
          kind,
          text: String(a.text || '').slice(0, 80),
          key: a.key && BY_KEY[a.key] ? a.key : null,
          seq: st.fx.seq + 1,
          at: now,
        };
        break;
      }
      case 'sweep':
        st.sweep = { seq: st.sweep.seq + 1, at: now };
        break;
      case 'open':
        st.open = !!a.open;
        persist = true;
        break;
      /* "Invite players": the hourglass page (/) freezes and shows a JOIN CLASS
         TRIAL button that leads to /trial. The server also pauses the hourglass. */
      case 'invite':
        if (!!a.on === !!st.invite.on) return { changed: false };
        st.invite = { on: !!a.on, at: now };
        persist = true;
        break;
      case 'route':
        st.route = a.route === 'short' ? 'short' : 'jury';
        persist = true;
        break;
      /* ----- the GM and the players ----- */
      case 'release': {                        // GM frees a claimed character
        const cl = st.players.claims;
        if (cl && cl[a.key]) delete cl[a.key];
        if (Array.isArray(st.players.taken)) st.players.taken = st.players.taken.filter((k) => k !== a.key);   // GM's own copy
        else if (!cl) return { changed: false };
        persist = true;
        break;
      }
      case 'allowReact':
        st.players.react = !!a.on;
        persist = true;
        break;
      case 'allowSpeak':
        st.players.speak = !!a.on;
        persist = true;
        break;
      case 'emoteReset':                       // GM puts a PC back on their own sprite
        if (PCS.indexOf(a.key) < 0) return { changed: false };
        st.players.emoteOn[a.key] = 1;
        persist = true;
        break;
      case 'emoteStored': {                    // internal: the server has stored the picture
        if (PCS.indexOf(a.key) < 0 || EMOTE_SLOTS.indexOf(Number(a.n)) < 0) return { changed: false };
        const m = (st.players.emotes[a.key] = st.players.emotes[a.key] || {});
        const prev = m[a.n];
        m[a.n] = { name: String(a.name || '').slice(0, 24), ver: (prev ? prev.ver : 0) + 1 };
        persist = true;
        break;
      }
      default:
        return { changed: false };
    }
    st.rev = (st.rev || 0) + 1;
    if (persist) st.updated = new Date(now).toISOString();
    return { changed: true, persist };
  }

  /* What a player may do from /trial. `a.cid` is the player's own id. Returns
     { changed, persist, error } and mutates st. Images are handled by the server
     (it then calls reduce with 'emoteStored'). */
  function playerAct(st, a, now) {
    a = a || {};
    now = now || Date.now();
    const P = st.players;
    if (!validCid(a.cid)) return { changed: false, error: 'no id' };
    const mine = claimOf(st, a.cid);
    let persist = false;
    switch (a.action) {
      case 'claim': {
        const key = String(a.key || '');
        if (PCS.indexOf(key) < 0) return { changed: false, error: 'not a player character' };
        if (P.claims[key] && P.claims[key] !== a.cid) return { changed: false, error: 'taken' };
        if (mine === key) return { changed: false };
        if (mine) delete P.claims[mine];
        P.claims[key] = a.cid;
        persist = true;
        break;
      }
      case 'unclaim':
        if (!mine) return { changed: false };
        delete P.claims[mine];
        persist = true;
        break;
      case 'react': {
        if (!mine) return { changed: false, error: 'pick a character first' };
        if (!st.open) return { changed: false, error: 'the court is not in session' };
        if (P.react === false) return { changed: false, error: 'reactions are off' };
        if (now - (P.lastReact[mine] || 0) < REACT_COOLDOWN) return { changed: false, error: 'too soon' };
        P.lastReact[mine] = now;
        if (slotOf(st, mine)) st.focus = { key: mine, seq: st.focus.seq + 1, at: now };
        st.fx = { kind: 'reaction', text: '', key: mine, seq: st.fx.seq + 1, at: now };
        break;
      }
      case 'speak': {                        // takes the floor: the camera comes to them, no banner
        if (!mine) return { changed: false, error: 'pick a character first' };
        if (!st.open) return { changed: false, error: 'the court is not in session' };
        if (P.speak === false) return { changed: false, error: 'the judge asks you to listen' };
        if (!slotOf(st, mine)) return { changed: false, error: 'your character is not in the courtroom' };
        if (!P.lastSpeak) P.lastSpeak = {};
        if (now - (P.lastSpeak[mine] || 0) < SPEAK_COOLDOWN) return { changed: false, error: 'too soon' };
        P.lastSpeak[mine] = now;
        st.focus = { key: mine, seq: st.focus.seq + 1, at: now };
        break;
      }
      case 'emote': {
        const n = Number(a.n);
        if (!mine) return { changed: false, error: 'pick a character first' };
        if (n !== 1 && !(P.emotes[mine] || {})[n]) return { changed: false, error: 'empty emote' };
        P.emoteOn[mine] = n;
        persist = true;
        break;
      }
      case 'emoteName': {
        const n = Number(a.n), e = (P.emotes[mine] || {})[n];
        if (!mine || !e) return { changed: false };
        e.name = String(a.name || '').slice(0, 24);
        persist = true;
        break;
      }
      case 'emoteDelete': {
        const n = Number(a.n);
        if (!mine || !(P.emotes[mine] || {})[n]) return { changed: false };
        delete P.emotes[mine][n];
        if (P.emoteOn[mine] === n) P.emoteOn[mine] = 1;
        persist = true;
        break;
      }
      default:
        return { changed: false, error: 'unknown action' };
    }
    st.rev = (st.rev || 0) + 1;
    if (persist) st.updated = new Date(now).toISOString();
    return { changed: true, persist };
  }

  /* The public part of the players' state: who is taken (never by whom), the
     emotes, and — for the asking player only — which character is theirs. */
  function playersPublic(st, cid) {
    const P = st.players;
    const emotes = {};
    Object.keys(P.emotes).forEach((k) => {
      emotes[k] = EMOTE_SLOTS.filter((n) => P.emotes[k][n]).map((n) => ({ n, name: P.emotes[k][n].name, ver: P.emotes[k][n].ver }));
    });
    return { taken: Object.keys(P.claims), mine: claimOf(st, cid), react: P.react !== false, speak: P.speak !== false,
      emotes, emoteOn: Object.assign({}, P.emoteOn) };
  }

  /* Players get nothing about the room until the court is open. */
  function playerView(st, now, cid) {
    const players = playersPublic(st, cid);
    if (!st.open) return { rev: st.rev, open: false, serverNow: now, players };
    return {
      rev: st.rev, open: true, route: st.route,
      slots: st.slots, focus: st.focus, fx: st.fx, sweep: st.sweep,
      waver: st.waver || {}, moves: st.moves || { seq: 0, list: [] }, serverNow: now, players,
    };
  }

  /* The GM sees everything except the players' private ids. */
  function gmView(st, now) {
    const out = Object.assign({}, st, { serverNow: now });
    out.players = playersPublic(st, null);
    return out;
  }

  const api = {
    CAST, BY_KEY, SLOTS, SLOT, LINE, BENCH, RING, PROSECUTION_CORE, FX_KINDS, PCS, EMOTE_SLOTS, REACT_COOLDOWN, SPEAK_COOLDOWN,
    initialState, persistable, sanitize, reduce, playerAct, playerView, gmView, playersPublic, slotOf, claimOf, validCid,
    sideShift, canWaver,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TrialCore = api;
})(typeof window !== 'undefined' ? window : this);
