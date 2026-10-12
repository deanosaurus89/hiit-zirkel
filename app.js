/* HIIT Zirkel – App-Logik */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const EXS = window.EXERCISES, BY = window.EX_BY_ID, CATS = window.CATS, EQUIP = window.EQUIP;
  const LS = { settings: 'hiit.settings.v1', plan: 'hiit.plan.v1', history: 'hiit.history.v1' };
  const PATTERN = ['cardio', 'lower', 'upper', 'core']; // Wechsel der Muskelgruppen wie im 7-Minuten-Workout
  const DEFAULTS = { count: 12, rounds: 2, work: 30, rest: 10, roundRest: 60, prep: 10,
    equipment: { chair: true, bars: false, wheel: false, band: false }, sound: true, voice: true };

  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privat */ } };

  const S = Object.assign({}, DEFAULTS, load(LS.settings, {}));
  S.equipment = Object.assign({}, DEFAULTS.equipment, S.equipment || {});
  let plan = load(LS.plan, []).filter((id) => BY[id]);

  const fmt = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + String(s).padStart(2, '0'); };
  const persist = () => { save(LS.settings, S); save(LS.plan, plan); };

  // ───────────── Übungsauswahl ─────────────
  const available = () => EXS.filter((e) => e.eq === 'none' || S.equipment[e.eq]);
  const weight = (e) => (e.eq === 'none' ? 1 : 1.7);
  function pickWeighted(list) {
    const tot = list.reduce((a, e) => a + weight(e), 0);
    let r = Math.random() * tot;
    for (const e of list) { r -= weight(e); if (r <= 0) return e; }
    return list[list.length - 1];
  }
  function pickFor(index, used, pool) {
    const cat = PATTERN[index % PATTERN.length];
    let cands = pool.filter((e) => e.cat === cat && !used.has(e.id));
    if (!cands.length) cands = pool.filter((e) => !used.has(e.id));
    if (!cands.length) cands = pool.filter((e) => e.cat === cat);
    if (!cands.length) cands = pool;
    return pickWeighted(cands);
  }
  function generatePlan(n) {
    const pool = available(), used = new Set(), out = [];
    for (let i = 0; i < n; i++) { const e = pickFor(i, used, pool); used.add(e.id); out.push(e.id); }
    // Jedes gewählte Gerät soll mindestens einmal vorkommen (wenn genug Plätze da sind)
    const eqs = Object.keys(S.equipment).filter((k) => S.equipment[k]);
    if (n >= 3) eqs.forEach((eq) => {
      if (out.some((id) => BY[id].eq === eq)) return;
      const cand = EXS.filter((e) => e.eq === eq && !out.includes(e.id));
      for (let i = 0; i < out.length && cand.length; i++) {
        const cur = BY[out[i]];
        const same = cand.filter((c) => c.cat === cur.cat);
        if (cur.eq === 'none' && same.length) { out[i] = same[Math.floor(Math.random() * same.length)].id; return; }
      }
    });
    return out;
  }
  function fitPlan() {
    const pool = available().map((e) => e.id);
    plan = plan.filter((id) => pool.includes(id));
    if (plan.length > S.count) plan = plan.slice(0, S.count);
    const used = new Set(plan);
    while (plan.length < S.count) { const e = pickFor(plan.length, used, available()); used.add(e.id); plan.push(e.id); }
  }
  function alternativesFor(id) {
    const cur = BY[id];
    return available().filter((e) => e.id !== id).sort((a, b) =>
      (b.cat === cur.cat) - (a.cat === cur.cat) || (plan.includes(a.id) - plan.includes(b.id)) || a.name.localeCompare(b.name, 'de'));
  }

  const totalSeconds = () => S.prep + S.rounds * (S.count * S.work + Math.max(0, S.count - 1) * S.rest) + Math.max(0, S.rounds - 1) * S.roundRest;

  // ───────────── Kleine UI-Helfer ─────────────
  const ICONS = {
    body: '<svg viewBox="0 0 32 32"><circle cx="16" cy="6" r="3"/><path d="M16 10v9M9 13l7 2 7-2M12 29l4-10 4 10"/></svg>',
    chair: '<svg viewBox="0 0 32 32"><path d="M10 4v24M10 17h13v11M10 17h13"/></svg>',
    bars: '<svg viewBox="0 0 32 32"><path d="M3 26l3-9h6l3 9M17 26l3-9h6l3 9M6 17h6M20 17h6"/></svg>',
    wheel: '<svg viewBox="0 0 32 32"><circle cx="16" cy="18" r="8"/><circle cx="16" cy="18" r="2"/><path d="M3 18h5M24 18h5"/></svg>',
    band: '<svg viewBox="0 0 32 32"><path d="M5 26C5 12 9 6 13 6s4 8 3 12-1 10 3 10 8-6 8-22"/></svg>'
  };
  const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>';
  const SWAP = '<svg viewBox="0 0 24 24"><path d="M7 7h13l-4-4M17 17H4l4 4"/></svg>';
  const PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24"><path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z"/></svg>';
  const VOICE_ON = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const VOICE_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/></svg>';
  const levelTxt = (l) => ['', 'Leicht', 'Mittel', 'Schwer'][l] || '';

  function tagsHTML(e, opts = {}) {
    const c = CATS[e.cat];
    let h = `<span class="tag cat" style="background:${c.color}">${c.label}</span>`;
    if (e.eq !== 'none') h += `<span class="tag eq">${EQUIP[e.eq].label}</span>`;
    if (opts.level !== false) h += `<span class="tag lvl">${levelTxt(e.level)}</span>`;
    if (e.sides && opts.sides !== false) h += '<span class="tag">Seitenwechsel</span>';
    return h;
  }
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function legendHTML(e, compact) {
    let h = `<span class="lg"><i class="dot p"></i>${compact ? '' : '<b>Hauptmuskeln:</b> '}${esc(e.muscles)}</span>`;
    if (e.muscles2) h += `<span class="lg"><i class="dot s"></i>${compact ? '' : '<b>Hilfsmuskeln:</b> '}${esc(e.muscles2)}</span>`;
    return h;
  }
  function guideHTML(e) {
    if (!e.steps) return `<p class="d-desc">${esc(e.desc)}</p><div class="tipbox"><b>Technik-Tipp</b><span>${esc(e.tip)}</span></div>`;
    let h = `<div class="g-block"><h4>Ausgangsposition</h4><p>${esc(e.start)}</p></div>`;
    h += `<div class="g-block"><h4>Ausführung</h4><ol class="steps">${e.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>`;
    h += `<div class="g-block safe"><h4>Sicherheit &amp; Technik</h4><ul>${e.safe.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
    if (e.easy) h += `<div class="g-block easy"><h4>Leichtere Variante</h4><p>${esc(e.easy)}</p></div>`;
    if (e.sides) h += '<p class="g-note">Nach der Hälfte der Zeit die Seite wechseln.</p>';
    return h;
  }
  function playerInfoHTML(e, preview) {
    if (!e.steps) return `<p>${esc(e.desc)}</p><p class="tip">💡 ${esc(e.tip)}</p>`;
    let h = '';
    if (preview) h += `<p class="pi-start"><b>Start:</b> ${esc(e.start)}</p>`;
    h += `<ol class="steps">${e.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`;
    h += `<p class="tip">⚠︎ ${esc(e.safe[0])}</p>`;
    if (preview && e.safe[1]) h += `<p class="tip">⚠︎ ${esc(e.safe[1])}</p>`;
    if (preview && e.easy) h += `<p class="pi-easy"><b>Leichter:</b> ${esc(e.easy)}</p>`;
    h += '<span class="pi-more">Tippen zum Vergrößern</span>';
    return h;
  }
  function thumbSVG(e) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Figure.renderStatic(s, e);
    return s;
  }
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
  const haptic = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* */ } };

  // ───────────── Setup-Bildschirm ─────────────
  const STEPPERS = [
    { key: 'count', label: 'Übungen', hint: 'pro Runde', min: 1, max: 15, step: 1, unit: '' },
    { key: 'rounds', label: 'Runden', hint: 'Durchläufe', min: 1, max: 10, step: 1, unit: '' },
    { key: 'work', label: 'Belastung', hint: 'pro Übung', min: 10, max: 120, step: 5, unit: 's' },
    { key: 'rest', label: 'Pause', hint: 'zwischen Übungen', min: 0, max: 60, step: 5, unit: 's' },
    { key: 'roundRest', label: 'Rundenpause', hint: 'zwischen Runden', min: 0, max: 180, step: 15, unit: 's' }
  ];
  function stepperRow(def, container) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="row-label">${def.label}<small>${def.hint}</small></div>
      <div class="stepper"><button aria-label="${def.label} verringern">−</button><div class="val" aria-live="polite"></div><button aria-label="${def.label} erhöhen">+</button></div>`;
    const [minus, plus] = row.querySelectorAll('button');
    const val = row.querySelector('.val');
    const show = () => { val.innerHTML = S[def.key] + (def.unit ? `<i>${def.unit}</i>` : ''); minus.disabled = S[def.key] <= def.min; plus.disabled = S[def.key] >= def.max; };
    const change = (d) => {
      const v = Math.min(def.max, Math.max(def.min, S[def.key] + d * def.step));
      if (v === S[def.key]) return false;
      S[def.key] = v; show(); haptic(); onSettingsChanged(def.key); return true;
    };
    [[minus, -1], [plus, 1]].forEach(([b, d]) => {
      let t1, t2;
      const stop = () => { clearTimeout(t1); clearInterval(t2); };
      b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); change(d); t1 = setTimeout(() => { t2 = setInterval(() => { if (!change(d)) stop(); }, 90); }, 420); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => b.addEventListener(n, stop));
      b.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); change(d); } });
    });
    show();
    row._show = show;
    container.appendChild(row);
    return row;
  }
  function switchRow(label, hint, key, container) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="row-label">${label}<small>${hint}</small></div><button class="switch" role="switch" aria-label="${label}"></button>`;
    const sw = row.querySelector('.switch');
    const show = () => sw.setAttribute('aria-checked', String(!!S[key]));
    sw.addEventListener('click', () => { S[key] = !S[key]; show(); persist(); haptic(); if (key === 'voice' && S.voice) { unlockAudio(); speak('Sprachansage an'); } });
    show(); container.appendChild(row);
  }
  let stepRows = [];
  function renderSetup() {
    const st = $('#steppers'); st.innerHTML = '';
    stepRows = STEPPERS.map((d) => stepperRow(d, st));
    const op = $('#options'); op.innerHTML = '';
    stepperRow({ key: 'prep', label: 'Vorbereitung', hint: 'Countdown vor dem Start', min: 0, max: 30, step: 5, unit: 's' }, op);
    switchRow('Signaltöne', 'Piepen in den letzten 3 Sekunden', 'sound', op);
    switchRow('Sprachansage', 'Übungen auf Deutsch ansagen', 'voice', op);
    renderEquip(); renderPlan(); renderSummaryLine(); renderHistoryLine();
  }
  function renderEquip() {
    const g = $('#equip'); g.innerHTML = '';
    Object.keys(EQUIP).forEach((k) => {
      const on = k === 'none' || S.equipment[k];
      const n = EXS.filter((e) => e.eq === k).length;
      const b = document.createElement('button');
      b.className = 'equip' + (on ? ' on' : '') + (k === 'none' ? ' locked' : '');
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = `<span class="check">${CHECK}</span><span class="ico">${ICONS[EQUIP[k].icon]}</span><span><div class="lbl">${EQUIP[k].label}</div><div class="cnt">${k === 'none' ? 'immer dabei · ' : ''}${n} Übungen</div></span>`;
      b.addEventListener('click', () => {
        if (k === 'none') { toast('Körpergewicht-Übungen sind immer dabei'); return; }
        S.equipment[k] = !S.equipment[k]; haptic();
        plan = generatePlan(S.count); persist(); renderEquip(); renderPlan();
        toast(S.equipment[k] ? `${EQUIP[k].label} hinzugefügt – Übungen neu gemischt` : `${EQUIP[k].label} entfernt`);
      });
      g.appendChild(b);
    });
  }
  function planItem(id, i, opts = {}) {
    const e = BY[id];
    const li = document.createElement('li');
    li.className = 'item';
    li.style.animationDelay = Math.min(i, 12) * 25 + 'ms';
    li.innerHTML = `${opts.num !== false ? `<span class="num">${i + 1}</span>` : ''}<button class="main-btn"><span class="thumb"></span><span class="meta"><div class="nm">${e.name}</div><div class="tags">${tagsHTML(e, { level: !!opts.level, sides: false })}</div></span></button>${opts.swap ? `<button class="swap" aria-label="${e.name} zufällig austauschen">${SWAP}</button>` : ''}`;
    li.querySelector('.thumb').appendChild(thumbSVG(e));
    li.querySelector('.main-btn').addEventListener('click', () => opts.onOpen ? opts.onOpen(id, i) : openDetail(id));
    if (opts.swap) li.querySelector('.swap').addEventListener('click', () => quickSwap(i));
    return li;
  }
  function renderPlan() {
    const ol = $('#plan'); ol.innerHTML = '';
    plan.forEach((id, i) => ol.appendChild(planItem(id, i, { swap: true, onOpen: (pid, idx) => openDetail(pid, idx) })));
  }
  function quickSwap(i) {
    const cur = BY[plan[i]];
    const cands = available().filter((e) => e.cat === cur.cat && !plan.includes(e.id));
    const pool = cands.length ? cands : available().filter((e) => !plan.includes(e.id));
    if (!pool.length) { toast('Keine weitere Übung verfügbar'); return; }
    plan[i] = pickWeighted(pool).id; persist(); renderPlan(); haptic(12);
    toast(`${cur.name} → ${BY[plan[i]].name}`);
  }
  function renderSummaryLine() {
    const t = totalSeconds();
    $('#total-time').innerHTML = fmt(t) + '<small>min</small>';
    $('#total-meta').textContent = `${S.count} Übung${S.count > 1 ? 'en' : ''} × ${S.work} s · ${S.rounds} Runde${S.rounds > 1 ? 'n' : ''} · ${S.rest} s Pause`;
    $('#btn-start span').textContent = `Training starten · ${fmt(t)}`;
    document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', matchesPreset(b.dataset.preset)));
  }
  function renderHistoryLine() {
    const h = load(LS.history, []);
    if (!h.length) return;
    const last = new Date(h[h.length - 1].date);
    const d = last.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    $('#history-line').textContent = `${h.length} Workout${h.length > 1 ? 's' : ''} absolviert · zuletzt ${d}`;
  }
  const PRESETS = {
    classic: { count: 12, rounds: 1, work: 30, rest: 10, roundRest: 60 },
    tabata: { count: 8, rounds: 2, work: 20, rest: 10, roundRest: 60 },
    long: { count: 14, rounds: 2, work: 30, rest: 10, roundRest: 60 }
  };
  const matchesPreset = (k) => Object.keys(PRESETS[k]).every((p) => S[p] === PRESETS[k][p]);
  function applyPreset(k) {
    const p = PRESETS[k]; const countChanged = p.count !== S.count;
    Object.assign(S, p);
    stepRows.forEach((r) => r._show());
    if (k === 'classic') plan = classicPlan(); else if (countChanged) fitPlan();
    persist(); renderPlan(); renderSummaryLine(); haptic();
    toast(k === 'classic' ? 'Original 7-Minuten-Workout (ACSM)' : 'Vorlage übernommen');
  }
  function classicPlan() {
    // Originalreihenfolge nach Klika & Jordan (ACSM Health & Fitness Journal, 2013)
    const orig = ['hampelmann', 'wandsitzen', 'liegestuetz', 'crunch', 'aufsteigen', 'kniebeuge', 'dips', 'unterarmstuetz', 'kniehebelauf', 'ausfallschritt', 'liegestuetz-rotation', 'seitstuetz'];
    if (S.equipment.chair) return orig;
    const subst = { wandsitzen: 'sumo-kniebeuge', aufsteigen: 'burpee', dips: 'pike-liegestuetz' };
    return orig.map((id) => subst[id] || id);
  }
  function onSettingsChanged(key) {
    if (key === 'count') { fitPlan(); renderPlan(); }
    persist(); renderSummaryLine();
  }

  // ───────────── Sheets ─────────────
  let openSheetEl = null;
  function openSheet(el) {
    openSheetEl = el; $('#backdrop').classList.add('show'); el.classList.add('show');
  }
  function closeSheet() {
    if (!openSheetEl) return;
    const el = openSheetEl; openSheetEl = null;
    el.classList.remove('show');
    if (!document.querySelector('.sheet.show')) $('#backdrop').classList.remove('show');
    setTimeout(() => Figure.stopAll(el), 450);
  }
  let libReturn = false;
  function openDetail(id, planIdx) {
    const e = BY[id];
    const sheet = $('#sheet-detail');
    if (openSheetEl === $('#sheet-library')) { libReturn = true; $('#sheet-library').classList.remove('show'); } else libReturn = false;
    Figure.stopAll(sheet);
    Figure.animate($('#d-figure'), e);
    $('#d-name').textContent = e.name;
    $('#d-en').textContent = e.en;
    $('#d-tags').innerHTML = tagsHTML(e);
    $('#d-legend').innerHTML = legendHTML(e);
    $('#d-guide').innerHTML = guideHTML(e);
    const wrap = $('#d-swap-wrap');
    if (planIdx != null) {
      wrap.classList.remove('hidden');
      const ol = $('#d-swap'); ol.innerHTML = '';
      alternativesFor(id).slice(0, 24).forEach((alt, i) => ol.appendChild(planItem(alt.id, i, { num: false, level: true, onOpen: (aid) => {
        plan[planIdx] = aid; persist(); renderPlan(); closeSheet(); haptic(12); toast(`Getauscht: ${BY[aid].name}`);
      } })));
    } else wrap.classList.add('hidden');
    sheet.querySelector('.sheet-scroll').scrollTop = 0;
    openSheet(sheet);
  }
  let libFilter = 'all';
  function openLibrary() { renderLibrary(); openSheet($('#sheet-library')); }
  function renderLibrary() {
    const f = $('#lib-filters'); f.innerHTML = '';
    [['all', 'Alle']].concat(Object.keys(EQUIP).map((k) => [k, EQUIP[k].label])).forEach(([k, l]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (libFilter === k ? ' on' : ''); b.textContent = l;
      b.addEventListener('click', () => { libFilter = k; renderLibrary(); });
      f.appendChild(b);
    });
    const list = EXS.filter((e) => libFilter === 'all' || e.eq === libFilter);
    $('#lib-count').textContent = `${list.length} von ${EXS.length} Übungen · mit Animation & Anleitung`;
    const ol = $('#lib-list'); ol.innerHTML = '';
    list.forEach((e, i) => ol.appendChild(planItem(e.id, i, { num: false, level: true })));
  }

  // ───────────── Audio & Sprache ─────────────
  let actx = null;
  function unlockAudio() {
    try {
      if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); }
      if (actx && actx.state === 'suspended') actx.resume();
      if (actx) { const b = actx.createBuffer(1, 1, 22050); const s = actx.createBufferSource(); s.buffer = b; s.connect(actx.destination); s.start(0); }
    } catch (e) { /* */ }
    try { if ('speechSynthesis' in window && S.voice) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch (e) { /* */ }
  }
  function tone(freq, dur, when = 0, vol = 0.32, type = 'sine') {
    if (!S.sound || !actx) return;
    try {
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime + when;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* */ }
  }
  const SND = {
    tick: () => tone(740, 0.12, 0, 0.3, 'triangle'),
    work: () => { tone(880, 0.12, 0, 0.35, 'square'); tone(1320, 0.28, 0.13, 0.32, 'square'); },
    rest: () => { tone(660, 0.16, 0, 0.3, 'triangle'); tone(440, 0.3, 0.17, 0.3, 'triangle'); },
    side: () => { tone(990, 0.1, 0, 0.3); tone(990, 0.1, 0.16, 0.3); },
    done: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, i * 0.14, 0.3, 'triangle')); }
  };
  let deVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices().filter((v) => /^de(-|_|$)/i.test(v.lang));
    deVoice = vs.find((v) => /anna|helena|petra|markus|google deutsch/i.test(v.name)) || vs.find((v) => v.localService) || vs[0] || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text) {
    if (!S.voice || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE'; if (deVoice) u.voice = deVoice; u.rate = 1.04; u.pitch = 1; u.volume = 1;
      speechSynthesis.speak(u);
    } catch (e) { /* */ }
  }

  // ───────────── Wake Lock ─────────────
  let wakeLock = null;
  async function lockScreen() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { wakeLock = null; }
  }
  function unlockScreen() { try { wakeLock && wakeLock.release(); } catch (e) { /* */ } wakeLock = null; }

  // ───────────── Player ─────────────
  const P = { phases: [], i: 0, endAt: 0, dur: 0, paused: false, pauseLeft: 0, lastSec: null, half: false, timer: null, startedAt: 0, workSec: 0, done: [], anim: null, total: 0, active: false };
  function buildPhases() {
    const ph = [];
    if (S.prep > 0) ph.push({ type: 'prep', dur: S.prep, ex: plan[0], round: 0, idx: 0 });
    for (let r = 0; r < S.rounds; r++) {
      plan.forEach((id, i) => {
        ph.push({ type: 'work', dur: S.work, ex: id, round: r, idx: i });
        const last = i === plan.length - 1;
        if (!last && S.rest > 0) ph.push({ type: 'rest', dur: S.rest, ex: plan[i + 1], round: r, idx: i + 1 });
        if (last && r < S.rounds - 1 && S.roundRest > 0) ph.push({ type: 'roundRest', dur: S.roundRest, ex: plan[0], round: r + 1, idx: 0 });
      });
    }
    return ph;
  }
  function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); }

  function startWorkout() {
    if (!plan.length) return;
    unlockAudio();
    P.phases = buildPhases(); P.total = P.phases.reduce((a, p) => a + p.dur, 0);
    P.startedAt = Date.now(); P.workSec = 0; P.done = []; P.paused = false; P.active = true;
    $('#paused-overlay').classList.add('hidden');
    renderVoiceBtn();
    show('screen-player');
    lockScreen();
    enterPhase(0, performance.now());
    clearInterval(P.timer); P.timer = setInterval(tick, 100);
  }
  function phaseLabel(ph) {
    return { prep: 'Mach dich bereit', work: 'Los geht’s', rest: 'Pause', roundRest: 'Rundenpause' }[ph.type];
  }
  function enterPhase(i, startTs, silent) {
    P.i = i; const ph = P.phases[i];
    P.dur = ph.dur; P.endAt = startTs + ph.dur * 1000; P.lastSec = Math.ceil(ph.dur); P.half = false;
    const e = BY[ph.ex];
    const scr = $('#screen-player');
    scr.dataset.phase = ph.type;
    $('#p-phase').textContent = phaseLabel(ph);
    $('#p-round').textContent = `Runde ${ph.round + 1}/${S.rounds}`;
    $('#p-index').textContent = `Übung ${ph.idx + 1}/${plan.length}`;
    $('#p-next-label').textContent = ph.type === 'prep' ? 'Erste Übung' : 'Als Nächstes';
    $('#p-name').textContent = e.name;
    $('#p-tags').innerHTML = tagsHTML(e, { level: false });
    $('#p-legend').innerHTML = legendHTML(e, true);
    $('#p-info').innerHTML = playerInfoHTML(e, ph.type !== 'work');
    $('#p-info').scrollTop = 0;
    $('#p-sides').classList.add('hidden');
    if (!P.anim || P.anim.ex !== e.id) { Figure.stopAll($('#screen-player')); P.anim = Figure.animate($('#p-figure'), e); P.anim.ex = e.id; }
    renderTime(ph.dur);
    if (silent) return;
    if (ph.type === 'work') {
      SND.work();
      const prev = P.phases[i - 1];
      speak(prev && prev.type !== 'work' ? 'Los!' : `${e.name}. Los!`);
    } else if (ph.type === 'rest') {
      SND.rest(); speak(`Pause. Als Nächstes: ${e.name}.`);
    } else if (ph.type === 'roundRest') {
      SND.rest(); speak(`Runde ${ph.round} geschafft. Pause. Danach: ${e.name}.`);
    } else if (ph.type === 'prep') {
      speak(`Mach dich bereit. Erste Übung: ${e.name}.`);
    }
  }
  function renderTime(left) {
    const sec = Math.max(0, Math.ceil(left - 0.001));
    const num = $('#p-time');
    const txt = sec >= 60 ? fmt(sec) : String(sec);
    if (num.textContent !== txt) {
      num.textContent = txt;
      num.classList.toggle('warn', sec <= 3 && sec > 0);
      if (sec <= 3) { num.classList.remove('warn'); void num.offsetWidth; num.classList.add('warn'); }
    }
    num.style.fontSize = sec >= 60 ? '38px' : '';
    const frac = P.dur ? Math.min(1, Math.max(0, left / P.dur)) : 0;
    $('#ring-fg').style.strokeDashoffset = (326.73 * (1 - frac)).toFixed(2);
    let el = 0; for (let k = 0; k < P.i; k++) el += P.phases[k].dur;
    el += P.dur - left;
    $('#p-progress-bar').style.width = (100 * el / P.total).toFixed(2) + '%';
  }
  function tick() {
    if (!P.active || P.paused) return;
    const now = performance.now();
    let left = (P.endAt - now) / 1000;
    let guard = 0;
    while (left <= 0 && guard++ < 500) {
      const ph = P.phases[P.i];
      if (ph.type === 'work') { P.workSec += ph.dur; P.done.push(ph.ex); }
      if (P.i >= P.phases.length - 1) { finish(); return; }
      const nextStart = P.endAt;
      const catchingUp = now - nextStart > 1500; // z. B. nach Hintergrund – keine Ansagen-Lawine
      enterPhase(P.i + 1, nextStart, catchingUp);
      left = (P.endAt - now) / 1000;
    }
    const ph = P.phases[P.i];
    const sec = Math.ceil(left);
    if (sec !== P.lastSec) {
      P.lastSec = sec;
      if (sec <= 3 && sec >= 1 && ph.dur > 3) SND.tick();
    }
    if (ph.type === 'work' && BY[ph.ex].sides && !P.half && left <= ph.dur / 2) {
      P.half = true; SND.side(); speak('Seite wechseln!');
      const sd = $('#p-sides'); sd.classList.remove('hidden'); setTimeout(() => sd.classList.add('hidden'), 2500);
    }
    renderTime(left);
  }
  function setPaused(v) {
    if (!P.active || P.paused === v) return;
    P.paused = v;
    if (v) { P.pauseLeft = (P.endAt - performance.now()) / 1000; speechSynthesis && speechSynthesis.cancel && speechSynthesis.cancel(); }
    else { P.endAt = performance.now() + P.pauseLeft * 1000; unlockAudio(); lockScreen(); }
    P.anim && P.anim.pause(v);
    $('#paused-overlay').classList.toggle('hidden', !v);
    renderPauseBtn();
  }
  function renderPauseBtn() { const b = $('#btn-pause'); b.innerHTML = P.paused ? PLAY : PAUSE; b.setAttribute('aria-label', P.paused ? 'Weiter' : 'Pause'); }
  function renderVoiceBtn() { const b = $('#btn-voice'); b.innerHTML = S.voice ? VOICE_ON : VOICE_OFF; b.style.color = S.voice ? '' : 'var(--dim)'; }
  function jump(to) {
    const was = P.paused;
    to = Math.max(0, Math.min(P.phases.length - 1, to));
    enterPhase(to, performance.now());
    if (was) { P.pauseLeft = P.dur; }
  }
  function skip() {
    const ph = P.phases[P.i];
    if (ph.type === 'work') { P.workSec += Math.max(0, ph.dur - (P.paused ? P.pauseLeft : (P.endAt - performance.now()) / 1000)); }
    if (P.i >= P.phases.length - 1) { finish(); return; }
    haptic(); jump(P.i + 1);
  }
  function back() {
    const ph = P.phases[P.i];
    const elapsed = ph.dur - (P.paused ? P.pauseLeft : (P.endAt - performance.now()) / 1000);
    haptic();
    if (ph.type === 'work' && elapsed > 3) { jump(P.i); return; }
    for (let k = P.i - 1; k >= 0; k--) if (P.phases[k].type === 'work') { jump(k); return; }
    jump(0);
  }
  function stopPlayer() {
    P.active = false; clearInterval(P.timer); Figure.stopAll($('#screen-player')); P.anim = null; unlockScreen();
    try { speechSynthesis.cancel(); } catch (e) { /* */ }
  }
  function finish() {
    const work = P.workSec;
    const real = Math.round((Date.now() - P.startedAt) / 1000);
    stopPlayer();
    SND.done(); speak('Geschafft! Starke Leistung.');
    const h = load(LS.history, []);
    h.push({ date: new Date().toISOString(), duration: real, work, exercises: P.done.length, rounds: S.rounds });
    save(LS.history, h.slice(-100));
    renderHistoryLine();
    $('#sum-sub').textContent = ['Starke Leistung!', 'Super gemacht – weiter so!', 'Dein Körper sagt danke.', 'Wieder ein Stück fitter.'][Math.floor(Math.random() * 4)];
    $('#sum-stats').innerHTML = [
      [fmt(real), 'Gesamtzeit'], [fmt(work), 'Belastung'],
      [P.done.length, 'Übungen absolviert'], [h.length, h.length === 1 ? 'Workout gesamt' : 'Workouts gesamt']
    ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
    const ol = $('#sum-list'); ol.innerHTML = '';
    const uniq = [...new Set(P.done)];
    (uniq.length ? uniq : plan).forEach((id, i) => ol.appendChild(planItem(id, i, { onOpen: (x) => openDetail(x) })));
    show('screen-summary');
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && P.active) { lockScreen(); tick(); }
  });

  // ───────────── Events ─────────────
  $('#btn-start').addEventListener('click', startWorkout);
  $('#btn-shuffle').addEventListener('click', () => { plan = generatePlan(S.count); persist(); renderPlan(); haptic(12); toast('Neu gemischt'); });
  $('#btn-library').addEventListener('click', openLibrary);
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
  $('#backdrop').addEventListener('click', () => { libReturn = false; closeSheet(); });
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
    const fromDetail = openSheetEl === $('#sheet-detail');
    closeSheet();
    if (fromDetail && libReturn) { libReturn = false; openSheet($('#sheet-library')); }
  }));
  $('#btn-pause').addEventListener('click', () => { haptic(); setPaused(!P.paused); });
  $('#btn-resume').addEventListener('click', () => setPaused(false));
  $('#btn-next').addEventListener('click', skip);
  $('#btn-prev').addEventListener('click', back);
  $('#p-info').addEventListener('click', () => { $('#screen-player').classList.toggle('info-open'); haptic(6); });
  $('#btn-voice').addEventListener('click', () => { S.voice = !S.voice; persist(); renderVoiceBtn(); if (S.voice) speak('Sprachansage an'); else try { speechSynthesis.cancel(); } catch (e) { /* */ } renderSetup(); });
  $('#btn-close').addEventListener('click', () => {
    const wasPaused = P.paused; setPaused(true);
    if (confirm('Training beenden?')) { stopPlayer(); show('screen-setup'); } else if (!wasPaused) setPaused(false);
  });
  $('#btn-again').addEventListener('click', startWorkout);
  $('#btn-done').addEventListener('click', () => show('screen-setup'));
  document.addEventListener('keydown', (ev) => {
    if (!P.active) { if (ev.key === 'Escape') closeSheet(); return; }
    if (ev.key === ' ') { ev.preventDefault(); setPaused(!P.paused); }
    if (ev.key === 'ArrowRight') skip();
    if (ev.key === 'ArrowLeft') back();
  });

  // ───────────── Init ─────────────
  if (plan.length !== S.count) { if (!plan.length) plan = generatePlan(S.count); else fitPlan(); }
  persist();
  renderSetup();
  renderPauseBtn();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  // Test-/Debug-Zugriff
  window.HIIT = { S, get plan() { return plan; }, P, generatePlan, available, totalSeconds, buildPhases, openDetail };
})();
