# Snap Driver - TODO (Profiles + Messaging + Social UX)

This file tracks the next set of improvements to make the product feel less "generic app"
and more like a marketing/recruiting + social media platform.

## Current State (Built)
- [x] Linking UI (Seeker + Retainer) with ACTIVE gating (video + approvals)
- [x] Retainer Posts + Broadcasts (linked-only + tier-gated public)
- [x] Seeker Feed (posts + broadcasts + routes) with search + filters
- [x] Broadcasts can optionally deliver into linked Seekers' inboxes (flagged + labeled)
- [x] Admin moderation panel for Posts & Broadcasts (archive/unarchive)
- [x] Comprehensive seed includes ACTIVE links + feed content + routes + interests for (MS) profiles
- [x] Badge system MVP (global per profile; linked-only weekly check-ins)
- [x] Working Together toggle required for badge check-ins
- [x] Badges page in Seeker + Retainer portals (Retainer level 1 is view-only)
- [x] Profile pages show earned badge tokens
- [x] Comprehensive seed includes badge selections + varied badge progress

## Next: Badges (Changes)
- [x] Add onboarding video badges (Snap Badges) for both roles:
  - Retainer: "I know what I am" (acknowledge broker + offers work).
  - Seeker: "I know what I am" (acknowledge independent contractor + business owner).
  - Permanently locked once earned; Snap admin can override.
- [x] Add "Badge Checker" badge (5-stage) for both roles tied to monthly verification cadence (aligned with subscription renewal).
- [x] Background badges carry heavier weight; selectable badges lighter weight.
- [x] Background badges: users must choose 4; changes locked for 12 months (admin override allowed).
- [x] Draft background expectations (names TBD):
  - Retainer: clear terms, payment reliability, fair chance, support responsiveness, route consistency, clear escalations, transparency.
  - Seeker: route reliability, professional communication, customer/brand professionalism, exception reporting.
- [x] Scoring model (Option B): Expectations score + Growth score (65/35 split).
- [x] Add per-badge weights + level multipliers (higher badge stage carries more weight).
  - Naming decisions (draft):
    - Snap badge (both roles): I Know My Lane
    - Clear Scheduling: Schedule Lock
    - Clear Operations: Clear Playbook
    - On-Time Payment: Payday Precision
    - Driver Support: Driver Backstop
    - Fair Resolution: Fair Shake
  - Add Badges tab breakdown cards: For the Math Nerds / For the Readers / For the Doers.
  - Retainer background weights (draft):
    - Payment Reliability: 4
    - Clear Terms: 3
    - Fair Chance: 3
    - Support Responsiveness: 2
    - Route Consistency: 2
    - Clear Escalations: 2
    - Transparency: 2
  - Seeker background weights (draft):
    - Route Reliability: 4
    - Professional Communication: 3
    - Customer/Brand Professionalism: 3
    - Exception Reporting: 2
  - Foreground default weight: 1 (admin-adjustable)
  - Level multipliers (1-5): L1=1.0, L2=1.7, L3=2.5, L4=3.2, L5=4.0.
  - Placeholder weights (admin-adjustable): payment/route highest, comms/brand mid, support/ops lower.
- [x] Fairness: per-link averaging for badge scores; missing check-ins neutral; consider rolling window vs lifetime.
- [x] Badge Checker definition: monthly compliance threshold aligned to subscription renewal.
- [x] Audit log for badge YES/NO check-ins (per profile) with admin override + dispute resolution.
- [x] Draft background expectations (names TBD):
  - Retainer: clear terms, payment reliability, fair chance, support responsiveness, route consistency, clear escalations, transparency.
  - Seeker: route reliability, professional communication, customer/brand professionalism, exception reporting (avoid one-off compliance).
- [x] Weight trust rating by badge kind (background heavier than selectable; e.g., 3x vs 1x).
- [x] Reinforce intent: background badges = expectations, selectable badges = optional goals.
- [x] Add non-invasive confirmation flow (batch approvals, default-yes, sampling, route/group confirm).
- [x] Add a Badge Approvals queue in Action Center (or Badges tab) with filters + quick confirm.
- [x] Add a Badge approvals counter/shortcut in the Now rail.


## Policy / Rating Visibility (Tiers)
- [ ] Finalize tier-aware rating visibility + free-tier cap/fairness (see `docs/CONTEXT.md`: Rating / Tiers Fairness).


## Next: Dashboards (Social Home)
- [ ] Seeker Dashboard: add a right-side "Now" rail (links, unread, route interests, quick actions)
- [ ] Seeker Dashboard: add "Latest from your network" preview (top feed items)
- [ ] Retainer Dashboard: add a right-side "Now/Engagement" rail (links, unread, route interests)
- [ ] Retainer Dashboard: add a "Quick update" composer card (linked-only UPDATE post)
- [ ] Wide-screen layout: use `max-w-screen-2xl` + 2-column dashboard grids to reduce dead space

## Next: Profile Overhaul (Social-first)
- [ ] Seeker profile: add Work History / Experience (structured entries, editable by seeker, read-only elsewhere)
- [ ] Seeker profile: align "Edit Profile" to the multi-page/detail layout (match read-only profile pages)
- [ ] Seeker profile: image upload UI (avatar + vehicle photos) and consistent display on cards
- [ ] Retainer staff profiles: ensure photo + bio are editable and displayed consistently (cards + hierarchy + messaging rails)
- [ ] Profile pages: add a "social header" (avatar, name/company, location, quick stats, link status)
- [ ] Profile pages: add an "Activity" section (recent posts, broadcasts, routes, reviews)

## Next: Messaging (More Social, Less CRM)
- [ ] External messages: add stronger context header (participants, link status, quick actions)
- [ ] Broadcast threads: keep clearly separated in rails (badge + optional filter)
- [ ] Add "Notifications" pattern (unread + last activity surfaced in feed + messaging)
- [ ] Add lightweight inbox categories on both portals:
  - External (Seeker ↔ Retainer)
  - Broadcasts
  - Internal staff (Retainer)
  - Subcontractors (Seeker)
- [ ] Add message reactions v1 (simple 👍/✅/🙏 style) to reduce plain-text churn (local-first store)

## Next: Feed (Social UX polish)
- [ ] Feed cards: richer layout (media slots, consistent retainer avatar, tighter spacing)
- [ ] Feed: "Open Retainer / Open Route" actions everywhere + deep links into Routes tab
- [ ] Feed: allow Retainers to pin a post/broadcast to top for linked Seekers
- [ ] Feed: add retainer verification / tier badge (optional, display-only)

## Admin (Support + Moderation)
- [ ] Add link management visibility (who is linked to whom; ability to disable link)
- [ ] Add content audit view tying inbox-delivered broadcast messages to the originating broadcast
- [ ] Add a simple model-based test harness for critical state machines (Linking + Badges + Messages)
- [ ] Pre-production: disallow "Approve link" until both parties confirm video
