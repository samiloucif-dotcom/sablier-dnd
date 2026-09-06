/*
 * The Chronovestigation Board — etat partage du tableau d'enquete des joueurs.
 *
 * Regles de conception (voir Outil_Enquete_SPEC.md) :
 *  - Le tableau est SCELLE par defaut : tant que board.open est faux, la route
 *    joueur n'existe pas du tout (404). C'est le MJ qui l'ouvre depuis Warden.
 *  - Brouillard de guerre TOTAL : un personnage ou une salle verrouille
 *    n'apparait pas du tout dans la charge utile joueur. Aucun total non plus :
 *    on ne compte jamais ce qui reste, seulement ce que la table possede.
 *  - Les salles voyagent vers les joueurs sous un identifiant opaque (rid) et
 *    leur seul nom lisible est le `label`. L'id MJ ("1 Dorms A (Hayeva ...)")
 *    ne quitte JAMAIS le serveur.
 *  - Le temps est continu : une presence est un intervalle [a,b] en minutes
 *    apres neuf heures, entiers 0..60. Aucune notion de tranche de 5 minutes
 *    ne doit exister de ce cote.
 */

const fs = require('fs');
const path = require('path');
const { M1_LOCATIONS } = require('./locations.js');

const FILE = path.join(__dirname, 'board.json');
const SPAN = 60;                       // 09:00 -> 10:00
const TRUSTS = ['conf', 'rep', 'susp', 'disp'];
const KINDS = ['span', 'clue', 'stmt', 'note'];

let board = null;
let saveTimer = null;
let saveWarned = false;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const iso = () => new Date().toISOString();

function slug(name) {
  return String(name).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '') || 'x';
}

/* ---------- amorce ---------- */
function seed(cols, staffNames) {
  const staff = new Set(staffNames || []);
  const used = {};
  const cast = (cols || []).map((n) => {
    let k = slug(n);
    if (used[k]) k += ++used[k]; else used[k] = 1;
    return { key: k, name: n, staff: staff.has(n), unlocked: false };
  });
  return {
    version: 1,
    open: false,                       // scelle tant que le MJ n'ouvre pas
    loop: 1,
    rev: 1,
    nextId: 1,
    updated: iso(),
    cast,
    rooms: M1_LOCATIONS.map((l, i) => ({ rid: i, id: l.id, label: l.label || l.id, unlocked: false })),
    entries: [],
  };
}

function load(cols, staffNames) {
  try {
    const b = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (b && Array.isArray(b.cast) && Array.isArray(b.entries)) {
      /* les salles suivent toujours locations.js : on re-synchronise labels et ids
         en conservant l'etat deverrouille deja acquis par la table. */
      const wasOpen = {};
      (b.rooms || []).forEach((r) => { if (r.unlocked) wasOpen[r.id] = true; });
      b.rooms = M1_LOCATIONS.map((l, i) => ({ rid: i, id: l.id, label: l.label || l.id, unlocked: !!wasOpen[l.id] }));
      if (typeof b.open !== 'boolean') b.open = false;
      if (!b.nextId) b.nextId = (b.entries.reduce((m, e) => Math.max(m, e.id || 0), 0) || 0) + 1;
      console.log('  Chronovestigation Board charge depuis board.json ('
        + b.entries.filter((e) => !e.dead).length + ' entrees, '
        + (b.open ? 'OUVERT aux joueurs' : 'SCELLE') + ').');
      return b;
    }
  } catch (e) {}
  console.log('  Pas de board.json : tableau d\'enquete neuf, scelle.');
  return seed(cols, staffNames);
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmp = FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(board, null, 1), 'utf8');
      try { fs.copyFileSync(FILE, FILE + '.bak'); } catch (e) {}
      fs.renameSync(tmp, FILE);
      saveWarned = false;
    } catch (e) {
      if (!saveWarned) {
        saveWarned = true;
        console.warn('  /!\\ board.json non enregistrable (' + e.code + ').'
          + ' Le tableau reste en memoire : utilise « Sauvegarde JSON » dans Warden.');
      }
    }
  }, 400);
}

function touch() { board.rev++; board.updated = iso(); persist(); }

/* ---------- lecture ---------- */
const castOf = (k) => board.cast.find((c) => c.key === k);
const roomOf = (rid) => board.rooms[Number(rid)];

/* Ce que voient les JOUEURS. Rien de verrouille n'y figure, sous aucune forme. */
function playerView() {
  const cast = board.cast.filter((c) => c.unlocked).map((c) => ({ key: c.key, name: c.name, staff: !!c.staff }));
  const known = new Set(cast.map((c) => c.key));
  const rooms = board.rooms.filter((r) => r.unlocked).map((r) => ({ rid: r.rid, label: r.label }));
  const seen = new Set(rooms.map((r) => r.rid));
  const entries = board.entries
    .filter((e) => !e.person || known.has(e.person))
    .filter((e) => e.rid == null || seen.has(e.rid))
    .map((e) => ({
      id: e.id, kind: e.kind, person: e.person, a: e.a, b: e.b, rid: e.rid,
      loop: e.loop, trust: e.trust, source: e.source, text: e.text,
      author: e.author, liar: !!e.liar, dead: !!e.dead, fromGm: !!e.fromGm, at: e.at,
    }));
  return { rev: board.rev, open: true, loop: board.loop, cast, rooms, entries, saveOk: !saveWarned };
}

/* Ce que voit le MJ : tout, plus l'etat verrouille et les ids MJ des salles. */
function wardenView() {
  return {
    rev: board.rev, open: board.open, loop: board.loop, updated: board.updated,
    cast: board.cast,
    rooms: board.rooms.map((r) => ({ rid: r.rid, id: r.id, label: r.label, unlocked: r.unlocked,
      etage: (M1_LOCATIONS[r.rid] || {}).etage || '' })),
    entries: board.entries,
    saveOk: !saveWarned,
  };
}

/* ---------- ecriture ---------- */
function newEntry(o) {
  const e = Object.assign({ id: board.nextId++, at: iso(), dead: false, liar: false }, o);
  board.entries.push(e);
  if (board.entries.length > 4000) board.entries.shift();
  return e;
}

/* Actions ouvertes a tout le monde autour de la table : aucun role, aucun
   moderateur. Les joueurs s'organisent entre eux (spec §2, decision 11). */
function tableAction(body) {
  const b = body || {};
  switch (b.action) {
    case 'addSpan': {
      const c = castOf(b.person); const r = roomOf(b.rid);
      if (!c || !c.unlocked || !r || !r.unlocked) return;
      let a = clamp(Math.round(Number(b.a) || 0), 0, SPAN);
      let z = clamp(Math.round(Number(b.b) || 0), 0, SPAN);
      if (z < a) { const t = a; a = z; z = t; }
      if (z - a < 1) return;
      newEntry({
        kind: 'span', person: c.key, a, b: z, rid: r.rid,
        trust: TRUSTS.includes(b.trust) ? b.trust : 'rep',
        source: str(b.source, 120), text: str(b.text, 300),
        author: str(b.author, 40), loop: clamp(Number(b.loop) || board.loop, 1, 99),
      });
      touch();
      break;
    }
    case 'editSpan': {
      const e = board.entries.find((x) => x.id === Number(b.id));
      if (!e || e.kind !== 'span' || e.dead) return;
      if (b.a != null && b.b != null) {
        let a = clamp(Math.round(Number(b.a)), 0, SPAN);
        let z = clamp(Math.round(Number(b.b)), 0, SPAN);
        if (z < a) { const t = a; a = z; z = t; }
        if (z - a >= 1) { e.a = a; e.b = z; }
      }
      if (b.rid != null) { const r = roomOf(b.rid); if (r && r.unlocked) e.rid = r.rid; }
      if (TRUSTS.includes(b.trust)) e.trust = b.trust;
      if (typeof b.source === 'string') e.source = str(b.source, 120);
      if (typeof b.text === 'string') e.text = str(b.text, 300);
      touch();
      break;
    }
    /* Refuter, c'est supprimer : la presence quitte le tableau, la declaration
       reste au Registre sous le nom de qui l'a faite (spec §3.3). */
    case 'disprove': {
      const e = board.entries.find((x) => x.id === Number(b.id));
      if (!e || e.dead) return;
      e.dead = true; e.trust = 'disp';
      e.brokenBy = str(b.by, 120);
      touch();
      break;
    }
    case 'restore': {
      const e = board.entries.find((x) => x.id === Number(b.id));
      if (!e) return;
      e.dead = false; if (e.trust === 'disp') e.trust = 'susp';
      touch();
      break;
    }
    case 'remove': {
      const e = board.entries.find((x) => x.id === Number(b.id));
      if (!e) return;
      e.dead = true; touch();
      break;
    }
    /* Menteur : un jugement de la table, jamais du logiciel. */
    case 'tagLiar': {
      const e = board.entries.find((x) => x.id === Number(b.id));
      if (!e) return;
      e.liar = !!b.on; touch();
      break;
    }
    case 'addEntry': {
      const kind = KINDS.includes(b.kind) && b.kind !== 'span' ? b.kind : 'note';
      const c = b.person ? castOf(b.person) : null;
      if (b.person && (!c || !c.unlocked)) return;
      const r = b.rid == null || b.rid === '' ? null : roomOf(b.rid);
      if (r && !r.unlocked) return;
      if (!str(b.text, 1).length) return;
      newEntry({
        kind, person: c ? c.key : null, rid: r ? r.rid : null,
        text: str(b.text, 600), source: str(b.source, 120),
        author: str(b.author, 40), loop: clamp(Number(b.loop) || board.loop, 1, 99),
      });
      touch();
      break;
    }
    case 'setLoop':
      board.loop = clamp(Number(b.loop) || 1, 1, 99); touch(); break;
    default: break;
  }
}

/* Actions reservees au MJ : ouvrir des portes, rien d'autre. */
function wardenAction(body) {
  const b = body || {};
  switch (b.action) {
    case 'seal': board.open = false; touch(); break;
    case 'open': board.open = true; touch(); break;
    case 'setCast': {
      const c = castOf(b.key); if (!c) return;
      c.unlocked = !!b.on; touch(); break;
    }
    case 'setRoom': {
      const r = roomOf(b.rid); if (!r) return;
      r.unlocked = !!b.on; touch(); break;
    }
    case 'setFloor': {
      const et = String(b.etage || '');
      board.rooms.forEach((r, i) => { if ((M1_LOCATIONS[i] || {}).etage === et) r.unlocked = !!b.on; });
      touch(); break;
    }
    case 'setAllCast': {
      board.cast.forEach((c) => { if (b.group == null || (b.group === 'staff') === !!c.staff) c.unlocked = !!b.on; });
      touch(); break;
    }
    /* Remettre une preuve : ce qu'elle nomme s'ouvre avec elle (spec §4.4). */
    case 'pushClue': {
      if (!str(b.text, 1).length) return;
      const c = b.person ? castOf(b.person) : null;
      const r = b.rid == null || b.rid === '' ? null : roomOf(b.rid);
      if (c) c.unlocked = true;
      if (r) r.unlocked = true;
      newEntry({
        kind: KINDS.includes(b.kind) && b.kind !== 'span' ? b.kind : 'clue',
        person: c ? c.key : null, rid: r ? r.rid : null,
        text: str(b.text, 600), source: '', author: '',
        loop: clamp(Number(b.loop) || board.loop, 1, 99), fromGm: true,
      });
      touch(); break;
    }
    case 'import': {
      const t = b.board;
      if (t && Array.isArray(t.cast) && Array.isArray(t.entries)) {
        const wasOpen = board.open;
        board = t; board.open = wasOpen;                 /* un import ne descelle jamais */
        board.rooms = M1_LOCATIONS.map((l, i) => {
          const prev = (t.rooms || []).find((r) => r.id === l.id);
          return { rid: i, id: l.id, label: l.label || l.id, unlocked: prev ? !!prev.unlocked : false };
        });
        if (!board.nextId) board.nextId = (board.entries.reduce((m, e) => Math.max(m, e.id || 0), 0) || 0) + 1;
        touch();
      }
      break;
    }
    case 'wipe': {
      board.entries = []; board.nextId = 1; touch(); break;
    }
    default: tableAction(b); break;
  }
}

module.exports = {
  init(cols, staffNames) { board = load(cols, staffNames); return board; },
  isOpen: () => !!(board && board.open),
  playerView, wardenView, tableAction, wardenAction,
  raw: () => board,
};
