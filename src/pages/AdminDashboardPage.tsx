// src/pages/AdminDashboardPage.tsx
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getRetainers,
  getSeekers,
  purgeRetainer,
  purgeSeeker,
  setRetainerStatusGuarded,
  setSeekerStatusGuarded,
  subscribe,
  type Retainer,
  type Seeker,
} from "../lib/data";
import { getSession, setPortalContext, setSession } from "../lib/session";
import { autoSeedComprehensive } from "../lib/seed";
import {
  getRetainerEntitlements,
  getSeekerEntitlements,
  setRetainerTier,
  setSeekerTier,
  type RetainerTier,
  type SeekerTier,
} from "../lib/entitlements";
import {
  getAllRoutes,
  getInterestsForRoute,
  updateRoute,
  type Route as SDRoutesRoute,
  type RouteStatus,
} from "../lib/routes";
import {
  getAllRetainerPosts,
  updateRetainerPost,
  type RetainerPost,
  type RetainerPostAudience,
  type RetainerPostStatus,
} from "../lib/posts";
import {
  getAllRetainerBroadcasts,
  updateRetainerBroadcast,
  type RetainerBroadcast,
  type RetainerBroadcastAudience,
  type RetainerBroadcastStatus,
} from "../lib/broadcasts";
import {
  getBadgeCheckins,
  getBadgeDefinitions,
  getBadgeRulesSnapshot,
  getBadgeScoreSnapshot,
  setBadgeKindWeight,
  setBadgeLevelMultipliers,
  setBadgeLevelRulesForBadge,
  setBadgeLevelRulesForRole,
  setBadgeScoreSplit,
  setBadgeWeightOverride,
  updateBadgeCheckinStatus,
  type BadgeDefinition as SDBadgeDefinition,
  type BadgeLevelRule,
  type BadgeOwnerRole,
} from "../lib/badges";
import { badgeIconFor } from "../components/badgeIcons";

import AdminExternalMessageTraffic from "../components/AdminExternalMessageTraffic";
import AdminRetainerStaffMessageTraffic from "../components/AdminRetainerStaffMessageTraffic";
import AdminSubcontractorMessageTraffic from "../components/AdminSubcontractorMessageTraffic";
import ProfileAvatar from "../components/ProfileAvatar";
import { RetainerProfileForm } from "./RetainerPage";
import { SeekerProfileForm } from "./SeekerPage";

type Panel =
  | "dashboard"
  | "createSeeker"
  | "createRetainer"
  | "seekers:pending"
  | "seekers:approved"
  | "seekers:rejected"
  | "seekers:deleted"
  | "retainers:pending"
  | "retainers:approved"
  | "retainers:rejected"
  | "retainers:deleted"
  | "routes"
  | "content:posts"
  | "system:badges"
  | "system:badgeScoring"
  | "system:badgeAudit"
  | "messages:external"
  | "messages:retainerStaff"
  | "messages:subcontractors";

type NavSectionKey = "seekers" | "retainers" | "messaging" | "content" | "badges";

const SECTION_DEFAULTS: Record<NavSectionKey, Panel> = {
  seekers: "seekers:pending",
  retainers: "retainers:pending",
  messaging: "messages:external",
  content: "routes",
  badges: "system:badges",
};

const sectionForPanel = (value: Panel): NavSectionKey | null => {
  if (value === "createSeeker" || value.startsWith("seekers:")) return "seekers";
  if (value === "createRetainer" || value.startsWith("retainers:")) return "retainers";
  if (value.startsWith("messages:")) return "messaging";
  if (value === "routes" || value === "content:posts") return "content";
  if (value.startsWith("system:")) return "badges";
  return null;
};

type KPIProps = {
  label: string;
  value: number | string;
  onClick?: () => void;
};

const RETAINER_TIER_OPTIONS: RetainerTier[] = [
  "FREE",
  "STARTER",
  "GROWTH",
  "ENTERPRISE",
];

const SEEKER_TIER_OPTIONS: SeekerTier[] = ["FREE", "PRO"];

function KPI({ label, value, onClick }: KPIProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl p-4 text-left bg-white/5 hover:bg-white/10 border border-white/10 focus:outline-none focus:ring-4 focus:ring-blue-400/40"
    >
      <div className="text-xs uppercase tracking-wide text-white/60">
        {label}
      </div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </button>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full rounded-xl px-3 py-2 transition " +
        (active
          ? "bg-white/15 border border-white/20"
          : "bg-white/5 hover:bg-white/10 border border-transparent")
      }
    >
      {children}
    </button>
  );
}

function NavSectionHeader({
  title,
  open,
  active,
  onClick,
}: {
  title: string;
  open: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full rounded-xl px-3 py-2 text-left flex items-center justify-between text-xs uppercase tracking-wider transition " +
        (active
          ? "bg-white/15 border border-white/20 text-white"
          : "bg-white/5 hover:bg-white/10 border border-transparent text-white/60")
      }
    >
      <span>{title}</span>
      <span className="text-white/40">{open ? "-" : "+"}</span>
    </button>
  );
}


export default function AdminDashboardPage() {
  const navigate = useNavigate();

  // Ensure admin session so Admin can open Seeker/Retainer profiles without permission issues.
  useEffect(() => {
    setPortalContext("ADMIN");
    const existing = getSession();
    if (!existing || existing.role !== "ADMIN") {
      setSession({ role: "ADMIN", adminId: "admin" });
    }
  }, []);

  const [seekers, setSeekers] = useState<Seeker[]>(() => getSeekers());
  const [retainers, setRetainers] = useState<Retainer[]>(() => getRetainers());

  useEffect(() => {
    const unsub = subscribe(() => {
      setSeekers(getSeekers());
      setRetainers(getRetainers());
    });
    return unsub;
  }, []);

  const seekersPending = useMemo(
    () => seekers.filter((s) => s.status === "PENDING"),
    [seekers]
  );
  const seekersApproved = useMemo(
    () => seekers.filter((s) => s.status === "APPROVED"),
    [seekers]
  );
  const seekersRejected = useMemo(
    () => seekers.filter((s) => s.status === "REJECTED"),
    [seekers]
  );
  const seekersDeleted = useMemo(
    () => seekers.filter((s) => s.status === "DELETED"),
    [seekers]
  );

  const retainersPending = useMemo(
    () => retainers.filter((r) => r.status === "PENDING"),
    [retainers]
  );
  const retainersApproved = useMemo(
    () => retainers.filter((r) => r.status === "APPROVED"),
    [retainers]
  );
  const retainersRejected = useMemo(
    () => retainers.filter((r) => r.status === "REJECTED"),
    [retainers]
  );
  const retainersDeleted = useMemo(
    () => retainers.filter((r) => r.status === "DELETED"),
    [retainers]
  );

  const [panel, setPanel] = useState<Panel>("dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileNavOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [openSections, setOpenSections] = useState<Record<NavSectionKey, boolean>>(() => ({
    seekers: false,
    retainers: false,
    messaging: false,
    content: false,
    badges: false,
  }));
  const activeSection = sectionForPanel(panel);

  useEffect(() => {
    if (!activeSection) return;
    setOpenSections((prev) =>
      prev[activeSection] ? prev : { ...prev, [activeSection]: true }
    );
  }, [activeSection]);

  const handleSectionClick = (key: NavSectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    if (activeSection !== key) {
      setPanel(SECTION_DEFAULTS[key]);
    }
  };

  const panelTitle = (() => {
    if (panel === "dashboard") return "Dashboard";
    if (panel === "createSeeker") return "Create Seeker";
    if (panel === "createRetainer") return "Create Retainer";
    if (panel.startsWith("seekers:")) return `Seekers - ${panel.split(":")[1]}`;
    if (panel.startsWith("retainers:")) return `Retainers - ${panel.split(":")[1]}`;
    if (panel === "routes") return "Routes";
    if (panel === "content:posts") return "Posts & Broadcasts";
    if (panel === "system:badges") return "Badge Rules";
    if (panel === "system:badgeScoring") return "Badge Scoring";
    if (panel === "system:badgeAudit") return "Badge Audit";
    if (panel === "messages:external") return "Message Traffic (Seeker and Retainer)";
    if (panel === "messages:retainerStaff") return "Retainer Staff Messages";
    if (panel === "messages:subcontractors") return "Subcontractor Messages";
    return "Admin";
  })();

  const panelGroups: { label: string; items: { label: string; value: Panel }[] }[] = [
    {
      label: "Overview",
      items: [
        { label: "Dashboard", value: "dashboard" },
        { label: "Create Seeker", value: "createSeeker" },
        { label: "Create Retainer", value: "createRetainer" },
      ],
    },
    {
      label: "Seekers",
      items: [
        { label: "Pending", value: "seekers:pending" },
        { label: "Approved", value: "seekers:approved" },
        { label: "Rejected", value: "seekers:rejected" },
        { label: "Deleted", value: "seekers:deleted" },
      ],
    },
    {
      label: "Retainers",
      items: [
        { label: "Pending", value: "retainers:pending" },
        { label: "Approved", value: "retainers:approved" },
        { label: "Rejected", value: "retainers:rejected" },
        { label: "Deleted", value: "retainers:deleted" },
      ],
    },
    {
      label: "Messaging",
      items: [
        { label: "Traffic", value: "messages:external" },
        { label: "Retainer Staff", value: "messages:retainerStaff" },
        { label: "Subcontractors", value: "messages:subcontractors" },
      ],
    },
    {
      label: "Content",
      items: [
        { label: "Routes", value: "routes" },
        { label: "Posts", value: "content:posts" },
      ],
    },
    {
      label: "Badges",
      items: [
        { label: "Rules", value: "system:badges" },
        { label: "Scoring", value: "system:badgeScoring" },
        { label: "Audit", value: "system:badgeAudit" },
      ],
    },
  ];

  const isMessagingPanel = panel.startsWith("messages:");
  const isDashboardPanel = panel === "dashboard";

  return (
    <div className="min-h-screen lg:h-screen bg-gray-950 text-gray-100 flex flex-col lg:flex-row overflow-x-hidden">
      <aside className="hidden lg:flex w-72 shrink-0 border-r border-white/10 bg-gradient-to-b from-gray-950 to-gray-900/70 flex flex-col min-h-0">
        <div className="px-4 py-4 border-b border-white/10">
          <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
            Admin
          </div>
          <div className="flex gap-2">
            <Link className="btn" to="/">
              Home
            </Link>
            <Link className="btn" to="/seekers">
              Seekers
            </Link>
            <Link className="btn" to="/retainers">
              Retainers
            </Link>
          </div>
        </div>

        <nav className="p-3 space-y-4 overflow-y-auto min-h-0 flex-1">
          <div className="space-y-2">
            <NavButton active={panel === "dashboard"} onClick={() => setPanel("dashboard")}>
              Dashboard
            </NavButton>
          </div>

          <div className="h-px bg-white/10" />

          <section className="space-y-2">
            <NavSectionHeader
              title="Seekers"
              open={openSections.seekers}
              active={activeSection === "seekers"}
              onClick={() => handleSectionClick("seekers")}
            />
            {openSections.seekers && (
              <div className="space-y-2 pl-2">
                <NavButton active={panel === "createSeeker"} onClick={() => setPanel("createSeeker")}>
                  Create Seeker
                </NavButton>
                <NavButton active={panel === "seekers:pending"} onClick={() => setPanel("seekers:pending")}>
                  Pending
                </NavButton>
                <NavButton active={panel === "seekers:approved"} onClick={() => setPanel("seekers:approved")}>
                  Approved
                </NavButton>
                <NavButton active={panel === "seekers:rejected"} onClick={() => setPanel("seekers:rejected")}>
                  Rejected
                </NavButton>
                <NavButton active={panel === "seekers:deleted"} onClick={() => setPanel("seekers:deleted")}>
                  Deleted
                </NavButton>
              </div>
            )}
          </section>

          <div className="h-px bg-white/10" />

          <section className="space-y-2">
            <NavSectionHeader
              title="Retainers"
              open={openSections.retainers}
              active={activeSection === "retainers"}
              onClick={() => handleSectionClick("retainers")}
            />
            {openSections.retainers && (
              <div className="space-y-2 pl-2">
                <NavButton active={panel === "createRetainer"} onClick={() => setPanel("createRetainer")}>
                  Create Retainer
                </NavButton>
                <NavButton active={panel === "retainers:pending"} onClick={() => setPanel("retainers:pending")}>
                  Pending
                </NavButton>
                <NavButton active={panel === "retainers:approved"} onClick={() => setPanel("retainers:approved")}>
                  Approved
                </NavButton>
                <NavButton active={panel === "retainers:rejected"} onClick={() => setPanel("retainers:rejected")}>
                  Rejected
                </NavButton>
                <NavButton active={panel === "retainers:deleted"} onClick={() => setPanel("retainers:deleted")}>
                  Deleted
                </NavButton>
              </div>
            )}
          </section>

          <div className="h-px bg-white/10" />

          <section className="space-y-2">
            <NavSectionHeader
              title="Messaging"
              open={openSections.messaging}
              active={activeSection === "messaging"}
              onClick={() => handleSectionClick("messaging")}
            />
            {openSections.messaging && (
              <div className="space-y-2 pl-2">
                <NavButton active={panel === "messages:external"} onClick={() => setPanel("messages:external")}>
                  Seeker and Retainer Traffic
                </NavButton>
                <NavButton active={panel === "messages:retainerStaff"} onClick={() => setPanel("messages:retainerStaff")}>
                  Retainer Staff
                </NavButton>
                <NavButton active={panel === "messages:subcontractors"} onClick={() => setPanel("messages:subcontractors")}>
                  Subcontractors
                </NavButton>
              </div>
            )}
          </section>

          <div className="h-px bg-white/10" />

          <section className="space-y-2">
            <NavSectionHeader
              title="Content"
              open={openSections.content}
              active={activeSection === "content"}
              onClick={() => handleSectionClick("content")}
            />
            {openSections.content && (
              <div className="space-y-2 pl-2">
                <NavButton active={panel === "routes"} onClick={() => setPanel("routes")}>
                  Routes
                </NavButton>
                <NavButton active={panel === "content:posts"} onClick={() => setPanel("content:posts")}>
                  Posts & Broadcasts
                </NavButton>
              </div>
            )}
          </section>

          <div className="h-px bg-white/10" />

          <section className="space-y-2">
            <NavSectionHeader
              title="Badge Center"
              open={openSections.badges}
              active={activeSection === "badges"}
              onClick={() => handleSectionClick("badges")}
            />
            {openSections.badges && (
              <div className="space-y-2 pl-2">
                <NavButton active={panel === "system:badges"} onClick={() => setPanel("system:badges")}>
                  Badge Rules
                </NavButton>
                <NavButton active={panel === "system:badgeScoring"} onClick={() => setPanel("system:badgeScoring")}>
                  Badge Scoring
                </NavButton>
                <NavButton active={panel === "system:badgeAudit"} onClick={() => setPanel("system:badgeAudit")}>
                  Badge Audit
                </NavButton>
              </div>
            )}
          </section>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <div className="lg:hidden border-b border-white/10 bg-gray-950/90 backdrop-blur">
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/60">Admin</div>
                <div className="text-lg font-semibold">Snap Driver</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-white/60">Panel</div>
                  <div className="text-sm font-semibold text-white">{panelTitle}</div>
                </div>
                <button
                  type="button"
                  aria-label="Open menu"
                  onClick={() => setIsMobileNavOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center flex-col gap-1 rounded-full border border-white/10 bg-white/5 text-white/80 hover:text-white"
                >
                  <span className="sr-only">Open menu</span>
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link className="btn" to="/">
                Home
              </Link>
              <Link className="btn" to="/seekers">
                Seekers
              </Link>
              <Link className="btn" to="/retainers">
                Retainers
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn w-full sm:w-auto"
                onClick={() => {
                  const ok = window.confirm(
                    "This will wipe all local demo data and generate a comprehensive seed (5 retainers, 5 seekers). Continue?"
                  );
                  if (!ok) return;
                  autoSeedComprehensive({ retainers: 5, seekers: 5, force: true });
                  setSession({ role: "ADMIN", adminId: "admin" });
                  setPanel("dashboard");
                }}
              >
                Reset + Seed Comprehensive
              </button>
              <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                Session: ADMIN
              </span>
            </div>

            <div className="grid gap-4">
              <div className="surface p-3 rounded-2xl">
                <div className="text-sm text-white/70 mb-2">Seekers</div>
                <div className="grid grid-cols-2 gap-3">
                  <KPI label="Pending" value={seekersPending.length} onClick={() => setPanel("seekers:pending")} />
                  <KPI label="Approved" value={seekersApproved.length} onClick={() => setPanel("seekers:approved")} />
                  <KPI label="Rejected" value={seekersRejected.length} onClick={() => setPanel("seekers:rejected")} />
                  <KPI label="Deleted" value={seekersDeleted.length} onClick={() => setPanel("seekers:deleted")} />
                </div>
              </div>
              <div className="surface p-3 rounded-2xl">
                <div className="text-sm text-white/70 mb-2">Retainers</div>
                <div className="grid grid-cols-2 gap-3">
                  <KPI label="Pending" value={retainersPending.length} onClick={() => setPanel("retainers:pending")} />
                  <KPI label="Approved" value={retainersApproved.length} onClick={() => setPanel("retainers:approved")} />
                  <KPI label="Rejected" value={retainersRejected.length} onClick={() => setPanel("retainers:rejected")} />
                  <KPI label="Deleted" value={retainersDeleted.length} onClick={() => setPanel("retainers:deleted")} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {isMobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setIsMobileNavOpen(false)}
              className="absolute inset-0 bg-gray-950/70"
            />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-gray-950 border-r border-white/10 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/60">Admin</div>
                  <div className="text-sm font-semibold text-white">Navigation</div>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setIsMobileNavOpen(false)}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-white/10 text-white/80 hover:text-white"
                >
                  X
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Link className="btn" to="/">Home</Link>
                  <Link className="btn" to="/seekers">Seekers</Link>
                  <Link className="btn" to="/retainers">Retainers</Link>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn w-full sm:w-auto"
                    onClick={() => {
                      const ok = window.confirm(
                        "This will wipe all local demo data and generate a comprehensive seed (5 retainers, 5 seekers). Continue?"
                      );
                      if (!ok) return;
                      autoSeedComprehensive({ retainers: 5, seekers: 5, force: true });
                      setSession({ role: "ADMIN", adminId: "admin" });
                      setPanel("dashboard");
                      setIsMobileNavOpen(false);
                    }}
                  >
                    Reset + Seed Comprehensive
                  </button>
                  <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                    Session: ADMIN
                  </span>
                </div>

                {panelGroups.map((group) => (
                  <div key={group.label}>
                    <div className="text-[10px] uppercase tracking-wider text-white/60 mb-2">
                      {group.label}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <NavButton
                          key={`${group.label}-${item.value}`}
                          active={panel === item.value}
                          onClick={() => {
                            setPanel(item.value);
                            setIsMobileNavOpen(false);
                          }}
                        >
                          {item.label}
                        </NavButton>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <header className="hidden lg:block shrink-0 px-6 py-4 border-b border-white/10 backdrop-blur supports-[backdrop-filter]:bg-white/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{panelTitle}</h1>
              <p className="text-xs text-white/60 mt-1">
                Admin management console for Seekers and Retainers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const ok = window.confirm(
                    "This will wipe all local demo data and generate a comprehensive seed (5 retainers, 5 seekers). Continue?"
                  );
                  if (!ok) return;
                  autoSeedComprehensive({ retainers: 5, seekers: 5, force: true });
                  setSession({ role: "ADMIN", adminId: "admin" });
                  setPanel("dashboard");
                }}
              >
                Reset + Seed Comprehensive
              </button>
              <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                Session: ADMIN
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="surface p-3 rounded-2xl">
              <div className="text-sm text-white/70 mb-2">Seekers</div>
              <div className="grid grid-cols-2 gap-3">
                <KPI label="Pending" value={seekersPending.length} onClick={() => setPanel("seekers:pending")} />
                <KPI label="Approved" value={seekersApproved.length} onClick={() => setPanel("seekers:approved")} />
                <KPI label="Rejected" value={seekersRejected.length} onClick={() => setPanel("seekers:rejected")} />
                <KPI label="Deleted" value={seekersDeleted.length} onClick={() => setPanel("seekers:deleted")} />
              </div>
            </div>
            <div className="surface p-3 rounded-2xl">
              <div className="text-sm text-white/70 mb-2">Retainers</div>
              <div className="grid grid-cols-2 gap-3">
                <KPI label="Pending" value={retainersPending.length} onClick={() => setPanel("retainers:pending")} />
                <KPI label="Approved" value={retainersApproved.length} onClick={() => setPanel("retainers:approved")} />
                <KPI label="Rejected" value={retainersRejected.length} onClick={() => setPanel("retainers:rejected")} />
                <KPI label="Deleted" value={retainersDeleted.length} onClick={() => setPanel("retainers:deleted")} />
              </div>
            </div>
          </div>
        </header>

        <main
          className={[
            "flex-1 min-h-0 p-4 lg:p-6",
            isMessagingPanel || isDashboardPanel
              ? "flex flex-col overflow-y-auto lg:overflow-hidden"
              : "overflow-y-auto space-y-6",
          ].join(" ")}
        >
          {panel === "dashboard" && (
            <div className="grid md:grid-cols-2 gap-6 h-full min-h-0">
              <section className="surface p-5 hover:border-blue-500/30 transition flex flex-col min-h-0">
                <h2 className="text-xl font-semibold mb-4">Pending Seekers</h2>
                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                  <PendingSeekersList seekers={seekersPending} />
                </div>
              </section>
              <section className="surface p-5 hover:border-blue-500/30 transition flex flex-col min-h-0">
                <h2 className="text-xl font-semibold mb-4">Pending Retainers</h2>
                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                  <PendingRetainersList retainers={retainersPending} />
                </div>
              </section>
            </div>
          )}

          {panel === "createSeeker" && (
            <div className="max-w-5xl space-y-3">
              <div className="text-sm text-white/70">
                New Seeker profiles are created in Pending status.
              </div>
              <SeekerProfileForm
                mode="create"
                onSaved={(id) => {
                  if (id) navigate(`/seekers/${id}`);
                  else setPanel("dashboard");
                }}
              />
            </div>
          )}

          {panel === "createRetainer" && (
            <div className="max-w-5xl space-y-3">
              <div className="text-sm text-white/70">
                New Retainer profiles are created in Pending status.
              </div>
              <RetainerProfileForm
                mode="create"
                onSaved={(id) => {
                  if (id) navigate(`/retainers/${id}`);
                  else setPanel("dashboard");
                }}
              />
            </div>
          )}

          {panel.startsWith("seekers:") && (
            <section className="surface p-5 hover:border-blue-500/30 transition">
              {panel === "seekers:pending" && <SD_List items={seekersPending} role="SEEKER" />}
              {panel === "seekers:approved" && <SD_List items={seekersApproved} role="SEEKER" />}
              {panel === "seekers:rejected" && <SD_List items={seekersRejected} role="SEEKER" />}
              {panel === "seekers:deleted" && (
                <SD_DeletedList
                  items={seekersDeleted}
                  role="SEEKER"
                  onPurge={(id) => {
                    purgeSeeker(id);
                    setSeekers((prev) => prev.filter((s) => s.id !== id));
                  }}
                />
              )}
            </section>
          )}

          {panel.startsWith("retainers:") && (
            <section className="surface p-5 hover:border-blue-500/30 transition">
              {panel === "retainers:pending" && <SD_List items={retainersPending} role="RETAINER" />}
              {panel === "retainers:approved" && <SD_List items={retainersApproved} role="RETAINER" />}
              {panel === "retainers:rejected" && <SD_List items={retainersRejected} role="RETAINER" />}
              {panel === "retainers:deleted" && (
                <SD_DeletedList
                  items={retainersDeleted}
                  role="RETAINER"
                  onPurge={(id) => {
                    purgeRetainer(id);
                    setRetainers((prev) => prev.filter((r) => r.id !== id));
                  }}
                />
              )}
            </section>
          )}

          {panel === "routes" && (
            <AdminRoutesPanel retainers={retainers} seekers={seekers} />
          )}

          {panel === "content:posts" && (
            <AdminPostsPanel retainers={retainers} />
          )}

          {panel === "system:badges" && <AdminBadgeRulesPanel />}
          {panel === "system:badgeScoring" && <AdminBadgeScoringPanel />}
          {panel === "system:badgeAudit" && <AdminBadgeAuditPanel />}

          {panel === "messages:external" && (
            <div className="h-full">
              <AdminExternalMessageTraffic />
            </div>
          )}
          {panel === "messages:retainerStaff" && (
            <div className="h-full">
              <AdminRetainerStaffMessageTraffic />
            </div>
          )}
          {panel === "messages:subcontractors" && (
            <div className="h-full">
              <AdminSubcontractorMessageTraffic />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function RulesEditor({
  rules,
  onChange,
}: {
  rules: BadgeLevelRule[];
  onChange: (next: BadgeLevelRule[]) => void;
}) {
  const setAt = (
    idx: number,
    patch: Partial<BadgeLevelRule>
  ) => {
    const next = rules.map((r) => ({ ...r }));
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
      {rules.map((r, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-white/10 bg-white/5 p-3"
        >
          <div className="text-[11px] uppercase tracking-wide text-white/60">
            Level {idx + 1}
          </div>

          <label className="block mt-2">
            <div className="text-[11px] text-white/60 mb-1">Min %</div>
            <input
              type="number"
              min={0}
              max={100}
              value={r.minPercent}
              onChange={(e) =>
                setAt(idx, {
                  minPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                })
              }
              className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-sm"
            />
          </label>

          <label className="block mt-2">
            <div className="text-[11px] text-white/60 mb-1">Min confirmations</div>
            <input
              type="number"
              min={0}
              value={r.minSamples}
              onChange={(e) =>
                setAt(idx, { minSamples: Math.max(0, Number(e.target.value) || 0) })
              }
              className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-sm"
            />
          </label>
        </div>
      ))}
    </div>
  );
}

const AdminBadgeRulesPanel: React.FC = () => {
  const [refresh, setRefresh] = useState(0);
  const snapshot = useMemo(() => getBadgeRulesSnapshot(), [refresh]);

  const [seekerDefaults, setSeekerDefaults] = useState<BadgeLevelRule[]>(
    snapshot.roleDefaults.SEEKER
  );
  const [retainerDefaults, setRetainerDefaults] = useState<BadgeLevelRule[]>(
    snapshot.roleDefaults.RETAINER
  );

  useEffect(() => {
    setSeekerDefaults(snapshot.roleDefaults.SEEKER);
    setRetainerDefaults(snapshot.roleDefaults.RETAINER);
  }, [snapshot.updatedAt]);

  const allBadges = useMemo<SDBadgeDefinition[]>(
    () => [...getBadgeDefinitions("SEEKER"), ...getBadgeDefinitions("RETAINER")],
    []
  );

  const [q, setQ] = useState("");
  const [openBadgeId, setOpenBadgeId] = useState<string | null>(null);
  const [draftOverride, setDraftOverride] = useState<BadgeLevelRule[] | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return allBadges;
    return allBadges.filter((b) =>
      `${b.title} ${b.id} ${b.ownerRole}`.toLowerCase().includes(query)
    );
  }, [allBadges, q]);

  const openBadge = useMemo(() => {
    if (!openBadgeId) return null;
    return allBadges.find((b) => b.id === openBadgeId) ?? null;
  }, [allBadges, openBadgeId]);

  const hasOverride = (badgeId: string) => !!snapshot.badgeOverrides[badgeId];

  const openOverrideEditor = (badge: SDBadgeDefinition) => {
    const existing = snapshot.badgeOverrides[badge.id];
    const fallback = snapshot.roleDefaults[badge.ownerRole];
    setOpenBadgeId(badge.id);
    setDraftOverride((existing ?? fallback).map((r) => ({ ...r })));
  };

  const closeOverrideEditor = () => {
    setOpenBadgeId(null);
    setDraftOverride(null);
  };

  const saveDefaults = (role: BadgeOwnerRole) => {
    if (role === "SEEKER") setBadgeLevelRulesForRole("SEEKER", seekerDefaults);
    else setBadgeLevelRulesForRole("RETAINER", retainerDefaults);
    setRefresh((x) => x + 1);
  };

  const saveOverride = () => {
    if (!openBadgeId || !draftOverride) return;
    setBadgeLevelRulesForBadge(openBadgeId, draftOverride);
    setRefresh((x) => x + 1);
    closeOverrideEditor();
  };

  const clearOverride = (badgeId: string) => {
    setBadgeLevelRulesForBadge(badgeId, null);
    setRefresh((x) => x + 1);
    if (openBadgeId === badgeId) closeOverrideEditor();
  };

  return (
    <section className="surface p-5 hover:border-blue-500/30 transition space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Badge Rules</h2>
        <p className="text-sm text-white/60 mt-1">
          Controls how badge levels are earned. Levels use lifetime confirmation percentage
          and total confirmation count. Badge levels can decrease when results change.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">
                Seeker Defaults
              </div>
              <div className="text-sm text-white/70 mt-1">
                Applies to all Seeker badges without an override.
              </div>
            </div>
            <button className="btn" type="button" onClick={() => saveDefaults("SEEKER")}>
              Save
            </button>
          </div>
          <RulesEditor rules={seekerDefaults} onChange={setSeekerDefaults} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">
                Retainer Defaults
              </div>
              <div className="text-sm text-white/70 mt-1">
                Applies to all Retainer badges without an override.
              </div>
            </div>
            <button className="btn" type="button" onClick={() => saveDefaults("RETAINER")}>
              Save
            </button>
          </div>
          <RulesEditor rules={retainerDefaults} onChange={setRetainerDefaults} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/60">
              Per-Badge Overrides
            </div>
            <div className="text-sm text-white/70 mt-1">
              Use overrides for badges with different confirmation frequency (e.g., payment terms).
            </div>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search badges..."
            className="w-full md:w-72 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-2">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-white/80">
                    {badgeIconFor(b.iconKey, "h-full w-full")}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{b.title}</div>
                    <div className="text-xs text-white/60 mt-0.5">
                      {b.ownerRole} - {b.kind}
                      {hasOverride(b.id) ? " - Override enabled" : ""}
                    </div>
                    <div className="text-[11px] text-white/50 mt-1">
                      {b.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => openOverrideEditor(b)}
                  >
                    {hasOverride(b.id) ? "Edit Override" : "Add Override"}
                  </button>
                  {hasOverride(b.id) && (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => clearOverride(b.id)}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {openBadgeId === b.id && openBadge && draftOverride && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-gray-950/40 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white/80">
                      Editing override for{" "}
                      <span className="font-semibold">{openBadge.title}</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn" type="button" onClick={saveOverride}>
                        Save Override
                      </button>
                      <button className="btn" type="button" onClick={closeOverrideEditor}>
                        Cancel
                      </button>
                    </div>
                  </div>
                  <RulesEditor rules={draftOverride} onChange={setDraftOverride} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-white/60">
        Tip: For low-frequency badges (like payment), lower the minimum confirmations per level and
        keep the minimum confirmation percentage high.
      </div>
    </section>
  );
};

const AdminBadgeScoringPanel: React.FC = () => {
  const [refresh, setRefresh] = useState(0);
  const snapshot = useMemo(() => getBadgeScoreSnapshot(), [refresh]);
  const allBadges = useMemo<SDBadgeDefinition[]>(
    () => [...getBadgeDefinitions("SEEKER"), ...getBadgeDefinitions("RETAINER")],
    [refresh]
  );

  const [expectationsPct, setExpectationsPct] = useState(65);
  const [growthPct, setGrowthPct] = useState(35);
  const [kindWeights, setKindWeights] = useState({
    BACKGROUND: 3,
    SELECTABLE: 1,
    SNAP: 3,
    CHECKER: 3,
  });
  const [multipliers, setMultipliers] = useState<number[]>([0.85, 0.95, 1, 1.1, 1.25]);
  const [query, setQuery] = useState("");
  const [overrideDraft, setOverrideDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setExpectationsPct(Math.round(snapshot.expectationsWeight * 100));
    setGrowthPct(Math.round(snapshot.growthWeight * 100));
    setKindWeights({ ...snapshot.kindWeights });
    setMultipliers(snapshot.levelMultipliers.slice());
    const nextOverrides: Record<string, string> = {};
    Object.entries(snapshot.badgeOverrides).forEach(([id, weight]) => {
      nextOverrides[id] = String(weight);
    });
    setOverrideDraft(nextOverrides);
  }, [snapshot]);

  const filteredBadges = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allBadges;
    return allBadges.filter((b) =>
      [b.title, b.id, b.ownerRole, b.kind].join(" ").toLowerCase().includes(needle)
    );
  }, [allBadges, query]);

  const setKindWeight = (kind: string, value: string) => {
    const num = Number(value);
    setKindWeights((prev) => ({
      ...prev,
      [kind]: Number.isFinite(num) ? num : prev[kind as keyof typeof prev],
    }));
  };

  const setMultiplierAt = (idx: number, value: string) => {
    const num = Number(value);
    setMultipliers((prev) => {
      const next = prev.slice();
      next[idx] = Number.isFinite(num) ? num : prev[idx];
      return next;
    });
  };

  const saveScoring = () => {
    setBadgeScoreSplit(expectationsPct, growthPct);
    setBadgeKindWeight("BACKGROUND", Number(kindWeights.BACKGROUND));
    setBadgeKindWeight("SELECTABLE", Number(kindWeights.SELECTABLE));
    setBadgeKindWeight("SNAP", Number(kindWeights.SNAP));
    setBadgeKindWeight("CHECKER", Number(kindWeights.CHECKER));
    setBadgeLevelMultipliers(multipliers);
    for (const badge of allBadges) {
      const raw = overrideDraft[badge.id];
      const weight = raw == null || raw.trim() === "" ? null : Number(raw);
      setBadgeWeightOverride(
        badge.id,
        Number.isFinite(weight) && (weight as number) > 0 ? (weight as number) : null
      );
    }
    setRefresh((r) => r + 1);
  };

  return (
    <section className="surface p-5 hover:border-blue-500/30 transition space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Badge Scoring</h2>
          <p className="text-sm text-white/60">
            Control the reputation score split, badge kind weights, and penalty multipliers.
          </p>
        </div>
        <div className="text-xs text-white/50">
          Updated {new Date(snapshot.updatedAt).toLocaleString()}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="text-sm font-semibold">Score Split</div>
          <div className="grid gap-2">
            <label className="text-xs text-white/60">
              Expectations %
              <input
                type="number"
                min={0}
                step="1"
                value={expectationsPct}
                onChange={(e) => setExpectationsPct(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-white/60">
              Growth %
              <input
                type="number"
                min={0}
                step="1"
                value={growthPct}
                onChange={(e) => setGrowthPct(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
              />
            </label>
          </div>
          <div className="text-[11px] text-white/50">
            Values auto-normalize if they don&apos;t sum to 100.
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="text-sm font-semibold">Kind Weights</div>
          <div className="grid gap-2">
            <label className="text-xs text-white/60">
              Background
              <input
                type="number"
                min={0}
                step="0.1"
                value={kindWeights.BACKGROUND}
                onChange={(e) => setKindWeight("BACKGROUND", e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-white/60">
              Selectable
              <input
                type="number"
                min={0}
                step="0.1"
                value={kindWeights.SELECTABLE}
                onChange={(e) => setKindWeight("SELECTABLE", e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-white/60">
              Snap
              <input
                type="number"
                min={0}
                step="0.1"
                value={kindWeights.SNAP}
                onChange={(e) => setKindWeight("SNAP", e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-white/60">
              Checker
              <input
                type="number"
                min={0}
                step="0.1"
                value={kindWeights.CHECKER}
                onChange={(e) => setKindWeight("CHECKER", e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="text-sm font-semibold">Level Multipliers</div>
          <div className="grid grid-cols-5 gap-2 text-xs">
            {multipliers.map((value, idx) => (
              <label key={idx} className="space-y-1">
                <span className="text-[10px] text-white/60">L{idx + 1}</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={value}
                  onChange={(e) => setMultiplierAt(idx, e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-1 py-1 text-xs"
                />
              </label>
            ))}
          </div>
          <div className="text-[11px] text-white/50">
            Higher stages increase the penalty impact in reputation scoring.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold">Per-Badge Overrides</div>
            <div className="text-xs text-white/60">
              Optional overrides replace the default badge weight.
            </div>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search badges..."
            className="w-full md:w-64 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
          />
        </div>

        <div className="grid gap-2 max-h-[420px] overflow-y-auto pr-1">
          {filteredBadges.map((badge) => {
            const defaultWeight = badge.weight ?? 1;
            const overrideValue = overrideDraft[badge.id] ?? "";
            return (
              <div
                key={badge.id}
                className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-white/80">
                  {badgeIconFor(badge.iconKey, "h-full w-full")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white/90 truncate">
                    {badge.title}
                  </div>
                  <div className="text-[11px] text-white/60">
                    {badge.ownerRole} • {badge.kind} • default {defaultWeight}
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={overrideValue}
                  onChange={(e) =>
                    setOverrideDraft((prev) => ({
                      ...prev,
                      [badge.id]: e.target.value,
                    }))
                  }
                  placeholder={`Default ${defaultWeight}`}
                  className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  disabled={!overrideValue}
                  onClick={() =>
                    setOverrideDraft((prev) => {
                      const next = { ...prev };
                      delete next[badge.id];
                      return next;
                    })
                  }
                  className="px-2 py-1 rounded-md text-[10px] border border-white/10 text-white/70 hover:bg-white/10 disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn" type="button" onClick={saveScoring}>
          Save scoring
        </button>
      </div>
    </section>
  );
};

const AdminBadgeAuditPanel: React.FC = () => {
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "DISPUTED" | "OVERRIDDEN"
  >("ALL");

  const seekers = useMemo(() => getSeekers(), [refresh]);
  const retainers = useMemo(() => getRetainers(), [refresh]);
  const seekerById = useMemo(
    () => new Map(seekers.map((s) => [s.id, s] as const)),
    [seekers]
  );
  const retainerById = useMemo(
    () => new Map(retainers.map((r) => [r.id, r] as const)),
    [retainers]
  );
  const badgeMap = useMemo(() => {
    const map = new Map<string, SDBadgeDefinition>();
    for (const b of getBadgeDefinitions("SEEKER")) map.set(b.id, b);
    for (const b of getBadgeDefinitions("RETAINER")) map.set(b.id, b);
    return map;
  }, [refresh]);

  const checkins = useMemo(() => getBadgeCheckins(), [refresh]);

  const displayName = (role: BadgeOwnerRole, id: string) => {
    if (role === "SEEKER") {
      const s = seekerById.get(id);
      return s ? formatSeekerName(s) : `Seeker (${id})`;
    }
    const r = retainerById.get(id);
    return r ? formatRetainerName(r) : `Retainer (${id})`;
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = checkins.filter((c) =>
      statusFilter === "ALL" ? true : c.status === statusFilter
    );
    if (!needle) return rows;
    return rows.filter((c) => {
      const badge = badgeMap.get(c.badgeId);
      const target = displayName(c.targetRole, c.targetId);
      const verifier = displayName(c.verifierRole, c.verifierId);
      const haystack = [
        badge?.title ?? "",
        c.badgeId,
        target,
        verifier,
        c.status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [badgeMap, checkins, displayName, query, statusFilter]);

  const applyStatus = (
    checkinId: string,
    status: "ACTIVE" | "DISPUTED" | "OVERRIDDEN",
    overrideValue?: "YES" | "NO",
    overrideNote?: string
  ) => {
    updateBadgeCheckinStatus({
      checkinId,
      status,
      overrideValue,
      overrideNote,
    });
    setRefresh((r) => r + 1);
  };

  const statusBadgeClass = (status: string) => {
    if (status === "DISPUTED") return "bg-amber-500/20 text-amber-200 border-amber-500/30";
    if (status === "OVERRIDDEN") return "bg-indigo-500/20 text-indigo-200 border-indigo-500/30";
    return "bg-emerald-500/10 text-emerald-200 border-emerald-500/30";
  };

  return (
    <section className="surface p-5 hover:border-blue-500/30 transition space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Badge Audit Log</h2>
          <p className="text-sm text-white/60">
            Review badge confirmations and apply overrides or disputes.
          </p>
        </div>
        <button className="btn" type="button" onClick={() => setRefresh((r) => r + 1)}>
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by badge, target, verifier..."
          className="w-full md:w-72 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DISPUTED">Disputed</option>
          <option value="OVERRIDDEN">Overridden</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No badge check-ins match the current filters.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.slice(0, 120).map((checkin) => {
            const badge = badgeMap.get(checkin.badgeId);
            const cadenceLabel =
              checkin.cadence === "MONTHLY"
                ? "Monthly"
                : checkin.cadence === "ONCE"
                ? "One-time"
                : "Weekly";
            const effectiveValue = checkin.overrideValue ?? checkin.value;

            return (
              <div
                key={checkin.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-2xl badge-token bg-white/5 border border-white/10 flex items-center justify-center text-white/80">
                      {badge ? badgeIconFor(badge.iconKey, "h-full w-full") : "?"}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white/90">
                        {badge?.title ?? checkin.badgeId}
                      </div>
                      <div className="text-[11px] text-white/60">
                        {badge?.ownerRole ?? checkin.targetRole} • {badge?.kind ?? ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-white/50 text-right">
                    <div>{cadenceLabel}</div>
                    <div>{checkin.weekKey}</div>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-3 text-xs text-white/70">
                  <div>
                    <span className="text-white/50">Target:</span> {displayName(checkin.targetRole, checkin.targetId)}
                  </div>
                  <div>
                    <span className="text-white/50">Verifier:</span> {displayName(checkin.verifierRole, checkin.verifierId)}
                  </div>
                  <div>
                    <span className="text-white/50">Value:</span> {checkin.value} ? {effectiveValue}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border ${statusBadgeClass(checkin.status ?? "ACTIVE")}`}>
                    {checkin.status ?? "ACTIVE"}
                  </span>
                  {checkin.overrideNote && (
                    <span className="text-[11px] text-white/50">{checkin.overrideNote}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-1 rounded-full text-[11px] border border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                    onClick={() => applyStatus(checkin.id, "DISPUTED", undefined, "Admin dispute")}
                  >
                    Dispute
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-full text-[11px] border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/10"
                    onClick={() => applyStatus(checkin.id, "OVERRIDDEN", "YES", "Admin override")}
                  >
                    Override Yes
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-full text-[11px] border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/10"
                    onClick={() => applyStatus(checkin.id, "OVERRIDDEN", "NO", "Admin override")}
                  >
                    Override No
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-full text-[11px] border border-white/20 text-white/70 hover:bg-white/10"
                    onClick={() => applyStatus(checkin.id, "ACTIVE")}
                  >
                    Reset
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

const AdminPostsPanel: React.FC<{
  retainers: Retainer[];
}> = ({ retainers }) => {
  const [refresh, setRefresh] = useState(0);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"ALL" | "POST" | "BROADCAST">("ALL");
  const [audience, setAudience] = useState<
    "ALL" | RetainerPostAudience | RetainerBroadcastAudience
  >("ALL");
  const [status, setStatus] = useState<
    "ALL" | RetainerPostStatus | RetainerBroadcastStatus
  >("ALL");

  const retainerById = useMemo(
    () => new Map(retainers.map((r) => [r.id, r] as const)),
    [retainers]
  );

  const posts = useMemo<RetainerPost[]>(
    () => getAllRetainerPosts(),
    [refresh]
  );

  const broadcasts = useMemo<RetainerBroadcast[]>(
    () => getAllRetainerBroadcasts(),
    [refresh]
  );

  const rows = useMemo(() => {
    const p = posts.map((post) => ({ kind: "POST" as const, post }));
    const b = broadcasts.map((broadcast) => ({
      kind: "BROADCAST" as const,
      broadcast,
    }));
    const merged = [...p, ...b];
    merged.sort((a, b) => {
      const ta =
        a.kind === "POST"
          ? Date.parse(a.post.updatedAt)
          : Date.parse(a.broadcast.createdAt);
      const tb =
        b.kind === "POST"
          ? Date.parse(b.post.updatedAt)
          : Date.parse(b.broadcast.createdAt);
      return tb - ta;
    });
    return merged;
  }, [posts, broadcasts]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (kind !== "ALL" && row.kind !== kind) return false;

      if (row.kind === "POST") {
        if (audience !== "ALL" && row.post.audience !== audience) return false;
        if (status !== "ALL" && row.post.status !== status) return false;
        const r = retainerById.get(row.post.retainerId);
        const rName = (r?.companyName ?? "").toLowerCase();
        if (!needle) return true;
        return (
          rName.includes(needle) ||
          row.post.title.toLowerCase().includes(needle) ||
          row.post.body.toLowerCase().includes(needle)
        );
      }

      if (audience !== "ALL" && row.broadcast.audience !== audience) return false;
      if (status !== "ALL" && row.broadcast.status !== status) return false;
      const r = retainerById.get(row.broadcast.retainerId);
      const rName = (r?.companyName ?? "").toLowerCase();
      if (!needle) return true;
      return (
        rName.includes(needle) ||
        row.broadcast.subject.toLowerCase().includes(needle) ||
        row.broadcast.body.toLowerCase().includes(needle)
      );
    });
  }, [rows, kind, audience, status, q, retainerById]);

  const fmtWhen = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  return (
    <section className="surface p-5 hover:border-blue-500/30 transition">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Posts & Broadcasts</h2>
          <p className="text-sm text-white/60">
            Moderation view for Retainer feed content. You can archive items to
            remove them from the Seeker feed.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setRefresh((n) => n + 1)}>
          Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-2 mb-4">
        <select
          className="rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-xs"
          value={kind}
          onChange={(e) => setKind(e.target.value as any)}
        >
          <option value="ALL">All types</option>
          <option value="POST">Posts</option>
          <option value="BROADCAST">Broadcasts</option>
        </select>
        <select
          className="rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-xs"
          value={audience}
          onChange={(e) => setAudience(e.target.value as any)}
        >
          <option value="ALL">All audiences</option>
          <option value="LINKED_ONLY">Linked only</option>
          <option value="PUBLIC">Public</option>
        </select>
        <select
          className="rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-xs"
          placeholder="Search by Retainer, subject, or text."
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-white/60 text-sm">No items match the filters.</div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((row) => {
            if (row.kind === "POST") {
              const p = row.post;
              const ret = retainerById.get(p.retainerId);
              const retName = ret?.companyName ?? `Retainer (${p.retainerId})`;
              return (
                <li key={`POST:${p.id}`} className="rounded-xl bg-white/5 border border-white/10 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {p.title}{" "}
                        <span className="text-xs text-white/50">
                          ({p.type} - {p.audience} - {p.status})
                        </span>
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        {retName} - Updated {fmtWhen(p.updatedAt)}
                      </div>
                      <div className="text-sm text-white/80 mt-2 whitespace-pre-wrap">
                        {p.body}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link className="btn" to={`/retainers/${p.retainerId}`}>
                        Open Retainer
                      </Link>
                      <select
                        className="rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-xs"
                        value={p.status}
                        onChange={(e) => {
                          updateRetainerPost(p.id, { status: e.target.value as RetainerPostStatus });
                          setRefresh((n) => n + 1);
                        }}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="ARCHIVED">Archived</option>
                      </select>
                    </div>
                  </div>
                </li>
              );
            }

            const b = row.broadcast;
            const ret = retainerById.get(b.retainerId);
            const retName = ret?.companyName ?? `Retainer (${b.retainerId})`;
            return (
              <li key={`BROADCAST:${b.id}`} className="rounded-xl bg-white/5 border border-white/10 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {b.subject}{" "}
                      <span className="text-xs text-white/50">
                        (BROADCAST - {b.audience} - {b.status})
                      </span>
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      {retName} - Created {fmtWhen(b.createdAt)}
                    </div>
                    <div className="text-sm text-white/80 mt-2 whitespace-pre-wrap">
                      {b.body}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link className="btn" to={`/retainers/${b.retainerId}`}>
                      Open Retainer
                    </Link>
                    <select
                      className="rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-xs"
                      value={b.status}
                      onChange={(e) => {
                        updateRetainerBroadcast(b.id, { status: e.target.value as RetainerBroadcastStatus });
                        setRefresh((n) => n + 1);
                      }}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const AdminRoutesPanel: React.FC<{
  retainers: Retainer[];
  seekers: Seeker[];
}> = ({ retainers, seekers }) => {
  const [refresh, setRefresh] = useState(0);

  const routes = useMemo<SDRoutesRoute[]>(() => getAllRoutes(), [refresh]);
  const retainerById = useMemo(
    () => new Map(retainers.map((r) => [r.id, r] as const)),
    [retainers]
  );
  const seekerById = useMemo(
    () => new Map(seekers.map((s) => [s.id, s] as const)),
    [seekers]
  );

  return (
    <section className="surface p-5 hover:border-blue-500/30 transition">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Routes</h2>
          <p className="text-sm text-white/60">
            Global route listing with Interested volume. Admin can pause/close routes.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setRefresh((n) => n + 1)}>
          Refresh
        </button>
      </div>

      {routes.length === 0 ? (
        <div className="text-white/60 text-sm">No routes created yet.</div>
      ) : (
        <ul className="space-y-2">
          {routes.map((r) => {
            const ret = retainerById.get(r.retainerId);
            const retainerName = ret?.companyName ?? `Retainer (${r.retainerId})`;
            const interests = getInterestsForRoute(r.id);

            return (
              <li key={r.id} className="rounded-xl bg-white/5 border border-white/10 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-xs text-white/60 mt-1">
                      {retainerName} - {r.audience} - Interested: {interests.length}
                    </div>
                    {(r.city || r.state || r.vertical) && (
                      <div className="text-xs text-white/50 mt-1">
                        {[r.city, r.state].filter(Boolean).join(", ")}
                        {r.vertical ? ` - ${r.vertical}` : ""}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-xs"
                      value={r.status}
                      onChange={(e) => {
                        const next = e.target.value as RouteStatus;
                        try {
                          updateRoute(r.id, { status: next });
                          setRefresh((n) => n + 1);
                        } catch (err) {
                          console.error(err);
                          window.alert("Could not update route status.");
                        }
                      }}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="PAUSED">Paused</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                </div>

                {interests.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-3 space-y-1">
                    <div className="text-xs uppercase tracking-wide text-white/50">
                      Interested seekers
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {interests.slice(0, 12).map((i) => {
                        const s = seekerById.get(i.seekerId);
                        const name = s ? `${s.firstName} ${s.lastName}` : `Seeker (${i.seekerId})`;
                        return (
                          <span
                            key={i.id}
                            className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80"
                            title={name}
                          >
                            {name}
                          </span>
                        );
                      })}
                      {interests.length > 12 && (
                        <span className="text-xs text-white/50">
                          +{interests.length - 12} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const PendingSeekersList: React.FC<{ seekers: Seeker[] }> = ({ seekers }) => (
  <ul className="space-y-2">
    {seekers.length > 0 ? (
      seekers.map((s) => (
        <li key={s.id}>
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between">
            <Link to={`/seekers/${s.id}`} className="flex-1 pr-3 flex items-center gap-3 min-w-0">
              <ProfileAvatar role="SEEKER" profile={s} name={formatSeekerName(s)} />
              <div className="min-w-0">
                <div className="font-medium truncate">{formatSeekerName(s)}</div>
                <div className="text-white/60 text-sm truncate">
                  {s.city ?? "—"}, {s.state ?? "—"}
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={() => setSeekerStatusGuarded(s.id, "APPROVED")}>
                Approve
              </button>
              <button className="btn" onClick={() => setSeekerStatusGuarded(s.id, "REJECTED")}>
                Reject
              </button>
            </div>
          </div>
        </li>
      ))
    ) : (
      <li className="text-white/60">No pending seekers.</li>
    )}
  </ul>
);

const PendingRetainersList: React.FC<{ retainers: Retainer[] }> = ({ retainers }) => (
  <ul className="space-y-2">
    {retainers.length > 0 ? (
      retainers.map((r) => (
        <li key={r.id}>
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between">
            <Link to={`/retainers/${r.id}`} className="flex-1 pr-3 flex items-center gap-3 min-w-0">
              <ProfileAvatar role="RETAINER" profile={r} name={formatRetainerName(r)} />
              <div className="min-w-0">
                <div className="font-medium truncate">{formatRetainerName(r)}</div>
                <div className="text-white/60 text-sm truncate">
                  {r.city ?? "—"}, {r.state ?? "—"}
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={() => setRetainerStatusGuarded(r.id, "APPROVED")}>
                Approve
              </button>
              <button className="btn" onClick={() => setRetainerStatusGuarded(r.id, "REJECTED")}>
                Reject
              </button>
            </div>
          </div>
        </li>
      ))
    ) : (
      <li className="text-white/60">No pending retainers.</li>
    )}
  </ul>
);

function SD_List({
  items,
  role,
}: {
  items: (Seeker | Retainer)[];
  role: "SEEKER" | "RETAINER";
}) {
  if (!items || items.length === 0) return <div className="text-white/60">No records.</div>;

  return (
    <ul className="space-y-2">
      {items.map((it: any) => {
        const displayName = role === "SEEKER" ? formatSeekerName(it) : formatRetainerName(it);

        return (
          <li key={it.id}>
            <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <ProfileAvatar role={role} profile={it} name={displayName} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{displayName}</div>
                  <div className="text-white/60 text-sm truncate">
                    {it.city ?? "—"}, {it.state ?? "—"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a className="btn" href={role === "SEEKER" ? `/seekers/${it.id}` : `/retainers/${it.id}`}>
                  Open
                </a>
                <select
                  className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/80"
                  defaultValue={
                    role === "RETAINER"
                      ? getRetainerEntitlements(String(it.id)).tier
                      : getSeekerEntitlements(String(it.id)).tier
                  }
                  onChange={(e) => {
                    const next = e.target.value;
                    if (role === "RETAINER") {
                      setRetainerTier(String(it.id), next as RetainerTier);
                    } else {
                      setSeekerTier(String(it.id), next as SeekerTier);
                    }
                  }}
                  title="Entitlement tier (testing)"
                >
                  {(role === "RETAINER"
                    ? RETAINER_TIER_OPTIONS
                    : SEEKER_TIER_OPTIONS
                  ).map((t) => (
                    <option key={t} value={t} className="bg-gray-900 text-white">
                      Tier: {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SD_DeletedList({
  items,
  role,
  onPurge,
}: {
  items: (Seeker | Retainer)[];
  role: "SEEKER" | "RETAINER";
  onPurge: (id: string) => void;
}) {
  if (!items || items.length === 0) return <div className="text-white/60">No records.</div>;

  return (
    <ul className="space-y-2">
      {items.map((it: any) => {
        const displayName = role === "SEEKER" ? formatSeekerName(it) : formatRetainerName(it);

        return (
          <li key={it.id}>
            <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <ProfileAvatar role={role} profile={it} name={displayName} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{displayName}</div>
                  <div className="text-white/60 text-sm truncate">
                    {it.city ?? "—"}, {it.state ?? "—"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a className="btn" href={role === "SEEKER" ? `/seekers/${it.id}` : `/retainers/${it.id}`}>
                  Open
                </a>
                <select
                  className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/80"
                  defaultValue={
                    role === "RETAINER"
                      ? getRetainerEntitlements(String(it.id)).tier
                      : getSeekerEntitlements(String(it.id)).tier
                  }
                  onChange={(e) => {
                    const next = e.target.value;
                    if (role === "RETAINER") {
                      setRetainerTier(String(it.id), next as RetainerTier);
                    } else {
                      setSeekerTier(String(it.id), next as SeekerTier);
                    }
                  }}
                  title="Entitlement tier (testing)"
                >
                  {(role === "RETAINER"
                    ? RETAINER_TIER_OPTIONS
                    : SEEKER_TIER_OPTIONS
                  ).map((t) => (
                    <option key={t} value={t} className="bg-gray-900 text-white">
                      Tier: {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn bg-red-600/80 hover:bg-red-500"
                  onClick={() => onPurge(it.id)}
                >
                  Permanently Delete
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatSeekerName(s: Seeker): string {
  const full = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
  if (full) return full;
  return (s as any).name || "Seeker";
}

function formatRetainerName(r: Retainer): string {
  return r.companyName || (r as any).name || (r as any).ceoName || "Retainer";
}


