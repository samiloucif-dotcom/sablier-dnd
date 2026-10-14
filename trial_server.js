/*
 * trial_server.js — shared state of the Class Trial stage.
 *
 *   GM dashboard  : GM_PATH/trial        (drag the cast into the courtroom, click to put them on stage)
 *   Players       : /trial               (the stage itself; a waiting screen until the court opens)
 *                   /trial/play  (POST)  (pick a character, REACTION, emotes)
 *                   /trial/emote/<key>/<n>  (the emote pictures players uploaded)
 *
 * The reducer lives in trial_core.js so the dashboard can apply a click instantly
 * and the server stays the single truth. Saved: the room (seats, open/closed,
 * route) and the players' side (who plays whom, their emotes) — locally in
 * trial.json + trial_emotes/, and, when GH_TOKEN is set, on the GitHub "data"
 * branch like timeline.json and board.json. Focus clicks and banners are
 * moments, not data: they are never written anywhere.
 */
const fs = require('fs');
const path = require('path');
const CORE = require('./trial_core.js');
const STORE = require('./store_github.js');

const FILE = path.join(__dirname, 'trial.json');
const STORE_PATH = 'sablier-app/trial.json';
const EMO_DIR = path.join(__dirname, 'trial_emotes');
const EMO_STORE = (id) => 'sablier-app/trial_emotes/' + id + '.json';
const EMO_MAX = 900 * 1024;                 // bytes per picture (the page shrinks them well below this)
const MIME_OK = /^data:(image\/(?:png|webp|jpeg|gif));base64,([A-Za-z0-9+/=]+)$/;

let st = load();
const emo = {};                             // 'pryah_2' -> { mime, buf }
loadLocalEmotes();
let saveTimer = null;
let saveWarned = false;

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const s = CORE.sanitize(raw);
    console.log('  Class Trial stage loaded from trial.json (' + Object.keys(s.slots).length
      + ' placed, court ' + (s.open ? 'OPEN' : 'closed') + ').');
    return s;
  } catch (e) {
    return CORE.initialState();
  }
}

function emoteIds() {
  const ids = [];
  Object.keys(st.players.emotes).forEach((k) => {
    Object.keys(st.players.emotes[k]).forEach((n) => ids.push(k + '_' + n));
  });
  return ids;
}

function loadLocalEmotes() {
  emoteIds().forEach((id) => {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(EMO_DIR, id + '.json'), 'utf8'));
      emo[id] = { mime: j.mime, buf: Buffer.from(j.b64, 'base64') };
    } catch (e) {}
  });
}

function persist() {
  const data = CORE.persistable(st);
  STORE.save(STORE_PATH, data);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmp = FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 1), 'utf8');
      fs.renameSync(tmp, FILE);
      saveWarned = false;
    } catch (e) {
      if (!saveWarned) {
        saveWarned = true;
        console.warn('  /!\\ cannot write trial.json (' + e.code + '). The courtroom stays in memory.');
      }
    }
  }, 400);
}

function saveEmote(id) {
  const e = emo[id];
  const j = { mime: e.mime, b64: e.buf.toString('base64') };
  STORE.save(EMO_STORE(id), j);
  try {
    fs.mkdirSync(EMO_DIR, { recursive: true });
    fs.writeFileSync(path.join(EMO_DIR, id + '.json'), JSON.stringify(j));
  } catch (e2) {}
}

function playerAction(body) {
  body = body || {};
  const now = Date.now();
  if (body.action === 'emoteSave') {
    const key = CORE.claimOf(st, body.cid);
    const n = Number(body.n);
    if (!key) return { ok: false, error: 'pick a character first' };
    if (CORE.EMOTE_SLOTS.indexOf(n) < 0) return { ok: false, error: 'emote 1 is your own sprite' };
    const m = MIME_OK.exec(String(body.data || ''));
    if (!m) return { ok: false, error: 'not a picture (png, webp, jpeg or gif)' };
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > EMO_MAX) return { ok: false, error: 'picture too big' };
    const id = key + '_' + n;
    emo[id] = { mime: m[1], buf };
    saveEmote(id);
    CORE.reduce(st, { action: 'emoteStored', key, n, name: body.name }, now);
    if (body.wear) CORE.playerAct(st, { action: 'emote', cid: body.cid, n }, now);
    persist();
    return { ok: true };
  }
  const r = CORE.playerAct(st, body, now);
  if (r.persist) persist();
  return { ok: !r.error, error: r.error || null };
}

module.exports = {
  /* reload the durable copy (GitHub) over the local one */
  async hydrate() {
    const raw = await STORE.load(STORE_PATH);
    if (raw && raw.slots) {
      const s = CORE.sanitize(raw);
      s.rev = st.rev + 1;
      st = s;
      console.log('  Class Trial stage reloaded from GitHub (' + Object.keys(st.slots).length + ' placed).');
    }
    for (const id of emoteIds()) {
      if (emo[id]) continue;
      const j = await STORE.load(EMO_STORE(id));
      if (j && j.b64) emo[id] = { mime: j.mime, buf: Buffer.from(j.b64, 'base64') };
    }
  },
  gmAction(body) {
    const r = CORE.reduce(st, body, Date.now());
    if (r.persist) persist();
  },
  playerAction,
  gmView() { return CORE.gmView(st, Date.now()); },
  playerView(cid) { return CORE.playerView(st, Date.now(), cid); },
  /* an uploaded emote picture, or null */
  emote(key, n) {
    const e = emo[String(key) + '_' + Number(n)];
    return e && (st.players.emotes[key] || {})[n] ? e : null;
  },
};
