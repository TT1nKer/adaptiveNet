# Neural Avalanches (Self-Organised Criticality) — problem set

Demo: [`?model=avalanches`](https://tt1nker.github.io/adaptiveNet/player.html?model=avalanches) · Reference: Bak, Tang & Wiesenfeld, *Phys. Rev. Lett.* **59**, 381 (1987); Beggs & Plenz, *J. Neurosci.* **23**, 11167 (2003); Beggs, *Phil. Trans. R. Soc. A* **366**, 329 (2008); Touboul & Destexhe, *PLOS ONE* **12**, e0181104 (2017); Clauset, Shalizi & Newman, *SIAM Review* **51**, 661 (2009)

## Five Δ-experiments



**1. Verify the power-law exponent.** Run for ~10⁵ avalanches (build up statistics). Plot the avalanche-size distribution on log-log axes. Fit the slope. The BTW prediction in 2D is τ ≈ 1.0 (not −3/2 — that −3/2 is the Beggs-Plenz neural value, which BTW only approaches under specific dimensions). Compare your slope to both. What does the discrepancy reveal about which model the demo actually implements?

**2. Dissipation ε.** Vary the dissipation rate ε from 0 to 0.1. With ε = 0, the system never reaches steady state (avalanches grow unboundedly in expectation). With ε too large, criticality is destroyed. Find the qualitative regimes. The *self-organised* in SOC means the system tunes itself to the critical line for small ε > 0.

**3. Methodological knob: bin size.** The Beggs-Plenz 2003 work computed avalanches by binning spike times into 4 ms windows. Bin width dramatically affects the apparent power-law slope (Touboul-Destexhe 2017 critique). Drag the **avalanche bin width** slider from 1 to 20 — at higher values, multiple physical cascades merge into one "observed" avalanche, the size distribution shifts upward, and the apparent τ can change substantially. This is the *core* of the Plenz-vs-Touboul methodological debate, exposed as a live knob.

**4. Subsampling effect.** Drag the **observed cell fraction** slider down from 1.0 to 0.1. The displayed avalanche sizes now count only fires in the observed subset (a deterministic mask of cells, hash-based so the slider strictly adds/removes observed cells without reshuffling). The Touboul-Destexhe critique argued that subsampling alone can produce apparent power laws even from non-critical dynamics — does the apparent shape of the size distribution change qualitatively as you vary subsampling? Try this in both the *critical* and *subcritical* presets.

**5. Compare Plenz exponent to Clauset-Shalizi-Newman 2009 KS test.** The standard practice for declaring "this is power-law" is the CSN 2009 procedure: fit power-law via maximum likelihood, then compute KS distance to lognormal and exponential alternatives. Apply this to your data. Does the power-law hypothesis actually win, or do lognormal / exponential fit comparably well? This is the gold-standard methodology that much of the brain-criticality literature still does not consistently apply.


---

## 五道 Δ 实验（中文版）



**1. 验证幂律指数。** 跑 ~10⁵ 个雪崩 (累计统计)。用 log-log 轴绘雪崩大小分布。拟合斜率。BTW 在 2D 的预测是 τ ≈ 1.0 (不是 −3/2——那 −3/2 是 Beggs-Plenz 神经值，BTW 只在特定维度下接近)。把你的斜率与两者比较。差异揭示了 demo 实际实现的是哪个模型？

**2. 耗散 ε。** 在 0 到 0.1 之间变化耗散率 ε。ε = 0 时系统永不到达稳态 (期望意义上雪崩无界增长)。ε 太大临界被破坏。找出定性区域。SOC 中的*自组织*意味着系统在小 ε > 0 下自调到临界线。

**3. 方法学旋钮：bin 大小。** Beggs-Plenz 2003 通过把脉冲时刻分到 4 ms 窗口里计算雪崩。Bin 宽度戏剧性地影响表观幂律斜率 (Touboul-Destexhe 2017 的批评)。拖动 **avalanche bin width** 滑块从 1 到 20——bin 宽时多个物理级联合并成一个"观察到的"雪崩，大小分布上移，表观 τ 可能发生显著变化。这是 Plenz vs Touboul 方法学辩论的*核心*，作为可实时调节的旋钮暴露在这里。

**4. 子采样效应。** 把 **observed cell fraction** 滑块从 1.0 拉到 0.1。显示的雪崩大小现在只统计观察子集中的发放 (基于哈希的确定性 cell 掩码，滑块严格添加/移除观察 cell 而不重新洗牌)。Touboul-Destexhe 的批评论证了仅子采样就能从非临界动力学中产生表观幂律——大小分布的表观形状随子采样的变化是否定性改变？在 *critical* 和 *subcritical* 两个预设里都试一下。

**5. 对比 Plenz 指数与 Clauset-Shalizi-Newman 2009 KS 检验。** 宣称"这是幂律"的标准做法是 CSN 2009 程序：通过最大似然拟合幂律，然后计算与对数正态和指数候选的 KS 距离。把这套用到你的数据上。幂律假设真的赢了，还是对数正态/指数拟合得相当好？这是脑临界文献至今没一致应用的金标准方法学。

