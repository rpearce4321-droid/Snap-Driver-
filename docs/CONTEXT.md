# Snap Driver - Working Context

This file is the source of truth for product decisions made in this repo so implementation work stays consistent over time.


## Product Summary
Snap Driver connects:
- **Seekers**: independent contract drivers / small delivery businesses (1099).
- **Retainers**: companies looking to retain Seekers for delivery work.
- **Admin**: platform staff for approvals, moderation, and support.

The platform is **marketing + recruiting + social media** for the 1099 delivery space (not an employer/employee marketplace).

Reference business plan: `Buisness Plan Docs/Project Snap Driver Copy.docx`.


## Core Terms
- **Portal**: which UI the user is operating in (`ADMIN`, `SEEKER`, `RETAINER`). This is separate from stored auth/session.
- **Conversation**: Seeker <-> Retainer subject thread (external messaging).
- **Staff thread**: internal Retainer owner <-> staff user thread.
- **Subcontractor thread**: master Seeker <-> subcontractor thread.
- **Linking**: a post-video relationship between a Seeker and a Retainer enabling social/feed content + broadcasts.


## Decisions (Non-Negotiables)
- **Local-first** for now: data is stored locally; APIs/Prisma are not the primary runtime path yet.
- **Do not break existing portals**: new features must be additive (new keys/optional fields) and guarded.
- **Linking approval** requires **both parties**:
  - Seeker and Retainer each have a manual toggle confirming the video conference occurred.
  - Seeker and Retainer each approve the link.
  - Link becomes active only when both toggles + both approvals are complete.
- Linked content is **linked-only** by default.
  - Higher paid Retainer tiers can publish to **public** Seekers.
- If a profile is **deleted/rejected**, linking should auto-break.
  - A system/admin-generated message must be sent to the non-deleted/rejected party notifying them.
- Route system should use a **real Route object** (structured data), not only text posts.
  - In v1, Seekers can click **Interested** on a Route (not a full "apply" workflow yet).

## Badge System (Trust Tokens) - Decisions
- Badges are **global per profile** (Seeker/Retainer), not per-link.
- Badge progress is **points/instances-based** (YES adds value, NO reduces value).
- Badge verification is **linked-only** and requires an additional relationship toggle:
  - Link must be `ACTIVE`.
  - Both parties must enable **Working Together** on that link.
- Not submitting a weekly check-in is **neutral** (reminders will be added later).
- Each profile can select up to **4 active badges** at a time.
- Badge levels should **never decrease** once achieved (clamp points so max level never drops).

## Guiding Principles (Safety & Non-Destructive Delivery)
- **Context discipline**: `docs/CONTEXT.md` is the source of truth; update it when decisions change to prevent drift.
- **Regular checkpoints**: create date-stamped git tags before major changes so we can roll back the whole project.
- **Versioned storage schema**: every persisted store has a `schemaVersion` and a migration path; no silent shape changes.
- **Per-tab portal context**: portal routing state must not leak across browser tabs (use `sessionStorage` for portal context).
- **Hard permission enforcement**: enforce permissions in the action/data layer, not only by hiding UI buttons.
- **Separate channels**: keep external messages distinct from staff threads, subcontractor threads, and broadcasts (different stores/filters).
- **Performance at scale**: default to paging/lazy-loading and stable indexes/maps; avoid O(n) recompute on every render.
- **Seed/reset is deterministic**: reseeds overwrite/clear prior demo data and reset session/portal context to prevent mixed datasets.
- **Pre-mortems**: for each major feature, capture likely failure modes + mitigations in the roadmap before building.

## Rating / Tiers Fairness (Draft Policy Options)
- Core guardrails: keep underlying scores intact; avoid pay-to-win; prevent ?upgrade, earn, downgrade, keep the boost.?
- Hard display cap for free (e.g., 70%): simple and clear; risk of feeling punitive/sticky once reached; only as display cap (true score preserved for instant reveal on upgrade).
- Tier-bound window (score reflects check-ins earned on current tier): strong anti-gaming; ethically defensible; needs tier history tagging; can feel like a reset on downgrade?requires clear UX.
- Downgrade cooldown (e.g., 30 days freeze/cap after downgrade): blocks instant churn exploits; needs clear copy to avoid ?penalty? feel; adds state.
- Level visibility gating on free (hide L4/L5 or cap visible stage): softer than a percent cap; can feel like suppressed status unless messaged well.
- Shorter window on free (e.g., 3?4 months) vs. longer on paid (e.g., 12 months): frames difference as data quality/stability, not paywall; mistakes hit harder on free; requires min sample thresholds + confidence labels to avoid unfair volatility.
- Confidence + sample guardrails: minimum confirmations (e.g., 12) before showing full score; show ?low/high confidence? labels; prevents single-check-in swings on short windows.
- Recommended hybrid to avoid pay-to-play vibes while discouraging gaming:
  - Display is tier-bound (only check-ins from current tier count toward visible score).
  - Free uses shorter window + confidence/samples; paid uses longer/stable window.
  - Optional: display cap for free (70%) only if needed, with clear ?upgrade to reveal full score? copy; true score preserved.
  - Optional: downgrade cooldown (30 days) to block immediate harvest/drop behavior.
  - Messaging is key: frame differences as ?data stability and confidence? rather than withholding earned performance.



## Near-Term Features
- Seeker **Work History / Experience** (structured, editable, shown read-only on profile views).
- **Schedule Matching** (Seeker availability ↔ Route schedule) surfaced on cards and used for sorting/filtering.
- Linking v1 + linked-only social feed + Retainer posts/updates.
- Route postings + Interested signals + Admin visibility.
- Entitlements/tiers layer (hybrid monetization): seats + reach + throughput.


