(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const FA = /[؀-ۿ]/;
  const TRACK = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
  const BASE = 220; // big-word size in px at 1x; 2x doubles everything
  const STORE = 'shafaf.v1';

  // single-weight Nimkat must not be asked for a bold weight, or the browser fakes one
  const FONTS = {
    nimkat:  { stack: '"Nimkat", "Vazirmatn", "Inter Tight", sans-serif', big: 'normal', small: 'normal' },
    vazir:   { stack: '"Vazirmatn", "Inter Tight", sans-serif', big: '900', small: '800' },
    inter:   { stack: '"Inter Tight", "Helvetica Neue", Arial, sans-serif', big: '800', small: '700' },
    poppins: { stack: '"Poppins", "Helvetica Neue", Arial, sans-serif', big: '700', small: '600' }
  };

  const PRESETS = {
    glass: { color: '#FFFFFF', top: 100, bot: 68, shadow: 25, subFade: false, bg: 'room' },
    frost: { color: '#FFFFFF', top: 58, bot: 50, shadow: 0, subFade: false, bg: 'room' },
    ink:   { color: '#1F1A17', top: 100, bot: 25, shadow: 0, subFade: true, bg: 'grey' },
    card:  { color: '#1F1A17', top: 100, bot: 100, shadow: 0, subFade: false, bg: 'yellow' }
  };

  const SAMPLES = {
    fa1:      { small: 'ببین چی می‌شه اگه', big: 'Claude', sub: 'سناریوهاتو بنویسه', sa: 'right', ba: 'right', preset: 'glass', tuck: 8 },
    fa2:      { small: 'کامنت کن', big: '«راهنما»', sub: 'تا برات بفرستم', sa: 'center', ba: 'center', preset: 'glass', tuck: 6 },
    fa3:      { small: 'لایه‌ی ۲', big: 'پلی‌بوک', sub: '', sa: 'right', ba: 'right', preset: 'ink', tuck: 6 },
    claude:   { small: 'Turn', big: 'Claude', sub: 'into a master scriptwriter', sa: 'left', ba: 'right', preset: 'glass', tuck: 12 },
    nova:     { small: 'comment', big: '“Nova”', sub: '', sa: 'center', ba: 'center', preset: 'glass', tuck: 8 },
    traction: { small: 'and when I got', big: 'traction', sub: '', sa: 'left', ba: 'center', preset: 'frost', tuck: 4 }
  };

  const st = {
    preset: 'glass', color: '#FFFFFF', subFade: false,
    sa: 'right', ba: 'right', bg: 'room',
    fa: 'nimkat', en: 'inter', q: 2
  };

  const cv = $('#cv');
  const stage = $('#stage');
  const mctx = document.createElement('canvas').getContext('2d');

  const num = id => +$(id).value;

  function read() {
    return {
      small: $('#in-small').value.trim(),
      big: $('#in-big').value.trim(),
      sub: $('#in-sub').value.trim(),
      top: num('#r-top'), bot: num('#r-bot'), track: num('#r-track'),
      shadow: num('#r-shadow'), tuck: num('#r-tuck'), gap: num('#r-gap'),
      color: st.color, subFade: st.subFade, sa: st.sa, ba: st.ba
    };
  }

  function lineFont(text, role, big) {
    const fa = FA.test(text);
    const f = FONTS[fa ? st.fa : st.en];
    const size = role === 'big' ? big : Math.round(big * 0.27);
    return { fa, size, css: (role === 'big' ? f.big : f.small) + ' ' + size + 'px ' + f.stack };
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

  // ask for each face once per text, redraw when it lands
  const asked = new Set();
  function ensureFont(css, text) {
    if (!text || !document.fonts) return;
    const key = css + '|' + text;
    if (asked.has(key)) return;
    asked.add(key);
    try { if (!document.fonts.check(css, text)) document.fonts.load(css, text).then(schedule, () => {}); } catch (e) { /* older browsers */ }
  }

  function render(target, scale) {
    const s = read();
    const out = target || cv;
    const BIG = BASE * (scale || 1);
    if (!s.big && !s.small && !s.sub) {
      out.width = 10; out.height = 10; out.getContext('2d').clearRect(0, 0, 10, 10);
      return out;
    }
    const big = s.big || ' ';
    const bigF = lineFont(big, 'big', BIG);
    const smF = lineFont(s.small, 'small', BIG);
    const subF = lineFont(s.sub, 'small', BIG);
    ensureFont(bigF.css, big); ensureFont(smF.css, s.small); ensureFont(subF.css, s.sub);

    const bm = meas(big, bigF, s.track);
    const cap = meas(bigF.fa ? 'ا' : 'H', bigF, 0).a;
    const sm = s.small ? meas(s.small, smF, s.track * 0.5) : null;
    const su = s.sub ? meas(s.sub, subF, s.track * 0.5) : null;

    // vertical, relative to the big word's baseline
    const bigTop = -Math.max(bm.a, cap * 0.7);
    const bigBot = Math.max(bm.d, 0);
    let top = bigTop, bot = bigBot, smBase = 0, suBase = 0;
    if (sm) { smBase = -cap * (1 - s.tuck / 100) - BIG * 0.035 - Math.max(sm.d, 0); top = Math.min(top, smBase - sm.a); }
    if (su) { suBase = bigBot + BIG * (s.gap / 100) + su.a; bot = Math.max(bot, suBase + Math.max(su.d, 0)); }

    // horizontal, the big word's ink spans 0..bw
    const bw = bm.l + bm.r;
    const place = (m, align) => {
      const w = m.l + m.r;
      const left = align === 'left' ? 0 : align === 'center' ? (bw - w) / 2 : bw - w;
      return { x: left + m.l, left, right: left + w };
    };
    const smP = sm ? place(sm, s.sa) : null;
    const suP = su ? place(su, s.ba) : null;
    let minX = 0, maxX = bw;
    [smP, suP].forEach(p => { if (p) { minX = Math.min(minX, p.left); maxX = Math.max(maxX, p.right); } });

    const pad = Math.round(BIG * 0.3);
    const W = Math.max(10, Math.ceil(maxX - minX + pad * 2));
    const H = Math.max(10, Math.ceil(bot - top + pad * 2));
    const ox = pad - minX, oy = pad - top;

    // big word on its own layer so only it gets the top-to-bottom fade
    const L1 = layer(W, H), L2 = layer(W, H);
    if (s.big) {
      setup(L1.ctx, bigF, s.track);
      L1.ctx.fillStyle = s.color;
      L1.ctx.fillText(big, ox + bm.l, oy);
      const g = L1.ctx.createLinearGradient(0, oy + bigTop, 0, oy + bigBot);
      g.addColorStop(0, 'rgba(0,0,0,' + (s.top / 100) + ')');
      g.addColorStop(1, 'rgba(0,0,0,' + (s.bot / 100) + ')');
      L1.ctx.globalCompositeOperation = 'destination-in';
      L1.ctx.fillStyle = g;
      L1.ctx.fillRect(0, 0, W, H);
    }
    L2.ctx.fillStyle = s.color;
    if (sm) { setup(L2.ctx, smF, s.track * 0.5); L2.ctx.globalAlpha = 1; L2.ctx.fillText(s.small, ox + smP.x, oy + smBase); }
    if (su) { setup(L2.ctx, subF, s.track * 0.5); L2.ctx.globalAlpha = s.subFade ? Math.max(0.2, s.bot / 100 + 0.15) : 1; L2.ctx.fillText(s.sub, ox + suP.x, oy + suBase); }

    out.width = W; out.height = H;
    const c = out.getContext('2d');
    c.clearRect(0, 0, W, H);
    if (s.shadow > 0) {
      c.shadowColor = 'rgba(0,0,0,' + (s.shadow / 100) + ')';
      c.shadowBlur = BIG * 0.12;
      c.shadowOffsetY = BIG * 0.025;
    }
    c.drawImage(L2.cv, 0, 0);
    c.drawImage(L1.cv, 0, 0);
    if (!target) cv.style.width = Math.min(94, W / 1080 * 100 * 0.82).toFixed(2) + '%';
    return out;
  }

  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; render(); save(); });
  }

  // ---- per-device memory of the last title ----
  let saveT = 0;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        const s = read();
        localStorage.setItem(STORE, JSON.stringify({
          small: s.small, big: s.big, sub: s.sub, top: s.top, bot: s.bot, track: s.track, shadow: s.shadow, tuck: s.tuck, gap: s.gap,
          preset: st.preset, color: st.color, subFade: st.subFade, sa: st.sa, ba: st.ba, fa: st.fa, en: st.en, q: st.q, bg: st.bg === 'photo' ? 'room' : st.bg
        }));
      } catch (e) { /* storage blocked */ }
    }, 300);
  }
  function restore() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { d = null; }
    if (!d) return false;
    $('#in-small').value = d.small || ''; $('#in-big').value = d.big || ''; $('#in-sub').value = d.sub || '';
    ['top', 'bot', 'track', 'shadow', 'tuck', 'gap'].forEach(k => { if (d[k] !== undefined) $('#r-' + k).value = d[k]; });
    st.preset = PRESETS[d.preset] ? d.preset : 'glass';
    st.subFade = !!d.subFade;
    setColor(d.color || PRESETS[st.preset].color);
    setPressed($('#presets'), 'data-preset', st.preset);
    setSeg('#seg-small', 'sa', d.sa || 'right');
    setSeg('#seg-sub', 'ba', d.ba || 'right');
    setSeg('#seg-fa', 'fa', FONTS[d.fa] ? d.fa : 'nimkat');
    setSeg('#seg-en', 'en', FONTS[d.en] ? d.en : 'inter');
    // a user font comes back from IndexedDB later; reselect it then
    pendingFonts = { fa: d.fa, en: d.en };
    setSeg('#seg-q', 'q', String(d.q || 2));
    setBg(d.bg || 'room');
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
  function outputs() {
    $('#o-top').textContent = num('#r-top') + '%';
    $('#o-bot').textContent = num('#r-bot') + '%';
    $('#o-track').textContent = num('#r-track') + '%';
    $('#o-shadow').textContent = num('#r-shadow') + '%';
    $('#o-tuck').textContent = num('#r-tuck') + '%';
    $('#o-gap').textContent = num('#r-gap') + '%';
  }
  function applyPreset(name) {
    const p = PRESETS[name];
    st.preset = name; st.subFade = p.subFade;
    setColor(p.color);
    $('#r-top').value = p.top; $('#r-bot').value = p.bot; $('#r-shadow').value = p.shadow;
    setPressed($('#presets'), 'data-preset', name);
    if (st.bg !== 'photo') setBg(p.bg);
    outputs(); schedule();
  }

  ['#in-small', '#in-big', '#in-sub'].forEach(id => $(id).addEventListener('input', schedule));
  ['#r-top', '#r-bot', '#r-track', '#r-shadow', '#r-tuck', '#r-gap'].forEach(id => $(id).addEventListener('input', () => { outputs(); schedule(); }));
  $('#color').addEventListener('input', e => { setColor(e.target.value); schedule(); });
  $('#presets').addEventListener('click', e => { const b = e.target.closest('button[data-preset]'); if (b) applyPreset(b.dataset.preset); });
  [['#seg-small', 'sa'], ['#seg-sub', 'ba'], ['#seg-fa', 'fa'], ['#seg-en', 'en'], ['#seg-q', 'q']].forEach(([sel, key]) => {
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
  $('#samples').addEventListener('click', e => {
    const b = e.target.closest('button[data-sample]');
    if (!b) return;
    const s = SAMPLES[b.dataset.sample];
    $('#in-small').value = s.small; $('#in-big').value = s.big; $('#in-sub').value = s.sub;
    $('#r-tuck').value = s.tuck;
    setSeg('#seg-small', 'sa', s.sa); setSeg('#seg-sub', 'ba', s.ba);
    applyPreset(s.preset);
  });

  // ---- saving ----
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
    const raw = $('#in-big').value.trim();
    const slug = raw.normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
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

  // ---- fonts the viewer adds, kept in this browser only ----
  let pendingFonts = null;
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
    FONTS[rec.id] = { stack: '"' + fam + '", "Vazirmatn", "Inter Tight", sans-serif', big: 'normal', small: 'normal', user: true };
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
    // put it on whichever script the main word is written in
    const isFa = FA.test($('#in-big').value);
    setSeg(isFa ? '#seg-fa' : '#seg-en', isFa ? 'fa' : 'en', rec.id);
    schedule();
    try {
      await idbRun('readwrite', s => s.put(rec));
      fontMsg('«' + rec.name + '» اضافه شد و روی این دستگاه می‌مونه.');
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

  // ---- start ----
  if (!restore()) {
    const s = SAMPLES.fa1;
    $('#in-small').value = s.small; $('#in-big').value = s.big; $('#in-sub').value = s.sub;
    $('#r-tuck').value = s.tuck;
    setSeg('#seg-small', 'sa', s.sa); setSeg('#seg-sub', 'ba', s.ba);
    applyPreset(s.preset);
  }
  outputs();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  loadSavedFonts();
})();
