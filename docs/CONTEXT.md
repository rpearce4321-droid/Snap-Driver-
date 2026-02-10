# Snap Driver - Working Context

This file is the source of truth for product decisions made in this repo so implementation work stays consistent over time.


## Product Summary
Snap Driver connects:
- **Seekers**: independent contract drivers / small delivery businesses (1099).
- **Retainers**: companies looking to retain Seekers for delivery work.
- **Admin**: platform staff for approvals, moderation, and support.

The platform is **marketing + recruiting + social media** for the 1099 delivery space (not an employer/employee marketplace).

Reference business plan: `Buisness Plan Docs/Project Snap Driver Copy.docx`.

## Production Posture
- This is a **full production release**, not a demo. Every core feature must work on release.
- Local environment is the **staging** path for testing small changes before pushing to production.


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
  - Retainer **broadcasts** are always linked-only to active working links.
  - Retainer **posts** can be area-visible (public) when tier allows.
- If a profile is **deleted/rejected**, linking should auto-break.
  - A system/admin-generated message must be sent to the non-deleted/rejected party notifying them.
- Route system should use a **real Route object** (structured data), not only text posts.
  - In v1, Seekers can click **Interested** on a Route (not a full "apply" workflow yet).

## Badge System (Trust Tokens) - Decisions
- Badges are **global per profile** (Seeker/Retainer), not per-link.
- Badge progress is **points/instances-based** (YES adds value, NO reduces value with 3x impact).
- Badge verification is **linked-only** and requires an additional relationship toggle:
  - Link must be `ACTIVE`.
  - Both parties must enable **Working Together** on that link.
- Auto-approval after cadence close: **48 hours** to submit neutral or negative; if no action, it **defaults to YES**.
- Neutral check-in = **no points** and **no level change** (must be explicitly submitted).
- Negative check-in triggers a **7-day dispute window**; Admin resolves.
- Badge levels **can decrease**; negative outcomes are intended to feel like **one step forward, three steps back**.
- Badge selection caps are tiered:
  - Tier 1: **1 foreground + 1 background**
  - Tier 2: **2 foreground + 2 background**
  - Tier 3: **4 foreground + 4 background**
- Background badges require **at least 1 mandatory selection** and are locked for **12 months**.
- Mandatory **Snap badges**:
  - **Profile Integrity** (granted when full profile completion criteria are met; revoked if profile becomes incomplete).
  - **Operational Disclosure** (granted when non-sensitive operating details are provided).
  - Existing onboarding Snap badge remains mandatory.
- **Work Completion** is a mandatory **BACKGROUND** badge, fed by work-unit completion (see below).
- Mandatory badge selection should contribute to **base score** so score movement cannot be avoided.

## Reputation Score Model (Production)
- Score range is **200-900** (credit-score style).
- **Lifetime level** reflects full history; **displayed score** emphasizes the trailing 6 months.
- Base score is issued **on admin approval** once profile completion criteria are met.
- Base score weight should equal **6 months at 700** and should **decay** if profile becomes incomplete.
- If there is **no scoring activity for ~90 days**, displayed score begins to **decay**.
- 800+ scores require **12 months in good standing**:
  - No unresolved disputes in the last 90 days.
  - No active bad-exit penalties.
  - Minimum weekly check-ins in the last 6 months.
  - Admin-approved and not suspended.
- Scoring must incorporate **route completion** so points are tied to actual work.

## Route Completion + Scoring Eligibility
- Linking alone is not enough for badge approvals.
- Retainer must create a Route and **lock in** a Seeker with a **start date**.
- A locked route should create a **work history** entry for the Seeker.
- Points are awarded only for **completed work**, not just a locked schedule.
- Cadence end points create a **pending score** until the 48-hour check-in window closes.
- Work completion is measured in **work units** (UI label: **reputation points**, counts only; no route-ops detail):
  - **Dedicated** routes: work units are scheduled **days or shifts** per period.
  - **On-demand** routes: work units are **accepted jobs** per period.
  - Only **accepted** work can be marked missed; no penalty for unaccepted offers.
- Retainer submits completed/missed counts; Seeker can confirm or dispute within 48 hours.
  - Both parties are blind to each other's input during the window.
- Work Completion badge cadence defaults to the **retainer pay-cycle frequency** (weekly/biweekly/monthly).
- See `docs/work-units-spec.md` for the minimal data model and lifecycle.

## Base Score + Profile Completion
- Profile completion requires: all form fields filled, at least one of each checkbox group selected, profile photo + vehicle photo uploaded.
- Add a mobile option to capture photos directly from the camera.
- Base score should **decay** if required profile fields or media are removed.

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

## Implementation Reality (Current Code)
- **Frontend**: React + Vite, local-first. All core domain data stored in localStorage with `schemaVersion` envelopes (`src/lib/storage.ts`).
- **Portals**: session stored in localStorage; portal context stored per-tab in `sessionStorage` (`snapdriver_portal_context_v1`).
- **Core stores (local-first)**:
  - Seekers: `demo_seekers_v2`; Retainers: `demo_retainers_v2`.
  - Links: `snapdriver_links_v1`; Conversations: `snapdriver_conversations_v1`; Messages: `snapdriver_messages_v1`.
  - Routes: `snapdriver_routes_v1`; Interests: `snapdriver_route_interests_v1`.
  - Work units: `snapdriver_route_assignments_v1`; `snapdriver_work_unit_periods_v1`.
  - Posts: `snapdriver_retainer_posts_v1`; Broadcasts: `snapdriver_retainer_broadcasts_v1`.
  - Badges: `snapdriver_badges_v2`; Badge rules: `snapdriver_badge_rules_v1`; Score settings: `snapdriver_badge_scoring_v1`; Score history: `snapdriver_reputation_history_v1`.
  - Entitlements: `snapdriver_entitlements_v1`; Ratings: `snapdriver_retainer_ratings_v1`.
- **Linking**: state machine in `src/lib/linking.ts` (PENDING/ACTIVE/REJECTED/DISABLED). Link becomes ACTIVE only when both video confirmations + approvals are true.
- **Feed**: Seeker feed merges Posts + Broadcasts + Routes; linked-only items require ACTIVE link (`src/lib/feed.ts`).
- **Routes**: structured route object with schedule fields + commitment type (DEDICATED/FLEX). Public routes are tier-gated (`src/lib/routes.ts`).
- **Entitlements** (local-first defaults in `src/lib/entitlements.ts`):
  - Retainers: STARTER/GROWTH/ENTERPRISE (no free tier); gates public posts/broadcasts and active route counts.
  - Seekers: TRIAL (3 months, view-only) + STARTER/GROWTH/ELITE; trial can browse but cannot link/message or connect.
- **Badges** (local-first in `src/lib/badges.ts`):
  - Global per profile; max 4 active + 4 background; background badges lock for 12 months.
  - Check-ins require ACTIVE link + Working Together.
  - PRS: 200-900, 90-day window, k=0.56, level multipliers default [0.85, 0.95, 1.0, 1.1, 1.25].
  - **Current implementation recomputes levels from yes/no counts; levels can decrease** (see conflict below).
- **Route Notices**: bad-exit penalties for dedicated routes (15/25/35% for 30/60/90 days), with suspension/blacklist logic (`src/lib/routeNotices.ts`).
- **Server sync**: `/api/sync/pull` and `/api/sync/upsert` (Cloudflare Pages Functions + D1). Sync flags: `snapdriver_server_sync_enabled`, `snapdriver_seed_mode`. Seeded rows are marked with `__seed` for purge.
- **Admin bootstrap**: `/api/auth/bootstrap` is enabled only with `ADMIN_BOOTSTRAP_TOKEN` and UI gated by `VITE_ENABLE_ADMIN_BOOTSTRAP` for first admin creation.

## Alignment Tasks
- Update `docs/badges-spec.md` and `docs/decision-log.md` to reflect new production badge policies.
- Align `src/lib/badges.ts` to the 3x negative impact, auto-approval YES, and tiered badge caps.

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


