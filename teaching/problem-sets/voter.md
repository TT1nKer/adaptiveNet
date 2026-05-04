# Adaptive Voter (Holme–Newman) — problem set

Demo: [`?model=holme-newman`](https://tt1nker.github.io/adaptiveNet/player.html?model=holme-newman) · Reference: Holme & Newman, *Phys. Rev. E* **74**, 056108 (2006)

## Five Δ-experiments

### 1. Locate the transition

Sweep φ from 0.1 to 0.9 in steps of 0.1. For each φ, run until the discordant-edge fraction stops changing (~5000 events for N=200 is usually enough). Plot final discordant fraction vs φ. Locate the transition point. Compare to the literature value φ_c ≈ 0.46 (Holme & Newman 2006). Why might your N=200 estimate differ from the paper's?

### 2. Finite-size scaling

Hold φ = 0.4. Vary N from 100 to 1000. Does the transition sharpen as N grows? Sketch what you expect the transition to look like in the N → ∞ limit, and explain in 100 words why a sharper transition is expected at larger N.

### 3. Topology dependence

Compare the transition under three initial topologies (ER, BA, WS) at φ = 0.4. Does φ_c shift? Is the transition sharper or softer when starting from a scale-free initial graph? Argue qualitatively why hub presence might affect the rewiring/copying balance.

### 4. Order parameter selection

What is the *order parameter* of this transition? Identify two reasonable candidates (one based on opinion magnetization, one based on edge structure). Argue which one cleanly distinguishes the consensus phase from the fragmentation phase, and which is ambiguous. (No "right" answer — the argument is the assignment.)

### 5. Time-to-equilibrium

At φ = 0.3 vs φ = 0.6, measure roughly how many simulation events are needed to reach the steady state (steady = order parameter changes < 1% per 100 events). Which converges faster, and why? Tie your answer to which process — copying or rewiring — is dominating in each regime.

---

## 五道 Δ 实验（中文版）

### 1. 定位相变点

在 0.1 到 0.9 之间以步长 0.1 扫描 φ。每个 φ 值下运行直至异质边比例稳定（N=200 时通常 5000 事件足够）。绘制最终异质边比例 vs φ。定位相变点。与文献值 φ_c ≈ 0.46（Holme & Newman 2006）比较。你 N=200 的估计为何偏离论文？

### 2. 有限尺寸标度

固定 φ = 0.4。让 N 从 100 变化到 1000。相变是否随 N 增大而变得更锐利？画出你期望 N → ∞ 极限下相变的形态，用 100 字解释为何更大的 N 应该给出更尖锐的相变。

### 3. 拓扑依赖性

在 φ = 0.4 下比较三种初始拓扑（ER、BA、WS）。φ_c 是否发生漂移？从无标度网络（BA）出发时相变是更尖锐还是更平缓？定性论证 hub 节点的存在为何会影响重连/复制平衡。

### 4. 序参量的选择

这个相变的*序参量*是什么？提出两个合理的候选（一个基于观点磁化强度，一个基于边结构）。论证哪一个能干净地区分共识相与碎片化相，哪一个含糊不清。（没有"标准答案"——论证本身就是作业。）

### 5. 收敛时间

在 φ = 0.3 vs φ = 0.6 下，分别估计序参量达到稳态（每 100 事件变化 < 1%）所需的事件数。哪一个收敛更快？为什么？把你的解释关联到各自区域中**复制**与**重连**两个进程的相对主导地位。
