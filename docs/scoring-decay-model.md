# Scoring Model Notes: Negative-Action Decay (Assumed)

This note captures the current modeling assumptions for reputation scoring so we can
reproduce and explain the math later.

## Key Clarification
- "Decay" here is **only** the decay of **assumed negative actions** over time.
- It is **not** a time-based decay on all confirmations.

## Current Modeling Parameters
- Negative multiplier (weight in scoring math): **4x**
- Negative decay per 6-month period: **random 15% to 30%** (modeling only)
  - Example: if decay = 22%, then the next 6-month block applies 78% of negative
    confirmations; the removed 22% is shifted to positives.
- Neutral confirmations are **ignored for scoring**.

## Badge Level Thresholds (per badge)
- L1 = 100 positive confirmations
- L2 = 200
- L3 = 400
- L4 = 800
- L5 = 1600

Notes:
- Mandatory badge does **not** level; only level-tracked badges count toward thresholds.
- For seekers, level-tracked badges = tier caps (Tier1=2, Tier2=4, Tier3=8).

## Retainer Level Thresholds (modeled totals)
These thresholds are **total positive confirmations** (not per badge) and were
scaled to avoid L5 within 6 months, then increased by an additional 20%.

- Tier 1: 36,000 / 72,000 / 144,000 / 288,000 / 576,000
- Tier 2: 60,000 / 120,000 / 240,000 / 480,000 / 960,000
- Tier 3: 96,000 / 192,000 / 384,000 / 768,000 / 1,536,000

## Option A Score Blending (No Time-Decay)
- Displayed score blends recent and lifetime:
  - **Final = 0.65 * Recent(6m) + 0.35 * Lifetime(cumulative)**
- Lifetime is **raw cumulative** confirmations (with negative-action decay already applied per period).
- No half-life or time-based decay is applied in this model.

## Negative-Action Decay Mechanics (per 6 months)
Let:
- P0 = positives in 6m block
- N0 = negatives in 6m block
- r = decay rate (0.15 to 0.30)

Then for the next 6m block:
- N1 = N0 * (1 - r)
- P1 = P0 + N0 * r

For 18 months (two decay steps):
- N2 = N0 * (1 - r)^2
- P2 = P0 + N0 * (1 - (1 - r)^2)

## Scoring Formula (as modeled)
Let:
- effNeg = negatives * 4
- yesRate = positives / (positives + effNeg)
- noRate = effNeg / (positives + effNeg)
- base = 200 + 700 * yesRate
- penalty = base * 0.56 * noRate * levelMultiplier
- score = clamp(base - penalty, 200, 900)

Level multipliers (current):
- L1 0.85
- L2 0.95
- L3 1.00
- L4 1.10
- L5 1.25

## Modeling Note
Random decay rates were used per person in the model for variability. In production,
we should define whether decay is a fixed rate, tier-based, or policy-driven.
