/* =====================================================================
   simulation.js: Grover's algorithm itself.
   No drawing and no page code here. Just maths on a list of numbers.

   The quantum state is a list ("amp") of N amplitudes, one per basis state.
   The chance of measuring state i is amp[i] squared.
   ===================================================================== */

const Grover = {

  /* Step 1, Hadamard on every qubit: every state gets amplitude 1/sqrt(N). */
  uniform(N) {
    return new Float64Array(N).fill(1 / Math.sqrt(N));
  },

  /* Step 2, oracle: flip the sign of the target's amplitude only. (Changes amp in place.) */
  oracle(amp, target) {
    amp[target] = -amp[target];
  },

  /* Step 3, diffusion: reflect every amplitude about the mean, a -> 2*mean - a. (In place.) */
  diffuse(amp) {
    const N = amp.length;
    let mean = 0;
    for (let i = 0; i < N; i++) mean += amp[i];
    mean /= N;
    for (let i = 0; i < N; i++) amp[i] = 2 * mean - amp[i];
  },

  /* theta is the small starting angle: sin(theta) = 1/sqrt(N). Each round rotates by 2*theta. */
  theta(N) {
    return Math.asin(1 / Math.sqrt(N));
  },

  /* Best number of rounds: the one where (2k+1)*theta is closest to 90 degrees. */
  optimalIterations(N) {
    return Math.max(1, Math.round(Math.PI / (4 * this.theta(N)) - 0.5));
  },

  /* Closed-form success probability after k rounds: sin^2((2k+1) * theta). */
  probability(k, N) {
    return Math.sin((2 * k + 1) * this.theta(N)) ** 2;
  },

  /* Squeeze the N amplitudes into the 2-D picture:
       t = amplitude on the target,
       w = length of everything else (the "non-target" direction). */
  twoDView(amp, target) {
    let others = 0;
    for (let i = 0; i < amp.length; i++) if (i !== target) others += amp[i] * amp[i];
    return { w: Math.sqrt(others), t: amp[target] };
  },

  /* One simulated measurement: pick state i with probability amp[i]^2. */
  measureOnce(amp) {
    let r = Math.random();
    for (let i = 0; i < amp.length - 1; i++) {
      r -= amp[i] * amp[i];
      if (r < 0) return i;
    }
    return amp.length - 1;
  },
};

if (typeof module !== 'undefined') module.exports = Grover;   // lets Node test this file
