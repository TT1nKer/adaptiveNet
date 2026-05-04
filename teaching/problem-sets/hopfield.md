# Hopfield Retrieval — problem set

Demo: [`?model=hopfield`](https://tt1nker.github.io/adaptiveNet/player.html?model=hopfield) · Reference: Hopfield, *PNAS* **79**, 2554 (1982)

## Five Δ-experiments



**1. Recall accuracy vs noise.** Pick a stored pattern. Sweep the initial-noise fraction from 0% to 50%. For each, measure the final overlap with the stored pattern (post-convergence). Plot accuracy vs noise. Where is the basin-of-attraction boundary?

**2. Capacity vs N.** Hold the noise level at zero (perfect cue). Add patterns one at a time and check whether the network still recalls each correctly from the cue. Find the point at which recall starts failing. Compare your empirical "capacity" to N × 0.138 (the AGS prediction). How well do they agree at N = 100? At N = 400?

**3. Spurious states.** Set the network up with K = 3 stored patterns. Initialize from a state equal to (ξ_1 + ξ_2 + ξ_3) / 3 and binarized. The network may converge to a *spurious mixed state* that is not any of the originals. Verify, and argue why these states are local minima of the Hopfield energy.

**4. Asymmetric vs symmetric updates.** Switch between synchronous (all neurons update at once) and asynchronous (one at a time) update modes. Does the network converge in both cases? Hopfield's energy-decrease argument relies on asynchronous update; what happens to convergence guarantees under synchronous?

**5. Storage degradation.** Store K patterns. Then *corrupt* a single pattern by flipping 20% of its bits in storage (i.e., modify the W matrix as if you stored the corrupted version). Verify that recall of the corrupted pattern still works in the corrupted form, and that the other patterns are mostly preserved. This is the *graceful degradation* property of distributed memory.


---

## 五道 Δ 实验（中文版）



**1. 检索准确度 vs 噪声。** 选一个存储图样。在 0% 到 50% 之间扫描初始噪声比例。对每个比例测量收敛后与存储图样的最终重叠度。绘制准确度 vs 噪声。吸引盆边界在哪里？

**2. 容量 vs N。** 把噪声固定在零 (完美线索)。一次加一个图样，检查网络是否仍能从线索正确检索每一个。找到检索开始失败的点。比较你的经验"容量"与 N × 0.138 (AGS 预测)。N = 100 时一致度如何？N = 400 时呢？

**3. 伪态。** 存储 K = 3 个图样的网络。从 (ξ_1 + ξ_2 + ξ_3) / 3 二值化的状态出发。网络可能收敛到一个不属于任何存储图样的*伪混合态*。验证之，并论证为何这些态是 Hopfield 能量的局部极小。

**4. 异步 vs 同步更新。** 在同步 (所有神经元同时更新) 和异步 (一次一个) 更新模式间切换。两种情况下网络都收敛吗？Hopfield 的能量下降论证依赖于异步更新；同步下收敛保证会怎样？

**5. 存储退化。** 存储 K 个图样。然后通过翻转 20% 比特来*破坏*某一个图样的存储 (即按破坏后版本修改 W 矩阵)。验证破坏后图样仍能以破坏后形式被检索，且其它图样大部分保留。这是分布式记忆的*优雅退化*性质。

