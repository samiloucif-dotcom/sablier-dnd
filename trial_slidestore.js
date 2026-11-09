/*
 * trial_slidestore.js — the slideshow files (pictures and music).
 *
 * Kept on the server's disk (trial_slides/<id>.<ext>) and, when GH_TOKEN is
 * set, also on the GitHub "data" branch (sablier-app/trial_slides/…), because
 * Render's free disk is wiped at every restart. After a restart a file is
 * fetched back from GitHub the first time someone asks for it.
 * Served with Range support, so the music can start mid-way for a late joiner.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const STORE = require('./store_github.js');

const DIR = path.join(__dirname, 'trial_slides');
const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
  'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/x-m4a': 'm4a', 'audio/webm': 'webm' };
const MAX = { image: 6 * 1024 * 1024, audio: 25 * 1024 * 1024 };
const remote = (id, mime) => 'sablier-app/trial_slides/' + id + '.' + EXT[mime];
const local = (id, mime) => path.join(DIR, id + '.' + EXT[mime]);
const fetching = {};

const newId = () => Array.from(crypto.randomBytes(16)).map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

/* store a new file; resolves once it is on disk (GitHub follows in the background) */
function put(mime, buf) {
  if (!EXT[mime]) throw new Error('unsupported type');
  const id = newId();
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(local(id, mime), buf);
  STORE.saveBinary(remote(id, mime), buf, 'trial slides: ' + id + '.' + EXT[mime]);
  return id;
}

/* the file on disk, fetched back from GitHub if a restart wiped it; null if lost */
async function ensure(id, mime) {
  const f = local(id, mime);
  if (fs.existsSync(f)) return f;
  if (!fetching[id]) {
    fetching[id] = (async () => {
      const buf = await STORE.loadBinary(remote(id, mime));
      if (!buf) return null;
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(f, buf);
      return f;
    })().finally(() => { setTimeout(() => { delete fetching[id]; }, 5000); });
  }
  return fetching[id];
}

/* sends the file, honouring "Range: bytes=a-b" */
async function serve(req, res, id, mime) {
  const f = await ensure(id, mime);
  if (!f) { res.writeHead(404); return res.end('Not found'); }
  const size = fs.statSync(f).size;
  const head = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    let a = m[1] === '' ? size - Number(m[2]) : Number(m[1]);
    let b = m[1] !== '' && m[2] !== '' ? Number(m[2]) : size - 1;
    a = Math.max(0, a); b = Math.min(size - 1, b);
    if (a > b) { res.writeHead(416, { 'Content-Range': 'bytes */' + size }); return res.end(); }
    res.writeHead(206, Object.assign(head, { 'Content-Range': 'bytes ' + a + '-' + b + '/' + size, 'Content-Length': b - a + 1 }));
    return fs.createReadStream(f, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, Object.assign(head, { 'Content-Length': size }));
  return fs.createReadStream(f).pipe(res);
}

/* reads a raw upload body (the GM's pictures and music), with a size limit */
function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    const parts = []; let n = 0, over = false;
    req.on('data', (c) => { if (over) return; n += c.length; if (n > limit) { over = true; reject(new Error('too big')); req.resume(); return; } parts.push(c); });
    req.on('end', () => { if (!over) resolve(Buffer.concat(parts)); });
    req.on('error', reject);
  });
}

function remove(id, mime) { try { fs.unlinkSync(local(id, mime)); } catch (e) {} }

module.exports = { put, serve, ensure, readRaw, remove, EXT, MAX, newId };
