# Teaching materials

This directory holds **structured problem sets** for the demos in adaptiveNet — heavier than the "Things to try" hints that ship inside each demo's description, light enough to lift directly into a course assignment or blog post.

The problem-set files in `problem-sets/` are bilingual (English + Chinese). Each is structured around 5 Δ-style experiments per demo:

> *vary X from a to b, observe Y, compare to literature value Z, explain the deviation in 200 words*

Students submit a permalink to the demo configuration plus written reasoning.

## Why these live separately from the demo descriptions

The demo `long` description on the player page intentionally stays at the NetLogo-style "Things to try" weight — short, inviting, open-ended hints suitable for any visitor (researcher, hobbyist, student, science writer). Embedding heavy problem-set material in the demo description would:

- Make the panel a wall of text that scrolls past most visitors
- Pre-commit the platform to one specific assignment when an instructor may want a different one
- Duplicate work the instructor will (or has) published on their own teaching site

The right architecture for academic-commons software (per the NetLogo + Wilensky-Rand 2015 textbook precedent): **the tool stays light, teaching material is published externally and references demo URLs**. This directory is the seed of that external material — instructor-authored or community-contributed.

## How to use

For instructors:

- Lift any problem set verbatim into your syllabus or assignment platform
- Edit it freely; this is a starting point, not a fixed curriculum
- The reference papers cited in each problem set are the canonical published anchors

For students:

- Follow the prompts; submit the permalink (URL) of your demo configuration plus your written analysis

For contributors:

- Edit the MD files directly via PR if you have a better experiment idea
- Add new problem sets when adding new demos, in the same bilingual format

## File map

| Demo URL | Problem set |
|---|---|
| `?model=hopfield` | [hopfield.md](problem-sets/hopfield.md) |
| `?model=hopfield-capacity` | [hopfield-capacity.md](problem-sets/hopfield-capacity.md) |
| `?model=hopfield-modern` | [hopfield-modern.md](problem-sets/hopfield-modern.md) |
| `?model=lif` | [lif.md](problem-sets/lif.md) |
| `?model=avalanches` | [avalanches.md](problem-sets/avalanches.md) |
| `?model=ising` | [ising.md](problem-sets/ising.md) |
| `?model=nakao-2010` | [nakao.md](problem-sets/nakao.md) |
| `?model=brusselator-grid` | [brusselator.md](problem-sets/brusselator.md) |
| `?model=gray-scott` | [gray-scott.md](problem-sets/gray-scott.md) |
| `?model=holme-newman` | [voter.md](problem-sets/voter.md) |
| `?model=adaptive-sis` | [adaptive-sis.md](problem-sets/adaptive-sis.md) |
