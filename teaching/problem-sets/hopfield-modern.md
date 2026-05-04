# Modern Hopfield (Attention-Equivalent) — problem set

Demo: [`?model=hopfield-modern`](https://tt1nker.github.io/adaptiveNet/player.html?model=hopfield-modern) · Reference: Ramsauer et al., *Hopfield Networks Is All You Need*, [arXiv:2008.02217](https://arxiv.org/abs/2008.02217) (2020)

## Five Δ-experiments



**1. Capacity comparison: classical vs modern.** At N = 100, store as many patterns as you can in classical Hopfield (use the *Hopfield Capacity* demo) — capacity tops out near α_c × N ≈ 14 patterns. Repeat in modern Hopfield: how many patterns can you store before recall breaks? Argue why "exponential in N" is qualitatively different from "linear in N" for memory capacity.

**2. Inverse temperature β.** Modern Hopfield's softmax has a temperature parameter β. At β → 0 the energy is uniform (no preference for any pattern); at β → ∞ the dynamics behave classically (sharp pattern boundaries). Sweep β. Find the regime where mixed-pattern retrieval (a "soft attention" state) appears. This regime is what transformers operate in.

**3. Attention equivalence — verify.** Modern Hopfield retrieval (one update step) computes z_new = X · softmax(β · X^T · z). Compare term-by-term with transformer attention: query = z, keys = values = X. Confirm the two formulas are identical. This is the precise meaning of "attention IS Hopfield retrieval".

**4. Stored-pattern superposition.** Initialize from the average of two stored patterns. In classical Hopfield, the network usually falls into a spurious mixed state. In modern Hopfield (high β), what happens? Does it pick one or stay in the mixture? This relates to Ramsauer's observation that modern Hopfield can act as either a sharp memory or a soft attention pool depending on β.

**5. Why the transformer is not "just" Hopfield.** Modern Hopfield is one attention head with stored patterns as keys/values. A transformer has *learned* keys and values *and* multiple heads *and* feed-forward layers between attention. List three concrete capabilities of a full transformer that a single modern-Hopfield head cannot replicate. (This is meant to ground the hype: the equivalence is real, but it does not mean modern Hopfield = transformer.)


---

## 五道 Δ 实验（中文版）



**1. 容量对比：经典 vs 现代。** 在 N = 100 下，在经典 Hopfield (用 *Hopfield 容量* demo) 中尽可能多地存储图样——容量在 α_c × N ≈ 14 个图样附近见顶。在现代 Hopfield 中重复：检索崩溃前能存多少？论证为何"在 N 中指数级"和"在 N 中线性"对记忆容量来说是定性不同的。

**2. 反温度 β。** 现代 Hopfield 的 softmax 有一个温度参数 β。β → 0 时能量均匀 (没有图样偏好)；β → ∞ 时动力学行为像经典 (尖锐图样边界)。扫描 β。找到混合图样检索 ("软注意力"态) 出现的区域。这个区域就是 transformer 运行的地方。

**3. 验证注意力等价。** 现代 Hopfield 检索 (一步) 计算 z_new = X · softmax(β · X^T · z)。与 transformer 注意力按项比较：query = z, keys = values = X。确认两个公式相同。这就是"注意力**就是** Hopfield 检索"的精确含义。

**4. 存储图样叠加。** 从两个存储图样的平均出发。在经典 Hopfield 中，网络通常落入伪混合态。在现代 Hopfield 中 (高 β)，会发生什么？挑一个还是停在混合？这与 Ramsauer 关于"现代 Hopfield 可以根据 β 表现为尖锐记忆或软注意力池"的观察相关。

**5. Transformer 不"只是" Hopfield。** 现代 Hopfield 是一个用存储图样作为 keys/values 的注意力头。完整 transformer 有*学习的* keys 和 values，*多个*头，注意力间还有前馈层。列出完整 transformer 能做、单个现代 Hopfield 头不能做的三种具体能力。(这是为了给热度找地基：等价是真的，但不意味着现代 Hopfield = transformer。)

