"""
Matplotlib visuals for Grover's algorithm (uses grover.py).

    python visualize.py              # writes grover_steps.png and grover.gif
    python visualize.py 5 20         # 5 qubits, target index 20
"""
import sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation, PillowWriter

from grover import run_grover, optimal_iterations, theoretical_probability

POS, NEG, TARGET = "#f0b24a", "#5aa7ff", "#ff6b7f"


def draw_bars(ax, amplitudes, target, title):
    """Bar chart of all amplitudes with the mean drawn as a dashed line."""
    N = len(amplitudes)
    colors = [POS if a >= 0 else NEG for a in amplitudes]
    colors[target] = TARGET
    ax.bar(range(N), amplitudes, color=colors)
    ax.axhline(amplitudes.mean(), color="teal", ls="--", lw=1.2, label=f"mean = {amplitudes.mean():.3f}")
    ax.axhline(0, color="gray", lw=0.8)
    ax.set_ylim(-1.05, 1.05)
    ax.set_title(title, fontsize=10)
    ax.set_xlabel("basis state index")
    ax.set_ylabel("amplitude")
    ax.legend(loc="upper left", fontsize=8)


def save_steps_figure(n_qubits, target, path="grover_steps.png"):
    """One small bar chart per step: the whole algorithm on a single page."""
    history = run_grover(n_qubits, target)
    cols = 2
    rows = int(np.ceil(len(history) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(11, 2.6 * rows), sharey=True)
    for ax, snap in zip(axes.flat, history):
        draw_bars(ax, snap.amplitudes, target, snap.label)
    for ax in axes.flat[len(history):]:
        ax.axis("off")
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def save_animation(n_qubits, target, path="grover.gif", frames_per_step=10):
    """Animated bars (left) and probability-vs-iteration curve (right)."""
    history = run_grover(n_qubits, target, iterations=optimal_iterations(n_qubits))
    N = 2 ** n_qubits

    # Linearly interpolate between consecutive snapshots so bars glide.
    frames = []  # (amplitudes, label, iteration)
    for a, b in zip(history, history[1:]):
        for t in np.linspace(0, 1, frames_per_step, endpoint=False):
            frames.append(((1 - t) * a.amplitudes + t * b.amplitudes, b.label, b.iteration))
    frames += [(history[-1].amplitudes, history[-1].label, history[-1].iteration)] * 12

    ks = np.arange(0, optimal_iterations(n_qubits) * 2 + 2)
    p_theory = [theoretical_probability(k, n_qubits) for k in ks]

    fig, (ax_bars, ax_p) = plt.subplots(1, 2, figsize=(11, 4.2), gridspec_kw={"width_ratios": [2, 1]})

    def update(i):
        amplitudes, label, k = frames[i]
        ax_bars.clear()
        ax_p.clear()
        draw_bars(ax_bars, amplitudes, target, label)
        ax_p.plot(ks, p_theory, "o-", color="gray", ms=3, label="theory")
        ax_p.plot(k, amplitudes[target] ** 2, "o", color=TARGET, ms=9, label="now")
        ax_p.set_ylim(0, 1.05)
        ax_p.set_xlabel("iterations k")
        ax_p.set_ylabel("P(measure target)")
        ax_p.set_title(f"P = {amplitudes[target] ** 2:.1%}", fontsize=10)
        ax_p.legend(loc="lower right", fontsize=8)

    anim = FuncAnimation(fig, update, frames=len(frames), interval=60)
    anim.save(path, writer=PillowWriter(fps=16))
    plt.close(fig)


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    target = int(sys.argv[2]) if len(sys.argv) > 2 else 11
    save_steps_figure(n, target)
    save_animation(n, target)
    print("wrote grover_steps.png and grover.gif")
