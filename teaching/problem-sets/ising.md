# Ising Model (2D Lattice) — problem set

Demo: [`?model=ising`](https://tt1nker.github.io/adaptiveNet/player.html?model=ising) · Reference: Onsager, *Phys. Rev.* **65**, 117 (1944)

## Five Δ-experiments

### 1. Locate T_c

Sweep T from 1.5 to 3.0 in steps of 0.05 at fixed grid size. For each T, run until magnetization stabilizes (~5000 sweeps). Plot |⟨m⟩| vs T. Compare your numerical T_c to Onsager's exact value 2/ln(1+√2) ≈ 2.269. Why is the numerical curve smooth across T_c rather than discontinuous?

### 2. Finite-size scaling

Hold T = 2.269. Run at grid sizes 32, 64, 128, 256. Measure the magnetization fluctuation σ(m). It should scale as L^(−1/8) with system size L (Onsager). Plot log σ vs log L and extract the slope. How close to −0.125 do you get?

### 3. Critical slowing down

At T = 2.269 vs T = 1.0 vs T = 4.0, measure how long it takes the magnetization to decorrelate from its initial value. The critical regime should be dramatically slower (formally, infinitely slow in the L → ∞ limit). Quantify the difference.

### 4. Symmetry breaking

Start from random initial conditions. Run at T = 1.0. Repeat 10 times. How often does the system end up positively magnetized vs negatively? This is the Z₂ symmetry of the Ising model — and the Mermin-Wagner-style argument for why it can break in 2D but not in 1D.

### 5. Coarsening dynamics

Start at T well below T_c (e.g., T = 1.0) from random initial conditions. Watch how domains form and grow. Estimate the typical domain size as a function of time. The Lifshitz-Slyozov-Allen-Cahn theory predicts a power law L(t) ~ t^(1/2) for non-conserved order parameter. Does your data support this?

---

## 五道 Δ 实验（中文版）

### 1. 定位 T_c

固定格子大小，在 1.5 到 3.0 之间以 0.05 步长扫描 T。对每个 T 运行至磁化稳定（~5000 sweeps）。绘制 |⟨m⟩| vs T。把你的数值 T_c 与 Onsager 精确值 2/ln(1+√2) ≈ 2.269 比较。为何数值曲线在 T_c 处平滑而不是不连续？

### 2. 有限尺寸标度

固定 T = 2.269。在格子大小 32, 64, 128, 256 下跑。测量磁化涨落 σ(m)。它应该按 L^(−1/8) 标度（Onsager）。绘制 log σ vs log L 并提取斜率。你得到多接近 −0.125？

### 3. 临界减速

在 T = 2.269 vs T = 1.0 vs T = 4.0 下，测量磁化与初始值去关联所需时间。临界区应该戏剧性地慢（在 L → ∞ 极限下形式上无限慢）。量化差异。

### 4. 对称性破缺

从随机初始条件出发。在 T = 1.0 下跑。重复 10 次。系统多大比例最终正向磁化 vs 负向？这是 Ising 模型的 Z₂ 对称性——以及 Mermin-Wagner 风格论证为何这能在 2D 破缺却不能在 1D 破缺。

### 5. 粗化动力学

从 T_c 之下（例如 T = 1.0）的随机初始条件出发。看畴如何形成和增长。估计典型畴大小作为时间的函数。Lifshitz-Slyozov-Allen-Cahn 理论预测非守恒序参量 L(t) ~ t^(1/2) 幂律。你的数据支持这点吗？
