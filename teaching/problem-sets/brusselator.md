# Classical Turing (Brusselator) — problem set

Demo: [`?model=brusselator-grid`](https://tt1nker.github.io/adaptiveNet/player.html?model=brusselator-grid) · Reference: Turing, *Phil. Trans. R. Soc. B* **237**, 37 (1952). Brusselator: Prigogine & Lefever (1968)

## Five Δ-experiments



**1. Find the Turing instability boundary.** Hold A and B fixed in a parameter region known to support patterns (e.g. A=2, B=5). Sweep D_v / D_u from 1 up. Locate the threshold ratio at which the homogeneous state first becomes unstable to spatial perturbations. Compare to the analytic Turing condition: the inhibitor must diffuse sufficiently faster than the activator. How close is your numerical threshold to the textbook prediction?

**2. Wavelength selection.** Above the Turing threshold, the system selects a characteristic spot/stripe wavelength λ. Measure λ from the resulting pattern. Vary D_u (keeping D_v/D_u fixed). Does λ scale as √D_u as the Turing analysis predicts?

**3. Pattern morphology.** With A and B fixed, is the asymptotic pattern (spots, stripes, mixed) deterministic — or does it depend on the random initial condition? Run 10 trials with different seeds at the same (A, B). What fraction give which morphology? This is *pattern selection under degenerate Turing instability* — an active area in nonlinear dynamics.

**4. From grid to graph.** Compare the asymptotic pattern here (Brusselator on a 2D lattice — stripes / spots) to the *Network Turing Patterns* demo (Brusselator-like reactions on a random graph — hub-organized clusters). What is the same? What is different? The chemistry is identical; only the topology changes. Argue what role spatial dimension plays in selecting morphology.

**5. Hopf vs Turing.** At small B, the homogeneous state may oscillate in time without forming spatial patterns (Hopf bifurcation), distinct from the Turing instability (spatial patterns from a stable temporal state). Find the (A, B) region where each occurs. Argue why time-oscillation and space-pattern instabilities can be present in the same model.


---

## 五道 Δ 实验（中文版）



**1. 寻找 Turing 失稳边界。** 在已知支持图样的参数区固定 A 和 B (例如 A=2, B=5)。从 1 开始向上扫描 D_v / D_u。定位均匀态首次对空间扰动失稳的阈值比。与解析 Turing 条件比较：抑制剂必须足够快地扩散于活化剂之上。你的数值阈值与教科书预测距离多近？

**2. 波长选择。** 在 Turing 阈值之上，系统选择一个特征斑点/条纹波长 λ。从生成的图样测量 λ。变化 D_u (保持 D_v/D_u 不变)。λ 是否如 Turing 分析预测的那样按 √D_u 标度？

**3. 图样形态学。** 固定 A 和 B，渐进图样 (斑点、条纹、混合) 是确定的，还是依赖于随机初始条件？在同一 (A, B) 下用 10 个不同 seed 各跑一次。哪种形态出现的比例多大？这是*简并 Turing 失稳下的图样选择*——非线性动力学的活跃领域。

**4. 从格子到图。** 比较这里 (Brusselator 在 2D 格子上——条纹/斑点) 与*网络 Turing 图样* demo (类 Brusselator 反应在随机图上——hub 主导聚类) 的渐进图样。什么相同？什么不同？化学反应完全相同，只有拓扑不同。论证空间维度在选择形态学上扮演什么角色。

**5. Hopf vs Turing。** 在小 B 处，均匀态可能在时间上振荡而不形成空间图样 (Hopf 分岔)，与 Turing 失稳 (从稳定时间态出现空间图样) 不同。找出每种情况发生的 (A, B) 区域。论证为何时间振荡和空间图样失稳能在同一模型中并存。

