/* =====================================================================
   app.js: the shared state, the run controls and the page wiring.

   Reading order:  1. State   2. Running Grover step by step
                   3. Updating the text on the page   4. Buttons and mouse   5. Animation loop
   Maths lives in simulation.js (Grover.*), painting lives in drawing.js (Draw.*).
   ===================================================================== */

(() => {
  const $ = id => document.getElementById(id);

  /* ---------------------------------------------------------------
     1. STATE. One object, shared with the drawing code.
        amp  = the true quantum state (changes instantly at each step)
        disp = what is drawn; it glides toward amp so bars animate
     --------------------------------------------------------------- */
  const S = {
    n: 4, N: 16, target: 11,
    amp: null, disp: null,
    k: 0,                      // Grover rounds completed
    stage: 'init',             // init | hadamard | oracle | diffuse | ready | measure
    trail: [], pHist: [],      // history for the rotation plane and the probability curve
    counts: null, shots: 0, lastShot: null,   // measurement results
    hover: -1, yMax: 1.05,
  };
  let busy = false;            // true while a step animation is playing
  let playing = false;         // true while Play is running
  let speed = 1;
  let epoch = 0;               // bumps on every reset, so an old step can notice it was cancelled
  const sleep = ms => new Promise(done => setTimeout(done, ms / speed));
  const bits = i => Draw.bits(i, S.n);
  const percent = p => (p * 100).toFixed(1) + '%';

  function recordTrail() {                      // remember the 2-D angle of the state for the faint trail
    const v = Grover.twoDView(S.amp, S.target);
    S.trail.push(Math.atan2(v.t, v.w));
    if (S.trail.length > 9) S.trail.shift();
  }

  function setStage(stage, message) {           // updates the pill and the sentence above the chart
    S.stage = stage;
    const labels = { init: '|0…0⟩', hadamard: 'Hadamard', oracle: 'Oracle', diffuse: 'Diffusion', ready: 'Ready', measure: 'Measured' };
    const pill = $('stagePill');
    pill.textContent = labels[stage];
    pill.className = 'pill ' + (['oracle', 'diffuse', 'hadamard'].includes(stage) ? stage : '');
    $('statusText').textContent = message || '';
  }

  /* ---------------------------------------------------------------
     2. RUNNING GROVER.  Every function checks `epoch` after waiting,
        so pressing Reset in the middle of a run stops it cleanly.
     --------------------------------------------------------------- */

  /* Start over: all amplitude on |00..0>, then Hadamard spreads it evenly. */
  async function reset(keepTarget) {
    const myEpoch = ++epoch;
    playing = false; busy = true;
    S.N = 1 << S.n;
    if (!keepTarget || S.target >= S.N) S.target = Math.min(S.N - 1, Math.floor(S.N * 0.7));
    S.amp = new Float64Array(S.N); S.amp[0] = 1;
    S.disp = Float64Array.from(S.amp);
    S.k = 0; S.trail = []; S.pHist = [0]; S.counts = null; S.shots = 0; S.lastShot = null; S.yMax = 1.05;
    setStage('init', 'Every qubit starts in |0⟩, so all the amplitude sits on one state.');
    recordTrail(); refreshText();

    await sleep(700); if (myEpoch !== epoch) return;
    S.amp = Grover.uniform(S.N);                                         // <- Step 1 of the algorithm
    setStage('hadamard', 'Hadamard on every qubit spreads the amplitude evenly: each state gets 1/√N.');
    await sleep(1000); if (myEpoch !== epoch) return;
    recordTrail(); S.pHist[0] = S.amp[S.target] ** 2;
    setStage('ready', 'Ready. Press Step or Play to run the Grover iteration.');
    busy = false; refreshText();
  }

  /* Half a round: flip the target's sign. */
  async function runOracle() {
    if (busy) return;
    busy = true; const myEpoch = epoch;
    Grover.oracle(S.amp, S.target);                                      // <- Step 2
    recordTrail();
    setStage('oracle', 'The oracle flips the sign of the marked state. The mean amplitude dips just below 1/√N.');
    refreshText();
    await sleep(950); if (myEpoch !== epoch) return;
    busy = false; refreshText();
  }

  /* The other half: reflect about the mean. This completes one Grover round. */
  async function runDiffusion() {
    if (busy) return;
    busy = true; const myEpoch = epoch;
    Grover.diffuse(S.amp);                                               // <- Step 3
    S.k++; recordTrail(); S.pHist[S.k] = S.amp[S.target] ** 2;
    setStage('diffuse', 'Every amplitude is reflected about the mean. Small ones shrink, the marked one grows.');
    refreshText();
    await sleep(950); if (myEpoch !== epoch) return;
    busy = false;
    const best = Grover.optimalIterations(S.N), p = S.amp[S.target] ** 2;
    if (S.k === best) setStage('ready', 'Optimal iteration count reached: ' + percent(p) + ' chance to measure the target.');
    else if (S.k > best && p < 0.5) setStage('ready', 'Past the optimum the state rotates beyond the target and the odds fall.');
    refreshText();
  }

  /* One full round = oracle, then diffusion. */
  async function runRound() {
    if (busy) return;
    const myEpoch = epoch;
    await runOracle(); if (myEpoch !== epoch) return;
    await runDiffusion();
  }

  /* Play: keep running rounds until the optimum (or a full cycle if "Overshoot" is ticked). */
  async function togglePlay() {
    if (playing) { playing = false; refreshText(); return; }
    const limit = () => $('over').checked ? 2 * Grover.optimalIterations(S.N) + 2 : Grover.optimalIterations(S.N);
    if (S.k >= limit() && !busy) await reset(true);
    if (busy) return;
    const myEpoch = epoch;
    playing = true; refreshText();
    while (playing && myEpoch === epoch && S.k < limit()) {
      await runRound(); if (myEpoch !== epoch) return;
    }
    if (myEpoch === epoch) { playing = false; refreshText(); }
  }

  /* Simulate measuring the register `count` times. Each shot is a fresh run up to the current state. */
  function measure(count) {
    if (!S.counts || S.counts.length !== S.N) S.counts = new Array(S.N).fill(0);
    for (let s = 0; s < count; s++) { const i = Grover.measureOnce(S.amp); S.counts[i]++; S.shots++; S.lastShot = i; }
    if (count === 1) {
      const hit = S.lastShot === S.target;
      setStage('measure', 'Collapsed to |' + bits(S.lastShot) + '⟩' + (hit ? '. That is the target.' : '. Not the target, so run it again.'));
    }
    refreshText();
  }

  /* ---------------------------------------------------------------
     3. TEXT AND BUTTON STATE on the page
     --------------------------------------------------------------- */
  function refreshText() {
    const best = Grover.optimalIterations(S.N), theta = Grover.theta(S.N) * 180 / Math.PI;
    $('bStep').disabled = busy || playing;
    $('bOracle').disabled = busy || playing;
    $('bDiff').disabled = busy || playing;
    $('bPlay').textContent = playing ? 'Pause' : 'Play';
    $('bPlay').disabled = busy && !playing;
    $('tgtLabel').textContent = '|' + bits(S.target) + '⟩ (index ' + S.target + ')';
    document.querySelectorAll('#qseg button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.q === S.n)));
    $('sK').firstChild.nodeValue = String(S.k);
    $('sKopt').textContent = '/ ' + best;
    $('sAngT').textContent = ' / 90°';
    $('sAngNote').textContent = 'θ = ' + theta.toFixed(1) + '°, each iteration adds ' + (2 * theta).toFixed(1) + '°';
    $('vClassic').textContent = '≈ ' + (S.N / 2);
    $('vGrover').textContent = String(best);
    const widest = Math.max(S.N / 2, best);
    $('bClassic').style.width = Math.max(4, S.N / 2 / widest * 110) + 'px';
    $('bGrover').style.width = Math.max(4, best / widest * 110) + 'px';
    $('circNote').textContent = 'N = ' + S.N + ' · repeat ×' + best;
    $('histNote').textContent = S.shots
      ? S.shots + ' shots · target hit ' + S.counts[S.target] + ' (' + percent(S.counts[S.target] / S.shots) + ')'
      : 'no shots yet';
  }

  /* The two live numbers that follow the animation every frame. */
  function refreshLiveNumbers() {
    const p = S.disp[S.target] ** 2;
    $('sP').firstChild.nodeValue = (p * 100).toFixed(1);
    $('sPbar').style.width = Math.min(100, p * 100) + '%';
    const v = Grover.twoDView(S.disp, S.target);
    $('sAng').firstChild.nodeValue = (Math.atan2(v.t, v.w) * 180 / Math.PI).toFixed(1) + '°';
  }

  /* ---------------------------------------------------------------
     4. BUTTONS AND MOUSE
     --------------------------------------------------------------- */
  const qubitButtons = $('qseg');
  for (let q = 2; q <= 7; q++) {
    const b = document.createElement('button');
    b.textContent = q; b.dataset.q = q; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => { if (q !== S.n) { S.n = q; reset(false); } };
    qubitButtons.appendChild(b);
  }
  $('bPlay').onclick = togglePlay;
  $('bStep').onclick = runRound;
  $('bOracle').onclick = runOracle;
  $('bDiff').onclick = runDiffusion;
  $('bReset').onclick = () => reset(true);
  $('bRand').onclick = () => {
    let t; do { t = Math.floor(Math.random() * S.N); } while (t === S.target && S.N > 1);
    S.target = t; reset(true);
  };
  $('m1').onclick = () => measure(1);
  $('m100').onclick = () => measure(100);
  $('m1000').onclick = () => measure(1000);
  $('mClr').onclick = () => { S.counts = null; S.shots = 0; S.lastShot = null; refreshText(); };
  $('speed').oninput = e => { speed = +e.target.value; $('speedv').textContent = speed + '×'; };
  $('theme').onclick = () => {
    const root = document.documentElement;
    const now = root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    root.dataset.theme = now === 'dark' ? 'light' : 'dark';
  };

  const amp = $('cAmp'), tip = $('tip');                  // hover tooltip and click-to-choose-target on the bar chart
  amp.addEventListener('mousemove', e => {
    S.hover = Draw.indexAt(e, S.N);
    if (S.hover < 0) { tip.style.opacity = 0; return; }
    const a = S.amp[S.hover];
    tip.textContent = '|' + bits(S.hover) + '⟩ #' + S.hover + ' · a=' + (a >= 0 ? '+' : '') + a.toFixed(3) + ' · P=' + percent(a * a);
    const box = amp.parentElement.getBoundingClientRect();
    tip.style.left = Math.min(e.clientX - box.left + 12, box.width - tip.offsetWidth - 8) + 'px';
    tip.style.top = (e.clientY - box.top - 34) + 'px';
    tip.style.opacity = 1;
  });
  amp.addEventListener('mouseleave', () => { S.hover = -1; tip.style.opacity = 0; });
  amp.addEventListener('click', e => {
    const i = Draw.indexAt(e, S.N);
    if (i >= 0 && i !== S.target && !busy) { S.target = i; reset(true); }
  });
  document.addEventListener('keydown', e => {                // right arrow = one round
    if (e.key === 'ArrowRight' && !/INPUT|BUTTON/.test(document.activeElement.tagName)) runRound();
  });

  /* ---------------------------------------------------------------
     5. ANIMATION LOOP. Each frame: slide disp toward amp, update the numbers, repaint.
     --------------------------------------------------------------- */
  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000); lastTime = now;
    const glide = Draw.reduceMotion ? 1 : 1 - Math.exp(-dt * 7);
    for (let i = 0; i < S.N; i++) S.disp[i] += (S.amp[i] - S.disp[i]) * glide;
    refreshLiveNumbers();
    Draw.all(S);
    requestAnimationFrame(frame);
  }

  reset(false);
  requestAnimationFrame(frame);
})();
