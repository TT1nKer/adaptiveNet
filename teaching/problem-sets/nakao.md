# Network Turing Patterns (Nakao–Mikhailov) — problem set

Demo: [`?model=nakao-2010`](https://tt1nker.github.io/adaptiveNet/player.html?model=nakao-2010) · Reference: Nakao & Mikhailov, *Nature Physics* **6**, 544–550 (2010)

## Five Δ-experiments



**1. Find the Turing threshold.** Hold all reaction parameters fixed and the average degree fixed. Sweep D_v / D_u from 1 (no diffusion contrast) up to 50. For each ratio, observe whether spatial heterogeneity emerges and stabilizes. Locate the threshold ratio. The classical 1D Mimura-Murray analysis predicts a specific critical value — does the network version give the same threshold, or is it shifted?

**2. Topology dependence.** Run at D_v / D_u just above threshold under three topologies (ER, BA, WS) at the same average degree. Does the spatial pattern look qualitatively different? On the BA graph, do the high-degree hubs become "high-u" or "low-u" nodes? Argue why hub centrality matters for which side of the bistability they fall on.

**3. Hub role.** On a BA network, identify the top 10% highest-degree nodes. After patterns stabilize, what fraction of them are in the high-u state vs low-u? Compare to the same fraction for the bottom 10% (low-degree) nodes. The asymmetry quantifies how much the network's degree heterogeneity determines its pattern.

**4. From network to grid.** Compare a Nakao pattern on a graph (this demo) to a classical Brusselator/Turing pattern on a 2D grid (the *Classical Turing* demo) at matched parameters. The grid version produces stripes / spots; the graph version produces hub-organized clusters. Argue what topological feature is responsible for the difference.

**5. Order parameter.** What scalar quantity cleanly distinguishes the homogeneous (no-pattern) state from the patterned state? Try (a) variance of u across nodes, (b) gap between max-u and min-u, (c) bimodality coefficient of the u distribution. Which is the cleanest order parameter for this transition? Which is most numerically stable under finite N?


---

## 五道 Δ 实验（中文版）



**1. 寻找 Turing 阈值。** 固定所有反应参数和平均度。在 1 (无扩散对比) 到 50 之间扫描 D_v / D_u。每个比值下观察空间异质性是否涌现并稳定。定位阈值。经典 1D Mimura-Murray 分析预测一个特定临界值——网络版本给出相同阈值，还是有偏移？

**2. 拓扑依赖性。** 在阈值上方一点处，分别用三种拓扑 (ER、BA、WS) 跑同样的平均度。空间图样定性上是否不同？BA 图上，高度数 hub 节点变成"高 u"还是"低 u" 节点？论证 hub 中心性为何决定它落在双稳态的哪一侧。

**3. Hub 角色。** 在 BA 网络上，识别度数最高的前 10% 节点。图样稳定后，其中多大比例处于高 u 态 vs 低 u 态？与最低 10% 节点 (低度数) 同样比例做对比。这种不对称性量化了网络度异质性对图样的决定程度。

**4. 从网络到格子。** 比较图上 Nakao 图样 (本 demo) 和 2D 格子上的经典 Brusselator/Turing 图样 (*经典 Turing* demo)，参数匹配。格子版给出条纹/斑点；图版给出 hub 主导的聚类。论证哪种拓扑特征决定了这个差异。

**5. 序参量。** 哪个标量能干净地区分均匀态 (无图样) 与有图样态？试 (a) u 在节点间的方差，(b) max-u 与 min-u 之间的差距，(c) u 分布的双峰系数。哪个是最干净的序参量？哪个在有限 N 下最数值稳定？

