# Snap Driver - Session Summary (2026-01-01)

This file captures what was completed today and the agreed approach for predicting/avoiding runtime failures using a lightweight logic model.

## What We Completed Today

### Badges System (MVP)
- Added a local-first badge engine (`src/lib/badges.ts`):
  - Badges are **global per profile** (Seeker/Retainer), not per-link.
  - Each profile can select up to **4 active badges** (`MAX_ACTIVE_BADGES`).
  - Weekly check-ins are **YES/NO** and point-based.
  - Badge progress is clamped so **levels never decrease** once achieved.
- Added link-level “Working Together” gating (`src/lib/linking.ts`):
  - `workingTogetherBySeeker` + `workingTogetherByRetainer`
  - `isWorkingTogether(link)` only returns true if `status === "ACTIVE"` and both flags are true.
  - Badge check-ins require `ACTIVE` + `workingTogether` enabled by both sides.

### Portal UI Wiring
- Added a **Badges** tab in both portals:
  - Seeker: `src/pages/SeekerPage.tsx`
  - Retainer: `src/pages/RetainerPage.tsx` (Retainer level 1 is view-only via `readOnly`)
- Implemented the badges UI: `src/components/BadgesCenter.tsx`
  - Badge selection (up to 4) + progress bars
  - Weekly check-ins for linked counterparts when “Working Together” is active
  - `readOnly` mode disables all mutation actions
- Added shared badge icons helper: `src/components/badgeIcons.tsx`

### Profile Display
- Added earned badge tokens to the profile headers:
  - `src/pages/SeekerDetailPage.tsx`
  - `src/pages/RetainerDetailPage.tsx`

### Comprehensive Seed Improvements
- `src/lib/seed.ts` (`autoSeedComprehensive`):
  - Seeds Seekers with **weekly availability blocks** (schedule matching ready immediately).
  - Seeds badge selections for most approved profiles; `(MS)` profiles get 3–4 active badges.
  - Seeds multi-week badge check-ins and “Working Together” toggles for a subset of MS links, producing varied badge levels/progress.
- `src/pages/SeekerPage.tsx`:
  - Removed the old free-text `availability` field from the profile form to avoid conflicting with the structured schedule object.

### Usage
- Run the comprehensive seed from Admin: click **Reset + Seed Comprehensive** (in `src/pages/AdminDashboardPage.tsx`).
- After reseed, check:
  - Seeker `Schedule` tab (availability blocks exist)
  - Seeker/Retainer `Badges` tab (active badges + check-ins visible)
  - Profile views show earned badge tokens when progress exists

## “Backend Testing” Strategy (Logic Model)

We’re local-first today, so “backend” refers to the domain/action layer in `src/lib/*` (linking, badges, messages, routes, etc.).

### The Model
Treat each subsystem as a **state machine** with strict invariants:

**Linking invariants**
- Link is `ACTIVE` only when both parties have video confirmed + approved.
- “Working Together” can only be effective when link is `ACTIVE` and both toggles are enabled.

**Badges invariants**
- Check-ins must be rejected unless link is `ACTIVE` and `isWorkingTogether(link)` is true.
- Verifier role must match the badge’s `verifierRole`.
- Levels must never decrease once achieved (even if NO check-ins occur).
- Active badge selection must never exceed 4.

**Messaging invariants**
- Messages must have valid conversation/thread context.
- External vs staff vs subcontractor messages remain separated (different stores).

### How To Use The Model To Predict Failures
Generate “weird” sequences and assert invariants after each step (model-based / property-based testing):
- Call actions in unusual orders (ex: badge check-in before link activation).
- Toggle permissions/roles and ensure enforcement holds.
- Wipe + reseed then navigate to ensure no stale-ID assumptions remain.

### Common Failure Modes This Catches
- Order-of-operations issues (submit check-in before link is ACTIVE).
- Role mismatch (wrong party verifies).
- Schema/shape drift (seed writes a shape the UI doesn’t expect).
- Cached localStorage pointers (acting-as IDs referencing deleted/reseeded entities).

