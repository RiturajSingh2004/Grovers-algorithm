"""
Grover's algorithm as a real quantum circuit in Qiskit.

    pip install qiskit
    python grover_qiskit.py            # 4 qubits, target 11
    python grover_qiskit.py 5 20       # 5 qubits, target index 20

grover.py simulated the maths directly. Here the same two steps (oracle, diffusion)
are built from gates, then the circuit's exact state is compared with grover.py.

Qiskit numbers qubits from the right: qubit 0 is the least significant bit.
So basis-state index i has qubit k equal to (i >> k) & 1. We use that everywhere
to avoid bit-order mistakes.
"""
import sys
import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

from grover import run_grover, optimal_iterations


def phase_flip_all_ones(qc: QuantumCircuit, n: int) -> None:
    """Multi-controlled Z: flips the sign of |11...1> only (built as H - multi-controlled X - H)."""
    qc.h(n - 1)
    qc.mcx(list(range(n - 1)), n - 1)
    qc.h(n - 1)


def add_oracle(qc: QuantumCircuit, n: int, target: int) -> None:
    """Flip the sign of |target>.
    Trick: X gates turn |target> into |11...1>, flip that one state, then undo the X gates."""
    zero_bits = [k for k in range(n) if not (target >> k) & 1]
    for k in zero_bits:
        qc.x(k)
    phase_flip_all_ones(qc, n)
    for k in zero_bits:
        qc.x(k)


def add_diffusion(qc: QuantumCircuit, n: int) -> None:
    """Reflect about the mean:  H^n  X^n  (flip |11..1>)  X^n  H^n.
    This circuit equals -(2|s><s| - I); the global phase of pi below removes the minus sign,
    so amplitudes match grover.py exactly (it never changes measurement probabilities)."""
    qc.h(range(n))
    qc.x(range(n))
    phase_flip_all_ones(qc, n)
    qc.x(range(n))
    qc.h(range(n))
    qc.global_phase += np.pi


def build_grover_circuit(n: int, target: int, iterations: int | None = None) -> QuantumCircuit:
    if iterations is None:
        iterations = optimal_iterations(n)
    qc = QuantumCircuit(n, name=f"Grover n={n}")
    qc.h(range(n))                       # step 1: uniform superposition
    for _ in range(iterations):
        qc.barrier()
        add_oracle(qc, n, target)         # step 2: oracle
        qc.barrier()
        add_diffusion(qc, n)              # step 3: diffusion
    return qc


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    target = int(sys.argv[2]) if len(sys.argv) > 2 else 11
    k = optimal_iterations(n)

    qc = build_grover_circuit(n, target, k)
    print(qc.draw("text", fold=120))

    # 1) Exact check: circuit state vs the NumPy simulation from grover.py.
    circuit_state = Statevector(qc).data                       # complex vector, index = integer value
    numpy_state = run_grover(n, target, k)[-1].amplitudes
    print("circuit matches grover.py:", np.allclose(circuit_state, numpy_state))

    # 2) Simulated measurements (no extra package needed: sample from the exact state).
    shots = 1000
    counts = Statevector(qc).sample_counts(shots)              # keys are bitstrings, qubit 0 on the right
    expected = format(target, f"0{n}b")
    print(f"\n{shots} shots, target = {expected}")
    for bits, c in sorted(counts.items(), key=lambda kv: -kv[1])[:5]:
        print(f"  {bits}: {c}")
    print(f"target found in {counts.get(expected, 0) / shots:.1%} of shots")

    # 3) Optional picture of the circuit and counts.
    try:
        import matplotlib
        matplotlib.use("Agg")
        qc.draw("mpl", fold=40, filename="grover_circuit.png")
        print("wrote grover_circuit.png")
    except Exception as err:   # drawing needs extra optional packages (pylatexenc)
        print("skipped circuit image:", type(err).__name__)
