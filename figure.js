/* Strichfiguren-Engine: Posen (IK/FK) -> Winkel -> Interpolation -> SVG */
(function () {
  'use strict';
  const L = { torso: 24, neck: 8, head: 4.7, ua: 12, fa: 11, th: 16, sh: 15 };
  const FLOOR = 92;
  const D2R = Math.PI / 180;
  const SVGNS = 'http://www.w3.org/2000/svg';

  const dirDown = (u) => [Math.sin(u * D2R), Math.cos(u * D2R)]; // 0 = nach unten, + = nach vorn (+x)
  const add = (p, v, s) => [p[0] + v[0] * s, p[1] + v[1] * s];
  const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const fromAng = (p, a, len) => [p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len];

  function ik(root, target, l1, l2, s) {
    const dx = target[0] - root[0], dy = target[1] - root[1];
    let d = Math.hypot(dx, dy);
    const base = Math.atan2(dy, dx);
    const maxR = l1 + l2 - 0.001, minR = Math.abs(l1 - l2) + 0.1;
    if (d >= maxR) { const m = fromAng(root, base, l1); return [m, fromAng(m, base, l2)]; }
    d = Math.max(d, minR);
    const a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const mid = fromAng(root, base + s * a, l1);
    return [mid, fromAng(mid, ang(mid, target), l2)];
  }

  function limb(root, spec, l1, l2, s) {
    if (Array.isArray(spec)) return ik(root, spec, l1, l2, s);
    const m = add(root, dirDown(spec.u), l1);
    return [m, add(m, dirDown(spec.f), l2)];
  }

  // Pose -> Gelenke (Weltkoordinaten)
  function solve(p, view) {
    const H = p.h.slice();
    const t = p.t || 0;
    const td = [Math.sin(t * D2R), -Math.cos(t * D2R)];
    const S = add(H, td, L.torso);
    const head = add(S, [Math.sin((t + (p.n || 0)) * D2R), -Math.cos((t + (p.n || 0)) * D2R)], L.neck);
    const front = view === 'front';
    const so = front ? 5 : 0, ho = front ? 3.5 : 0;
    // senkrecht zum Rumpf; bei aufrechtem Rumpf zeigt [cos t, sin t] nach +x
    const S1f = front ? add(S, [Math.cos(t * D2R), Math.sin(t * D2R)], so) : S;
    const S2f = front ? add(S, [Math.cos(t * D2R), Math.sin(t * D2R)], -so) : S;
    const H1 = front ? add(H, [Math.cos(t * D2R), Math.sin(t * D2R)], ho) : H;
    const H2 = front ? add(H, [Math.cos(t * D2R), Math.sin(t * D2R)], -ho) : H;
    const a1 = p.a1 || { u: 6, f: 8 }, a2 = p.a2 || { u: -4, f: 2 };
    const [e1, w1] = limb(S1f, a1, L.ua, L.fa, p.eb1 != null ? p.eb1 : (front ? -1 : 1));
    const [e2, w2] = limb(S2f, a2, L.ua, L.fa, p.eb2 != null ? p.eb2 : (front ? 1 : 1));
    const [k1, f1] = limb(H1, p.l1 || [H[0] + 1, FLOOR], L.th, L.sh, p.kb1 != null ? p.kb1 : -1);
    const [k2, f2] = limb(H2, p.l2 || [H[0] - 1, FLOOR], L.th, L.sh, p.kb2 != null ? p.kb2 : -1);
    return { h: H, s: S, head, s1: S1f, s2: S2f, h1: H1, h2: H2, e1, w1, e2, w2, k1, f1, k2, f2 };
  }

  // Gelenke -> Winkeldarstellung (für saubere Interpolation)
  function toAngles(j) {
    return {
      h: j.h, t: ang(j.h, j.s), n: ang(j.s, j.head),
      u1: ang(j.s1, j.e1), f1: ang(j.e1, j.w1), u2: ang(j.s2, j.e2), f2: ang(j.e2, j.w2),
      t1: ang(j.h1, j.k1), c1: ang(j.k1, j.f1), t2: ang(j.h2, j.k2), c2: ang(j.k2, j.f2),
      so: Math.hypot(j.s1[0] - j.s[0], j.s1[1] - j.s[1]), ho: Math.hypot(j.h1[0] - j.h[0], j.h1[1] - j.h[1])
    };
  }

  function lerpA(a, b, k) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return a + d * k;
  }

  function fromAngles(A) {
    const H = A.h;
    const S = fromAng(H, A.t, L.torso);
    const head = fromAng(S, A.n, L.neck);
    const pa = A.t + Math.PI / 2; // senkrecht
    // Bei aufrechtem Rumpf (t = -90°) zeigt pa auf 0 => +x
    const S1 = fromAng(S, pa, A.so), S2 = fromAng(S, pa, -A.so);
    const H1 = fromAng(H, pa, A.ho), H2 = fromAng(H, pa, -A.ho);
    const e1 = fromAng(S1, A.u1, L.ua), w1 = fromAng(e1, A.f1, L.fa);
    const e2 = fromAng(S2, A.u2, L.ua), w2 = fromAng(e2, A.f2, L.fa);
    const k1 = fromAng(H1, A.t1, L.th), f1 = fromAng(k1, A.c1, L.sh);
    const k2 = fromAng(H2, A.t2, L.th), f2 = fromAng(k2, A.c2, L.sh);
    return { h: H, s: S, head, s1: S1, s2: S2, h1: H1, h2: H2, e1, w1, e2, w2, k1, f1, k2, f2 };
  }

  function interp(A, B, k) {
    const o = { h: [A.h[0] + (B.h[0] - A.h[0]) * k, A.h[1] + (B.h[1] - A.h[1]) * k], so: A.so, ho: A.ho };
    for (const key of ['t', 'n', 'u1', 'f1', 'u2', 'f2', 't1', 'c1', 't2', 'c2']) o[key] = lerpA(A[key], B[key], k);
    return o;
  }

  // ───────── Muskeln → Körpersegmente (side: +1 = Vorderseite des Segments, −1 = Rückseite) ─────────
  const MUSCLE_SEG = {
    chest: [['torso', 0.6, 0.93, 1]],
    abs: [['torso', 0.1, 0.62, 1]],
    obliques: [['torso', 0.12, 0.64, 0]],
    core: [['torso', 0.08, 0.7, 0.35], ['torso', 0.1, 0.55, -0.35]],
    lowback: [['torso', 0.05, 0.45, -1]],
    back: [['torso', 0.5, 0.94, -1]],
    lats: [['torso', 0.38, 0.88, -1], ['ua', 0.0, 0.18, 1]],
    shoulders: [['ua', 0.0, 0.32, 0], ['torso', 0.9, 1.0, 0]],
    biceps: [['ua', 0.28, 0.9, -1]],
    triceps: [['ua', 0.25, 0.9, 1]],
    forearm: [['fa', 0.08, 0.6, 0]],
    glutes: [['torso', 0.0, 0.12, -1], ['th', 0.0, 0.3, 1]],
    abductors: [['th', 0.0, 0.3, 0], ['torso', 0, 0.1, 0]],
    quads: [['th', 0.15, 0.9, -1]],
    hams: [['th', 0.22, 0.9, 1]],
    adductors: [['th', 0.15, 0.8, 0]],
    hipflex: [['th', 0.0, 0.3, -1], ['torso', 0.0, 0.14, 1]],
    calves: [['sh', 0.08, 0.5, 1]]
  };
  const W = { torso: 8.2, ua: 4.2, fa: 3.5, th: 6.0, sh: 4.6 };

  const cache = new Map();
  function prepare(ex) {
    if (cache.has(ex.id)) return cache.get(ex.id);
    const frames = ex.frames.map((p) => toAngles(solve(p, ex.view)));
    const joints = frames.map(fromAngles);
    const prep = { frames, joints };
    cache.set(ex.id, prep);
    // Bounding-Box über den gesamten Zyklus -> Zentrierung/Skalierung
    let minX = 1e9, maxX = -1e9, minY = 1e9;
    const consider = (pt, r = 0) => { minX = Math.min(minX, pt[0] - r); maxX = Math.max(maxX, pt[0] + r); minY = Math.min(minY, pt[1] - r); };
    const cyc = cycleLen(ex), N = 48;
    const samples = [];
    for (let i = 0; i < N; i++) samples.push(poseAt(ex, (i / N) * cyc));
    samples.concat(joints).forEach((j) => {
      Object.keys(j).forEach((k) => consider(j[k], k === 'head' ? L.head : 3.2));
      (ex.props || []).forEach((pr) => {
        if (pr.type === 'wheel') consider(j[pr.at || 'w1'], 4.5);
        if (pr.type === 'chair') { consider([pr.x, pr.y]); consider([pr.x + pr.w, pr.y]); if (pr.back) consider([pr.back === 'left' ? pr.x : pr.x + pr.w, pr.y - 24]); }
        if (pr.type === 'wall') { consider([pr.x - 4, 60]); }
      });
    });
    // Bewegungsspur: Gelenk mit dem längsten Weg (bevorzugt die nahe Seite)
    let best = null, bestLen = 0;
    const cand = ex.track ? [ex.track] : ['w1', 'f1', 'k1', 'head', 'h', 'e1', 'w2', 'f2'];
    cand.forEach((k, ci) => {
      let len = 0;
      for (let i = 0; i < N; i++) { const a = samples[i][k], b = samples[(i + 1) % N][k]; len += Math.hypot(a[0] - b[0], a[1] - b[1]); }
      len *= 1 - ci * 0.02;
      if (len > bestLen) { bestLen = len; best = k; }
    });
    prep.track = bestLen > 10 ? best : null;
    prep.trail = prep.track ? samples.map((j) => j[prep.track]) : null;
    const w = maxX - minX;
    const s = Math.min(1.05, 90 / w, 78 / (FLOOR - minY));
    const cx = (minX + maxX) / 2;
    prep.transform = `translate(50 ${FLOOR}) scale(${s.toFixed(4)}) translate(${(-cx).toFixed(2)} ${-FLOOR})`;
    prep.scale = s;
    prep.ready = true;
    return prep;
  }

  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const f2 = (v) => v.toFixed(2);
  const P = (pts) => pts.map((p) => f2(p[0]) + ',' + f2(p[1])).join(' ');

  function footPts(knee, ankle, view) {
    if (view === 'front') return null;
    const dx = ankle[0] - knee[0], dy = ankle[1] - knee[1];
    const len = Math.hypot(dx, dy) || 1;
    let toe = [ankle[0] + (dy / len) * 4.6, ankle[1] - (dx / len) * 4.6];
    const heel = [ankle[0] - (dy / len) * 1.2 + (dx / len) * 0.8, ankle[1] + (dx / len) * 1.2 + (dy / len) * 0.8];
    if (Math.abs(dx / len) < 0.5 && ankle[1] > 84 && ankle[1] < FLOOR) {
      const h = FLOOR - ankle[1];
      const fx = Math.sqrt(Math.max(0, 4.6 * 4.6 - h * h));
      toe = [ankle[0] + fx, FLOOR];
    }
    return [heel, ankle, toe];
  }
  const seg = (a, b, fa, fb, side, w) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const px = -dy / l * side * w * 0.24, py = dx / l * side * w * 0.24;
    return [[a[0] + dx * fa + px, a[1] + dy * fa + py], [a[0] + dx * fb + px, a[1] + dy * fb + py]];
  };

  // Erzeugt ein SVG mit Figur; gibt update(j, t)-Funktion zurück
  function build(svg, ex, opts) {
    opts = opts || {};
    const cues = !!opts.cues;
    const prep = prepare(ex);
    const front = ex.view === 'front';
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.classList.add('fig');
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('line', { x1: 2, y1: FLOOR + 0.6, x2: 98, y2: FLOOR + 0.6, class: 'fig-floor' }, svg);
    const g = el('g', { transform: prep.transform }, svg);
    const shadow = el('ellipse', { class: 'fig-shadow', cx: 50, cy: FLOOR + 0.6, rx: 14, ry: 1.6 }, g);
    const back = el('g', {}, g);
    (ex.props || []).forEach((pr) => {
      if (pr.type === 'chair') {
        const x = pr.x, y = pr.y, w = pr.w;
        el('rect', { x, y: y - 1.4, width: w, height: 3.2, rx: 1.2, class: 'prop-solid' }, back);
        el('line', { x1: x + 1.5, y1: y + 1, x2: x + 1.5, y2: FLOOR, class: 'prop-line' }, back);
        el('line', { x1: x + w - 1.5, y1: y + 1, x2: x + w - 1.5, y2: FLOOR, class: 'prop-line' }, back);
        if (pr.back) { const bx = pr.back === 'left' ? x + 1.5 : x + w - 1.5; el('line', { x1: bx, y1: y, x2: bx, y2: y - 24, class: 'prop-line' }, back); }
      } else if (pr.type === 'wall') {
        el('rect', { x: pr.x - 5, y: 4, width: 5, height: FLOOR - 4, class: 'prop-wall' }, back);
      }
    });
    // Geist der Startposition
    if (cues && prep.joints.length > 1 && !ex.noGhost) {
      const gj = prep.joints[0];
      const gg = el('g', { class: 'ghost' }, g);
      [[gj.s2, gj.e2, gj.w2], [gj.h2, gj.k2, gj.f2], [gj.h, gj.s], [gj.h1, gj.k1, gj.f1], [gj.s1, gj.e1, gj.w1]].forEach((pts) => el('polyline', { points: P(pts) }, gg));
      el('circle', { cx: f2(gj.head[0]), cy: f2(gj.head[1]), r: L.head }, gg);
    }
    // Bewegungsspur
    let arrow = null;
    if (cues && prep.trail) {
      el('polyline', { class: 'trail', points: P(prep.trail.concat([prep.trail[0]])) }, g);
    }
    const hi = {};
    (ex.mp || []).forEach((m) => { hi[m] = 'p'; });
    (ex.ms || []).forEach((m) => { if (!hi[m]) hi[m] = 's'; });
    const overlaysFor = (segName) => {
      const out = [];
      Object.keys(hi).forEach((m) => (MUSCLE_SEG[m] || []).forEach((d) => { if (d[0] === segName) out.push({ lvl: hi[m], fa: d[1], fb: d[2], side: front ? 0 : d[3] }); }));
      return out;
    };
    const parts = [];
    function part(name, a, b, layer, w) {
      const grp = el('g', { class: 'part ' + layer }, g);
      const base = el('line', { class: 'bone', 'stroke-width': w }, grp);
      const ov = overlaysFor(name).map((o) => ({ o, n: el('line', { class: 'mus ' + o.lvl, 'stroke-width': f2(w * (front ? 0.62 : 0.5)) }, grp) }));
      parts.push({ a, b, base, ov, w });
      return grp;
    }
    const layer2 = front ? 'near' : 'far';
    part('ua', 's2', 'e2', layer2, W.ua); part('fa', 'e2', 'w2', layer2, W.fa);
    const hand2 = el('circle', { class: 'hand ' + layer2, r: 1.9 }, g);
    part('th', 'h2', 'k2', layer2, W.th); part('sh', 'k2', 'f2', layer2, W.sh);
    const foot2 = el('polyline', { class: 'footp ' + layer2 }, g);
    // Rumpf
    const torsoG = el('g', { class: 'part near' }, g);
    const torsoPoly = el('polygon', { class: 'torso' }, torsoG);
    const torsoOv = overlaysFor('torso').map((o) => ({ o, n: el('line', { class: 'mus ' + o.lvl, 'stroke-width': front ? 6 : 3.6 }, torsoG) }));
    const neck = el('line', { class: 'bone neck', 'stroke-width': 3 }, g);
    const head = el('circle', { class: 'head', r: L.head }, g);
    const face = front ? null : el('circle', { class: 'face', r: 0.9 }, g);
    part('th', 'h1', 'k1', 'near', W.th); part('sh', 'k1', 'f1', 'near', W.sh);
    const foot1 = el('polyline', { class: 'footp near' }, g);
    part('ua', 's1', 'e1', 'near', W.ua); part('fa', 'e1', 'w1', 'near', W.fa);
    const hand1 = el('circle', { class: 'hand near', r: 1.9 }, g);

    const fr = el('g', {}, g);
    const dyn = [];
    (ex.props || []).forEach((pr) => {
      if (pr.type === 'band') dyn.push({ pr, node: el('path', { class: 'prop-band' + (pr.far ? ' far' : '') }, fr) });
      if (pr.type === 'wheel') {
        const gg = el('g', {}, fr);
        el('rect', { x: -6.2, y: -0.7, width: 12.4, height: 1.4, rx: 0.7, class: 'prop-axle' }, gg);
        const wh = el('g', {}, gg);
        el('circle', { r: 4, cx: 0, cy: 0, class: 'prop-wheel' }, wh);
        el('line', { x1: -2.6, y1: 0, x2: 2.6, y2: 0, class: 'prop-spoke' }, wh);
        el('line', { x1: 0, y1: -2.6, x2: 0, y2: 2.6, class: 'prop-spoke' }, wh);
        el('circle', { r: 1.1, cx: 0, cy: 0, class: 'prop-hub' }, gg);
        dyn.push({ pr, node: gg, wh });
      }
      if (pr.type === 'bars') {
        ['w2', 'w1'].forEach((wk) => dyn.push({ pr, wk, node: el('path', { class: 'prop-bars' + (wk === 'w2' ? ' far' : '') }, fr) }));
      }
    });
    if (cues && prep.trail) arrow = el('path', { class: 'arrow', d: 'M3.4 0 L-2 -2.6 L-0.8 0 L-2 2.6 Z' }, g);
    let label = null;
    if (cues && ex.phases) label = el('text', { class: 'phase-lbl', x: 50, y: 8, 'text-anchor': 'middle' }, svg);
    let lastLabel = '';

    function setLine(n, p, q) { n.setAttribute('x1', f2(p[0])); n.setAttribute('y1', f2(p[1])); n.setAttribute('x2', f2(q[0])); n.setAttribute('y2', f2(q[1])); }
    function update(j, info) {
      parts.forEach((pt) => {
        const a = j[pt.a], b = j[pt.b];
        setLine(pt.base, a, b);
        pt.ov.forEach(({ o, n }) => { const [p, q] = seg(a, b, o.fa, o.fb, o.side, pt.w); setLine(n, p, q); });
      });
      // Rumpf als Körper (Hüfte schmaler als Brustkorb)
      const tdx = j.s[0] - j.h[0], tdy = j.s[1] - j.h[1], tl = Math.hypot(tdx, tdy) || 1;
      const nx = -tdy / tl, ny = tdx / tl;
      let poly;
      if (front) {
        const hw = 4.6, sw = 6.4;
        poly = [[j.h[0] + nx * hw, j.h[1] + ny * hw], [j.s[0] + nx * sw, j.s[1] + ny * sw], [j.s[0] - nx * sw, j.s[1] - ny * sw], [j.h[0] - nx * hw, j.h[1] - ny * hw]];
      } else {
        const up = (f) => [j.h[0] + tdx * f, j.h[1] + tdy * f];
        const at = (f, wf, wb) => { const c = up(f); return [[c[0] + nx * wf, c[1] + ny * wf], [c[0] - nx * wb, c[1] - ny * wb]]; };
        const a0 = at(0, 3.3, 3.6), a1 = at(0.45, 3.0, 3.1), a2 = at(0.78, 4.0, 3.3), a3 = at(1, 2.6, 2.8);
        poly = [a0[0], a1[0], a2[0], a3[0], a3[1], a2[1], a1[1], a0[1]];
      }
      torsoPoly.setAttribute('points', P(poly));
      torsoOv.forEach(({ o, n }) => { const [p, q] = seg(j.h, j.s, o.fa, o.fb, o.side, front ? 12 : 13); setLine(n, p, q); });
      setLine(neck, j.s, [j.s[0] + (j.head[0] - j.s[0]) * 0.5, j.s[1] + (j.head[1] - j.s[1]) * 0.5]);
      head.setAttribute('cx', f2(j.head[0])); head.setAttribute('cy', f2(j.head[1]));
      if (face) {
        const hx = j.head[0] - j.s[0], hy = j.head[1] - j.s[1], hl = Math.hypot(hx, hy) || 1;
        face.setAttribute('cx', f2(j.head[0] - hy / hl * 2.6)); face.setAttribute('cy', f2(j.head[1] + hx / hl * 2.6));
      }
      const hp = (e, w) => { const dx = w[0] - e[0], dy = w[1] - e[1], l = Math.hypot(dx, dy) || 1; return [w[0] + dx / l * 1.3, w[1] + dy / l * 1.3]; };
      const h1p = hp(j.e1, j.w1), h2p = hp(j.e2, j.w2);
      hand1.setAttribute('cx', f2(h1p[0])); hand1.setAttribute('cy', f2(h1p[1]));
      hand2.setAttribute('cx', f2(h2p[0])); hand2.setAttribute('cy', f2(h2p[1]));
      const nf = footPts(j.k1, j.f1, ex.view), ff = footPts(j.k2, j.f2, ex.view);
      foot1.setAttribute('points', nf ? P(nf) : ''); foot2.setAttribute('points', ff ? P(ff) : '');
      shadow.setAttribute('cx', f2((j.f1[0] + j.f2[0] + j.h[0]) / 3));
      dyn.forEach((d) => {
        const pr = d.pr;
        if (pr.type === 'band') {
          const a = Array.isArray(pr.from) ? pr.from : j[pr.from], b = Array.isArray(pr.to) ? pr.to : j[pr.to];
          // Band unter dem Fuß: Ende am Boden unter dem Fußballen verankern
          const A = (!Array.isArray(pr.from) && pr.from[0] === 'f') ? [a[0] + (front ? 0 : 1.8), Math.min(FLOOR, a[1] + 0.8)] : a;
          d.node.setAttribute('d', `M${f2(A[0])} ${f2(A[1])} L${f2(b[0])} ${f2(b[1])}`);
        } else if (pr.type === 'wheel') {
          const c = j[pr.at || 'w1'];
          d.node.setAttribute('transform', `translate(${f2(c[0])} ${f2(c[1])})`);
          d.wh.setAttribute('transform', `rotate(${f2((c[0] / 4) * 57.3)})`);
        } else if (pr.type === 'bars') {
          const c = j[d.wk];
          const x = c[0], y = c[1] + 1.2;
          d.node.setAttribute('d', `M${f2(x - 5.5)} ${FLOOR} L${f2(x - 2.6)} ${f2(y)} L${f2(x + 2.6)} ${f2(y)} L${f2(x + 5.5)} ${FLOOR} M${f2(x - 6.5)} ${FLOOR} L${f2(x - 4)} ${FLOOR} M${f2(x + 4)} ${FLOOR} L${f2(x + 6.5)} ${FLOOR}`);
        }
      });
      if (arrow && info) {
        const p = j[prep.track], q = info.next[prep.track];
        const dx = q[0] - p[0], dy = q[1] - p[1], sp = Math.hypot(dx, dy);
        if (sp > 0.25) {
          arrow.setAttribute('transform', `translate(${f2(p[0])} ${f2(p[1])}) rotate(${f2(Math.atan2(dy, dx) * 57.2958)})`);
          arrow.style.opacity = Math.min(1, sp / 1.2).toFixed(2);
        } else arrow.style.opacity = '0';
      }
      if (label && info && ex.phases) {
        const t = ex.phases[info.seg] || '';
        if (t !== lastLabel) { label.textContent = t; lastLabel = t; }
      }
    }
    return { update, prep };
  }

  // Zeitachse
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  function cycleLen(ex) {
    const n = ex.frames.length;
    if (n === 1) return 1;
    const seg = ex.speed || 0.8, hold = ex.hold != null ? ex.hold : 0.12;
    return (seg + hold) * n;
  }
  // Catmull-Rom auf Winkeln (glatte Bahnen über mehrere Schlüsselposen)
  const KEYS = ['t', 'n', 'u1', 'f1', 'u2', 'f2', 't1', 'c1', 't2', 'c2'];
  const near = (ref, v) => { let d = v - ref; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return ref + d; };
  function cr(p0, p1, p2, p3, k) {
    const k2 = k * k, k3 = k2 * k;
    return 0.5 * ((2 * p1) + (-p0 + p2) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k2 + (-p0 + 3 * p1 - 3 * p2 + p3) * k3);
  }
  function blend(fr, i, k) {
    const n = fr.length;
    const A = fr[(i - 1 + n) % n], B = fr[i], C = fr[(i + 1) % n], D = fr[(i + 2) % n];
    if (n === 2) return interp(B, C, k);
    const o = { so: B.so, ho: B.ho, h: [0, 0] };
    for (let c = 0; c < 2; c++) o.h[c] = cr(A.h[c], B.h[c], C.h[c], D.h[c], k);
    KEYS.forEach((key) => {
      const b = B[key], c = near(b, C[key]), a = near(b, A[key]), d = near(c, D[key]);
      o[key] = cr(a, b, c, d, k);
    });
    return o;
  }
  function crossSign(r, m, e) { return Math.sign((m[0] - r[0]) * (e[1] - r[1]) - (m[1] - r[1]) * (e[0] - r[0])) || 1; }
  const LIMBS = [['s1', 'e1', 'w1', L.ua, L.fa], ['s2', 'e2', 'w2', L.ua, L.fa], ['h1', 'k1', 'f1', L.th, L.sh], ['h2', 'k2', 'f2', L.th, L.sh]];
  function state(ex, time) {
    const prep = cache.get(ex.id) || prepare(ex);
    const fr = prep.frames, n = fr.length;
    if (n === 1) return { j: fromAngles(fr[0]), seg: 0 };
    const segT = ex.speed || 0.8, hold = ex.hold != null ? ex.hold : 0.12;
    let t = ((time % cycleLen(ex)) + cycleLen(ex)) % cycleLen(ex);
    const i = Math.min(n - 1, Math.floor(t / (segT + hold)));
    t -= i * (segT + hold);
    const x = t < hold ? 0 : (t - hold) / segT;
    const k = n === 2 ? ease(x) : 0.35 * x + 0.65 * ease(x);
    const j = fromAngles(blend(fr, i, k));
    // Kontakte erhalten: Hände/Füße, die in beiden Posen am selben Ort oder auf derselben Höhe sind, per IK führen
    const JA = prep.joints[i], JB = prep.joints[(i + 1) % n];
    LIMBS.forEach(([r, m, e, l1, l2]) => {
      const a = JA[e], b = JB[e];
      if (Math.abs(a[1] - b[1]) > 0.6 || Math.hypot(a[0] - b[0], a[1] - b[1]) > 40) return;
      if (a[1] < FLOOR - 16 && Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.6) return; // nur Bodenkontakt gleiten lassen
      const target = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      const dA = Math.hypot(JA[e][0] - JA[r][0], JA[e][1] - JA[r][1]), dB = Math.hypot(JB[e][0] - JB[r][0], JB[e][1] - JB[r][1]);
      const sA = dA <= dB ? crossSign(JA[r], JA[m], JA[e]) : crossSign(JB[r], JB[m], JB[e]);
      const [mid, end] = ik(j[r], target, l1, l2, 1);
      const [mid2, end2] = ik(j[r], target, l1, l2, -1);
      const pick = crossSign(j[r], mid, end) === sA ? [mid, end] : [mid2, end2];
      j[m] = pick[0]; j[e] = pick[1];
    });
    // Boden: nichts darf durch den Boden gehen
    if (ex.view !== 'front') LIMBS.forEach(([r, m, e, l1, l2]) => {
      if (j[e][1] <= FLOOR + 0.3 && j[m][1] <= FLOOR - 1) return;
      const target = [j[e][0], Math.min(j[e][1], FLOOR)];
      const A = ik(j[r], target, l1, l2, 1), B = ik(j[r], target, l1, l2, -1);
      const pick = (A[0][1] < B[0][1]) ? A : B;
      j[m] = pick[0]; j[e] = pick[1];
    });
    return { j, seg: i };
  }
  function poseAt(ex, time) { return state(ex, time).j; }

  // Statisches Bild (Thumbnail) oder ein bestimmter Zeitpunkt (cues)
  function renderStatic(svg, ex, frameIdx) {
    const f = build(svg, ex);
    const fr = f.prep.frames;
    const idx = frameIdx != null ? frameIdx : (ex.thumb != null ? ex.thumb : Math.min(1, fr.length - 1));
    f.update(fromAngles(fr[Math.min(idx, fr.length - 1)]));
    return svg;
  }
  function renderAt(svg, ex, frac) {
    const f = build(svg, ex, { cues: true });
    const T = cycleLen(ex) * frac;
    const s = state(ex, T);
    f.update(s.j, { seg: s.seg, next: poseAt(ex, T + 0.04) });
    return svg;
  }

  // Animationen (eine gemeinsame rAF-Schleife)
  const live = new Set();
  let running = false;
  function loop(ts) {
    live.forEach((a) => {
      if (!a.svg.isConnected) { live.delete(a); return; }
      if (a.paused) return;
      const T = (ts - a.t0) / 1000;
      const s = state(a.ex, T);
      a.update(s.j, { seg: s.seg, next: poseAt(a.ex, T + 0.04) });
    });
    if (live.size) requestAnimationFrame(loop); else running = false;
  }
  function animate(svg, ex) {
    const f = build(svg, ex, { cues: true });
    const a = { svg, ex, update: f.update, t0: performance.now(), paused: false };
    const s = state(ex, 0);
    a.update(s.j, { seg: s.seg, next: poseAt(ex, 0.04) });
    live.add(a);
    if (!running) { running = true; requestAnimationFrame(loop); }
    return { stop() { live.delete(a); }, pause(v) { a.paused = v; } };
  }
  function stopAll(container) { live.forEach((a) => { if (!container || container.contains(a.svg)) live.delete(a); }); }

  window.Figure = { renderStatic, renderAt, animate, stopAll, poseAt, prepare, solve, FLOOR, MUSCLE_SEG };
})();
