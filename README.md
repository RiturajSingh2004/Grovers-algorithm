# Grover's algorithm in plain NumPy

Files
- `grover.py`: the whole algorithm (about 40 lines of real logic) plus a self-check. Run `python grover.py`.
- `visualize.py`: matplotlib figure and animated GIF. Run `python visualize.py [n_qubits] [target]`.
- Needs only `numpy` and `matplotlib`.

## The problem
Among N = 2^n items, exactly one (the target) satisfies a test you can only run by calling an oracle.
Classically you check items one by one: about N/2 calls on average.
Grover finds it in about (pi/4)*sqrt(N) oracle calls. For N = 1,000,000 that is about 785 instead of 500,000.

## The state is a list of N numbers
`amplitudes[i]` is the amplitude of item i. The chance of measuring item i is `amplitudes[i]**2`,
and the squares always add to 1.

## Three steps
1. **Superposition.** Start with every amplitude equal to 1/sqrt(N). Nothing is favored.
2. **Oracle.** Flip the sign of the target's amplitude only.
   Probabilities are squares, so nothing visible changes, but the average of all amplitudes drops a little.
3. **Diffusion.** Replace every amplitude a by `2*mean - a` (reflect about the mean).
   Amplitudes above the mean go below it and vice versa, by the same distance.

Repeat steps 2 and 3 about (pi/4)*sqrt(N) times, then measure.

## Worked example, N = 16 (this is what the plots show)
- Start: all 16 amplitudes are 0.25. P(target) = 0.0625.
- Oracle: target becomes -0.25. Mean = (15*0.25 - 0.25)/16 = 0.21875.
- Diffusion, others: 2*0.21875 - 0.25 = 0.1875 (they shrink).
- Diffusion, target: 2*0.21875 - (-0.25) = 0.6875 (it jumps).
- P(target) = 0.6875^2 = 0.4727. After 3 rounds it is 0.9613.

Why it works: the target sits far below the mean after the oracle, so reflecting it about the mean lifts it
by far more than the others fall. Each round moves a bit of probability from the other states onto the target.

## Why sqrt(N) rounds: it is a rotation
Only two directions matter: |target> and |others> (the normalized mix of everything else).
The start state |s> sits at a small angle theta from |others>, where

    sin(theta) = 1/sqrt(N)

The oracle reflects the state across the |others> axis. Diffusion reflects it across |s>.
Two reflections make one rotation, by 2*theta toward the target. After k rounds the angle is (2k+1)*theta, so

    P(k) = sin^2((2k+1) * theta)

This is exactly what `theoretical_probability` computes, and `python grover.py` shows it equals the simulation.
P is highest when (2k+1)*theta = pi/2, i.e. k = pi/(4*theta) - 1/2, which is about (pi/4)*sqrt(N) for large N.
Go past that and the state rotates beyond the target, so the probability falls again.
That is why Grover is not "run it longer for better odds".

## The same thing as matrices (`oracle_matrix`, `diffusion_matrix`)
- Oracle: O = I - 2|t><t|. The identity with -1 at the target's diagonal entry.
- Diffusion: D = 2|s><s| - I, where every entry of |s><s| is 1/N.
  Multiplying D @ a gives 2*mean(a) - a, the same reflection as the one-line version.
- One Grover round is D @ O. The self-check asserts the vector and matrix code agree.

## Qiskit version (`grover_qiskit.py`)
The same algorithm as a gate-level circuit. Install with `pip install -r requirements.txt`, then `python grover_qiskit.py`.
- Superposition: `H` on every qubit.
- Oracle: put X gates on the target's 0-bits, so the target becomes |11...1>. Flip that state's sign with a
  multi-controlled Z (H, multi-controlled X, H on the last qubit), then undo the X gates.
- Diffusion: `H`, `X`, multi-controlled Z, `X`, `H` on all qubits. This circuit is -(2|s><s| - I); a global phase of pi
  (`qc.global_phase += np.pi`) cancels the minus sign. A global phase never changes measurement probabilities.
- The script compares the circuit's exact state with `grover.py`, then samples 1000 shots.
- Qiskit puts qubit 0 on the right of printed bitstrings, so index 11 in 4 qubits prints as `1011`.
