# Badge System Spec (Draft)

Status: Draft - update until finalized.

## Goals
- Provide a single Professional Reputation Score that reflects current behavior while remaining fair long term.
- Keep scoring explainable and consistent between seekers and retainers.
- Allow Snap Admin to fully manage badges without code changes.

## Roles and Verification
- Seeker badges are verified by retainers.
- Retainer badges are verified by seekers.
- Snap Admin can approve, reject, or override for both roles.

## Pay Cycle and Cadence
- Retainers select a pay cycle close date plus a frequency during profile creation.
- Frequency options: weekly, bi-weekly, monthly (rare).
- Timezone: EST.
- Badge check-ins are due on the pay cycle end date.
- Grace period: 48 hours after due date.
- Pay cycle is visible to linked seekers and editable by the retainer.
- Pay cycle is a soft filter on the Seeker wheel (like radius or zip).

## Check-in Lifecycle
- Auto-approval window: **48 hours** after cadence close.
- If no action, check-in **defaults to YES** (points awarded).
- Neutral check-in is **explicit** (no points, no level change).
- Negative check-in triggers a **7-day dispute** window; Admin resolves.
- NO requires an explanation. YES never requires an explanation.
- Explanations are visible to both parties and Snap Admin.

## Disputes and Overrides
- Either party can dispute within 7 days.
- Dispute requires an explanation.
- Disputed check-ins are neutral until resolved.
- Snap Admin resolves disputes with YES or NO and creates a log entry.

## Scoring Model
- Badge levels are dynamic (can drop); negative outcomes are **3x impact** vs positives.
- Badge scores drive the global Professional Reputation Score; avoid double penalties.
- Global Professional Reputation Score is the weighted average of badge scores.
- Professional Reputation Score display uses a 200-900 scale.
- Negative impact is a percent of the Professional Reputation Score, biased toward positive.
- Penalty strength reduced ~20% from baseline (k = 0.56).
- Badge weights and level multipliers are editable in Snap Admin.
- Base badge weights should match current point values as the default.
- Level multipliers (defaults): L1 0.85, L2 0.95, L3 1.00, L4 1.10, L5 1.25.
- Add a lifetime score history with chart filters (30/60/90/180 days).
- Seed data should include synthetic score history across the last 180 days (not all on one day).
- Seed data should reduce message traffic volume to a minimal baseline.
- Seed data must include pay cycle fields for retainers (close date + frequency).

### Formula
- Use a recent-window rate (default 90 days) for scoring; lifetime data is for history only.
- yesRate = recentYes / (recentYes + recentNo)
- noRate = recentNo / (recentYes + recentNo)
- baseScore = 200 + 700 * yesRate
- penalty = baseScore * k * noRate * levelMultiplier
- badgeScore = clamp(baseScore - penalty, 200, 900)
- Professional Reputation Score = weighted average of badgeScore values
- k (default): 0.56; level multipliers editable in Snap Admin

## Mandatory Badges
- **Snap badges** (mandatory):
  - **Profile Integrity** (granted when full profile completion criteria are met; revoked if profile becomes incomplete).
  - **Operational Disclosure** (granted when non-sensitive operating details are provided).
  - Existing onboarding Snap badge remains mandatory.
- **Work Completion** is a mandatory **BACKGROUND** badge, fed by work-unit completion.
- **Background badge selection is tiered and locked**:
  - Tier 1: 1 foreground + 1 background
  - Tier 2: 2 foreground + 2 background
  - Tier 3: 4 foreground + 4 background
  - Background badges are locked for 12 months and must include mandatory selections.
  - Implementation note: caps are derived from entitlements (Retainer STARTER/GROWTH/ENTERPRISE -> Tier 1/2/3; Seeker TRIAL/STARTER/GROWTH/ELITE -> Tier 1/1/2/3).

## Mandatory Badge Definitions (Draft)
### Profile Integrity (Snap)
- **Kind**: SNAP (ONCE)
- **Grant**: When all required profile fields are complete and required media are present.
- **Revoke**: If required fields or media are removed.
- **Purpose**: Establish baseline trust; ties to base score.

### Operational Disclosure (Snap)
- **Kind**: SNAP (ONCE)
- **Grant**: When non-sensitive operating details are provided (business type/model, coverage area, equipment/fleet summary, terms acknowledgement).
- **Revoke**: If required disclosures are removed.
- **Purpose**: Establish operational clarity without sensitive identity data.

### Work Completion (Background)
- **Kind**: BACKGROUND (RECURRING)
- **Cadence**: Retainer pay-cycle frequency (weekly/biweekly/monthly).
- **Weight**: Default 4 (admin-adjustable).
- **Seeker meaning**: Completed assigned work units for the period.
- **Retainer meaning**: Delivered the promised work units for the period.

## Work-Unit Completion (Scoring Anchor)
- Score is tied to **work units**, not route-ops data.
- Dedicated routes: work units are scheduled **days or shifts** per period.
- On-demand routes: work units are **accepted jobs** per period.
- Only accepted work can be marked missed; no penalty for unaccepted offers.
- Retainer submits completed/missed counts; Seeker can confirm/dispute within 48 hours.
- Both parties are blind to each other's input during the window.

## UI Requirements
- Only the notice-related badge shows a timer (top-right of the badge).
- Badge Checker is the approval badge.
- Auto-approval is on by default after the 48-hour window (no toggle).
- Add a Record Hall to each party's action page and to Snap Admin.
- Add a Score History tab in Badge Center with filters (30/60/90/180 days).
- Add a Repair Planner (projection) panel inside the Score History tab.

## Admin Controls
- Admin can edit badge weight, cadence, level rules, icon, and description.
- Changes apply starting next pay cycle (not mid-cycle).
- Notifications to both parties when rules change:
  "Admin has changed conditions for [badge]. This will not change your score this period. The change takes effect at the beginning of the next cycle. Please review [badge] for clarity on the change."

## Record Hall (Audit Trail)
- Includes check-ins, explanations, disputes, overrides, and outcomes.
- Organized per user. UI placement and layout to be designed.

## Open Decisions
- New-user protections (if any) and confirmation thresholds.
- Define base score weighting to equal **6 months at 700** and decay rules.


## Abuse Countermeasures
- Collusion (fake YESes): require periodic admin audits and flag suspicious patterns.
- Retaliatory NOs: dispute flow + admin override with audit logs.
- No-response abuse: auto-approval defaults YES after the 48-hour window; neutral requires explicit action.
- Sockpuppet accounts: admin review + linkage rules later.
- Timing manipulation: pay-cycle-locked cadence and timestamps.
- Badge selection gaming: admin can require minimum badge groups.
- Dispute spam: 7-day window + admin arbitration + pattern alerts.

## Onboarding and Minimum Samples
- Minimal sample threshold can be supported via onboarding badges that grant initial weighted data (ex: "I know my lane").

## Notifications
- Snap Admin can push notifications; show in all users' feed.
- Badge rule change notifications use the approved copy (see Admin Controls).

## Reputation Tiers (Draft)
- 200-399: Bad
- 400-549: Fair
- 550-699: Good
- 700-799: Great
- 800-900: Excellent

(Labels are placeholders and should be editable in Snap Admin.)

## Route Notice and Bad Exit (Dedicated Routes Only)
- Applies only to dedicated, recurring routes.
- Notice is based on the route, not the retainer.
- Countdown visible on all linked and pending profiles.
- Profile notification when a seeker plans to switch to another retainer (visible to linked/pending).
- Bad Exit flag visible for 90 days with days remaining shown.
- Penalty tiers (stacking): 30 days = 15%, 60 days = 25%, 90 days = 35%.
- After third increment: 45-day suspension, then blacklist.
- Blacklist appeal allowed after 90 days; tier can reset after appeal.
- Penalty affects overall Professional Reputation Score.
- Dispute option available.
- If confirmation is NO, apply an additional moderate penalty.
