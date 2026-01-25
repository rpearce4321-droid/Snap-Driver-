// src/pages/RetainerDetailPage.tsx
import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { Retainer, Status, RetainerFee, PaymentTerm, PayCycleFrequency } from "../lib/data";
import {
  PAYMENT_TERMS,
  PAY_CYCLE_FREQUENCIES,
  RETAINER_FEE_CADENCE_OPTIONS,
  getRetainerById,
  purgeRetainer,
  restoreRetainerToPending,
  setRetainerStatusGuarded,
  softDeleteRetainer,
} from "../lib/data";
import { can, assertCan } from "../lib/permissions";
import { getLink, requestLink, type Link as LinkModel } from "../lib/linking";
import { getRoutesForRetainer, type Route } from "../lib/routes";
import { getPortalContext, getSession } from "../lib/session";
import { DAYS, type DayOfWeek } from "../lib/schedule";
import HierarchyCanvas from "../components/HierarchyCanvas";
import { getBadgeSummaryForProfile, getReputationScoreForProfile } from "../lib/badges";
import { badgeIconFor } from "../components/badgeIcons";
import { getStockImageUrl } from "../lib/stockImages";

type ProfileTabKey = "overview" | "schedule" | "photos" | "team";

type KnownRole = "ADMIN" | "SEEKER" | "RETAINER";

function isKnownRole(role: any): role is KnownRole {
  return role === "ADMIN" || role === "SEEKER" || role === "RETAINER";
}




function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function paymentTermsLabel(term?: PaymentTerm | null): string {
  if (!term) return "—";
  return PAYMENT_TERMS.find((opt) => opt.value === term)?.label ?? term;
}

function payCycleFrequencyLabel(freq?: PayCycleFrequency | null): string {
  if (!freq) return "-";
  return PAY_CYCLE_FREQUENCIES.find((opt) => opt.value === freq)?.label ?? freq;
}

function payCycleCloseDayLabel(day?: DayOfWeek | null): string {
  if (!day) return "-";
  return DAYS.find((opt) => opt.key === day)?.label ?? day;
}

function scheduleLabel(r: Route): string {
  if (typeof r.schedule === "string" && r.schedule.trim()) return r.schedule;
  if (Array.isArray(r.scheduleDays) && r.scheduleStart && r.scheduleEnd) {
    const short = (r.scheduleDays || [])
      .map((d) => {
        switch (d) {
          case "MON":
            return "Mon";
          case "TUE":
            return "Tue";
          case "WED":
            return "Wed";
          case "THU":
            return "Thu";
          case "FRI":
            return "Fri";
          case "SAT":
            return "Sat";
          case "SUN":
            return "Sun";
          default:
            return d;
        }
      })
      .join(", ");
    const tz = r.scheduleTimezone ? ` (${r.scheduleTimezone})` : "";
    return `${short} ${r.scheduleStart}–${r.scheduleEnd}${tz}`.trim();
  }
  return "Schedule not set";
}

export default function RetainerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("overview");
  const [linkOverride, setLinkOverride] = useState<LinkModel | null>(null);

  const session = useMemo(() => getSession(), []);
  const portalRole = useMemo(() => getPortalContext(), []);

  const retainer: Retainer | undefined = useMemo(
    () => (id ? getRetainerById(id) : undefined),
    [id]
  );

  const fallbackSeekerId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("snapdriver_current_seeker_id")
      : null;
  const fallbackRetainerId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("snapdriver_current_retainer_id")
      : null;

  const sessionRole = isKnownRole((session as any)?.role)
    ? ((session as any).role as KnownRole)
    : null;
  const role: KnownRole | null =
    (portalRole as KnownRole | null) ??
    sessionRole ??
    (fallbackRetainerId ? "RETAINER" : fallbackSeekerId ? "SEEKER" : null);

  const actorId =
    role === "RETAINER"
      ? (session as any)?.retainerId ?? fallbackRetainerId
      : role === "SEEKER"
      ? (session as any)?.seekerId ?? fallbackSeekerId
      : role === "ADMIN"
      ? (session as any)?.adminId ?? "admin"
      : null;

  const dashboardPath =
    portalRole === "ADMIN"
      ? "/admin"
      : portalRole === "RETAINER"
      ? "/retainers"
      : portalRole === "SEEKER"
      ? "/seekers"
      : role === "ADMIN"
      ? "/admin"
      : role === "RETAINER"
      ? "/retainers"
      : role === "SEEKER"
      ? "/seekers"
      : "/";

  const returnState = location.state as
    | { returnTo?: string; returnActionTab?: string }
    | null
    | undefined;
  const returnToAction = returnState?.returnTo === "action";
  const returnActionTab =
    typeof returnState?.returnActionTab === "string"
      ? returnState.returnActionTab
      : null;
  const backLabel = returnToAction
    ? returnActionTab === "lists"
      ? "← Back to Sorting Lists"
      : "← Back to Action Center"
    : "← Back to Dashboard";

  const handleBack = () => {
    if (returnToAction) {
      navigate(dashboardPath, {
        state: {
          openTab: "action",
          actionTab: returnActionTab ?? "lists",
        },
      });
      return;
    }
    navigate(dashboardPath);
  };

  const badgeLinkState = {
    openTab: "badges",
    returnTo: location.pathname,
    returnState: location.state ?? null,
  };

  if (!retainer) {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold">Retainer not found</div>
        <div className="mt-4">
          <button type="button" onClick={handleBack} className="btn">
            {backLabel}
          </button>
        </div>
      </div>
    );
  }

  const status = (retainer.status as Status) ?? "PENDING";

  const canView = role
    ? can("retainerProfile", "view", {
        role,
        actorId: actorId ?? undefined,
        retainerId: retainer.id,
      })
    : false;

  const canViewProfile =
    role === "SEEKER"
      ? canView && status === "APPROVED"
      : role === "RETAINER" && sessionRole === "RETAINER"
      ? canView && status === "APPROVED"
      : canView;

  if (!canViewProfile) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-xl font-semibold">Access denied</div>
        <div className="text-sm text-slate-300">
          You do not have permission to view this Retainer profile.
        </div>
        <div>
          <button type="button" onClick={handleBack} className="btn">
            {backLabel}
          </button>
        </div>
      </div>
    );
  }

  const companyName = retainer.companyName ?? (retainer as any).name ?? "Retainer";
  const zip = retainer.zip ?? "—";

  const city = retainer.city ?? "—";
  const state = retainer.state ?? "—";
  const email = (retainer as any).email ?? "—";
  const phone = (retainer as any).phone ?? "—";
  const ceoName = retainer.ceoName ?? "—";
  const mission = retainer.mission ?? "";
  const paymentTerms = (retainer as any).paymentTerms as PaymentTerm | undefined;
  const payCycleCloseDay = (retainer as any).payCycleCloseDay as DayOfWeek | undefined;
  const payCycleFrequency = (retainer as any).payCycleFrequency as PayCycleFrequency | undefined;
  const payCycleTimezone = (retainer as any).payCycleTimezone ?? "EST";
  const feeSchedule: RetainerFee[] = Array.isArray((retainer as any).feeSchedule)
    ? (retainer as any).feeSchedule
    : [];
  const hasPayCycle = Boolean(payCycleCloseDay || payCycleFrequency);

  const deliveryVerticals: string[] = Array.isArray((retainer as any).deliveryVerticals)
    ? (retainer as any).deliveryVerticals
    : [];
  const desiredTraits: string[] = Array.isArray((retainer as any).desiredTraits)
    ? (retainer as any).desiredTraits
    : [];

  const retainerPhotoUrl: string | undefined =
    (retainer as any).logoUrl ||
    (retainer as any).photoUrl ||
    (retainer as any).profileImageUrl ||
    getStockImageUrl("RETAINER", retainer.id);

  const facilityPhotoUrls: Array<{ label: string; url?: string }> = [
    {
      label: "Facility Photo 1",
      url:
        (retainer as any).facilityPhoto1 ||
        (retainer as any).facilityImage1 ||
        (retainer as any).locationPhoto1 ||
        undefined,
    },
    {
      label: "Facility Photo 2",
      url:
        (retainer as any).facilityPhoto2 ||
        (retainer as any).facilityImage2 ||
        (retainer as any).locationPhoto2 ||
        undefined,
    },
    {
      label: "Facility Photo 3",
      url:
        (retainer as any).facilityPhoto3 ||
        (retainer as any).facilityImage3 ||
        (retainer as any).locationPhoto3 ||
        undefined,
    },
  ];

  const isAdmin = role === "ADMIN";
  const isOwner = role === "RETAINER" && !!actorId && actorId === retainer.id;

  const viewerSeekerId = role === "SEEKER" ? actorId : null;
  const computedLink =
    role === "SEEKER" && viewerSeekerId ? getLink(viewerSeekerId, retainer.id) : null;
  const link = linkOverride ?? computedLink;
  const isLinked = link?.status === "ACTIVE";

  const canSeeLinkedOnly = isAdmin || isOwner || isLinked;

  const badgeSummary = useMemo(
    () =>
      getBadgeSummaryForProfile({
        ownerRole: "RETAINER",
        ownerId: retainer.id,
        max: 8,
      }),
    [retainer.id]
  );

  const reputation = useMemo(
    () =>
      getReputationScoreForProfile({ ownerRole: "RETAINER", ownerId: retainer.id }),
    [retainer.id]
  );

  const permissionCtx = role
    ? {
        role,
        actorId: actorId ?? undefined,
        retainerId: retainer.id,
      }
    : null;

  const assertAdminAction = (
    action: "approve" | "reject" | "delete" | "restore" | "purge"
  ) => {
    if (!permissionCtx) throw new Error("Permission denied: missing session role");
    assertCan("retainerProfile", action, permissionCtx);
  };

  const doApprove = () => {
    assertAdminAction("approve");
    setRetainerStatusGuarded(retainer.id, "APPROVED");
    navigate(dashboardPath);
  };
  const doReject = () => {
    assertAdminAction("reject");
    setRetainerStatusGuarded(retainer.id, "REJECTED");
    navigate(0);
  };
  const doSoftDelete = () => {
    assertAdminAction("delete");
    softDeleteRetainer(retainer.id);
    navigate(0);
  };
  const doRestore = () => {
    assertAdminAction("restore");
    restoreRetainerToPending(retainer.id);
    navigate(0);
  };
  const doPurge = () => {
    assertAdminAction("purge");
    purgeRetainer(retainer.id);
    navigate(dashboardPath);
  };

  const handleRequestLink = () => {
    if (role !== "SEEKER" || !viewerSeekerId) return;
    const next = requestLink({
      seekerId: viewerSeekerId,
      retainerId: retainer.id,
      by: "SEEKER",
    });
    setLinkOverride(next);
  };

  const requestDisabled =
    role !== "SEEKER" ||
    !viewerSeekerId ||
    link?.requestedBySeeker ||
    link?.status === "ACTIVE";

  const routes = useMemo<Route[]>(() => {
    if (!canSeeLinkedOnly) return [];
    return getRoutesForRetainer(retainer.id);
  }, [canSeeLinkedOnly, retainer.id]);

  const userLevelLabels = (retainer as any).userLevelLabels ?? {
    level1: "Level 1",
    level2: "Level 2",
    level3: "Level 3",
  };
  const retainerUsers: any[] = Array.isArray((retainer as any).users)
    ? (retainer as any).users
    : [];
  const hierarchyItems = retainerUsers.map((u) => {
    const level = typeof u.level === "number" ? u.level : 1;
    const levelLabel =
      userLevelLabels[`level${level}` as keyof typeof userLevelLabels] ??
      `Level ${level}`;
    return {
      id: String(u.id),
      name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "User",
      title: typeof u.title === "string" ? u.title : levelLabel,
      meta:
        typeof u.bio === "string"
          ? u.bio
          : typeof u.email === "string"
          ? u.email
          : levelLabel,
      photoUrl: typeof u.photoUrl === "string" ? u.photoUrl : undefined,
    };
  });

  const hierarchyOwner = {
    id: retainer.id,
    name: companyName,
    title: ceoName !== "—" ? ceoName : "Owner",
    meta: email !== "—" ? email : undefined,
    photoUrl: retainerPhotoUrl,
  };

  const tabs: Array<{ key: ProfileTabKey; label: string }> = [
    { key: "overview", label: role === "SEEKER" ? "Ops Snapshot" : "Overview" },
    { key: "schedule", label: "Schedule" },
    { key: "photos", label: "Photos" },
    { key: "team", label: role === "SEEKER" ? "Team" : "Hierarchy" },
  ];

  return (
    <div className="h-screen bg-slate-950 text-slate-50 overflow-hidden" style={{ zoom: 1.1, height: "calc(100vh / 1.1)", width: "calc(100vw / 1.1)" }}>
      <div className="p-6 h-full overflow-hidden">
        <div className="max-w-3xl mx-auto w-full h-full overflow-hidden flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={handleBack} className="btn">
          {backLabel}
        </button>

        {role === "SEEKER" && status === "APPROVED" && (
          <div className="flex items-center gap-2">
            {!isLinked && (
              <button
                type="button"
                className="btn"
                onClick={handleRequestLink}
                disabled={requestDisabled}
              >
                {link?.requestedBySeeker ? "Link Requested" : "Request Link"}
              </button>
            )}
            {isLinked && (
              <span className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-sm">
                Linked
              </span>
            )}
          </div>
        )}
      </div>

      <section className="rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shrink-0">
        <div className="h-28 bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800" />
        <div className="px-6 pb-6 -mt-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar url={retainerPhotoUrl} name={companyName} />
              <div>
                <div className="text-xs uppercase tracking-wide text-white/60">
                  Retainer
                </div>
                <h1 className="text-3xl font-bold mt-1">{companyName}</h1>
                <div className="text-sm text-white/70 mt-1">ZIP {zip}</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Pill tone="neutral" label={status === "APPROVED" ? "Approved" : status} />
                  {isLinked && <Pill tone="neutral" label="Linked" />}
                  {!isLinked && canSeeLinkedOnly && role !== "ADMIN" && (
                    <Pill tone="neutral" label="Linked view unlocked" />
                  )}
                  {role && role !== "ADMIN" && <Pill tone="subtle" label={`Viewing as ${role}`} />}
                </div>

                {(badgeSummary.length > 0 || reputation.total > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reputation.total > 0 && (
                      <Link
                        to="/retainers"
                        state={badgeLinkState}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                        title="Professional Reputation Score is a recent weighted score across linked-only badge confirmations."
                      >
                        <span className="text-emerald-200">
                          {badgeIconFor("star", "h-5 w-5")}
                        </span>
                        <span className="font-semibold">Reputation</span>
                        <span className="text-slate-200">
                          {reputation.score == null ? "--" : reputation.score}
                        </span>
                        <span className="text-slate-500">({reputation.total})</span>
                      </Link>
                    )}

                    {badgeSummary.map((b) => (
                      <Link
                        key={b.badge.id}
                        to="/retainers"
                        state={badgeLinkState}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                        title={b.badge.description}
                      >
                        <span className="text-emerald-200">
                          {badgeIconFor(b.badge.iconKey, "h-5 w-5")}
                        </span>
                        <span className="font-semibold">{b.badge.title}</span>
                        <span className="text-slate-400">Lv {b.maxLevel}</span>
                        {b.score != null && (
                          <span className="text-slate-500">{b.score}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {role === "ADMIN" && (
              <div className="flex flex-wrap gap-2">
                {status === "PENDING" && (
                  <>
                    <button className="btn" onClick={doApprove}>
                      Approve
                    </button>
                    <button className="btn" onClick={doReject}>
                      Reject
                    </button>
                  </>
                )}
                {status === "REJECTED" && (
                  <>
                    <button className="btn" onClick={doRestore}>
                      Restore to Pending
                    </button>
                    <button className="btn" onClick={doSoftDelete}>
                      Move to Deleted
                    </button>
                  </>
                )}
                {status === "DELETED" && (
                  <>
                    <button className="btn" onClick={doRestore}>
                      Restore to Pending
                    </button>
                    <button className="btn" onClick={doPurge}>
                      Permanently Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex-1 min-h-0 flex flex-col">
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={[
                "px-3 py-1.5 rounded-full text-xs font-medium border transition",
                activeTab === t.key
                  ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-200 shadow-sm"
                  : "bg-slate-900/70 border-slate-700 text-slate-300 hover:bg-slate-800",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="pt-4 flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">

        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Snapshot
              </div>
              <div className="mt-3 text-sm text-slate-200">
                {canSeeLinkedOnly ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <KeyValue label="Company" value={companyName} />
                      <KeyValue
                        label="Location"
                        value={
                          city !== "—" || state !== "—"
                            ? `${city}, ${state} • ZIP ${zip}`
                            : `ZIP ${zip}`
                        }
                      />
                      <KeyValue label="CEO / Primary Contact" value={ceoName} />
                      <KeyValue label="Email" value={email} />
                      <KeyValue label="Phone" value={phone} />
                      <KeyValue
                        label="Delivery Verticals"
                        value={
                          deliveryVerticals.length === 0 ? (
                            <span className="text-slate-500">—</span>
                          ) : (
                            deliveryVerticals.join(", ")
                          )
                        }
                      />
                    </div>

                    {mission?.trim() && (
                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                        <div className="text-[11px] text-slate-400">Mission</div>
                        <div className="text-sm text-slate-100 whitespace-pre-wrap">
                          {mission}
                        </div>
                      </div>
                    )}

                    {desiredTraits.length > 0 && (
                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                        <div className="text-[11px] text-slate-400">
                          Desired Driver Traits
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {desiredTraits.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/40 px-2 py-0.5 text-[11px] text-slate-200"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-slate-300">
                    This profile is visible, but the full details are{" "}
                    <span className="text-slate-100 font-medium">linked-only</span>.
                  </div>
                )}
              </div>
            </div>

            {role === "SEEKER" && canSeeLinkedOnly && (paymentTerms || feeSchedule.length > 0 || hasPayCycle) && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Payment Terms & Fees
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <KeyValue label="Payment terms" value={paymentTermsLabel(paymentTerms)} />
                  {hasPayCycle && (
                    <KeyValue label="Pay cycle close day" value={payCycleCloseDayLabel(payCycleCloseDay)} />
                  )}
                  {hasPayCycle && (
                    <KeyValue label="Pay cycle frequency" value={payCycleFrequencyLabel(payCycleFrequency)} />
                  )}
                  {hasPayCycle && (
                    <KeyValue label="Pay cycle timezone" value={payCycleTimezone || "EST"} />
                  )}
                </div>
                {feeSchedule.length === 0 ? (
                  <div className="text-sm text-slate-400">
                    No fees have been listed yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {feeSchedule.map((fee) => (
                      <div
                        key={fee.id}
                        className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-100">
                            {fee.label}
                          </div>
                          <div className="text-xs text-slate-300">
                            {formatUsd(fee.amount)} •{" "}
                            {RETAINER_FEE_CADENCE_OPTIONS.find(
                              (opt) => opt.value === fee.cadence
                            )?.label ?? fee.cadence}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-slate-300 whitespace-pre-wrap">
                          {fee.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!canSeeLinkedOnly && (
              <LockedPanel
                title="Unlock full profile"
                description="After your video call, request a link to view schedules and more."
                actionLabel={
                  role === "SEEKER"
                    ? link?.requestedBySeeker
                      ? "Link Requested"
                      : "Request Link"
                    : undefined
                }
                onAction={role === "SEEKER" ? handleRequestLink : undefined}
                actionDisabled={requestDisabled}
              />
            )}
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="space-y-4">
            {!canSeeLinkedOnly ? (
              <LockedPanel
                title="Schedule is linked-only"
                description="Link with this profile to view routes and schedules."
                actionLabel={
                  role === "SEEKER"
                    ? link?.requestedBySeeker
                      ? "Link Requested"
                      : "Request Link"
                    : undefined
                }
                onAction={role === "SEEKER" ? handleRequestLink : undefined}
                actionDisabled={requestDisabled}
              />
            ) : (
              <div className="space-y-2">
                {routes.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
                    No routes have been published yet.
                  </div>
                ) : (
                  routes
                    .slice()
                    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
                    .slice(0, 20)
                    .map((r) => (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-100">
                            {r.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {r.status}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-slate-300">
                          {scheduleLabel(r)}
                        </div>
                        {(r.city || r.state || r.vertical) && (
                          <div className="mt-2 text-[11px] text-slate-500">
                            {[r.vertical, [r.city, r.state].filter(Boolean).join(", ")]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        )}
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "photos" && (
          <div className="space-y-4">
            {!canSeeLinkedOnly ? (
              <LockedPanel
                title="Photos are linked-only"
                description="Only the main profile photo is public. Link to view additional photos."
                actionLabel={
                  role === "SEEKER"
                    ? link?.requestedBySeeker
                      ? "Link Requested"
                      : "Request Link"
                    : undefined
                }
                onAction={role === "SEEKER" ? handleRequestLink : undefined}
                actionDisabled={requestDisabled}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <ImageCard title="Company Photo" url={retainerPhotoUrl} />
                {facilityPhotoUrls.map((p) => (
                  <ImageCard key={p.label} title={p.label} url={p.url} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "team" && (
          <div className="space-y-4">
            {!canSeeLinkedOnly ? (
              <LockedPanel
                title="Team view is linked-only"
                description="Link with this profile to view staff and hierarchy."
                actionLabel={
                  role === "SEEKER"
                    ? link?.requestedBySeeker
                      ? "Link Requested"
                      : "Request Link"
                    : undefined
                }
                onAction={role === "SEEKER" ? handleRequestLink : undefined}
                actionDisabled={requestDisabled}
              />
            ) : hierarchyItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
                No users have been added yet.
              </div>
            ) : (
              <HierarchyCanvas
                owner={hierarchyOwner}
                items={hierarchyItems}
                nodes={(retainer as any).hierarchyNodes ?? []}
                readOnly
                showList={false}
              />
            )}
          </div>
        )}
        </div>
      </section>
        </div>
      </div>
    </div>
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "subtle";
}) {
  const cls =
    tone === "subtle"
      ? "bg-white/5 border-white/10 text-white/70"
      : "bg-white/10 border-white/10 text-white/80";
  return (
    <span className={`px-2.5 py-1 rounded-full border text-[11px] ${cls}`}>
      {label}
    </span>
  );
}

function Avatar({ url, name }: { url?: string; name: string }) {
  return (
    <div className="h-20 w-20 rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center">
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm text-slate-400">
          {(name || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-sm text-slate-100">{value}</div>
    </div>
  );
}

function LockedPanel(props: {
  title: string;
  description: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-5">
      <div className="text-sm font-semibold text-slate-100">{props.title}</div>
      <div className="text-sm text-slate-300 mt-1">{props.description}</div>
      {props.actionLabel && props.onAction && (
        <div className="mt-4">
          <button
            type="button"
            className="btn"
            onClick={props.onAction}
            disabled={props.actionDisabled}
          >
            {props.actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function ImageCard({ title, url }: { title: string; url?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
      <div className="text-xs font-medium text-slate-200">{title}</div>
      {url ? (
        <img
          src={url}
          alt={title}
          className="w-full max-h-72 rounded-xl object-contain bg-slate-900/60 border border-slate-800"
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
          No image
        </div>
      )}
    </div>
  );
}
