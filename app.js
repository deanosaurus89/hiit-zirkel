/* HIIT Zirkel – App-Logik */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const EXS = window.EXERCISES, BY = window.EX_BY_ID, CATS = window.CATS, EQUIP = window.EQUIP;
  const LS = { settings: 'hiit.settings.v1', plan: 'hiit.plan.v1', history: 'hiit.history.v1', planx: 'hiit.planx.v1', plans: 'hiit.plans.v1', active: 'hiit.activeplan.v1' };
  const PATTERN = ['cardio', 'lower', 'upper', 'core']; // Wechsel der Muskelgruppen wie im 7-Minuten-Workout
  const DEFAULTS = { count: 12, rounds: 2, work: 30, rest: 10, roundRest: 60, prep: 10,
    equipment: { chair: true, bars: false, wheel: false, band: false, board: false, rings: false }, sound: true, voice: true };

  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privat */ } };

  const S = Object.assign({}, DEFAULTS, load(LS.settings, {}));
  S.equipment = Object.assign({}, DEFAULTS.equipment, S.equipment || {});
  let plan = load(LS.plan, []);
  // pX[i]: optionale Einstellungen je Übung – null | { dur: Sek. } | { reps: Anzahl }
  let pX = load(LS.planx, []);
  pX = plan.map((id, i) => pX[i] || null).filter((x, i) => BY[plan[i]]);
  plan = plan.filter((id) => BY[id]);
  let plans = load(LS.plans, []).filter((q) => q && Array.isArray(q.items));
  let activeId = load(LS.active, null);
  let editMode = false;
  const setPlan = (ids, xs) => { plan = ids; pX = xs || ids.map(() => null); };

  const fmt = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + String(s).padStart(2, '0'); };
  const persist = () => { save(LS.settings, S); save(LS.plan, plan); save(LS.planx, pX); save(LS.active, activeId); };
  const persistPlans = () => save(LS.plans, plans);

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
    const keep = plan.map((id, i) => i).filter((i) => pool.includes(plan[i]));
    setPlan(keep.map((i) => plan[i]), keep.map((i) => pX[i] || null));
    if (plan.length > S.count) setPlan(plan.slice(0, S.count), pX.slice(0, S.count));
    const used = new Set(plan);
    while (plan.length < S.count) { const e = pickFor(plan.length, used, available()); used.add(e.id); plan.push(e.id); pX.push(null); }
  }
  function alternativesFor(id) {
    const cur = BY[id];
    return available().filter((e) => e.id !== id).sort((a, b) =>
      (b.cat === cur.cat) - (a.cat === cur.cat) || (plan.includes(a.id) - plan.includes(b.id)) || a.name.localeCompare(b.name, 'de'));
  }

  const itemDur = (i) => (pX[i] && pX[i].dur) || S.work; // Wiederholungen: Schätzung = Standard-Arbeitszeit
  const totalSeconds = () => { const n = plan.length; let w = 0; for (let i = 0; i < n; i++) w += itemDur(i); return S.prep + S.rounds * (w + Math.max(0, n - 1) * S.rest) + Math.max(0, S.rounds - 1) * S.roundRest; };

  // ───────────── Kleine UI-Helfer ─────────────
  const ICONS = {
    body: '<svg viewBox="0 0 32 32"><circle cx="16" cy="6" r="3"/><path d="M16 10v9M9 13l7 2 7-2M12 29l4-10 4 10"/></svg>',
    chair: '<svg viewBox="0 0 32 32"><path d="M10 4v24M10 17h13v11M10 17h13"/></svg>',
    bars: '<svg viewBox="0 0 32 32"><path d="M3 26l3-9h6l3 9M17 26l3-9h6l3 9M6 17h6M20 17h6"/></svg>',
    wheel: '<svg viewBox="0 0 32 32"><circle cx="16" cy="18" r="8"/><circle cx="16" cy="18" r="2"/><path d="M3 18h5M24 18h5"/></svg>',
    band: '<svg viewBox="0 0 32 32"><path d="M5 26C5 12 9 6 13 6s4 8 3 12-1 10 3 10 8-6 8-22"/></svg>',
    board: '<svg viewBox="0 0 32 32"><path d="M3 19.5l26-3M3 21.5l26-3"/><path d="M11 21c0 4 3 6 5 6s5-2 5-7"/></svg>',
    rings: '<svg viewBox="0 0 32 32"><path d="M10 2v14M22 2v14"/><circle cx="10" cy="21" r="5"/><circle cx="22" cy="21" r="5"/></svg>'
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
  function stepperRow(def, container, tgt) {
    const T = tgt || S;
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="row-label">${def.label}<small>${def.hint}</small></div>
      <div class="stepper"><button aria-label="${def.label} verringern">−</button><div class="val" aria-live="polite"></div><button aria-label="${def.label} erhöhen">+</button></div>`;
    const [minus, plus] = row.querySelectorAll('button');
    const val = row.querySelector('.val');
    const show = () => { val.innerHTML = T[def.key] + (def.unit ? `<i>${def.unit}</i>` : ''); minus.disabled = T[def.key] <= def.min; plus.disabled = T[def.key] >= def.max; };
    const change = (d) => {
      const v = Math.min(def.max, Math.max(def.min, T[def.key] + d * def.step));
      if (v === T[def.key]) return false;
      T[def.key] = v; show(); haptic(); if (!tgt) onSettingsChanged(def.key); return true;
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
    sw.addEventListener('click', () => { S[key] = !S[key]; show(); persist(); haptic(); unlockAudio(); if (key === 'voice' && S.voice) speak('Sprachansage an'); if (key === 'sound' && S.sound) cue('tick'); });
    show(); container.appendChild(row);
  }
  let stepRows = [];
  function renderSetup() {
    const st = $('#steppers'); st.innerHTML = '';
    stepRows = STEPPERS.map((d) => stepperRow(d, st));
    const op = $('#options'); op.innerHTML = '';
    stepperRow({ key: 'prep', label: 'Vorbereitung', hint: 'Countdown vor dem Start', min: 0, max: 30, step: 5, unit: 's' }, op);
    switchRow('Signaltöne', 'Start, Halbzeit, Countdown & Ende', 'sound', op);
    switchRow('Sprachansage', 'Übungen auf Deutsch ansagen', 'voice', op);
    const tr = document.createElement('div'); tr.className = 'row';
    tr.innerHTML = '<div class="row-label">Ton testen<small>Start · Halbzeit · 3-2-1 · Ende</small></div><button class="chip" id="btn-testsound">▶︎ Abspielen</button>';
    tr.querySelector('button').addEventListener('click', () => { haptic(); testSound(); });
    op.appendChild(tr);
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
        setPlan(generatePlan(S.count)); persist(); renderEquip(); renderPlan();
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
    li.innerHTML = `${opts.num !== false ? `<span class="num">${i + 1}</span>` : ''}<button class="main-btn"><span class="thumb"></span><span class="meta"><div class="nm">${e.name}</div><div class="tags">${opts.x ? `<span class="tag xbadge">${opts.x.reps ? opts.x.reps + '× Wdh.' : opts.x.dur + ' s'}</span>` : ''}${tagsHTML(e, { level: !!opts.level, sides: false })}</div></span></button>${opts.edit ? `<span class="ed"><button class="ed-b" data-a="up" aria-label="Nach oben">▲</button><button class="ed-b" data-a="down" aria-label="Nach unten">▼</button><button class="ed-b" data-a="opt" aria-label="Dauer / Wiederholungen">⏱</button><button class="ed-b del" data-a="del" aria-label="Entfernen">✕</button></span>` : (opts.swap ? `<button class="swap" aria-label="${e.name} zufällig austauschen">${SWAP}</button>` : '')}`;
    li.querySelector('.thumb').appendChild(thumbSVG(e));
    li.querySelector('.main-btn').addEventListener('click', () => opts.onOpen ? opts.onOpen(id, i) : openDetail(id));
    if (opts.swap && !opts.edit) li.querySelector('.swap').addEventListener('click', () => quickSwap(i));
    if (opts.edit) li.querySelectorAll('.ed-b').forEach((b) => b.addEventListener('click', () => editAction(b.dataset.a, i)));
    return li;
  }
  function renderPlan() {
    const ol = $('#plan'); ol.innerHTML = '';
    ol.classList.toggle('editing', editMode);
    plan.forEach((id, i) => ol.appendChild(planItem(id, i, { swap: true, edit: editMode, x: pX[i], onOpen: (pid, idx) => openDetail(pid, idx) })));
    $('#btn-add-ex').classList.toggle('hidden', !editMode);
    $('#btn-edit').textContent = editMode ? '✓ Fertig' : '✎ Bearbeiten';
    $('#btn-shuffle').classList.toggle('hidden', editMode);
    renderActive(); renderPlans();
    if (stepRows.length) { stepRows.forEach((r) => r._show()); renderSummaryLine(); }
  }
  // ───────────── Bearbeiten ─────────────
  function syncCount() { S.count = plan.length; }
  function editAction(a, i) {
    haptic(8);
    if (a === 'up' || a === 'down') {
      const j = a === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= plan.length) return;
      [plan[i], plan[j]] = [plan[j], plan[i]]; [pX[i], pX[j]] = [pX[j], pX[i]];
    } else if (a === 'del') {
      if (plan.length <= 1) { toast('Mindestens eine Übung'); return; }
      const nm = BY[plan[i]].name; plan.splice(i, 1); pX.splice(i, 1); syncCount(); toast(nm + ' entfernt');
    } else if (a === 'opt') { openItemSheet(i); return; }
    persist(); renderPlan();
  }
  function addExercise(id) {
    if (plan.length >= 30) { toast('Maximal 30 Übungen'); return; }
    plan.push(id); pX.push(null); syncCount(); persist(); renderPlan(); toast(BY[id].name + ' hinzugefügt');
  }
  let itIdx = 0, itMode = 'std', itVal = { dur: 30, reps: 12 };
  function openItemSheet(i) {
    itIdx = i; const x = pX[i];
    itMode = x ? (x.reps ? 'reps' : 'dur') : 'std';
    itVal = { dur: (x && x.dur) || S.work, reps: (x && x.reps) || 12 };
    $('#it-name').textContent = `${i + 1}. ${BY[plan[i]].name}`;
    renderItemSheet(); openSheet($('#sheet-item'));
  }
  function renderItemSheet() {
    $('#it-mode').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.m === itMode));
    const c = $('#it-stepper'); c.innerHTML = '';
    if (itMode === 'std') { c.innerHTML = `<div class="row"><div class="row-label">Standard<small>${S.work} s wie unter „Training“ eingestellt</small></div></div>`; return; }
    const d = itMode === 'dur' ? { key: 'dur', label: 'Dauer', hint: 'nur für diese Übung', min: 5, max: 180, step: 5, unit: 's' } : { key: 'reps', label: 'Wiederholungen', hint: 'ohne Countdown – du tippst „Fertig“', min: 1, max: 100, step: 1, unit: '×' };
    stepperRow(d, c, itVal);
  }
  $('#it-mode').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; itMode = b.dataset.m; haptic(6); renderItemSheet(); });
  $('#it-apply').addEventListener('click', () => {
    pX[itIdx] = itMode === 'std' ? null : itMode === 'dur' ? { dur: itVal.dur } : { reps: itVal.reps };
    persist(); renderPlan(); closeSheet(); haptic(12);
  });
  // ───────────── Gespeicherte Pläne ─────────────
  const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const SET_KEYS = ['work', 'rest', 'rounds', 'roundRest', 'prep'];
  function snapshot() {
    const set = {}; SET_KEYS.forEach((k) => { set[k] = S[k]; }); set.equipment = Object.assign({}, S.equipment);
    return { items: plan.map((ex, i) => Object.assign({ ex }, pX[i] || {})), settings: set };
  }
  function planTotal(q) {
    const st = q.settings, n = q.items.length; let w = 0;
    q.items.forEach((it) => { w += it.dur || st.work; });
    return (st.prep || 0) + st.rounds * (w + Math.max(0, n - 1) * st.rest) + Math.max(0, st.rounds - 1) * st.roundRest;
  }
  const sameAsActive = () => { const q = plans.find((x) => x.id === activeId); if (!q) return false; const a = snapshot(); return JSON.stringify(a.items) === JSON.stringify(q.items) && JSON.stringify(a.settings) === JSON.stringify(q.settings); };
  function savePlanAs() {
    const name = (prompt('Name des Plans:', `Mein Plan ${plans.length + 1}`) || '').trim();
    if (!name) return;
    const q = Object.assign({ id: uid(), name, updated: Date.now() }, snapshot());
    plans.push(q); activeId = q.id; persistPlans(); persist(); renderPlan(); haptic(12); toast(`„${name}“ gespeichert`);
  }
  function updateActive() {
    const q = plans.find((x) => x.id === activeId); if (!q) return;
    Object.assign(q, snapshot(), { updated: Date.now() }); persistPlans(); renderPlan(); haptic(12); toast(`„${q.name}“ aktualisiert`);
  }
  function loadPlan(id, quiet) {
    const q = plans.find((x) => x.id === id); if (!q) return false;
    const items = q.items.filter((it) => BY[it.ex]);
    if (!items.length) { toast('Plan enthält keine bekannten Übungen'); return false; }
    const st = q.settings || {};
    SET_KEYS.forEach((k) => { if (typeof st[k] === 'number') S[k] = st[k]; });
    if (st.equipment) S.equipment = Object.assign({}, DEFAULTS.equipment, st.equipment);
    setPlan(items.map((it) => it.ex), items.map((it) => it.reps ? { reps: it.reps } : it.dur ? { dur: it.dur } : null));
    syncCount(); activeId = id; editMode = false;
    persist(); renderSetup();
    if (!quiet) { haptic(12); toast(`„${q.name}“ geladen`); }
    return true;
  }
  function renderActive() {
    const el = $('#active-plan'); const q = plans.find((x) => x.id === activeId);
    if (!q) { el.classList.add('hidden'); return; }
    const same = sameAsActive();
    el.classList.remove('hidden');
    el.innerHTML = `<span>Plan: <b></b>${same ? '' : ' <i>· geändert</i>'}</span>${same ? '' : '<button class="chip" data-a="upd">Änderungen speichern</button>'}<button class="chip ghost" data-a="x" aria-label="Plan lösen">✕</button>`;
    el.querySelector('b').textContent = q.name;
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.a === 'upd') updateActive(); else { activeId = null; persist(); renderPlan(); } }));
  }
  function renderPlans() {
    const box = $('#plans'); box.innerHTML = '';
    if (!plans.length) { box.innerHTML = '<p class="section-hint">Noch keine Pläne. Stell unten deine Übungen zusammen und tippe „Als Plan speichern“ – Reihenfolge und Zeiten bleiben genau so erhalten.</p>'; return; }
    plans.forEach((q) => {
      const n = q.items.length, st = q.settings, reps = q.items.some((it) => it.reps);
      const c = document.createElement('div');
      c.className = 'plan-card' + (q.id === activeId ? ' on' : '');
      c.innerHTML = `<button class="pc-main"><div class="pc-name"></div><div class="pc-meta">${n} Übung${n > 1 ? 'en' : ''} · ${st.rounds} Runde${st.rounds > 1 ? 'n' : ''} · ${st.work}/${st.rest} s · ca. ${fmt(planTotal(q))} min${reps ? ' · mit Wdh.' : ''}</div></button>
        <button class="pc-play" data-a="start" aria-label="Plan direkt starten">${PLAY}</button>
        <div class="pc-acts"><button data-a="load">Laden</button><button data-a="ren">Umbenennen</button><button data-a="dup">Duplizieren</button><button data-a="del" class="del">Löschen</button></div>`;
      c.querySelector('.pc-name').textContent = q.name;
      c.querySelector('.pc-main').addEventListener('click', () => loadPlan(q.id));
      c.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => planAction(b.dataset.a, q)));
      box.appendChild(c);
    });
  }
  function planAction(a, q) {
    if (a === 'load') loadPlan(q.id);
    else if (a === 'start') { unlockAudio(); if (loadPlan(q.id, true)) startWorkout(); }
    else if (a === 'ren') { const n = (prompt('Neuer Name:', q.name) || '').trim(); if (n) { q.name = n; persistPlans(); renderPlans(); renderActive(); } }
    else if (a === 'dup') { const c = JSON.parse(JSON.stringify(q)); c.id = uid(); c.name = q.name + ' (Kopie)'; c.updated = Date.now(); plans.splice(plans.indexOf(q) + 1, 0, c); persistPlans(); renderPlans(); toast('Dupliziert'); }
    else if (a === 'del') { if (confirm(`Plan „${q.name}“ wirklich löschen?`)) { plans = plans.filter((x) => x !== q); if (activeId === q.id) activeId = null; persistPlans(); persist(); renderPlan(); toast('Plan gelöscht'); } }
  }
  function exportText() { return JSON.stringify({ app: 'hiit-zirkel', version: 1, exported: new Date().toISOString(), plans }, null, 2); }
  function openIO(mode) {
    $('#io-title').textContent = mode === 'export' ? 'Pläne exportieren' : 'Pläne importieren';
    $('#io-hint').textContent = mode === 'export' ? 'Die Datei wurde heruntergeladen (falls möglich). Alternativ den Text kopieren und z. B. in Notizen sichern.' : 'JSON aus einem Export hier einfügen oder eine Datei wählen. Vorhandene Pläne bleiben erhalten.';
    $('#io-text').value = mode === 'export' ? exportText() : '';
    $('#io-text').readOnly = mode === 'export';
    $('#io-go').classList.toggle('hidden', mode === 'export'); $('#io-file-btn').classList.toggle('hidden', mode === 'export');
    $('#io-copy').classList.toggle('hidden', mode !== 'export');
    openSheet($('#sheet-io'));
  }
  function doExport() {
    if (!plans.length) { toast('Noch keine Pläne gespeichert'); return; }
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([exportText()], { type: 'application/json' }));
      a.download = `hiit-plaene-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    } catch (e) { /* nur Text */ }
    openIO('export');
  }
  function doImport(text) {
    let data; try { data = JSON.parse(text); } catch (e) { toast('Kein gültiges JSON'); return 0; }
    const list = Array.isArray(data) ? data : (data && data.plans) || (data && data.items ? [data] : []);
    let n = 0;
    list.forEach((q) => {
      if (!q || !Array.isArray(q.items)) return;
      const items = q.items.map((it) => (typeof it === 'string' ? { ex: it } : it)).filter((it) => it && BY[it.ex]).map((it) => {
        const o = { ex: it.ex }; if (+it.reps > 0) o.reps = Math.min(100, Math.round(+it.reps)); else if (+it.dur > 0) o.dur = Math.min(600, Math.round(+it.dur)); return o; });
      if (!items.length) return;
      const st = Object.assign({ work: 30, rest: 10, rounds: 1, roundRest: 60, prep: 10 }, q.settings || {});
      SET_KEYS.forEach((k) => { st[k] = Math.max(0, Math.round(+st[k] || 0)); }); st.rounds = Math.max(1, st.rounds); st.work = Math.max(5, st.work);
      st.equipment = Object.assign({}, DEFAULTS.equipment, st.equipment || {});
      let name = String(q.name || 'Importierter Plan').slice(0, 60);
      if (plans.some((x) => x.name === name)) name += ' (Import)';
      plans.push({ id: uid(), name, updated: Date.now(), items, settings: st }); n++;
    });
    if (!n) { toast('Keine Pläne gefunden'); return 0; }
    persistPlans(); renderPlans(); closeSheet(); toast(n > 1 ? `${n} Pläne importiert` : '1 Plan importiert');
    return n;
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
    if (k === 'classic') setPlan(classicPlan()); else if (countChanged) fitPlan();
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
  let libPick = false;
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
    $('#lib-count').textContent = libPick ? `Tippe auf eine Übung, um sie ans Ende deines Plans zu setzen · ${list.length} Übungen` : `${list.length} von ${EXS.length} Übungen · mit Animation & Anleitung`;
    const ol = $('#lib-list'); ol.innerHTML = '';
    list.forEach((e, i) => ol.appendChild(planItem(e.id, i, { num: false, level: true, onOpen: libPick ? (id) => { addExercise(id); haptic(12); } : null })));
  }

  // ───────────── Audio & Sprache ─────────────
  // iOS: Web Audio ist vom Stumm-Schalter betroffen und muss in einer Nutzergeste entsperrt werden.
  // Strategie: Töne werden einmal als PCM vorberechnet. Wiedergabe über Web Audio (mit audioSession
  // 'playback' auf iOS 17+) – auf älterem iOS bzw. wenn der Kontext nicht läuft über HTMLAudio-Elemente
  // (WAV-Blobs), die als Medienwiedergabe auch bei Stumm-Schalter hörbar sind.
  const SR = 44100;
  const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const HAS_SESSION = 'audioSession' in navigator;
  // Ton-Design: [Frequenz Start, Frequenz Ende, Dauer, Startzeit, Lautstärke, Wellenform]
  const CUE_DEF = {
    start: [[660, 660, 0.13, 0, 0.55, 'sq'], [990, 990, 0.26, 0.15, 0.55, 'sq']],            // steigender Doppelton
    half: [[880, 880, 0.22, 0, 0.5, 'tri']],                                                // einzelner mittlerer Ton
    tick: [[1250, 1250, 0.07, 0, 0.6, 'tri']],                                              // kurzer Tick
    end: [[700, 330, 0.6, 0, 0.6, 'sq']],                                                   // langer fallender Ton
    done: [[523, 523, 0.18, 0, 0.5, 'tri'], [659, 659, 0.18, 0.15, 0.5, 'tri'], [784, 784, 0.18, 0.3, 0.5, 'tri'], [1047, 1047, 0.45, 0.45, 0.5, 'tri']],
    silent: [[440, 440, 0.05, 0, 0, 'sine']]
  };
  function synth(def) {
    const len = Math.ceil(SR * (Math.max(...def.map((d) => d[3] + d[2])) + 0.03));
    const out = new Float32Array(len);
    def.forEach(([f0, f1, dur, at, vol, w]) => {
      const n0 = Math.floor(at * SR), n = Math.floor(dur * SR);
      let ph = 0;
      for (let i = 0; i < n && n0 + i < len; i++) {
        const k = i / n, f = f0 + (f1 - f0) * k;
        ph += 2 * Math.PI * f / SR;
        let v = Math.sin(ph);
        if (w === 'sq') v = Math.tanh(4 * v) * 0.75; else if (w === 'tri') v = (2 / Math.PI) * Math.asin(Math.sin(ph));
        const env = Math.min(1, i / (0.006 * SR)) * Math.min(1, (n - i) / (0.04 * SR));
        out[n0 + i] += v * vol * env;
      }
    });
    return out;
  }
  function wavURL(pcm) {
    const buf = new ArrayBuffer(44 + pcm.length * 2), dv = new DataView(buf);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, SR, true);
    dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  const PCM = {};
  Object.keys(CUE_DEF).forEach((k) => { PCM[k] = synth(CUE_DEF[k]); });
  // Robuste Wiedergabe (v5):
  //  • iOS: primär HTMLAudio-Pool (Medienwiedergabe → unabhängig vom Stumm-Schalter und von einem
  //    unterbrochenen AudioContext). Jedes Element wird im Start-Tap per play()+pause() UNSTUMM entsperrt
  //    (stummes play() zählt auf iOS nicht als Freigabe – Ursache des Fehlers in v3/v4).
  //  • Sonst/als Fallback: ein langlebiger AudioContext mit Keep-alive-Quelle, Töne über die Context-Uhr.
  //  • Bei jedem Tap, nach jeder Sprachansage und bei Rückkehr in die App wird erneut entsperrt/fortgesetzt.
  const QS = new URLSearchParams(location.search);
  const A = { ctx: null, bufs: {}, pool: {}, unlocked: false, keep: null, master: null,
    mode: QS.get('audio') || (IS_IOS ? 'html' : 'webaudio'), log: [], dbg: QS.get('debug') === '1' || load('hiit.debug', false), sessionSet: false };
  function alog(msg, extra) {
    const e = Object.assign({ at: performance.now(), wall: new Date().toLocaleTimeString('de-DE'), msg, ctx: A.ctx ? A.ctx.state : '–' }, extra || {});
    A.log.push(e); if (A.log.length > 400) A.log.shift();
    if (A.dbg) renderDebug();
    return e;
  }
  function setSession() {
    if (A.sessionSet || !HAS_SESSION) return;
    try { navigator.audioSession.type = 'playback'; A.sessionSet = true; alog('audioSession=playback'); } catch (e) { alog('audioSession Fehler: ' + e.message); }
  }
  const POOL_N = { start: 2, half: 2, tick: 3, end: 2, done: 1 };
  function ensurePool() {
    if (A.pool.start) return;
    Object.keys(POOL_N).forEach((k) => {
      const url = wavURL(PCM[k]);
      A.pool[k] = Array.from({ length: POOL_N[k] }, () => { const a = new Audio(); a.src = url; a.preload = 'auto'; a.setAttribute('playsinline', ''); a._ok = false; return a; });
      A.pool[k].i = 0;
    });
  }
  function unlockPool() {
    ensurePool();
    Object.keys(A.pool).forEach((k) => A.pool[k].forEach((a) => {
      if (a._ok || !(a.paused || a.ended)) return;
      try {
        a.muted = false;
        const pr = a.play();
        a.pause(); a.currentTime = 0; // sofort stoppen – unhörbar, aber Element ist durch die Geste freigegeben
        a._ok = true;
        if (pr && pr.catch) pr.catch((err) => { if (err.name === 'NotAllowedError') { a._ok = false; alog('Pool-Freigabe verweigert: ' + k); } });
      } catch (e) { alog('Pool-Fehler ' + e.message); }
    }));
  }
  function ensureCtx() {
    if (A.ctx) return A.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      A.ctx = new AC();
      A.ctx.onstatechange = () => alog('AudioContext → ' + A.ctx.state);
      A.master = A.ctx.createGain(); A.master.gain.value = 1; A.master.connect(A.ctx.destination);
      Object.keys(PCM).forEach((k) => { const ab = A.ctx.createBuffer(1, PCM[k].length, SR); ab.getChannelData(0).set(PCM[k]); A.bufs[k] = ab; });
      alog('AudioContext erstellt');
    } catch (e) { alog('AudioContext Fehler ' + e.message); }
    return A.ctx;
  }
  function startKeepAlive() {
    const ctx = A.ctx; if (!ctx || A.keep) return;
    try {
      // fast lautloses Dauersignal, damit iOS den Kontext nicht wegen Stille schlafen legt
      const len = ctx.sampleRate, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.00003;
      const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; src.connect(ctx.destination); src.start();
      A.keep = src; alog('Keep-alive gestartet');
    } catch (e) { alog('Keep-alive Fehler ' + e.message); }
  }
  // MUSS synchron aus einem Tap/Klick aufgerufen werden (Start, Pause, Weiter, Überspringen, jeder Tap)
  function unlockAudio() {
    setSession();
    const ctx = ensureCtx();
    if (ctx) {
      try {
        if (ctx.state !== 'running') ctx.resume().then(() => alog('resume ok (Geste)')).catch((e) => alog('resume abgelehnt ' + e.name));
        const src = ctx.createBufferSource(); src.buffer = ctx.createBuffer(1, 1, 22050); src.connect(ctx.destination); src.start(0);
        startKeepAlive();
      } catch (e) { alog('unlock ctx Fehler ' + e.message); }
    }
    unlockPool();
    if (!A.unlocked) alog('Audio entsperrt (Modus ' + A.mode + ')');
    A.unlocked = true;
    unlockSpeech();
  }
  function resumeAudio(why) {
    const ctx = A.ctx;
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') {
      try { ctx.resume().then(() => alog('resume ok (' + (why || 'auto') + ')')).catch((e) => alog('resume fehlgeschlagen ' + e.name)); } catch (e) { /* */ }
    }
  }
  function playPool(name) {
    ensurePool();
    const pool = A.pool[name]; if (!pool) return false;
    let a = pool.find((x) => x.paused || x.ended);
    if (!a) { a = pool[pool.i]; pool.i = (pool.i + 1) % pool.length; }
    try {
      a.currentTime = 0;
      const pr = a.play();
      if (pr && pr.catch) pr.catch((err) => { const e = alog('✗ HTMLAudio ' + name + ': ' + err.name); e.fail = true; playCtx(name, true); });
      return true;
    } catch (e) { alog('✗ HTMLAudio ' + name + ' ' + e.message); return false; }
  }
  function playCtx(name, isFallback) {
    const ctx = A.ctx;
    if (!ctx || !A.bufs[name]) return false;
    if (ctx.state !== 'running') { resumeAudio('cue'); if (isFallback) alog('✗ auch WebAudio nicht bereit (' + ctx.state + ')'); return false; }
    try {
      const src = ctx.createBufferSource(); src.buffer = A.bufs[name]; src.connect(A.master); src.start(ctx.currentTime + 0.01);
      if (isFallback) alog('↺ ' + name + ' über WebAudio nachgeholt');
      return true;
    } catch (e) { alog('✗ WebAudio ' + name + ' ' + e.message); return false; }
  }
  function cue(name, meta) {
    const entry = alog('cue ' + name, Object.assign({ cue: name }, meta || {}));
    if (!S.sound) { entry.via = 'stumm'; return; }
    if (!A.unlocked) entry.note = 'noch nicht entsperrt';
    let ok = false;
    if (A.mode === 'html') { ok = playPool(name); entry.via = ok ? 'html' : ''; if (!ok) { ok = playCtx(name, true); entry.via = ok ? 'webaudio' : 'FEHLER'; } }
    else { ok = playCtx(name); entry.via = ok ? 'webaudio' : ''; if (!ok) { ok = playPool(name); entry.via = ok ? 'html' : 'FEHLER'; } }
    if (!ok) entry.fail = true;
    if (A.dbg) renderDebug();
  }
  const SND = {
    start: () => cue('start'), half: () => cue('half'), tick: () => cue('tick'), end: () => cue('end'), done: () => cue('done')
  };
  ['pageshow', 'focus'].forEach((ev) => window.addEventListener(ev, () => resumeAudio(ev)));
  document.addEventListener('visibilitychange', () => { alog('Sichtbarkeit: ' + document.visibilityState); if (!document.hidden) resumeAudio('visible'); });
  // Jeder Tap entsperrt/weckt erneut (iOS erlaubt resume()/play() nur in Gesten zuverlässig)
  ['touchend', 'click'].forEach((ev) => document.addEventListener(ev, () => unlockAudio(), { capture: true, passive: true }));

  // ── Debug-Ansicht (?debug=1 oder Lautsprecher-Symbol lange drücken) ──
  let dbgEl = null, dbgT = 0;
  function renderDebug() {
    if (!A.dbg) { if (dbgEl) dbgEl.classList.add('hidden'); return; }
    const now = performance.now(); if (now - dbgT < 120) return; dbgT = now;
    if (!dbgEl) {
      dbgEl = document.createElement('div'); dbgEl.id = 'debug-log';
      dbgEl.innerHTML = '<div class="dbg-head"><b>Audio-Debug</b><button data-a="test">Test</button><button data-a="copy">Kopieren</button><button data-a="clear">Leeren</button><button data-a="close">✕</button></div><div class="dbg-state"></div><pre></pre>';
      dbgEl.addEventListener('click', (ev) => {
        const act = ev.target.dataset && ev.target.dataset.a; if (!act) return;
        if (act === 'close') setDebug(false);
        if (act === 'clear') { A.log.length = 0; dbgT = 0; renderDebug(); }
        if (act === 'test') testSound();
        if (act === 'copy') { const t = debugText(); try { navigator.clipboard.writeText(t).then(() => toast('Log kopiert')); } catch (e) { prompt('Log kopieren:', t); } }
      });
      document.body.appendChild(dbgEl);
    }
    dbgEl.classList.remove('hidden');
    const okPool = A.pool.start ? Object.values(A.pool).reduce((n, p) => n + p.filter((a) => a._ok).length, 0) : 0;
    const totPool = Object.values(POOL_N).reduce((a, b) => a + b, 0);
    dbgEl.querySelector('.dbg-state').textContent = `Modus ${A.mode} · Context ${A.ctx ? A.ctx.state : 'keiner'} · Keep-alive ${A.keep ? 'an' : 'aus'} · Pool ${okPool}/${totPool} frei · audioSession ${HAS_SESSION ? (navigator.audioSession.type || '?') : 'n/a'} · Ton ${S.sound ? 'an' : 'aus'} · Sprache ${S.voice ? 'an' : 'aus'} · iOS ${IS_IOS ? 'ja' : 'nein'}`;
    dbgEl.querySelector('pre').textContent = A.log.slice(-40).reverse().map(fmtLog).join('\n');
  }
  const fmtLog = (l) => `${l.wall} ${l.fail ? '✗' : ' '} ${l.msg}${l.via ? ' → ' + l.via : ''}${l.phase ? ' [' + l.phase + (l.i != null ? '#' + l.i : '') + (l.t != null ? ' t=' + l.t : '') + ']' : ''} (ctx ${l.ctx})`;
  const debugText = () => dbgEl.querySelector('.dbg-state').textContent + '\n' + navigator.userAgent + '\n' + A.log.map(fmtLog).join('\n');
  function setDebug(v) { A.dbg = v; save('hiit.debug', v); dbgT = 0; renderDebug(); toast(v ? 'Audio-Debug an' : 'Audio-Debug aus'); }
  setInterval(() => { if (A.dbg) renderDebug(); }, 1000);
  if (A.dbg) setTimeout(renderDebug, 0);

  let deVoice = null, speechUnlocked = false;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices().filter((v) => /^de(-|_|$)/i.test(v.lang));
    deVoice = vs.find((v) => /anna|helena|petra|markus|google deutsch/i.test(v.name)) || vs.find((v) => v.localService) || vs[0] || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function unlockSpeech() {
    if (speechUnlocked || !('speechSynthesis' in window)) return;
    try { const u = new SpeechSynthesisUtterance('.'); u.volume = 0; u.lang = 'de-DE'; speechSynthesis.speak(u); speechUnlocked = true; } catch (e) { /* */ }
  }
  function speak(text) {
    if (!S.voice || !S.sound || !('speechSynthesis' in window)) return;
    try {
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
      speechSynthesis.resume && speechSynthesis.resume();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE'; if (deVoice) u.voice = deVoice; u.rate = 1.04; u.pitch = 1; u.volume = 1;
      u.onend = () => { alog('Sprache fertig: ' + text); resumeAudio('nach Sprache'); };
      u.onerror = (ev) => { alog('Sprache Fehler: ' + (ev.error || '?')); resumeAudio('nach Sprache'); };
      // nach den Signaltönen sprechen, damit nichts verschluckt wird
      setTimeout(() => { try { speechSynthesis.speak(u); } catch (e) { /* */ } }, 450);
    } catch (e) { /* */ }
  }
  function testSound() {
    unlockAudio();
    const seq = [['start', 0], ['half', 900], ['tick', 1700], ['tick', 2700], ['tick', 3700], ['end', 4700]];
    const was = S.sound; S.sound = true;
    seq.forEach(([n, t]) => setTimeout(() => cue(n, { test: true }), t + 120));
    setTimeout(() => { S.sound = was; if (S.voice) speak('Ton-Test. So klingt die Sprachansage.'); }, 5600);
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
        const x = pX[i] || {};
        ph.push(x.reps ? { type: 'work', dur: S.work, reps: x.reps, ex: id, round: r, idx: i } : { type: 'work', dur: x.dur || S.work, ex: id, round: r, idx: i });
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
    P.dur = ph.dur; P.endAt = ph.reps ? Infinity : startTs + ph.dur * 1000; P.lastSec = Math.ceil(ph.dur); P.half = false; P.fired = {}; P.phStart = startTs;
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
    $('#p-done').classList.toggle('hidden', !ph.reps);
    scr.classList.toggle('reps', !!ph.reps);
    if (!P.anim || P.anim.ex !== e.id) { Figure.stopAll($('#screen-player')); P.anim = Figure.animate($('#p-figure'), e); P.anim.ex = e.id; }
    renderTime(ph.dur);
    resumeAudio();
    if (silent) return;
    const meta = { phase: ph.type, i, t: 0 };
    if (ph.type === 'work') {
      cue('start', meta);
      const prev = P.phases[i - 1];
      if (ph.reps) speak(`${prev && prev.type !== 'work' ? '' : e.name + '. '}${ph.reps} Wiederholungen. Los!`);
      else speak(prev && prev.type !== 'work' ? 'Los!' : `${e.name}. Los!`);
    } else if (ph.type === 'rest') {
      speak(`Pause. Als Nächstes: ${e.name}.`);
    } else if (ph.type === 'roundRest') {
      speak(`Runde ${ph.round} geschafft. Pause. Danach: ${e.name}.`);
    } else if (ph.type === 'prep') {
      speak(`Mach dich bereit. Erste Übung: ${e.name}.`);
    }
  }
  function renderTime(left) {
    const cur = P.phases[P.i];
    if (cur && cur.reps) {
      const num = $('#p-time'); const txt = cur.reps + '×';
      if (num.textContent !== txt) { num.textContent = txt; num.classList.remove('warn'); }
      num.style.fontSize = cur.reps >= 100 ? '34px' : '';
      $('#ring-fg').style.strokeDashoffset = '0';
      let el0 = 0; for (let k = 0; k < P.i; k++) el0 += P.phases[k].dur;
      el0 += Math.min(cur.dur, P.paused ? 0 : (performance.now() - P.phStart) / 1000);
      $('#p-progress-bar').style.width = (100 * el0 / P.total).toFixed(2) + '%';
      return;
    }
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
      if (ph.type === 'work' && !catchingUp && !(P.phases[P.i + 1] && P.phases[P.i + 1].type === 'work')) cue('end', { phase: 'work', i: P.i, t: ph.dur });
      enterPhase(P.i + 1, nextStart, catchingUp);
      left = (P.endAt - now) / 1000;
    }
    const ph = P.phases[P.i];
    if (ph.reps) { renderTime(Infinity); return; } // Wiederholungen: kein Countdown, „Fertig“ tippen
    // Zeitbasierte Signale: jedes genau einmal, verpasste (älter als 1,5 s) werden nicht nachgeholt
    const el = ph.dur - left, meta = { phase: ph.type, i: P.i };
    if (ph.dur > 3) [3, 2, 1].forEach((thr) => {
      const k = 't' + thr;
      if (!P.fired[k] && left <= thr) { P.fired[k] = true; if (left > thr - 1.5) cue('tick', Object.assign({ t: +el.toFixed(2), n: thr }, meta)); }
    });
    const wantHalf = ph.type === 'work' ? ph.dur >= 8 : (ph.type !== 'prep' && ph.dur >= 30);
    if (wantHalf && !P.fired.half && left <= ph.dur / 2) {
      P.fired.half = true;
      if (left > ph.dur / 2 - 1.5) {
        cue('half', Object.assign({ t: +el.toFixed(2) }, meta));
        if (ph.type === 'work' && BY[ph.ex].sides) {
          speak('Seite wechseln!');
          const sd = $('#p-sides'); sd.classList.remove('hidden'); setTimeout(() => sd.classList.add('hidden'), 2500);
        } else if (ph.type === 'work') speak('Halbzeit');
      }
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
  function renderVoiceBtn() { const b = $('#btn-voice'); b.innerHTML = S.sound ? VOICE_ON : VOICE_OFF; b.style.color = S.sound ? '' : 'var(--dim)'; b.setAttribute('aria-label', S.sound ? 'Ton aus' : 'Ton an'); }
  function jump(to) {
    const was = P.paused;
    to = Math.max(0, Math.min(P.phases.length - 1, to));
    enterPhase(to, performance.now());
    if (was) { P.pauseLeft = P.phases[to].reps ? Infinity : P.dur; }
  }
  function skip() {
    const ph = P.phases[P.i];
    if (ph.reps) P.workSec += (performance.now() - P.phStart) / 1000;
    else if (ph.type === 'work') { P.workSec += Math.max(0, ph.dur - (P.paused ? P.pauseLeft : (P.endAt - performance.now()) / 1000)); }
    if (P.i >= P.phases.length - 1) { finish(); return; }
    haptic(); jump(P.i + 1);
  }
  function back() {
    const ph = P.phases[P.i];
    const elapsed = ph.reps ? (performance.now() - P.phStart) / 1000 : ph.dur - (P.paused ? P.pauseLeft : (P.endAt - performance.now()) / 1000);
    haptic();
    if (ph.type === 'work' && elapsed > 3) { jump(P.i); return; }
    for (let k = P.i - 1; k >= 0; k--) if (P.phases[k].type === 'work') { jump(k); return; }
    jump(0);
  }
  function repsDone() {
    const ph = P.phases[P.i];
    if (!P.active || !ph || !ph.reps) return;
    if (P.paused) setPaused(false);
    haptic(15);
    P.workSec += (performance.now() - P.phStart) / 1000; P.done.push(ph.ex);
    const nxt = P.phases[P.i + 1];
    if (!nxt || nxt.type !== 'work') cue('end', { phase: 'work', i: P.i, t: 'Fertig' });
    if (!nxt) { finish(); return; }
    enterPhase(P.i + 1, performance.now());
  }
  function stopPlayer() {
    P.active = false; clearInterval(P.timer); Figure.stopAll($('#screen-player')); P.anim = null; unlockScreen();
    try { speechSynthesis.cancel(); } catch (e) { /* */ }
  }
  function finish() {
    const work = P.workSec;
    const real = Math.round((Date.now() - P.startedAt) / 1000);
    stopPlayer();
    cue('end', { phase: 'work', i: P.i, t: P.dur }); setTimeout(() => cue('done', { phase: 'finish' }), 700); speak('Geschafft! Starke Leistung.');
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
  $('#btn-shuffle').addEventListener('click', () => { setPlan(generatePlan(S.count)); persist(); renderPlan(); haptic(12); toast('Neu gemischt'); });
  $('#btn-library').addEventListener('click', () => { libPick = false; openLibrary(); });
  $('#btn-add-ex').addEventListener('click', () => { libPick = true; openLibrary(); });
  $('#btn-edit').addEventListener('click', () => { editMode = !editMode; haptic(8); renderPlan(); });
  $('#btn-save-plan').addEventListener('click', savePlanAs);
  $('#btn-export').addEventListener('click', doExport);
  $('#btn-import').addEventListener('click', () => openIO('import'));
  $('#io-go').addEventListener('click', () => doImport($('#io-text').value));
  $('#io-copy').addEventListener('click', () => { const t = $('#io-text'); t.select(); try { (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast('Kopiert'), () => { document.execCommand('copy'); toast('Kopiert'); }); } catch (e) { /* */ } });
  $('#io-file-btn').addEventListener('click', () => $('#io-file').click());
  $('#io-file').addEventListener('change', (ev) => { const f = ev.target.files[0]; if (!f) return; f.text().then((t) => { $('#io-text').value = t; doImport(t); }); ev.target.value = ''; });
  $('#p-done').addEventListener('click', (ev) => { ev.stopPropagation(); repsDone(); });
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
  $('#backdrop').addEventListener('click', () => { libReturn = false; closeSheet(); });
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
    const fromDetail = openSheetEl === $('#sheet-detail');
    closeSheet();
    if (fromDetail && libReturn) { libReturn = false; openSheet($('#sheet-library')); }
  }));
  $('#btn-pause').addEventListener('click', () => { haptic(); setPaused(!P.paused); });
  $('#btn-resume').addEventListener('click', () => setPaused(false));
  $('#btn-next').addEventListener('click', () => { const ph = P.phases[P.i]; if (ph && ph.reps) repsDone(); else skip(); });
  $('#btn-prev').addEventListener('click', back);
  $('#p-info').addEventListener('click', () => { $('#screen-player').classList.toggle('info-open'); haptic(6); });
  let lpT = null, lpFired = false;
  $('#btn-voice').addEventListener('pointerdown', () => { lpFired = false; clearTimeout(lpT); lpT = setTimeout(() => { lpFired = true; haptic(30); setDebug(!A.dbg); }, 700); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => $('#btn-voice').addEventListener(n, () => clearTimeout(lpT)));
  $('#btn-voice').addEventListener('contextmenu', (ev) => ev.preventDefault());
  $('#btn-voice').addEventListener('click', () => { if (lpFired) { lpFired = false; return; } unlockAudio(); S.sound = !S.sound; persist(); renderVoiceBtn(); if (S.sound) cue('tick'); else try { speechSynthesis.cancel(); } catch (e) { /* */ } renderSetup(); });
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
  if (plan.length !== S.count) { if (!plan.length) setPlan(generatePlan(S.count)); else fitPlan(); }
  persist();
  renderSetup();
  renderPauseBtn();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  // Test-/Debug-Zugriff
  window.HIIT = { get pX() { return pX; }, get plans() { return plans; }, doImport, exportText, repsDone, A, cue, testSound, S, get plan() { return plan; }, P, generatePlan, available, totalSeconds, buildPhases, openDetail };
})();
