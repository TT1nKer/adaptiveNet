# Adaptive SIS Epidemic (Gross–D'Lima–Blasius) — problem set

Demo: [`?model=adaptive-sis`](https://tt1nker.github.io/adaptiveNet/player.html?model=adaptive-sis) · Reference: Gross, D'Lima & Blasius, *Phys. Rev. Lett.* **96**, 208701 (2006). Mean-field critique: Pastor-Satorras et al., *Rev. Mod. Phys.* **87**, 925 (2015)

## Five Δ-experiments



**1. Plain SIS baseline.** Set w = 0. Sweep p / r from 0.5 to 3.0. For each value, run until the infected fraction stabilizes. Locate the transition point — should be at p / r ≈ 1 (more precisely, at p × ⟨k⟩ / r = 1 in mean-field). Verify on ER, BA, WS topologies. Does the threshold differ between scale-free (BA) and homogeneous (ER) — and does Pastor-Satorras 2001 (epidemic threshold → 0 on scale-free) help explain why?

**2. Find the bistable region.** With w = 0.3, sweep p slowly (over many simulation steps). Then sweep p back down. Plot infected fraction vs p for both directions. Hysteresis loop should appear — this is the bistability that does not exist in plain SIS.

**3. Network restructuring rate.** With strong adaptation (w = 0.5), measure how fast the SI-edge fraction drops as the system equilibrates. Compare to the rate at which the infected fraction stabilizes. The network "learns" to quarantine the infected cluster — quantify this learning rate.

**4. Topology of the I-subgraph vs S-subgraph.** After equilibration with w > 0, compute the average degree of I nodes vs S nodes within their own subpopulations. The I subgraph should be much sparser than the S subgraph (S has been consolidating connections; I has been losing them). Quantify the asymmetry.

**5. From mean-field to simulation.** The Gross 2006 paper derived a moment-closure approximation that predicts the bistability region analytically. Pick a (p, r, w) point. Compute the mean-field prediction for steady-state infected fraction. Run the simulation 20 times with different seeds. Plot the simulation results against the mean-field prediction. How well does the closure work? (This is the *moment-closure validation* workflow that this kind of platform is meant to support.)


---

## 五道 Δ 实验（中文版）



**1. 普通 SIS 基线。** 设 w = 0。在 0.5 到 3.0 之间扫描 p / r。每个值下运行至感染比例稳定。定位相变点——应该在 p / r ≈ 1 (更精确地，平均场下 p × ⟨k⟩ / r = 1)。在 ER、BA、WS 拓扑上验证。无标度 (BA) 与同质 (ER) 之间阈值是否不同——Pastor-Satorras 2001 (无标度上流行病阈值 → 0) 是否帮助解释？

**2. 寻找双稳态区域。** 在 w = 0.3 下慢慢扫描 p (跨多个仿真步)。然后把 p 扫回去。绘制感染比例 vs p 的两个方向。应该出现滞回环——这就是普通 SIS 中不存在的双稳态。

**3. 网络重构速率。** 在强自适应 (w = 0.5) 下，测量系统平衡时 SI 边比例下降的速度。与感染比例稳定的速度比较。网络"学会"隔离感染簇——量化这种学习速率。

**4. I 子图 vs S 子图的拓扑。** 在 w > 0 下平衡后，分别计算 I 节点和 S 节点在各自子总体内的平均度数。I 子图应该比 S 子图稀疏得多 (S 在巩固连接；I 在失去连接)。量化这种不对称性。

**5. 从平均场到仿真。** Gross 2006 论文推出了一个矩闭合近似，解析地预测双稳态区。挑一个 (p, r, w) 点。计算稳态感染比例的平均场预测。用 20 个不同 seed 跑仿真。把仿真结果对平均场预测画图。闭合工作得多好？(这就是这类平台本应支持的*矩闭合验证*工作流。)

