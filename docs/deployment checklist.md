# Deployment Checklist

This is a living checklist for moving SnapDriver from local-first demo to a hosted environment.
Keep this file updated as decisions are made.

## Goals
- Ship a live production site on your domain.
- Keep a separate sandbox environment for testing and admin-only features.
- Prepare for mobile delivery (PWA first, native apps later).
- Add payment and entitlement enforcement for monetization.

## Hosting Plan (Frontend + Backend)
- Choose a frontend host (static site + CDN): Vercel or Netlify.
- Choose a backend host for the Node server: Render, Railway, or Fly.io.
- Decide single-host vs split-host setup.
- Confirm automatic HTTPS support on the chosen host.

## Domain and DNS
- Decide root domain vs subdomains.
- Plan DNS records:
  - A record for root domain or ALIAS/ANAME if required.
  - CNAME for subdomains (app, sandbox, api).
- Confirm SSL/TLS certificates are automatic.

## Environments
- Production: app.yourdomain.com
- Sandbox: sandbox.yourdomain.com
- Separate env vars per environment.
- Separate databases per environment.
- Feature flags for sandbox-only features (example: VITE_ENABLE_VIEW_AS).

## Data Layer (Local-first to API)
- Define data store interface boundaries in the app.
- Add API endpoints for core objects first (Links, Routes, Messages).
- Introduce a real database (Postgres recommended).
- Plan migrations and schema versioning.

## Mobile Strategy
- Confirm responsive layout works on small screens.
- Add PWA support (installable app + offline shell).
- Decide if and when to wrap with Capacitor.
- Decide if and when to build full native apps in React Native.

## Payments and Monetization
- Pick a payment processor (Stripe recommended).
- Define plans, tiers, and entitlements.
- Implement checkout and billing portal.
- Implement webhook handler to sync entitlements.
- Decide if in-app purchases are required for mobile stores.

## Media Storage (Cloudflare)
- Decide on Cloudflare Stream for video and R2 or Images for photos.
- Plan signed upload flow (client -> signed URL -> storage) and store only media IDs/URLs in profiles.
- Cost drivers: Stream minutes delivered (dominant) + minutes stored; R2 is GB-month + requests (no egress fees).
- Sizing example to validate pricing: 10,400 videos at 30s = 5,200 minutes stored; 10 views/user/month across 10,200 users = 51,000 minutes delivered.

## Security and Access
- Disable admin/test tools in production via feature flags.
- Lock down admin routes on production.
- Remove or gate any seed/reset utilities in production.

## Release Process
- Connect Git branches to environments:
  - main -> production
  - develop -> sandbox
- Create a minimal CI build step (lint, build).
- Define a rollback plan.

## Pre-Launch Validation
- Verify all links and routing on production.
- Confirm data persistence for live users.
- Confirm payments and entitlements are enforced.
- Confirm sandbox-only features are hidden in production.

## Notes
- Current app is local-first; production will still be demo-only until API + DB are added.
- Keep this checklist updated as decisions get made.
