/* =====================================================================
   drawing.js: everything that paints on a canvas. Nothing here changes
   the simulation, it only reads the shared state object S.

   Panels:  drawAmp (bars) | drawGeo (rotation plane) | drawProb (curve)
            drawCirc (circuit) | drawHist (measurements)
   Draw.all(S) repaints all five once per animation frame.
   ===================================================================== */

const Draw = (() => {
  const $ = id => document.getElementById(id);
  const canvas = { amp: $('cAmp'), geo: $('cGeo'), prob: $('cProb'), circ: $('cCirc'), hist: $('cHist') };
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MONO = '11px "JetBrains Mono", ui-monospace, monospace';
  const TAU = Math.PI * 2;
  const bits = (i, n) => i.toString(2).padStart(n, '0');

  /* ---------- colours come from the CSS variables, so light/dark themes just work ---------- */
  const C = {};
  function readColors() {
    const css = getComputedStyle(document.documentElement);
    ['bg', 'surface', 'surface2', 'line', 'fg', 'muted', 'pos', 'neg', 'target', 'accent']
      .forEach(name => C[name] = css.getPropertyValue('--' + name).trim());
  }

  /* ---------- size a canvas to its CSS box (sharp on retina) and clear it ---------- */
  function fit(c) {
    const r = c.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h };
  }

  /* ================= 1. AMPLITUDE BARS (the main view) ================= */
  let ampLayout = null;                       // remembered so mouse hover can find the bar under the cursor

  function drawAmp(S) {
    const { N, n, target, amp, disp, hover } = S;
    const { g, w, h } = fit(canvas.amp);
    const left = 46, right = 14, top = 16, bottom = N <= 32 ? 50 : 32;
    const plotW = w - left - right, plotH = h - top - bottom;

    // Vertical scale: zoom so the tallest bar fits, and glide smoothly to the new zoom.
    let tallest = 0;
    for (let i = 0; i < N; i++) tallest = Math.max(tallest, Math.abs(amp[i]));
    const yTarget = Math.max(0.25, Math.ceil(tallest * 1.18 * 20) / 20);
    S.yMax += (yTarget - S.yMax) * (reduceMotion ? 1 : 0.14);
    const yOf = v => top + plotH / 2 - v / S.yMax * plotH / 2;     // amplitude -> pixel row

    // Grid lines and amplitude labels
    g.font = MONO; g.textBaseline = 'middle';
    [-1, -0.5, 0, 0.5, 1].forEach(f => {
      const v = f * S.yMax, y = yOf(v);
      g.strokeStyle = C.line; g.globalAlpha = f === 0 ? 1 : 0.5; g.lineWidth = 1;
      g.beginPath(); g.moveTo(left, y); g.lineTo(w - right, y); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = C.muted; g.textAlign = 'right'; g.fillText((v > 0 ? '+' : '') + v.toFixed(2), left - 6, y);
    });

    // The bars
    const slot = plotW / N, barW = Math.max(2, slot * 0.72), zeroY = yOf(0);
    if (hover >= 0) { g.fillStyle = C.surface2; g.fillRect(left + slot * hover, top, slot, plotH); }
    for (let i = 0; i < N; i++) {
      const v = disp[i], y = yOf(v), x = left + slot * i + (slot - barW) / 2;
      const isTarget = i === target;
      g.fillStyle = isTarget ? C.target : (v >= 0 ? C.pos : C.neg);
      g.globalAlpha = isTarget ? 1 : 0.88;
      if (isTarget) { g.shadowColor = C.target; g.shadowBlur = 14 + v * v * 30; }   // glow grows with probability
      g.beginPath();
      const barTop = Math.min(zeroY, y), barH = Math.max(1.5, Math.abs(y - zeroY));
      if (g.roundRect) g.roundRect(x, barTop, barW, barH, Math.min(3, barW / 2)); else g.rect(x, barTop, barW, barH);
      g.fill(); g.shadowBlur = 0; g.globalAlpha = 1;
    }

    // The mean line: the mirror that diffusion reflects every bar across
    let mean = 0; for (let i = 0; i < N; i++) mean += disp[i]; mean /= N;
    g.strokeStyle = C.accent; g.lineWidth = 1.5; g.setLineDash([6, 4]);
    g.beginPath(); g.moveTo(left, yOf(mean)); g.lineTo(w - right, yOf(mean)); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.accent; g.textAlign = 'right';
    g.fillText('⟨a⟩ = ' + mean.toFixed(3), w - right - 4, yOf(mean) - (mean >= 0 ? 10 : -10));

    // Bottom labels: bitstrings for small N (rotated if cramped), plain indices for large N
    const label = i => N <= 32 ? bits(i, n) : String(i);
    g.textBaseline = 'top';
    const textW = g.measureText(label(N - 1)).width;
    const rotate = N <= 32 && slot < textW + 4;
    const stride = Math.max(1, Math.ceil((rotate ? 14 : textW + 10) / slot));
    for (let i = 0; i < N; i += stride) {
      g.save(); g.translate(left + slot * i + slot / 2, top + plotH + 8);
      g.fillStyle = i === target ? C.target : C.muted;
      if (rotate) { g.rotate(Math.PI / 2); g.textAlign = 'left'; } else g.textAlign = 'center';
      g.fillText(label(i), 0, -5); g.restore();
    }
    const tx = left + slot * target + slot / 2;           // little triangle under the target
    g.fillStyle = C.target; g.beginPath();
    g.moveTo(tx, top + plotH + 1); g.lineTo(tx - 4, top + plotH + 7); g.lineTo(tx + 4, top + plotH + 7); g.closePath(); g.fill();
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = C.muted;
    g.fillText('basis state' + (N <= 32 ? ' (bits)' : ' (index)'), left, h - 8);

    ampLayout = { left, slot };
  }

  /* Which bar is under the mouse? (-1 if none) */
  function indexAt(event, N) {
    if (!ampLayout) return -1;
    const x = event.clientX - canvas.amp.getBoundingClientRect().left;
    const i = Math.floor((x - ampLayout.left) / ampLayout.slot);
    return i >= 0 && i < N ? i : -1;
  }

  /* ================= 2. ROTATION PLANE ================= */
  function arrow(g, x0, y0, x1, y1, color, width) {
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0);
    g.beginPath(); g.moveTo(x1, y1);
    g.lineTo(x1 - 9 * Math.cos(a - 0.4), y1 - 9 * Math.sin(a - 0.4));
    g.lineTo(x1 - 9 * Math.cos(a + 0.4), y1 - 9 * Math.sin(a + 0.4)); g.closePath(); g.fill();
  }

  function drawGeo(S) {
    const { N, target, disp, trail } = S;
    const { g, w, h } = fit(canvas.geo);
    const R = Math.max(60, Math.min(h * 0.42, w * 0.5 - 40));         // radius of the unit circle
    const ox = Math.max(30, (w - R) / 2 - 24), oy = h / 2;            // origin of the plane
    g.font = MONO; g.textBaseline = 'middle';

    // Axes and the half circle (the state always has length 1)
    g.strokeStyle = C.line; g.lineWidth = 1;
    g.beginPath(); g.arc(ox, oy, R, -Math.PI / 2, Math.PI / 2); g.stroke();
    g.beginPath(); g.moveTo(ox, oy + R + 6); g.lineTo(ox, oy - R - 6); g.moveTo(ox, oy); g.lineTo(ox + R + 10, oy); g.stroke();
    g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText('|ω⟩', ox + R + 12, oy + 14);
    g.fillStyle = C.target; g.fillText('|t⟩', ox + 8, oy - R - 4);

    // |s>, the starting direction, at angle theta
    const theta = Grover.theta(N);
    g.setLineDash([4, 4]); g.strokeStyle = C.accent;
    g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + R * Math.cos(theta) * 1.08, oy - R * Math.sin(theta) * 1.08); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.accent; g.fillText('|s⟩', ox + R * Math.cos(theta) * 1.08 + 4, oy - R * Math.sin(theta) * 1.08 - 2);

    // Faint trail of where the state has been
    trail.slice(0, -1).forEach((a, i, all) => {
      g.globalAlpha = 0.12 + 0.3 * (i + 1) / all.length; g.strokeStyle = C.fg; g.lineWidth = 1;
      g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + R * Math.cos(a), oy - R * Math.sin(a)); g.stroke();
      g.fillStyle = C.fg; g.beginPath(); g.arc(ox + R * Math.cos(a), oy - R * Math.sin(a), 2.5, 0, TAU); g.fill();
    });
    g.globalAlpha = 1;

    // The current state as a red arrow, plus a shaded wedge showing its angle
    const { w: wc, t: tc } = Grover.twoDView(disp, target);
    const angle = Math.atan2(tc, wc);
    g.fillStyle = C.accent; g.globalAlpha = 0.16; g.beginPath(); g.moveTo(ox, oy);
    g.arc(ox, oy, R * 0.34, -Math.max(angle, 0), -Math.min(angle, 0), false); g.closePath(); g.fill(); g.globalAlpha = 1;
    arrow(g, ox, oy, ox + wc * R, oy - tc * R, C.target, 2.5);
    g.fillStyle = C.fg; g.textAlign = 'left';
    g.fillText((angle * 180 / Math.PI).toFixed(1) + '°', ox + R * 0.38, oy + (angle >= 0 ? -8 : 12));
    g.fillStyle = C.muted; g.fillText('amplitude on |t⟩ = ' + disp[target].toFixed(3), ox + 6, h - 10);
  }

  /* ================= 3. PROBABILITY VS ITERATIONS ================= */
  function drawProb(S) {
    const { N, k, pHist } = S;
    const { g, w, h } = fit(canvas.prob);
    const left = 40, right = 14, top = 14, bottom = 34, plotW = w - left - right, plotH = h - top - bottom;
    const theta = Grover.theta(N), kBest = Grover.optimalIterations(N);
    const kMax = Math.max(4, Math.round(Math.PI / (2 * theta)) + 1);          // show about one full oscillation
    const xOf = kk => left + kk / kMax * plotW, yOf = p => top + plotH - p * plotH;
    g.font = MONO; g.textBaseline = 'middle';

    [0, 0.25, 0.5, 0.75, 1].forEach(p => {
      g.strokeStyle = C.line; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(left, yOf(p)); g.lineTo(w - right, yOf(p)); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = C.muted; g.textAlign = 'right'; g.fillText(p.toFixed(2), left - 6, yOf(p));
    });
    g.textAlign = 'center'; g.textBaseline = 'top';
    const tickEvery = Math.max(1, Math.ceil(kMax / 10));
    for (let i = 0; i <= kMax; i += tickEvery) { g.fillStyle = C.muted; g.fillText(String(i), xOf(i), top + plotH + 8); }
    g.textAlign = 'left'; g.fillText('iterations k', left, top + plotH + 20);

    // Optimal k
    g.strokeStyle = C.accent; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(xOf(kBest), top); g.lineTo(xOf(kBest), top + plotH); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.accent; g.fillText('k*=' + kBest, xOf(kBest) + 5, top + 2);

    // Theory curve and its integer points
    g.strokeStyle = C.muted; g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i <= kMax * 20; i++) {
      const kk = i / 20, p = Grover.probability(kk, N);
      i ? g.lineTo(xOf(kk), yOf(p)) : g.moveTo(xOf(kk), yOf(p));
    }
    g.stroke();
    g.fillStyle = C.muted;
    for (let i = 0; i <= kMax; i++) { g.beginPath(); g.arc(xOf(i), yOf(Grover.probability(i, N)), 2.5, 0, TAU); g.fill(); }

    // What this run actually produced (red dots, should sit on the curve)
    pHist.forEach((p, i) => {
      if (p === undefined || i > kMax) return;
      g.fillStyle = C.target; g.beginPath(); g.arc(xOf(i), yOf(p), 4.5, 0, TAU); g.fill();
    });
    if (!reduceMotion && pHist[k] !== undefined) {                      // pulsing ring on the current point
      const phase = (performance.now() % 1400) / 1400;
      g.strokeStyle = C.target; g.globalAlpha = 1 - phase;
      g.beginPath(); g.arc(xOf(Math.min(k, kMax)), yOf(pHist[k]), 5 + phase * 10, 0, TAU); g.stroke(); g.globalAlpha = 1;
    }
  }

  /* ================= 4. CIRCUIT ================= */
  function gateBox(g, x, y, w, h, label, sub, color, active) {
    g.save();
    if (active) { g.shadowColor = color; g.shadowBlur = 16; }
    g.fillStyle = C.surface2; g.strokeStyle = active ? color : C.line; g.lineWidth = active ? 2 : 1;
    g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, 6); else g.rect(x, y, w, h); g.fill(); g.stroke(); g.restore();
    g.fillStyle = active ? color : C.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 14px "Space Grotesk", sans-serif'; g.fillText(label, x + w / 2, y + h / 2 - (sub ? 7 : 0));
    if (sub) { g.font = '10px "JetBrains Mono", monospace'; g.fillStyle = C.muted; g.fillText(sub, x + w / 2, y + h / 2 + 9); }
  }

  function drawCirc(S) {
    const { n, N, stage } = S;
    const wireGap = 32, top = 40;
    canvas.circ.style.height = Math.max(170, top + (n - 1) * wireGap + 44) + 'px';
    const { g, w } = fit(canvas.circ);
    const wireY = i => top + i * wireGap, wireStart = 48, wireEnd = w - 12;
    g.font = MONO; g.textBaseline = 'middle';

    for (let i = 0; i < n; i++) {                       // one wire per qubit, each starting in |0>
      g.strokeStyle = C.line; g.lineWidth = 1; g.beginPath(); g.moveTo(wireStart, wireY(i)); g.lineTo(wireEnd, wireY(i)); g.stroke();
      g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText('|0⟩', 8, wireY(i));
      gateBox(g, 64, wireY(i) - 11, 22, 22, 'H', '', C.neg, stage === 'hadamard');
    }

    // Dashed bracket = the part that repeats k times
    const bracketL = 100, bracketR = w - 62, bracketH = (n - 1) * wireGap + 36;
    const boxW = Math.max(46, Math.min(110, (bracketR - bracketL - 30) / 2));
    g.strokeStyle = C.muted; g.setLineDash([3, 4]); g.globalAlpha = 0.7;
    g.beginPath(); if (g.roundRect) g.roundRect(bracketL, top - 30, bracketR - bracketL, bracketH + 24, 8); else g.rect(bracketL, top - 30, bracketR - bracketL, bracketH + 24);
    g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText('× ' + Grover.optimalIterations(N) + ' iterations', bracketL + 8, top - 20);

    const x0 = bracketL + (bracketR - bracketL - 2 * boxW - 12) / 2;
    gateBox(g, x0, top - 18, boxW, bracketH, 'U_f', 'flip |t⟩', C.target, stage === 'oracle');
    gateBox(g, x0 + boxW + 12, top - 18, boxW, bracketH, 'D', '2|s⟩⟨s|−I', C.accent, stage === 'diffuse');

    // Measurement meter symbol
    const mx = w - 50, midY = top + (n - 1) * wireGap / 2 + 6;
    gateBox(g, mx, top - 12, 28, (n - 1) * wireGap + 24, '', '', C.fg, false);
    g.strokeStyle = C.fg; g.lineWidth = 1.5;
    g.beginPath(); g.arc(mx + 14, midY, 8, Math.PI, TAU); g.stroke();
    g.beginPath(); g.moveTo(mx + 14, midY); g.lineTo(mx + 20, midY - 10); g.stroke();
  }

  /* ================= 5. MEASUREMENT HISTOGRAM ================= */
  function drawHist(S) {
    const { N, n, amp, target, counts, shots, lastShot } = S;
    const { g, w, h } = fit(canvas.hist);
    const left = 8, right = 8, top = 18, bottom = 22, plotW = w - left - right, plotH = h - top - bottom;
    const slot = plotW / N, barW = Math.max(2, slot * 0.7);
    const prob = Array.from(amp, a => a * a);
    let ceiling = Math.max(...prob);
    if (counts && shots) ceiling = Math.max(ceiling, ...counts.map(c => c / shots));
    ceiling = Math.max(0.1, Math.min(1, ceiling * 1.15));
    g.font = MONO; g.textBaseline = 'middle';
    g.strokeStyle = C.line; g.beginPath(); g.moveTo(left, top + plotH); g.lineTo(w - right, top + plotH); g.stroke();

    for (let i = 0; i < N; i++) {
      const x = left + slot * i + (slot - barW) / 2;
      if (counts && shots) {                                   // filled bar = what we measured
        const bh = counts[i] / shots / ceiling * plotH;
        g.fillStyle = i === target ? C.target : C.neg; g.globalAlpha = 0.9; g.fillRect(x, top + plotH - bh, barW, bh); g.globalAlpha = 1;
      }
      const eh = prob[i] / ceiling * plotH;                    // outline = exact probability
      g.strokeStyle = C.fg; g.globalAlpha = 0.55; g.lineWidth = 1;
      g.strokeRect(x + 0.5, top + plotH - eh + 0.5, barW - 1, Math.max(1, eh - 1)); g.globalAlpha = 1;
    }
    g.fillStyle = C.muted; g.textAlign = 'left';
    g.fillText(shots ? 'bars: measured · outlines: exact probability' : 'outlines: exact probability. Press a shot button.', left, 8);
    g.textAlign = 'center'; g.fillStyle = C.target; g.fillText('▲', left + slot * target + slot / 2, top + plotH + 11);
    if (lastShot !== null) { g.fillStyle = C.accent; g.fillText('●', left + slot * lastShot + slot / 2, top + plotH + 11); }
  }

  /* ---------- public ---------- */
  return {
    bits, reduceMotion, indexAt,
    all(S) { readColors(); drawAmp(S); drawGeo(S); drawProb(S); drawCirc(S); drawHist(S); },
  };
})();
