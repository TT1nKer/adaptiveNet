# Gray–Scott on a 2D Grid — problem set

Demo: [`?model=gray-scott`](https://tt1nker.github.io/adaptiveNet/player.html?model=gray-scott) · Reference: Pearson, *Science* **261**, 189 (1993). Original chemistry: Gray & Scott (1984)

## Five Δ-experiments



**1. Walk Pearson's map.** Use the six provided presets (mitosis, worms, maze, ξ-spirals, β-wavefield, α-chaos, U-skate). For each, write down the (F, k) location and qualitatively describe the asymptotic behavior. Reproduce Pearson's 1993 phase diagram on paper from your observations. Which boundaries between regimes are sharp, which are gradual?

**2. Find a glider.** In the U-skate region (around F ≈ 0.062, k ≈ 0.0609), small perturbations can produce localized self-propagating structures. Find one. Measure its propagation speed in cells per simulation step. Compare to Munafo's reported U-skate world data.

**3. Diffusion ratio.** Hold F and k at a stripe-producing region (e.g. maze, F ≈ 0.029, k ≈ 0.057). Vary the ratio D_u / D_v from 0.1 to 1.0. At what ratio do patterns disappear? This isolates the activator-inhibitor diffusion contrast as the necessary ingredient — Turing's 1952 result.

**4. Reproducibility of α-chaos.** In the α region (F ≈ 0.01, k ≈ 0.045), patterns never settle. Run twice with the same seed and same parameters — identical. Run twice with different seeds — divergent trajectories. Estimate the divergence rate; this is a positive Lyapunov exponent in disguise.

**5. Pattern size scaling.** Vary the lattice size from 64×64 to 256×256 in mitosis (F ≈ 0.0367, k ≈ 0.0649). Does the typical spot size scale with the lattice (suggesting size is set by boundary or finite-size effects), or stay constant in physical units (suggesting size is set by the diffusion lengths)? Compare to the theoretical prediction λ ~ √(D_u / k_eff).


---

## 五道 Δ 实验（中文版）



**1. 走完 Pearson 图谱。** 使用六个预设 (mitosis、worms、maze、ξ-spirals、β-wavefield、α-chaos、U-skate)。对每个，记录 (F, k) 位置并定性描述渐进行为。从你的观察在纸上重建 Pearson 1993 相图。哪些区域边界尖锐，哪些渐变？

**2. 找一个 glider。** U-skate 区域 (F ≈ 0.062, k ≈ 0.0609 附近)，小扰动可以产生局部自传播结构。找一个。测量它每个仿真步的传播速度。与 Munafo 报告的 U-skate world 数据比较。

**3. 扩散比。** 在条纹生成区域 (例如 maze, F ≈ 0.029, k ≈ 0.057) 固定 F 和 k。在 0.1 到 1.0 之间变化 D_u / D_v 比值。哪个比值下图样消失？这分离出活化-抑制扩散对比为必要成分——这是 Turing 1952 的结果。

**4. α 混沌的可重现性。** 在 α 区域 (F ≈ 0.01, k ≈ 0.045) 图样从不稳定。同 seed + 同参数跑两次——完全一致。不同 seed 跑两次——轨迹发散。估计发散率；这其实就是一个伪装的正 Lyapunov 指数。

**5. 图样尺寸标度。** 在 mitosis (F ≈ 0.0367, k ≈ 0.0649) 下，把格子大小从 64×64 变到 256×256。典型斑点尺寸是否随格子大小标度 (说明尺寸由边界或有限尺寸效应决定)，还是保持物理单位下的常数 (说明尺寸由扩散长度决定)？与理论预测 λ ~ √(D_u / k_eff) 比较。

