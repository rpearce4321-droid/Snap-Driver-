// src/components/BadgesCenter.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Seeker, Retainer } from "../lib/data";
import { getSeekers, getRetainers } from "../lib/data";
import {
  getLinksForSeeker,
  getLinksForRetainer,
  isWorkingTogether,
  setWorkingTogether,
  type Link,
} from "../lib/linking";
import { badgeIconFor } from "./badgeIcons";
import {
  computeBadgeProgressToNext,
  getActiveBadges,
  getBackgroundBadges,
  getBackgroundLockStatus,
  getBadgeDefinition,
  getBadgeProgress,
  getCheckinForPeriod,
  getCheckerBadges,
  getCurrentMonthKey,
  getCurrentPeriodKey,
  getCurrentWeekKey,
  getBadgeScoreSnapshot,
  getBadgeKindWeight,
  getBadgeLevelMultipliers,
  getBadgeWeight,
  getPendingBadgeApprovalsForProfile,
  getSelectableBadges,
  getSelectedBackgroundBadges,
  getSnapBadges,
  getTrustRatingForProfile,
  grantSnapBadge,
  MAX_ACTIVE_BADGES,
  MAX_BACKGROUND_BADGES,
  setActiveBadges,
  setBackgroundBadges,
  submitWeeklyCheckin,
  type BadgeDefinition,
  type BadgeOwnerRole,
  type BadgeId,
  type BadgeCheckinValue,
} from "../lib/badges";

type Props = {
  role: BadgeOwnerRole; // "SEEKER" | "RETAINER"
  ownerId: string | null; // current acting-as main profile id (not sub-user)
  readOnly?: boolean;
};

function shortName(role: BadgeOwnerRole, record: any): string {
  if (role === "SEEKER") {
    const first = record?.firstName ?? "";
    const last = record?.lastName ?? "";
    return `${first} ${last}`.trim() || "Seeker";
  }
  return record?.companyName || record?.name || "Retainer";
}

function iconFor(key: string): React.ReactNode {
  const cls = "h-full w-full";
  switch (key) {
    case "moon":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M15.5 2.5c-3 1.2-5 4.1-5 7.5 0 4.5 3.6 8.1 8.1 8.1 1.2 0 2.3-.2 3.4-.7-1.3 3-4.2 5.1-7.7 5.1-4.7 0-8.5-3.8-8.5-8.5 0-3.9 2.6-7.2 6.2-8.2Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "bolt":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M13 2 3 14h7l-1 8 12-14h-7l-1-6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "wrench":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M21 7a6 6 0 0 1-8.6 5.4L7.5 17.3a2 2 0 0 1-2.8 0l-.9-.9a2 2 0 0 1 0-2.8l4.9-4.9A6 6 0 0 1 17 3l-3 3 4 4 3-3Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12 6v6l4 2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M12 2 20 6v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "chat":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M4 5h16v11H7l-3 3V5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M7 9h10M7 12h7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "cash":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M3 7h18v10H3V7Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M6 10a2 2 0 0 0 2-2M18 14a2 2 0 0 0-2 2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="m6 12 4 4 8-8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      );
    case "route":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M8 8h5a4 4 0 0 1 4 4v2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "clipboard":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M9 3h6v3H9V3Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M7 5H5v16h14V5h-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M8 10h8M8 14h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "lifebuoy":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12 16a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M4.9 4.9 8 8m8 8 3.1 3.1M19.1 4.9 16 8M8 16 4.9 19.1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "scales":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M12 3v18"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M5 6h14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M7 6 4 12h6L7 6Zm10 0-3 6h6l-3-6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M8 21h8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return badgeIconFor(key, cls);
  }
}

function ProgressBar({
  percent,
  previousPercent,
  nextPercent,
}: {
  percent: number;
  previousPercent?: number | null;
  nextPercent?: number | null;
}) {
  const clamp = (value?: number | null) => {
    if (value == null || Number.isNaN(value)) return null;
    return Math.max(0, Math.min(100, Math.round(value)));
  };
  const p = clamp(percent) ?? 0;
  const prev = clamp(previousPercent);
  const next = clamp(nextPercent);
  return (
    <div className="relative h-2 w-full rounded-full bg-slate-800 overflow-hidden">
      <div className="h-full bg-emerald-500/80" style={{ width: `${p}%` }} />
      {prev != null && (
        <span
          className="absolute -top-1 -bottom-1 w-3 rounded-full bg-slate-400/30 border border-slate-400/60"
          style={{ left: `${prev}%`, transform: "translateX(-50%)" }}
        />
      )}
      {next != null && (
        <span
          className="absolute -top-1 -bottom-1 w-3 rounded-full bg-amber-300/25 border border-amber-300/60"
          style={{ left: `${next}%`, transform: "translateX(-50%)" }}
        />
      )}
    </div>
  );
}

function TogglePill(props: {
  label: string;
  on: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "px-2.5 py-1 rounded-full border text-[11px] transition",
        props.on
          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10",
        props.disabled ? "opacity-60 cursor-not-allowed" : "",
      ].join(" ")}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.label}
    </button>
  );
}

function YesNoButtons(props: {
  value: BadgeCheckinValue | null;
  onYes: () => void;
  onNo: () => void;
  disabled?: boolean;
}) {
  const base =
    "px-3 py-1 rounded-full text-[11px] font-medium border transition";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={[
          base,
          props.value === "YES"
            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-100"
            : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
        ].join(" ")}
        onClick={props.onYes}
        disabled={props.disabled}
      >
        Yes
      </button>
      <button
        type="button"
        className={[
          base,
          props.value === "NO"
            ? "bg-rose-500/15 border-rose-500/40 text-rose-100"
            : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
        ].join(" ")}
        onClick={props.onNo}
        disabled={props.disabled}
      >
        No
      </button>
    </div>
  );
}

export default function BadgesCenter({ role, ownerId, readOnly = false }: Props) {
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<"home" | "actions" | "catalog">("home");

  const weekKey = useMemo(() => getCurrentWeekKey(), []);
  const monthKey = useMemo(() => getCurrentMonthKey(), []);

  const [editingBackground, setEditingBackground] = useState(false);
  const [draftBackgroundIds, setDraftBackgroundIds] = useState<BadgeId[]>([]);
  const [queueFilter, setQueueFilter] = useState<
    "ALL" | "BACKGROUND" | "SELECTABLE" | "CHECKER"
  >("ALL");

  useEffect(() => {
    if (!editingBackground) {
      setDraftBackgroundIds(ownerId ? getSelectedBackgroundBadges(role, ownerId) : []);
    }
  }, [editingBackground, ownerId, role, tick]);

  const allSeekers = useMemo<Seeker[]>(() => getSeekers(), [tick]);
  const allRetainers = useMemo<Retainer[]>(() => getRetainers(), [tick]);

  const ownerName = useMemo(() => {
    if (!ownerId) return role === "SEEKER" ? "Seeker" : "Retainer";
    if (role === "SEEKER") {
      const s = allSeekers.find((x) => x.id === ownerId);
      return shortName("SEEKER", s);
    }
    const r = allRetainers.find((x) => x.id === ownerId);
    return shortName("RETAINER", r);
  }, [allRetainers, allSeekers, ownerId, role]);

  const myBadgeDefs = useMemo(() => getSelectableBadges(role), [role]);
  const backgroundOptions = useMemo(() => getBackgroundBadges(role), [role]);
  const selectedBackgroundIds = useMemo(
    () => (ownerId ? getSelectedBackgroundBadges(role, ownerId) : []),
    [ownerId, role, tick]
  );
  const selectedBackgroundBadges = useMemo(() => {
    if (!ownerId) return [];
    return selectedBackgroundIds
      .map((id) => getBadgeDefinition(id))
      .filter((b): b is BadgeDefinition => !!b);
  }, [selectedBackgroundIds, ownerId]);

  const snapBadges = useMemo(() => getSnapBadges(role), [role]);
  const checkerBadges = useMemo(() => getCheckerBadges(role), [role]);

  const renderCatalogList = (items: BadgeDefinition[], label: string) => {
    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-100">{label}</div>
        {items.length === 0 ? (
          <div className="text-xs text-slate-500">No badges in this group yet.</div>
        ) : (
          <div className="space-y-2">
            {items.map((b) => {
              const cadenceLabel =
                b.cadence === "MONTHLY"
                  ? "Monthly"
                  : b.cadence === "ONCE"
                  ? "One-time"
                  : "Weekly";
              const weight = getBadgeWeight(b.id);
              const kindWeight = getBadgeKindWeight(b.kind);
              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 flex gap-3"
                >
                  <div className="h-10 w-10 rounded-xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100">
                    {iconFor(b.iconKey)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {b.title}
                      </div>
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">
                        {cadenceLabel}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">
                        Weight {weight}x
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">
                        Kind {kindWeight}x
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{b.description}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{b.howToEarn}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const scoreSnapshot = useMemo(() => getBadgeScoreSnapshot(), [tick]);
  const levelMultipliers = useMemo(() => getBadgeLevelMultipliers(), [tick]);
  const kindWeights = useMemo(() => ({
    BACKGROUND: getBadgeKindWeight("BACKGROUND"),
    SELECTABLE: getBadgeKindWeight("SELECTABLE"),
    SNAP: getBadgeKindWeight("SNAP"),
    CHECKER: getBadgeKindWeight("CHECKER"),
  }), [tick]);

  const backgroundLock = useMemo(() => {
    if (!ownerId) return { lockedUntil: null as string | null, isLocked: false };
    return getBackgroundLockStatus(role, ownerId);
  }, [ownerId, role, tick]);

  const myActiveBadgeIds = useMemo(
    () => (ownerId ? getActiveBadges(role, ownerId) : []),
    [ownerId, role, tick]
  );

  const myActiveBadges = useMemo(() => {
    if (!ownerId) return [];
    return myActiveBadgeIds
      .map((id) => getBadgeDefinition(id))
      .filter((b): b is BadgeDefinition => !!b);
  }, [myActiveBadgeIds, ownerId]);

  const links = useMemo<Link[]>(() => {
    if (!ownerId) return [];
    return role === "SEEKER" ? getLinksForSeeker(ownerId) : getLinksForRetainer(ownerId);
  }, [ownerId, role, tick]);

  const activeLinks = useMemo(
    () => links.filter((l) => l.status === "ACTIVE"),
    [links]
  );

  const verifierRole: BadgeOwnerRole = role === "SEEKER" ? "SEEKER" : "RETAINER";
  const counterpartRole: BadgeOwnerRole = role === "SEEKER" ? "RETAINER" : "SEEKER";

  const myTrust = useMemo(() => {
    if (!ownerId) return { percent: null as number | null, yes: 0, no: 0, total: 0 };
    return getTrustRatingForProfile({ ownerRole: role, ownerId });
  }, [ownerId, role, tick]);

  const pending = useMemo(
    () =>
      ownerId
        ? getPendingBadgeApprovalsForProfile({ ownerRole: role, ownerId })
        : { count: 0, items: [] },
    [ownerId, role, tick]
  );

  type PendingItem = (typeof pending.items)[number] & { def: BadgeDefinition };

  const pendingItems = useMemo(() => {
    return pending.items
      .map((item) => {
        const def = getBadgeDefinition(item.badgeId);
        if (!def) return null;
        return { ...item, def };
      })
      .filter(Boolean) as PendingItem[];
  }, [pending.items]);

  const filteredPending = useMemo(() => {
    if (queueFilter === "ALL") return pendingItems;
    return pendingItems.filter((item) => item.def.kind === queueFilter);
  }, [pendingItems, queueFilter]);
  const setMyActive = (nextIds: BadgeId[]) => {
    if (!ownerId || readOnly) return;
    setActiveBadges(role, ownerId, nextIds);
    setTick((t) => t + 1);
  };

  const toggleMyActive = (badgeId: BadgeId) => {
    if (!ownerId || readOnly) return;
    const has = myActiveBadgeIds.includes(badgeId);
    if (has) setMyActive(myActiveBadgeIds.filter((x) => x !== badgeId));
    else setMyActive([...myActiveBadgeIds, badgeId]);
  };

  const canEditBackground = !readOnly && !backgroundLock.isLocked;

  const toggleDraftBackground = (badgeId: BadgeId) => {
    if (!canEditBackground) return;
    setDraftBackgroundIds((prev) => {
      const has = prev.includes(badgeId);
      if (has) return prev.filter((id) => id !== badgeId);
      if (prev.length >= MAX_BACKGROUND_BADGES) return prev;
      return [...prev, badgeId];
    });
  };

  const saveBackgroundSelection = () => {
    if (!ownerId || !canEditBackground) return;
    if (draftBackgroundIds.length !== MAX_BACKGROUND_BADGES) return;
    setBackgroundBadges(role, ownerId, draftBackgroundIds);
    setEditingBackground(false);
    setTick((t) => t + 1);
  };

  const cancelBackgroundSelection = () => {
    setEditingBackground(false);
    setDraftBackgroundIds(selectedBackgroundIds);
  };

  const completeSnapBadge = (badgeId: BadgeId) => {
    if (!ownerId || readOnly) return;
    grantSnapBadge(role, ownerId, badgeId);
    setTick((t) => t + 1);
  };

  const approvePending = (items: PendingItem[], value: BadgeCheckinValue) => {
    if (!ownerId || readOnly) return;
    if (items.length === 0) return;
    for (const item of items) {
      const link = links.find((l) => l.id === item.linkId);
      if (!link) continue;
      submit({
        link,
        badgeId: item.badgeId,
        targetId: item.targetId,
        value,
        cadence: item.cadence,
        periodKey: item.periodKey,
      });
    }
  };

  const setWorking = (link: Link, value: boolean) => {
    if (!ownerId || readOnly) return;
    const by = role;
    setWorkingTogether({
      seekerId: link.seekerId,
      retainerId: link.retainerId,
      by,
      value,
    });
    setTick((t) => t + 1);
  };

  const submit = (args: {
    link: Link;
    badgeId: BadgeId;
    targetId: string;
    value: BadgeCheckinValue;
    cadence?: "WEEKLY" | "MONTHLY" | "ONCE";
    periodKey?: string;
  }) => {
    if (!ownerId || readOnly) return;
    const cadence = args.cadence ?? "WEEKLY";
    const periodKey = args.periodKey ?? getCurrentPeriodKey(cadence);
    submitWeeklyCheckin({
      badgeId: args.badgeId,
      seekerId: args.link.seekerId,
      retainerId: args.link.retainerId,
      targetRole: counterpartRole,
      targetId: args.targetId,
      verifierRole,
      verifierId: ownerId,
      weekKey: periodKey,
      cadence,
      value: args.value,
    });
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">Badges</h3>
            <p className="text-sm text-slate-300">
              Badges capture expectations and optional strengths through linked-only check-ins.
            </p>
            <div className="mt-2 text-xs text-slate-400 space-y-1">
              <div>
                <span className="text-slate-300">Why:</span> give partners a clear trust signal without long back-and-forth.
              </div>
              <div>
                <span className="text-slate-300">How:</span> linked profiles answer quick yes/no prompts each cycle; trends update your rating.
              </div>
            </div>
            {readOnly && (
              <p className="text-xs text-amber-300 mt-1">
                View-only: badge selection and check-ins are disabled.
              </p>
            )}
          </div>
          <div className="text-xs text-slate-400">
            Week: <span className="text-slate-200">{weekKey}</span> / Month: <span className="text-slate-200">{monthKey}</span> / {" "}
            <span className="text-slate-200">{pending.count}</span> check-in
            {pending.count === 1 ? "" : "s"} due
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("home")}
          className={["px-3 py-1.5 rounded-full text-sm border transition", tab === "home" ? "bg-white/15 border-white/30 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"].join(" ")}
        >
          Badge Home
        </button>
        <button
          type="button"
          onClick={() => setTab("actions")}
          className={["px-3 py-1.5 rounded-full text-sm border transition", tab === "actions" ? "bg-white/15 border-white/30 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"].join(" ")}
        >
          Action Center
        </button>
        <button
          type="button"
          onClick={() => setTab("catalog")}
          className={["px-3 py-1.5 rounded-full text-sm border transition", tab === "catalog" ? "bg-white/15 border-white/30 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"].join(" ")}
        >
          Catalog
        </button>
      </div>

      {!ownerId ? (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
          Select a profile first to view badges.
        </div>
      ) : (
        <div className="space-y-6">
        {tab === "home" && (
          <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Badge Home</div>
              <div className="text-sm text-slate-200 mt-1">
                {ownerName} - {myActiveBadgeIds.length}/{MAX_ACTIVE_BADGES} foreground selected - {selectedBackgroundIds.length}/{MAX_BACKGROUND_BADGES} background set
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Trust Rating
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <div className="text-2xl font-semibold text-slate-50">
                  {myTrust.percent == null ? "--" : `${myTrust.percent}%`}
                </div>
                <div className="text-xs text-slate-500">
                  {myTrust.total} confirmation{myTrust.total === 1 ? "" : "s"}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                12-month weighted average across linked-only badge confirmations.
              </div>
            </div>

            {snapBadges.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Snap Badges
                </div>
                <div className="grid gap-2">
                  {snapBadges.map((b) => {
                    const p = getBadgeProgress(role, ownerId, b.id);
                    const earned = p.maxLevel > 0;
                    return (
                      <div
                        key={b.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="h-12 w-12 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100">
                              {iconFor(b.iconKey)}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-100">
                                {b.title}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {earned ? "Completed" : "Pending video"}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={readOnly || earned}
                            onClick={() => completeSnapBadge(b.id)}
                            className="px-2.5 py-1 rounded-full text-[11px] border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {earned ? "Completed" : "Mark complete"}
                          </button>
                        </div>
                        <div className="mt-3 text-xs text-slate-300">
                          {b.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {checkerBadges.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Compliance Badges
                </div>
                <div className="grid gap-2">
                  {checkerBadges.map((b) => {
                    const p = getBadgeProgress(role, ownerId, b.id);
                    const prog = computeBadgeProgressToNext(b, p);
                    const bar = prog.trustPercent ?? 0;
                    return (
                      <div
                        key={b.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="h-12 w-12 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100">
                              {iconFor(b.iconKey)}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-100">
                                {b.title}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                Level {p.maxLevel} -{" "}
                                {prog.trustPercent == null
                                  ? "No data yet"
                                  : `Trust ${prog.trustPercent}%`}
                                {" "}- {prog.totalConfirmations} confirmation
                                {prog.totalConfirmations === 1 ? "" : "s"}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">
                            Monthly
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          <ProgressBar percent={bar} />
                          {prog.nextRule ? (
                            <div className="text-[11px] text-slate-500">
                              Next level: {prog.nextRule.minPercent}% with{" "}
                              {prog.nextRule.minSamples}+ confirmations
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500">
                              Max level achieved.
                            </div>
                          )}
                        </div>
                        <div className="mt-3 text-xs text-slate-300 space-y-2">
                          <div>{b.description}</div>
                          <div className="text-[11px] text-slate-500">
                            {b.howToEarn}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-4">
                {backgroundOptions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Background Badges
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {selectedBackgroundIds.length}/{MAX_BACKGROUND_BADGES} selected
                      </div>
                    </div>
                    {backgroundLock.isLocked && backgroundLock.lockedUntil && (
                      <div className="text-[11px] text-amber-300">
                        Locked until{" "}
                        {new Date(backgroundLock.lockedUntil).toLocaleDateString()}
                      </div>
                    )}

                    {editingBackground ? (
                      <div className="space-y-2">
                        {backgroundOptions.map((b) => {
                          const selected = draftBackgroundIds.includes(b.id);
                          const full =
                            !selected && draftBackgroundIds.length >= MAX_BACKGROUND_BADGES;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              disabled={!canEditBackground || full}
                              onClick={() => toggleDraftBackground(b.id)}
                              className={[
                                "w-full text-left rounded-2xl border p-3 transition",
                                selected
                                  ? "border-emerald-500/60 bg-emerald-500/10"
                                  : "border-slate-800 bg-slate-950/40 hover:bg-slate-900/60",
                                !canEditBackground || full
                                  ? "opacity-60 cursor-not-allowed"
                                  : "",
                              ].join(" ")}
                            >
                              <div className="flex items-start gap-3">
                                <div className="h-12 w-12 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100">
                                  {iconFor(b.iconKey)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-100 truncate">
                                    {b.title}
                                  </div>
                                  <div className="text-xs text-slate-400 mt-0.5">
                                    {b.description}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-full text-[11px] border border-slate-700 text-slate-200 hover:bg-slate-800"
                            onClick={cancelBackgroundSelection}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!canEditBackground || draftBackgroundIds.length !== MAX_BACKGROUND_BADGES}
                            className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
                            onClick={saveBackgroundSelection}
                          >
                            Save selection
                          </button>
                        </div>
                      </div>
                    ) : selectedBackgroundBadges.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-5 text-sm text-slate-400">
                        Pick {MAX_BACKGROUND_BADGES} background badges to set expectations.
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {selectedBackgroundBadges.map((b) => {
                          const p = getBadgeProgress(role, ownerId, b.id);
                          const prog = computeBadgeProgressToNext(b, p);
                          const bar = prog.trustPercent ?? 0;
                          return (
                            <div
                              key={b.id}
                              className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <div className="h-12 w-12 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100">
                                    {iconFor(b.iconKey)}
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-slate-100">
                                      {b.title}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                      Level {p.maxLevel} -{" "}
                                      {prog.trustPercent == null
                                        ? "No data yet"
                                        : `Trust ${prog.trustPercent}%`}
                                      {" "}- {prog.totalConfirmations} confirmation
                                      {prog.totalConfirmations === 1 ? "" : "s"}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                                  Background
                                </span>
                              </div>
                              <div className="mt-3 space-y-2">
                                <ProgressBar percent={bar} />
                                {prog.nextRule ? (
                                  <div className="text-[11px] text-slate-500">
                                    Next level: {prog.nextRule.minPercent}% with{" "}
                                    {prog.nextRule.minSamples}+ confirmations
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-slate-500">
                                    Max level achieved.
                                  </div>
                                )}
                              </div>
                              <div className="mt-3 text-xs text-slate-300">
                                {b.description}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!editingBackground && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={!canEditBackground}
                          className="px-3 py-1.5 rounded-full text-[11px] border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={() => setEditingBackground(true)}
                        >
                          Edit selection
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Foreground Badges
                </div>
                {myActiveBadges.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-5 text-sm text-slate-400">
                    No active badges selected yet. Pick up to {MAX_ACTIVE_BADGES} from
                    the catalog below.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myActiveBadges.map((b) => {
                      const p = getBadgeProgress(role, ownerId, b.id);
                      const prog = computeBadgeProgressToNext(b, p);
                      const bar = prog.trustPercent ?? 0;
                      return (
                        <div
                          key={b.id}
                          className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="h-12 w-12 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100">
                                {iconFor(b.iconKey)}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-100">
                                  {b.title}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  Level {p.maxLevel} -{" "}
                                  {prog.trustPercent == null
                                    ? "No data yet"
                                    : `Trust ${prog.trustPercent}%`}
                                  {" "}- {prog.totalConfirmations} confirmation
                                  {prog.totalConfirmations === 1 ? "" : "s"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={readOnly}
                                className="px-2.5 py-1 rounded-full text-[11px] border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleMyActive(b.id);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            <ProgressBar percent={bar} />
                            {prog.nextRule ? (
                              <div className="text-[11px] text-slate-500">
                                Next level: {prog.nextRule.minPercent}% with{" "}
                                {prog.nextRule.minSamples}+ confirmations
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500">
                                Max level achieved.
                              </div>
                            )}
                          </div>
                          <div className="mt-3 text-xs text-slate-300 space-y-2">
                            <div>{b.description}</div>
                            <div className="text-[11px] text-slate-500">
                              {b.howToEarn}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {tab === "actions" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Approvals Queue
                </div>
                <div className="text-sm text-slate-200 mt-1">
                  {pending.count === 0
                    ? "All caught up on confirmations."
                    : `${pending.count} confirmation${pending.count === 1 ? "" : "s"} due across linked profiles.`}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Batch confirm to keep expectations moving without extra clicks.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <TogglePill
                  label="All"
                  on={queueFilter === "ALL"}
                  onClick={() => setQueueFilter("ALL")}
                />
                <TogglePill
                  label="Background"
                  on={queueFilter === "BACKGROUND"}
                  onClick={() => setQueueFilter("BACKGROUND")}
                />
                <TogglePill
                  label="Optional"
                  on={queueFilter === "SELECTABLE"}
                  onClick={() => setQueueFilter("SELECTABLE")}
                />
                <TogglePill
                  label="Checker"
                  on={queueFilter === "CHECKER"}
                  onClick={() => setQueueFilter("CHECKER")}
                />
              </div>

              {filteredPending.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-5 text-sm text-slate-400">
                  No approvals due for this view.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPending.map((item) => {
                    const link = links.find((l) => l.id === item.linkId);
                    if (!link) return null;
                    const target =
                      item.targetRole === "SEEKER"
                        ? allSeekers.find((s) => s.id === item.targetId)
                        : allRetainers.find((r) => r.id === item.targetId);
                    const targetName = shortName(item.targetRole, target);
                    const cadenceLabel =
                      item.cadence === "MONTHLY" ? "Monthly" : "Weekly";
                    const kindLabel =
                      item.def.kind === "SELECTABLE"
                        ? "Optional"
                        : item.def.kind === "CHECKER"
                        ? "Checker"
                        : "Background";

                    return (
                      <div
                        key={`${item.linkId}:${item.badgeId}:${item.periodKey}`}
                        className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="h-8 w-8 rounded-xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100">
                              {iconFor(item.def.iconKey)}
                            </span>
                            <div className="text-xs font-semibold text-slate-100 truncate">
                              {item.def.title}
                            </div>
                            <span className="text-[10px] uppercase tracking-wide text-slate-500">
                              {kindLabel}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400">
                            {targetName} • {cadenceLabel} • {item.periodKey}
                          </div>
                        </div>
                        <YesNoButtons
                          value={null}
                          disabled={readOnly}
                          onYes={() =>
                            submit({
                              link,
                              badgeId: item.badgeId,
                              targetId: item.targetId,
                              value: "YES",
                              cadence: item.cadence,
                              periodKey: item.periodKey,
                            })
                          }
                          onNo={() =>
                            submit({
                              link,
                              badgeId: item.badgeId,
                              targetId: item.targetId,
                              value: "NO",
                              cadence: item.cadence,
                              periodKey: item.periodKey,
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredPending.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-500">
                    {filteredPending.length} awaiting confirmation
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => approvePending(filteredPending, "YES")}
                      className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Approve all
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => approvePending(filteredPending, "NO")}
                      className="px-3 py-1.5 rounded-full text-[11px] border border-rose-500/40 text-rose-100 hover:bg-rose-500/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Mark issues
                    </button>
                  </div>
                </div>
              )}
            </section>
            <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Check-ins by Link
                </div>
                <div className="text-sm text-slate-200 mt-1">
                  Confirm progress for linked profiles you&apos;re working with.
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Not submitting is neutral, but check-ins keep trust data accurate.
                </div>
              </div>

              {activeLinks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-5 text-sm text-slate-400">
                  No active links yet. Once you link and enable “Working together”, you’ll
                  be able to verify badges here.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeLinks.map((link) => {
                    const counterpartId = role === "SEEKER" ? link.retainerId : link.seekerId;
                    const counterpart =
                      role === "SEEKER"
                        ? allRetainers.find((r) => r.id === counterpartId)
                        : allSeekers.find((s) => s.id === counterpartId);
                    const counterpartName = shortName(counterpartRole, counterpart);

                    const theirActive = getActiveBadges(counterpartRole, counterpartId);
                    const theirBackground = getSelectedBackgroundBadges(
                      counterpartRole,
                      counterpartId
                    );
                    const checkerIds = getCheckerBadges(counterpartRole).map((b) => b.id);
                    const allIds = Array.from(
                      new Set([...theirBackground, ...theirActive, ...checkerIds])
                    );
                    const verifyable = allIds
                      .map((id) => getBadgeDefinition(id))
                      .filter((b): b is BadgeDefinition => !!b)
                      .filter(
                        (b) => b.verifierRole === verifierRole && b.cadence !== "ONCE"
                      );

                    const myWorkFlag =
                      role === "SEEKER"
                        ? link.workingTogetherBySeeker
                        : link.workingTogetherByRetainer;
                    const theirWorkFlag =
                      role === "SEEKER"
                        ? link.workingTogetherByRetainer
                        : link.workingTogetherBySeeker;

                    return (
                      <div
                        key={link.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-100">
                              {counterpartName}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Link: {link.id}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <TogglePill
                              label={myWorkFlag ? "You: Working" : "You: Not working"}
                              on={myWorkFlag}
                              onClick={() => setWorking(link, !myWorkFlag)}
                              disabled={readOnly}
                            />
                            <TogglePill
                              label={theirWorkFlag ? "Them: Working" : "Them: Not working"}
                              on={theirWorkFlag}
                              disabled
                            />
                            <TogglePill
                              label={isWorkingTogether(link) ? "Working Together" : "Not active"}
                              on={isWorkingTogether(link)}
                              disabled
                            />
                          </div>
                        </div>

                        {!isWorkingTogether(link) ? (
                          <div className="text-sm text-slate-400">
                            Enable “Working together” (both sides) to submit check-ins.
                          </div>
                        ) : verifyable.length === 0 ? (
                          <div className="text-sm text-slate-400">
                            No badges available to verify for this profile yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {verifyable.map((b) => {
                              const cadence = b.cadence ?? "WEEKLY";
                              const periodKey = getCurrentPeriodKey(cadence);
                              const existing = getCheckinForPeriod({
                                periodKey,
                                cadence,
                                badgeId: b.id,
                                targetRole: counterpartRole,
                                targetId: counterpartId,
                                verifierRole,
                                verifierId: ownerId,
                                seekerId: link.seekerId,
                                retainerId: link.retainerId,
                              });
                              const cadenceLabel =
                                cadence === "MONTHLY" ? "Monthly" : "Weekly";
                              const kindLabel =
                                b.kind === "SELECTABLE"
                                  ? "Optional"
                                  : b.kind === "CHECKER"
                                  ? "Checker"
                                  : "Background";

                              return (
                                <div
                                  key={b.id}
                                  className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 flex items-start justify-between gap-3"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="h-5 w-5 text-slate-100 flex items-center justify-center">
                                        {iconFor(b.iconKey)}
                                      </span>
                                      <div className="text-xs font-semibold text-slate-100 truncate">
                                        {b.title}
                                      </div>
                                      <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                        {kindLabel}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-400">
                                      {b.weeklyPrompt}
                                    </div>
                                    <div className="mt-1 text-[10px] text-slate-500">
                                      {cadenceLabel} • {periodKey}
                                    </div>
                                  </div>
                                  <YesNoButtons
                                    value={existing?.value ?? null}
                                    disabled={readOnly}
                                    onYes={() =>
                                      submit({
                                        link,
                                        badgeId: b.id,
                                        targetId: counterpartId,
                                        value: "YES",
                                        cadence,
                                        periodKey,
                                      })
                                    }
                                    onNo={() =>
                                      submit({
                                        link,
                                        badgeId: b.id,
                                        targetId: counterpartId,
                                        value: "NO",
                                        cadence,
                                        periodKey,
                                      })
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
          )}

          {tab === "catalog" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Badge Catalog</div>
                <div className="text-sm text-slate-200 mt-1">
                  Why: show trust fast with linked-only check-ins. How: choose expectations, keep check-ins current, and let optional badges highlight strengths.
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  This page explains selection rules, weights, and how scores are calculated.
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    For the Math Nerds
                  </div>
                  <div className="text-sm text-slate-200 mt-2">
                    Trust = Expectations 65% + Growth 35%
                  </div>
                  <ul className="mt-2 text-[11px] text-slate-400 space-y-1">
                    <li>Expectations = background + Snap + checker</li>
                    <li>Growth = optional foreground badges</li>
                    <li>Per badge score = weight x level multiplier</li>
                    <li>Rolling 12-month window; disputed check-ins are excluded until resolved</li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    For the Readers
                  </div>
                  <div className="text-sm text-slate-200 mt-2">
                    Expectations drive most of your rating. Optional badges add lift, but only linked check-ins count. Scores smooth over time, so one bad check-in is a dent, not a cliff.
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    Keep check-ins current to reflect reality. Disputes can be reviewed by Snap admin when needed.
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    For the Doers
                  </div>
                  <ul className="mt-2 text-[11px] text-slate-400 space-y-1">
                    <li>Confirm badges on time each cycle</li>
                    <li>Choose expectations you can deliver every week</li>
                    <li>Use exception reporting early to protect trends</li>
                    <li>Keep Snap and checker badges current</li>
                  </ul>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Selection Process</div>
                  <ul className="mt-2 text-[11px] text-slate-400 space-y-1">
                    <li>Select up to {MAX_ACTIVE_BADGES} foreground badges at a time.</li>
                    <li>Choose {MAX_BACKGROUND_BADGES} background badges; locked for 12 months.</li>
                    <li>Check-ins are weekly or monthly based on badge cadence.</li>
                  </ul>
                </div>
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Weight Breakdown</div>
                  <div className="text-sm text-slate-200 mt-2">
                    Expectations {Math.round(scoreSnapshot.expectationsWeight * 100)}% / Growth {Math.round(scoreSnapshot.growthWeight * 100)}%
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    Background {kindWeights.BACKGROUND}x, Snap {kindWeights.SNAP}x, Checker {kindWeights.CHECKER}x, Foreground {kindWeights.SELECTABLE}x
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Level multipliers: {levelMultipliers.join(", ")}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {renderCatalogList(snapBadges, "Snap Badges")}
                {renderCatalogList(checkerBadges, "Compliance / Checker")}
                {renderCatalogList(backgroundOptions, "Background (Expectations)")}
                {renderCatalogList(myBadgeDefs, "Foreground (Optional)")}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
