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
import { clearPortalContext, clearSession, getSession, setPortalContext, setSession } from "../lib/session";
import { autoSeedComprehensive, wipeLocalDataComprehensive } from "../lib/seed";
import { buildServerSeedPayload, getLocalSeedSummary } from "../lib/serverSeed";
import {
  createSeedBatch,
  importSeedData,
  inviteUser,
  listSeedBatches,
  purgeSeedBatch,
  resetPassword,
  wipeAllServerData,
  bootstrapAdmin,
  login,
  getSessionMe,
  register,
  logout,
  getAdminUsers,
  setUserPassword,
  setUserStatus,
} from "../lib/api";
import {
  getServerSyncMode,
  getServerSyncStatus,
  pullFromServer,
  setSeedModeEnabled,
  setServerSyncEnabled,
  syncToServer,
} from "../lib/serverSync";
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
import {
  getRouteAssignments,
  getWorkUnitPeriods,
  resolveDisputedWorkUnitPeriod,
  type RouteAssignment,
  type WorkUnitPeriod,
} from "../lib/workUnits";
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
  | "users:admins"
  | "users:seekers"
  | "users:retainers"
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
  | "system:workUnits"
  | "system:server"
  | "seed:data"
  | "messages:external"
  | "messages:retainerStaff"
  | "messages:subcontractors";

type NavSectionKey = "seekers" | "retainers" | "users" | "messaging" | "content" | "badges" | "seed";

const SECTION_DEFAULTS: Record<NavSectionKey, Panel> = {
  seekers: "seekers:pending",
  retainers: "retainers:pending",
  users: "users:admins",
  messaging: "messages:external",
  content: "routes",
  badges: "system:badges",
  seed: "seed:data",
};

const sectionForPanel = (value: Panel): NavSectionKey | null => {
  if (value === "createSeeker" || value.startsWith("seekers:")) return "seekers";
  if (value === "createRetainer" || value.startsWith("retainers:")) return "retainers";
  if (value.startsWith("users:")) return "users";
  if (value.startsWith("messages:")) return "messaging";
  if (value === "routes" || value === "content:posts") return "content";
  if (value.startsWith("system:")) return "badges";
  if (value === "seed:data") return "seed";
  return null;
};

type KPIProps = {
  label: string;
  value: number | string;
  onClick?: () => void;
};

const FORCE_ADMIN_LOGIN_KEY = "snapdriver_force_admin_login_v1";
const LOCAL_ADMIN_KEY = "snapdriver_local_admin_v1";

type LocalAdminRecord = {
  email: string;
  passwordHash: string;
  createdAt: string;
};

type AdminUserRole = "ADMIN" | "SEEKER" | "RETAINER";
type AdminUser = {
  id: string;
  email: string;
  role: AdminUserRole;
  status: string;
  statusNote?: string | null;
  statusUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  passwordSet: boolean;
  source?: "server" | "local";
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function hashLocalPassword(password: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return password;
  }
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadLocalAdmin(): LocalAdminRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LOCAL_ADMIN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocalAdminRecord;
    if (!parsed?.email || !parsed?.passwordHash) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLocalAdmin(record: LocalAdminRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(record));
}

const RETAINER_TIER_OPTIONS: RetainerTier[] = [
  "STARTER",
  "GROWTH",
  "ENTERPRISE",
];

const SEEKER_TIER_OPTIONS: SeekerTier[] = [
  "TRIAL",
  "STARTER",
  "GROWTH",
  "ELITE",
];

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

  const [authStatus, setAuthStatus] = useState<"checking" | "authed" | "unauth">("checking");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const isLocalHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.endsWith(".local"));
  const canBootstrapAdmin =
    Boolean(import.meta.env?.DEV) ||
    import.meta.env?.VITE_ENABLE_ADMIN_BOOTSTRAP === "true" ||
    isLocalHost;
  const requiresBootstrapToken =
    !isLocalHost && import.meta.env?.VITE_ENABLE_ADMIN_BOOTSTRAP === "true";

  useEffect(() => {
    setPortalContext("ADMIN");
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore logout network errors
    }
    clearSession();
    clearPortalContext();
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(FORCE_ADMIN_LOGIN_KEY, "1");
      window.localStorage.removeItem("snapdriver_current_seeker_id");
      window.localStorage.removeItem("snapdriver_current_retainer_id");
    }
    navigate("/");
  };

  useEffect(() => {
    let active = true;
    if (typeof window !== "undefined") {
      const forced = window.sessionStorage.getItem(FORCE_ADMIN_LOGIN_KEY);
      if (forced) {
        window.sessionStorage.removeItem(FORCE_ADMIN_LOGIN_KEY);
        setAuthStatus("unauth");
        return () => {
          active = false;
        };
      }
    }
    const existing = getSession();
    if (existing?.role === "ADMIN") {
      setAuthStatus("authed");
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const res = await getSessionMe();
        if (res?.user?.role === "ADMIN") {
          setSession({ role: "ADMIN", adminId: res.user.id });
          if (active) setAuthStatus("authed");
          return;
        }
      } catch {
        // ignore
      }
      if (active) setAuthStatus("unauth");
    })();

    return () => {
      active = false;
    };
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
  const showServerPanel = import.meta.env.VITE_ENABLE_SERVER_PANEL === "true";

  useEffect(() => {
    if (!showServerPanel && panel === "system:server") {
      setPanel("dashboard");
    }
  }, [panel, showServerPanel]);

  const tryLocalAdminLogin = async () => {
    if (!isLocalHost) return false;
    const record = loadLocalAdmin();
    if (!record) return false;
    const email = normalizeEmail(authEmail);
    if (!email || normalizeEmail(record.email) !== email) return false;
    const hash = await hashLocalPassword(authPassword);
    if (hash !== record.passwordHash) return false;
    setSession({ role: "ADMIN", adminId: "local-admin", email });
    setAuthStatus("authed");
    setAuthPassword("");
    setAuthError(null);
    return true;
  };

  const createLocalAdmin = async () => {
    if (!isLocalHost) return false;
    const email = normalizeEmail(authEmail);
    const password = authPassword;
    if (!email || !password) {
      setAuthError("Email and password are required.");
      return false;
    }
    if (password.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return false;
    }
    const hash = await hashLocalPassword(password);
    saveLocalAdmin({
      email,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    });
    setSession({ role: "ADMIN", adminId: "local-admin", email });
    setAuthStatus("authed");
    setAuthPassword("");
    setAuthError(null);
    return true;
  };

  const handleAdminLogin = async () => {
    setAuthError(null);
    try {
      const res = await login({ email: authEmail.trim(), password: authPassword });
      if (!res?.user || res.user.role !== "ADMIN") {
        throw new Error("This account is not authorized for admin access.");
      }
      setSession({ role: "ADMIN", adminId: res.user.id });
      setAuthStatus("authed");
      setAuthPassword("");
    } catch (err: any) {
      const localOk = await tryLocalAdminLogin();
      if (localOk) return;
      setAuthError(err?.message || "Unable to sign in.");
    }
  };
  const handleAdminBootstrap = async () => {
    setAuthError(null);
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || !password) {
      setAuthError("Email and password are required.");
      return;
    }
    if (requiresBootstrapToken && !bootstrapToken.trim()) {
      setAuthError("Bootstrap token is required.");
      return;
    }
    try {
      const res = requiresBootstrapToken
        ? await bootstrapAdmin({
            email,
            password,
            token: bootstrapToken.trim(),
          })
        : await register({
            email,
            password,
            role: "ADMIN",
          });
      if (!res?.user || res.user.role !== "ADMIN") {
        throw new Error("Admin account could not be created.");
      }
      setSession({ role: "ADMIN", adminId: res.user.id });
      setAuthStatus("authed");
      setAuthPassword("");
      setBootstrapToken("");
    } catch (err: any) {
      const localOk = await createLocalAdmin();
      if (localOk) return;
      setAuthError(err?.message || "Unable to create admin account.");
    }
  };
  const handleLocalAdminSession = () => {
    setAuthError(null);
    setSession({ role: "ADMIN", adminId: "local-admin" });
    setAuthStatus("authed");
    setAuthPassword("");
  };

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
    users: false,
    messaging: false,
    content: false,
    badges: false,
    seed: false,
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

  if (authStatus === "checking") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-400">Checking admin access...</div>
      </div>
    );
  }

  if (authStatus === "unauth") {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">SnapDriver</div>
            <Link
              to="/"
              className="text-xs uppercase tracking-wide text-slate-400 hover:text-slate-200"
            >
              Back to landing
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Admin</div>
              <h1 className="text-2xl font-semibold text-slate-100">Admin Login</h1>
              <p className="text-sm text-slate-400 mt-2">
                Sign in with an admin account to access the dashboard.
              </p>
            </div>
            <div className="space-y-3">
              <input
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Email"
                type="email"
                autoComplete="username"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="relative">
                <input
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  type={showAuthPassword ? "text" : "password"}
                  placeholder="Password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 pr-14 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowAuthPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 hover:text-slate-200"
                  aria-label={showAuthPassword ? "Hide password" : "Show password"}
                >
                  {showAuthPassword ? "Hide" : "Show"}
                </button>
              </div>
              {requiresBootstrapToken && (
                <input
                  value={bootstrapToken}
                  onChange={(e) => setBootstrapToken(e.target.value)}
                  placeholder="Bootstrap token"
                  type="password"
                  autoComplete="one-time-code"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              )}
              {authError && <div className="text-xs text-rose-300">{authError}</div>}
              <button
                type="button"
                onClick={handleAdminLogin}
                className="w-full rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/30 transition"
              >
                Sign in
              </button>
              {canBootstrapAdmin && (
                <button
                  type="button"
                  onClick={handleAdminBootstrap}
                  className="w-full rounded-full border border-slate-600/60 bg-slate-800/50 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800/70 transition"
                >
                  Create admin account (bootstrap)
                </button>
              )}
              {isLocalHost && (
                <button
                  type="button"
                  onClick={handleLocalAdminSession}
                  className="w-full rounded-full border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900/80 transition"
                >
                  Enter local admin session (offline)
                </button>
              )}
            </div>
            {canBootstrapAdmin && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                {requiresBootstrapToken
                  ? "Bootstrap is enabled. Requires a token and only works if no admin exists yet."
                  : "Local bootstrap is enabled. Use this only for staging or development to create the first admin account or enter an offline admin session."}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  const panelTitle = (() => {
    if (panel === "dashboard") return "Dashboard";
    if (panel === "createSeeker") return "Create Seeker";
    if (panel === "createRetainer") return "Create Retainer";
    if (panel === "users:admins") return "User Management - Admins";
    if (panel === "users:seekers") return "User Management - Seekers";
    if (panel === "users:retainers") return "User Management - Retainers";
    if (panel.startsWith("seekers:")) return `Seekers - ${panel.split(":")[1]}`;
    if (panel.startsWith("retainers:")) return `Retainers - ${panel.split(":")[1]}`;
    if (panel === "routes") return "Routes";
    if (panel === "content:posts") return "Posts & Broadcasts";
    if (panel === "system:badges") return "Badge Rules";
    if (panel === "system:badgeScoring") return "Badge Scoring";
    if (panel === "system:badgeAudit") return "Badge Audit";
    if (panel === "system:workUnits") return "Work Units";
    if (panel === "system:server") return "Server & Seed";
    if (panel === "seed:data") return "Seed Data";
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
      label: "User Management",
      items: [
        { label: "Admins", value: "users:admins" },
        { label: "Seekers", value: "users:seekers" },
        { label: "Retainers", value: "users:retainers" },
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
      label: "Seed Data",
      items: [{ label: "Seed Data", value: "seed:data" }],
    },
    {
      label: "Badges",
      items: [
        { label: "Rules", value: "system:badges" },
        { label: "Scoring", value: "system:badgeScoring" },
        { label: "Audit", value: "system:badgeAudit" },
        { label: "Work Units", value: "system:workUnits" },
        ...(showServerPanel ? [{ label: "Server & Seed", value: "system:server" as Panel }] : []),
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
              title="User Management"
              open={openSections.users}
              active={activeSection === "users"}
              onClick={() => handleSectionClick("users")}
            />
            {openSections.users && (
              <div className="space-y-2 pl-2">
                <NavButton active={panel === "users:admins"} onClick={() => setPanel("users:admins")}>
                  Admins
                </NavButton>
                <NavButton active={panel === "users:seekers"} onClick={() => setPanel("users:seekers")}>
                  Seekers
                </NavButton>
                <NavButton active={panel === "users:retainers"} onClick={() => setPanel("users:retainers")}>
                  Retainers
                </NavButton>
              </div>
            )}
          </section>

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
              title="Seed Data"
              open={openSections.seed}
              active={activeSection === "seed"}
              onClick={() => handleSectionClick("seed")}
            />
            {openSections.seed && (
              <div className="space-y-2 pl-2">
                <NavButton active={panel === "seed:data"} onClick={() => setPanel("seed:data")}>
                  Seed Data
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
                <NavButton active={panel === "system:workUnits"} onClick={() => setPanel("system:workUnits")}>
                  Work Units
                </NavButton>
                {showServerPanel && (
                  <NavButton active={panel === "system:server"} onClick={() => setPanel("system:server")}>
                    Server & Seed
                  </NavButton>
                )}
              </div>
            )}
          </section>
        </nav>
        <div className="px-3 pb-4">
          <button type="button" className="btn w-full" onClick={handleLogout}>
            Log out
          </button>
        </div>
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
              <button type="button" className="btn" onClick={handleLogout}>
                Log out
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

                <button
                  type="button"
                  className="btn w-full"
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    handleLogout();
                  }}
                >
                  Log out
                </button>

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
              <button type="button" className="btn" onClick={handleLogout}>
                Log out
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
            <div className="flex flex-col gap-4 h-full min-h-0">

              <div className="grid md:grid-cols-2 gap-6 flex-1 min-h-0 overflow-hidden">
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

          {panel.startsWith("users:") && (
            <>
              {panel === "users:admins" && <AdminUserManagementPanel role="ADMIN" />}
              {panel === "users:seekers" && <AdminUserManagementPanel role="SEEKER" />}
              {panel === "users:retainers" && <AdminUserManagementPanel role="RETAINER" />}
            </>
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

          {panel === "seed:data" && <AdminSeedDataPanel />}

          {panel === "system:badges" && <AdminBadgeRulesPanel />}
          {panel === "system:badgeScoring" && <AdminBadgeScoringPanel />}
          {panel === "system:badgeAudit" && <AdminBadgeAuditPanel />}
          {panel === "system:workUnits" && (
            <AdminWorkUnitsPanel retainers={retainers} seekers={seekers} />
          )}
          {panel === "system:server" && (
            showServerPanel ? (
              <AdminServerPanel />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
                Server &amp; Seed tools are disabled. Set `VITE_ENABLE_SERVER_PANEL=true` to enable.
              </div>
            )
          )}

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

const AdminUserManagementPanel: React.FC<{ role: AdminUserRole }> = ({ role }) => {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminUserRole>(role);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<
    Record<string, { status: string; note: string }>
  >({});

  const formatError = (err: any) =>
    err?.response?.data?.error || err?.message || "Request failed";

  const refreshUsers = async () => {
    setLoading(true);
    setError(null);
    setActionStatus(null);
    try {
      const res = await getAdminUsers({ role });
      setItems(res.items);
    } catch (err: any) {
      const local = loadLocalAdmin();
      if (role === "ADMIN" && local) {
        setItems([
          {
            id: "local-admin",
            email: local.email,
            role: "ADMIN",
            status: "LOCAL",
            statusNote: null,
            statusUpdatedAt: local.createdAt,
            createdAt: local.createdAt,
            updatedAt: local.createdAt,
            passwordSet: true,
            source: "local",
          },
        ]);
        setError("Server unavailable. Showing local admin only.");
      } else {
        setItems([]);
        setError(formatError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setInviteRole(role);
    refreshUsers();
  }, [role]);

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      setActionStatus("Enter an email to invite.");
      return;
    }
    setBusy(true);
    setActionStatus(null);
    try {
      const res = await inviteUser({ email, role: inviteRole });
      setInviteLink(res.magicLink);
      setActionStatus(`Invite created. Expires ${new Date(res.expiresAt).toLocaleString()}.`);
      await refreshUsers();
    } catch (err: any) {
      setActionStatus(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (email: string) => {
    setBusy(true);
    setActionStatus(null);
    try {
      const res = await resetPassword({ email });
      setInviteLink(res.magicLink);
      setActionStatus(`Reset link created. Expires ${new Date(res.expiresAt).toLocaleString()}.`);
    } catch (err: any) {
      setActionStatus(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSetPassword = async (user: AdminUser) => {
    const nextPassword = passwordDrafts[user.id]?.trim() ?? "";
    if (!nextPassword) {
      setActionStatus("Enter a password before updating.");
      return;
    }
    if (nextPassword.length < 8) {
      setActionStatus("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setActionStatus(null);
    try {
      await setUserPassword({ userId: user.id, password: nextPassword });
      setPasswordDrafts((prev) => ({ ...prev, [user.id]: "" }));
      setActionStatus("Password updated.");
      await refreshUsers();
    } catch (err: any) {
      setActionStatus(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleStatusUpdate = async (user: AdminUser) => {
    const draft = statusDrafts[user.id];
    const statusValue = (draft?.status || user.status || "ACTIVE").toUpperCase();
    const noteValue = draft?.note?.trim() ?? "";
    if (statusValue !== "ACTIVE" && !noteValue) {
      setActionStatus("Add a status note when deactivating a user.");
      return;
    }
    setBusy(true);
    setActionStatus(null);
    try {
      await setUserStatus({
        userId: user.id,
        status: statusValue,
        note: noteValue || undefined,
      });
      setActionStatus("Status updated.");
      await refreshUsers();
    } catch (err: any) {
      setActionStatus(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setActionStatus("Link copied.");
    } catch {
      setActionStatus("Link ready to copy.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div>
          <div className="text-sm font-semibold">User Management</div>
          <div className="text-xs text-white/60">
            Usernames use the account email. Passwords are never shown; only set/reset actions are available.
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <input
            className="input"
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <select
            className="input"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as AdminUserRole)}
          >
            <option value="ADMIN">Admin</option>
            <option value="RETAINER">Retainer</option>
            <option value="SEEKER">Seeker</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={handleInvite} disabled={busy}>
            Create Invite Link
          </button>
          {inviteLink && (
            <button className="btn" onClick={handleCopyLink} disabled={busy}>
              Copy Link
            </button>
          )}
          <button className="btn" onClick={refreshUsers} disabled={loading || busy}>
            Refresh List
          </button>
        </div>
        {inviteLink && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs break-all">
            {inviteLink}
          </div>
        )}
        {actionStatus && <div className="text-xs text-white/70">{actionStatus}</div>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">{role} accounts</div>
          {loading && <div className="text-xs text-white/60">Loading…</div>}
        </div>
        {error && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100 mb-4">
            {error}
          </div>
        )}
        {items.length === 0 ? (
          <div className="text-sm text-white/60">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-white/50">
                <tr className="border-b border-white/10">
                  <th className="py-2 text-left">Username (Email)</th>
                  <th className="py-2 text-left">Role</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-left">Status Note</th>
                  <th className="py-2 text-left">Status Updated</th>
                  <th className="py-2 text-left">Password Status</th>
                  <th className="py-2 text-left">Created</th>
                  <th className="py-2 text-left">Updated</th>
                  <th className="py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="text-white/80">
                {items.map((user) => (
                  <tr key={`${user.id}-${user.email}`} className="border-b border-white/5">
                    <td className="py-2">{user.email}</td>
                    <td className="py-2">{user.role}</td>
                    <td className="py-2">{user.status}</td>
                    <td className="py-2">{user.statusNote ?? "-"}</td>
                    <td className="py-2">
                      {user.statusUpdatedAt
                        ? new Date(user.statusUpdatedAt).toLocaleString()
                        : "-"}
                    </td>
                    <td className="py-2">{user.passwordSet ? "Set" : "Not set"}</td>
                    <td className="py-2">
                      {user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}
                    </td>
                    <td className="py-2">
                      {user.updatedAt ? new Date(user.updatedAt).toLocaleString() : "-"}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2 items-center">
                          <input
                            type="password"
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
                            placeholder="New password"
                            value={passwordDrafts[user.id] ?? ""}
                            onChange={(e) =>
                              setPasswordDrafts((prev) => ({
                                ...prev,
                                [user.id]: e.target.value,
                              }))
                            }
                            disabled={busy || user.source === "local"}
                          />
                          <button
                            type="button"
                            className="btn"
                            onClick={() => handleSetPassword(user)}
                            disabled={busy || user.source === "local"}
                          >
                            Set Password
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => handleReset(user.email)}
                            disabled={busy || user.source === "local"}
                          >
                            Reset Link
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <select
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
                            value={(statusDrafts[user.id]?.status || user.status || "ACTIVE").toUpperCase()}
                            onChange={(e) =>
                              setStatusDrafts((prev) => ({
                                ...prev,
                                [user.id]: {
                                  status: e.target.value,
                                  note: prev[user.id]?.note ?? "",
                                },
                              }))
                            }
                            disabled={busy || user.source === "local"}
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="SUSPENDED">Suspended</option>
                          </select>
                          <input
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
                            placeholder="Status note"
                            value={statusDrafts[user.id]?.note ?? ""}
                            onChange={(e) =>
                              setStatusDrafts((prev) => ({
                                ...prev,
                                [user.id]: {
                                  status: (prev[user.id]?.status || user.status || "ACTIVE").toUpperCase(),
                                  note: e.target.value,
                                },
                              }))
                            }
                            disabled={busy || user.source === "local"}
                          />
                          <button
                            type="button"
                            className="btn"
                            onClick={() => handleStatusUpdate(user)}
                            disabled={busy || user.source === "local"}
                          >
                            Update Status
                          </button>
                        </div>
                        {user.source === "local" && (
                          <span className="text-[10px] text-white/50">Local only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminWorkUnitsPanel: React.FC<{
  retainers: Retainer[];
  seekers: Seeker[];
}> = ({ retainers, seekers }) => {
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING" | "DISPUTED" | "CONFIRMED" | "AUTO_APPROVED"
  >("DISPUTED");
  const [drafts, setDrafts] = useState<
    Record<string, { completedUnits: string; missedUnits: string; adminNote: string }>
  >({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const routes = useMemo(() => getAllRoutes(), [refresh]);
  const routeById = useMemo(
    () => new Map(routes.map((route) => [route.id, route] as const)),
    [routes]
  );

  const assignments = useMemo<RouteAssignment[]>(
    () => getRouteAssignments(),
    [refresh]
  );
  const assignmentById = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.id, assignment] as const)),
    [assignments]
  );

  const periods = useMemo<WorkUnitPeriod[]>(
    () => getWorkUnitPeriods(),
    [refresh]
  );

  const seekerById = useMemo(
    () => new Map(seekers.map((s) => [s.id, s] as const)),
    [seekers]
  );
  const retainerById = useMemo(
    () => new Map(retainers.map((r) => [r.id, r] as const)),
    [retainers]
  );

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const dt = new Date(value);
    if (Number.isNaN(dt.valueOf())) return "-";
    return dt.toLocaleString();
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = periods.filter((period) =>
      statusFilter === "ALL" ? true : period.status === statusFilter
    );
    if (!needle) return rows;
    return rows.filter((period) => {
      const assignment = assignmentById.get(period.assignmentId);
      const route = assignment ? routeById.get(assignment.routeId) : null;
      const retainer = assignment ? retainerById.get(assignment.retainerId) : null;
      const seeker = assignment ? seekerById.get(assignment.seekerId) : null;
      const retainerName = retainer ? formatRetainerName(retainer) : "";
      const seekerName = seeker ? formatSeekerName(seeker) : "";
      const haystack = [
        period.periodKey,
        period.status,
        assignment?.assignmentType ?? "",
        assignment?.cadence ?? "",
        route?.title ?? "",
        retainerName,
        seekerName,
        period.disputeNote ?? "",
        period.adminNote ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [assignmentById, periods, query, retainerById, routeById, seekerById, statusFilter]);

  const resolvePeriod = (
    period: WorkUnitPeriod,
    resolution: "CONFIRM" | "NEUTRAL"
  ) => {
    setErrorMessage(null);
    setStatusMessage(null);
    const assignment = assignmentById.get(period.assignmentId);
    const draft = drafts[period.id];
    const completedRaw = draft?.completedUnits?.trim();
    const missedRaw = draft?.missedUnits?.trim();
    const completed =
      completedRaw && completedRaw.length > 0
        ? Number(completedRaw)
        : period.completedUnits;
    const missed =
      missedRaw && missedRaw.length > 0 ? Number(missedRaw) : period.missedUnits;

    if (completed != null && (!Number.isFinite(completed) || completed < 0)) {
      setErrorMessage("Completed units must be a valid non-negative number.");
      return;
    }
    if (missed != null && (!Number.isFinite(missed) || missed < 0)) {
      setErrorMessage("Missed units must be a valid non-negative number.");
      return;
    }

    if (assignment?.assignmentType === "DEDICATED") {
      const expected = assignment.expectedUnitsPerPeriod ?? period.expectedUnits;
      if (expected != null) {
        if (completed != null && completed > expected) {
          setErrorMessage("Completed units cannot exceed expected units.");
          return;
        }
        if (missed != null && missed > expected) {
          setErrorMessage("Missed units cannot exceed expected units.");
          return;
        }
      }
    }
    if (assignment?.assignmentType === "ON_DEMAND") {
      const accepted = period.acceptedUnits;
      if (accepted != null) {
        if (completed != null && completed > accepted) {
          setErrorMessage("Completed units cannot exceed accepted units.");
          return;
        }
        if (missed != null && missed > accepted) {
          setErrorMessage("Missed units cannot exceed accepted units.");
          return;
        }
      }
    }

    try {
      resolveDisputedWorkUnitPeriod({
        periodId: period.id,
        resolution,
        completedUnits: completed,
        missedUnits: missed,
        adminNote: draft?.adminNote,
      });
      setStatusMessage(
        resolution === "CONFIRM"
          ? "Reputation points confirmed."
          : "Reputation points neutralized."
      );
      setRefresh((r) => r + 1);
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not resolve reputation points.");
    }
  };

  return (
    <section className="surface p-5 hover:border-blue-500/30 transition space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Work Unit Disputes</h2>
          <p className="text-sm text-white/60">
            Resolve disputed work-unit periods for both parties.
          </p>
        </div>
        <button className="btn" type="button" onClick={() => setRefresh((r) => r + 1)}>
          Refresh
        </button>
      </div>

      {(statusMessage || errorMessage) && (
        <div
          className={
            "rounded-xl border px-3 py-2 text-xs " +
            (errorMessage
              ? "border-rose-500/40 text-rose-200 bg-rose-500/10"
              : "border-emerald-500/40 text-emerald-200 bg-emerald-500/10")
          }
        >
          {errorMessage ?? statusMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by route, retainer, seeker..."
          className="w-full md:w-72 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
        >
          <option value="DISPUTED">Disputed</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="AUTO_APPROVED">Auto-approved</option>
          <option value="ALL">All</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No work-unit periods match the current filters.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.slice(0, 120).map((period) => {
            const assignment = assignmentById.get(period.assignmentId);
            const route = assignment ? routeById.get(assignment.routeId) : null;
            const retainer = assignment ? retainerById.get(assignment.retainerId) : null;
            const seeker = assignment ? seekerById.get(assignment.seekerId) : null;
            const expected =
              assignment?.assignmentType === "DEDICATED"
                ? assignment.expectedUnitsPerPeriod ?? period.expectedUnits
                : undefined;
            const accepted =
              assignment?.assignmentType === "ON_DEMAND" ? period.acceptedUnits : undefined;
            const draft =
              drafts[period.id] ?? {
                completedUnits:
                  period.completedUnits != null ? String(period.completedUnits) : "",
                missedUnits:
                  period.missedUnits != null ? String(period.missedUnits) : "",
                adminNote: period.adminNote ?? "",
              };

            return (
              <div
                key={period.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white/90">
                      {route?.title ?? "Route"} - {retainer ? formatRetainerName(retainer) : "Retainer"}
                    </div>
                    <div className="text-xs text-white/60">
                      Seeker: {seeker ? formatSeekerName(seeker) : "Seeker"} - {assignment?.assignmentType ?? "Unknown"}
                    </div>
                  </div>
                  <div className="text-xs text-white/50 text-right">
                    <div>{period.periodKey}</div>
                    <div>{period.cadence}</div>
                    <div>{period.status}</div>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-3 text-xs text-white/70">
                  <div>
                    <span className="text-white/50">Expected:</span> {expected ?? "-"}
                  </div>
                  <div>
                    <span className="text-white/50">Accepted:</span> {accepted ?? "-"}
                  </div>
                  <div>
                    <span className="text-white/50">Completed:</span> {period.completedUnits ?? "-"} / Missed: {period.missedUnits ?? "-"}
                  </div>
                  <div>
                    <span className="text-white/50">Retainer submitted:</span>{" "}
                    {formatDateTime(period.retainerSubmittedAt)}
                  </div>
                  <div>
                    <span className="text-white/50">Seeker response:</span>{" "}
                    {period.seekerResponse}
                  </div>
                  <div>
                    <span className="text-white/50">Seeker responded:</span>{" "}
                    {formatDateTime(period.seekerRespondedAt)}
                  </div>
                </div>

                {period.disputeNote && (
                  <div className="text-xs text-amber-200">
                    Dispute note: {period.disputeNote}
                  </div>
                )}

                <div className="grid gap-2 md:grid-cols-3">
                  <label className="text-xs text-white/60">
                    Completed units
                    <input
                      type="number"
                      min={0}
                      value={draft.completedUnits}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [period.id]: { ...draft, completedUnits: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs text-white/60">
                    Missed units
                    <input
                      type="number"
                      min={0}
                      value={draft.missedUnits}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [period.id]: { ...draft, missedUnits: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs text-white/60">
                    Admin note
                    <input
                      value={draft.adminNote}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [period.id]: { ...draft, adminNote: e.target.value },
                        }))
                      }
                      placeholder="Resolution note"
                      className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-1 rounded-full text-[11px] border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                    onClick={() => resolvePeriod(period, "CONFIRM")}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-full text-[11px] border border-slate-500/40 text-slate-200 hover:bg-white/10"
                    onClick={() => resolvePeriod(period, "NEUTRAL")}
                  >
                    Neutral
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

const SEED_PRESETS = {
  small: { label: "Small", seekers: 25, retainers: 5 },
  medium: { label: "Medium", seekers: 100, retainers: 20 },
  large: { label: "Large", seekers: 300, retainers: 50 },
};

const AdminSeedDataPanel: React.FC = () => {
  const [seedBatches, setSeedBatches] = useState<
    Array<{ id: string; label: string; createdAt: string }>
  >([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [seedLabel, setSeedLabel] = useState("");
  const [seedPreset, setSeedPreset] = useState<keyof typeof SEED_PRESETS>("medium");
  const [seedConfirm, setSeedConfirm] = useState("");
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);

  const formatError = (err: any) =>
    err?.response?.data?.error || err?.message || "Request failed";

  const refreshBatches = async () => {
    setSeedBusy(true);
    setSeedError(null);
    try {
      const res = await listSeedBatches();
      setSeedBatches(res.items);
      if (!selectedBatchId && res.items.length > 0) {
        setSelectedBatchId(res.items[0].id);
      }
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  useEffect(() => {
    refreshBatches();
  }, []);

  useEffect(() => {
    if (seedBatches.length === 0) return;
    if (!selectedBatchId || !seedBatches.some((batch) => batch.id === selectedBatchId)) {
      setSelectedBatchId(seedBatches[0].id);
    }
  }, [seedBatches, selectedBatchId]);

  const labelSeedPayload = (payload: ReturnType<typeof buildServerSeedPayload>, label: string) => {
    const tag = (item: any) => ({ ...item, isDemo: true, demoLabel: label });
    return {
      ...payload,
      seekers: payload.seekers?.map(tag),
      retainers: payload.retainers?.map(tag),
    };
  };

  const handleGenerateDemo = async () => {
    if (seedConfirm.trim() !== "SEED DEMO") {
      setSeedError("Type SEED DEMO to confirm.");
      return;
    }
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      const preset = SEED_PRESETS[seedPreset];
      const existingSession = getSession();

      autoSeedComprehensive({
        retainers: preset.retainers,
        seekers: preset.seekers,
        force: true,
      });

      if (existingSession) {
        setSession(existingSession);
        setPortalContext("ADMIN");
      }

      const label =
        seedLabel.trim() ||
        `demo_${new Date().toISOString().slice(0, 10)}_${seedPreset}`;
      const res = await createSeedBatch(label);
      setSelectedBatchId(res.seedBatchId);
      setSeedBatches((prev) => [
        { id: res.seedBatchId, label: res.label, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      const payload = labelSeedPayload(buildServerSeedPayload(res.seedBatchId), res.label);
      const importRes = await importSeedData(payload);
      setSeedStatus(
        `Seeded ${importRes.inserted} rows for ${preset.seekers} seekers / ${preset.retainers} retainers.`
      );
      setSeedConfirm("");
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  const handlePurgeSelected = async () => {
    const targetBatchId = selectedBatchId || seedBatches[0]?.id;
    if (!targetBatchId) {
      setSeedError("Select a seed batch to purge.");
      return;
    }
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      await purgeSeedBatch({ batchId: targetBatchId });
      setSeedStatus("Purged selected seed batch.");
      setSelectedBatchId("");
      await refreshBatches();
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  const handlePurgeAll = async () => {
    if (purgeConfirm.trim() !== "PURGE SEED") {
      setSeedError("Type PURGE SEED to confirm.");
      return;
    }
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      await purgeSeedBatch({ all: true });
      setSeedStatus("Purged all seed data.");
      setSelectedBatchId("");
      setPurgeConfirm("");
      await refreshBatches();
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div>
          <div className="text-sm font-semibold">Seed Data (Production Demo)</div>
          <div className="text-xs text-white/60">
            Generates demo profiles and content in Cloudflare D1. Seeded profiles are labeled as Demo.
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-white/60">Demo Size</div>
            <select
              className="input w-full"
              value={seedPreset}
              onChange={(e) => setSeedPreset(e.target.value as keyof typeof SEED_PRESETS)}
            >
              {Object.entries(SEED_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.label} ({preset.seekers} seekers / {preset.retainers} retainers)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-white/60">Seed Label (optional)</div>
            <input
              className="input w-full"
              placeholder="demo_YYYY-MM-DD_medium"
              value={seedLabel}
              onChange={(e) => setSeedLabel(e.target.value)}
            />
          </div>
        </div>
        <div className="text-xs text-white/70">
          Includes profiles, links, conversations, messages, routes, interests, posts, broadcasts, badges, and
          reputation history.
        </div>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <input
            className="input w-full"
            placeholder="Type SEED DEMO to confirm"
            value={seedConfirm}
            onChange={(e) => setSeedConfirm(e.target.value)}
          />
          <button
            className="btn"
            onClick={handleGenerateDemo}
            disabled={seedBusy || seedConfirm.trim() !== "SEED DEMO"}
          >
            Generate Demo Data
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="text-sm font-semibold">Seed Batches</div>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <select
            className="input w-full"
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
          >
            <option value="">Select a seed batch</option>
            {seedBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.label} ({new Date(batch.createdAt).toLocaleDateString()})
              </option>
            ))}
          </select>
          <button className="btn" onClick={refreshBatches} disabled={seedBusy}>
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={handlePurgeSelected} disabled={seedBusy}>
            Purge Selected
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 space-y-3">
        <div className="text-xs uppercase tracking-wider text-rose-200">Danger Zone</div>
        <div className="text-sm text-rose-100">Purge all seed data from production.</div>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <input
            className="input w-full"
            placeholder="Type PURGE SEED to confirm"
            value={purgeConfirm}
            onChange={(e) => setPurgeConfirm(e.target.value)}
          />
          <button
            className="btn border-rose-500/40 text-rose-100 bg-rose-500/15 hover:bg-rose-500/25"
            onClick={handlePurgeAll}
            disabled={seedBusy || purgeConfirm.trim() !== "PURGE SEED"}
          >
            Purge All Seed Data
          </button>
        </div>
      </div>

      {seedStatus && <div className="text-sm text-emerald-200">{seedStatus}</div>}
      {seedError && <div className="text-sm text-rose-200">{seedError}</div>}
    </div>
  );
};

const AdminServerPanel: React.FC = () => {
  const [localSummary, setLocalSummary] = useState(() => getLocalSeedSummary());
  const [seedBatches, setSeedBatches] = useState<
    Array<{ id: string; label: string; createdAt: string }>
  >([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [seedLabel, setSeedLabel] = useState("");
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);
  const serverStatus = getServerSyncStatus();
  const isServerMode = getServerSyncMode() === "server";
  const [serverSyncEnabled, setServerSyncEnabledState] = useState(serverStatus.enabled);
  const [seedModeEnabled, setSeedModeEnabledState] = useState(serverStatus.seedMode);
  const [seedIncludes, setSeedIncludes] = useState({
    profiles: true,
    links: true,
    routes: true,
    content: true,
    badges: true,
    reputation: true,
  });
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wipeLocalAfterServer, setWipeLocalAfterServer] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const toggleServerSync = () => {
    const next = !serverSyncEnabled;
    setServerSyncEnabled(next);
    setServerSyncEnabledState(next);
  };

  const toggleSeedMode = () => {
    const next = !seedModeEnabled;
    setSeedModeEnabled(next);
    setSeedModeEnabledState(next);
  };

  const [inviteRole, setInviteRole] = useState<"ADMIN" | "SEEKER" | "RETAINER">("ADMIN");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const formatError = (err: any) =>
    err?.response?.data?.error || err?.message || "Request failed";

  const refreshLocalSummary = () => {
    setLocalSummary(getLocalSeedSummary());
  };

  const refreshBatches = async () => {
    setSeedBusy(true);
    setSeedError(null);
    try {
      const res = await listSeedBatches();
      setSeedBatches(res.items);
      if (!selectedBatchId && res.items.length > 0) {
        setSelectedBatchId(res.items[0].id);
      }
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };
  const handlePullFromServer = async () => {
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      const ok = await pullFromServer();
      setSeedStatus(ok ? "Pulled server data into local cache." : "Pull completed with no data.");
      refreshLocalSummary();
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  const handlePushToServer = async () => {
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      await syncToServer();
      setSeedStatus("Pushed local data to server.");
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  useEffect(() => {
    refreshBatches();
  }, []);

  useEffect(() => {
    if (seedBatches.length === 0) return;
    if (!selectedBatchId || !seedBatches.some((batch) => batch.id === selectedBatchId)) {
      setSelectedBatchId(seedBatches[0].id);
    }
  }, [seedBatches, selectedBatchId]);

    const applySeedIncludes = (payload: ReturnType<typeof buildServerSeedPayload>) => {
    return payload;
  };

  const handleCreateBatch = async () => {
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      const res = await createSeedBatch(seedLabel.trim() || undefined);
      setSelectedBatchId(res.seedBatchId);
      setSeedLabel("");
      await refreshBatches();
      setSeedStatus(`Created batch "${res.label}".`);
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  const handleSeedLocalDemo = () => {
    autoSeedComprehensive({ retainers: 5, seekers: 5, force: true });
    refreshLocalSummary();
    setSeedStatus("Local demo data created.");
  };

  const handleQuickSeed = async () => {
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      autoSeedComprehensive({ retainers: 5, seekers: 5, force: true });
      refreshLocalSummary();
      const res = await createSeedBatch(`demo_${new Date().toISOString().slice(0, 10)}`);
      setSelectedBatchId(res.seedBatchId);
      setSeedBatches((prev) => [
        { id: res.seedBatchId, label: res.label, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      const payload = applySeedIncludes(buildServerSeedPayload(res.seedBatchId));
      const importRes = await importSeedData(payload);
      setSeedStatus(`Seeded local demo and imported ${importRes.inserted} rows.`);
    } catch (err) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  const handleImport = async () => {
    const targetBatchId = selectedBatchId || seedBatches[0]?.id;
    if (!targetBatchId) {
      setSeedError("Select or create a seed batch first.");
      return;
    }
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      const payload = applySeedIncludes(buildServerSeedPayload(targetBatchId));
      const res = await importSeedData(payload);
      setSeedStatus(`Imported ${res.inserted} rows into seed batch.`);
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  const handlePurgeBatch = async () => {
    const targetBatchId = selectedBatchId || seedBatches[0]?.id;
    if (!targetBatchId) {
      setSeedError("Select a seed batch to purge.");
      return;
    }
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      await purgeSeedBatch({ batchId: targetBatchId });
      setSeedStatus("Purged selected seed batch.");
      setSelectedBatchId("");
      await refreshBatches();
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  const handlePurgeAll = async () => {
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      await purgeSeedBatch({ all: true });
      setSeedStatus("Purged all seed batches.");
      setSelectedBatchId("");
      await refreshBatches();
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  const handleWipeServer = async () => {
    if (wipeConfirm.trim() !== "WIPE ALL") {
      setSeedError("Type WIPE ALL to confirm.");
      return;
    }
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      await wipeAllServerData({ confirm: wipeConfirm.trim() });
      if (wipeLocalAfterServer) {
        wipeLocalDataComprehensive();
      refreshLocalSummary();
      }
      setSeedStatus(wipeLocalAfterServer ? "Server + local data wiped." : "Server data wiped.");
      setWipeConfirm("");
      await refreshBatches();
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  const handleWipeLocal = () => {
    const ok = window.confirm("This will erase all local browser data for SnapDriver. Continue?");
    if (!ok) return;
    wipeLocalDataComprehensive();
    setSeedStatus("Local cache wiped.");
  };

  const handleResetPassword = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      setSeedError("Enter an email to reset.");
      return;
    }
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      const res = await resetPassword({ email });
      setInviteLink(res.magicLink);
      setSeedStatus(`Reset link created. Expires ${new Date(res.expiresAt).toLocaleString()}.`);
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      setSeedError("Enter an email to invite.");
      return;
    }
    setSeedBusy(true);
    setSeedError(null);
    setSeedStatus(null);
    try {
      const res = await inviteUser({ email, role: inviteRole });
      setInviteLink(res.magicLink);
      setSeedStatus(`Invite created. Expires ${new Date(res.expiresAt).toLocaleString()}.`);
    } catch (err: any) {
      setSeedError(formatError(err));
    } finally {
      setSeedBusy(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setSeedStatus("Invite link copied.");
    } catch {
      setSeedStatus("Invite link ready to copy.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div>
          <div className="text-sm font-semibold">Create Logins</div>
          <div className="text-xs text-white/60">Create a temporary invite link for admin, retainer, or seeker logins.</div>
        </div>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <input
            className="input"
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <select
            className="input"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "SEEKER" | "RETAINER")}
          >
            <option value="ADMIN">Admin</option>
            <option value="RETAINER">Retainer</option>
            <option value="SEEKER">Seeker</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={handleInvite} disabled={seedBusy}>
            Create Invite Link
          </button>
          <button className="btn" onClick={handleResetPassword} disabled={seedBusy}>
            Send Reset Link
          </button>
          {inviteLink && (
            <button className="btn" onClick={handleCopyInvite} disabled={seedBusy}>
              Copy Invite Link
            </button>
          )}
        </div>
        {inviteLink && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs break-all">
            {inviteLink}
          </div>
        )}
      </div>

      {isServerMode ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
          Server sync and seed tools are disabled in production.
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">Server Seed (D1)</div>
            <div className="text-xs text-white/60">
              Push your local demo data to Cloudflare. Use seed batches so you can purge later.
            </div>
          </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn" onClick={handlePullFromServer} disabled={seedBusy}>
            Pull from Server
          </button>
          <button className="btn" onClick={handlePushToServer} disabled={seedBusy}>
            Push Local to Server
          </button>
          <button className="btn" onClick={toggleServerSync} disabled={seedBusy}>
            Server Sync: {serverSyncEnabled ? "On" : "Off"}
          </button>
          <button className="btn" onClick={toggleSeedMode} disabled={seedBusy}>
            Seed Mode: {seedModeEnabled ? "On" : "Off"}
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-white/60">Local Snapshot</div>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={handleSeedLocalDemo} disabled={seedBusy}>
                Seed Local Demo
              </button>
              <button className="btn" onClick={handleQuickSeed} disabled={seedBusy}>
                Seed + Push to Server
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Seekers: {localSummary.seekers}</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Retainers: {localSummary.retainers}</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Retainer Users: {localSummary.retainerUsers}</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Subcontractors: {localSummary.subcontractors}</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Links: {localSummary.links}</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Messages: {localSummary.messages}</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Routes: {localSummary.routes}</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Route Interests: {localSummary.routeInterests}</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Posts: {localSummary.posts}</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Broadcasts: {localSummary.broadcasts}</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Badges: {localSummary.badgeDefinitions}</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Check-ins: {localSummary.badgeCheckins}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-white/60">Seed Batch</div>
            <div className="space-y-3">
              <input
                className="input w-full"
                placeholder="Seed batch label (optional)"
                value={seedLabel}
                onChange={(e) => setSeedLabel(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <button className="btn" onClick={handleCreateBatch} disabled={seedBusy}>
                  Create Batch
                </button>
                <button className="btn" onClick={refreshBatches} disabled={seedBusy}>
                  Refresh
                </button>
              </div>
              <select
                className="input w-full"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
              >
                <option value="">Select a seed batch</option>
                {seedBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.label} ({new Date(batch.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <button className="btn" onClick={handleImport} disabled={seedBusy}>
                  Import Local Seed
                </button>
                <button className="btn" onClick={handlePurgeBatch} disabled={seedBusy}>
                  Purge Selected
                </button>
                <button className="btn" onClick={handlePurgeAll} disabled={seedBusy}>
                  Purge All
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-white/60">Include data sets</div>
          <div className="grid gap-2 md:grid-cols-2">
            {([
              ["profiles", "Profiles + teams"],
              ["links", "Links + messaging"],
              ["routes", "Routes + interests"],
              ["content", "Posts + broadcasts"],
              ["badges", "Badges + check-ins"],
              ["reputation", "Reputation + record hall"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={(seedIncludes as any)[key]}
                  onChange={(e) =>
                    setSeedIncludes((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-white/30 bg-white/10"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-rose-200">Danger Zone</div>
          <div className="text-sm text-rose-100">
            Wipe all data from the server or clear all local browser data.
          </div>
          <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
            <input
              className="input w-full"
              placeholder="Type WIPE ALL to confirm"
              value={wipeConfirm}
              onChange={(e) => setWipeConfirm(e.target.value)}
            />
            <button
              className="btn border-rose-500/40 text-rose-100 bg-rose-500/15 hover:bg-rose-500/25"
              onClick={handleWipeServer}
              disabled={seedBusy || wipeConfirm.trim() !== "WIPE ALL"}
            >
              Wipe Server Data
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-rose-100">
            <input
              type="checkbox"
              checked={wipeLocalAfterServer}
              onChange={(e) => setWipeLocalAfterServer(e.target.checked)}
              className="h-4 w-4 rounded border-rose-300/40 bg-rose-500/10"
            />
            Also wipe local cache after server wipe
          </label>
          <button
            className="btn border-amber-500/40 text-amber-100 bg-amber-500/15 hover:bg-amber-500/25"
            onClick={handleWipeLocal}
            disabled={seedBusy}
          >
            Wipe Local Cache
          </button>
        </div>

        {seedStatus && <div className="text-sm text-emerald-200">{seedStatus}</div>}
        {seedError && <div className="text-sm text-rose-200">{seedError}</div>}
      </div>
      )}
    </div>

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

