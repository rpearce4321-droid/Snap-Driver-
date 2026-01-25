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
- Auto-approval toggle per retainer in Badge Center (after profile completion).
- If auto-approval is OFF and no response after 48 hours: check-in resolves as neutral.
- Neutral counts against the Badge Checker (approval badge).
- NO requires an explanation. YES never requires an explanation.
- Explanations are visible to both parties and Snap Admin.

## Disputes and Overrides
- Either party can dispute within 7 days.
- Dispute requires an explanation.
- Disputed check-ins are neutral until resolved.
- Snap Admin resolves disputes with YES or NO and creates a log entry.

## Scoring Model
- Badge levels are dynamic (can drop).
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

## UI Requirements
- Only the notice-related badge shows a timer (top-right of the badge).
- Badge Checker is the approval badge.
- Badge Center includes the auto-approval toggle per retainer.
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


## Abuse Countermeasures
- Collusion (fake YESes): require periodic admin audits and flag suspicious patterns.
- Retaliatory NOs: dispute flow + admin override with audit logs.
- No-response abuse: neutral default; auto-approval toggle per retainer.
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
