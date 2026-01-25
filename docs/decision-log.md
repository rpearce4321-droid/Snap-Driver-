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
- Auto-approval toggle per retainer in Badge Center.
- No response after grace resolves neutral and counts against Badge Checker.
- NO explanations required; YES explanations never required; explanations visible to both parties and admin.
- Disputes allowed within 7 days; neutral until admin resolves; admin decision logged.
- Badge levels are dynamic (can drop).
- Global Professional Reputation Score is weighted average of badge scores (no double penalty).
- Add 90-day snapshot score.
- Timer only on notice-related badge.
- Record Hall required for both parties and admin; full audit trail.
- Admin can edit weight, cadence, level rules, icon, description; applies next cycle.

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

## Open Questions
- Define retainer-side termination/penalty flow to balance seeker penalties.
- New-user protections and thresholds (if any).

