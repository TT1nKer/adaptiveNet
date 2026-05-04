# Paper-fidelity audit (started 2026-05-04)

The session of 2026-05-04 surfaced a serious failure: the `pacheco-2006` model was
implemented from training prior, **without ever fetching the actual paper**.
Three rounds of bug fixes still failed to match Pacheco's mechanism (separate
formation rate α and breaking rate γ; strategy update on random pairs not
neighbours; K_N initial; etc.). On the fourth attempt the paper was finally
fetched (PMC2430061) and the file rewritten from the paper's actual equations.

The user correctly observed that this **destroys trust in any "faithful
reproduction" claim** elsewhere in the codebase. This document is the
remediation plan: every demo that claims a literature reference must be
verified against the actual paper, with the verification status recorded
alongside the source.

## Verification levels

- ⛔ **NOT VERIFIED**: implementation written from training prior, no paper
  fetched. Status of all 12 demos before this audit.
- 🔍 **PAPER FETCHED**: paper has been fetched and the algorithm extracted.
  Implementation may need rewriting to match.
- ✅ **PAPER-VERIFIED**: implementation explicitly references specific
  equations / algorithm steps from the paper, with line-citation comments
  in source. Has at least one quantitative test case from the paper that
  passes.
- ⚠ **KNOWN-DEVIATION**: implementation deliberately departs from paper for
  scope / pedagogy reasons. Deviation explicitly documented in source
  with explanation of which paper claims the deviation does and doesn't
  preserve.

## Status as of 2026-05-04

| # | Model file | Reference | Status | Notes |
|---|---|---|---|---|
| 1 | `pacheco-2006.ts` | Pacheco-Traulsen-Nowak PRL 97 258103 (2006) | ✅ verified 2026-05-04 (PMC2430061 fetched) | Rewritten from scratch against paper. Defaults are paper Fig 2b. Acceptance test: c=0.5, b=1, α=0.4, γ_CC=0.1, γ_CD=0.8, γ_DD=0.32, β=0.1, W=4, K_100, 50% C → cooperators fixate. **NEEDS RUNTIME CONFIRMATION OF ACCEPTANCE TEST**. |
| 2 | `voter.ts` | Holme-Newman PRE 74 056108 (2006) | ⛔ NOT VERIFIED | Dynamics description plausible but not paper-checked. φ_c ≈ 0.46 quoted in description — needs verification of exact value vs paper. |
| 3 | `adaptive-sis.ts` | Gross-D'Lima-Blasius PRL 96 208701 (2006) | ⛔ NOT VERIFIED | Implementation has same structural pattern as v1 Pacheco (only break events, random rewire). Likely needs same kind of rewrite. |
| 4 | `nakao.ts` | Nakao-Mikhailov *Nature Physics* 6 (2010) | ⛔ NOT VERIFIED | Mimura-Murray reaction terms hardcoded — exact form not verified against paper. |
| 5 | `avalanches.ts` | BTW PRL 59 (1987) + Beggs-Plenz (2003) | ⛔ NOT VERIFIED | BTW dynamics easy; the methodology knobs (binning, subsampling) paraphrase Touboul-Destexhe critique without paper-checking specific bin widths used. |
| 6 | `gray-scott.ts` | Pearson *Science* 261 (1993) | ⛔ NOT VERIFIED | Equations look textbook but (f, k) preset values may not match Munafo's classification exactly. |
| 7 | `brusselator.ts` | Turing 1952 + Prigogine-Lefever 1968 | ⛔ NOT VERIFIED | Reaction terms standard but Turing-instability threshold formula not derived in source. |
| 8 | `ising.ts` | Onsager 1944 | ⛔ NOT VERIFIED | T_c = 2/ln(1+√2) ≈ 2.269 is universal textbook material. Glauber dynamics likely correct. Should still spot-check. |
| 9 | `hopfield.ts` | Hopfield PNAS 79 (1982) | ⛔ NOT VERIFIED | Hebbian rule + sign update is textbook. Should still spot-check. |
| 10 | `hopfield-capacity.ts` | AGS PRA 32 (1985) | ⛔ NOT VERIFIED | α_c ≈ 0.138 is textbook. Should spot-check the demo actually shows transition near that value. |
| 11 | `hopfield-modern.ts` | Ramsauer arXiv:2008.02217 | ⛔ NOT VERIFIED | Log-sum-exp energy + softmax retrieval has well-known form; check exact β placement. |
| 12 | `lif.ts` | Lapicque (1907) | ⛔ NOT VERIFIED | Simplest possible neuron model; likely correct. Spot-check refractory + threshold. |

## Verification protocol (going forward — applies to all new and existing models)

For any model claiming a literature reference, the source file's header MUST contain:

1. **Paper fetch citation** — DOI, PMC ID, or arXiv ID, with a comment line stating
   which version was consulted (e.g. `// Verified against PMC2430061 (open-access
   version of PRL 97, 258103) on 2026-05-04`).
2. **Algorithm transcription** — paper's specific equations / algorithm boxes
   transcribed into source comments, with each line of code referencing the
   equation it implements (e.g. `// Eq. 2 in paper: ...`).
3. **Quantitative acceptance test** — one or more parameter regimes from the
   paper with their stated outcome, encoded as a test or as documentation
   sufficient to run by hand (preset name, expected qualitative behaviour, or
   numerical value).
4. **Deviations marked explicitly** — any departure from the paper labelled
   `KNOWN-DEVIATION:` with rationale and impact assessment.

Models that don't meet (1)–(4) are tagged ⛔ NOT VERIFIED in this document
and in the source file's header. They may still ship, but their description
must not claim "faithful reproduction" — the wording is "implementation in
the model class of X" or similar.

## Priority for backlog

Highest priority — same risk profile as Pacheco was (model-class implementation
from prior, with substrate that allows specific failure modes):

1. **adaptive-sis.ts** (Gross-D'Lima-Blasius 2006). Only one rate per edge type
   in current impl; paper likely has separate formation + breaking rates and
   specific quantitative claims about hysteresis loops.
2. **voter.ts** (Holme-Newman 2006). φ_c quoted as 0.46; verify against paper
   and check whether copy-or-rewire mechanism matches their definition.
3. **nakao.ts** (Nakao-Mikhailov 2010). Mimura-Murray equation form needs
   exact-match verification.

Medium priority:

4. **avalanches.ts** — verify the BTW exponent (τ ≈ 1.0 in 2D, not −3/2)
   matches what we say in description; verify Touboul-Destexhe binning
   knob is doing what they specifically critiqued.
5. **gray-scott.ts** — verify Pearson preset (f, k) coordinates against
   Munafo's published map.
6. **brusselator.ts** — derive Turing-instability threshold for default a, b
   and confirm preset behaviour matches.

Lowest priority (likely already correct, but should still spot-check):

7. **ising.ts** — measure |⟨m⟩| vs T near T_c = 2.269 and confirm transition.
8. **hopfield-capacity.ts** — sweep α near 0.138 and confirm transition.
9. **hopfield.ts**, **hopfield-modern.ts**, **lif.ts** — visual sanity-check.

## What this means for the project's external claims

Until this audit completes:

- README and POSITIONING.md should not claim "11 paper-faithful
  reproductions" or similar. Current accurate phrasing: "11 demos in the
  spirit of published models, with one paper-verified (Pacheco) and the
  others pending audit (see AUDIT.md)."
- The DOI / Zenodo metadata (Citation block) should mention this audit
  status so anyone citing the project understands the verification level.
- `teaching/problem-sets/*.md` may rely on specific quantitative results
  from the papers. Until each model is paper-verified, the problem-set
  prompts should be flagged as "instructor should verify against paper
  before assigning".

## Workflow when verifying a model

1. WebFetch the paper (DOI → PMC / arXiv).
2. Extract algorithm + key equations + quantitative test cases.
3. Diff against current implementation. Identify each discrepancy.
4. Either rewrite the implementation, or document the discrepancy as
   KNOWN-DEVIATION with rationale.
5. Update this AUDIT.md row's status.
6. Add a `// Paper fetch citation` block at the top of the source file.
7. Commit with message starting `audit: <model> verified against <paper>`.

## Workflow when adding a new model

The `.claude/skills/adaptivenet-author/` skill is being updated to incorporate
the verification protocol as a hard checklist gate. New models will not pass
the skill's quality gate without (1)–(4) above.
