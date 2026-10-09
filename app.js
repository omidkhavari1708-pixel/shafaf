(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const FA = /[؀-ۿ]/;
  const TRACK = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
  const STORE = 'shafaf.v2';
  const MAX_LINES = 6;
  const FRAME = 1080; // preview assumes the PNG sits on a 1080-wide frame at 1x

  // single-weight fonts must not be asked for a bold weight, or the browser fakes one
  const FONTS = {
    nimkat:  { stack: '"Nimkat", "Vazirmatn", "Inter Tight", sans-serif', weight: 'normal' },
    vazir:   { stack: '"Vazirmatn", "Inter Tight", sans-serif', weight: '900' },
    inter:   { stack: '"Inter Tight", "Helvetica Neue", Arial, sans-serif', weight: '800' },
    poppins: { stack: '"Poppins", "Helvetica Neue", Arial, sans-serif', weight: '700' }
  };

  // glass: see-through fill plus a bright rim, no dark shadow, so the picture behind shows through
  const PRESETS = {
    glass: { color: '#FFFFFF', top: 70, bot: 22, edge: 55, shadow: 0, bg: 'room' },
    fade:  { color: '#FFFFFF', top: 100, bot: 68, edge: 0, shadow: 20, bg: 'room' },
    frost: { color: '#FFFFFF', top: 55, bot: 50, edge: 0, shadow: 0, bg: 'room' },
    ink:   { color: '#1F1A17', top: 100, bot: 25, edge: 0, shadow: 0, bg: 'grey' },
    card:  { color: '#1F1A17', top: 100, bot: 100, edge: 0, shadow: 0, bg: 'yellow' }
  };

  const SAMPLES = {
    one:  { lines: [['شفاف', 240, 'center']], preset: 'glass', gap: 8 },
    cta:  { lines: [['کامنت کن', 64, 'center'], ['«راهنما»', 220, 'center']], preset: 'glass', gap: 0 },
    hook: { lines: [['ببین چی می‌شه اگه', 60, 'right'], ['Claude', 220, 'right'], ['سناریوهاتو بنویسه', 60, 'right']], preset: 'fade', gap: -2 },
    turn: { lines: [['Turn', 60, 'left'], ['Claude', 220, 'center'], ['into a master scriptwriter', 60, 'right']], preset: 'fade', gap: -4 }
  };

  const st = { preset: 'glass', color: '#FFFFFF', bg: 'room', fa: 'nimkat', en: 'inter', q: 2, lines: [] };
  let uid = 0;
  const newLine = (text, size, align) => ({ id: 'l' + (++uid), text, size, align });

  const cv = $('#cv');
  const stage = $('#stage');
  const mctx = document.createElement('canvas').getContext('2d');
  const num = id => +$(id).value;

  function globals() {
    return {
      top: num('#r-top'), bot: num('#r-bot'), edge: num('#r-edge'), shadow: num('#r-shadow'),
      stretch: num('#r-stretch'), track: num('#r-track'), gap: num('#r-gap'), color: st.color
    };
  }

  // ---- drawing ----
  function fontFor(text, px) {
    const fa = FA.test(text);
    const f = FONTS[fa ? st.fa : st.en];
    return { fa, size: px, css: f.weight + ' ' + px + 'px ' + f.stack };
  }
  function setup(ctx, f, trackPct) {
    ctx.font = f.css;
    ctx.direction = f.fa ? 'rtl' : 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Persian letters join, so they are never tracked
    if (TRACK) ctx.letterSpacing = f.fa ? '0px' : (trackPct * f.size / 100).toFixed(2) + 'px';
  }
  function meas(text, f, trackPct) {
    setup(mctx, f, trackPct);
    const m = mctx.measureText(text);
    return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent };
  }
  function layer(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { cv: c, ctx: c.getContext('2d') }; }
  function drawText(ctx, o, x, y, sx, trackPct, mode, color, lw) {
    setup(ctx, o.f, trackPct);
    ctx.save();
    ctx.setTransform(sx, 0, 0, 1, x, y);
    if (mode === 'fill') { ctx.fillStyle = color; ctx.fillText(o.text, o.m.l, 0); }
    else { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.strokeText(o.text, o.m.l, 0); }
    ctx.restore();
  }

  const asked = new Set();
  function ensureFont(css, text) {
    if (!text || !document.fonts) return;
    const key = css + '|' + text;
    if (asked.has(key)) return;
    asked.add(key);
    try { if (!document.fonts.check(css, text)) document.fonts.load(css, text).then(schedule, () => {}); } catch (e) { /* older browsers */ }
  }

  function render(target, scale) {
    const k = scale || 1;
    const g = globals();
    const out = target || cv;
    const items = st.lines.map(l => ({ text: l.text.trim(), size: l.size, align: l.align })).filter(l => l.text);
    if (!items.length) {
      out.width = 10; out.height = 10; out.getContext('2d').clearRect(0, 0, 10, 10);
      if (!target) showDims(0, 0);
      return out;
    }
    const sx = g.stretch / 100;

    const ms = items.map(it => {
      const f = fontFor(it.text, it.size * k);
      ensureFont(f.css, it.text);
      const m = meas(it.text, f, g.track);
      const cap = meas(f.fa ? 'ا' : 'H', f, 0).a;
      return { ...it, f, m, w: (m.l + m.r) * sx, a: Math.max(m.a, cap * 0.7), d: Math.max(m.d, 0) };
    });

    // stack lines top to bottom; the gap is a share of the smaller neighbour, negative tucks them together
    let y = 0;
    ms.forEach((o, i) => {
      if (i > 0) y += g.gap / 100 * Math.min(o.size, ms[i - 1].size) * k;
      o.top = y; o.base = y + o.a; y = o.base + o.d;
    });
    const minTop = Math.min(...ms.map(o => o.top));
    const totalH = y - minTop;
    const bw = Math.max(...ms.map(o => o.w));
    ms.forEach(o => { o.left = o.align === 'left' ? 0 : o.align === 'center' ? (bw - o.w) / 2 : bw - o.w; });

    const maxPx = Math.max(...items.map(it => it.size)) * k;
    const edgeW = Math.max(1, maxPx * 0.012);
    const blur = maxPx * 0.12;
    const pad = Math.ceil(maxPx * 0.04 + (g.edge > 0 ? edgeW * 2 : 0) + (g.shadow > 0 ? blur * 1.4 + maxPx * 0.03 : 0));
    const W = Math.max(10, Math.ceil(bw + pad * 2));
    const H = Math.max(10, Math.ceil(totalH + pad * 2));
    const oy = pad - minTop;

    const A = layer(W, H);
    ms.forEach(o => {
      const x0 = pad + o.left, yb = oy + o.base;
      const L = layer(W, H), c = L.ctx;
      drawText(c, o, x0, yb, sx, g.track, 'fill', g.color);
      // each line fades over its own letters
      const gr = c.createLinearGradient(0, oy + o.top, 0, yb + o.d);
      gr.addColorStop(0, 'rgba(0,0,0,' + (g.top / 100) + ')');
      gr.addColorStop(1, 'rgba(0,0,0,' + (g.bot / 100) + ')');
      c.globalCompositeOperation = 'destination-in';
      c.fillStyle = gr;
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'source-over';
      if (g.edge > 0) {
        // rim outside the letters only: stroke, then cut the letter shapes out so joins leave no seams
        const E = layer(W, H);
        drawText(E.ctx, o, x0, yb, sx, g.track, 'stroke', g.color, edgeW * 2);
        E.ctx.globalCompositeOperation = 'destination-out';
        drawText(E.ctx, o, x0, yb, sx, g.track, 'fill', '#000');
        c.globalAlpha = g.edge / 100;
        c.drawImage(E.cv, 0, 0);
        c.globalAlpha = 1;
      }
      A.ctx.drawImage(L.cv, 0, 0);
    });

    out.width = W; out.height = H;
    const c = out.getContext('2d');
    c.clearRect(0, 0, W, H);
    if (g.shadow > 0) {
      c.shadowColor = 'rgba(0,0,0,' + (g.shadow / 100) + ')';
      c.shadowBlur = blur;
      c.shadowOffsetY = maxPx * 0.025;
    }
    c.drawImage(A.cv, 0, 0);
    if (!target) {
      cv.style.width = Math.min(96, W / FRAME * 100).toFixed(2) + '%';
      showDims(W * st.q, H * st.q);
    }
    return out;
  }
  function showDims(w, h) { $('#dims').textContent = w ? Math.round(w) + '×' + Math.round(h) + ' px' : ''; }

  // hidden pages get no animation frames, so fall back to a timer there
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    const run = () => { pending = false; render(); save(); };
    if (document.hidden) setTimeout(run, 0); else requestAnimationFrame(run);
  }

  // ---- lines editor ----
  function lineRow(line, i) {
    const row = document.createElement('div');
    row.className = 'line';
    row.dataset.id = line.id;
    row.innerHTML =
      '<div class="line-top"><input type="text" class="lt" autocomplete="off" enterkeyhint="done">' +
      '<button type="button" class="del" aria-label="حذف این خط">×</button></div>' +
      '<div class="line-ctl"><span class="lbl">اندازه</span><input type="range" class="ls" min="24" max="420">' +
      '<span class="num ls-o"></span><div class="seg mini">' +
      '<button type="button" data-a="right">راست</button><button type="button" data-a="center">وسط</button><button type="button" data-a="left">چپ</button>' +
      '</div></div>';
    const t = row.querySelector('.lt');
    t.value = line.text;
    t.setAttribute('aria-label', 'متن خط ' + (i + 1));
    t.placeholder = i === 0 ? 'یک کلمه بنویس' : 'متن این خط';
    row.querySelector('.ls').setAttribute('aria-label', 'اندازه‌ی خط ' + (i + 1));
    return row;
  }
  function byId(id) { return st.lines.find(l => l.id === id); }
  function buildLines() {
    const box = $('#lines');
    box.textContent = '';
    st.lines.forEach((l, i) => box.appendChild(lineRow(l, i)));
    syncLines();
  }
  function syncLines() {
    $$('.line').forEach(row => {
      const l = byId(row.dataset.id);
      if (!l) return;
      row.querySelector('.ls').value = l.size;
      row.querySelector('.ls-o').textContent = l.size;
      $$('button[data-a]', row).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.a === l.align)));
      row.querySelector('.del').hidden = st.lines.length < 2;
    });
    $('#add-line').hidden = st.lines.length >= MAX_LINES;
  }
  $('#lines').addEventListener('input', e => {
    const row = e.target.closest('.line');
    const l = row && byId(row.dataset.id);
    if (!l) return;
    if (e.target.classList.contains('lt')) l.text = e.target.value;
    if (e.target.classList.contains('ls')) { l.size = +e.target.value; row.querySelector('.ls-o').textContent = l.size; }
    schedule();
  });
  $('#lines').addEventListener('click', e => {
    const row = e.target.closest('.line');
    const l = row && byId(row.dataset.id);
    if (!l) return;
    const a = e.target.closest('button[data-a]');
    if (a) { l.align = a.dataset.a; syncLines(); schedule(); return; }
    if (e.target.closest('.del') && st.lines.length > 1) {
      st.lines = st.lines.filter(x => x !== l);
      buildLines(); schedule();
    }
  });
  $('#add-line').addEventListener('click', () => {
    if (st.lines.length >= MAX_LINES) return;
    const last = st.lines[st.lines.length - 1];
    st.lines.push(newLine('', Math.max(40, Math.round((last ? last.size : 220) * 0.35)), last ? last.align : 'center'));
    buildLines();
    const inputs = $$('.line .lt');
    inputs[inputs.length - 1].focus();
    schedule();
  });

  // ---- per-device memory ----
  let saveT = 0;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        const g = globals();
        localStorage.setItem(STORE, JSON.stringify({
          lines: st.lines.map(l => [l.text, l.size, l.align]),
          g: { top: g.top, bot: g.bot, edge: g.edge, shadow: g.shadow, stretch: g.stretch, track: g.track, gap: g.gap },
          preset: st.preset, color: st.color, fa: st.fa, en: st.en, q: st.q, bg: st.bg === 'photo' ? 'room' : st.bg
        }));
      } catch (e) { /* storage blocked */ }
    }, 300);
  }
  let pendingFonts = null;
  function restore() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { d = null; }
    if (!d || !Array.isArray(d.lines) || !d.lines.length) return false;
    st.lines = d.lines.slice(0, MAX_LINES).map(x => newLine(String(x[0] || ''), +x[1] || 220, x[2] || 'center'));
    const g = d.g || {};
    ['top', 'bot', 'edge', 'shadow', 'stretch', 'track', 'gap'].forEach(key => { if (g[key] !== undefined) $('#r-' + key).value = g[key]; });
    st.preset = PRESETS[d.preset] ? d.preset : 'glass';
    setColor(d.color || PRESETS[st.preset].color);
    setPressed($('#presets'), 'data-preset', st.preset);
    setSeg('#seg-fa', 'fa', FONTS[d.fa] ? d.fa : 'nimkat');
    setSeg('#seg-en', 'en', FONTS[d.en] ? d.en : 'inter');
    setSeg('#seg-q', 'q', String(d.q || 2));
    setBg(d.bg || 'room');
    // a user font comes back from IndexedDB later; reselect it then
    pendingFonts = { fa: d.fa, en: d.en };
    return true;
  }

  // ---- UI wiring ----
  function setPressed(group, attr, val) {
    $$('button[' + attr + ']', group).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val)));
  }
  function setSeg(sel, key, v) {
    st[key] = key === 'q' ? +v : v;
    setPressed($(sel), 'data-v', String(v));
  }
  function setBg(bg) {
    st.bg = bg;
    stage.dataset.bg = bg;
    if (bg !== 'photo') stage.style.backgroundImage = '';
    setPressed($('#bgpick'), 'data-bg', bg);
  }
  function setColor(hex) {
    st.color = hex.toUpperCase();
    $('#color').value = st.color;
    $('#o-color').textContent = st.color;
  }
  const SLIDERS = ['top', 'bot', 'edge', 'shadow', 'stretch', 'track', 'gap'];
  function outputs() { SLIDERS.forEach(key => { $('#o-' + key).textContent = num('#r-' + key) + '%'; }); }
  function applyPreset(name) {
    const p = PRESETS[name];
    st.preset = name;
    setColor(p.color);
    $('#r-top').value = p.top; $('#r-bot').value = p.bot; $('#r-edge').value = p.edge; $('#r-shadow').value = p.shadow;
    setPressed($('#presets'), 'data-preset', name);
    if (st.bg !== 'photo') setBg(p.bg);
    outputs(); schedule();
  }
  function applySample(name) {
    const s = SAMPLES[name];
    st.lines = s.lines.map(x => newLine(x[0], x[1], x[2]));
    $('#r-gap').value = s.gap;
    buildLines();
    applyPreset(s.preset);
  }

  SLIDERS.forEach(key => $('#r-' + key).addEventListener('input', () => { outputs(); schedule(); }));
  $('#color').addEventListener('input', e => { setColor(e.target.value); schedule(); });
  $('#presets').addEventListener('click', e => { const b = e.target.closest('button[data-preset]'); if (b) applyPreset(b.dataset.preset); });
  [['#seg-fa', 'fa'], ['#seg-en', 'en'], ['#seg-q', 'q']].forEach(([sel, key]) => {
    $(sel).addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) { setSeg(sel, key, b.dataset.v); schedule(); } });
  });
  $('#bgpick').addEventListener('click', e => { const b = e.target.closest('button[data-bg]'); if (b) { setBg(b.dataset.bg); save(); } });
  let photoUrl = '';
  $('#photo').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(f);
    stage.style.backgroundImage = 'url("' + photoUrl + '")';
    st.bg = 'photo'; stage.dataset.bg = 'photo';
    setPressed($('#bgpick'), 'data-bg', '');
  });
  $('#samples').addEventListener('click', e => { const b = e.target.closest('button[data-sample]'); if (b) applySample(b.dataset.sample); });

  // ---- saving: always a transparent PNG ----
  const toBlob = c => new Promise(res => c.toBlob(res, 'image/png'));
  const status = t => { $('#status').textContent = t; };
  let resultUrl = '';
  function showResult(blob) {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    $('#result-img').src = resultUrl;
    $('#result').hidden = false;
  }
  function fileName() {
    const first = (st.lines.find(l => l.text.trim()) || { text: '' }).text.trim();
    const slug = first.normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
    return 'shafaf-' + (slug || 'title') + '-' + stamp + '.png';
  }
  const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  $('#save').addEventListener('click', async () => {
    const btn = $('#save');
    btn.disabled = true;
    status('در حال ساخت…');
    try {
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* ignore */ } }
      if (!st.lines.some(l => l.text.trim())) { status('اول یک کلمه بنویس.'); return; }
      const c = render(document.createElement('canvas'), st.q);
      const blob = await toBlob(c);
      if (!blob) { status('ساخت عکس نشد. متن رو کوتاه‌تر کن و دوباره بزن.'); return; }
      const name = fileName();
      showResult(blob);
      const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
      if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          status('توی منو «Save Image» رو زدی؟ عکس الان توی گالریه.');
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') { status('لغو شد. عکس پایین صفحه هم آماده‌ست.'); return; }
        }
      }
      const a = document.createElement('a');
      a.href = resultUrl; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      status('دانلود شد: ' + name);
    } finally {
      btn.disabled = false;
    }
  });

  // ---- fonts the viewer adds: stored only in this browser, never uploaded ----
  const DB_NAME = 'shafaf-fonts';
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fonts', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  function idbRun(mode, fn) {
    return idb().then(db => new Promise((res, rej) => {
      const tx = db.transaction('fonts', mode);
      const out = fn(tx.objectStore('fonts'));
      tx.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      tx.onerror = () => rej(tx.error);
    }));
  }
  const fontMsg = t => { $('#font-msg').textContent = t; };

  async function addUserFont(rec) {
    const fam = 'ShafafUser_' + rec.id;
    const face = new FontFace(fam, rec.buf);
    await face.load();
    document.fonts.add(face);
    FONTS[rec.id] = { stack: '"' + fam + '", "Vazirmatn", "Inter Tight", sans-serif', weight: 'normal', user: true };
    ['#seg-fa', '#seg-en'].forEach(sel => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'user-font';
      b.dataset.v = rec.id;
      b.textContent = rec.name;
      b.title = rec.name;
      b.style.fontFamily = '"' + fam + '", sans-serif';
      b.setAttribute('aria-pressed', 'false');
      $(sel).appendChild(b);
    });
    $('#font-clear').hidden = false;
  }

  $('#font-file').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    fontMsg('در حال باز کردن فونت…');
    const rec = {
      id: 'u' + Date.now().toString(36),
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 28) || 'فونت من',
      buf: await file.arrayBuffer()
    };
    try {
      await addUserFont(rec);
    } catch (err) {
      fontMsg('این فایل فونت باز نشد. یک فایل ttf، otf، woff یا woff2 انتخاب کن.');
      return;
    }
    // put it on whichever script the first line is written in
    const first = (st.lines.find(l => l.text.trim()) || { text: '' }).text;
    const isFa = FA.test(first) || !first;
    setSeg(isFa ? '#seg-fa' : '#seg-en', isFa ? 'fa' : 'en', rec.id);
    schedule();
    try {
      await idbRun('readwrite', s => s.put(rec));
      fontMsg('«' + rec.name + '» اضافه شد. فقط توی مرورگر خودت می‌مونه و برای کسی فرستاده نمیشه.');
    } catch (err) {
      fontMsg('«' + rec.name + '» اضافه شد، ولی این مرورگر اجازه‌ی ذخیره نداد؛ دفعه‌ی بعد دوباره اضافه‌اش کن.');
    }
  });

  $('#font-clear').addEventListener('click', async () => {
    try { await idbRun('readwrite', s => s.clear()); } catch (err) { /* nothing stored */ }
    $$('button.user-font').forEach(b => b.remove());
    Object.keys(FONTS).forEach(k => { if (FONTS[k].user) delete FONTS[k]; });
    if (!FONTS[st.fa]) setSeg('#seg-fa', 'fa', 'nimkat');
    if (!FONTS[st.en]) setSeg('#seg-en', 'en', 'inter');
    $('#font-clear').hidden = true;
    fontMsg('فونت‌هات پاک شدن.');
    schedule();
  });

  async function loadSavedFonts() {
    if (!('indexedDB' in window) || typeof FontFace !== 'function') return;
    let recs = [];
    try { recs = await idbRun('readonly', s => s.getAll()) || []; } catch (err) { return; }
    for (const rec of recs) {
      try { await addUserFont(rec); } catch (err) { /* skip a broken file */ }
    }
    if (pendingFonts) {
      if (FONTS[pendingFonts.fa]) setSeg('#seg-fa', 'fa', pendingFonts.fa);
      if (FONTS[pendingFonts.en]) setSeg('#seg-en', 'en', pendingFonts.en);
    }
    if (recs.length) schedule();
  }

  // ---- start: one word, glass ----
  if (restore()) buildLines();
  else applySample('one');
  outputs();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  loadSavedFonts();
})();
