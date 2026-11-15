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

  /* ---------- NPC sprites ----------
     Every NPC can have three more pictures on top of their own sprite (2, 3,
     4). The GM uploads them and dresses the NPC in one with a click. They live
     next to the players' emotes (players.emotes / emoteOn), so the stage shows
     them the same way. Players are only ever told about the one an NPC is
     wearing: a "true form" stays hidden until the GM shows it. */
  const NPC_SPRITE_SLOTS = [2, 3, 4];
  const isPC = (k) => PCS.indexOf(k) >= 0;
  const spriteSlots = (k) => (isPC(k) ? EMOTE_SLOTS : BY_KEY[k] ? NPC_SPRITE_SLOTS : []);

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
  /* ---------- credibility & skill checks ----------
     CP = the prosecution's Credibility Points, shown top-right on the players'
     trial screen while the court is in session; the GM moves them ±1.
     A skill check: the GM picks PCs and a skill for each; each picked player
     gets a "Roll for …" window (modifier, Roll / with advantage / with
     disadvantage). The SERVER rolls the d20s, so every screen shows the same
     dice; the GM gets the log (optional DC: each roll, or the sum). */
  const CP_START = 10, CP_MIN = 0, CP_MAX = 20;
  const SKILLS = ['Strength', 'Strength Saving Throw', 'Athletics',
    'Dexterity', 'Dexterity Saving Throw', 'Acrobatics', 'Sleight of Hand', 'Stealth',
    'Constitution', 'Constitution Saving Throw',
    'Intelligence', 'Intelligence Saving Throw', 'Arcana', 'History', 'Investigation', 'Nature', 'Religion',
    'Wisdom', 'Wisdom Saving Throw', 'Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival',
    'Charisma', 'Charisma Saving Throw', 'Deception', 'Intimidation', 'Performance', 'Persuasion']
    .sort((a, b) => a.localeCompare(b, 'en'));
  /* each PC's detective-style opening check (Campaign_Bible §10) */
  const OPENING_CHECKS = { mune: 'Investigation', askii: 'Intelligence', angele: 'Persuasion', pryah: 'Intimidation', bardik: 'Insight' };
  const DICE_KEEP = 12;                    // checks kept in the GM's log
  const ROLL_MODES = ['normal', 'adv', 'dis'];
  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  /* one roll; d20() gives 1..20 (the server passes a crypto one) */
  function makeRoll(mode, mod, d20) {
    mode = ROLL_MODES.indexOf(mode) >= 0 ? mode : 'normal';
    mod = clampInt(mod, -20, 30);
    const dice = mode === 'normal' ? [d20()] : [d20(), d20()];
    const kept = mode === 'adv' ? Math.max(dice[0], dice[1]) : mode === 'dis' ? Math.min(dice[0], dice[1]) : dice[0];
    return { mode, dice, kept, mod, total: kept + mod };
  }
  const isPlayed = (st, key) => st.players.claims ? !!st.players.claims[key] : (st.players.taken || []).indexOf(key) >= 0;
  const activeCheck = (st) => {
    const D = st.dice;
    return D && D.active ? D.checks.find((c) => c.id === D.active) || null : null;
  };
  function cleanCheck(c) {                 // for sanitize (a saved state)
    if (!c || typeof c !== 'object') return null;
    const items = {};
    Object.keys(c.items || {}).forEach((k) => {
      const it = c.items[k];
      if (PCS.indexOf(k) < 0 || !it || SKILLS.indexOf(it.skill) < 0) return;
      const r = it.roll;
      items[k] = { skill: it.skill, absent: !!it.absent, roll: r && Array.isArray(r.dice) ? {
        mode: ROLL_MODES.indexOf(r.mode) >= 0 ? r.mode : 'normal', dice: r.dice.slice(0, 2).map((d) => clampInt(d, 1, 20)),
        kept: clampInt(r.kept, 1, 20), mod: clampInt(r.mod, -20, 30), total: clampInt(r.total, -19, 50), at: Number(r.at) || 0 } : null };
    });
    if (!Object.keys(items).length) return null;
    return { id: clampInt(c.id, 1, 1e9), at: Number(c.at) || 0, dc: c.dc == null ? null : clampInt(c.dc, 1, 300),
      dcMode: c.dcMode === 'sum' ? 'sum' : 'each', items, doneAt: Number(c.doneAt) || 0, closed: !!c.closed };
  }

  /* ---------- slideshows ----------
     The GM builds slideshows (pictures + an optional music file) and plays
     one full screen on the players' trial page — the Closing Argument comic,
     the Punishment. "Give control to…" lets one player's character turn the
     pages while they narrate; the GM can always turn them too.
     Players are only ever told the slides up to the next one (no peeking at
     the execution). The pictures themselves live in trial_slidestore.js. */
  const SHOWS_MAX = 40, SLIDES_MAX = 150;
  const validId = (x) => typeof x === 'string' && /^[a-z0-9]{8,24}$/.test(x);
  const cleanName = (x, d) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, 60) || d;
  const findShow = (st, id) => (st.shows || []).find((x) => x.id === id) || null;
  const AUDIO_MIME = /^audio\/(mpeg|mp3|ogg|wav|x-wav|wave|mp4|aac|x-m4a|webm)$/;
  const IMAGE_MIME = /^image\/(webp|jpeg|png|gif)$/;
  function cleanSlide(x) {
    if (!x || !validId(x.id) || !IMAGE_MIME.test(String(x.mime))) return null;
    return { id: x.id, mime: x.mime, w: clampInt(x.w, 0, 20000), h: clampInt(x.h, 0, 20000) };
  }
  function cleanAudio(x) {
    if (!x || !validId(x.id) || !AUDIO_MIME.test(String(x.mime))) return null;
    return { id: x.id, mime: x.mime, name: cleanName(x.name, 'music'), size: clampInt(x.size, 0, 1e9) };
  }
  function cleanShow(x) {
    if (!x || !validId(x.id)) return null;
    return { id: x.id, name: cleanName(x.name, 'Slideshow'),
      slides: (Array.isArray(x.slides) ? x.slides : []).map(cleanSlide).filter(Boolean).slice(0, SLIDES_MAX),
      audio: cleanAudio(x.audio), loop: !!x.loop, audioAll: x.audioAll !== false };
  }
  /* what the players' screens get while a slideshow plays */
  function slidesPublic(st) {
    const P = st.show, x = P && P.on && findShow(st, P.id);
    if (!x || !x.slides.length) return null;
    return { id: x.id, name: x.name, idx: P.idx, n: x.slides.length, ctrl: P.ctrl, seq: P.seq,
      ids: x.slides.map((sl, i) => (i <= P.idx + 1 ? sl.id : null)),        // up to the next slide only
      audio: x.audio ? x.audio.id : null, music: P.music !== false, audioAll: x.audioAll !== false, loop: !!x.loop, audioAt: P.audioAt };
  }
  /* may a player's browser fetch this file right now? */
  function fileVisible(st, fileId) {
    const v = slidesPublic(st);
    return !!v && (v.ids.indexOf(fileId) >= 0 || v.audio === fileId);
  }

  /* "Wavering" (a juror's Resolve has reached 4 in the GM's tracker): their
     sprite and token tremble. Only an NPC seated on the floor can waver; taking
     a side, leaving the room or a new seating clears it. */
  const canWaver = (st, key) => {
    const c = BY_KEY[key], sid = slotOf(st, key);
    return !!(c && c.group !== 'pc' && sid && SLOT[sid].side !== 'bench');
  };

  /* ---------- BRAINSTORMING ----------
     The banner, then the camera goes up to Polychroma; the GM types her
     question and it shows big on every screen with a countdown. */
  const BRAIN_MS = 60000;                 // the countdown
  const BRAIN_PAN_DELAY = 2300;           // the camera leaves for Polychroma once the banner has played
  const BRAIN_Q_MAX = 280;
  const brainInit = () => ({ on: false, seq: 0, at: 0, q: '', qseq: 0, qAt: 0, ms: BRAIN_MS });

  /* ---------- ABOUT TO TIP: the face-off ----------
     After the banner, the defense and its ally (seats L1, L2) face the five
     PCs. Each round: the GM says who speaks for the defense, a die picks the
     prosecutor who answers (each PC who has not spoken yet owns the same
     number of faces: d10 for five, d12 for four, d6 for three, d20 for two;
     the last one needs no die), then the GM calls BREAK (a Polychroma token
     for the prosecution) or FAIL (one for the defense). First to 3 wins. The
     SERVER rolls (the GM's page sends no face). */
  const FO_WIN = 3;
  const FO_DIE = { 5: 10, 4: 12, 3: 6, 2: 20 };
  const foOwners = (left) => {                     // face i of the die -> the prosecutor on it
    const s = FO_DIE[left.length];
    return s ? Array.from({ length: s }, (_, i) => left[i % left.length]) : [];
  };
  const foInit = () => ({ on: false, seq: 0, at: 0, phase: 'off', def: null, ally: null, pros: [], left: [],
    speaker: null, role: null, pro: null, roll: null, rseq: 0, score: { def: 0, pro: 0 }, log: [], hit: null, hseq: 0, result: null, endAt: 0 });

  /* ---------- trial powers ----------
     The GM writes powers in a table (who grants it, its name, what it does)
     and unlocks one: every player's screen plays "You unlocked …" and it
     becomes a button. A player who clicks it proposes it; every player at the
     table must accept (the proposer already has); one "deny" cancels. Once
     accepted it is used: it leaves their screens and goes back to locked on
     the GM's table. Players only ever see unlocked powers. */
  const POWERS_MAX = 40;
  function cleanPower(x) {
    if (!x || !validId(x.id)) return null;
    return { id: x.id, npc: x.npc && BY_KEY[x.npc] && !isPC(x.npc) ? x.npc : '', name: String(x.name == null ? '' : x.name).slice(0, 60),
      text: String(x.text == null ? '' : x.text).slice(0, 500), on: !!x.on, used: clampInt(x.used, 0, 999) };
  }
  const findPower = (st, id) => (st.powers || []).find((p) => p.id === id) || null;
  const powerName = (p) => String(p.name || '').replace(/\s+/g, ' ').trim();
  const powerSnap = (p) => ({ id: p.id, name: powerName(p) || 'Power', text: String(p.text || '').trim(), npc: p.npc || null });
  /* who is at the table (the server knows the claims; the GM's page only the list) */
  const claimedKeys = (st) => (st.players.claims ? Object.keys(st.players.claims) : (st.players.taken || []).slice());
  /* a vote after something changed: passes once everyone still at the table said yes */
  function voteSettle(st, now) {
    const V = st.vote;
    if (!V || V.state !== 'open') return false;
    const p = findPower(st, V.power);
    if (!p || !p.on) { V.state = 'cancelled'; V.endAt = now; return true; }
    const at = claimedKeys(st);
    if (at.indexOf(V.by) < 0) { V.state = 'withdrawn'; V.endAt = now; return true; }
    V.need = V.need.filter((k) => at.indexOf(k) >= 0);
    if (!V.need.every((k) => V.votes[k] === true)) return false;
    V.state = 'passed'; V.endAt = now;
    p.on = false; p.used = (p.used || 0) + 1;
    st.powerFx = { seq: (st.powerFx.seq || 0) + 1, kind: 'used', power: powerSnap(p), by: V.by, at: now };
    return true;
  }
  function votePublic(st) {
    const V = st.vote;
    if (!V) return null;
    return { id: V.id, power: V.snap, by: V.by, at: V.at, need: V.need.slice(), votes: Object.assign({}, V.votes),
      state: V.state, endAt: V.endAt, deniedBy: V.deniedBy || null };
  }

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
      cp: CP_START,                  // the prosecution's Credibility Points
      shows: [],                     // slideshows: [{ id, name, slides: [{ id, mime, w, h }], audio, loop, audioAll }]
      show: { on: false, id: null, idx: 0, ctrl: null, seq: 0, audioAt: 0, music: true },   // the one playing (a moment, not saved)
      dice: { seq: 0, active: null, checks: [] },   // skill checks (the last DICE_KEEP, newest last)
      brain: brainInit(),            // BRAINSTORMING: Polychroma's question and its countdown (a moment)
      faceoff: foInit(),             // ABOUT TO TIP: the face-off (a moment)
      powers: [],                    // trial powers: [{ id, npc, name, text, on (in the players' hands), used }]
      vote: null,                    // a player proposed a power: everyone at the table votes (a moment)
      powerFx: { seq: 0 },           // "You unlocked …" / "… activated": every screen plays it (a moment)
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
      cp: st.cp == null ? CP_START : st.cp,
      shows: JSON.parse(JSON.stringify(st.shows || [])),
      dice: JSON.parse(JSON.stringify(st.dice || { seq: 0, active: null, checks: [] })),
      powers: (st.powers || []).map(cleanPower).filter(Boolean),
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
    if (raw.cp != null) st.cp = clampInt(raw.cp, CP_MIN, CP_MAX);
    if (Array.isArray(raw.shows)) st.shows = raw.shows.map(cleanShow).filter(Boolean).slice(0, SHOWS_MAX);
    if (raw.dice && Array.isArray(raw.dice.checks)) {
      const checks = raw.dice.checks.map(cleanCheck).filter(Boolean).slice(-DICE_KEEP);
      const seq = Math.max(clampInt(raw.dice.seq, 0, 1e9), checks.reduce((m, c) => Math.max(m, c.id), 0));
      const active = checks.some((c) => c.id === raw.dice.active && !c.closed) ? raw.dice.active : null;
      st.dice = { seq, active, checks };
    }
    const rp = raw.players || {};
    const used = {};
    Object.keys(rp.claims || {}).forEach((k) => {
      const cid = rp.claims[k];
      if (PCS.indexOf(k) >= 0 && validCid(cid) && !used[cid]) { st.players.claims[k] = cid; used[cid] = true; }
    });
    st.players.react = rp.react !== false;
    st.players.speak = rp.speak !== false;
    Object.keys(rp.emotes || {}).forEach((k) => {           // the PCs' emotes and the NPCs' sprites
      spriteSlots(k).forEach((n) => {
        const e = (rp.emotes[k] || {})[n];
        if (e && typeof e === 'object') {
          (st.players.emotes[k] = st.players.emotes[k] || {})[n] =
            { name: String(e.name || '').slice(0, 24), ver: Number(e.ver) || 1 };
        }
      });
    });
    Object.keys(rp.emoteOn || {}).forEach((k) => {
      const n = Number(rp.emoteOn[k]);
      if (BY_KEY[k] && (n === 1 || (st.players.emotes[k] || {})[n])) st.players.emoteOn[k] = n;
    });
    if (Array.isArray(raw.powers)) st.powers = raw.powers.map(cleanPower).filter(Boolean).slice(0, POWERS_MAX);
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

  /* states saved before brainstorming / face-off / powers existed */
  function ensureNew(st) {
    if (!st.brain) st.brain = brainInit();
    if (!st.faceoff) st.faceoff = foInit();
    if (!st.powers) st.powers = [];
    if (st.vote === undefined) st.vote = null;
    if (!st.powerFx) st.powerFx = { seq: 0 };
  }

  /* Applies one GM action. Returns { changed, persist }. Mutates st. */
  function reduce(st, a, now) {
    a = a || {};
    now = now || Date.now();
    if (!st.players) st.players = initialState().players;
    if (!st.waver) st.waver = {};
    if (!st.moves) st.moves = { seq: 0, list: [] };
    if (!st.invite) st.invite = { on: false, at: 0 };
    if (st.cp == null) st.cp = CP_START;
    if (!st.dice) st.dice = { seq: 0, active: null, checks: [] };
    if (!st.shows) st.shows = [];
    if (!st.show) st.show = { on: false, id: null, idx: 0, ctrl: null, seq: 0, audioAt: 0, music: true };
    ensureNew(st);
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
      /* ----- credibility ----- */
      case 'cp': {
        const v = a.set != null ? clampInt(a.set, CP_MIN, CP_MAX) : clampInt(st.cp + clampInt(a.delta, -5, 5), CP_MIN, CP_MAX);
        if (v === st.cp) return { changed: false };
        st.cp = v;
        persist = true;
        break;
      }
      /* ----- skill checks ----- */
      case 'check': {                          // { items: { pryah: 'Insight', … }, dc?, dcMode? }
        const items = {};
        Object.keys(a.items || {}).forEach((k) => {
          if (PCS.indexOf(k) >= 0 && SKILLS.indexOf(a.items[k]) >= 0) items[k] = { skill: a.items[k], absent: !isPlayed(st, k), roll: null };
        });
        if (!Object.keys(items).length) return { changed: false };
        const D = st.dice, prev = activeCheck(st);
        if (prev) prev.closed = true;           // a new check replaces the one still open
        const dc = a.dc == null || a.dc === '' ? null : clampInt(a.dc, 1, 300);
        const c = { id: D.seq + 1, at: now, dc, dcMode: a.dcMode === 'sum' ? 'sum' : 'each', items, doneAt: 0, closed: false };
        D.seq = c.id;
        D.checks = D.checks.concat([c]).slice(-DICE_KEEP);
        D.active = c.id;
        persist = true;
        break;
      }
      case 'diceRolled': {                     // internal: the server rolled for a player
        const c = activeCheck(st), it = c && c.items[a.key];
        if (!it || it.roll || !a.roll) return { changed: false };
        it.roll = Object.assign({}, a.roll, { at: now });
        it.absent = false;
        const waiting = Object.keys(c.items).filter((k) => !c.items[k].roll && !c.items[k].absent);
        if (!waiting.length) c.doneAt = now;
        persist = true;
        break;
      }
      case 'checkClose': {                     // the GM ends the check: the windows close everywhere
        const c = activeCheck(st);
        if (!c) return { changed: false };
        c.closed = true;
        st.dice.active = null;
        persist = true;
        break;
      }
      case 'diceClear':                        // empties the log (keeps a check still open)
        st.dice.checks = st.dice.checks.filter((c) => c.id === st.dice.active);
        persist = true;
        break;
      /* ----- slideshows: the editor ----- */
      case 'showNew': {
        if (!validId(a.id) || findShow(st, a.id) || st.shows.length >= SHOWS_MAX) return { changed: false };
        st.shows.push({ id: a.id, name: cleanName(a.name, 'Slideshow'), slides: [], audio: null, loop: false, audioAll: true });
        persist = true;
        break;
      }
      case 'showEdit': {                       // { id, name?, loop?, audioAll? }
        const x = findShow(st, a.id);
        if (!x) return { changed: false };
        if (a.name != null) x.name = cleanName(a.name, x.name);
        if (a.loop != null) x.loop = !!a.loop;
        if (a.audioAll != null) x.audioAll = !!a.audioAll;
        persist = true;
        break;
      }
      case 'showDelete': {
        const i = st.shows.findIndex((x) => x.id === a.id);
        if (i < 0) return { changed: false };
        st.shows.splice(i, 1);
        if (st.show.id === a.id) st.show.on = false;
        persist = true;
        break;
      }
      case 'slideAdded': {                     // the server stored a picture: { id, slide }
        const x = findShow(st, a.id), sl = cleanSlide(a.slide);
        if (!x || !sl || x.slides.length >= SLIDES_MAX || x.slides.some((y) => y.id === sl.id)) return { changed: false };
        x.slides.push(sl);
        persist = true;
        break;
      }
      case 'slideOrder': {                     // { id, order: [slide ids] } — a new order of the same slides
        const x = findShow(st, a.id), o = Array.isArray(a.order) ? a.order : [];
        if (!x || o.length !== x.slides.length) return { changed: false };
        const by = {}; x.slides.forEach((y) => { by[y.id] = y; });
        if (o.some((k) => !by[k]) || new Set(o).size !== o.length) return { changed: false };
        const cur = x.slides[st.show.on && st.show.id === x.id ? st.show.idx : -1];
        x.slides = o.map((k) => by[k]);
        if (cur) st.show.idx = x.slides.indexOf(cur);
        persist = true;
        break;
      }
      case 'slideDelete': {
        const x = findShow(st, a.id), i = x ? x.slides.findIndex((y) => y.id === a.slide) : -1;
        if (i < 0) return { changed: false };
        x.slides.splice(i, 1);
        if (st.show.on && st.show.id === x.id) {
          if (!x.slides.length) st.show.on = false;
          else if (st.show.idx >= i) { st.show.idx = Math.max(0, Math.min(x.slides.length - 1, st.show.idx - (st.show.idx > i ? 1 : 0))); st.show.seq++; }
        }
        persist = true;
        break;
      }
      case 'audioSet': {                       // the server stored a music file: { id, audio }
        const x = findShow(st, a.id);
        if (!x) return { changed: false };
        x.audio = a.audio ? cleanAudio(a.audio) : null;
        persist = true;
        break;
      }
      /* ----- slideshows: playing ----- */
      case 'play': {
        const x = findShow(st, a.id);
        if (!x || !x.slides.length) return { changed: false };
        st.show = { on: true, id: x.id, idx: clampInt(a.idx, 0, x.slides.length - 1), ctrl: st.show.ctrl || null,
          seq: (st.show.seq || 0) + 1, audioAt: now, music: true };
        break;
      }
      case 'slideGo': {                        // { delta: ±1 } or { to }
        const P = st.show, x = P.on && findShow(st, P.id);
        if (!x) return { changed: false };
        const to = clampInt(a.to != null ? a.to : P.idx + clampInt(a.delta, -1, 1), 0, x.slides.length - 1);
        if (to === P.idx) return { changed: false };
        P.idx = to; P.seq++;
        break;
      }
      case 'slideCtrl': {                      // "Give control to…": a PC key, or null = only the GM
        const k = a.key && PCS.indexOf(a.key) >= 0 ? a.key : null;
        if (st.show.ctrl === k) return { changed: false };
        st.show.ctrl = k;
        break;
      }
      case 'music': {                          // { on } — mute / unmute; { restart: true } — from the top
        if (a.restart) st.show.audioAt = now;
        else st.show.music = !!a.on;
        break;
      }
      case 'stop':
        if (!st.show.on) return { changed: false };
        st.show.on = false;
        break;
      /* ----- the GM and the players ----- */
      case 'release': {                        // GM frees a claimed character
        const cl = st.players.claims;
        if (cl && cl[a.key]) delete cl[a.key];
        if (Array.isArray(st.players.taken)) st.players.taken = st.players.taken.filter((k) => k !== a.key);   // GM's own copy
        else if (!cl) return { changed: false };
        voteSettle(st, now);                   // they may have been the last one the vote waited for
        persist = true;
        break;
      }
      /* ----- NPC sprites (the pictures themselves: trial_server.js, 'npcSpriteSave') ----- */
      case 'npcSprite': {                      // the GM dresses an NPC: { key, n } (1 = their own sprite)
        const k = String(a.key || ''), n = Number(a.n);
        if (!BY_KEY[k] || isPC(k)) return { changed: false };
        if (n !== 1 && !(st.players.emotes[k] || {})[n]) return { changed: false };
        if ((st.players.emoteOn[k] || 1) === n) return { changed: false };
        st.players.emoteOn[k] = n;
        persist = true;
        break;
      }
      case 'npcSpriteDelete': {                // { key, n }
        const k = String(a.key || ''), n = Number(a.n), m = st.players.emotes[k];
        if (!BY_KEY[k] || isPC(k) || !m || !m[n]) return { changed: false };
        delete m[n];
        if (!Object.keys(m).length) delete st.players.emotes[k];
        if (st.players.emoteOn[k] === n) st.players.emoteOn[k] = 1;
        persist = true;
        break;
      }
      /* ----- BRAINSTORMING ----- */
      case 'brainstorm': {                     // the banner, then the camera goes up to Polychroma
        st.fx = { kind: 'brainstorm', text: String(a.text || '').slice(0, 80), key: null, seq: st.fx.seq + 1, at: now };
        st.brain = Object.assign(brainInit(), { on: true, seq: (st.brain.seq || 0) + 1, at: now, qseq: st.brain.qseq || 0 });
        if (slotOf(st, 'polychroma')) st.focus = { key: 'polychroma', seq: st.focus.seq + 1, at: now, delay: BRAIN_PAN_DELAY };
        break;
      }
      case 'brainQ': {                         // { text }: the question goes up, the countdown starts
        const q = String(a.text || '').replace(/\s+/g, ' ').trim().slice(0, BRAIN_Q_MAX);
        if (!q) return { changed: false };
        if (!st.brain.on) st.brain = Object.assign(brainInit(), { on: true, seq: (st.brain.seq || 0) + 1, at: now, qseq: st.brain.qseq || 0 });
        Object.assign(st.brain, { q, qseq: (st.brain.qseq || 0) + 1, qAt: now, ms: BRAIN_MS });
        break;
      }
      case 'brainTime': {                      // { restart: true } or { add: ms }
        const B = st.brain;
        if (!B.on || !B.q) return { changed: false };
        if (a.restart) { B.qAt = now; B.ms = BRAIN_MS; break; }
        const add = clampInt(a.add, 5000, 120000);
        if (B.qAt + B.ms <= now) { B.qAt = now; B.ms = add; }       // time was up: a fresh little countdown
        else B.ms = Math.min(10 * 60000, B.ms + add);
        break;
      }
      case 'brainEnd':
        if (!st.brain.on) return { changed: false };
        st.brain.on = false;
        break;
      /* ----- ABOUT TO TIP: the face-off ----- */
      case 'faceoff': {                        // the banner (the GM's words if any), then the face-off
        st.fx = { kind: 'tip', text: String(a.text || '').slice(0, 80), key: null, seq: st.fx.seq + 1, at: now };
        const def = st.slots.L1 || null, ally = st.slots.L2 || null, F = st.faceoff;
        if (!def && !ally) break;                // nobody defends: the banner only
        if (F.on && F.phase !== 'end') break;    // one is running: the banner only (✕ Stop first to start again)
        st.faceoff = Object.assign(foInit(), { on: true, seq: F.seq + 1, at: now, phase: 'defense', def, ally,
          pros: PCS.slice(), left: PCS.slice(), rseq: F.rseq, hseq: F.hseq });
        break;
      }
      case 'foSpeak': {                        // { who: 'def' | 'ally' } — who speaks for the defense
        const F = st.faceoff, k = a.who === 'ally' ? F.ally : F.def;
        if (!F.on || !k || (F.phase !== 'defense' && F.phase !== 'roll')) return { changed: false };
        F.speaker = k; F.role = a.who === 'ally' ? 'ally' : 'def';
        if (F.left.length === 1) {               // the last prosecutor: no die
          F.pro = F.left[0]; F.rseq++;
          F.roll = { auto: true, key: F.pro, at: now, seq: F.rseq };
          F.phase = 'duel';
        } else F.phase = 'roll';
        break;
      }
      case 'foRoll': {                         // internal: the server rolled { face }
        const F = st.faceoff, owners = foOwners(F.left), face = Number(a.face);
        if (!F.on || F.phase !== 'roll' || !owners.length || !(face >= 0 && face < owners.length && face % 1 === 0)) return { changed: false };
        F.pro = owners[face]; F.rseq++;
        F.roll = { sides: owners.length, owners, face, key: F.pro, at: now, seq: F.rseq };
        F.phase = 'duel';
        break;
      }
      case 'foResult': {                       // { r: 'break' | 'fail' }
        const F = st.faceoff, r = a.r === 'fail' ? 'fail' : 'break', side = r === 'break' ? 'pro' : 'def';
        if (!F.on || F.phase !== 'duel' || !F.pro) return { changed: false };
        F.score[side]++;
        F.log.push({ speaker: F.speaker, role: F.role, pro: F.pro, r });
        F.left = F.left.filter((k) => k !== F.pro);
        F.hseq++;
        F.hit = { r, side, at: now, seq: F.hseq, pro: F.pro, speaker: F.speaker };
        if (F.score[side] >= FO_WIN || !F.left.length) {
          F.phase = 'end'; F.result = F.score.pro > F.score.def ? 'pro' : 'def'; F.endAt = now;
        } else { F.phase = 'defense'; F.speaker = null; F.role = null; F.pro = null; F.roll = null; }
        break;
      }
      case 'foUndo': {                         // takes back the last BREAK / FAIL
        const F = st.faceoff;
        if (!F.on || !F.log.length) return { changed: false };
        const L = F.log.pop();
        F.score[L.r === 'break' ? 'pro' : 'def']--;
        F.left = F.pros.filter((k) => k === L.pro || F.left.indexOf(k) >= 0);
        Object.assign(F, { phase: 'duel', speaker: L.speaker, role: L.role, pro: L.pro, roll: null, hit: null, result: null, endAt: 0 });
        break;
      }
      case 'foStop':
        if (!st.faceoff.on) return { changed: false };
        st.faceoff.on = false;
        break;
      /* ----- trial powers ----- */
      case 'powerAdd': {                       // { id, npc? }
        if (!validId(a.id) || findPower(st, a.id) || st.powers.length >= POWERS_MAX) return { changed: false };
        st.powers.push(cleanPower({ id: a.id, npc: a.npc }));
        persist = true;
        break;
      }
      case 'powerEdit': {                      // { id, npc?, name?, text? }
        const p = findPower(st, a.id);
        if (!p) return { changed: false };
        const q = cleanPower(Object.assign({}, p, a.npc != null ? { npc: a.npc } : {}, a.name != null ? { name: a.name } : {}, a.text != null ? { text: a.text } : {}));
        Object.assign(p, { npc: q.npc, name: q.name, text: q.text });
        if (st.vote && st.vote.state === 'open' && st.vote.power === p.id) st.vote.snap = powerSnap(p);
        persist = true;
        break;
      }
      case 'powerDelete': {
        const i = st.powers.findIndex((p) => p.id === a.id);
        if (i < 0) return { changed: false };
        st.powers.splice(i, 1);
        voteSettle(st, now);
        persist = true;
        break;
      }
      case 'powerUnlock': {                    // into the players' hands, with "You unlocked …" on every screen
        const p = findPower(st, a.id);
        if (!p || p.on || !powerName(p)) return { changed: false };
        p.on = true;
        st.powerFx = { seq: (st.powerFx.seq || 0) + 1, kind: 'unlock', power: powerSnap(p), at: now };
        persist = true;
        break;
      }
      case 'powerLock': {                      // the GM takes it back (no animation)
        const p = findPower(st, a.id);
        if (!p || !p.on) return { changed: false };
        p.on = false;
        voteSettle(st, now);
        persist = true;
        break;
      }
      case 'voteCancel':
        if (!st.vote || st.vote.state !== 'open') return { changed: false };
        st.vote.state = 'cancelled'; st.vote.endAt = now;
        break;
      case 'allowReact':
        st.players.react = !!a.on;
        persist = true;
        break;
      case 'allowSpeak':
        st.players.speak = !!a.on;
        persist = true;
        break;
      case 'emoteReset':                       // GM puts someone back on their own sprite
        if (!BY_KEY[a.key]) return { changed: false };
        st.players.emoteOn[a.key] = 1;
        persist = true;
        break;
      case 'emoteStored': {                    // internal: the server has stored the picture (a PC's emote or an NPC's sprite)
        if (spriteSlots(a.key).indexOf(Number(a.n)) < 0) return { changed: false };
        const m = (st.players.emotes[a.key] = st.players.emotes[a.key] || {});
        const prev = m[a.n];
        // a new version number even after a delete, so no browser shows the old picture from its cache
        m[a.n] = { name: String(a.name || '').slice(0, 24), ver: Math.max((prev ? prev.ver : 0) + 1, Math.floor(now / 1000) % 1e9) };
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
    ensureNew(st);
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
        voteSettle(st, now);
        persist = true;
        break;
      }
      case 'unclaim':
        if (!mine) return { changed: false };
        delete P.claims[mine];
        voteSettle(st, now);
        persist = true;
        break;
      /* ----- trial powers: propose one, vote ----- */
      case 'propose': {                      // { id }
        if (!mine) return { changed: false, error: 'pick a character first' };
        const p = findPower(st, a.id);
        if (!p || !p.on) return { changed: false, error: 'this power is not in your hands' };
        if (st.vote && st.vote.state === 'open') return { changed: false, error: 'a vote is already open' };
        st.vote = { id: (st.vote ? st.vote.id : 0) + 1, power: p.id, snap: powerSnap(p), by: mine, at: now,
          need: claimedKeys(st), votes: { [mine]: true }, state: 'open', endAt: 0, deniedBy: null };
        persist = voteSettle(st, now) && st.vote.state === 'passed';     // alone at the table: it passes at once
        break;
      }
      case 'vote': {                         // { yes: true | false }
        const V = st.vote;
        if (!mine) return { changed: false, error: 'pick a character first' };
        if (!V || V.state !== 'open') return { changed: false, error: 'no vote is open' };
        if (V.need.indexOf(mine) < 0) return { changed: false, error: 'you joined after this vote started' };
        if (V.votes[mine] != null) return { changed: false };
        if (a.yes) { V.votes[mine] = true; persist = voteSettle(st, now) && V.state === 'passed'; }
        else { V.votes[mine] = false; V.state = 'denied'; V.deniedBy = mine; V.endAt = now; }
        break;
      }
      case 'withdraw': {                     // the proposer takes it back
        const V = st.vote;
        if (!V || V.state !== 'open' || V.by !== mine) return { changed: false };
        V.state = 'withdrawn'; V.endAt = now;
        break;
      }
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
      case 'slide': {                        // the presenter turns the page: { delta: ±1 }
        const S = st.show, x = S && S.on && findShow(st, S.id);
        if (!x) return { changed: false, error: 'no slideshow is playing' };
        if (!mine || S.ctrl !== mine) return { changed: false, error: 'the GM has not handed you the slideshow' };
        const to = clampInt(S.idx + clampInt(a.delta, -1, 1), 0, x.slides.length - 1);
        if (to === S.idx) return { changed: false };
        S.idx = to; S.seq++;
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
     emotes, and — for the asking player only — which character is theirs.
     NPC sprites: players only learn about the one an NPC is wearing; the GM
     (gm = true) gets them all, with their names. */
  function playersPublic(st, cid, gm) {
    const P = st.players;
    const emotes = {};
    Object.keys(P.emotes).forEach((k) => {
      let list = spriteSlots(k).filter((n) => P.emotes[k][n]).map((n) => ({ n, name: P.emotes[k][n].name, ver: P.emotes[k][n].ver }));
      if (!gm && !isPC(k)) list = list.filter((e) => e.n === P.emoteOn[k]).map((e) => ({ n: e.n, ver: e.ver }));
      if (list.length || isPC(k)) emotes[k] = list;
    });
    return { taken: Object.keys(P.claims), mine: claimOf(st, cid), react: P.react !== false, speak: P.speak !== false,
      emotes, emoteOn: Object.assign({}, P.emoteOn) };
  }
  /* what the players' screens get of the trial powers: only those in their hands */
  function powersPublic(st) {
    return (st.powers || []).filter((p) => p.on && powerName(p)).map(powerSnap);
  }

  /* The open check, as the table sees it: who rolls what, and the dice once
     thrown. No DC (that stays with the GM). */
  function dicePublic(st) {
    const c = activeCheck(st);
    if (!c) return { check: null };
    const items = {};
    Object.keys(c.items).forEach((k) => { const it = c.items[k]; items[k] = { skill: it.skill, absent: it.absent, roll: it.roll }; });
    return { check: { id: c.id, at: c.at, doneAt: c.doneAt, items } };
  }

  /* Players get nothing about the room until the court is open. Skill checks
     work either way (the hourglass page uses them too). */
  function playerView(st, now, cid) {
    ensureNew(st);
    const players = playersPublic(st, cid);
    const dice = dicePublic(st);
    const slides = slidesPublic(st);
    const powers = powersPublic(st), vote = votePublic(st), powerFx = st.powerFx;
    if (!st.open) return { rev: st.rev, open: false, serverNow: now, players, dice, slides, powers, vote, powerFx };
    return {
      rev: st.rev, open: true, route: st.route,
      slots: st.slots, focus: st.focus, fx: st.fx, sweep: st.sweep,
      waver: st.waver || {}, moves: st.moves || { seq: 0, list: [] }, serverNow: now, players, dice, slides,
      cp: st.cp == null ? CP_START : st.cp,
      brain: st.brain, faceoff: st.faceoff, powers, vote, powerFx,
    };
  }

  /* The GM sees everything except the players' private ids. */
  function gmView(st, now) {
    ensureNew(st);
    const out = Object.assign({}, st, { serverNow: now });
    out.players = playersPublic(st, null, true);
    return out;
  }

  const api = {
    CAST, BY_KEY, SLOTS, SLOT, LINE, BENCH, RING, PROSECUTION_CORE, FX_KINDS, PCS, EMOTE_SLOTS, REACT_COOLDOWN, SPEAK_COOLDOWN,
    initialState, persistable, sanitize, reduce, playerAct, playerView, gmView, playersPublic, slotOf, claimOf, validCid,
    sideShift, canWaver,
    CP_START, CP_MIN, CP_MAX, SKILLS, OPENING_CHECKS, ROLL_MODES, makeRoll, activeCheck, dicePublic,
    SLIDES_MAX, IMAGE_MIME, AUDIO_MIME, validId, findShow, slidesPublic, fileVisible,
    NPC_SPRITE_SLOTS, spriteSlots, isPC,
    BRAIN_MS, BRAIN_Q_MAX, BRAIN_PAN_DELAY,
    FO_WIN, FO_DIE, foOwners,
    POWERS_MAX, findPower, powerSnap, powersPublic, votePublic, claimedKeys,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TrialCore = api;
})(typeof window !== 'undefined' ? window : this);
