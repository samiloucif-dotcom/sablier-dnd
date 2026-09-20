/*
 * store_github.js — sauvegarde durable des donnees de l'app dans le depot GitHub.
 *
 * POURQUOI : sur le plan gratuit de Render il n'y a pas de disque persistant.
 * Le serveur ecrit bien timeline.json et board.json, mais tout est efface au
 * redemarrage du service. Ce module reecrit ces deux fichiers dans le depot
 * GitHub via l'API, ce qui les rend permanents : le MJ tape dans la grille,
 * c'est enregistre, point final. Plus de telechargement / upload manuel.
 *
 * SUR QUELLE BRANCHE : jamais `main`. Les donnees vont sur une branche a part
 * (GH_BRANCH, `data` par defaut), creee automatiquement au premier demarrage.
 * Consequence voulue : une sauvegarde en pleine partie ne peut pas declencher
 * un redeploiement Render, meme si l'auto-deploy est actif sur main.
 *
 * CONFIGURATION (variables d'environnement Render, jamais dans le code) :
 *   GH_TOKEN   jeton GitHub « fine-grained », permission Contents: Read+Write
 *              sur le seul depot sablier-dnd. Sans lui, ce module reste
 *              inactif et l'app retombe sur l'ecriture disque locale.
 *   GH_REPO    "proprietaire/depot"   (defaut : samiloucif-dotcom/sablier-dnd)
 *   GH_BRANCH  branche de donnees     (defaut : data)
 *
 * Node 18+ : fetch est natif, aucune dependance a installer.
 */

const TOKEN  = process.env.GH_TOKEN || '';
const REPO   = process.env.GH_REPO || 'samiloucif-dotcom/sablier-dnd';
const BRANCH = process.env.GH_BRANCH || 'data';
const API    = process.env.GH_API || 'https://api.github.com';   // surchargeable pour les tests
const DELAI  = Number(process.env.GH_DEBOUNCE_MS || 6000);  // une salve de modifs = un commit

const enabled = !!TOKEN;
const shas = {};          // fichier -> sha de la derniere version connue
const pending = {};       // fichier -> { timer, json, tries }
const etat = {            // expose au cockpit pour l'indicateur « enregistre a ... »
  kind: enabled ? 'github' : 'disk',
  repo: REPO, branch: BRANCH,
  ok: true, at: null, err: null, saving: false,
};

function head(extra) {
  return Object.assign({
    'Authorization': 'Bearer ' + TOKEN,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'sablier-dnd',
  }, extra || {});
}

async function api(url, opts) {
  const r = await fetch(API + url, Object.assign({ headers: head() }, opts || {}));
  const txt = await r.text();
  let body = null;
  try { body = txt ? JSON.parse(txt) : null; } catch (e) { body = { message: txt.slice(0, 200) }; }
  if (!r.ok) {
    const err = new Error('GitHub ' + r.status + ' : ' + ((body && body.message) || 'erreur'));
    err.status = r.status;
    throw err;
  }
  return body;
}

/* La branche de donnees est creee au besoin, a partir de la branche par defaut. */
async function ensureBranch() {
  try {
    await api('/repos/' + REPO + '/git/ref/heads/' + BRANCH);
    return true;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const repo = await api('/repos/' + REPO);
  const base = await api('/repos/' + REPO + '/git/ref/heads/' + repo.default_branch);
  await api('/repos/' + REPO + '/git/refs', {
    method: 'POST',
    headers: head({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ref: 'refs/heads/' + BRANCH, sha: base.object.sha }),
  });
  console.log('  Data branch « ' + BRANCH + ' » created in ' + REPO + '.');
  return true;
}

/* Lit un fichier de la branche de donnees. Renvoie null s'il n'y est pas encore
   (premier demarrage) : l'appelant se rabat alors sur la copie livree avec le code. */
async function load(file) {
  if (!enabled) return null;
  try {
    const j = await api('/repos/' + REPO + '/contents/' + encodeURIComponent(file)
      + '?ref=' + encodeURIComponent(BRANCH));
    shas[file] = j.sha;
    const txt = Buffer.from(j.content || '', 'base64').toString('utf8');
    etat.ok = true; etat.err = null;
    return JSON.parse(txt);
  } catch (e) {
    if (e.status === 404) return null;
    etat.ok = false; etat.err = e.message;
    console.warn('  /!\\ GitHub read failed (' + e.message + ') — using local copy.');
    return null;
  }
}

async function put(file, json, message) {
  const body = {
    message: message,
    content: Buffer.from(json, 'utf8').toString('base64'),
    branch: BRANCH,
  };
  if (shas[file]) body.sha = shas[file];
  const j = await api('/repos/' + REPO + '/contents/' + encodeURIComponent(file), {
    method: 'PUT',
    headers: head({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  shas[file] = j.content && j.content.sha;
}

/* Quelqu'un d'autre a ecrit entre-temps : on relit le sha et on rejoue une fois. */
async function refreshSha(file) {
  try {
    const j = await api('/repos/' + REPO + '/contents/' + encodeURIComponent(file)
      + '?ref=' + encodeURIComponent(BRANCH));
    shas[file] = j.sha;
  } catch (e) { delete shas[file]; }
}

async function flushNow(file) {
  const p = pending[file];
  if (!p) return;
  delete pending[file];
  etat.saving = true;
  try {
    await put(file, p.json, 'routines : maj depuis le cockpit (' + new Date().toISOString() + ')');
    etat.ok = true; etat.err = null; etat.at = new Date().toISOString();
  } catch (e) {
    if (e.status === 409 || e.status === 422) {          // conflit de sha
      await refreshSha(file);
      try {
        await put(file, p.json, 'routines : maj depuis le cockpit (retry)');
        etat.ok = true; etat.err = null; etat.at = new Date().toISOString();
      } catch (e2) { etat.ok = false; etat.err = e2.message; }
    } else {
      etat.ok = false; etat.err = e.message;
    }
    if (!etat.ok) console.warn('  /!\\ GitHub save failed : ' + etat.err);
  }
  etat.saving = false;
}

/* Appelee a chaque modification. On groupe les modifications d'une meme salve
   pour ne pas fabriquer un commit par frappe. */
function save(file, obj) {
  if (!enabled) return;
  const json = JSON.stringify(obj, null, 1);
  if (pending[file]) clearTimeout(pending[file].timer);
  pending[file] = { json: json, timer: setTimeout(() => flushNow(file), DELAI) };
}

/* Dernier filet : a l'arret du service, on pousse ce qui restait en attente. */
function flushAll() {
  return Promise.all(Object.keys(pending).map((f) => {
    clearTimeout(pending[f].timer);
    return flushNow(f);
  }));
}
['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => {
  flushAll().finally(() => process.exit(0));
}));

module.exports = { enabled, load, save, flushAll, ensureBranch, etat, BRANCH, REPO };
