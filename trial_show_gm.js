/*
 * trial_show_gm.js — slideshows on the GM's trial dashboard.
 *
 *   The list (left column): each slideshow with ▶ Play and ✎ Edit, + New slideshow.
 *   The editor: name; add pictures (several at once, sorted by file name:
 *     "Slide 2" before "Slide 10") or a PDF (Google Slides → File → Download →
 *     PDF: every page becomes a slide); drag thumbnails (or ◀ ▶) to reorder;
 *     ✕ deletes; the music (MP3…, loop, plays on everyone's screens or only
 *     yours); ▶ Play.
 *   While one plays, a strip at the bottom: ◀ 3/12 ▶ (or ← →), "Give control
 *     to…" a player, music on/off and from the top, ■ End.
 *
 *   TrialShowGM.mount(listEl, { base, getState, act, adopt, demo, preview })
 */
(function (root) {
  'use strict';
  const C = root.TrialCore;
  const CSS = `
.sg{font:13px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;color:#e8e3f0}
.sg-list{display:grid;gap:6px}
.sg-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:6px;padding:7px 8px;border:1px solid #2e2540;border-radius:10px;background:#120d1c}
.sg-row.playing{border-color:#f1c66e;box-shadow:0 0 0 1px rgba(241,198,110,.3)}
.sg-row b{display:block;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sg-row span{display:block;font-size:11px;color:#9a90ab}
.sg-row button,.sg-new{border-radius:8px;border:1px solid #4a3d66;background:#22183a;color:#e8e3f0;cursor:pointer;font:600 12px system-ui;padding:6px 9px}
.sg-row button.pl{background:linear-gradient(180deg,#5b2a9c,#34165e);border-color:#f1c66e;color:#f7d684}
.sg-row button:disabled{opacity:.4;cursor:not-allowed}
.sg-new{width:100%;padding:8px;border-style:dashed}
.sg-modal{position:fixed;inset:0;z-index:210;display:flex;padding:16px;background:rgba(5,3,10,.82);overflow:auto}
.sg-modal[hidden]{display:none}
.sg-win{margin:auto;width:min(1100px,100%);background:#140e1f;border:1px solid #4a3d66;border-radius:18px;padding:16px 18px;box-shadow:0 30px 90px rgba(0,0,0,.7)}
.sg-head{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.sg-head input{flex:1;min-width:200px;background:#0c0814;color:#f7d684;border:1px solid #4a3d66;border-radius:10px;padding:8px 12px;font:400 24px/1.1 Anton,Impact,sans-serif;letter-spacing:.04em}
.sg-b{border-radius:10px;border:1px solid #4a3d66;background:#22183a;color:#e8e3f0;cursor:pointer;font:600 13px system-ui;padding:9px 14px}
.sg-b.gold{background:linear-gradient(180deg,#5b2a9c,#34165e);border:2px solid #f1c66e;color:#f7d684;font:400 18px/1 Anton,Impact,sans-serif;letter-spacing:.06em}
.sg-b.red{border-color:#7a2a3a;color:#ff9db0;background:#2a1018}
.sg-b:disabled{opacity:.45;cursor:not-allowed}
.sg-drop{border:2px dashed #4a3d66;border-radius:12px;padding:14px;text-align:center;color:#cfc4e8;cursor:pointer;margin-bottom:10px}
.sg-drop b{color:#f7d684}.sg-drop span{display:block;font-size:11.5px;color:#8d849c;margin-top:4px}
.sg-drop.over{border-color:#f1c66e;background:rgba(241,198,110,.06)}
.sg-prog{min-height:18px;font-size:12px;color:#f7d684;margin-bottom:6px}
.sg-prog.err{color:#ff9db0}
.sg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;max-height:min(52vh,560px);overflow:auto;padding:2px}
.sg-empty{grid-column:1/-1;text-align:center;color:#8d849c;padding:24px}
.sg-th{position:relative;border:2px solid #2e2540;border-radius:10px;background:#000;overflow:hidden;cursor:grab;aspect-ratio:16/10}
.sg-th img{width:100%;height:100%;object-fit:contain;display:block;pointer-events:none}
.sg-th.dragging{opacity:.35}
.sg-th.over{border-color:#f1c66e}
.sg-th.cur{border-color:#7fe6f7}
.sg-th .n{position:absolute;left:6px;top:6px;min-width:22px;height:22px;border-radius:11px;background:rgba(0,0,0,.75);color:#fff;font:700 12px/22px system-ui;text-align:center;padding:0 5px}
.sg-th .tools{position:absolute;right:4px;bottom:4px;display:flex;gap:4px;opacity:.85}
.sg-th .tools button{width:26px;height:26px;border-radius:7px;border:1px solid #4a3d66;background:rgba(16,11,25,.9);color:#e8e3f0;cursor:pointer;font:700 12px system-ui;padding:0}
.sg-th .tools button.x{color:#ff9db0}
.sg-music{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;padding:10px 12px;border:1px solid #2e2540;border-radius:12px;background:#100b19}
.sg-music .t{font:700 12px/1 Cinzel,Georgia,serif;letter-spacing:.1em;color:#cfc4e8}
.sg-music .f{color:#f7d684}.sg-music .f.none{color:#8d849c}
.sg-music label{display:flex;align-items:center;gap:5px;color:#cfc4e8;font-size:12.5px;cursor:pointer}
.sg-seg{display:inline-flex}.sg-seg button{border:1px solid #4a3d66;background:#22183a;color:#cfc4e8;padding:5px 9px;cursor:pointer;font:600 12px system-ui}
.sg-seg button:first-child{border-radius:8px 0 0 8px}.sg-seg button:last-child{border-radius:0 8px 8px 0}
.sg-seg button.on{background:#5b2a9c;color:#fff;border-color:#f1c66e}
.sg-foot{display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:10px;flex-wrap:wrap;color:#8d849c;font-size:12px}
.sg-strip{position:fixed;left:0;right:0;margin:0 auto;width:max-content;bottom:14px;transform:translateY(140%);z-index:205;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;
  padding:10px 14px;border-radius:16px;background:rgba(16,11,25,.97);border:2px solid #f1c66e;box-shadow:0 18px 50px rgba(0,0,0,.6);transition:transform .35s;max-width:calc(100vw - 20px)}
.sg-strip.on{transform:none}
.sg-strip .nav{width:52px;height:46px;border-radius:12px;border:1px solid #f1c66e;background:linear-gradient(180deg,#5b2a9c,#34165e);color:#f7d684;font:700 20px/1 system-ui;cursor:pointer}
.sg-strip .nav:disabled{opacity:.35;cursor:default}
.sg-strip .pos{min-width:120px;text-align:center}
.sg-strip .pos b{display:block;font:400 22px/1 Anton,Impact,sans-serif;letter-spacing:.06em;color:#fff}
.sg-strip .pos span{display:block;font-size:11px;color:#9a90ab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}
.sg-strip select{background:#0c0814;color:#eee;border:1px solid #4a3d66;border-radius:8px;padding:7px;font:13px system-ui}
.sg-strip .lab{font-size:11px;color:#9a90ab;letter-spacing:.06em;text-transform:uppercase}
.sg-strip .sm{border-radius:10px;border:1px solid #4a3d66;background:#22183a;color:#e8e3f0;cursor:pointer;font:600 12.5px system-ui;padding:9px 11px}
.sg-strip .sm.off{color:#8d849c;text-decoration:line-through}
.sg-strip .end{border-color:#7a2a3a;color:#ff9db0;background:#2a1018}
`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(14))).map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  const mb = (n) => (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
  const natural = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

  /* ---------- turning files into slides ---------- */
  function toBlob(cv, type, q) { return new Promise((r) => cv.toBlob(r, type, q)); }
  async function encode(cv) {
    let b = await toBlob(cv, 'image/webp', 0.88);
    if (!b || b.type !== 'image/webp') b = await toBlob(cv, 'image/jpeg', 0.9);
    return b;
  }
  async function prepImage(file) {
    const bmp = await createImageBitmap(file);
    const w0 = bmp.width, h0 = bmp.height, k = Math.min(1, 1920 / Math.max(w0, h0));
    if (file.type === 'image/gif' && file.size <= 6e6) return { blob: file, w: w0, h: h0 };       // keep a GIF's animation
    const cv = document.createElement('canvas');
    cv.width = Math.round(w0 * k); cv.height = Math.round(h0 * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const b = await encode(cv);
    if (k === 1 && /^image\/(webp|jpeg|png)$/.test(file.type) && file.size <= b.size && file.size <= 6e6) return { blob: file, w: w0, h: h0 };
    return { blob: b, w: cv.width, h: cv.height };
  }
  let pdfjs = null;
  function loadPdfJs() {
    if (pdfjs) return pdfjs;
    pdfjs = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => { root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(root.pdfjsLib); };
      s.onerror = () => { pdfjs = null; rej(new Error('could not load the PDF reader')); };
      document.head.appendChild(s);
    });
    return pdfjs;
  }
  async function* pdfPages(file) {
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i), v1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: 1920 / Math.max(v1.width, v1.height) });
      const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      yield { blob: await encode(cv), w: cv.width, h: cv.height, i, n: doc.numPages };
    }
  }

  function mount(listEl, o) {
    if (!document.getElementById('sg-css')) { const s = document.createElement('style'); s.id = 'sg-css'; s.textContent = CSS; document.head.appendChild(s); }
    listEl.classList.add('sg');
    const base = o.base || '';
    const demoFiles = {};                       // demo page: id -> object URL
    const fileUrl = (id) => demoFiles[id] || base + '/trial/slide/' + id;
    const S = () => o.getState() || {};
    const shows = () => S().shows || [];
    const playing = () => { const p = S().show; return p && p.on ? p : null; };

    /* ---------- uploads ---------- */
    async function send(showId, kind, blob, meta) {
      if (o.demo) {
        const id = newId(); demoFiles[id] = URL.createObjectURL(blob);
        o.act(kind === 'audio' ? { action: 'audioSet', id: showId, audio: { id, mime: blob.type || 'audio/mpeg', name: meta.name, size: blob.size } }
          : { action: 'slideAdded', id: showId, slide: { id, mime: blob.type, w: meta.w, h: meta.h } });
        return { ok: true };
      }
      const q = new URLSearchParams({ show: showId, kind, w: meta.w || 0, h: meta.h || 0, name: meta.name || '' });
      try {
        const r = await fetch(base + '/trial/upload?' + q, { method: 'POST', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
        const j = await r.json();
        if (j.state) o.adopt(j.state);
        return j;
      } catch (e) { return { ok: false, error: 'upload failed (connection)' }; }
    }

    /* ---------- the list ---------- */
    function paintList() {
      const P = playing();
      listEl.innerHTML = '<div class="sg-list">' + shows().map((x) => '<div class="sg-row' + (P && P.id === x.id ? ' playing' : '') + '">'
        + '<div><b>' + esc(x.name) + '</b><span>' + x.slides.length + ' slide' + (x.slides.length === 1 ? '' : 's') + (x.audio ? ' · ♪ ' + esc(x.audio.name) : '') + '</span></div>'
        + '<button type="button" class="pl" data-play="' + x.id + '"' + (x.slides.length ? '' : ' disabled title="Add pictures first"') + ' title="Play full screen on the players\' screens">▶</button>'
        + '<button type="button" data-edit="' + x.id + '" title="Edit">✎</button></div>').join('')
        + '<button type="button" class="sg-new" data-new>+ New slideshow</button></div>';
    }
    listEl.addEventListener('click', (e) => {
      const p = e.target.closest('[data-play]'), ed = e.target.closest('[data-edit]');
      if (p) o.act({ action: 'play', id: p.dataset.play });
      if (ed) openEditor(ed.dataset.edit);
      if (e.target.closest('[data-new]')) {
        const id = newId();
        o.act({ action: 'showNew', id, name: 'Slideshow ' + (shows().length + 1) });
        setTimeout(() => openEditor(id, true), 60);
      }
    });

    /* ---------- the editor ---------- */
    const modal = document.createElement('div');
    modal.className = 'sg sg-modal'; modal.hidden = true;
    document.body.appendChild(modal);
    let edId = null, busy = false, dragId = null;
    const prog = (t, err) => { const p = modal.querySelector('.sg-prog'); if (p) { p.textContent = t || ''; p.classList.toggle('err', !!err); } };
    function openEditor(id, fresh) {
      edId = id; paintEditor(); modal.hidden = false;
      if (fresh) { const i = modal.querySelector('.sg-head input'); i.focus(); i.select(); }
    }
    function paintEditor(keepProg) {
      const x = shows().find((y) => y.id === edId);
      if (!x) { modal.hidden = true; return; }
      const P = playing(), curId = P && P.id === x.id ? x.slides[P.idx] && x.slides[P.idx].id : null;
      const oldProg = keepProg ? (modal.querySelector('.sg-prog') || {}).textContent : '';
      modal.innerHTML = '<div class="sg-win" role="dialog" aria-label="Slideshow editor">'
        + '<div class="sg-head"><input type="text" maxlength="60" value="' + esc(x.name) + '" aria-label="Slideshow name">'
        + '<button type="button" class="sg-b gold" data-ed-play' + (x.slides.length ? '' : ' disabled') + '>▶ Play</button><button type="button" class="sg-b" data-ed-close>Done</button></div>'
        + '<div class="sg-drop"><b>+ Add pictures</b> — or a <b>PDF</b> (Google Slides → File → Download → PDF: every page becomes a slide)'
        + '<span>Click, or drop files here. Several at once are sorted by file name. Big pictures are shrunk to 1920 px.</span><input type="file" multiple accept="image/*,application/pdf" hidden></div>'
        + '<div class="sg-prog"></div>'
        + '<div class="sg-grid">' + (x.slides.length ? x.slides.map((sl, i) => '<div class="sg-th' + (sl.id === curId ? ' cur' : '') + '" draggable="true" data-sl="' + sl.id + '">'
          + '<img src="' + fileUrl(sl.id) + '" alt="" loading="lazy"><span class="n">' + (i + 1) + '</span>'
          + '<span class="tools"><button type="button" data-mv="-1" title="Earlier">◀</button><button type="button" data-mv="1" title="Later">▶</button><button type="button" class="x" data-del title="Delete this slide">✕</button></span></div>').join('')
          : '<div class="sg-empty">No slides yet.</div>') + '</div>'
        + '<div class="sg-music"><span class="t">♪ Music</span>'
        + (x.audio ? '<span class="f">' + esc(x.audio.name) + ' · ' + mb(x.audio.size) + '</span>' : '<span class="f none">none</span>')
        + '<button type="button" class="sg-b" data-au-pick>' + (x.audio ? 'Change' : 'Choose a file (MP3…)') + '</button>'
        + (x.audio ? '<button type="button" class="sg-b red" data-au-del>Remove</button>' : '')
        + '<input type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav" hidden data-au-file>'
        + '<label><input type="checkbox" data-loop' + (x.loop ? ' checked' : '') + '> Loop</label>'
        + '<span class="sg-music t" style="border:0;padding:0;margin:0;background:none">Plays on</span><span class="sg-seg"><button type="button" data-all="1" class="' + (x.audioAll ? 'on' : '') + '" title="Each player\'s device plays it (online play, everyone on their own speakers)">everyone\'s screens</button>'
        + '<button type="button" data-all="0" class="' + (!x.audioAll ? 'on' : '') + '" title="Only this dashboard plays it (same room: your speakers)">my screen only</button></span></div>'
        + '<div class="sg-foot"><span>Drag a slide to move it. While it plays, changes reach the players at once.</span><button type="button" class="sg-b red" data-show-del>Delete this slideshow</button></div></div>';
      if (oldProg) prog(oldProg);
    }
    async function addFiles(list) {
      if (busy || !edId) return;
      const files = Array.from(list || []).filter((f) => /^image\//.test(f.type) || f.type === 'application/pdf' || /\.pdf$/i.test(f.name)).sort(natural);
      if (!files.length) { prog('Pictures or a PDF, please.', true); return; }
      busy = true;
      let done = 0, fail = 0;
      for (const f of files) {
        try {
          if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
            prog('Reading ' + f.name + '…');
            for await (const pg of pdfPages(f)) {
              prog('Page ' + pg.i + ' / ' + pg.n + ' of ' + f.name + '…');
              const j = await send(edId, 'slide', pg.blob, { w: pg.w, h: pg.h });
              if (!j.ok) { fail++; prog(j.error || 'upload failed', true); } else done++;
              paintEditor(true);
            }
          } else {
            prog('Adding ' + (done + fail + 1) + ' / ' + files.length + ' — ' + f.name + '…');
            const im = await prepImage(f);
            const j = await send(edId, 'slide', im.blob, { w: im.w, h: im.h });
            if (!j.ok) { fail++; prog(f.name + ': ' + (j.error || 'upload failed'), true); } else done++;
            paintEditor(true);
          }
        } catch (e) { fail++; prog(f.name + ': ' + (e.message || 'could not read it'), true); }
      }
      busy = false;
      paintEditor();
      prog(done + ' slide' + (done === 1 ? '' : 's') + ' added' + (fail ? ', ' + fail + ' failed' : '') + '.', !!fail);
    }
    function moveSlide(id, to) {
      const x = shows().find((y) => y.id === edId);
      const order = x.slides.map((s) => s.id).filter((k) => k !== id);
      order.splice(Math.max(0, Math.min(order.length, to)), 0, id);
      o.act({ action: 'slideOrder', id: edId, order });
      paintEditor();
    }
    modal.addEventListener('click', async (e) => {
      if (e.target === modal || e.target.closest('[data-ed-close]')) { modal.hidden = true; edId = null; return; }
      const x = shows().find((y) => y.id === edId);
      if (!x) return;
      if (e.target.closest('.sg-drop')) { modal.querySelector('.sg-drop input').click(); return; }
      if (e.target.closest('[data-ed-play]')) { o.act({ action: 'play', id: edId }); modal.hidden = true; return; }
      const th = e.target.closest('.sg-th');
      if (th && e.target.closest('[data-mv]')) { const i = x.slides.findIndex((s) => s.id === th.dataset.sl); moveSlide(th.dataset.sl, i + Number(e.target.closest('[data-mv]').dataset.mv)); return; }
      if (th && e.target.closest('[data-del]')) { o.act({ action: 'slideDelete', id: edId, slide: th.dataset.sl }); paintEditor(); return; }
      if (e.target.closest('[data-au-pick]')) { modal.querySelector('[data-au-file]').click(); return; }
      if (e.target.closest('[data-au-del]')) { o.act({ action: 'audioSet', id: edId, audio: null }); paintEditor(); return; }
      const all = e.target.closest('[data-all]');
      if (all) { o.act({ action: 'showEdit', id: edId, audioAll: all.dataset.all === '1' }); paintEditor(); return; }
      if (e.target.closest('[data-show-del]') && confirm('Delete "' + x.name + '" and its ' + x.slides.length + ' slides?')) {
        o.act({ action: 'showDelete', id: edId }); modal.hidden = true; edId = null;
      }
    });
    modal.addEventListener('change', async (e) => {
      if (!edId) return;
      if (e.target.matches('.sg-drop input')) { addFiles(e.target.files); e.target.value = ''; }
      if (e.target.matches('[data-loop]')) o.act({ action: 'showEdit', id: edId, loop: e.target.checked });
      if (e.target.matches('.sg-head input')) o.act({ action: 'showEdit', id: edId, name: e.target.value });
      if (e.target.matches('[data-au-file]')) {
        const f = e.target.files[0]; e.target.value = '';
        if (!f) return;
        if (f.size > 25 * 1048576) { prog('That file is ' + mb(f.size) + ': 25 MB at most.', true); return; }
        prog('Uploading ' + f.name + ' (' + mb(f.size) + ')…');
        const type = f.type || (/\.mp3$/i.test(f.name) ? 'audio/mpeg' : /\.m4a$/i.test(f.name) ? 'audio/mp4' : /\.ogg$/i.test(f.name) ? 'audio/ogg' : /\.wav$/i.test(f.name) ? 'audio/wav' : '');
        const j = await send(edId, 'audio', type && type !== f.type ? new Blob([f], { type }) : f, { name: f.name });
        paintEditor();
        prog(j.ok ? 'Music ready.' : (j.error || 'upload failed'), !j.ok);
      }
    });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { modal.hidden = true; edId = null; }
      if (e.key === 'Enter' && e.target.matches('.sg-head input')) e.target.blur();
    });
    // drop files on the editor, drag thumbnails to reorder
    modal.addEventListener('dragover', (e) => {
      e.preventDefault();
      const th = e.target.closest('.sg-th');
      modal.querySelectorAll('.sg-th.over').forEach((t) => { if (t !== th) t.classList.remove('over'); });
      if (dragId && th) th.classList.add('over');
      if (!dragId) { const d = modal.querySelector('.sg-drop'); if (d) d.classList.add('over'); }
    });
    modal.addEventListener('dragleave', (e) => { if (e.target === modal) { const d = modal.querySelector('.sg-drop'); if (d) d.classList.remove('over'); } });
    modal.addEventListener('dragstart', (e) => {
      const th = e.target.closest('.sg-th');
      if (!th) return;
      dragId = th.dataset.sl; th.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (er) {}
    });
    modal.addEventListener('dragend', () => { dragId = null; modal.querySelectorAll('.sg-th').forEach((t) => t.classList.remove('dragging', 'over')); });
    modal.addEventListener('drop', (e) => {
      e.preventDefault();
      const d = modal.querySelector('.sg-drop'); if (d) d.classList.remove('over');
      if (dragId) {
        const th = e.target.closest('.sg-th'), x = shows().find((y) => y.id === edId);
        if (th && th.dataset.sl !== dragId && x) {
          const to = x.slides.findIndex((s) => s.id === th.dataset.sl);
          const r = th.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
          const from = x.slides.findIndex((s) => s.id === dragId);
          moveSlide(dragId, to + (after ? 1 : 0) - (from < to ? 1 : 0));
        }
        dragId = null;
        return;
      }
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });

    /* ---------- the strip while one plays ---------- */
    // 🎧 Here: hear the music on this computer too (off when this screen sits in the same room as the players' screens)
    let here = true;
    try { here = localStorage.getItem('m1_show_here') !== '0'; } catch (e) {}
    const strip = document.createElement('div');
    strip.className = 'sg sg-strip';
    strip.innerHTML = '<button type="button" class="nav" data-go="-1" title="Previous (←)">◀</button><div class="pos"><b></b><span></span></div>'
      + '<button type="button" class="nav" data-go="1" title="Next (→)">▶</button>'
      + '<span class="lab">Give control to</span><select data-ctrl></select>'
      + '<button type="button" class="sm" data-mus title="Music on / off">♪ Music</button><button type="button" class="sm" data-rst title="Music from the top">⟲</button>'
      + '<button type="button" class="sm" data-here title="Hear the music on this computer too — turn it off when the players\' screens are in the same room">🎧 Here</button>'
      + '<button type="button" class="sm end" data-stop title="End the slideshow">■ End</button>';
    document.body.appendChild(strip);
    strip.addEventListener('click', (e) => {
      const g = e.target.closest('[data-go]');
      if (g) o.act({ action: 'slideGo', delta: Number(g.dataset.go) });
      if (e.target.closest('[data-stop]')) o.act({ action: 'stop' });
      if (e.target.closest('[data-mus]')) { const p = playing(); if (p) o.act({ action: 'music', on: p.music === false }); }
      if (e.target.closest('[data-rst]')) o.act({ action: 'music', restart: true });
      if (e.target.closest('[data-here]')) {
        here = !here;
        try { localStorage.setItem('m1_show_here', here ? '1' : '0'); } catch (err) {}
        paintStrip();
      }
    });
    strip.addEventListener('change', (e) => { if (e.target.matches('[data-ctrl]')) o.act({ action: 'slideCtrl', key: e.target.value || null }); });
    document.addEventListener('keydown', (e) => {
      if (!playing() || !modal.hidden || e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { o.act({ action: 'slideGo', delta: 1 }); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { o.act({ action: 'slideGo', delta: -1 }); e.preventDefault(); }
    });
    function paintStrip() {
      const P = playing(), x = P && shows().find((y) => y.id === P.id);
      strip.classList.toggle('on', !!x);
      if (!x) return;
      strip.querySelector('.pos b').textContent = (P.idx + 1) + ' / ' + x.slides.length;
      strip.querySelector('.pos span').textContent = x.name;
      const [pv, nx] = strip.querySelectorAll('[data-go]');
      pv.disabled = P.idx <= 0; nx.disabled = P.idx >= x.slides.length - 1;
      const taken = ((S().players || {}).taken) || [];
      const sel = strip.querySelector('[data-ctrl]');
      const html = '<option value="">nobody — only me</option>' + C.PCS.map((k) => '<option value="' + k + '"' + (P.ctrl === k ? ' selected' : '') + '>'
        + esc(C.BY_KEY[k].name) + (taken.indexOf(k) >= 0 ? '' : ' (not at the table)') + '</option>').join('');
      if (sel._h !== html) { sel._h = html; sel.innerHTML = html; }
      sel.value = P.ctrl || '';
      const mus = strip.querySelector('[data-mus]');
      const hr = strip.querySelector('[data-here]');
      mus.hidden = strip.querySelector('[data-rst]').hidden = hr.hidden = !x.audio;
      hr.classList.toggle('off', !here);
      mus.classList.toggle('off', P.music === false);
    }

    /* ---------- what the players see, small, in the preview ---------- */
    const preview = o.preview ? root.TrialShow.mount({ container: o.preview, gm: true, base, src: fileUrl, soundOn: () => here, post: async (a) => { o.act(a); return { ok: true }; } }) : null;

    let sig = null;
    function update() {
      const st = S();
      const s = JSON.stringify([st.shows, st.show, (st.players || {}).taken]);
      if (s === sig) return;
      sig = s;
      paintList();
      paintStrip();
      if (!modal.hidden && edId && !busy) {
        const focusName = document.activeElement && document.activeElement.matches && document.activeElement.matches('.sg-head input');
        if (!focusName) paintEditor(true);
      }
      if (preview) preview.update(C.slidesPublic(st), st.serverNow);
    }
    paintList();
    return { update, openEditor };
  }

  root.TrialShowGM = { mount };
})(typeof window !== 'undefined' ? window : this);
