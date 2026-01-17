import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  getBackgroundBadges,
  getSelectableBadges,
  getSnapBadges,
  getCheckerBadges,
  getBadgeLevelRulesForBadge,
  type BadgeDefinition,
  type BadgeOwnerRole,
} from "../lib/badges";
import { badgeIconFor } from "../components/badgeIcons";

type CatalogTab = "seekers" | "retainers";

function tabToRole(tab: CatalogTab): BadgeOwnerRole {
  return tab === "retainers" ? "RETAINER" : "SEEKER";
}

function safeTab(raw: string | null): CatalogTab {
  return raw === "retainers" ? "retainers" : "seekers";
}

function RulesTable({ badge }: { badge: BadgeDefinition }) {
  if (badge.cadence === "ONCE") {
    return (
      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40">
        <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-800">
          Level Rules
        </div>
        <div className="px-3 py-3 text-xs text-slate-400">
          One-time completion badge (no recurring confirmations).
        </div>
      </div>
    );
  }
  const rules = getBadgeLevelRulesForBadge(badge.id);
  return (
    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
      <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-800">
        Level Rules
      </div>
      <div className="grid grid-cols-5 gap-px bg-slate-800">
        {rules.map((r, idx) => (
          <div key={idx} className="bg-slate-950/40 p-2">
            <div className="text-[10px] text-slate-400">Lv {idx + 1}</div>
            <div className="text-xs text-slate-200 mt-0.5">
              ≥ {r.minPercent}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {r.minSamples}+ confirmations
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BadgeCard({ badge }: { badge: BadgeDefinition }) {
  const kindLabel =
    badge.kind === "BACKGROUND"
      ? "Background"
      : badge.kind === "CHECKER"
      ? "Checker"
      : badge.kind === "SNAP"
      ? "Snap"
      : "Selectable";
  const cadenceLabel =
    badge.cadence === "MONTHLY"
      ? "Monthly"
      : badge.cadence === "ONCE"
      ? "One-time"
      : "Weekly";
  const promptLabel = badge.cadence === "ONCE" ? "Completion Prompt" : "Check-in Prompt";
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-slate-100">
          {badgeIconFor(badge.iconKey, "h-full w-full")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-50 truncate">
                {badge.title}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {badge.description}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                {kindLabel}
              </span>
              <div className="text-[10px] text-slate-500 mt-1">{cadenceLabel}</div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                How It Works
              </div>
              <div className="mt-1 text-xs text-slate-200">{badge.howToEarn}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                {promptLabel}
              </div>
              <div className="mt-1 text-xs text-slate-200">{badge.weeklyPrompt}</div>
            </div>
          </div>

          <RulesTable badge={badge} />
        </div>
      </div>
    </div>
  );
}

export default function BadgesCatalogPage() {
  const [params, setParams] = useSearchParams();
  const tab = safeTab(params.get("tab"));
  const role = tabToRole(tab);

  const snap = useMemo(() => getSnapBadges(role), [role]);
  const background = useMemo(() => getBackgroundBadges(role), [role]);
  const checker = useMemo(() => getCheckerBadges(role), [role]);
  const selectable = useMemo(() => getSelectableBadges(role), [role]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Snap Driver
            </div>
            <h1 className="text-2xl font-semibold mt-1">Badge Catalog</h1>
            <p className="text-sm text-slate-400 mt-1">
              Badges are earned through linked confirmations. Some are weekly,
              some are monthly, and onboarding badges are completed once.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn" to="/seekers">
              Seeker
            </Link>
            <Link className="btn" to="/retainers">
              Retainer
            </Link>
            <Link className="btn" to="/admin">
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setParams({ tab: "seekers" })}
            className={[
              "px-3 py-1.5 rounded-full text-xs font-medium border transition",
              tab === "seekers"
                ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-200"
                : "bg-slate-900/70 border-slate-700 text-slate-300 hover:bg-slate-800",
            ].join(" ")}
          >
            Seeker Badges
          </button>
          <button
            type="button"
            onClick={() => setParams({ tab: "retainers" })}
            className={[
              "px-3 py-1.5 rounded-full text-xs font-medium border transition",
              tab === "retainers"
                ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-200"
                : "bg-slate-900/70 border-slate-700 text-slate-300 hover:bg-slate-800",
            ].join(" ")}
          >
            Retainer Badges
          </button>
        </div>

        {snap.length > 0 && (
          <section className="space-y-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="text-lg font-semibold">Snap Badges</h2>
              <p className="text-sm text-slate-400 mt-1">
                Onboarding confirmations earned once and locked after completion.
              </p>
            </div>
            <div className="grid gap-3">
              {snap.map((b) => (
                <BadgeCard key={b.id} badge={b} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-semibold">Background Badges</h2>
            <p className="text-sm text-slate-400 mt-1">
              Minimum expectations that are always tracked (not selectable).
            </p>
          </div>
          <div className="grid gap-3">
            {background.map((b) => (
              <BadgeCard key={b.id} badge={b} />
            ))}
          </div>
        </section>

        {checker.length > 0 && (
          <section className="space-y-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="text-lg font-semibold">Compliance Badges</h2>
              <p className="text-sm text-slate-400 mt-1">
                Monthly confirmations that keep badge approvals on track.
              </p>
            </div>
            <div className="grid gap-3">
              {checker.map((b) => (
                <BadgeCard key={b.id} badge={b} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-semibold">Selectable Badges</h2>
            <p className="text-sm text-slate-400 mt-1">
              Each profile can focus on up to 4 at a time. Linked partners verify
              to build trust over time.
            </p>
          </div>
          <div className="grid gap-3">
            {selectable.map((b) => (
              <BadgeCard key={b.id} badge={b} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
