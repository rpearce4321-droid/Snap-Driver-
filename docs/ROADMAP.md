# Snap Driver - Roadmap (Local-First, Non-Destructive)

This roadmap is designed to add the marketing/recruiting/social-media layers without destabilizing the existing portals.


## Guiding Rules (Safety)
- Additive changes only: new entities/fields must be optional and default-safe.
- Prefer new storage keys over reusing old ones unless there is a migration plan.
- Implement features behind simple feature flags where possible.
- Stabilize before scale: fix runtime crashes and navigation issues before adding large features.


## Phase 0 - Stabilization (Now)
- Keep portal navigation deterministic across tabs (per-tab portal context).
- Ensure messaging centers never crash on missing state.
- Fix any remaining permission edge cases and "back to dashboard" routing.


## Phase 1 - Profile Completeness
- Seeker: add **Work History / Experience** section (structured entries).
- Retainer: keep multi-user + permissions stable; improve staff profile completeness (photo/bio already started).
- Ensure profile cards display profile pictures consistently where required.


## Phase 2 - Linking (Post-Video Relationship)
- Add linking state machine:
  - `videoConfirmedBySeeker`, `videoConfirmedByRetainer` (manual toggles)
  - `approvedBySeeker`, `approvedByRetainer`
  - `status: PENDING | ACTIVE | REJECTED | DISABLED`
- Only allow link activation when both confirmations + approvals are present.
- Auto-break links on deleted/rejected profiles and send system/admin notification to remaining party.


## Phase 3 - Social Feed + Posts (Linked-Only)
- Implement `RetainerPost` (types: `AD`, `UPDATE`) with `audience: LINKED_ONLY | PUBLIC`.
- Feed aggregation on Seeker side:
  - show content from linked Retainers
  - include Retainer broadcast messages as a feed item
- Gate `PUBLIC` posting by Retainer tier/entitlement.

## Phase 3.5 - Badges (Trust System MVP)
- Implement badge definitions per role (Seeker vs Retainer), with token/icon + description + how-to-earn.
- Global badge selection per profile (up to 4 active badges at once).
- Weekly check-ins:
  - linked-only verification
  - requires link is `ACTIVE`
  - requires both parties enable “Working Together”
  - YES/NO point-based progress (levels never decrease once achieved)
- Seed includes realistic badge progress so UI can be tested immediately.


## Phase 4 - Routes (Structured, Monetizable)
- Implement `Route` as a real object:
  - location/area, vertical, schedule, pay model/range, requirements, openings, status
  - audience: linked-only vs public (tier gated)
- Add **Schedule Matching**:
  - Seekers publish weekly availability (days + time windows + timezone)
  - Routes publish structured schedule fields (days + start/end + timezone)
  - Surface a match score/badge on cards + enable sorting/filtering by match
- Seeker action: **Interested**
  - creates an interest record/notification
  - Retainer can review a list of Interested Seekers per Route
- Admin visibility:
  - route listing + interest volume + moderation tools


## Phase 5 - Entitlements (Hybrid Monetization)
Hybrid model = Seats + Reach + Throughput.
- Seats: number of Retainer users/staff.
- Reach: posts/ads/broadcast quotas + public visibility.
- Throughput: active routes + interest handling capacity + boosting.

Deliverables:
- Local "plan + limits" store for Seekers and Retainers.
- UI gating + hard enforcement in actions (not only hiding buttons).
- Admin tool to set/override tier per profile for testing.


## Phase 6 - Migration Path to API (Later)
- Introduce a data-store interface (localStorage now, API later).
- Migrate module-by-module (Linking, Feed, Routes, Messages) without big-bang rewrites.

## Risk Register (Pre-Mortem)
- Portal context cross-tab contamination -> store portal context in sessionStorage only; keep auth/session separate.
- Silent localStorage shape changes -> add schemaVersion + migrations; refuse destructive migrations without explicit reset.
- UI-only permission gating -> enforce permissions in action/data helpers; UI hides buttons but cannot bypass rules.
- Messaging confusion (external vs staff vs subcontractor vs broadcast) -> separate stores + filters + labels.
- Scale pain (200+ seekers, large org trees) -> paging, stable maps, and incremental rendering.
- Seed "mangling" (old + new mixed) -> seed clears all known keys before writing and resets session/portal context.
