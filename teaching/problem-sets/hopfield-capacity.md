# Hopfield Capacity (α_c Phase Transition) — problem set

Demo: [`?model=hopfield-capacity`](https://tt1nker.github.io/adaptiveNet/player.html?model=hopfield-capacity) · Reference: Hopfield, *PNAS* **79**, 2554 (1982); Amit, Gutfreund & Sompolinsky, *Phys. Rev. A* **32**, 1007 (1985); *Annals of Physics* **173**, 30 (1987)

## Five Δ-experiments



**1. Locate α_c.** At fixed N = 200, sweep α from 0.05 to 0.25 in steps of 0.01. For each α, measure the average overlap with the target pattern after convergence (over 10 random target choices). Plot overlap vs α. Locate the transition point. Compare to the AGS prediction α_c ≈ 0.138.

**2. Finite-N effects.** Repeat the α sweep at N = 100, 200, 400, 800. Does α_c shift with N? Does the transition sharpen? Plot the transition width vs 1/N — this is the finite-size scaling for the Hopfield phase transition.

**3. Two order parameters diverge.** Just above α_c, the network may fall into a wrong-but-stored state (target overlap drops, max overlap with any stored pattern stays high). Walk α from 0.10 to 0.20 and watch the two time-series. Identify the regime where they disagree. What does that regime correspond to in the AGS phase diagram?

**4. Spin-glass phase.** At α = 0.2 (well above α_c), the system reaches a state that is uncorrelated with any stored pattern (max overlap ≈ 0). Run for 10 different seeds. Do all converge to the same final state, or different final states? Argue the relevance of *replica symmetry breaking* (Parisi 1979) to your observation.

**5. Critical exponent estimation.** From your finite-size α sweep, fit the order parameter as |α − α_c|^β near the transition. Extract β. Compare to mean-field β = 1/2. Does the Hopfield transition match mean-field, or does it have its own universality class? (Hint: mean-field is essentially what AGS computed analytically.)


---

## 五道 Δ 实验（中文版）



**1. 定位 α_c。** 固定 N = 200，在 0.05 到 0.25 之间以 0.01 步长扫描 α。对每个 α，对 10 个随机目标取平均，测量收敛后与目标图样的重叠度。绘制重叠度 vs α。定位相变点。与 AGS 预测 α_c ≈ 0.138 比较。

**2. 有限 N 效应。** 在 N = 100, 200, 400, 800 下重复 α 扫描。α_c 是否随 N 漂移？相变是否变锐利？绘制相变宽度 vs 1/N——这是 Hopfield 相变的有限尺寸标度。

**3. 两个序参量发散。** 在 α_c 之上一点，网络可能落入"错误但仍存储"的态 (目标重叠度跌落，与任意存储图样的最大重叠度仍高)。在 α 从 0.10 到 0.20 之间走，观察两条时间序列。识别它们分歧的区域。这个区域对应 AGS 相图中的什么？

**4. 自旋玻璃相。** 在 α = 0.2 (远高于 α_c)，系统到达一个与任何存储图样都不相关的态 (最大重叠度 ≈ 0)。用 10 个不同 seed 跑。它们都收敛到同一最终态，还是不同最终态？论证 *复制对称性破缺* (Parisi 1979) 与你的观察的相关性。

**5. 临界指数估计。** 从你的有限尺寸 α 扫描，把序参量拟合为 |α − α_c|^β，提取 β。与平均场 β = 1/2 比较。Hopfield 相变是平均场，还是有自己的普适类？(提示：平均场实质上就是 AGS 解析计算的内容。)

