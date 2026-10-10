/* Strichfiguren-Engine: Posen (IK/FK) -> Winkel -> Interpolation -> SVG */
(function () {
  'use strict';
  const L = { torso: 24, neck: 8, head: 5.6, ua: 12, fa: 11, th: 16, sh: 15 };
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

  const cache = new Map();
  function prepare(ex) {
    if (cache.has(ex.id)) return cache.get(ex.id);
    const frames = ex.frames.map((p) => toAngles(solve(p, ex.view)));
    // Bounding-Box über alle Keyframes -> Zentrierung/Skalierung
    let minX = 1e9, maxX = -1e9, minY = 1e9;
    const consider = (pt, r = 0) => { minX = Math.min(minX, pt[0] - r); maxX = Math.max(maxX, pt[0] + r); minY = Math.min(minY, pt[1] - r); };
    frames.forEach((F) => {
      const j = fromAngles(F);
      Object.keys(j).forEach((k) => consider(j[k], k === 'head' ? L.head : 2.5));
      (ex.props || []).forEach((pr) => {
        if (pr.type === 'wheel') consider(j[pr.at || 'w1'], 4.5);
        if (pr.type === 'chair') { consider([pr.x, pr.y]); consider([pr.x + pr.w, pr.y]); if (pr.back) consider([pr.back === 'left' ? pr.x : pr.x + pr.w, pr.y - 24]); }
        if (pr.type === 'wall') { consider([pr.x - 4, 60]); }
      });
    });
    const w = maxX - minX;
    const s = Math.min(1, 90 / w, 84 / (FLOOR - minY));
    const cx = (minX + maxX) / 2;
    const prep = { frames, transform: `translate(50 ${FLOOR}) scale(${s.toFixed(4)}) translate(${(-cx).toFixed(2)} ${-FLOOR})`, scale: s };
    cache.set(ex.id, prep);
    return prep;
  }

  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  const P = (pts) => pts.map((p) => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');

  function footPts(knee, ankle, view) {
    if (view === 'front') return null;
    const dx = ankle[0] - knee[0], dy = ankle[1] - knee[1];
    const len = Math.hypot(dx, dy) || 1;
    let toe = [ankle[0] + (dy / len) * 4.2, ankle[1] - (dx / len) * 4.2];
    if (Math.abs(dx / len) < 0.5 && ankle[1] > 84 && ankle[1] < FLOOR) {
      const h = FLOOR - ankle[1];
      const fx = Math.sqrt(Math.max(0, 4.2 * 4.2 - h * h));
      toe = [ankle[0] + fx, FLOOR];
    }
    return [ankle, toe];
  }

  // Erzeugt ein SVG mit Figur; gibt update(j)-Funktion zurück
  function build(svg, ex) {
    const prep = prepare(ex);
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
        el('rect', { x, y: y - 1.2, width: w, height: 3, rx: 1.2, class: 'prop-solid' }, back);
        el('line', { x1: x + 1.5, y1: y + 1, x2: x + 1.5, y2: FLOOR, class: 'prop-line' }, back);
        el('line', { x1: x + w - 1.5, y1: y + 1, x2: x + w - 1.5, y2: FLOOR, class: 'prop-line' }, back);
        if (pr.back) { const bx = pr.back === 'left' ? x + 1.5 : x + w - 1.5; el('line', { x1: bx, y1: y, x2: bx, y2: y - 24, class: 'prop-line' }, back); }
      } else if (pr.type === 'wall') {
        el('rect', { x: pr.x - 5, y: 4, width: 5, height: FLOOR - 4, class: 'prop-wall' }, back);
      }
    });
    const mk = (cls) => el('polyline', { class: cls, points: '' }, g);
    const farArm = mk('limb far'), farLeg = mk('limb far'), farFoot = mk('limb far foot');
    const torso = mk('limb body'), neck = mk('limb body');
    const head = el('circle', { class: 'head', r: L.head, cx: 0, cy: 0 }, g);
    const nearLeg = mk('limb near'), nearFoot = mk('limb near foot'), nearArm = mk('limb near');
    const front = el('g', {}, g);
    const dyn = [];
    (ex.props || []).forEach((pr) => {
      if (pr.type === 'band') dyn.push({ pr, node: el('polyline', { class: 'prop-band' + (pr.far ? ' far' : ''), points: '' }, front) });
      if (pr.type === 'wheel') {
        const gg = el('g', {}, front);
        el('circle', { r: 4, cx: 0, cy: 0, class: 'prop-wheel' }, gg);
        el('circle', { r: 1.1, cx: 0, cy: 0, class: 'prop-hub' }, gg);
        dyn.push({ pr, node: gg });
      }
      if (pr.type === 'bars') {
        ['w2', 'w1'].forEach((wk) => dyn.push({ pr, wk, node: el('path', { class: 'prop-bars' + (wk === 'w2' ? ' far' : ''), d: '' }, front) }));
      }
    });
    if (ex.view === 'front') { farArm.setAttribute('class', 'limb near'); farLeg.setAttribute('class', 'limb near'); }

    function update(j) {
      const ff = footPts(j.k2, j.f2, ex.view), nf = footPts(j.k1, j.f1, ex.view);
      farArm.setAttribute('points', P([j.s2, j.e2, j.w2]));
      farLeg.setAttribute('points', P([j.h2, j.k2, j.f2]));
      farFoot.setAttribute('points', ff ? P(ff) : '');
      torso.setAttribute('points', ex.view === 'front' ? P([j.h1, j.h, j.s, j.s1, j.s, j.s2, j.s, j.h, j.h2]) : P([j.h, j.s]));
      neck.setAttribute('points', P([j.s, [j.s[0] + (j.head[0] - j.s[0]) * 0.4, j.s[1] + (j.head[1] - j.s[1]) * 0.4]]));
      head.setAttribute('cx', j.head[0].toFixed(2)); head.setAttribute('cy', j.head[1].toFixed(2));
      nearLeg.setAttribute('points', P([j.h1, j.k1, j.f1]));
      nearFoot.setAttribute('points', nf ? P(nf) : '');
      nearArm.setAttribute('points', P([j.s1, j.e1, j.w1]));
      shadow.setAttribute('cx', ((j.f1[0] + j.f2[0] + j.h[0]) / 3).toFixed(2));
      dyn.forEach((d) => {
        const pr = d.pr;
        if (pr.type === 'band') {
          const a = Array.isArray(pr.from) ? pr.from : j[pr.from], b = Array.isArray(pr.to) ? pr.to : j[pr.to];
          d.node.setAttribute('points', P([a, b]));
        } else if (pr.type === 'wheel') {
          const c = j[pr.at || 'w1'];
          d.node.setAttribute('transform', `translate(${c[0].toFixed(2)} ${c[1].toFixed(2)})`);
        } else if (pr.type === 'bars') {
          const c = j[d.wk];
          const x = c[0], y = c[1] + 1;
          d.node.setAttribute('d', `M${(x - 5).toFixed(2)} ${FLOOR} L${(x - 2.5).toFixed(2)} ${y.toFixed(2)} L${(x + 2.5).toFixed(2)} ${y.toFixed(2)} L${(x + 5).toFixed(2)} ${FLOOR}`);
        }
      });
    }
    return { update, prep };
  }

  const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

  function poseAt(ex, time) {
    const prep = prepare(ex);
    const fr = prep.frames;
    if (fr.length === 1) return fromAngles(fr[0]);
    const seg = ex.speed || 0.8, hold = ex.hold != null ? ex.hold : 0.12;
    const cyc = (seg + hold) * fr.length;
    let t = time % cyc;
    const i = Math.floor(t / (seg + hold));
    t = t - i * (seg + hold);
    const k = t < hold ? 0 : ease((t - hold) / seg);
    return fromAngles(interp(fr[i], fr[(i + 1) % fr.length], k));
  }

  // Statisches Bild
  function renderStatic(svg, ex, frameIdx) {
    const f = build(svg, ex);
    const fr = f.prep.frames;
    const idx = frameIdx != null ? frameIdx : (ex.thumb != null ? ex.thumb : Math.min(1, fr.length - 1));
    f.update(fromAngles(fr[Math.min(idx, fr.length - 1)]));
    return svg;
  }

  // Animationen (eine gemeinsame rAF-Schleife)
  const live = new Set();
  let running = false;
  function loop(ts) {
    live.forEach((a) => {
      if (!a.svg.isConnected) { live.delete(a); return; }
      if (a.paused) return;
      a.update(poseAt(a.ex, (ts - a.t0) / 1000));
    });
    if (live.size) requestAnimationFrame(loop); else running = false;
  }
  function animate(svg, ex) {
    const f = build(svg, ex);
    const a = { svg, ex, update: f.update, t0: performance.now(), paused: false };
    a.update(poseAt(ex, 0));
    live.add(a);
    if (!running) { running = true; requestAnimationFrame(loop); }
    return { stop() { live.delete(a); }, pause(v) { a.paused = v; } };
  }
  function stopAll(container) { live.forEach((a) => { if (!container || container.contains(a.svg)) live.delete(a); }); }

  window.Figure = { renderStatic, animate, stopAll, poseAt, prepare, solve, FLOOR };
})();
