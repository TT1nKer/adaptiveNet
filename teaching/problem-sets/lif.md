# Spiking Neurons (LIF Network) — problem set

Demo: [`?model=lif`](https://tt1nker.github.io/adaptiveNet/player.html?model=lif) · Reference: Lapicque, *J. Physiol. Pathol. Gén.* **9**, 620 (1907)

## Five Δ-experiments



**1. Find the wave-speed scaling.** With a localized drive at the centre and moderate coupling, radial wave fronts propagate outward. Measure the wave speed in cells per simulation step at three coupling strengths. Does speed scale linearly with coupling, sublinearly, or saturate?

**2. Coupling threshold for sustained activity.** Sweep the coupling strength from low (sub-threshold; activity dies) to high (super-threshold; runaway). Locate the critical coupling at which a localized perturbation just barely sustains itself. Below: activity decays. Above: activity propagates indefinitely. This is the *excitable medium* condition, foundational to cardiac modelling and reaction-diffusion theory.

**3. Refractory period role.** Reduce the refractory period from default to near zero. Do the wave fronts still propagate cleanly, or do they break into chaos? Argue why the refractory period is responsible for the *unidirectionality* of waves (cells just behind the front can't fire because they're refractory).

**4. Synchrony and bursting.** At very high coupling, synchronized bursts can emerge — large fractions of the network fire together, then the whole network becomes refractory, then fires again. This is the *epilepsy* regime mentioned in the description. Find the coupling at which synchronized bursting first appears. Compare to literature on epileptiform dynamics (Wendling et al., Buzsáki).

**5. From grid to graph (concept).** This LIF demo runs on a 2D grid. Argue what would change qualitatively if it ran on a Barabási-Albert network instead. Specifically: would wave fronts still exist? Would synchronized bursting be easier or harder? (This is conceptual — adaptiveNet does not yet ship a graph-based LIF demo, but the question is the bridge between this lattice demo and the broader question of "what does spiking dynamics look like on real brain-like topologies".)


---

## 五道 Δ 实验（中文版）



**1. 寻找波速标度。** 中心局部驱动加适中耦合时，径向波前向外传播。在三个耦合强度下测量波速 (cell/仿真步)。速度是线性、亚线性，还是饱和于耦合？

**2. 持续活动的耦合阈值。** 在低 (亚阈，活动消亡) 到高 (超阈，失控) 之间扫描耦合强度。定位局部扰动刚刚能维持自身的临界耦合。下方：活动衰减。上方：活动无限传播。这就是*可激发介质*条件，是心脏建模和反应-扩散理论的基础。

**3. 不应期的角色。** 把不应期从默认减到接近零。波前还能干净传播吗，还是分裂成混沌？论证为何不应期是波的*单向性*的负责人 (波前正后方的 cell 因为正在不应期而不能发放)。

**4. 同步与爆发。** 在很高耦合时，可能涌现出同步爆发——网络一大部分一起发放，然后整个网络进入不应期，然后再次发放。这是描述里提到的*癫痫*区。找出同步爆发首次出现的耦合。与癫痫样动力学文献 (Wendling 等、Buzsáki) 比较。

**5. 从格子到图 (概念)。** 这个 LIF demo 跑在 2D 格子上。论证如果改跑在 Barabási-Albert 网络上，会有哪些定性变化。具体说：波前还会存在吗？同步爆发会更容易还是更难？(这是概念性的——adaptiveNet 暂未提供基于图的 LIF demo，但这个问题是连接本格子 demo 与"脉冲动力学在真实脑样拓扑上是什么样"这一更广问题的桥梁。)

