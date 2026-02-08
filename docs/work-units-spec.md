# Work Units Spec (Draft)

This spec defines the minimal data model needed to score work completion without becoming a route management tool.

## Goals
- Tie scoring to actual work completion.
- Store counts only, no route-ops detail.
- Support dedicated cadence and on-demand workflow.
- Keep the data model small and local-first friendly.

## Non-Goals
- No stop-level details, GPS data, or proof-of-delivery.
- No full route scheduling or dispatch tooling.

## Core Entities

### RouteAssignment
Creates the lock-in relationship between a Seeker and a Route.

Fields:
- `id`
- `routeId`
- `retainerId`
- `seekerId`
- `assignmentType`: `DEDICATED` | `ON_DEMAND`
- `unitType`: `DAY` | `SHIFT` | `JOB`
- `cadence`: `WEEKLY` | `BIWEEKLY` | `MONTHLY` (from retainer pay cycle)
- `expectedUnitsPerPeriod` (required for `DEDICATED`)
- `startDate`
- `status`: `ACTIVE` | `PAUSED` | `ENDED`
- `createdAt`, `updatedAt`

### WorkUnitPeriod
One record per assignment per cadence period.

Fields:
- `id`
- `assignmentId`
- `periodKey` (ex: `2026-W06` or `2026-02`)
- `cadence`
- `expectedUnits` (for `DEDICATED`)
- `acceptedUnits` (for `ON_DEMAND`, required to score)
- `completedUnits`
- `missedUnits`
- `status`: `PENDING` | `CONFIRMED` | `DISPUTED` | `AUTO_APPROVED`
- `retainerSubmittedAt`
- `seekerRespondedAt`
- `windowClosesAt`
- `createdAt`, `updatedAt`

### WorkUnitResolution
Optional resolution metadata stored on the period.

Fields:
- `seekerResponse`: `CONFIRM` | `DISPUTE` | `NEUTRAL` | `NONE`
- `adminResolution`: `CONFIRM` | `OVERRIDE` | `NEUTRAL` | `NONE`
- `disputeNote`
- `adminNote`

## Storage Keys (Local-First)
- `snapdriver_route_assignments_v1`
- `snapdriver_work_unit_periods_v1`

## Lifecycle
1. Retainer locks a Seeker to a Route and creates a `RouteAssignment`.
2. At cadence close, create or open a `WorkUnitPeriod` for the assignment.
3. Retainer submits `completedUnits` and `missedUnits`.
4. Seeker can confirm, dispute, or submit neutral within 48 hours.
5. If no response, auto-approve as YES after the window closes.
6. If disputed, Admin resolves and finalizes counts.

## Scoring Integration (Work Completion Badge)
- Work Completion is a mandatory **BACKGROUND** badge.
- Only confirmed periods produce score impact.
- Counts are weighted to enforce the 3x negative rule:
  - `yesCount = completedUnits`
  - `noCount = missedUnits * 3`
- Dedicated: `expectedUnits` come from the assignment.
- On-demand: `acceptedUnits` are required; missed is `acceptedUnits - completedUnits`.
- Neutral response means no points and no level change.

## Privacy Guardrails
- Store counts only.
- Do not store job, stop, customer, or delivery details.
- Do not store timestamps beyond period boundaries.
