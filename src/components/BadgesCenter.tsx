// src/components/BadgesCenter.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  getBadgeCheckins,
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
  getBadgeReputationScore,
  getReputationScoreForProfile,
  getReputationScoreHistory,
  getReputationScoreForProfileAtDate,
  getBadgeSelectionCaps,
  REPUTATION_SCORE_WINDOW_DAYS,
  REPUTATION_SCORE_MIN,
  REPUTATION_SCORE_MAX,
  REPUTATION_PENALTY_K,
  grantSnapBadge,
  setActiveBadges,
  setBackgroundBadges,
  submitWeeklyCheckin,
  type BadgeDefinition,
  type BadgeOwnerRole,
  type BadgeId,
  type BadgeCheckinValue,
  type BadgeCadence,
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

function formatScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "--";
  return String(Math.round(score));
}

function formatMonthLabel(dateValue: string | Date): string {
  const dt = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("en-US", { month: "short" });
}

function isWithinDays(dateIso: string, days: number): boolean {
  const ts = Date.parse(dateIso);
  if (!Number.isFinite(ts)) return false;
  const cutoff = Date.now() - days * 86_400_000;
  return ts >= cutoff;
}

function getScoreDeltaMeta(currentScore: number, previousScore: number | null) {
  if (previousScore == null || Number.isNaN(previousScore)) {
    return { diff: 0, arrows: 0, direction: "flat" as const };
  }
  const diff = Math.round(currentScore - previousScore);
  const abs = Math.abs(diff);
  const arrows = abs >= 40 ? 3 : abs >= 20 ? 2 : abs >= 5 ? 1 : 0;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  return { diff, arrows, direction };
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
  const [tab, setTab] = useState<"home" | "actions" | "catalog" | "history" | "record">("home");

  const openCatalog = (event?: React.SyntheticEvent) => {
    if (event) event.stopPropagation();
    setTab("catalog");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartPadding = 12;

  const weekKey = useMemo(() => getCurrentWeekKey(), []);
  const monthKey = useMemo(() => getCurrentMonthKey(), []);

  const [editingBackground, setEditingBackground] = useState(false);
  const [draftBackgroundIds, setDraftBackgroundIds] = useState<BadgeId[]>([]);
  const [queueFilter] = useState<
    "ALL" | "BACKGROUND" | "SELECTABLE" | "CHECKER"
  >("ALL");
  const [plannerYesRate, setPlannerYesRate] = useState(85);
  const [plannerLevel, setPlannerLevel] = useState(3);
  const [plannerWindowDays, setPlannerWindowDays] = useState(90);
  const [plannerConfirmations, setPlannerConfirmations] = useState(6);
  const [recordQueryDate, setRecordQueryDate] = useState("");
  const [recordWindowDays, setRecordWindowDays] = useState(90);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!editingBackground) {
      setDraftBackgroundIds(ownerId ? getSelectedBackgroundBadges(role, ownerId) : []);
    }
  }, [editingBackground, ownerId, role, tick]);

  useEffect(() => {
    const node = chartRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setChartSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };
    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, [tab]);

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
  const mandatoryBackgroundIds = useMemo(
    () => backgroundOptions.filter((b) => b.isMandatory).map((b) => b.id),
    [backgroundOptions]
  );
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
                  <button
                    type="button"
                    onClick={openCatalog}
                    aria-label="Open badge catalog"
                    className="h-10 w-10 rounded-xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100 cursor-pointer"
                  >
                    {iconFor(b.iconKey)}
                  </button>
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

  const badgeCaps = useMemo(
    () => (ownerId ? getBadgeSelectionCaps(role, ownerId) : { tier: 1, active: 1, background: 1 }),
    [ownerId, role, tick]
  );

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

  const myReputation = useMemo(() => {
    if (!ownerId) {
      return { score: null, scorePercent: null, yes: 0, no: 0, total: 0 };
    }
    return getReputationScoreForProfile({ ownerRole: role, ownerId });
  }, [ownerId, role, tick]);

  const currentScore = useMemo(
    () => (myReputation.score == null ? null : Math.round(myReputation.score)),
    [myReputation.score]
  );

  const scoreHistory = useMemo(() => {
    if (!ownerId) return [];
    const entries = getReputationScoreHistory({
      ownerRole: role,
      ownerId,
    });
    return entries.flatMap((entry) => {
      const computed = getReputationScoreForProfileAtDate({
        ownerRole: role,
        ownerId,
        asOf: new Date(entry.createdAt),
      });
      if (computed.score == null) return [];
      return [{ ...entry, score: computed.score }];
    });
  }, [ownerId, role, tick]);

  const scoreHistorySorted = useMemo(() => {
    return [...scoreHistory].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [scoreHistory]);


  const scoreHistoryLayout = useMemo(() => {
    if (scoreHistorySorted.length === 0) return null;
    if (chartSize.width <= 0 || chartSize.height <= 0) return null;
    const firstDate = new Date(scoreHistorySorted[0].createdAt);
    if (Number.isNaN(firstDate.getTime())) return null;
    const startMonth = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    const endMonth = new Date(startMonth.getFullYear(), startMonth.getMonth() + 12, 1);
    const startTs = startMonth.getTime();
    const endTs = endMonth.getTime();
    const spanTs = Math.max(1, endTs - startTs);
    const xSpan = Math.max(1, chartSize.width - chartPadding * 2);
    const ySpan = Math.max(1, chartSize.height - chartPadding * 2);
    const yTop = chartPadding;
    const yBottom = chartPadding + ySpan;
    const yMid = yTop + ySpan / 2;
    return {
      startMonth,
      startTs,
      endTs,
      spanTs,
      width: chartSize.width,
      height: chartSize.height,
      xLeft: chartPadding,
      xSpan,
      yTop,
      yMid,
      yBottom,
      ySpan,
    };
  }, [chartSize.height, chartSize.width, chartPadding, scoreHistorySorted]);

  const scoreHistoryLine = useMemo(() => {
    if (!scoreHistoryLayout) return { points: [], polyline: "" };
    const span = REPUTATION_SCORE_MAX - REPUTATION_SCORE_MIN;
    const { startTs, spanTs, xLeft, xSpan, yBottom, ySpan } = scoreHistoryLayout;
    const count = scoreHistorySorted.length;
    const points = scoreHistorySorted.map((entry, idx) => {
      const entryTs = Date.parse(entry.createdAt);
      const ratioX = Number.isFinite(entryTs)
        ? (entryTs - startTs) / spanTs
        : count === 1
        ? 0.5
        : idx / (count - 1);
      const x = xLeft + Math.max(0, Math.min(1, ratioX)) * xSpan;
      const ratio = span > 0 ? (entry.score - REPUTATION_SCORE_MIN) / span : 0;
      const clamped = Math.max(0, Math.min(1, ratio));
      const y = yBottom - clamped * ySpan;
      return { x, y, entry };
    });
    const polyline = points.map((p) => String(p.x) + "," + String(p.y)).join(" ");
    return { points, polyline };
  }, [scoreHistoryLayout, scoreHistorySorted]);

  const scoreHistoryMonths = useMemo(() => {
    if (!scoreHistoryLayout) return [] as Array<{ label: string; x: number }>;
    const { startMonth, startTs, spanTs, xLeft, xSpan, width } = scoreHistoryLayout;
    const months: Array<{ label: string; x: number }> = [];
    const cursor = new Date(startMonth.getTime());
    for (let i = 0; i < 12; i++) {
      const label = formatMonthLabel(cursor);
      const ratio = (cursor.getTime() - startTs) / spanTs;
      const raw = xLeft + Math.max(0, Math.min(1, ratio)) * xSpan;
      const x = width > 0 ? (raw / width) * 100 : 0;
      months.push({ label, x: Math.max(0, Math.min(100, x)) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }, [scoreHistoryLayout]);

  const projectedScore = useMemo(() => {
    const yesRate = Math.max(0, Math.min(100, plannerYesRate)) / 100;
    const noRate = 1 - yesRate;
    const baseScore =
      REPUTATION_SCORE_MIN +
      (REPUTATION_SCORE_MAX - REPUTATION_SCORE_MIN) * yesRate;
    const levelIdx = Math.max(1, Math.min(5, plannerLevel)) - 1;
    const levelMultiplier = levelMultipliers[levelIdx] ?? 1;
    const penalty = baseScore * REPUTATION_PENALTY_K * noRate * levelMultiplier;
    const targetScore = Math.max(
      REPUTATION_SCORE_MIN,
      Math.min(REPUTATION_SCORE_MAX, baseScore - penalty)
    );
    if (currentScore == null) return Math.round(targetScore);
    const windowFactor = Math.min(
      1,
      Math.max(0, plannerWindowDays / REPUTATION_SCORE_WINDOW_DAYS)
    );
    const volumeFactor = Math.min(1, Math.max(0.25, plannerConfirmations / 8));
    const progress = Math.min(1, windowFactor * volumeFactor);
    const blended = currentScore + (targetScore - currentScore) * progress;
    return Math.max(
      REPUTATION_SCORE_MIN,
      Math.min(REPUTATION_SCORE_MAX, Math.round(blended))
    );
  }, [
    plannerYesRate,
    plannerLevel,
    levelMultipliers,
    currentScore,
    plannerWindowDays,
    plannerConfirmations,
  ]);

  const projectedDelta = useMemo(() => {
    if (currentScore == null) return null;
    return Math.round(projectedScore - currentScore);
  }, [projectedScore, currentScore]);

  const plannerStability = useMemo(() => {
    if (plannerConfirmations <= 3) return "Low";
    if (plannerConfirmations <= 7) return "Medium";
    return "High";
  }, [plannerConfirmations]);

  const recordHallItems = useMemo(() => {
    if (!ownerId) return [];
    const seekerById = new Map(allSeekers.map((s) => [String(s.id), s]));
    const retainerById = new Map(allRetainers.map((r) => [String(r.id), r]));
    return getBadgeCheckins()
      .filter((c) => c.targetRole === role && c.targetId === ownerId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 200)
      .map((c) => {
        const def = getBadgeDefinition(c.badgeId);
        const verifier =
          c.verifierRole === "SEEKER"
            ? seekerById.get(c.verifierId)
            : retainerById.get(c.verifierId);
        const verifierName = def
          ? shortName(c.verifierRole, verifier)
          : c.verifierRole === "SEEKER"
          ? "Seeker"
          : "Retainer";
        const value = c.overrideValue ?? c.value;
        return {
          checkin: c,
          badge: def,
          verifierName,
          value,
        };
      });
  }, [ownerId, role, tick, allSeekers, allRetainers]);


  const filteredRecordHallItems = useMemo(() => {
    if (recordHallItems.length === 0) return [];
    let items = recordHallItems;
    if (recordWindowDays > 0) {
      items = items.filter((item) => isWithinDays(item.checkin.createdAt, recordWindowDays));
    }
    if (recordQueryDate.trim()) {
      items = items.filter((item) => item.checkin.createdAt.slice(0, 10) === recordQueryDate);
    }
    return items;
  }, [recordHallItems, recordWindowDays, recordQueryDate]);

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
    if (has) {
      setMyActive(myActiveBadgeIds.filter((x) => x !== badgeId));
      return;
    }
    if (myActiveBadgeIds.length >= badgeCaps.active) return;
    setMyActive([...myActiveBadgeIds, badgeId]);
  };

  const canEditBackground = !readOnly && !backgroundLock.isLocked;

  const toggleDraftBackground = (badgeId: BadgeId) => {
    if (!canEditBackground) return;
    if (mandatoryBackgroundIds.includes(badgeId)) return;
    setDraftBackgroundIds((prev) => {
      const has = prev.includes(badgeId);
      if (has) return prev.filter((id) => id !== badgeId);
      if (prev.length >= badgeCaps.background) return prev;
      return [...prev, badgeId];
    });
  };

  const saveBackgroundSelection = () => {
    if (!ownerId || !canEditBackground) return;
    if (draftBackgroundIds.length !== badgeCaps.background) return;
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
    cadence?: BadgeCadence;
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
                <span className="text-slate-300">Why:</span> give partners a clear reputation signal without long back-and-forth.
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
        <button
          type="button"
          onClick={() => setTab("history")}
          className={["px-3 py-1.5 rounded-full text-sm border transition", tab === "history" ? "bg-white/15 border-white/30 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"].join(" ")}
        >
          Score History
        </button>
        <button
          type="button"
          onClick={() => setTab("record")}
          className={["px-3 py-1.5 rounded-full text-sm border transition", tab === "record" ? "bg-white/15 border-white/30 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"].join(" ")}
        >
          Record Hall
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
                {ownerName} - {myActiveBadgeIds.length}/{badgeCaps.active} foreground selected - {selectedBackgroundIds.length}/{badgeCaps.background} background set
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Professional Reputation Score
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <div className="text-2xl font-semibold text-slate-50">
                  {formatScore(myReputation.score)}
                </div>
                <div className="text-xs text-slate-500">
                  {myReputation.total} confirmation{myReputation.total === 1 ? "" : "s"}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {REPUTATION_SCORE_WINDOW_DAYS}-day weighted score across linked-only badge confirmations.
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
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={openCatalog}
                              aria-label="Open badge catalog"
                              className="h-12 w-12 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100 cursor-pointer"
                            >
                              {iconFor(b.iconKey)}
                            </button>
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
                    const reputation = getBadgeReputationScore({
                      ownerRole: role,
                      ownerId,
                      badgeId: b.id,
                    });
                    const bar = prog.trustPercent ?? 0;
                    return (
                      <div
                        key={b.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={openCatalog}
                              aria-label="Open badge catalog"
                              className="h-12 w-12 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100 cursor-pointer"
                            >
                              {iconFor(b.iconKey)}
                            </button>
                            <div>
                              <div className="text-sm font-semibold text-slate-100">
                                {b.title}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                Level {p.maxLevel} -{" "}
                                {prog.trustPercent == null
                                  ? "No data yet"
                                  : `Confirmations ${prog.trustPercent}%`}
                                {" "}- {prog.totalConfirmations} confirmation
                                {prog.totalConfirmations === 1 ? "" : "s"}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1">
                                Recent score: {formatScore(reputation.score)} ({REPUTATION_SCORE_WINDOW_DAYS}d)
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

            <div className="grid md:grid-cols-2 gap-4 min-w-0">
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-4 min-w-0">
                {backgroundOptions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Background Badges
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {selectedBackgroundIds.length}/{badgeCaps.background} selected
                      </div>
                    </div>
                    {backgroundLock.isLocked && backgroundLock.lockedUntil && (
                      <div className="text-[11px] text-amber-300">
                        Locked until{" "}
                        {new Date(backgroundLock.lockedUntil).toLocaleDateString()}
                      </div>
                    )}

                    
                    <div className="space-y-2">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        Selected Background
                      </div>
                      {selectedBackgroundBadges.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
                          Pick {badgeCaps.background} background badges to set expectations.
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          {selectedBackgroundBadges.map((b) => {
                            const p = getBadgeProgress(role, ownerId, b.id);
                            const prog = computeBadgeProgressToNext(b, p);
                            const reputation = getBadgeReputationScore({
                              ownerRole: role,
                              ownerId,
                              badgeId: b.id,
                            });
                            const bar = prog.trustPercent ?? 0;
                            return (
                              <div
                                key={b.id}
                                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <button
                                      type="button"
                                      onClick={openCatalog}
                                      aria-label="Open badge catalog"
                                      className="h-12 w-12 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100 cursor-pointer"
                                    >
                                      {iconFor(b.iconKey)}
                                    </button>
                                    <div>
                                      <div className="text-sm font-semibold text-slate-100">
                                        {b.title}
                                      </div>
                                      <div className="text-xs text-slate-400 mt-0.5">
                                        Level {p.maxLevel} -{" "}
                                        {prog.trustPercent == null
                                          ? "No data yet"
                                          : `Confirmations ${prog.trustPercent}%`}
                                        {" "}- {prog.totalConfirmations} confirmation
                                        {prog.totalConfirmations === 1 ? "" : "s"}
                                      </div>
                                      <div className="text-[11px] text-slate-500 mt-1">
                                        Recent score: {formatScore(reputation.score)} ({REPUTATION_SCORE_WINDOW_DAYS}d)
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Background</span>
                                </div>
                                <div className="mt-3 space-y-2">
                                  <ProgressBar percent={bar} />
                                  {prog.nextRule ? (
                                    <div className="text-[11px] text-slate-500">
                                      Next level: {prog.nextRule.minPercent}% with{" "}
                                      {prog.nextRule.minSamples}+ confirmations
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-slate-500">Max level achieved.</div>
                                  )}
                                </div>
                                <div className="mt-3 text-xs text-slate-300">{b.description}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">Background Catalog</div>
                      {editingBackground ? (
                        <div className="space-y-2">
                          {backgroundOptions.map((b) => {
                            const selected = draftBackgroundIds.includes(b.id);
                            const isMandatory = mandatoryBackgroundIds.includes(b.id);
                            const full =
                              !selected && draftBackgroundIds.length >= badgeCaps.background;
                            return (
                              <button
                                key={b.id}
                                type="button"
                                disabled={!canEditBackground || full || isMandatory}
                                onClick={() => toggleDraftBackground(b.id)}
                                className={[
                                  "w-full text-left rounded-2xl border p-3 transition",
                                  selected
                                    ? "border-emerald-500/60 bg-emerald-500/10"
                                    : "border-slate-800 bg-slate-950/40 hover:bg-slate-900/60",
                                  !canEditBackground || full || isMandatory
                                    ? "opacity-60 cursor-not-allowed"
                                    : "",
                                ].join(" " )}
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={openCatalog}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " ) openCatalog(e); }}
                                    className="h-12 w-12 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100 cursor-pointer"
                                  >
                                    {iconFor(b.iconKey)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-semibold text-slate-100 truncate">{b.title}</div>
                                      {isMandatory && (
                                        <span className="text-[10px] uppercase tracking-wide text-amber-300">
                                          Mandatory
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">{b.description}</div>
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
                              disabled={!canEditBackground || draftBackgroundIds.length !== badgeCaps.background}
                              className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
                              onClick={saveBackgroundSelection}
                            >
                              Save selection
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">Edit selection to update background badges.</div>
                      )}
                    </div>

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

              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-4 min-w-0">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Foreground Badges
                </div>

                <div className="text-[11px] text-slate-500">
                  Select up to {badgeCaps.active} optional badges to highlight.
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    Selected Foreground
                  </div>
                  {myActiveBadges.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-5 text-sm text-slate-400">
                      No active badges selected yet. Pick up to {badgeCaps.active} from
                      the catalog below.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myActiveBadges.map((b) => {
                        const p = getBadgeProgress(role, ownerId, b.id);
                        const prog = computeBadgeProgressToNext(b, p);
                        const reputation = getBadgeReputationScore({
                          ownerRole: role,
                          ownerId,
                          badgeId: b.id,
                        });
                        const bar = prog.trustPercent ?? 0;
                        return (
                          <div
                            key={b.id}
                            className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <button
                                  type="button"
                                  onClick={openCatalog}
                                  aria-label="Open badge catalog"
                                  className="h-12 w-12 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100 cursor-pointer"
                                >
                                  {iconFor(b.iconKey)}
                                </button>
                                <div>
                                  <div className="text-sm font-semibold text-slate-100">
                                    {b.title}
                                  </div>
                                  <div className="text-xs text-slate-400 mt-0.5">
                                    Level {p.maxLevel} -{" "}
                                    {prog.trustPercent == null
                                      ? "No data yet"
                                      : `Confirmations ${prog.trustPercent}%`}
                                    {" "}- {prog.totalConfirmations} confirmation
                                    {prog.totalConfirmations === 1 ? "" : "s"}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-1">
                                    Recent score: {formatScore(reputation.score)} ({REPUTATION_SCORE_WINDOW_DAYS}d)
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
                              <div className="text-[11px] text-slate-500">{b.howToEarn}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    Available Foreground
                  </div>
                  {myBadgeDefs.length > 0 ? (
                    <div className="space-y-2">
                      {myBadgeDefs.map((b) => {
                        const isActive = myActiveBadgeIds.includes(b.id);
                        const isFull = !isActive && myActiveBadgeIds.length >= badgeCaps.active;
                        return (
                          <div
                            key={b.id}
                            className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 min-w-0"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={openCatalog}
                                aria-label="Open badge catalog"
                                className="h-10 w-10 rounded-xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100 cursor-pointer"
                              >
                                {iconFor(b.iconKey)}
                              </button>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-100 truncate">
                                  {b.title}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                  {b.description}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={readOnly || isFull}
                              onClick={() => toggleMyActive(b.id)}
                              className={[
                                "px-2.5 py-1 rounded-full text-[11px] border transition w-full sm:w-auto",
                                isActive
                                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"
                                  : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
                                readOnly || isFull ? "opacity-60 cursor-not-allowed" : "",
                              ].join(" " )}
                            >
                              {isActive ? "Selected" : isFull ? "Max selected" : "Add"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">No selectable foreground badges yet.</div>
                  )}
                </div>

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
                            <button
                              type="button"
                              onClick={openCatalog}
                              aria-label="Open badge catalog"
                              className="h-8 w-8 rounded-xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100 cursor-pointer"
                            >
                              {iconFor(item.def.iconKey)}
                            </button>
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
                  Not submitting is neutral, but check-ins keep reputation data accurate.
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
                  Why: show reputation fast with linked-only check-ins. How: choose expectations, keep check-ins current, and let optional badges highlight strengths.
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
                    Score = Expectations 65% + Growth 35% (PRS 200-900)
                  </div>
                  <ul className="mt-2 text-[11px] text-slate-400 space-y-1">
                    <li>Expectations = background + Snap + checker</li>
                    <li>Growth = optional foreground badges</li>
                    <li>Per badge score = base score minus penalty (uses level multiplier)</li>
                    <li>Rolling {REPUTATION_SCORE_WINDOW_DAYS}-day window; disputed check-ins are excluded until resolved</li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    For the Readers
                  </div>
                  <div className="text-sm text-slate-200 mt-2">
                    Expectations drive most of your score. Optional badges add lift, but only linked check-ins count. Scores smooth over time, so one bad check-in is a dent, not a cliff.
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
                    <li>Select up to {badgeCaps.active} foreground badges at a time.</li>
                    <li>Choose {badgeCaps.background} background badges; locked for 12 months.</li>
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

          {tab === "history" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">Score History</div>
                    <div className="text-sm text-slate-200 mt-1">
                      Professional Reputation Score history and recovery planning.
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  Showing full history. Range {REPUTATION_SCORE_MIN}-{REPUTATION_SCORE_MAX}.
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
                {scoreHistorySorted.length === 0 ? (
                  <div className="text-sm text-slate-400">No score history yet.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                      <div className="grid grid-cols-[52px_1fr] gap-3 items-stretch">
                        <div className="relative h-44 text-[11px] text-slate-500">
                          {scoreHistoryLayout && (
                            <>
                              <span
                                className="absolute"
                                style={{ top: `${Math.max(0, scoreHistoryLayout.yTop + 2)}px` }}
                              >
                                {REPUTATION_SCORE_MAX}
                              </span>
                              <span
                                className="absolute"
                                style={{ top: `${Math.max(0, scoreHistoryLayout.yMid - 6)}px` }}
                              >
                                {Math.round((REPUTATION_SCORE_MAX + REPUTATION_SCORE_MIN) / 2)}
                              </span>
                              <span
                                className="absolute"
                                style={{ top: `${Math.max(0, scoreHistoryLayout.yBottom - 6)}px` }}
                              >
                                {REPUTATION_SCORE_MIN}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="h-44 w-full overflow-hidden" ref={chartRef}>
                          {scoreHistoryLayout && (
                            <svg
                              width="100%"
                              height="100%"
                              viewBox={`0 0 ${scoreHistoryLayout.width} ${scoreHistoryLayout.height}`}
                              className="block"
                            >
                            <defs>
                              <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="1.6" result="blur" />
                                <feMerge>
                                  <feMergeNode in="blur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            </defs>
                            <line
                              x1={scoreHistoryLayout.xLeft}
                              y1={scoreHistoryLayout.yTop}
                              x2={scoreHistoryLayout.xLeft + scoreHistoryLayout.xSpan}
                              y2={scoreHistoryLayout.yTop}
                              stroke="#1f2937"
                              strokeWidth="1"
                            />
                            <line
                              x1={scoreHistoryLayout.xLeft}
                              y1={scoreHistoryLayout.yMid}
                              x2={scoreHistoryLayout.xLeft + scoreHistoryLayout.xSpan}
                              y2={scoreHistoryLayout.yMid}
                              stroke="#1f2937"
                              strokeWidth="1"
                            />
                            <line
                              x1={scoreHistoryLayout.xLeft}
                              y1={scoreHistoryLayout.yBottom}
                              x2={scoreHistoryLayout.xLeft + scoreHistoryLayout.xSpan}
                              y2={scoreHistoryLayout.yBottom}
                              stroke="#1f2937"
                              strokeWidth="1"
                            />
                            <polyline
                              points={scoreHistoryLine.polyline}
                              fill="none"
                              stroke="#34d399"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              opacity="0.35"
                              filter="url(#neonGlow)"
                            />
                            <polyline
                              points={scoreHistoryLine.polyline}
                              fill="none"
                              stroke="#34d399"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {scoreHistoryLine.points.map((point) => (
                              <circle
                                key={point.entry.id}
                                cx={point.x}
                                cy={point.y}
                                r={4.4}
                                fill="#0b0b0b"
                                stroke="#f8fafc"
                                strokeWidth={0.7}
                              />
                            ))}
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500 text-center">Months</div>
                      <div className="grid grid-cols-[52px_1fr] gap-3 items-center">
                        <div />
                        <div
                          className="relative h-4 mt-1 overflow-hidden w-full"
                        >
                          {scoreHistoryMonths.map((month, idx) => (
                            <span
                              key={`${month.label}-${idx}`}
                              className="absolute text-[11px] text-slate-500"
                              style={{ left: `${month.x}%`, transform: "translateX(-50%)" }}
                            >
                              {month.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide">Earliest entries</div>
                      <div className="mt-2 space-y-1">
                        {scoreHistorySorted.slice(0, 6).map((entry, idx) => {
                          const previous = idx > 0 ? scoreHistorySorted[idx - 1]?.score ?? null : null;
                          const meta = getScoreDeltaMeta(entry.score, previous);
                          const arrowText =
                            meta.arrows === 0
                              ? "^/v"
                              : meta.direction === "up"
                              ? "^".repeat(meta.arrows)
                              : "v".repeat(meta.arrows);
                          const diffLabel = meta.diff > 0 ? `+${meta.diff}` : `${meta.diff}`;
                          const deltaLabel =
                            meta.arrows === 0 ? `0 ${arrowText}` : `${diffLabel} ${arrowText}`;
                          const deltaTone =
                            meta.direction === "up"
                              ? "text-emerald-300"
                              : meta.direction === "down"
                              ? "text-rose-300"
                              : "text-slate-400";
                          return (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between text-[11px] text-slate-300"
                            >
                              <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-200 font-semibold">{formatScore(entry.score)}</span>
                                <span className={`text-[11px] ${deltaTone}`}>{deltaLabel}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Repair Planner</div>
                    <div className="text-[11px] text-slate-500">Estimator</div>
                  </div>
                  <div className="text-sm text-slate-200">
                    Explore how future check-ins could shift your Professional Reputation Score.
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-slate-400">Target window</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[30, 60, 90, 180].map((window) => (
                          <TogglePill
                            key={window}
                            label={`${window}d`}
                            on={plannerWindowDays === window}
                            onClick={() => setPlannerWindowDays(window)}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs text-slate-400">
                        Assumed badge level
                        <select
                          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
                          value={plannerLevel}
                          onChange={(e) => setPlannerLevel(Number(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5].map((level) => (
                            <option key={level} value={level}>
                              Level {level}
                            </option>
                          ))}
                        </select>
                        <div className="mt-1 text-[11px] text-slate-500">
                          Multiplier {levelMultipliers[Math.max(0, plannerLevel - 1)] ?? 1}x
                        </div>
                      </label>
                      <label className="text-xs text-slate-400">
                        Confirmations per month ({plannerConfirmations})
                        <input
                          type="range"
                          min={2}
                          max={16}
                          step={1}
                          value={plannerConfirmations}
                          onChange={(e) => setPlannerConfirmations(Number(e.target.value))}
                          className="mt-2 w-full"
                        />
                        <div className="mt-1 text-[11px] text-slate-500">
                          Stability: {plannerStability}
                        </div>
                      </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
                      <div>
                        <label className="text-xs text-slate-400">
                          Projected yes rate ({plannerYesRate}%)
                          <input
                            type="range"
                            min={50}
                            max={100}
                            step={1}
                            value={plannerYesRate}
                            onChange={(e) => setPlannerYesRate(Number(e.target.value))}
                            className="mt-2 w-full"
                          />
                        </label>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min={50}
                            max={100}
                            step={1}
                            value={plannerYesRate}
                            onChange={(e) => setPlannerYesRate(Number(e.target.value))}
                            className="w-20 rounded-xl border border-slate-800 bg-slate-950/50 px-2 py-1 text-sm text-slate-100"
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          Projected PRS
                        </div>
                        <div className="mt-1 text-2xl font-semibold text-emerald-200">
                          {projectedScore}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Current: {currentScore == null ? "--" : currentScore}
                        </div>
                        {projectedDelta != null && (
                          <div
                            className={[
                              "mt-1 text-xs",
                              projectedDelta >= 0 ? "text-emerald-300" : "text-rose-300",
                            ].join(" ")}
                          >
                            {projectedDelta >= 0 ? "+" : ""}
                            {projectedDelta} vs current
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Notes</div>
                  <ul className="mt-2 text-[11px] text-slate-400 space-y-1">
                    <li>Planner blends your current score with the target score based on the window size.</li>
                    <li>Higher confirmation volume speeds recovery; lower volume slows it down.</li>
                    <li>Disputed check-ins do not count until resolved.</li>
                    <li>Actual scores still depend on badge mix, weights, and Snap admin changes.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {tab === "record" && (
            <div className="space-y-4 h-full min-h-0 flex flex-col">
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-400">Record Hall</div>
                <div className="text-sm text-slate-200">
                  Audit trail of badge confirmations for this profile.
                </div>
                <div className="text-xs text-slate-400">
                  Showing the 200 most recent entries.
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex-1 min-h-0 flex flex-col">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs text-slate-400">
                    Search date
                    <input
                      type="date"
                      value={recordQueryDate}
                      onChange={(e) => setRecordQueryDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Window
                    <select
                      value={recordWindowDays}
                      onChange={(e) => setRecordWindowDays(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value={0}>All</option>
                      <option value={30}>Last 30 days</option>
                      <option value={60}>Last 60 days</option>
                      <option value={90}>Last 90 days</option>
                    </select>
                  </label>
                </div>
                <div className="mt-4 h-[420px] overflow-y-auto pr-1">
                  {filteredRecordHallItems.length === 0 ? (
                    <div className="text-sm text-slate-400">No entries match these filters.</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredRecordHallItems.map((item) => (
                        <div
                          key={item.checkin.id}
                          className="grid grid-cols-[140px_1fr_140px_90px] gap-3 items-center text-xs text-slate-300 border-b border-slate-800/60 pb-2"
                        >
                          <div>{new Date(item.checkin.createdAt).toLocaleDateString()}</div>
                          <div>
                            <div className="text-slate-100 font-semibold">
                              {item.badge?.title ?? item.checkin.badgeId}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {item.checkin.cadence ?? "WEEKLY"} ? {item.checkin.weekKey}
                            </div>
                          </div>
                          <div className="text-slate-400">By {item.verifierName}</div>
                          <div className={item.value === "YES" ? "text-emerald-300" : "text-rose-300"}>
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
