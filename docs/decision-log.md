# Decision Log (Working)

This file tracks decisions and open items until the badge system is finalized.

## Badge System Decisions
- Seed data should reduce message traffic volume.
- Seed data must include retainer pay cycle fields (close date + frequency).
- Rename Trust Score to Professional Reputation Score (200-900 scale).
- Repair Planner lives inside Score History tab.
- Seed score history covers last 180 days.
- Reputation tier labels set to standard placeholders (Bad/Fair/Good/Great/Excellent), editable later.

- Professional Reputation Score display uses a 200-900 scale; penalty strength reduced ~20% (k=0.56).
- Level multipliers defaults accepted; editable in Snap Admin.
- Score history is lifetime with chart filters (30/60/90/6 months).
- Seed data should include synthetic score history across multiple dates.
- Add repair planner/projection tool in Badge Center.
- Add admin-push notifications to user feeds.
- Onboarding badges can provide initial weighted data to address low sample sizes.
- Use current badge list as the source of truth; admin can edit badges in-app.
- Verification: seekers verified by retainers, retainers verified by seekers; admin can override both.
- Cadence tied to retainer pay cycle; timezone EST; 48-hour grace.
- Auto-approval after 48 hours defaults to **YES** (points awarded).
- Neutral is **explicit** (no points, no level change).
- NO explanations required; YES explanations never required; explanations visible to both parties and admin.
- Disputes allowed within 7 days; neutral until admin resolves; admin decision logged.
- Badge levels are dynamic (can drop) with **3x negative impact** vs positive.
- Global Professional Reputation Score is weighted average of badge scores (no double penalty).
- Add 90-day snapshot score.
- Timer only on notice-related badge.
- Record Hall required for both parties and admin; full audit trail.
- Admin can edit weight, cadence, level rules, icon, description; applies next cycle.
- Badge selection caps are tiered: 1/1, 2/2, 4/4; background selection is locked for 12 months and includes mandatory badges.
## Mandatory Badges (Production)
- Snap badges (mandatory):
  - Profile Integrity (granted on full profile completion; revoked if incomplete).
  - Operational Disclosure (non-sensitive operating details).
  - Existing onboarding Snap badge remains mandatory.
- Work Completion is mandatory **BACKGROUND** badge (fed by work-unit completion).
  - Cadence defaults to retainer pay-cycle frequency; default weight 4 (admin-adjustable).

## Work-Unit Scoring Anchor
- Work units are **counts only** (no route-ops data).
- Dedicated routes: work units are scheduled **days or shifts** per period.
- On-demand routes: work units are **accepted jobs** per period.
- Only accepted work can be missed; no penalty for unaccepted offers.
- Retainer submits completed/missed counts; Seeker can confirm/dispute within 48 hours.
- Parties are blind to each other's input during the window.

## Reputation Gate
- 800+ scores require **12 months in good standing**:
  - No unresolved disputes in last 90 days.
  - No active bad-exit penalties.
  - Minimum weekly check-ins in last 6 months.
  - Admin-approved and not suspended.

## Pay Cycle Decisions
- Retainers select pay cycle close date and frequency at signup.
- Pay cycle visible to linked seekers and editable in profile.
- Pay cycle is a soft filter on the Seeker wheel.

## Trust Scoring Notes
- Single number Professional Reputation Score (200-900).
- Negative value is a percent of PRS and biased toward positive (k=0.56).
- Avoid double penalties (badge score and global score).

## Other Decisions (Recent)
- Backdoor links on LandingPage require temporary login; per-tab only (no persistence).
- Cloudflare Pages is the deployment path; wrangler deploy removed.
- Mobile layout issues acknowledged; mobile-first work to follow after badge rules.
- Entitlements update: retainers have no free tier (STARTER/GROWTH/ENTERPRISE only).
- Seekers have a 90-day TRIAL (view-only); linking/messaging/connecting requires paid tiers (STARTER/GROWTH/ELITE).

## Open Questions
- Define retainer-side termination/penalty flow to balance seeker penalties.
- New-user protections and thresholds (if any).

