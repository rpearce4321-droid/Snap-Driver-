// src/pages/SeekerDetailPage.tsx
import React, { useMemo, useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { Seeker, Status } from "../lib/data";
import {
  getSeekerById,
  purgeSeeker,
  restoreSeekerToPending,
  setSeekerStatusGuarded,
  softDeleteSeeker,
} from "../lib/data";
import { can, assertCan } from "../lib/permissions";
import { getLink, requestLink, type Link as LinkModel } from "../lib/linking";
import type { WeeklyAvailability } from "../lib/schedule";
import { DAYS, isDayOfWeek } from "../lib/schedule";
import { getPortalContext, getSession } from "../lib/session";
import HierarchyCanvas from "../components/HierarchyCanvas";
import { getBadgeSummaryForProfile, getTrustRatingForProfile } from "../lib/badges";
import {
  getActiveBadExitSummaryForSeeker,
  getActiveNoticeSummaryForSeeker,
  ROUTE_NOTICE_EVENT,
} from "../lib/routeNotices";

import { badgeIconFor } from "../components/badgeIcons";
import { getStockImageUrl } from "../lib/stockImages";

type ProfileTabKey =
  | "overview"
  | "workHistory"
  | "schedule"
  | "photos"
  | "team";

type KnownRole = "ADMIN" | "SEEKER" | "RETAINER";

function isKnownRole(role: any): role is KnownRole {
  return role === "ADMIN" || role === "SEEKER" || role === "RETAINER";
}




function normalizeWeeklyAvailability(raw: any): WeeklyAvailability | null {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.blocks)) return null;
  const blocks = raw.blocks
    .filter((b: any) => b && isDayOfWeek(b.day))
    .map((b: any) => ({
      day: b.day as any,
      start: String(b.start ?? ""),
      end: String(b.end ?? ""),
    }))
    .filter((b: any) => b.start && b.end);
  if (blocks.length === 0) return null;
  return {
    timezone: typeof raw.timezone === "string" ? raw.timezone : undefined,
    blocks,
  };
}

export default function SeekerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("overview");
  const [linkOverride, setLinkOverride] = useState<LinkModel | null>(null);

  const [noticeTick, setNoticeTick] = useState(0);

  const session = useMemo(() => getSession(), []);
  const portalRole = useMemo(() => getPortalContext(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setNoticeTick((n) => n + 1);
    window.addEventListener(ROUTE_NOTICE_EVENT, handler);
    return () => window.removeEventListener(ROUTE_NOTICE_EVENT, handler);
  }, []);


  const seeker: Seeker | undefined = useMemo(
    () => (id ? getSeekerById(id) : undefined),
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
    role === "SEEKER"
      ? (session as any)?.seekerId ?? fallbackSeekerId
      : role === "RETAINER"
      ? (session as any)?.retainerId ?? fallbackRetainerId
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

  if (!seeker) {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold">Seeker not found</div>
        <div className="mt-4">
          <button type="button" onClick={handleBack} className="btn">
            {backLabel}
          </button>
        </div>
      </div>
    );
  }

  const status = ((seeker as any).status as Status) ?? "PENDING";

  const canView = role
    ? can("seekerProfile", "view", {
        role,
        actorId: actorId ?? undefined,
        seekerId: seeker.id,
      })
    : false;

  const canViewProfile =
    role === "RETAINER"
      ? canView && status === "APPROVED"
      : role === "SEEKER" && sessionRole === "SEEKER"
      ? canView && status === "APPROVED"
      : canView;

  if (!canViewProfile) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-xl font-semibold">Access denied</div>
        <div className="text-sm text-slate-300">
          You do not have permission to view this Seeker profile.
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleBack} className="btn">
            {backLabel}
          </button>
        </div>
      </div>
    );
  }

  const fullName =
    [seeker.firstName, seeker.lastName].filter(Boolean).join(" ") ||
    ((seeker as any).name as string | undefined) ||
    "Seeker";

  const zip = (seeker as any).zip ?? "—";
  const company = (seeker as any).companyName ?? (seeker as any).company ?? "—";
  const email = (seeker as any).email ?? "—";
  const phone = (seeker as any).phone ?? "—";
  const city = (seeker as any).city ?? "—";
  const state = (seeker as any).state ?? "—";
  const insurance = (seeker as any).insuranceType ?? "—";
  const vehicle = (seeker as any).vehicle ?? "—";
  const notes = (seeker as any).notes ?? (seeker as any).about ?? "";

  const seekerPhotoUrl: string | undefined =
    (seeker as any).photoUrl ||
    (seeker as any).profileImageUrl ||
    (seeker as any).photo ||
    getStockImageUrl("SEEKER", seeker.id);

  const vehiclePhotoUrls: Array<{ label: string; url?: string }> = [
    {
      label: "Vehicle Photo 1",
      url:
        (seeker as any).vehiclePhoto1 ||
        (seeker as any).vehicleImage1 ||
        (seeker as any).vehiclePhotoUrl1 ||
        undefined,
    },
    {
      label: "Vehicle Photo 2",
      url:
        (seeker as any).vehiclePhoto2 ||
        (seeker as any).vehicleImage2 ||
        (seeker as any).vehiclePhotoUrl2 ||
        undefined,
    },
    {
      label: "Vehicle Photo 3",
      url:
        (seeker as any).vehiclePhoto3 ||
        (seeker as any).vehicleImage3 ||
        (seeker as any).vehiclePhotoUrl3 ||
        undefined,
    },
  ];

  const isAdmin = role === "ADMIN";
  const isOwner = role === "SEEKER" && !!actorId && actorId === seeker.id;

  const viewerRetainerId = role === "RETAINER" ? actorId : null;
  const computedLink =
    role === "RETAINER" && viewerRetainerId
      ? getLink(seeker.id, viewerRetainerId)
      : null;
  const link = linkOverride ?? computedLink;
  const isLinked = link?.status === "ACTIVE";

  const canSeeLinkedOnly = isAdmin || isOwner || isLinked;

  const showExitSignals =
    role === "RETAINER" &&
    (link?.status === "ACTIVE" || link?.status === "PENDING");

  const noticeSummary = useMemo(
    () => getActiveNoticeSummaryForSeeker(seeker.id),
    [seeker.id, noticeTick]
  );

  const badExitSummary = useMemo(
    () => getActiveBadExitSummaryForSeeker(seeker.id),
    [seeker.id, noticeTick]
  );

  const badgeSummary = useMemo(
    () =>
      getBadgeSummaryForProfile({
        ownerRole: "SEEKER",
        ownerId: seeker.id,
        max: 8,
      }),
    [seeker.id]
  );

  const trust = useMemo(
    () => getTrustRatingForProfile({ ownerRole: "SEEKER", ownerId: seeker.id }),
    [seeker.id, noticeTick]
  );

  const noticeLabel =
    noticeSummary.count > 1
      ? `Route notices: ${noticeSummary.count} (${noticeSummary.daysLeft ?? 0}d)`
      : `Route notice: ${noticeSummary.daysLeft ?? 0}d`;

  const badExitLabel =
    badExitSummary.count > 1
      ? `Bad exits: ${badExitSummary.count} (${badExitSummary.daysLeft ?? 0}d, -${badExitSummary.penaltyPercent}%)`
      : `Bad exit: ${badExitSummary.daysLeft ?? 0}d (-${badExitSummary.penaltyPercent}%)`;

  const permissionCtx = role
    ? {
        role,
        actorId: actorId ?? undefined,
        seekerId: seeker.id,
      }
    : null;

  const assertAdminAction = (
    action: "approve" | "reject" | "delete" | "restore" | "purge"
  ) => {
    if (!permissionCtx) throw new Error("Permission denied: missing session role");
    assertCan("seekerProfile", action, permissionCtx);
  };

  const doApprove = () => {
    assertAdminAction("approve");
    setSeekerStatusGuarded(seeker.id, "APPROVED");
    navigate(dashboardPath);
  };
  const doReject = () => {
    assertAdminAction("reject");
    setSeekerStatusGuarded(seeker.id, "REJECTED");
    navigate(0);
  };
  const doSoftDelete = () => {
    assertAdminAction("delete");
    softDeleteSeeker(seeker.id);
    navigate(0);
  };
  const doRestore = () => {
    assertAdminAction("restore");
    restoreSeekerToPending(seeker.id);
    navigate(0);
  };
  const doPurge = () => {
    assertAdminAction("purge");
    purgeSeeker(seeker.id);
    navigate(dashboardPath);
  };

  const handleRequestLink = () => {
    if (role !== "RETAINER" || !viewerRetainerId) return;
    const next = requestLink({
      seekerId: seeker.id,
      retainerId: viewerRetainerId,
      by: "RETAINER",
    });
    setLinkOverride(next);
  };

  const requestDisabled =
    role !== "RETAINER" ||
    !viewerRetainerId ||
    link?.requestedByRetainer ||
    link?.status === "ACTIVE";

  const tabs: Array<{ key: ProfileTabKey; label: string }> = [
    { key: "overview", label: role === "RETAINER" ? "Driver Snapshot" : "Overview" },
    { key: "workHistory", label: "Work History" },
    { key: "schedule", label: "Schedule" },
    { key: "photos", label: "Photos" },
    { key: "team", label: role === "RETAINER" ? "Team" : "Hierarchy" },
  ];

  const availability = normalizeWeeklyAvailability((seeker as any).availability);

  const subcontractors: any[] = Array.isArray((seeker as any).subcontractors)
    ? (seeker as any).subcontractors
    : [];
  const hierarchyItems = subcontractors.map((sub) => ({
    id: String(sub.id),
    name:
      `${sub.firstName ?? ""} ${sub.lastName ?? ""}`.trim() || "Subcontractor",
    title: typeof sub.title === "string" ? sub.title : undefined,
    meta:
      typeof sub.bio === "string"
        ? sub.bio
        : typeof sub.email === "string"
        ? sub.email
        : undefined,
    photoUrl: typeof sub.photoUrl === "string" ? sub.photoUrl : undefined,
  }));

  const hierarchyOwner = {
    id: seeker.id,
    name: fullName,
    title: company !== "—" ? company : "Master Seeker",
    meta: email !== "—" ? email : undefined,
    photoUrl: seekerPhotoUrl,
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-50 overflow-hidden" style={{ zoom: 1.1, height: "calc(100vh / 1.1)", width: "calc(100vw / 1.1)" }}>
      <div className="p-6 h-full overflow-hidden">
        <div className="max-w-3xl mx-auto w-full h-full overflow-hidden flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={handleBack} className="btn">
          {backLabel}
        </button>

        {role === "RETAINER" && status === "APPROVED" && (
          <div className="flex items-center gap-2">
            {!isLinked && (
              <button
                type="button"
                className="btn"
                onClick={handleRequestLink}
                disabled={requestDisabled}
              >
                {link?.requestedByRetainer ? "Link Requested" : "Request Link"}
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
              <Avatar url={seekerPhotoUrl} name={fullName} />
              <div>
                <div className="text-xs uppercase tracking-wide text-white/60">
                  Seeker
                </div>
                <h1 className="text-3xl font-bold mt-1">{fullName}</h1>
                <div className="text-sm text-white/70 mt-1">ZIP {zip}</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Pill tone="neutral" label={status === "APPROVED" ? "Approved" : status} />
                  {isLinked && <Pill tone="neutral" label="Linked" />}
                  {!isLinked && canSeeLinkedOnly && role !== "ADMIN" && (
                    <Pill tone="neutral" label="Linked view unlocked" />
                  )}
                  {role && role !== "ADMIN" && <Pill tone="subtle" label={`Viewing as ${role}`} />}
                  {showExitSignals && noticeSummary.count > 0 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] bg-amber-500/10 border-amber-500/30 text-amber-100">
                      {noticeLabel}
                    </span>
                  )}
                  {showExitSignals && badExitSummary.count > 0 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] bg-rose-500/10 border-rose-500/30 text-rose-100">
                      {badExitLabel}
                    </span>
                  )}
                </div>

                {(badgeSummary.length > 0 || trust.total > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {trust.total > 0 && (
                      <Link
                        to="/seekers"
                        state={badgeLinkState}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                        title="Trust rating is a lifetime average across linked-only badge confirmations."
                      >
                        <span className="text-emerald-200">
                          {badgeIconFor("star", "h-5 w-5")}
                        </span>
                        <span className="font-semibold">Trust</span>
                        <span className="text-slate-200">
                          {trust.percent == null ? "—" : `${trust.percent}%`}
                        </span>
                        <span className="text-slate-500">
                          ({trust.total})
                        </span>
                      </Link>
                    )}

                    {badgeSummary.map((b) => (
                      <Link
                        key={b.badge.id}
                        to="/seekers"
                        state={badgeLinkState}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                        title={b.badge.description}
                      >
                        <span className="text-emerald-200">
                          {badgeIconFor(b.badge.iconKey, "h-5 w-5")}
                        </span>
                        <span className="font-semibold">{b.badge.title}</span>
                        <span className="text-slate-400">Lv {b.maxLevel}</span>
                        {b.trustPercent != null && (
                          <span className="text-slate-500">{b.trustPercent}%</span>
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
                      <KeyValue label="Company" value={company} />
                      <KeyValue
                        label="Location"
                        value={
                          city !== "—" || state !== "—"
                            ? `${city}, ${state} • ZIP ${zip}`
                            : `ZIP ${zip}`
                        }
                      />
                      <KeyValue label="Email" value={email} />
                      <KeyValue label="Phone" value={phone} />
                      <KeyValue label="Vehicle" value={vehicle} />
                      <KeyValue label="Insurance" value={insurance} />
                    </div>
                    {notes?.trim() && (
                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                        <div className="text-[11px] text-slate-400">Bio</div>
                        <div className="text-sm text-slate-100 whitespace-pre-wrap">
                          {notes}
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

            {!canSeeLinkedOnly && (
              <LockedPanel
                title="Unlock full profile"
                description="After your video call, request a link to view work history, schedule, and more."
                actionLabel={
                  role === "RETAINER"
                    ? link?.requestedByRetainer
                      ? "Link Requested"
                      : "Request Link"
                    : undefined
                }
                onAction={role === "RETAINER" ? handleRequestLink : undefined}
                actionDisabled={requestDisabled}
              />
            )}
          </div>
        )}

        {activeTab === "workHistory" && (
          <div className="space-y-4">
            {!canSeeLinkedOnly ? (
              <LockedPanel
                title="Work history is linked-only"
                description="Link with this profile to view work history and experience."
                actionLabel={
                  role === "RETAINER"
                    ? link?.requestedByRetainer
                      ? "Link Requested"
                      : "Request Link"
                    : undefined
                }
                onAction={role === "RETAINER" ? handleRequestLink : undefined}
                actionDisabled={requestDisabled}
              />
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Work History
                </div>
                <div className="mt-2 text-sm text-slate-300">
                  {(seeker as any).workHistory ? (
                    <div className="whitespace-pre-wrap text-slate-100">
                      {String((seeker as any).workHistory)}
                    </div>
                  ) : (
                    <div>No work history has been added yet.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="space-y-4">
            {!canSeeLinkedOnly ? (
              <LockedPanel
                title="Schedule is linked-only"
                description="Link with this profile to view weekly availability and schedule details."
                actionLabel={
                  role === "RETAINER"
                    ? link?.requestedByRetainer
                      ? "Link Requested"
                      : "Request Link"
                    : undefined
                }
                onAction={role === "RETAINER" ? handleRequestLink : undefined}
                actionDisabled={requestDisabled}
              />
            ) : (
              <AvailabilityCard availability={availability} />
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
                  role === "RETAINER"
                    ? link?.requestedByRetainer
                      ? "Link Requested"
                      : "Request Link"
                    : undefined
                }
                onAction={role === "RETAINER" ? handleRequestLink : undefined}
                actionDisabled={requestDisabled}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <ImageCard title="Profile Photo" url={seekerPhotoUrl} />
                {vehiclePhotoUrls.map((p) => (
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
                description="Link with this profile to view subcontractors and the hierarchy chart."
                actionLabel={
                  role === "RETAINER"
                    ? link?.requestedByRetainer
                      ? "Link Requested"
                      : "Request Link"
                    : undefined
                }
                onAction={role === "RETAINER" ? handleRequestLink : undefined}
                actionDisabled={requestDisabled}
              />
            ) : hierarchyItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
                No subcontractors have been added yet.
              </div>
            ) : (
              <HierarchyCanvas
                owner={hierarchyOwner}
                items={hierarchyItems}
                nodes={(seeker as any).hierarchyNodes ?? []}
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

function AvailabilityCard({ availability }: { availability: WeeklyAvailability | null }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        Weekly Availability
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DAYS.map((d) => {
          const blocks = availability?.blocks?.filter((b) => b.day === d.key) ?? [];
          return (
            <div
              key={d.key}
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              <div className="text-[11px] text-slate-400">{d.label}</div>
              <div className="text-sm text-slate-100 mt-0.5">
                {blocks.length === 0 ? (
                  <span className="text-slate-500">No availability</span>
                ) : (
                  blocks.map((b, idx) => (
                    <div key={`${b.day}-${idx}`}>
                      {b.start}–{b.end}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      {availability?.timezone && (
        <div className="mt-3 text-xs text-slate-500">
          Timezone: {availability.timezone}
        </div>
      )}
      {!availability && (
        <div className="mt-3 text-sm text-slate-400">
          No availability has been set.
        </div>
      )}
    </div>
  );
}
