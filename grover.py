"""
Grover's search algorithm, simulated exactly with NumPy.

A register of n qubits has N = 2**n basis states. We store the quantum state
as a plain vector of N amplitudes. (Real numbers are enough here, because
Grover only ever uses sign flips and averaging.)

The probability of measuring basis state i is amplitudes[i] ** 2.
"""
from dataclasses import dataclass
import numpy as np


# ---------------------------------------------------------------- the 3 building blocks
def uniform_superposition(n_qubits: int) -> np.ndarray:
    """Step 1: Hadamard on every qubit -> every state gets amplitude 1/sqrt(N)."""
    N = 2 ** n_qubits
    return np.full(N, 1 / np.sqrt(N))


def oracle(state: np.ndarray, target: int) -> np.ndarray:
    """Step 2: flip the sign of the target's amplitude, leave the others alone."""
    new = state.copy()
    new[target] = -new[target]
    return new


def diffusion(state: np.ndarray) -> np.ndarray:
    """Step 3: reflect every amplitude about the mean:  a_i -> 2*mean - a_i."""
    return 2 * state.mean() - state


# ---------------------------------------------------------------- helpers
def optimal_iterations(n_qubits: int) -> int:
    """Number of Grover rounds that maximises success: round(pi/(4*theta) - 1/2)."""
    theta = np.arcsin(1 / np.sqrt(2 ** n_qubits))
    return max(1, round(np.pi / (4 * theta) - 0.5))


def theoretical_probability(k: int, n_qubits: int) -> float:
    """Closed form: P(k) = sin^2((2k + 1) * theta), with sin(theta) = 1/sqrt(N)."""
    theta = np.arcsin(1 / np.sqrt(2 ** n_qubits))
    return float(np.sin((2 * k + 1) * theta) ** 2)


@dataclass
class Snapshot:
    """The state after one step, plus a label for plots."""
    label: str
    amplitudes: np.ndarray
    iteration: int


def run_grover(n_qubits: int, target: int, iterations: int | None = None) -> list[Snapshot]:
    """Run Grover and record the state after every single step."""
    if iterations is None:
        iterations = optimal_iterations(n_qubits)

    state = uniform_superposition(n_qubits)
    history = [Snapshot("Hadamard (uniform superposition)", state, 0)]

    for k in range(1, iterations + 1):
        state = oracle(state, target)
        history.append(Snapshot(f"Iteration {k}: oracle (flip target)", state, k - 1))
        state = diffusion(state)
        history.append(Snapshot(f"Iteration {k}: diffusion (reflect about mean)", state, k))
    return history


# ---------------------------------------------------------------- matrix version (for understanding)
def oracle_matrix(n_qubits: int, target: int) -> np.ndarray:
    """O = I - 2|t><t|   (identity, with -1 on the target's diagonal entry)."""
    O = np.eye(2 ** n_qubits)
    O[target, target] = -1
    return O


def diffusion_matrix(n_qubits: int) -> np.ndarray:
    """D = 2|s><s| - I, where |s> is the uniform state. Every entry of |s><s| is 1/N."""
    N = 2 ** n_qubits
    return 2 * np.full((N, N), 1 / N) - np.eye(N)


if __name__ == "__main__":
    n, target = 4, 11
    N = 2 ** n

    # 1) The fast vector code and the matrix code must agree.
    s = uniform_superposition(n)
    assert np.allclose(oracle(s, target), oracle_matrix(n, target) @ s)
    assert np.allclose(diffusion(s), diffusion_matrix(n) @ s)

    # 2) Simulation vs closed-form formula, iteration by iteration.
    print(f"N = {N}, target = {target} (|{target:0{n}b}>), optimal k = {optimal_iterations(n)}\n")
    print(f"{'k':>2} {'simulated P':>12} {'formula P':>10}")
    state = uniform_superposition(n)
    for k in range(0, 8):
        print(f"{k:>2} {state[target] ** 2:>12.4f} {theoretical_probability(k, n):>10.4f}")
        state = diffusion(oracle(state, target))
