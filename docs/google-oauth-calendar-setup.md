# Google OAuth + Calendar (Meet) Setup Guide

This document defines how we enable Google OAuth and Calendar integration for
SnapDriver so retainers can schedule Google Meet interviews inside the app.

## Decision Summary

- Retainers only can schedule interviews.
- Google OAuth is required. No manual Meet link entry.
- Use the retainer primary calendar.
- Retainers can invite multiple seekers to a single meet.
- Retainers propose time slots. Seekers can confirm one slot only.
- Retainers finalize the slot. Only then do we create the Google event.
- Both sides can reschedule or cancel.
- Admin can view all meeting metrics and audit data.

## Core Goals

- Create Meet links automatically after a slot is finalized.
- Use Google to send invite emails because we do not send emails yet.
- Store meeting metadata for admin reporting and compliance.

## Important Notes

- We do not send emails ourselves. Google Calendar sends attendee invites.
- Seeker email must exist before a seeker can be invited to a meeting.
- Retainer time zone is the source of truth. Store all times in UTC.
- Attendees can be many. We store each seeker attendance per event.

## Google Cloud Setup

### 1) Create Project
- Create a Google Cloud project, e.g. "snapdriver-prod".

### 2) Enable Calendar API
- APIs & Services -> Library -> enable Google Calendar API.

### 3) OAuth Consent Screen
Choose External for public use or Internal for org-only.

Fields to complete:
- App name: SnapDriver
- User support email
- Authorized domains: snappservices.com
- Developer contact email

Scopes to request:
- https://www.googleapis.com/auth/calendar.events
- https://www.googleapis.com/auth/calendar

If the consent screen is in Testing, add test users.

### 4) OAuth Client ID
- Create OAuth client ID -> Web Application
- Authorized JavaScript origins:
  - https://www.snappservices.com
  - http://localhost:5173
- Authorized redirect URIs:
  - https://www.snappservices.com/api/google/oauth/callback
  - http://localhost:8788/api/google/oauth/callback

## Cloudflare Env Vars

Set in Production and Preview:

- GOOGLE_OAUTH_CLIENT_ID
- GOOGLE_OAUTH_CLIENT_SECRET
- GOOGLE_OAUTH_REDIRECT_URL=https://www.snappservices.com/api/google/oauth/callback
- GOOGLE_OAUTH_SCOPES=https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar
- GOOGLE_OAUTH_STATE_SECRET=random-string

Local dev in .dev.vars:

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:8788/api/google/oauth/callback
GOOGLE_OAUTH_SCOPES=https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar
GOOGLE_OAUTH_STATE_SECRET=...
```

## OAuth Endpoints

### GET /api/google/oauth/start

- Requires retainer session.
- Creates CSRF state token.
- Redirects to Google OAuth consent screen.

### GET /api/google/oauth/callback

- Exchanges code for access and refresh tokens.
- Stores tokens for the retainer.
- Redirects back to the app with success or failure.

## Token Storage Model

Table google_oauth_tokens:

- id
- retainer_id
- access_token
- refresh_token
- scope
- expires_at
- created_at
- updated_at

Tokens are only stored for retainers.

## Scheduling Flow

### 1) Retainer proposes slots

- Retainer chooses up to 3 candidate slots per day.
- Slots are stored in D1 as pending proposals.
- No Google event is created yet.

### 2) Seekers select one slot

- Each invited seeker can confirm one slot only.
- Seeker selection is stored as their preference.

### 3) Retainer finalizes

- Retainer finalizes a slot.
- Only then do we create the Google event.

### 4) Event creation

Call:
POST https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1

Event payload:
- summary: SnapDriver Interview
- description: retainer name, seeker list, internal IDs
- start and end in retainer time zone
- attendees: list of seeker emails
- conferenceData.createRequest to generate Meet link

Response data we store:
- google_event_id
- meet_link
- start_at, end_at (UTC)
- attendee list
- created_at

### 5) Reschedule and cancel

- Either party can request reschedule.
- Retainer finalizes a new slot.
- Cancelled meetings are marked and the event is updated or deleted.

## Attendance and Outcome Tracking

- Retainer marks each attendee as met or no-show after the meeting.
- Seeker marks their own status as met or no-show.
- Admin can see final status and disagreements.

## Admin Metrics to Store

- total_meets_created
- total_meets_completed
- total_meets_canceled
- no_show_rate
- average_meet_duration
- meet_count_per_retainer
- meet_count_per_seeker

Store metrics in admin-only profile metadata fields.

## Security and Audit

- Record OAuth connection events with timestamp and admin visibility.
- Track which admin approved any related profile changes.
- Store minimal tokens and refresh them as needed.

## Rate Limits and Quotas

- Google Calendar API has quotas per project and per user.
- Use retry with backoff for 429s.
- Avoid creating events until slot finalization.

## Testing Checklist

1. Retainer connects Google successfully.
2. Retainer proposes slots and invitees.
3. Seeker selects exactly one slot.
4. Retainer finalizes and event is created.
5. Meet link appears in app and Calendar.
6. Seekers receive Google invite.
7. Attendance can be marked by both sides.
8. Admin can see metrics.

## Troubleshooting

- Invalid redirect URI: must match exactly in Google console.
- Access blocked: app is in Testing or not verified. Add test users or publish.
- Missing Meet link: ensure conferenceDataVersion=1 and createRequest.
- Missing email invite: ensure attendees list is set and Google permits send.
- 401 or 403: refresh token expired or revoked. Reconnect OAuth.
