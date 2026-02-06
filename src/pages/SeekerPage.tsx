// src/pages/SeekerPage.tsx
import React, { useMemo, useState, useEffect, useRef, lazy, Suspense, useDeferredValue } from "react";
import type { CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  US_STATES,
  DELIVERY_VERTICALS,
  INSURANCE_TYPES,
  PAY_CYCLE_FREQUENCIES,
  getSeekers,
  getRetainers,
  addSeekerForcePending,
  addSubcontractor,
  removeSubcontractor,
  setSeekerHierarchyNodes,
  subscribe,
  type PayCycleFrequency,
} from "../lib/data";
import {
  createConversationWithFirstMessage,
  getConversationsForSeeker,
  setMessageFlag,
} from "../lib/messages";
import {
  addSubcontractorMessage,
  getSubcontractorMessages,
} from "../lib/subcontractorMessages";
import {
  getLinksForSeeker,
  getLink,
  requestLink,
  addLinkMeetingProposal,
  acceptLinkMeetingProposal,
  clearLinkMeetingSchedule,
  resetLink,
  setLinkApproved,
  setLinkStatus,
  setLinkVideoConfirmed,
  type Link as LinkingLink,
} from "../lib/linking";
import {
  getInterestsForSeeker,
  getVisibleRoutesForSeeker,
  toggleInterest,
  type Route,
} from "../lib/routes";
import {
  createRouteNotice,
  cancelRouteNotice,
  getRouteNoticesForSeeker,
  ROUTE_NOTICE_EVENT,
} from "../lib/routeNotices";
import { getFeedForSeeker, type FeedItem } from "../lib/feed";
import {
  recordRouteResponse,
  getRouteResponseForSeeker,
  ROUTE_RESPONSES_EVENT,
  type RouteResponseType,
} from "../lib/routeResponses";
import {
  recordPostResponse,
  getPostResponseForSeeker,
  POST_RESPONSES_EVENT,
  type PostResponseType,
} from "../lib/postResponses";
import {
  recordFeedReaction,
  getFeedReactionForSeeker,
  FEED_REACTIONS_EVENT,
  FEED_REACTION_OPTIONS,
  type FeedReactionType,
  type FeedReactionItemKind,
} from "../lib/feedReactions";
import {
  DAYS,
  type DayOfWeek,
  type WeeklyAvailability,
  formatDaysShort,
  bestMatchForRoutes,
  type ScheduleMatch,
} from "../lib/schedule";
const LazySeekerMessagingCenter = lazy(() => import("../components/SeekerMessagingCenter"));
const LazyHierarchyCanvas = lazy(() => import("../components/HierarchyCanvas"));
const LazyBadgesCenter = lazy(() => import("../components/BadgesCenter"));
import ProfileAvatar from "../components/ProfileAvatar";
import {
  getActiveBadges,
  getBadgeDefinition,
  getBadgeProgress,
  getBadgeCheckins,
  getBadgeSummaryForProfile,
  getPendingBadgeApprovalsForProfile,
  getReputationScoreForProfile,
} from "../lib/badges";
import { badgeIconFor } from "../components/badgeIcons";
import { clearPortalContext, clearSession, getSession, setPortalContext, setSession } from "../lib/session";
import { changePassword, resetPassword, syncUpsert } from "../lib/api";
import { getRetainerPosts, type RetainerPost } from "../lib/posts";
import { getStockImageUrl } from "../lib/stockImages";
import { uploadImageWithFallback, MAX_IMAGE_BYTES } from "../lib/uploads";
import { pullFromServer } from "../lib/serverSync";

// Derive types from data helpers so we don't rely on exported types
type Seeker = ReturnType<typeof getSeekers>[number];
type Retainer = ReturnType<typeof getRetainers>[number];
type Subcontractor = NonNullable<Seeker["subcontractors"]>[number];

type ApprovalGateProps = {
  title: string;
  body: string;
  status?: string;
  onBack: () => void;
  backLabel?: string;
};

const ApprovalGate: React.FC<ApprovalGateProps> = ({
  title,
  body,
  status,
  onBack,
  backLabel = "Back to landing",
}) => (
  <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
    <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/70 p-6 space-y-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        Profile access
      </div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-slate-400">{body}</p>
      {status && (
        <div className="text-xs text-slate-500">
          Status: <span className="text-slate-200">{status}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onBack}
        className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 transition"
      >
        {backLabel}
      </button>
    </div>
  </div>
);

function getApprovalGateCopy(roleLabel: string, status?: string) {

  switch (status) {
    case "PENDING":
      return {
        title: "Pending admin approval",
        body: `Your ${roleLabel} profile is pending review. You will have full access once Snap admin approves it.`,
      };
    case "REJECTED":
      return {
        title: "Profile rejected",
        body: `Your ${roleLabel} profile was rejected. Contact Snap admin if you need to resubmit.`,
      };
    case "SUSPENDED":
      return {
        title: "Profile suspended",
        body: `Your ${roleLabel} profile is suspended. Contact Snap admin for next steps.`,
      };
    case "DELETED":
      return {
        title: "Profile removed",
        body: `Your ${roleLabel} profile was removed. Contact Snap admin if this is unexpected.`,
      };
    default:
      return {
        title: "Profile unavailable",
        body: `We could not load your ${roleLabel} profile. It may have been cleared or created in a different browser.`,
      };
  }
}

type TabKey =
  | "dashboard"
  | "find"
  | "action"
  | "linking"
  | "badges"
  | "editProfile"
  | "messages"
  | "hierarchy";

type RetainerBucketKey = "excellent" | "possible" | "notNow";

type ActionTabKey =
  | "wheel"
  | "lists"
  | "routes"
  | "schedule"
  | "editProfile"
  | "addSubcontractor"
  | "hierarchy";

type ComposeDraft = {
  retainer: Retainer;
  initialSubject?: string;
  initialBody?: string;
  messageFlag?: string;
  onSent?: () => void;
};

const CURRENT_SEEKER_KEY = "snapdriver_current_seeker_id";
const CURRENT_RETAINER_KEY = "snapdriver_current_retainer_id";
const SEEKER_RETAINER_BUCKETS_KEY = "snapdriver_seeker_retainer_buckets";

const SeekerPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useMemo(() => getSession(), []);
  const isSessionSeeker = session?.role === "SEEKER";
  const sessionSeekerId = isSessionSeeker ? session.seekerId ?? null : null;
  const sessionEmail = session?.email ? String(session.email).toLowerCase() : null;
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1024;
  });
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [actionTab, setActionTab] = useState<ActionTabKey>("wheel");
  const [linkTick, setLinkTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  useEffect(() => {
    if (isDesktop && isMobileNavOpen) {
      setIsMobileNavOpen(false);
    }
  }, [isDesktop, isMobileNavOpen]);

  const handleLogout = () => {
    clearSession();
    clearPortalContext();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CURRENT_SEEKER_KEY);
      window.localStorage.removeItem(CURRENT_RETAINER_KEY);
    }
    navigate("/");
  };

  useEffect(() => {
    setPortalContext("SEEKER");
  }, []);

  const openActionTab = (tab: ActionTabKey) => {
    setActionTab(tab);
    setActiveTab("action");
  };

  useEffect(() => {
    const state = location.state as
      | { openTab?: TabKey; actionTab?: ActionTabKey }
      | null
      | undefined;
    if (!state) return;
    if (state.openTab) {
      setActiveTab(state.openTab);
    }
    if (state.actionTab) {
      setActionTab(state.actionTab);
      if (!state.openTab) {
        setActiveTab("action");
      }
    }
  }, [location.state]);

  const badgesReturnState = location.state as
    | { returnTo?: string; returnState?: unknown }
    | null
    | undefined;
  const badgesReturnTo =
    typeof badgesReturnState?.returnTo === "string"
      ? badgesReturnState.returnTo
      : null;

  const handleBadgesBack = () => {
    if (badgesReturnTo) {
      navigate(badgesReturnTo, { state: badgesReturnState?.returnState });
      return;
    }
    navigate(-1);
  };

  // All seekers
  const [seekers, setSeekers] = useState<Seeker[]>(() => getSeekers());

  // All retainers; approved subset used for wheel
  const [retainers, setRetainers] = useState<Retainer[]>(() => getRetainers());
  const approvedRetainers = useMemo(
    () => retainers.filter((r) => r.status === "APPROVED"),
    [retainers]
  );

  // Wheel + buckets for retainers
  const [wheelRetainers, setWheelRetainers] = useState<Retainer[]>([]);
  const [retainerBuckets, setRetainerBuckets] = useState<{
    excellent: Retainer[];
    possible: Retainer[];
    notNow: Retainer[];
  }>({
    excellent: [],
    possible: [],
    notNow: [],
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Compose pop-out (message from dashboard)
  const [composeDraft, setComposeDraft] = useState<ComposeDraft | null>(null);

  const [selectedRetainerIds, setSelectedRetainerIds] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkComposeTargets, setBulkComposeTargets] = useState<Retainer[] | null>(
    null
  );

  // "Acting as" Seeker id
  const [currentSeekerId, setCurrentSeekerId] = useState<string | null>(() => {
    const initialList = getSeekers();
    const id = sessionSeekerId ?? resolveCurrentSeekerId(initialList, null);
    if (id) persistCurrentSeekerId(id);
    return id;
  });

  const currentSeeker = useMemo(
    () =>
      currentSeekerId
        ? seekers.find((s) => s.id === currentSeekerId)
        : undefined,
    [seekers, currentSeekerId]
  );

  const sessionSeeker = useMemo(
    () => (sessionSeekerId ? seekers.find((s) => s.id === sessionSeekerId) : undefined),
    [seekers, sessionSeekerId]
  );

  const effectiveSeeker = useMemo(() => {
    if (!isSessionSeeker) return sessionSeeker;
    if (sessionSeeker) return sessionSeeker;
    if (!currentSeeker || !sessionEmail) return undefined;
    const match = String((currentSeeker as any).email ?? "").toLowerCase();
    return match && match === sessionEmail ? currentSeeker : undefined;
  }, [isSessionSeeker, sessionSeeker, currentSeeker, sessionEmail]);

  useEffect(() => {
    if (!isSessionSeeker || !sessionSeekerId) {
      return;
    }
    if (sessionSeeker) {
      return;
    }
    const email = session?.email ? String(session.email).toLowerCase() : null;
    const hydrate = async () => {
      try {
        await pullFromServer();
      } catch {
        // ignore
      } finally {
      }
      const refreshed = getSeekers();
      setSeekers(refreshed);
      let found = sessionSeekerId ? refreshed.find((s) => s.id === sessionSeekerId) : undefined;
      if (!found && email) {
        found = refreshed.find((s) => String((s as any).email ?? "").toLowerCase() === email);
      }
      if (!found && currentSeeker) {
        try {
          await syncUpsert({ seekers: [currentSeeker] });
        } catch {
          // ignore
        }
        found = currentSeeker;
      }
      if (found) {
        setCurrentSeekerId(found.id);
        persistCurrentSeekerId(found.id);
        setSession({ role: "SEEKER", seekerId: found.id, email: email ?? undefined });
      }
    };
    hydrate();
  }, [isSessionSeeker, sessionSeekerId, sessionSeeker, session?.email, currentSeeker]);

  useEffect(() => {
    if (!effectiveSeeker || sessionSeeker) return;
    setCurrentSeekerId(effectiveSeeker.id);
    persistCurrentSeekerId(effectiveSeeker.id);
    setSession({ role: "SEEKER", seekerId: effectiveSeeker.id, email: sessionEmail ?? undefined });
    syncUpsert({ seekers: [effectiveSeeker] }).catch(() => undefined);
  }, [effectiveSeeker, sessionSeeker, sessionEmail]);
  const subcontractors = useMemo(
    () => (currentSeeker ? currentSeeker.subcontractors ?? [] : []),
    [currentSeeker]
  );

  const activeSubcontractor: Subcontractor | undefined = undefined;

  const isSubcontractorView = false;

  // Keep portal lists in sync with localStorage changes (incl. reseed)
  useEffect(() => {
    const unsub = subscribe(() => {
      const nextSeekers = getSeekers();
      const nextRetainers = getRetainers();

      setSeekers(nextSeekers);
      setRetainers(nextRetainers);

      setCurrentSeekerId((prev) => {
        if (isSessionSeeker && sessionSeekerId) {
          persistCurrentSeekerId(sessionSeekerId);
          return sessionSeekerId;
        }
        const resolved = resolveCurrentSeekerId(nextSeekers, prev);
        if (resolved) persistCurrentSeekerId(resolved);
        else persistCurrentSeekerId(null);
        return resolved;
      });
    });
    return unsub;
  }, [isSessionSeeker, sessionSeekerId]);

  useEffect(() => {
    if (!isSubcontractorView) return;
    if (activeTab === "editProfile" || activeTab === "messages" || activeTab === "hierarchy") {
      return;
    }
    setActiveTab("editProfile");
  }, [activeTab, isSubcontractorView]);

  useEffect(() => {
    if (!isSessionSeeker || !sessionSeekerId) return;
    if (currentSeekerId !== sessionSeekerId) {
      setCurrentSeekerId(sessionSeekerId);
      persistCurrentSeekerId(sessionSeekerId);
    }
  }, [isSessionSeeker, sessionSeekerId, currentSeekerId]);

  const refreshSeekersAndSession = () => {
    const updated = getSeekers();
    setSeekers(updated);
    const newId = isSessionSeeker && sessionSeekerId ? sessionSeekerId : resolveCurrentSeekerId(updated, currentSeekerId);
    setCurrentSeekerId(newId);
    if (newId) persistCurrentSeekerId(newId);
    else persistCurrentSeekerId(null);
  };

  const handleSeekerCreated = () => {
    refreshSeekersAndSession();
    setActiveTab("dashboard");
  };

  const handleSeekerUpdated = () => {
    refreshSeekersAndSession();
    setActiveTab("dashboard");
  };

  const classifyLabel = (bucket: RetainerBucketKey): string => {
    switch (bucket) {
      case "excellent":
        return "Excellent";
      case "possible":
        return "Possible";
      case "notNow":
        return "Not now";
      default:
        return bucket;
    }
  };

  const persistBuckets = (buckets: {
    excellent: Retainer[];
    possible: Retainer[];
    notNow: Retainer[];
  }) => {
    if (typeof window === "undefined") return;
    try {
      const payload = {
        excellent: buckets.excellent.map((r) => r.id),
        possible: buckets.possible.map((r) => r.id),
        notNow: buckets.notNow.map((r) => r.id),
      };
      window.localStorage.setItem(
        SEEKER_RETAINER_BUCKETS_KEY,
        JSON.stringify(payload)
      );
    } catch (err) {
      console.error("Failed to persist Retainer buckets", err);
    }
  };

  const handleClassifyRetainer = (
    retainer: Retainer,
    bucket: RetainerBucketKey
  ) => {
    if (isSubcontractorView) return;
    const addUnique = (list: Retainer[], r: Retainer) => {
      if (list.some((x) => x.id === r.id)) return list;
      return [...list, r];
    };

    // Remove from wheel
    setWheelRetainers((prev) => prev.filter((r) => r.id !== retainer.id));

    // Update buckets + persist
    setRetainerBuckets((prev) => {
      const next = {
        excellent: prev.excellent.filter((r) => r.id !== retainer.id),
        possible: prev.possible.filter((r) => r.id !== retainer.id),
        notNow: prev.notNow.filter((r) => r.id !== retainer.id),
      };

      if (bucket === "excellent") {
        next.excellent = addUnique(next.excellent, retainer);
      } else if (bucket === "possible") {
        next.possible = addUnique(next.possible, retainer);
      } else {
        next.notNow = addUnique(next.notNow, retainer);
      }

      persistBuckets(next);
      return next;
    });

    const name = formatRetainerName(retainer);
    const label = classifyLabel(bucket);
    setToastMessage(`${name} sent to "${label}" list`);
  };

  const handleReturnRetainerToWheel = (retainer: Retainer) => {
    if (isSubcontractorView) return;
    setRetainerBuckets((prev) => {
      const next = {
        excellent: prev.excellent.filter((r) => r.id !== retainer.id),
        possible: prev.possible.filter((r) => r.id !== retainer.id),
        notNow: prev.notNow.filter((r) => r.id !== retainer.id),
      };
      persistBuckets(next);
      return next;
    });

    setWheelRetainers((prev) =>
      prev.some((r) => r.id === retainer.id) ? prev : [...prev, retainer]
    );

    setToastMessage(`${formatRetainerName(retainer)} returned to wheel`);
  };

  useEffect(() => {
    const valid = new Set<string>([
      ...retainerBuckets.excellent.map((r) => r.id),
      ...retainerBuckets.possible.map((r) => r.id),
      ...retainerBuckets.notNow.map((r) => r.id),
    ]);
    setSelectedRetainerIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const id of prev) if (valid.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [retainerBuckets.excellent, retainerBuckets.possible, retainerBuckets.notNow]);

  const toggleSelectedRetainer = (retainerId: string) => {
    if (isSubcontractorView) return;
    setSelectedRetainerIds((prev) => {
      const next = new Set(prev);
      if (next.has(retainerId)) next.delete(retainerId);
      else next.add(retainerId);
      return next;
    });
  };

  const clearSelectedRetainers = () => setSelectedRetainerIds(new Set());

  const selectAllRetainersInLists = () => {
    if (isSubcontractorView) return;
    setSelectedRetainerIds(
      new Set([
        ...retainerBuckets.excellent.map((r) => r.id),
        ...retainerBuckets.possible.map((r) => r.id),
        ...retainerBuckets.notNow.map((r) => r.id),
      ])
    );
  };

  const selectedRetainersInLists = useMemo(() => {
    if (selectedRetainerIds.size === 0) return [];
    const all = [
      ...retainerBuckets.excellent,
      ...retainerBuckets.possible,
      ...retainerBuckets.notNow,
    ];
    return all.filter((r) => selectedRetainerIds.has(r.id));
  }, [
    retainerBuckets.excellent,
    retainerBuckets.possible,
    retainerBuckets.notNow,
    selectedRetainerIds,
  ]);

  const bulkReturnSelectedRetainersToWheel = () => {
    if (isSubcontractorView) return;
    if (selectedRetainersInLists.length === 0) return;

    const selectedIds = new Set(selectedRetainersInLists.map((r) => r.id));

    setRetainerBuckets((prev) => {
      const next = {
        excellent: prev.excellent.filter((r) => !selectedIds.has(r.id)),
        possible: prev.possible.filter((r) => !selectedIds.has(r.id)),
        notNow: prev.notNow.filter((r) => !selectedIds.has(r.id)),
      };
      persistBuckets(next);
      return next;
    });

    setWheelRetainers((prev) => {
      const existing = new Set(prev.map((r) => r.id));
      const toAdd = selectedRetainersInLists.filter((r) => !existing.has(r.id));
      return toAdd.length === 0 ? prev : [...prev, ...toAdd];
    });

    clearSelectedRetainers();
    setToastMessage(
      selectedRetainersInLists.length === 1
        ? `${formatRetainerName(selectedRetainersInLists[0])} returned to wheel`
        : `${selectedRetainersInLists.length} retainers returned to wheel`
    );
  };

  const bulkRequestLinksForSelectedRetainers = () => {
    if (isSubcontractorView) return;
    if (!currentSeekerId) return;
    if (selectedRetainersInLists.length === 0) return;

    for (const r of selectedRetainersInLists) {
      requestLink({ seekerId: currentSeekerId, retainerId: r.id, by: "SEEKER" });
    }

    setToastMessage(
      selectedRetainersInLists.length === 1
        ? "Link request sent."
        : `Link requests sent to ${selectedRetainersInLists.length} retainers.`
    );
  };

  const bulkMessageSelectedRetainers = () => {
    if (isSubcontractorView) return;
    if (!currentSeekerId) {
      setToastMessage("Create or select a Seeker profile before sending messages.");
      return;
    }
    if (selectedRetainersInLists.length === 0) return;
    setBulkComposeTargets(selectedRetainersInLists);
  };

  const handleRebucketById = (
    retainerId: string,
    targetBucket: RetainerBucketKey
  ) => {
    if (isSubcontractorView) return;
    setRetainerBuckets((prev) => {
      let moving: Retainer | undefined;

      const removeFrom = (list: Retainer[]) => {
        const idx = list.findIndex((r) => r.id === retainerId);
        if (idx >= 0) {
          const copy = [...list];
          [moving] = copy.splice(idx, 1);
          return copy;
        }
        return list;
      };

      let excellent = removeFrom(prev.excellent);
      let possible = removeFrom(prev.possible);
      let notNow = removeFrom(prev.notNow);

      if (!moving) return prev;

      const addUnique = (list: Retainer[], r: Retainer) =>
        list.some((x) => x.id === r.id) ? list : [...list, r];

      if (targetBucket === "excellent") {
        excellent = addUnique(excellent, moving);
      } else if (targetBucket === "possible") {
        possible = addUnique(possible, moving);
      } else {
        notNow = addUnique(notNow, moving);
      }

      const next = { excellent, possible, notNow };
      persistBuckets(next);
      return next;
    });

    setToastMessage(`Profile moved to ${classifyLabel(targetBucket)} list`);
  };

  const handleMessageRetainer = (retainer: Retainer) => {
    if (isSubcontractorView) return;
    setComposeDraft({ retainer });
  };

  const handleOpenRetainerProfileFromAction = (retainer: Retainer) => {
    if (!retainer?.id) return;
    navigate(`/retainers/${retainer.id}`, {
      state: { returnTo: "action", returnActionTab: actionTab },
    });
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const id = window.setTimeout(() => setToastMessage(null), 2000);
    return () => window.clearTimeout(id);
  }, [toastMessage]);

  // On mount: rebuild buckets + wheel from localStorage
  useEffect(() => {
    if (approvedRetainers.length === 0) {
      setWheelRetainers([]);
      setRetainerBuckets({ excellent: [], possible: [], notNow: [] });
      return;
    }

    if (typeof window === "undefined") {
      setWheelRetainers(approvedRetainers);
      return;
    }

    try {
      const raw = window.localStorage.getItem(SEEKER_RETAINER_BUCKETS_KEY);
      if (!raw) {
        setWheelRetainers(approvedRetainers);
        return;
      }

      const parsed = JSON.parse(raw) as {
        excellent?: string[];
        possible?: string[];
        notNow?: string[];
      };

      const byId = new Map<string, Retainer>(
        approvedRetainers.map((r) => [r.id, r])
      );

      const mapIds = (ids?: string[]) =>
        (ids || [])
          .map((id) => byId.get(id))
          .filter((r): r is Retainer => !!r);

      const excellent = mapIds(parsed.excellent);
      const possible = mapIds(parsed.possible);
      const notNow = mapIds(parsed.notNow);

      const bucketIds = new Set<string>([
        ...excellent.map((r) => r.id),
        ...possible.map((r) => r.id),
        ...notNow.map((r) => r.id),
      ]);

      const wheel = approvedRetainers.filter((r) => !bucketIds.has(r.id));

      setRetainerBuckets({ excellent, possible, notNow });
      setWheelRetainers(wheel);
    } catch (err) {
      console.error("Failed to load Retainer buckets from localStorage", err);
      setWheelRetainers(approvedRetainers);
    }
  }, [approvedRetainers]);

  const headerTitle = isSubcontractorView
    ? renderSubcontractorHeaderTitle(activeTab)
    : renderHeaderTitle(activeTab);
  const headerSubtitle = isSubcontractorView
    ? renderSubcontractorHeaderSubtitle(activeTab)
    : renderHeaderSubtitle(activeTab);

  const approvalGate: { title: string; body: string; status?: string } | null =
    isSessionSeeker && effectiveSeeker && effectiveSeeker.status !== "APPROVED"
      ? {
          ...getApprovalGateCopy("Seeker", effectiveSeeker.status),
          status: effectiveSeeker.status,
        }
      : null;

  if (approvalGate) {
    return (
      <ApprovalGate
        title={approvalGate.title}
        body={approvalGate.body}
        status={approvalGate.status}
        onBack={() => navigate("/")}
      />
    );
  }

  return (
    <div
      className="min-h-screen lg:h-screen bg-slate-950 text-slate-50 flex flex-col lg:flex-row overflow-x-hidden lg:overflow-hidden"
    >
      {/* Left sidebar */}
      <aside className="hidden lg:flex w-72 shrink-0 border-r border-slate-800 bg-slate-900/70 backdrop-blur-sm p-4 flex flex-col min-h-0">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
            Snap Driver
          </div>
          <h1 className="text-xl font-semibold text-slate-50">Seeker Portal</h1>
        </div>

        {currentSeeker ? (
          <div className="mb-6 rounded-2xl bg-slate-800/80 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Your Profile
            </div>
            <div className="font-semibold text-slate-50 truncate">
              {formatSeekerName(currentSeeker)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Status:{" "}
              <span className="font-medium text-emerald-400">
                {currentSeeker.status}
              </span>
            </div>
            {!isSubcontractorView && currentSeekerId && (
              <div className="mt-2">
                <Link
                  to={`/seekers/${currentSeekerId}`}
                  className="text-[11px] text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
                >
                  View profile
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 rounded-2xl bg-slate-800/80 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Get started
            </div>
            <div className="text-sm text-slate-200">
              You&apos;re not currently acting as any Seeker. Use{" "}
              <button
                type="button"
                onClick={() => openActionTab("editProfile")}
                className="font-semibold text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline"
              >
                Edit Profile
              </button>{" "}
              to create a Seeker profile.
            </div>
          </div>
        )}

<nav className="space-y-1 flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
          {isSubcontractorView ? (
            <>
              <SidebarButton
                label="My Profile"
                active={activeTab === "editProfile"}
                onClick={() => setActiveTab("editProfile")}
              />
              <SidebarButton
                label="Badges"
                active={activeTab === "badges"}
                onClick={() => setActiveTab("badges")}
              />
              <SidebarButton
                label="Messages"
                active={activeTab === "messages"}
                onClick={() => setActiveTab("messages")}
              />
              <SidebarButton
                label="Hierarchy"
                active={activeTab === "hierarchy"}
                onClick={() => setActiveTab("hierarchy")}
              />
            </>
          ) : (
            <>
              <SidebarButton
                label="Dashboard"
                active={activeTab === "dashboard"}
                onClick={() => setActiveTab("dashboard")}
              />
              <SidebarButton
                label="Find Retainers"
                active={activeTab === "find"}
                onClick={() => {
                  setActiveTab("find");
                  setActionTab("wheel");
                }}
              />
              <SidebarButton
                label="Action"
                active={activeTab === "action"}
                onClick={() => setActiveTab("action")}
              />
              <SidebarButton
                label="Linking"
                active={activeTab === "linking"}
                onClick={() => setActiveTab("linking")}
              />
              <SidebarButton
                label="Badges"
                active={activeTab === "badges"}
                onClick={() => setActiveTab("badges")}
              />
              <SidebarButton
                label="Messaging Center"
                active={activeTab === "messages"}
                onClick={() => setActiveTab("messages")}
              />
            </>
          )}
        </nav>
        <div className="pt-3 border-t border-slate-800 mt-3">
          <SidebarButton label="Log out" active={false} onClick={handleLogout} />
        </div>
      </aside>

      {/* Main content */}

      <main className="flex-1 min-h-0 flex flex-col relative">
        <div className="lg:hidden border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
          <div className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  Snap Driver
                </div>
                <div className="text-lg font-semibold text-slate-50">Seeker Portal</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    Section
                  </div>
                  <div className="text-sm font-semibold text-slate-200">{headerTitle}</div>
                  <div className="text-[11px] text-slate-500">{headerSubtitle}</div>
                </div>
                <button
                  type="button"
                  aria-label="Open menu"
                  onClick={() => setIsMobileNavOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center flex-col gap-1 rounded-full border border-slate-800 bg-slate-900/60 text-slate-200 hover:text-slate-50"
                >
                  <span className="sr-only">Open menu</span>
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                </button>
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
              className="absolute inset-0 bg-slate-950/70"
            />
            <div className="absolute inset-y-0 left-0 w-72 bg-slate-950 border-r border-slate-800 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Snap Driver</div>
                  <div className="text-sm font-semibold text-slate-100">Seeker Menu</div>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setIsMobileNavOpen(false)}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-slate-800 text-slate-200 hover:text-slate-50"
                >
                  X
                </button>
              </div>
              <div className="space-y-4 mb-6">
                {currentSeeker ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                      Your Profile
                    </div>
                    <div className="font-semibold text-slate-50 truncate">
                      {formatSeekerName(currentSeeker)}
                    </div>
                    <div className="text-xs text-slate-400">
                      Status:{" "}
                      <span className="font-medium text-emerald-400">{currentSeeker.status}</span>
                    </div>
                    {!isSubcontractorView && currentSeekerId && (
                      <div>
                        <Link
                          to={`/seekers/${currentSeekerId}`}
                          className="text-[11px] text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
                        >
                          View profile
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                      Get started
                    </div>
                    <div className="text-sm text-slate-200">
                      You&apos;re not currently acting as any Seeker. Use{" "}
                      <button
                        type="button"
                        onClick={() => openActionTab("editProfile")}
                        className="font-semibold text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline"
                      >
                        Edit Profile
                      </button>{" "}
                      to create a Seeker profile.
                    </div>
                  </div>
                )}
              </div>
<nav className="space-y-2">
                {isSubcontractorView ? (
                  <>
                    <SidebarButton
                      label="My Profile"
                      active={activeTab === "editProfile"}
                      onClick={() => {
                        setActiveTab("editProfile");
                        setIsMobileNavOpen(false);
                      }}
                    />
                    <SidebarButton
                      label="Badges"
                      active={activeTab === "badges"}
                      onClick={() => {
                        setActiveTab("badges");
                        setIsMobileNavOpen(false);
                      }}
                    />
                    <SidebarButton
                      label="Messages"
                      active={activeTab === "messages"}
                      onClick={() => {
                        setActiveTab("messages");
                        setIsMobileNavOpen(false);
                      }}
                    />
                    <SidebarButton
                      label="Hierarchy"
                      active={activeTab === "hierarchy"}
                      onClick={() => {
                        setActiveTab("hierarchy");
                        setIsMobileNavOpen(false);
                      }}
                    />
                  </>
                ) : (
                  <>
                    <SidebarButton
                      label="Dashboard"
                      active={activeTab === "dashboard"}
                      onClick={() => {
                        setActiveTab("dashboard");
                        setIsMobileNavOpen(false);
                      }}
                    />
                    <SidebarButton
                      label="Find Retainers"
                      active={activeTab === "find"}
                      onClick={() => {
                        setActiveTab("find");
                        setActionTab("wheel");
                        setIsMobileNavOpen(false);
                      }}
                    />
                    <SidebarButton
                      label="Action"
                      active={activeTab === "action"}
                      onClick={() => {
                        setActiveTab("action");
                        setIsMobileNavOpen(false);
                      }}
                    />
                    <SidebarButton
                      label="Linking"
                      active={activeTab === "linking"}
                      onClick={() => {
                        setActiveTab("linking");
                        setIsMobileNavOpen(false);
                      }}
                    />
                    <SidebarButton
                      label="Badges"
                      active={activeTab === "badges"}
                      onClick={() => {
                        setActiveTab("badges");
                        setIsMobileNavOpen(false);
                      }}
                    />
                    <SidebarButton
                      label="Messages"
                      active={activeTab === "messages"}
                      onClick={() => {
                        setActiveTab("messages");
                        setIsMobileNavOpen(false);
                      }}
                    />
                  </>
                )}
              </nav>
              <div className="pt-4 mt-4 border-t border-slate-800">
                <SidebarButton
                  label="Log out"
                  active={false}
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    handleLogout();
                  }}
                />
              </div>
              </div>
          </div>
        )}

        <header className="hidden lg:block px-6 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
          <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-50">{headerTitle}</h2>
              <p className="text-sm text-slate-400 mt-1">{headerSubtitle}</p>
            </div>
          </div>
        </header>
        <section
          className={[
            "flex-1 min-h-0 p-4 lg:pt-6 lg:px-6 lg:pb-6",
            activeTab === "messages" || activeTab === "dashboard" || activeTab === "linking" || activeTab === "action" ? "flex flex-col overflow-y-auto lg:overflow-hidden" : "overflow-y-auto",
            activeTab === "dashboard" || activeTab === "linking" ? "pb-36" : "",
          ].join(" ")}
        >
          <div
            className={[
              "max-w-screen-2xl mx-auto w-full",
              activeTab === "messages" || activeTab === "dashboard" || activeTab === "linking" || activeTab === "action" ? "flex-1 min-h-0 flex flex-col" : "space-y-6",
            ].join(" ")}
          >
            {activeTab === "dashboard" && !isSubcontractorView && (
              <DashboardView
                seekerId={currentSeekerId}
                retainers={retainers}
                currentSeeker={currentSeeker}
                isDesktop={isDesktop}
                onToast={(msg) => setToastMessage(msg)}
                onGoToMessages={() => setActiveTab("messages")}
                onGoToRoutes={() => openActionTab("routes")}
                onGoToLinking={() => setActiveTab("linking")}
                onGoToBadges={() => setActiveTab("badges")}
                onComposeMessage={(draft) => setComposeDraft(draft)}
              />
            )}

                        {activeTab === "find" && !isSubcontractorView && (
              <ActionView
                actionTab={actionTab}
                onChangeTab={setActionTab}
                seekerId={currentSeekerId}
                currentSeeker={currentSeeker}
                isDesktop={isDesktop}
                linkTick={linkTick}
                setLinkTick={setLinkTick}
                retainers={retainers}
                subcontractors={subcontractors}
                wheelRetainers={wheelRetainers}
                excellentRetainers={retainerBuckets.excellent}
                possibleRetainers={retainerBuckets.possible}
                notNowRetainers={retainerBuckets.notNow}
                selectedRetainerIds={selectedRetainerIds}
                onToggleSelectedRetainer={toggleSelectedRetainer}
                onSelectAllRetainers={selectAllRetainersInLists}
                onClearSelectedRetainers={clearSelectedRetainers}
                onBulkMessageSelected={bulkMessageSelectedRetainers}
                onBulkRequestLinkSelected={bulkRequestLinksForSelectedRetainers}
                onBulkReturnToWheelSelected={bulkReturnSelectedRetainersToWheel}
                onClassifyRetainer={handleClassifyRetainer}
                onOpenProfile={handleOpenRetainerProfileFromAction}
                onReturnToWheel={handleReturnRetainerToWheel}
                onRebucketById={handleRebucketById}
                onMessage={handleMessageRetainer}
                onToast={(msg) => setToastMessage(msg)}
                onSeekerCreated={handleSeekerCreated}
                onSeekerUpdated={handleSeekerUpdated}
                onCreateSubcontractor={(input) => {
                  if (!currentSeeker) return;
                  const created = addSubcontractor(currentSeeker.id, input);
                  if (!created) {
                    setToastMessage("Cannot add subcontractor: plan limit reached.");
                    return;
                  }
                  refreshSeekersAndSession();
                }}
                onRemoveSubcontractor={(id) => {
                  if (!currentSeeker) return;
                  removeSubcontractor(currentSeeker.id, id);
                  refreshSeekersAndSession();
                }}
                onUpdateHierarchyNodes={(nodes) => {
                  if (!currentSeeker) return;
                  setSeekerHierarchyNodes(currentSeeker.id, nodes);
                  refreshSeekersAndSession();
                }}
                visibleTabs={["wheel", "lists"]}
              />
            )}

{activeTab === "action" && !isSubcontractorView && (
              <ActionView
                actionTab={actionTab}
                onChangeTab={setActionTab}
                seekerId={currentSeekerId}
                currentSeeker={currentSeeker}
                isDesktop={isDesktop}
                linkTick={linkTick}
                setLinkTick={setLinkTick}
                retainers={retainers}
                subcontractors={subcontractors}
                wheelRetainers={wheelRetainers}
                excellentRetainers={retainerBuckets.excellent}
                possibleRetainers={retainerBuckets.possible}
                notNowRetainers={retainerBuckets.notNow}
                selectedRetainerIds={selectedRetainerIds}
                onToggleSelectedRetainer={toggleSelectedRetainer}
                onSelectAllRetainers={selectAllRetainersInLists}
                onClearSelectedRetainers={clearSelectedRetainers}
                onBulkMessageSelected={bulkMessageSelectedRetainers}
                onBulkRequestLinkSelected={bulkRequestLinksForSelectedRetainers}
                onBulkReturnToWheelSelected={bulkReturnSelectedRetainersToWheel}
                onClassifyRetainer={handleClassifyRetainer}
                onOpenProfile={handleOpenRetainerProfileFromAction}
                onReturnToWheel={handleReturnRetainerToWheel}
                onRebucketById={handleRebucketById}
                onMessage={handleMessageRetainer}
                visibleTabs={["routes", "schedule", "editProfile", "addSubcontractor", "hierarchy"]}
                onToast={(msg) => setToastMessage(msg)}
                onSeekerCreated={handleSeekerCreated}
                onSeekerUpdated={handleSeekerUpdated}
                onCreateSubcontractor={(input) => {
                  if (!currentSeeker) return;
                  const created = addSubcontractor(currentSeeker.id, input);
                  if (!created) {
                    setToastMessage(
                      "Cannot add subcontractor: plan limit reached."
                    );
                    return;
                  }
                  refreshSeekersAndSession();
                }}
                onRemoveSubcontractor={(id) => {
                  if (!currentSeeker) return;
                  removeSubcontractor(currentSeeker.id, id);
                  refreshSeekersAndSession();
                }}
                onUpdateHierarchyNodes={(nodes) => {
                  if (!currentSeeker) return;
                  setSeekerHierarchyNodes(currentSeeker.id, nodes);
                  refreshSeekersAndSession();
                }}
              />
            )}

            {activeTab === "linking" && !isSubcontractorView && (
              <SeekerLinkingView
                seekerId={currentSeekerId}
                retainers={approvedRetainers}
                onMessage={handleMessageRetainer}
                onToast={(msg) => setToastMessage(msg)}
              />
            )}

            {activeTab === "badges" && (
              <>
                {badgesReturnTo && (
                  <button type="button" onClick={handleBadgesBack} className="btn">
                    ? Back to Profile
                  </button>
                )}
                <Suspense fallback={<div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-400">Loading badges?</div>}>
                  <LazyBadgesCenter
                    role="SEEKER"
                    ownerId={currentSeekerId}
                    readOnly={isSubcontractorView}
                  />
                </Suspense>
              </>
            )}

            {activeTab === "editProfile" && isSubcontractorView && (
              <SubcontractorProfileView subcontractor={activeSubcontractor} />
            )}

            {activeTab === "messages" &&
              (isSubcontractorView ? (
                <div className="flex-1 min-h-0 min-w-0">
                  <SubcontractorMessagingView
                    masterSeeker={currentSeeker}
                    subcontractor={activeSubcontractor}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-4">
                  <div className="flex-1 min-h-0">
                    <Suspense fallback={<div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-400">Loading messages?</div>}>
                      <LazySeekerMessagingCenter
                        currentSeeker={currentSeeker}
                        retainers={retainers}
                        subcontractors={subcontractors}
                      />
                    </Suspense>
                  </div>
                  {!isDesktop && (
                    <SeekerFeedPanel
                      seekerId={currentSeekerId}
                      retainers={retainers}
                      linkTick={linkTick}
                      onToast={(msg) => setToastMessage(msg)}
                      onComposeMessage={(draft) => setComposeDraft(draft)}
                      onGoToRoutes={() => openActionTab("routes")}
                      className="min-h-[320px]"
                    />
                  )}
                </div>
              ))}

            {activeTab === "hierarchy" && isSubcontractorView && (
              <SeekerHierarchyView
                seeker={currentSeeker}
                subcontractors={subcontractors}
                readOnly={true}
                onUpdateNodes={() => undefined}
              />
            )}
          </div>
        </section>

        {/* ? Compose pop-out (bottom-right) */}
        {composeDraft && (
          <ComposeMessagePopover
            seeker={currentSeeker ?? null}
            retainer={composeDraft.retainer}
            initialSubject={composeDraft.initialSubject}
            initialBody={composeDraft.initialBody}
            messageFlag={composeDraft.messageFlag}
            onSent={composeDraft.onSent}
            onClose={() => setComposeDraft(null)}
          />
        )}

        {bulkComposeTargets && (
          <BulkComposeMessagePopover
            count={bulkComposeTargets.length}
            onClose={() => setBulkComposeTargets(null)}
            onSend={(subject, body) => {
              if (!currentSeekerId) return;
              let sent = 0;
              for (const r of bulkComposeTargets) {
                try {
                  createConversationWithFirstMessage({
                    seekerId: currentSeekerId,
                    retainerId: r.id,
                    subject,
                    body,
                    senderRole: "SEEKER",
                  });
                  sent += 1;
                } catch (err) {
                  console.error(err);
                }
              }
              setBulkComposeTargets(null);
              setToastMessage(
                sent === 1 ? "Message sent." : `Messages sent to ${sent} retainers.`
              );
            }}
          />
        )}

        {/* Toast for wheel/bucket moves */}
        {toastMessage && (
          <div className="fixed inset-x-0 bottom-4 flex justify-center z-50 pointer-events-none">
            <div className="px-4 py-2 rounded-full bg-slate-900/90 border border-emerald-500/60 text-xs text-slate-50 shadow-lg">
              {toastMessage}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Sidebar button                                                     */
/* ------------------------------------------------------------------ */

const SidebarButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-start justify-between gap-2 px-3 py-2 rounded-xl text-sm transition min-w-0",
        active
          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
          : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-50 border border-transparent",
      ].join(" ")}
    >
      <span className="min-w-0 text-left leading-snug whitespace-normal">{label}</span>
      {active && (
        <span className="text-[10px] uppercase tracking-wide text-emerald-300">
          Active
        </span>
      )}
    </button>
  );
};

const ChangePasswordPanel: React.FC<{ email?: string | null }> = ({ email }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const handleChange = async () => {
    setError(null);
    setStatus(null);
    if (!currentPassword || !newPassword) {
      setError("Enter your current and new password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await changePassword({ currentPassword, newPassword });
      setStatus("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to update password.");
    }
  };

  const handleReset = async () => {
    setError(null);
    setStatus(null);
    if (!email) {
      setError("Add an email to your profile first.");
      return;
    }
    try {
      const res = await resetPassword({ email });
      setResetLink(res.magicLink);
      setStatus(`Reset link created. Expires ${new Date(res.expiresAt).toLocaleString()}.`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to create reset link.");
    }
  };

  const handleCopy = async () => {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink);
      setStatus("Reset link copied.");
    } catch {
      setStatus("Reset link ready to copy.");
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400">Password</div>
        <div className="text-sm text-slate-300">Change your password or generate a reset link.</div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <input
          type={showPassword ? "text" : "password"}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <input
          type={showPassword ? "text" : "password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <input
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleChange}
          className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition"
        >
          Update password
        </button>
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="px-3 py-1.5 rounded-full text-[11px] border border-slate-700 text-slate-200 hover:text-slate-50"
        >
          {showPassword ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1.5 rounded-full text-[11px] border border-amber-500/40 text-amber-100 bg-amber-500/10 hover:bg-amber-500/20"
        >
          Send reset link
        </button>
        {resetLink && (
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-full text-[11px] border border-slate-700 text-slate-200 hover:text-slate-50"
          >
            Copy reset link
          </button>
        )}
      </div>
      {status && <div className="text-xs text-emerald-200">{status}</div>}
      {error && <div className="text-xs text-rose-300">{error}</div>}
      {resetLink && (
        <div className="text-[11px] text-slate-500 break-all">{resetLink}</div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Dashboard overview                                                 */
/* ------------------------------------------------------------------ */

type SeekerFeedPanelProps = {
  seekerId: string | null;
  retainers: Retainer[];
  linkTick: number;
  onToast: (message: string) => void;
  onComposeMessage: (draft: ComposeDraft) => void;
  onGoToRoutes: () => void;
  className?: string;
};

const SeekerFeedPanel: React.FC<SeekerFeedPanelProps> = ({
  seekerId,
  retainers,
  linkTick,
  onToast,
  onComposeMessage,
  onGoToRoutes,
  className,
}) => {
  const retainerById = useMemo(
    () => new Map<string, Retainer>(retainers.map((r) => [r.id, r])),
    [retainers]
  );

  const activeLinkRetainerIds = useMemo(() => {
    if (!seekerId) return new Set<string>();
    return new Set(
      getLinksForSeeker(seekerId)
        .filter((l) => l.status === "ACTIVE")
        .map((l) => l.retainerId)
    );
  }, [seekerId, linkTick]);

  const [feedTick, setFeedTick] = useState(0);
  const [feedFilter, setFeedFilter] = useState<"ALL" | "BROADCAST" | "ROUTE" | "UPDATE">(
    "ALL"
  );
  const [expandedFeedKey, setExpandedFeedKey] = useState<string | null>(null);
  const feedItems = useMemo(() => {
    const all = seekerId ? getFeedForSeeker(seekerId) : [];
    return all.filter((it) => {
      const r = retainerById.get(it.retainerId);
      return !!r && (r as any).status === "APPROVED";
    });
  }, [seekerId, feedTick, retainerById]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = () => setFeedTick((n) => n + 1);
    window.addEventListener(ROUTE_RESPONSES_EVENT, handle);
    window.addEventListener(POST_RESPONSES_EVENT, handle);
    window.addEventListener(FEED_REACTIONS_EVENT, handle);
    return () => {
      window.removeEventListener(ROUTE_RESPONSES_EVENT, handle);
      window.removeEventListener(POST_RESPONSES_EVENT, handle);
      window.removeEventListener(FEED_REACTIONS_EVENT, handle);
    };
  }, []);

  useEffect(() => {
    if (!seekerId || typeof window === "undefined") return;
    const raw = window.localStorage.getItem("snapdriver_feed_jump");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { role?: string; kind?: string; id?: string };
      if (parsed?.role !== "SEEKER" || !parsed.kind || !parsed.id) return;
      setExpandedFeedKey(`${parsed.kind}:${parsed.id}`);
      if (parsed.kind === "ROUTE") setFeedFilter("ROUTE");
      else if (parsed.kind === "BROADCAST") setFeedFilter("BROADCAST");
      else setFeedFilter("UPDATE");
      window.localStorage.removeItem("snapdriver_feed_jump");
    } catch {
      // ignore
    }
  }, [seekerId, feedItems]);

  const filteredFeedItems = useMemo(() => {
    if (feedFilter === "ALL") return feedItems;
    if (feedFilter === "BROADCAST") {
      return feedItems.filter((it) => it.kind === "BROADCAST");
    }
    if (feedFilter === "ROUTE") {
      return feedItems.filter((it) => it.kind === "ROUTE");
    }
    return feedItems.filter((it) => it.kind === "POST");
  }, [feedFilter, feedItems]);

  const visibleFeedItems = useMemo(
    () => filteredFeedItems.slice(0, 12),
    [filteredFeedItems]
  );

  const fmtWhen = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  const feedWhen = (it: FeedItem) =>
    it.kind === "BROADCAST" ? it.createdAt : (it as any).updatedAt;

  const feedTitle = (it: FeedItem) => {
    if (it.kind === "POST") return it.post.title || "Post";
    if (it.kind === "ROUTE") return it.route.title || "Route";
    return it.broadcast.subject || "Broadcast";
  };

  const feedBadge = (it: FeedItem) =>
    it.kind === "POST" ? it.post.type : it.kind === "ROUTE" ? "ROUTE" : "BROADCAST";

  const feedKey = (it: FeedItem) => `${it.kind}:${it.id}`;

  const toggleFeedItem = (it: FeedItem) => {
    const key = feedKey(it);
    setExpandedFeedKey((prev) => (prev === key ? null : key));
  };

  const responseLabel = (type?: RouteResponseType | PostResponseType | null) => {
    if (!type) return null;
    if (type === "DIRECT_MESSAGE") return "Direct message";
    if (type === "INTERESTED") return "Interested";
    if (type === "REQUEST_INFO") return "Request info";
    if (type === "NOT_INTERESTED") return "Not interested";
    return null;
  };

  const reactionLabel = (type?: FeedReactionType | null) => {
    if (!type) return null;
    const match = FEED_REACTION_OPTIONS.find((opt) => opt.type === type);
    return match ? match.label : type;
  };

  const handleRouteResponse = (
    route: Route,
    retainerId: string,
    type: RouteResponseType,
    canDirectMessage: boolean
  ) => {
    if (!seekerId) return;
    if (type === "DIRECT_MESSAGE") {
      if (!canDirectMessage) {
        onToast("Direct message is available after the link is approved.");
        return;
      }
      const retainer = retainerById.get(retainerId);
      if (!retainer) {
        onToast("Retainer profile not found.");
        return;
      }
      const subject = route.title || "Route";
      const body = `Hi ${retainer.companyName || "there"}, I am interested in "${subject}" and would like to learn more.`;
      onComposeMessage({
        retainer,
        initialSubject: subject,
        initialBody: body,
        messageFlag: `FEED:ROUTE:${route.id}`,
        onSent: () => {
          recordRouteResponse({
            routeId: route.id,
            retainerId,
            seekerId,
            type: "DIRECT_MESSAGE",
          });
        },
      });
      return;
    }

    recordRouteResponse({
      routeId: route.id,
      retainerId,
      seekerId,
      type,
    });
  };

  const handlePostResponse = (
    post: RetainerPost,
    retainerId: string,
    type: PostResponseType,
    canDirectMessage: boolean
  ) => {
    if (!seekerId) return;
    if (type === "DIRECT_MESSAGE") {
      if (!canDirectMessage) {
        onToast("Direct message is available after the link is approved.");
        return;
      }
      const retainer = retainerById.get(retainerId);
      if (!retainer) {
        onToast("Retainer profile not found.");
        return;
      }
      const subject = post.title || "Post";
      const body = `Hi ${retainer.companyName || "there"}, I am interested in "${subject}" and would like to learn more.`;
      onComposeMessage({
        retainer,
        initialSubject: subject,
        initialBody: body,
        messageFlag: `FEED:POST:${post.id}`,
        onSent: () => {
          recordPostResponse({
            postId: post.id,
            retainerId,
            seekerId,
            type: "DIRECT_MESSAGE",
          });
        },
      });
      return;
    }

    recordPostResponse({
      postId: post.id,
      retainerId,
      seekerId,
      type,
    });
  };

  const handleFeedReaction = (
    itemKind: FeedReactionItemKind,
    itemId: string,
    retainerId: string,
    type: FeedReactionType
  ) => {
    if (!seekerId) return;
    recordFeedReaction({
      itemKind,
      itemId,
      retainerId,
      seekerId,
      type,
    });
  };

  const renderResponseButtons = (args: {
    currentType: RouteResponseType | PostResponseType | null;
    onSelect: (type: RouteResponseType) => void;
    canDirectMessage: boolean;
  }) => {
    const actions: Array<{ type: RouteResponseType; label: string }> = [
      { type: "DIRECT_MESSAGE", label: "Direct message" },
      { type: "INTERESTED", label: "Interested" },
      { type: "REQUEST_INFO", label: "Request info" },
      { type: "NOT_INTERESTED", label: "Not interested" },
    ];

    return (
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const isActive = args.currentType === action.type;
          const disabled = action.type === "DIRECT_MESSAGE" && !args.canDirectMessage;
          return (
            <button
              key={action.type}
              type="button"
              onClick={() => {
                if (disabled) return;
                args.onSelect(action.type);
              }}
              className={[
                "px-3 py-1 rounded-full text-[11px] border transition",
                isActive
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"
                  : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
                disabled ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
              title={
                disabled
                  ? "Direct message is available after the link is approved"
                  : ""
              }
            >
              {action.label}
            </button>
          );
        })}
      </div>
    );
  };

  const renderReactionButtons = (args: {
    currentType: FeedReactionType | null;
    onSelect: (type: FeedReactionType) => void;
  }) => (
    <div className="flex flex-wrap gap-2">
      {FEED_REACTION_OPTIONS.map((opt) => {
        const isActive = args.currentType === opt.type;
        return (
          <button
            key={opt.type}
            type="button"
            onClick={() => args.onSelect(opt.type)}
            className={[
              "px-3 py-1 rounded-full text-[11px] border transition",
              isActive
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"
                : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const renderFeedDetails = (it: FeedItem) => {
    if (it.kind === "POST") {
      return (
        <div className="text-sm text-slate-200 whitespace-pre-wrap">
          {it.post.body}
        </div>
      );
    }

    if (it.kind === "ROUTE") {
      const route = it.route;
      const cityState = [route.city, route.state].filter(Boolean).join(", ");
      const pay =
        route.payMin != null || route.payMax != null
          ? `${route.payModel || "Pay"}: ${
              route.payMin != null ? `$${route.payMin}` : "-"
            }${route.payMax != null ? `-$${route.payMax}` : ""}`
          : null;

      return (
        <div className="space-y-2 text-sm text-slate-200">
          {cityState && (
            <div>
              <span className="text-slate-400">Location: </span>
              {cityState}
            </div>
          )}
          {route.vertical && (
            <div>
              <span className="text-slate-400">Vertical: </span>
              {route.vertical}
            </div>
          )}
          {route.schedule && (
            <div>
              <span className="text-slate-400">Schedule: </span>
              {route.schedule}
            </div>
          )}
          {route.openings != null && (
            <div>
              <span className="text-slate-400">Openings: </span>
              {route.openings}
            </div>
          )}
          {pay && (
            <div>
              <span className="text-slate-400">Pay: </span>
              {pay}
            </div>
          )}
          {route.requirements && (
            <div className="whitespace-pre-wrap">
              <span className="text-slate-400">Requirements: </span>
              {route.requirements}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="text-sm text-slate-200 whitespace-pre-wrap">
        {it.broadcast.body}
      </div>
    );
  };

  const panelClassName = [
    "rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col min-h-0 w-full",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={panelClassName}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Feed
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Broadcasts, routes, and updates from Retainers.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onGoToRoutes}
            className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition whitespace-nowrap"
          >
            View routes
          </button>
          <button
            type="button"
            onClick={() => setFeedTick((n) => n + 1)}
            className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition whitespace-nowrap"
          >
            Refresh
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(
          [
            { key: "ALL", label: "All" },
            { key: "BROADCAST", label: "Broadcasts" },
            { key: "ROUTE", label: "Routes" },
            { key: "UPDATE", label: "Updates" },
          ] as const
        ).map((item) => {
          const isActive = feedFilter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFeedFilter(item.key)}
              className={[
                "px-3 py-1 rounded-full text-[11px] border transition",
                isActive
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"
                  : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {!seekerId ? (
        <div className="mt-3 text-xs text-slate-400">
          Select or create a Seeker profile to see your feed.
        </div>
      ) : visibleFeedItems.length === 0 ? (
        <div className="mt-3 text-xs text-slate-400">
          No recent activity yet. Try linking with a Retainer or check Routes.
        </div>
      ) : (
        <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">
          <ul className="space-y-2">
            {visibleFeedItems.map((it) => {
              const r = retainerById.get(it.retainerId);
              const retainerName = r?.companyName || "Retainer";
              const when = feedWhen(it);
              const badge = feedBadge(it);
              const key = feedKey(it);
              const isExpanded = expandedFeedKey === key;
              const isAd = it.kind === "POST" && it.post.type === "AD";
              const isUpdate = it.kind === "POST" && it.post.type === "UPDATE";
              const isBroadcast = it.kind === "BROADCAST";
              const routeResponse =
                seekerId && it.kind === "ROUTE"
                  ? getRouteResponseForSeeker(it.route.id, seekerId)
                  : null;
              const postResponse =
                seekerId && isAd ? getPostResponseForSeeker(it.post.id, seekerId) : null;
              const reaction =
                seekerId && (isBroadcast || isUpdate)
                  ? getFeedReactionForSeeker(
                      isBroadcast ? "BROADCAST" : "POST",
                      isBroadcast ? it.id : it.post.id,
                      seekerId
                    )
                  : null;
              const responseText = responseLabel(
                routeResponse?.type || postResponse?.type || null
              );
              const reactionText = reactionLabel(reaction?.type || null);
              const canDirectMessage = activeLinkRetainerIds.has(it.retainerId);

              return (
                <li
                  key={key}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => toggleFeedItem(it)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-2">
                        <ProfileAvatar
                          role="RETAINER"
                          profile={(r ?? { id: it.retainerId }) as any}
                          name={retainerName}
                          size="lg"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-slate-300 truncate max-w-[180px]">
                              {retainerName}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-200 bg-slate-900/70">
                              {badge}
                            </span>
                          </div>
                          <div className="text-xs text-slate-100 font-medium truncate">
                            {feedTitle(it)}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {fmtWhen(when)}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200">
                          {isExpanded ? "Hide" : "View"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {(responseText || reactionText) && (
                    <div className="mt-2 text-[10px] text-slate-400">
                      {responseText && `Your response: ${responseText}`}
                      {responseText && reactionText ? " | " : ""}
                      {reactionText && `Your reaction: ${reactionText}`}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3 border-t border-slate-800 pt-3 space-y-3">
                      {renderFeedDetails(it)}

                      {it.kind === "ROUTE" && (
                        <div className="space-y-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">
                            Respond
                          </div>
                          {renderResponseButtons({
                            currentType: routeResponse?.type ?? null,
                            onSelect: (type) =>
                              handleRouteResponse(it.route, it.retainerId, type, canDirectMessage),
                            canDirectMessage,
                          })}
                        </div>
                      )}

                      {isAd && (
                        <div className="space-y-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">
                            Respond
                          </div>
                          {renderResponseButtons({
                            currentType: postResponse?.type ?? null,
                            onSelect: (type) =>
                              handlePostResponse(it.post, it.retainerId, type, canDirectMessage),
                            canDirectMessage,
                          })}
                        </div>
                      )}

                      {(isBroadcast || isUpdate) && (
                        <div className="space-y-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">
                            React
                          </div>
                          {renderReactionButtons({
                            currentType: reaction?.type ?? null,
                            onSelect: (type) =>
                              handleFeedReaction(
                                isBroadcast ? "BROADCAST" : "POST",
                                isBroadcast ? it.id : it.post.id,
                                it.retainerId,
                                type
                              ),
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {filteredFeedItems.length > visibleFeedItems.length && (
        <div className="text-[11px] text-slate-500 mt-2">
          Showing {visibleFeedItems.length} of {filteredFeedItems.length}.
        </div>
      )}
    </div>
  );
};

const DashboardView: React.FC<{
  seekerId: string | null;
  retainers: Retainer[];
  currentSeeker?: Seeker;
  isDesktop: boolean;
  onToast: (message: string) => void;
  onGoToMessages: () => void;
  onGoToRoutes: () => void;
  onGoToLinking: () => void;
  onGoToBadges: () => void;
  onComposeMessage: (draft: ComposeDraft) => void;
}> = ({
  seekerId,
  retainers,
  currentSeeker,
  isDesktop,
  onToast,
  onGoToMessages,
  onGoToRoutes,
  onGoToLinking,
  onGoToBadges,
  onComposeMessage,
}) => {
  const stats = useMemo(() => {
    if (!seekerId) {
      return {
        activeLinks: 0,
        unreadMessages: 0,
        interestedRoutes: 0,
        badgeApprovals: 0,
        scheduledEvents: 0,
        approvalTotals: { yes: 0, no: 0, neutral: 0, total: 0 },
      };
    }

    const links = getLinksForSeeker(seekerId);
    const activeLinks = links.filter((l) => l.status === "ACTIVE").length;

    const unreadMessages = getConversationsForSeeker(seekerId).reduce(
      (sum, c) => sum + (c.seekerUnreadCount || 0),
      0
    );

    const interestedRoutes = getInterestsForSeeker(seekerId).length;
    const badgeApprovals = getPendingBadgeApprovalsForProfile({
      ownerRole: "SEEKER",
      ownerId: seekerId,
    }).count;

    const now = Date.now();
    const scheduledEvents = links.reduce((sum, link) => {
      const acceptedId = link.meetingAcceptedProposalId;
      if (!acceptedId) return sum;
      const proposal = (link.meetingProposals || []).find((p) => p.id === acceptedId);
      if (!proposal) return sum;
      return Date.parse(proposal.startAt) > now ? sum + 1 : sum;
    }, 0);

    const approvalTotals = (() => {
      const totals = { yes: 0, no: 0, neutral: 0, total: 0 };
      const checkins = getBadgeCheckins().filter(
        (c) => c.targetRole === "SEEKER" && c.targetId === seekerId
      );
      for (const checkin of checkins) {
        if (checkin.status === "DISPUTED") {
          totals.neutral += 1;
          continue;
        }
        const value = checkin.overrideValue ?? checkin.value;
        if (value === "YES") totals.yes += 1;
        else if (value === "NO") totals.no += 1;
        else totals.neutral += 1;
      }
      totals.total = totals.yes + totals.no + totals.neutral;
      return totals;
    })();

    return {
      activeLinks,
      unreadMessages,
      interestedRoutes,
      badgeApprovals,
      scheduledEvents,
      approvalTotals,
    };
  }, [seekerId]);

  const retainerById = useMemo(
    () => new Map<string, Retainer>(retainers.map((r) => [r.id, r])),
    [retainers]
  );

  const [feedTick, setFeedTick] = useState(0);
  const [feedFilter, setFeedFilter] = useState<"ALL" | "BROADCAST" | "ROUTE" | "UPDATE">(
    "ALL"
  );
  const [expandedFeedKey, setExpandedFeedKey] = useState<string | null>(null);
  const feedItems = useMemo(() => {
    const all = getFeedForSeeker(seekerId);
    return all.filter((it) => {
      const r = retainerById.get(it.retainerId);
      return !!r && (r as any).status === "APPROVED";
    });
  }, [seekerId, feedTick, retainerById]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = () => setFeedTick((n) => n + 1);
    window.addEventListener(ROUTE_RESPONSES_EVENT, handle);
    window.addEventListener(POST_RESPONSES_EVENT, handle);
    window.addEventListener(FEED_REACTIONS_EVENT, handle);
    return () => {
      window.removeEventListener(ROUTE_RESPONSES_EVENT, handle);
      window.removeEventListener(POST_RESPONSES_EVENT, handle);
      window.removeEventListener(FEED_REACTIONS_EVENT, handle);
    };
  }, []);

  useEffect(() => {
    if (!seekerId || typeof window === "undefined") return;
    const raw = window.localStorage.getItem("snapdriver_feed_jump");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { role?: string; kind?: string; id?: string };
      if (parsed?.role !== "SEEKER" || !parsed.kind || !parsed.id) return;
      setExpandedFeedKey(`${parsed.kind}:${parsed.id}`);
      if (parsed.kind === "ROUTE") setFeedFilter("ROUTE");
      else if (parsed.kind === "BROADCAST") setFeedFilter("BROADCAST");
      else setFeedFilter("UPDATE");
      window.localStorage.removeItem("snapdriver_feed_jump");
    } catch {
      // ignore
    }
  }, [seekerId, feedItems]);

  const filteredFeedItems = useMemo(() => {
    if (feedFilter === "ALL") return feedItems;
    if (feedFilter === "BROADCAST") {
      return feedItems.filter((it) => it.kind === "BROADCAST");
    }
    if (feedFilter === "ROUTE") {
      return feedItems.filter((it) => it.kind === "ROUTE");
    }
    return feedItems.filter((it) => it.kind === "POST");
  }, [feedFilter, feedItems]);

  const visibleFeedItems = useMemo(
    () => filteredFeedItems.slice(0, 12),
    [filteredFeedItems]
  );

  const fmtWhen = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  const feedWhen = (it: FeedItem) =>
    it.kind === "BROADCAST" ? it.createdAt : (it as any).updatedAt;

  const feedTitle = (it: FeedItem) => {
    if (it.kind === "POST") return it.post.title || "Post";
    if (it.kind === "ROUTE") return it.route.title || "Route";
    return it.broadcast.subject || "Broadcast";
  };

  const feedBadge = (it: FeedItem) =>
    it.kind === "POST" ? it.post.type : it.kind === "ROUTE" ? "ROUTE" : "BROADCAST";

  const feedKey = (it: FeedItem) => `${it.kind}:${it.id}`;

  const toggleFeedItem = (it: FeedItem) => {
    const key = feedKey(it);
    setExpandedFeedKey((prev) => (prev === key ? null : key));
  };

  const responseLabel = (type?: RouteResponseType | PostResponseType | null) => {
    if (!type) return null;
    if (type === "DIRECT_MESSAGE") return "Direct message";
    if (type === "INTERESTED") return "Interested";
    if (type === "REQUEST_INFO") return "Request info";
    if (type === "NOT_INTERESTED") return "Not interested";
    return null;
  };

  const reactionLabel = (type?: FeedReactionType | null) => {
    if (!type) return null;
    const match = FEED_REACTION_OPTIONS.find((opt) => opt.type === type);
    return match ? match.label : type;
  };

  const handleRouteResponse = (
    route: Route,
    retainerId: string,
    type: RouteResponseType,
    canDirectMessage: boolean
  ) => {
    if (!seekerId) return;
    if (type === "DIRECT_MESSAGE") {
      if (!canDirectMessage) {
        onToast("Direct message is available after the link is approved.");
        return;
      }
      const retainer = retainerById.get(retainerId);
      if (!retainer) {
        onToast("Retainer profile not found.");
        return;
      }
      const subject = route.title || "Route";
      const body = `Hi ${retainer.companyName || "there"}, I am interested in "${subject}" and would like to learn more.`;
      onComposeMessage({
        retainer,
        initialSubject: subject,
        initialBody: body,
        messageFlag: `FEED:ROUTE:${route.id}`,
        onSent: () => {
          recordRouteResponse({
            routeId: route.id,
            retainerId,
            seekerId,
            type: "DIRECT_MESSAGE",
          });
        },
      });
      return;
    }

    recordRouteResponse({
      routeId: route.id,
      retainerId,
      seekerId,
      type,
    });
  };

  const handlePostResponse = (
    post: RetainerPost,
    retainerId: string,
    type: PostResponseType,
    canDirectMessage: boolean
  ) => {
    if (!seekerId) return;
    if (type === "DIRECT_MESSAGE") {
      if (!canDirectMessage) {
        onToast("Direct message is available after the link is approved.");
        return;
      }
      const retainer = retainerById.get(retainerId);
      if (!retainer) {
        onToast("Retainer profile not found.");
        return;
      }
      const subject = post.title || "Post";
      const body = `Hi ${retainer.companyName || "there"}, I am interested in "${subject}" and would like to learn more.`;
      onComposeMessage({
        retainer,
        initialSubject: subject,
        initialBody: body,
        messageFlag: `FEED:POST:${post.id}`,
        onSent: () => {
          recordPostResponse({
            postId: post.id,
            retainerId,
            seekerId,
            type: "DIRECT_MESSAGE",
          });
        },
      });
      return;
    }

    recordPostResponse({
      postId: post.id,
      retainerId,
      seekerId,
      type,
    });
  };

  const handleFeedReaction = (
    itemKind: FeedReactionItemKind,
    itemId: string,
    retainerId: string,
    type: FeedReactionType
  ) => {
    if (!seekerId) return;
    recordFeedReaction({
      itemKind,
      itemId,
      retainerId,
      seekerId,
      type,
    });
  };

  const renderResponseButtons = (args: {
    currentType: RouteResponseType | PostResponseType | null;
    onSelect: (type: RouteResponseType) => void;
    canDirectMessage: boolean;
  }) => {
    const actions: Array<{ type: RouteResponseType; label: string }> = [
      { type: "DIRECT_MESSAGE", label: "Direct message" },
      { type: "INTERESTED", label: "Interested" },
      { type: "REQUEST_INFO", label: "Request info" },
      { type: "NOT_INTERESTED", label: "Not interested" },
    ];

    return (
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const isActive = args.currentType === action.type;
          const disabled = action.type === "DIRECT_MESSAGE" && !args.canDirectMessage;
          return (
            <button
              key={action.type}
              type="button"
              onClick={() => {
                if (disabled) return;
                args.onSelect(action.type);
              }}
              className={[
                "px-3 py-1 rounded-full text-[11px] border transition",
                isActive
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"
                  : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
                disabled ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
              title={
                disabled
                  ? "Direct message is available after the link is approved"
                  : ""
              }
            >
              {action.label}
            </button>
          );
        })}
      </div>
    );
  };

  const renderReactionButtons = (args: {
    currentType: FeedReactionType | null;
    onSelect: (type: FeedReactionType) => void;
  }) => (
    <div className="flex flex-wrap gap-2">
      {FEED_REACTION_OPTIONS.map((opt) => {
        const isActive = args.currentType === opt.type;
        return (
          <button
            key={opt.type}
            type="button"
            onClick={() => args.onSelect(opt.type)}
            className={[
              "px-3 py-1 rounded-full text-[11px] border transition",
              isActive
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"
                : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const renderFeedDetails = (it: FeedItem) => {
    if (it.kind === "POST") {
      return (
        <div className="text-sm text-slate-200 whitespace-pre-wrap">
          {it.post.body}
        </div>
      );
    }

    if (it.kind === "ROUTE") {
      const route = it.route;
      const cityState = [route.city, route.state].filter(Boolean).join(", ");
      const pay =
        route.payMin != null || route.payMax != null
          ? `${route.payModel || "Pay"}: ${
              route.payMin != null ? `$${route.payMin}` : "-"
            }${route.payMax != null ? `-$${route.payMax}` : ""}`
          : null;

      return (
        <div className="space-y-2 text-sm text-slate-200">
          {cityState && (
            <div>
              <span className="text-slate-400">Location: </span>
              {cityState}
            </div>
          )}
          {route.vertical && (
            <div>
              <span className="text-slate-400">Vertical: </span>
              {route.vertical}
            </div>
          )}
          {route.schedule && (
            <div>
              <span className="text-slate-400">Schedule: </span>
              {route.schedule}
            </div>
          )}
          {route.openings != null && (
            <div>
              <span className="text-slate-400">Openings: </span>
              {route.openings}
            </div>
          )}
          {pay && (
            <div>
              <span className="text-slate-400">Pay: </span>
              {pay}
            </div>
          )}
          {route.requirements && (
            <div className="whitespace-pre-wrap">
              <span className="text-slate-400">Requirements: </span>
              {route.requirements}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="text-sm text-slate-200 whitespace-pre-wrap">
        {it.broadcast.body}
      </div>
    );
  };

  const pctFromCounts = (yesCount: number, noCount: number) => {
    const total = yesCount + noCount;
    if (total <= 0) return null;
    return Math.round((yesCount / total) * 100);
  };

  const pctValue = (value: number | null) => {
    if (value == null || Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(100, value));
  };

  const formatMemberSince = (value?: number | string | null) => {
    if (!value) return "-";
    const d = typeof value === "number" ? new Date(value) : new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  };

  const activeBadges = useMemo(() => {
    if (!seekerId) return [];
    const ids = getActiveBadges("SEEKER", seekerId);
    return ids
      .map((id) => getBadgeDefinition(id))
      .filter((b): b is NonNullable<typeof b> => Boolean(b))
      .slice(0, 3);
  }, [seekerId]);

  const seekerReputation = seekerId
    ? getReputationScoreForProfile({ ownerRole: "SEEKER", ownerId: seekerId })
    : null;

  const [linkTick, setLinkTick] = useState(0);
  const [scheduleLink, setScheduleLink] = useState<LinkingLink | null>(null);
  const [proposalAt, setProposalAt] = useState("");
  const [proposalDuration, setProposalDuration] = useState<number>(20);
  const [proposalNote, setProposalNote] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const pendingLinks = useMemo(() => {
    if (!seekerId) return [];
    return getLinksForSeeker(seekerId).filter((l) => l.status === "PENDING");
  }, [seekerId, linkTick]);

  const activeLinkRetainerIds = useMemo(() => {
    if (!seekerId) return new Set<string>();
    return new Set(
      getLinksForSeeker(seekerId)
        .filter((l) => l.status === "ACTIVE")
        .map((l) => l.retainerId)
    );
  }, [seekerId, linkTick]);

  const seekerDisplayName = currentSeeker ? formatSeekerName(currentSeeker) : "Seeker";
  const seekerCompany = currentSeeker?.companyName || "Independent Seeker";

  const profileCard = (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 min-h-[240px]">
      <div className="flex items-start gap-4">
        <div className="w-1/3 max-w-[140px] min-w-[96px]">
          <div className="aspect-square rounded-2xl border border-slate-800 bg-slate-950/60 p-1.5">
            <ProfileAvatar
              role="SEEKER"
              profile={(currentSeeker ?? { id: seekerId || "seeker" }) as any}
              name={seekerDisplayName}
              size="lg"
              className="h-full w-full rounded-xl"
            />
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="text-lg font-semibold text-slate-50 truncate">
            {seekerId ? seekerDisplayName : "Seeker"}
          </div>
          <div className="text-sm text-slate-300 truncate">
            {seekerId ? seekerCompany : "Select a Seeker profile"}
          </div>
          <div className="text-sm text-emerald-200">
            {seekerReputation?.score == null
              ? "Reputation -"
              : `Reputation ${seekerReputation.score}`}
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-400/80"
              style={{ width: `${seekerReputation?.scorePercent ?? 0}%` }}
            />
          </div>
          <div className="text-xs text-slate-500">
            Member since {formatMemberSince(currentSeeker?.createdAt)}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-emerald-200">Yes</div>
              <div className="text-sm font-semibold text-emerald-50">
                {stats.approvalTotals.yes}/{stats.approvalTotals.total || 0}
              </div>
            </div>
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-rose-200">No</div>
              <div className="text-sm font-semibold text-rose-50">
                {stats.approvalTotals.no}/{stats.approvalTotals.total || 0}
              </div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-slate-300">Neutral</div>
              <div className="text-sm font-semibold text-slate-100">
                {stats.approvalTotals.neutral}/{stats.approvalTotals.total || 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-0 sm:gap-4 lg:gap-6 lg:grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_420px] lg:items-stretch flex-1 min-h-0 lg:h-full w-full max-w-full">
      <div className="flex flex-col gap-6 min-h-0 order-2 lg:order-1 w-full max-w-full">
        {!isDesktop && profileCard}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Now
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Quick links and live activity for this profile.
              </div>
            </div>
            <button
              type="button"
              onClick={onGoToMessages}
              className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition"
            >
              Open inbox
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <button
              type="button"
              onClick={onGoToLinking}
              disabled={!seekerId}
              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:bg-slate-900/70 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Links</div>
              <div className="text-xl font-semibold text-slate-50">{stats.activeLinks}</div>
            </button>
            <button
              type="button"
              onClick={onGoToLinking}
              disabled={!seekerId}
              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:bg-slate-900/70 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Pending links</div>
              <div className="text-xl font-semibold text-slate-50">{pendingLinks.length}</div>
            </button>
            <button
              type="button"
              onClick={onGoToMessages}
              disabled={!seekerId}
              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:bg-slate-900/70 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Unread</div>
              <div className="text-xl font-semibold text-slate-50">{stats.unreadMessages}</div>
            </button>
            <button
              type="button"
              onClick={onGoToLinking}
              disabled={!seekerId}
              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:bg-slate-900/70 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Scheduled events</div>
              <div className="text-xl font-semibold text-slate-50">{stats.scheduledEvents}</div>
            </button>
            <button
              type="button"
              onClick={onGoToRoutes}
              disabled={!seekerId}
              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:bg-slate-900/70 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Interested</div>
              <div className="text-xl font-semibold text-slate-50">{stats.interestedRoutes}</div>
            </button>
            <button
              type="button"
              onClick={onGoToBadges}
              disabled={!seekerId}
              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:bg-slate-900/70 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Pending approvals</div>
              <div className="text-xl font-semibold text-slate-50">{stats.badgeApprovals}</div>
            </button>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col min-h-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Feed
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Broadcasts, routes, and updates from Retainers.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onGoToRoutes}
                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition whitespace-nowrap"
              >
                View routes
              </button>
              <button
                type="button"
                onClick={() => setFeedTick((n) => n + 1)}
                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition whitespace-nowrap"
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(
              [
                { key: "ALL", label: "All" },
                { key: "BROADCAST", label: "Broadcasts" },
                { key: "ROUTE", label: "Routes" },
                { key: "UPDATE", label: "Updates" },
              ] as const
            ).map((item) => {
              const isActive = feedFilter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFeedFilter(item.key)}
                  className={[
                    "px-3 py-1 rounded-full text-[11px] border transition",
                    isActive
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"
                      : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {!seekerId ? (
            <div className="mt-3 text-xs text-slate-400">
              Select or create a Seeker profile to see your feed.
            </div>
          ) : visibleFeedItems.length === 0 ? (
            <div className="mt-3 text-xs text-slate-400">
              No recent activity yet. Try linking with a Retainer or check Routes.
            </div>
          ) : (
            <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">
              <ul className="space-y-2">
                {visibleFeedItems.map((it) => {
                  const r = retainerById.get(it.retainerId);
                  const retainerName = r?.companyName || "Retainer";
                  const when = feedWhen(it);
                  const badge = feedBadge(it);
                  const key = feedKey(it);
                  const isExpanded = expandedFeedKey === key;
                  const isAd = it.kind === "POST" && it.post.type === "AD";
                  const isUpdate = it.kind === "POST" && it.post.type === "UPDATE";
                  const isBroadcast = it.kind === "BROADCAST";
                  const routeResponse =
                    seekerId && it.kind === "ROUTE"
                      ? getRouteResponseForSeeker(it.route.id, seekerId)
                      : null;
                  const postResponse =
                    seekerId && isAd ? getPostResponseForSeeker(it.post.id, seekerId) : null;
                  const reaction =
                    seekerId && (isBroadcast || isUpdate)
                      ? getFeedReactionForSeeker(
                          isBroadcast ? "BROADCAST" : "POST",
                          isBroadcast ? it.id : it.post.id,
                          seekerId
                        )
                      : null;
                  const responseText = responseLabel(
                    routeResponse?.type || postResponse?.type || null
                  );
                  const reactionText = reactionLabel(reaction?.type || null);
                  const canDirectMessage = activeLinkRetainerIds.has(it.retainerId);

                  return (
                    <li
                      key={key}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => toggleFeedItem(it)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex items-start gap-2">
                            <ProfileAvatar
                              role="RETAINER"
                              profile={(r ?? { id: it.retainerId }) as any}
                              name={retainerName}
                              size="lg"
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] text-slate-300 truncate max-w-[180px]">
                                  {retainerName}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-200 bg-slate-900/70">
                                  {badge}
                                </span>
                              </div>
                              <div className="text-xs text-slate-100 font-medium truncate">
                                {feedTitle(it)}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {fmtWhen(when)}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 flex gap-2">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200">
                              {isExpanded ? "Hide" : "View"}
                            </span>
                          </div>
                        </div>
                      </button>

                      {(responseText || reactionText) && (
                        <div className="mt-2 text-[10px] text-slate-400">
                          {responseText && `Your response: ${responseText}`}
                          {responseText && reactionText ? " ? " : ""}
                          {reactionText && `Your reaction: ${reactionText}`}
                        </div>
                      )}

                      {isExpanded && (
                        <div className="mt-3 border-t border-slate-800 pt-3 space-y-3">
                          {renderFeedDetails(it)}

                          {it.kind === "ROUTE" && (
                            <div className="space-y-2">
                              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                Respond
                              </div>
                              {renderResponseButtons({
                                currentType: routeResponse?.type || null,
                                onSelect: (type) =>
                                  handleRouteResponse(it.route, it.retainerId, type, canDirectMessage),
                                canDirectMessage,
                              })}
                            </div>
                          )}

                          {isAd && (
                            <div className="space-y-2">
                              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                Respond
                              </div>
                              {renderResponseButtons({
                                currentType: postResponse?.type || null,
                                onSelect: (type) =>
                                  handlePostResponse(it.post, it.retainerId, type, canDirectMessage),
                                canDirectMessage,
                              })}
                            </div>
                          )}

                          {(isBroadcast || isUpdate) && (
                            <div className="space-y-2">
                              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                React
                              </div>
                              {renderReactionButtons({
                                currentType: reaction?.type || null,
                                onSelect: (type) =>
                                  handleFeedReaction(
                                    isBroadcast ? "BROADCAST" : "POST",
                                    isBroadcast ? it.id : it.post.id,
                                    it.retainerId,
                                    type
                                  ),
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
            </div>
          )}

          {filteredFeedItems.length > visibleFeedItems.length && (
            <div className="text-[11px] text-slate-500 mt-2">
              Showing {visibleFeedItems.length} of {filteredFeedItems.length}.
            </div>
          )}
        </div>
      </div>

      {/* Right rail */}
      <aside className="hidden lg:flex lg:order-2 lg:sticky lg:top-6 lg:flex-col lg:gap-5 lg:space-y-0 lg:overflow-hidden min-h-0 lg:h-full w-full max-w-full">
        {profileCard}

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex-1 min-h-0 overflow-y-auto">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-3">
            Badge progress
          </div>
          <div className="text-[11px] text-slate-500 mb-3">
            {seekerId ? "Active badges for this profile." : "Select a Seeker profile to track progress."}
          </div>

          {!seekerId ? (
            <div className="text-xs text-slate-400">
              Select or create a Seeker profile to see badge progress.
            </div>
          ) : activeBadges.length === 0 ? (
            <div className="text-xs text-slate-400">
              No active badges yet. Activate badges to start tracking progress.
            </div>
          ) : (
            <div className="grid gap-3">
              {activeBadges.map((badge) => {
                const progress = getBadgeProgress("SEEKER", seekerId, badge.id as any);
                const pct = pctFromCounts(progress.yesCount, progress.noCount);
                const total = progress.yesCount + progress.noCount;
                const description = badge.description || badge.title;

                return (
                  <div
                    key={badge.id}
                    title={description}
                    className="group rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-200">
                        <span className="badge-token h-12 w-12 rounded-2xl border border-slate-700 bg-slate-950/50 flex items-center justify-center text-slate-100">
                          {badgeIconFor(badge.iconKey, "h-full w-full")}
                        </span>
                        <span>{badge.title}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-50">
                          {pct == null ? "-" : `${pct}%`}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Level {Math.max(0, progress.maxLevel)}/5
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-800/80 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400/80"
                        style={{ width: `${pctValue(pct)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {total === 0
                        ? "No check-ins yet."
                        : `${progress.yesCount} yes - ${progress.noCount} no`}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {description}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {scheduleLink && seekerId && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setScheduleLink(null)}
          />
          <div className="relative h-full w-full p-6 md:p-10 flex items-center justify-center overflow-y-auto">
            <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Schedule video call
                  </div>
                  <div className="text-sm font-semibold text-slate-100 truncate">
                    {(() => {
                      const r = retainerById.get(scheduleLink.retainerId) as any;
                      return r ? formatRetainerName(r) : `Retainer (${scheduleLink.retainerId})`;
                    })()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleLink(null)}
                  className="h-9 w-9 rounded-full border border-slate-700 text-slate-200 hover:bg-slate-900 transition"
                  title="Close"
                >
                  �
                </button>
              </div>

              <div className="p-4 space-y-4">
                {scheduleError && (
                  <div className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
                    {scheduleError}
                  </div>
                )}

                {(() => {
                  const proposals = (scheduleLink.meetingProposals || [])
                    .slice()
                    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
                  const accepted =
                    scheduleLink.meetingAcceptedProposalId &&
                    proposals.find((p) => p.id === scheduleLink.meetingAcceptedProposalId);

                  return (
                    <div className="space-y-3">
                      {accepted ? (
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                          <div className="text-sm font-semibold text-emerald-100">
                            Scheduled
                          </div>
                          <div className="text-sm text-slate-50 mt-1">
                            {new Date(accepted.startAt).toLocaleString()} �{" "}
                            {accepted.durationMinutes} minutes
                          </div>
                          <div className="text-[11px] text-emerald-200/80 mt-1">
                            Proposed by {accepted.by === "SEEKER" ? "you" : "Retainer"}
                          </div>

                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => {
                                const next = clearLinkMeetingSchedule({
                                  seekerId,
                                  retainerId: scheduleLink.retainerId,
                                });
                                if (next) setScheduleLink(next);
                                setLinkTick((x) => x + 1);
                                onToast("Scheduled call cleared.");
                              }}
                              className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                            >
                              Clear schedule
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                          <div className="text-xs uppercase tracking-wide text-slate-400">
                            Proposed times
                          </div>
                          {proposals.length === 0 ? (
                            <div className="text-sm text-slate-400 mt-2">
                              No times proposed yet.
                            </div>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {proposals.slice(0, 6).map((p) => (
                                <div
                                  key={p.id}
                                  className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm text-slate-100 truncate">
                                      {new Date(p.startAt).toLocaleString()}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {p.durationMinutes}m � Proposed by{" "}
                                      {p.by === "SEEKER" ? "you" : "Retainer"}
                                      {p.note ? ` � ${p.note}` : ""}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = acceptLinkMeetingProposal({
                                        seekerId,
                                        retainerId: scheduleLink.retainerId,
                                        proposalId: p.id,
                                      });
                                      if (next) setScheduleLink(next);
                                      setLinkTick((x) => x + 1);
                                      onToast("Video call time confirmed.");
                                    }}
                                    className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition whitespace-nowrap"
                                  >
                                    Accept
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Propose a time
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <div className="text-xs font-medium text-slate-200">Start</div>
                      <input
                        type="datetime-local"
                        value={proposalAt}
                        onChange={(e) => setProposalAt(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </label>
                    <label className="space-y-1">
                      <div className="text-xs font-medium text-slate-200">
                        Duration
                      </div>
                      <select
                        value={proposalDuration}
                        onChange={(e) => setProposalDuration(Number(e.target.value) || 20)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value={10}>10 minutes</option>
                        <option value={20}>20 minutes</option>
                        <option value={30}>30 minutes</option>
                      </select>
                    </label>
                  </div>
                  <label className="space-y-1">
                    <div className="text-xs font-medium text-slate-200">Note (optional)</div>
                    <input
                      value={proposalNote}
                      onChange={(e) => setProposalNote(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Example: Quick intro + route fit"
                    />
                  </label>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleError(null);
                        if (!proposalAt) {
                          setScheduleError("Pick a start time first.");
                          return;
                        }
                        const d = new Date(proposalAt);
                        if (Number.isNaN(d.getTime())) {
                          setScheduleError("Invalid date/time.");
                          return;
                        }
                        const next = addLinkMeetingProposal({
                          seekerId,
                          retainerId: scheduleLink.retainerId,
                          by: "SEEKER",
                          startAt: d.toISOString(),
                          durationMinutes: proposalDuration,
                          note: proposalNote,
                        });
                        setScheduleLink(next);
                        setProposalAt("");
                        setProposalNote("");
                        setLinkTick((x) => x + 1);
                        onToast("Proposed a video call time.");
                      }}
                      className="px-4 py-2 rounded-full text-sm font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition"
                    >
                      Add proposal
                    </button>
                    <div className="text-[11px] text-slate-500">
                      Times use your local timezone.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Action tab                                                         */
/* ------------------------------------------------------------------ */

const ActionView: React.FC<{
  actionTab: ActionTabKey;
  onChangeTab: (tab: ActionTabKey) => void;
  seekerId: string | null;
  currentSeeker?: Seeker;
  isDesktop: boolean;
  linkTick: number;
  setLinkTick: React.Dispatch<React.SetStateAction<number>>;
  retainers: Retainer[];
  subcontractors: Subcontractor[];
  wheelRetainers: Retainer[];
  visibleTabs?: ActionTabKey[];
  excellentRetainers: Retainer[];
  possibleRetainers: Retainer[];
  notNowRetainers: Retainer[];
  selectedRetainerIds: Set<string>;
  onToggleSelectedRetainer: (retainerId: string) => void;
  onSelectAllRetainers: () => void;
  onClearSelectedRetainers: () => void;
  onBulkMessageSelected: () => void;
  onBulkRequestLinkSelected: () => void;
  onBulkReturnToWheelSelected: () => void;
  onClassifyRetainer: (retainer: Retainer, bucket: RetainerBucketKey) => void;
  onOpenProfile: (r: Retainer) => void | undefined;
  onReturnToWheel: (r: Retainer) => void;
  onRebucketById: (retainerId: string, targetBucket: RetainerBucketKey) => void;
  onMessage: (r: Retainer) => void;
  onToast: (msg: string) => void;
  onSeekerCreated: () => void;
  onSeekerUpdated: () => void;
  onCreateSubcontractor: (input: Partial<Subcontractor>) => void;
  onRemoveSubcontractor: (id: string) => void;
  onUpdateHierarchyNodes: (nodes: { id: string; x: number; y: number; parentId?: string }[]) => void;
}> = ({
  actionTab,
  onChangeTab,
  seekerId,
  currentSeeker,
  retainers,
  subcontractors,
  wheelRetainers,
  visibleTabs,
  excellentRetainers,
  possibleRetainers,
  notNowRetainers,
  selectedRetainerIds,
  onToggleSelectedRetainer,
  onSelectAllRetainers,
  onClearSelectedRetainers,
  onBulkMessageSelected,
  onBulkRequestLinkSelected,
  onBulkReturnToWheelSelected,
  onClassifyRetainer,
  onOpenProfile,
  onReturnToWheel,
  onRebucketById,
  onMessage,
  onToast,
  onSeekerCreated,
  onSeekerUpdated,
  onCreateSubcontractor,
  onRemoveSubcontractor,
  onUpdateHierarchyNodes,
}) => {
  const selectedCount = selectedRetainerIds.size;

  const scheduleMatchByRetainerId = useMemo(() => {
    const map = new Map<string, ScheduleMatch>();
    const availability = (currentSeeker as any)?.availability as WeeklyAvailability | undefined;
    if (!seekerId || !availability || !availability.blocks?.length) return map;

    const routes = getVisibleRoutesForSeeker(seekerId);
    const byRetainer = new Map<string, Route[]>();
    for (const r of routes) {
      const arr = byRetainer.get(r.retainerId) || [];
      arr.push(r);
      byRetainer.set(r.retainerId, arr);
    }

    for (const [retainerId, list] of byRetainer.entries()) {
      const m = bestMatchForRoutes({ availability, routes: list as any });
      if (m.percent > 0) map.set(retainerId, m);
    }

    return map;
  }, [seekerId, currentSeeker]);

  const getScheduleMatch = (retainerId: string): ScheduleMatch | undefined =>
    scheduleMatchByRetainerId.get(retainerId);

  const actionTabs: { key: ActionTabKey; label: string }[] = useMemo(
    () => [
      { key: "wheel", label: "Wheel" },
      { key: "lists", label: "Sorting Lists" },
      { key: "routes", label: "Routes" },
      { key: "schedule", label: "Scheduling" },
      { key: "editProfile", label: "Edit Profile" },
      { key: "addSubcontractor", label: "Add Subcontractor" },
      { key: "hierarchy", label: "Hierarchy" },
    ],
    []
  );

  const visibleTabKeys = useMemo(
    () => (visibleTabs && visibleTabs.length ? visibleTabs : actionTabs.map((tab) => tab.key)),
    [visibleTabs, actionTabs]
  );

  const filteredTabs = useMemo(
    () => actionTabs.filter((tab) => visibleTabKeys.includes(tab.key)),
    [actionTabs, visibleTabKeys]
  );

  useEffect(() => {
    if (!visibleTabKeys.includes(actionTab) && filteredTabs.length) {
      onChangeTab(filteredTabs[0].key);
    }
  }, [actionTab, filteredTabs, visibleTabKeys, onChangeTab]);

  const tabButtonClass = (isActive: boolean) =>
    [
      "px-3 py-1.5 rounded-full text-sm border transition",
      isActive
        ? "bg-white/15 border-white/30 text-white"
        : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10",
    ].join(" ");

  const actionContentClass =
    actionTab === "wheel" || actionTab === "lists"
      ? "flex-1 min-h-0 overflow-hidden flex flex-col"
      : "flex-1 min-h-0 overflow-y-auto pr-1";

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="flex flex-wrap gap-2">
        {filteredTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChangeTab(tab.key)}
            className={tabButtonClass(actionTab === tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={actionContentClass}>
        {actionTab === "wheel" && (
          <ViewRetainersView
            seekerId={seekerId}
            seekerAvailability={(currentSeeker as any)?.availability}
            wheelRetainers={wheelRetainers}
            excellentRetainers={excellentRetainers}
            possibleRetainers={possibleRetainers}
            notNowRetainers={notNowRetainers}
            onClassify={onClassifyRetainer}
            onOpenProfile={onOpenProfile}
            onMessage={onMessage}
          />
        )}

        {actionTab === "lists" && (
          <div className="flex flex-col gap-6 min-h-0 flex-1 overflow-hidden">
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
              <h3 className="text-lg font-semibold text-slate-50 mb-1">
                Your Retainer lists
              </h3>
              <p className="text-sm text-slate-300">
                Save approved Retainers into Excellent, Possible, or Not now. You can drag
                cards between lists and message directly.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-slate-100">Bulk actions</div>
                <span className="text-xs text-slate-400">{selectedCount} selected</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onSelectAllRetainers}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={onClearSelectedRetainers}
                  disabled={selectedCount === 0}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={onBulkMessageSelected}
                  disabled={selectedCount === 0 || !seekerId}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  title={!seekerId ? "Select a Seeker profile first" : "Send one message to all selected"}
                >
                  Message all
                </button>
                <button
                  type="button"
                  onClick={onBulkRequestLinkSelected}
                  disabled={selectedCount === 0 || !seekerId}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-sky-500/15 border border-sky-500/40 text-sky-100 hover:bg-sky-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  title={!seekerId ? "Select a Seeker profile first" : "Request links for all selected"}
                >
                  Request to link
                </button>
                <button
                  type="button"
                  onClick={onBulkReturnToWheelSelected}
                  disabled={selectedCount === 0}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Move selected back to the wheel"
                >
                  Return to wheel
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0 grid-rows-1 h-full overflow-hidden">
              <RetainerBucketPanel
                title="Excellent"
                color="emerald"
                retainers={excellentRetainers}
                bucketKey="excellent"
                selectedRetainerIds={selectedRetainerIds}
                onToggleSelectedRetainer={onToggleSelectedRetainer}
                onOpenProfile={onOpenProfile}
                onReturnToWheel={onReturnToWheel}
                onDropToBucket={onRebucketById}
                onMessage={onMessage}
                getScheduleMatch={getScheduleMatch}
              />
              <RetainerBucketPanel
                title="Possible"
                color="sky"
                retainers={possibleRetainers}
                bucketKey="possible"
                selectedRetainerIds={selectedRetainerIds}
                onToggleSelectedRetainer={onToggleSelectedRetainer}
                onOpenProfile={onOpenProfile}
                onReturnToWheel={onReturnToWheel}
                onDropToBucket={onRebucketById}
                onMessage={onMessage}
                getScheduleMatch={getScheduleMatch}
              />
              <RetainerBucketPanel
                title="Not now"
                color="rose"
                retainers={notNowRetainers}
                bucketKey="notNow"
                selectedRetainerIds={selectedRetainerIds}
                onToggleSelectedRetainer={onToggleSelectedRetainer}
                onOpenProfile={onOpenProfile}
                onReturnToWheel={onReturnToWheel}
                onDropToBucket={onRebucketById}
                onMessage={onMessage}
                getScheduleMatch={getScheduleMatch}
              />
            </div>
          </div>
        )}

        {actionTab === "routes" && (
          <SeekerRoutesView
            seekerId={seekerId}
            retainers={retainers}
            onToast={onToast}
          />
        )}

        {actionTab === "schedule" && (
          <SeekerScheduleView
            seeker={currentSeeker}
            onSaved={onSeekerUpdated}
          />
        )}

        {actionTab === "editProfile" && (
          <div className="space-y-4">
            {currentSeeker ? (
              <SeekerProfileForm
                mode="edit"
                initial={currentSeeker}
                onSaved={onSeekerUpdated}
              />
            ) : (
              <SeekerProfileForm mode="create" onSaved={onSeekerCreated} />
            )}
            <ChangePasswordPanel email={(currentSeeker as any)?.email ?? null} />
          </div>
        )}

        {actionTab === "addSubcontractor" && (
          <SubcontractorAdminView
            seeker={currentSeeker}
            subcontractors={subcontractors}
            onCreate={onCreateSubcontractor}
            onRemove={onRemoveSubcontractor}
          />
        )}

        {actionTab === "hierarchy" && (
          <SeekerHierarchyView
            seeker={currentSeeker}
            subcontractors={subcontractors}
            readOnly={false}
            onUpdateNodes={onUpdateHierarchyNodes}
          />
        )}
      </div>
    </div>
  );
};

const RetainerBucketPanel: React.FC<{
  title: string;
  color: "emerald" | "sky" | "rose";
  retainers: Retainer[];
  bucketKey: RetainerBucketKey;
  selectedRetainerIds: Set<string>;
  onToggleSelectedRetainer: (retainerId: string) => void;
  onOpenProfile: (r: Retainer) => void | undefined;
  onReturnToWheel: (r: Retainer) => void;
  onDropToBucket: (retainerId: string, targetBucket: RetainerBucketKey) => void;
  onMessage: (r: Retainer) => void;
  getScheduleMatch?: (retainerId: string) => ScheduleMatch | undefined;
}> = ({
  title,
  color,
  retainers,
  bucketKey,
  selectedRetainerIds,
  onToggleSelectedRetainer,
  onOpenProfile,
  onReturnToWheel,
  onDropToBucket,
  onMessage,
  getScheduleMatch,
}) => {
  const colorMap: Record<
    typeof color,
    { border: string; pill: string; label: string; button: string }
  > = {
    emerald: {
      border: "border-emerald-500/60",
      pill: "bg-emerald-500/15 text-emerald-100",
      label: "text-emerald-300",
      button:
        "bg-emerald-500/15 text-emerald-100 border border-emerald-500/50 hover:bg-emerald-500/25",
    },
    sky: {
      border: "border-sky-500/60",
      pill: "bg-sky-500/15 text-sky-100",
      label: "text-sky-300",
      button:
        "bg-sky-500/15 text-sky-100 border border-sky-500/50 hover:bg-sky-500/25",
    },
    rose: {
      border: "border-rose-500/60",
      pill: "bg-rose-500/15 text-rose-100",
      label: "text-rose-300",
      button:
        "bg-rose-500/15 text-rose-100 border border-rose-500/50 hover:bg-rose-500/25",
    },
  };

  const c = colorMap[color];

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("application/x-retainer-id");
    if (!id) return;
    onDropToBucket(id, bucketKey);
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col">
      <div className="px-4 pt-3 pb-2 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className={`text-xs uppercase tracking-wide ${c.label} font-semibold`}>
            {title}
          </div>
          <div className="text-[11px] text-slate-500">
            {retainers.length} saved {retainers.length === 1 ? "company" : "companies"}
          </div>
        </div>
      </div>

      <div
        className="px-3 pb-3 pt-2 flex-1 h-[260px] md:h-[320px] overflow-y-auto space-y-2"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={handleDrop}
      >
        {retainers.length === 0 ? (
          <div className="text-xs text-slate-500 mt-1">
            Nothing here yet. Spin the wheel and sort a few Retainers, or drag one here from another list.
          </div>
        ) : (
          retainers.map((r) => {
            const name = formatRetainerName(r);
            const match = getScheduleMatch ? getScheduleMatch(r.id) : undefined;
            const city = (r as any).city ?? "-";
            const state = (r as any).state ?? "-";
            const photoUrl = getRetainerPhotoUrl(r);
            return (
              <div
                key={r.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-retainer-id", r.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onOpenProfile(r)}
                className={`rounded-xl border ${c.border} bg-slate-950/80 px-3 py-2 text-xs flex flex-col gap-1 cursor-pointer hover:bg-slate-900/80 transition`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-700 bg-slate-900 shrink-0">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[11px] text-slate-300">
                          {name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-50 truncate">{name}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {city !== "-" || state !== "-" ? `${city}, ${state}` : "Location not set"}
                      </div>
                      {match && match.percent > 0 && (
                        <div className="text-[11px] text-slate-400 truncate">
                          Schedule match:{" "}
                          <span className="text-slate-200 font-medium">{match.percent}%</span>
                          {match.overlapDays.length > 0 && (
                            <span className="text-slate-500">
                              {" "}
                              � {formatDaysShort(match.overlapDays)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label
                      className="inline-flex items-center"
                      onClick={(e) => e.stopPropagation()}
                      title="Select for bulk actions"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRetainerIds.has(r.id)}
                        onChange={() => onToggleSelectedRetainer(r.id)}
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900"
                      />
                    </label>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${c.pill}`}
                    >
                      {title}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReturnToWheel(r);
                    }}
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                  >
                    Return to wheel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMessage(r);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${c.button} transition`}
                  >
                    Message
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* View Retainers � wheel                                             */
/* ------------------------------------------------------------------ */

const ViewRetainersView: React.FC<{
  seekerId: string | null;
  seekerAvailability?: WeeklyAvailability;
  wheelRetainers: Retainer[];
  excellentRetainers: Retainer[];
  possibleRetainers: Retainer[];
  notNowRetainers: Retainer[];
  onClassify: (retainer: Retainer, bucket: RetainerBucketKey) => void;
  onOpenProfile: (retainer: Retainer) => void;
  onMessage: (retainer: Retainer) => void;
}> = ({
  seekerId,
  seekerAvailability,
  wheelRetainers,
  excellentRetainers,
  possibleRetainers,
  notNowRetainers,
  onClassify,
  onOpenProfile,
  onMessage,
}) => {
  const [centerIndex, setCenterIndex] = useState(0);
  const wheelAccumulatorRef = useRef(0);
  const [expandedRetainer, setExpandedRetainer] = useState<Retainer | null>(null);
  const [reputationMin, setReputationMin] = useState(0);
  const [distanceZip, setDistanceZip] = useState("");
  const [distanceMiles, setDistanceMiles] = useState(50);
  const [payCycleFrequency, setPayCycleFrequency] = useState<PayCycleFrequency | "">("");
  const [payCycleCloseDay, setPayCycleCloseDay] = useState<DayOfWeek | "">("");

  const deferredDistanceZip = useDeferredValue(distanceZip);
  const deferredReputationMin = useDeferredValue(reputationMin);
  const deferredPayCycleFrequency = useDeferredValue(payCycleFrequency);
  const deferredPayCycleCloseDay = useDeferredValue(payCycleCloseDay);

  const parseZip = (value: string | null | undefined) => {
    const digits = String(value ?? "").replace(/\D/g, "").slice(0, 5);
    if (digits.length !== 5) return null;
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
  };

  const approxMilesBetweenZips = (a?: string | null, b?: string | null) => {
    const za = parseZip(a);
    const zb = parseZip(b);
    if (za == null || zb == null) return null;
    return Math.round(Math.abs(za - zb) * 0.2);
  };

  const hasDistanceFilter = distanceZip.trim().length === 5;
  const hasPayCycleFilter = Boolean(payCycleFrequency || payCycleCloseDay);
  const hasFilters = reputationMin > 0 || hasDistanceFilter || hasPayCycleFilter;

  const reputationById = useMemo(() => {
    const map = new Map<string, number>();
    for (const retainer of wheelRetainers) {
      const rep = getReputationScoreForProfile({
        ownerRole: "RETAINER",
        ownerId: String(retainer.id),
      });
      if (rep.score != null) map.set(String(retainer.id), rep.score);
    }
    return map;
  }, [wheelRetainers]);

  const filteredRetainers = useMemo(() => {
    return wheelRetainers.filter((retainer) => {
      if (deferredReputationMin > 0) {
        const reputation = reputationById.get(String(retainer.id));
        if (reputation == null || reputation < deferredReputationMin) return false;
      }

      if (hasDistanceFilter) {
        const miles = approxMilesBetweenZips(deferredDistanceZip, (retainer as any).zip);
        if (miles == null || miles > distanceMiles) return false;
      }

      if (deferredPayCycleFrequency) {
        if ((retainer as any).payCycleFrequency !== deferredPayCycleFrequency) return false;
      }

      if (deferredPayCycleCloseDay) {
        if ((retainer as any).payCycleCloseDay !== deferredPayCycleCloseDay) return false;
      }

      return true;
    });
  }, [wheelRetainers, deferredReputationMin, hasDistanceFilter, deferredDistanceZip, distanceMiles, deferredPayCycleFrequency, deferredPayCycleCloseDay, reputationById]);

  useEffect(() => {
    if (filteredRetainers.length === 0) {
      setCenterIndex(0);
    } else {
      setCenterIndex((prev) => Math.max(0, Math.min(prev, filteredRetainers.length - 1)));
    }
  }, [filteredRetainers.length]);

  const goToNext = (direction: number) => {
    if (filteredRetainers.length === 0) return;
    const nextIndex = (centerIndex + direction + filteredRetainers.length) % filteredRetainers.length;
    if (nextIndex === centerIndex) return;
    setCenterIndex(nextIndex);
  };

  const handleClassifyCurrent = (bucket: RetainerBucketKey) => {
    if (!currentRetainer) return;
    onClassify(currentRetainer, bucket);
  };

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (filteredRetainers.length === 0) return;
    e.preventDefault();
    e.stopPropagation();

    const threshold = 30;
    const nextAcc = wheelAccumulatorRef.current + e.deltaY;
    wheelAccumulatorRef.current = nextAcc;

    if (Math.abs(nextAcc) >= threshold) {
      wheelAccumulatorRef.current = 0;
      const direction = nextAcc > 0 ? 1 : -1;
      goToNext(direction);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        goToNext(1);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        goToNext(-1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const { scheduleMatchByRetainerId, routeCountByRetainerId } = (() => {
    const matches = new Map<string, ScheduleMatch>();
    const counts = new Map<string, number>();
    if (!seekerId)
      return { scheduleMatchByRetainerId: matches, routeCountByRetainerId: counts };

    const routes = getVisibleRoutesForSeeker(seekerId);
    const byRetainer = new Map<string, Route[]>();
    for (const r of routes) {
      const arr = byRetainer.get(r.retainerId) || [];
      arr.push(r);
      byRetainer.set(r.retainerId, arr);
    }

    for (const retainer of filteredRetainers) {
      const list = byRetainer.get(retainer.id) || [];
      const activeCount = list.filter((x) => (x as any).status === "ACTIVE").length;
      counts.set(retainer.id, activeCount);

      if (!seekerAvailability || !seekerAvailability.blocks?.length) continue;
      const m = bestMatchForRoutes({
        availability: seekerAvailability,
        routes: list as any,
      });
      if (m.percent > 0) matches.set(retainer.id, m);
    }

    return { scheduleMatchByRetainerId: matches, routeCountByRetainerId: counts };
  })();

  useEffect(() => {
    if (!expandedRetainer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedRetainer(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedRetainer]);

  const currentRetainer = filteredRetainers[centerIndex] ?? null;
  const nextRetainer =
    filteredRetainers.length > 1
      ? filteredRetainers[(centerIndex + 1) % filteredRetainers.length]
      : null;
  const prevPeek =
    filteredRetainers.length > 1
      ? filteredRetainers[(centerIndex - 1 + filteredRetainers.length) % filteredRetainers.length]
      : null;
  const nextPeek = nextRetainer;
  const remaining = Math.max(0, filteredRetainers.length - centerIndex - 1);

    const renderPeekCard = (r: Retainer) => {
    const name = formatRetainerName(r);
    const city = (r as any).city ?? "-";
    const state = (r as any).state ?? "-";
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <ProfileAvatar role="RETAINER" profile={r} name={name} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-50 truncate">{name}</div>
            <div className="text-xs text-slate-400 truncate">
              {city !== "-" || state !== "-" ? `${city}, ${state}` : "Location not set"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const railTone = {
    emerald: "border-emerald-500/40",
    sky: "border-sky-500/40",
    rose: "border-rose-500/40",
  } as const;

  const renderRailCard = (r: Retainer, tone: keyof typeof railTone) => {
    const name = formatRetainerName(r);
    const city = (r as any).city ?? "-";
    const state = (r as any).state ?? "-";
    return (
      <div className={`rounded-2xl bg-slate-900/80 border px-4 py-3 ${railTone[tone]}`}>
        <div className="flex items-center gap-3 min-w-0">
          <ProfileAvatar role="RETAINER" profile={r} name={name} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-50 truncate">{name}</div>
            <div className="text-xs text-slate-400 truncate">
              {city !== "-" || state !== "-" ? `${city}, ${state}` : "Location not set"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">Approved Retainers</h3>
          <p className="text-xs text-slate-400">
            Scroll to browse one profile at a time. Click to open the full profile, or sort them into your lists.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-300">
          Scroll to browse ? Click to expand
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-slate-400">Reputation</label>
          <select
            value={reputationMin}
            onChange={(e) => setReputationMin(Number(e.target.value) || 0)}
            className="rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-[11px] px-2.5 py-1"
          >
            <option value={0}>Any</option>
            <option value={620}>620+</option>
            <option value={725}>725+</option>
            <option value={830}>830+</option>
          </select>

          <label className="text-[11px] text-slate-400 ml-2">Pay cycle</label>
          <select
            value={payCycleFrequency}
            onChange={(e) => setPayCycleFrequency(e.target.value as PayCycleFrequency | "")}
            className="rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-[11px] px-2.5 py-1"
          >
            <option value="">Any</option>
            {PAY_CYCLE_FREQUENCIES.map((freq) => (
              <option key={freq.value} value={freq.value}>
                {freq.label}
              </option>
            ))}
          </select>
          <label className="text-[11px] text-slate-400 ml-2">Close day</label>
          <select
            value={payCycleCloseDay}
            onChange={(e) => setPayCycleCloseDay(e.target.value as DayOfWeek | "")}
            className="rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-[11px] px-2.5 py-1"
          >
            <option value="">Any</option>
            {DAYS.map((day) => (
              <option key={day.key} value={day.key}>
                {day.short}
              </option>
            ))}
          </select>
          <label className="text-[11px] text-slate-400 ml-2">
            Distance (approx)
          </label>
          <input
            value={distanceZip}
            onChange={(e) =>
              setDistanceZip(e.target.value.replace(/\D/g, "").slice(0, 5))
            }
            placeholder="Zip"
            className="w-20 rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-[11px] px-2.5 py-1"
          />
          <select
            value={distanceMiles}
            onChange={(e) => setDistanceMiles(Number(e.target.value) || 50)}
            className="rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-[11px] px-2.5 py-1"
          >
            <option value={10}>10 mi</option>
            <option value={25}>25 mi</option>
            <option value={50}>50 mi</option>
            <option value={100}>100 mi</option>
            <option value={200}>200 mi</option>
            <option value={500}>500 mi</option>
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setReputationMin(0);
                setDistanceZip("");
                setDistanceMiles(50);
                setPayCycleFrequency("");
                setPayCycleCloseDay("");
              }}
              className="rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-[11px] px-2.5 py-1 hover:bg-slate-800 transition"
            >
              Clear
            </button>
          )}
        </div>
        <div className="text-[11px] text-slate-500">
          Showing {filteredRetainers.length} of {wheelRetainers.length}
        </div>
      </div>

      {filteredRetainers.length === 0 ? (
        <div className="min-h-[260px] flex flex-col items-center justify-center text-sm text-slate-400">
          No retainers match these filters.
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setReputationMin(0);
                setDistanceZip("");
                setDistanceMiles(50);
                setPayCycleFrequency("");
                setPayCycleCloseDay("");
              }}
              className="mt-2 rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-[11px] px-3 py-1.5 hover:bg-slate-800 transition"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
            <span>
              Profile {filteredRetainers.length === 0 ? 0 : centerIndex + 1} of {filteredRetainers.length}
            </span>
            <span>
              {remaining} left
            </span>
          </div>
          <div className="flex flex-col lg:flex-row gap-4">
            <div
              className="relative flex-1 min-h-[360px] h-[50vh] sm:h-[56vh] md:h-[52vh] lg:h-[60vh] xl:h-[70vh] max-h-[900px] flex items-center justify-start overflow-hidden"
              onWheel={handleWheel}
            >
              {prevPeek && (
                <div className="hidden xl:block absolute left-0 top-6 w-full max-w-md">
                  {renderPeekCard(prevPeek)}
                </div>
              )}
              {nextPeek && (
                <div className="hidden xl:block absolute left-0 bottom-6 w-full max-w-md">
                  {renderPeekCard(nextPeek)}
                </div>
              )}
              {currentRetainer && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full max-w-md">
                  <RetainerWheelCard
                    retainer={currentRetainer}
                    isCenter={true}
                    scheduleMatch={scheduleMatchByRetainerId.get(currentRetainer.id)}
                    onOpenProfile={() => setExpandedRetainer(currentRetainer)}
                    onMessage={() => onMessage(currentRetainer)}
                    canMessage={!!seekerId}
                    routeCount={routeCountByRetainerId.get(currentRetainer.id)}
                    isLinked={
                      !!(seekerId && getLink(seekerId, currentRetainer.id)?.status === "ACTIVE")
                    }
                    onClassify={(bucket) => handleClassifyCurrent(bucket)}
                  />
                </div>
              )}

              {!currentRetainer && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full max-w-md">
                  <div className="w-full max-w-md px-3 py-3 sm:px-4 sm:py-4 rounded-2xl border border-slate-700 bg-slate-900/70 text-slate-300 min-h-[220px] sm:min-h-[260px] flex items-center justify-center text-center">
                    <p className="text-sm">
                      You&apos;ve sorted through all available profiles. Time to head over to the Linking tab and send link requests.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:block relative w-full lg:w-64 shrink-0 h-[64vh] lg:h-[70vh]">
              <div className="absolute left-0 right-0 top-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 h-[28%] flex flex-col">
                <div className="text-xs uppercase tracking-wide text-emerald-200">Excellent</div>
                <div className="text-[11px] text-emerald-100 mt-1">{excellentRetainers.length} saved</div>
                <div className="mt-2 space-y-2 overflow-y-auto pr-1">
                  {excellentRetainers.map((r) => (
                    <div key={r.id}>{renderRailCard(r, "emerald")}</div>
                  ))}
                </div>
              </div>
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3 py-3 h-[28%] flex flex-col">
                <div className="text-xs uppercase tracking-wide text-sky-200">Possible</div>
                <div className="text-[11px] text-sky-100 mt-1">{possibleRetainers.length} saved</div>
                <div className="mt-2 space-y-2 overflow-y-auto pr-1">
                  {possibleRetainers.map((r) => (
                    <div key={r.id}>{renderRailCard(r, "sky")}</div>
                  ))}
                </div>
              </div>
              <div className="absolute left-0 right-0 bottom-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 h-[28%] flex flex-col">
                <div className="text-xs uppercase tracking-wide text-rose-200">Not now</div>
                <div className="text-[11px] text-rose-100 mt-1">{notNowRetainers.length} saved</div>
                <div className="mt-2 space-y-2 overflow-y-auto pr-1">
                  {notNowRetainers.map((r) => (
                    <div key={r.id}>{renderRailCard(r, "rose")}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {expandedRetainer && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setExpandedRetainer(null)}
          />
          <div className="relative h-full w-full p-6 md:p-10 flex items-center justify-center overflow-y-auto">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-5xl"
            >
              <RetainerWheelExpandedCard
                seekerId={seekerId}
                retainer={expandedRetainer}
                scheduleMatch={scheduleMatchByRetainerId.get(expandedRetainer.id)}
                routeCount={routeCountByRetainerId.get(expandedRetainer.id)}
                isLinked={
                  !!(
                    seekerId &&
                    getLink(seekerId, expandedRetainer.id)?.status === "ACTIVE"
                  )
                }
                canMessage={!!seekerId}
                onClose={() => setExpandedRetainer(null)}
                onOpenFullProfile={() => {
                  onOpenProfile(expandedRetainer);
                  setExpandedRetainer(null);
                }}
                onMessage={() => {
                  onMessage(expandedRetainer);
                  setExpandedRetainer(null);
                }}
                onClassify={(bucket) => {
                  onClassify(expandedRetainer, bucket);
                  setExpandedRetainer(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RetainerWheelCard: React.FC<{
  retainer: Retainer;
  style?: CSSProperties;
  isCenter: boolean;
  scheduleMatch?: ScheduleMatch;
  routeCount?: number;
  isLinked?: boolean;
  onOpenProfile: () => void;
  onMessage: () => void;
  canMessage: boolean;
  onClassify: (bucket: RetainerBucketKey) => void;
}> = ({
  retainer,
  style,
  isCenter,
  scheduleMatch,
  routeCount,
  isLinked,
  onOpenProfile,
  onMessage,
  canMessage,
  onClassify,
}) => {
  const name = formatRetainerName(retainer);
  const city = (retainer as any).city ?? "�";
  const state = (retainer as any).state ?? "�";
  const photoUrl = getRetainerPhotoUrl(retainer);

  const verts: string[] = Array.isArray((retainer as any).deliveryVerticals)
    ? (retainer as any).deliveryVerticals
    : [];

  const reputation = getReputationScoreForProfile({ ownerRole: "RETAINER", ownerId: retainer.id });
  const topBadges = getBadgeSummaryForProfile({
    ownerRole: "RETAINER",
    ownerId: retainer.id,
    max: 4,
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenProfile}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenProfile();
        }
      }}
      style={style}
      className={[
        "w-full max-w-md px-3 py-2 sm:px-4 sm:py-3 rounded-2xl border transition-all duration-300 ease-out cursor-pointer min-h-[300px] sm:min-h-[360px] md:min-h-[360px] lg:min-h-[500px] xl:min-h-[560px] scale-[0.94] md:scale-[0.90] lg:scale-[0.96] xl:scale-100 origin-top",
        "bg-slate-900 flex flex-col shadow-lg",
        isCenter
          ? "border-emerald-500/60 shadow-emerald-900/50 scale-100"
          : "border-slate-700/70 shadow-slate-950/40 hover:border-emerald-500/40 hover:shadow-emerald-900/40",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
      ].join(" ")}
    >
      <div className="mb-3">
        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950/60 h-24 sm:h-32 md:h-40 lg:h-48 xl:h-56 w-full flex items-center justify-center">
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="text-xs text-slate-400">No photo</div>
          )}

          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            {isLinked && (
              <span className="inline-flex items-center rounded-full bg-white/10 border border-white/10 px-2 py-0.5 text-[10px] text-white/80">
                Linked
              </span>
            )}
          </div>

          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-200">
              Approved
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-50 truncate">{name}</div>
          <div className="text-xs text-slate-400">
            {city !== "�" || state !== "�" ? `${city}, ${state}` : "Location not set"}
          </div>
        </div>
        <button
          type="button"
          title={canMessage ? "Message" : "Select a Seeker profile to message"}
          onClick={(e) => {
            e.stopPropagation();
            if (!canMessage) return;
            onMessage();
          }}
          disabled={!canMessage}
          className={[
            "h-8 w-8 rounded-full border flex items-center justify-center transition",
            canMessage
              ? "border-slate-700 text-slate-200 hover:bg-slate-800"
              : "border-slate-800 text-slate-600 cursor-not-allowed opacity-50",
          ].join(" ")}
        >
          {badgeIconFor("chat", "h-4 w-4")}
        </button>
      </div>

      
      <div className="mt-2 space-y-2">
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-300">
            <span className="flex items-center gap-1">
              {badgeIconFor("shield", "h-3.5 w-3.5")}
              <span className="font-semibold">
                {reputation.score == null ? "Reputation ?" : `Reputation ${reputation.score}`}
              </span>
            </span>
            {reputation.total > 0 && <span className="text-slate-500">({reputation.total})</span>}
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-400/80"
              style={{ width: `${reputation.scorePercent ?? 0}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scheduleMatch && scheduleMatch.percent > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100">
              {badgeIconFor("clock", "h-3.5 w-3.5")}
              <span className="font-semibold">{scheduleMatch.percent}% match</span>
              {scheduleMatch.overlapDays.length > 0 && (
                <span className="text-emerald-200/70">? {formatDaysShort(scheduleMatch.overlapDays)}</span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/30 px-2 py-0.5 text-[10px] text-slate-400">
              {badgeIconFor("clock", "h-3.5 w-3.5")}
              Schedule ?
            </span>
          )}

          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/30 px-2 py-0.5 text-[10px] text-slate-300">
            {badgeIconFor("route", "h-3.5 w-3.5")}
            Routes: {typeof routeCount === "number" ? routeCount : "?"}
          </span>
        </div>
      </div>

      {topBadges.length > 0 && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {topBadges.map((b) => (
              <span
                key={b.badge.id}
                title={`${b.badge.title} � Level ${b.maxLevel}\n${b.badge.description}`}
                className="relative h-7 w-7 rounded-full border border-slate-700 bg-slate-950/40 text-slate-200 flex items-center justify-center"
              >
                {badgeIconFor(b.badge.iconKey, "h-4 w-4")}
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[9px] leading-3 text-emerald-100 flex items-center justify-center">
                  {b.maxLevel}
                </span>
              </span>
            ))}
          </div>

          {verts.length > 0 && (
            <div className="text-[10px] text-slate-500 truncate">
              {verts.slice(0, 2).join(" � ")}
              {verts.length > 2 ? ` � +${verts.length - 2}` : ""}
            </div>
          )}
        </div>
      )}

      {topBadges.length === 0 && verts.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {verts.slice(0, 3).map((v) => (
            <span
              key={v}
              className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300"
            >
              {v}
            </span>
          ))}
          {verts.length > 3 && (
            <span className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
              +{verts.length - 3} more
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClassify("excellent");
            }}
            className="px-3 py-1 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-100 border border-emerald-500/50 hover:bg-emerald-500/30 transition"
          >
            Excellent
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClassify("possible");
            }}
            className="px-3 py-1 rounded-full text-[11px] font-medium bg-sky-500/15 text-sky-100 border border-sky-500/40 hover:bg-sky-500/25 transition"
          >
            Possible
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClassify("notNow");
            }}
            className="px-3 py-1 rounded-full text-[11px] font-medium bg-rose-500/15 text-rose-100 border border-rose-500/40 hover:bg-rose-500/25 transition"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Compose pop-out from dashboard                                     */
/* ------------------------------------------------------------------ */

const ComposeMessagePopover: React.FC<{
  seeker: Seeker | null;
  retainer: Retainer;
  initialSubject?: string;
  initialBody?: string;
  messageFlag?: string;
  onSent?: () => void;
  onClose: () => void;
}> = ({
  seeker,
  retainer,
  initialSubject,
  initialBody,
  messageFlag,
  onSent,
  onClose,
}) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSubject(initialSubject ?? "");
    setBody(initialBody ?? "");
    setError(null);
    setSuccess(null);
  }, [initialSubject, initialBody, retainer?.id]);

  const handleSend = () => {
    setError(null);
    setSuccess(null);

    if (!seeker) {
      setError("Create or select a Seeker profile before sending a message.");
      return;
    }

    if (!subject.trim()) {
      setError("Please add a subject for this conversation.");
      return;
    }
    if (!body.trim()) {
      setError("Please write a short message.");
      return;
    }

    try {
      setSending(true);
      const created = createConversationWithFirstMessage({
        seekerId: seeker.id,
        retainerId: retainer.id,
        subject,
        body,
        senderRole: "SEEKER",
      });
      if (messageFlag && created?.message?.id) {
        setMessageFlag(created.message.id, messageFlag);
      }
      if (onSent) onSent();
      setSuccess("Message sent. You can continue this conversation in Messaging Center.");
      setSubject("");
      setBody("");
    } catch (err) {
      console.error(err);
      setError("Something went wrong sending your message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end pointer-events-none">
      <div className="pointer-events-auto mb-4 mr-4 w-full max-w-md rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">New message to</div>
            <div className="text-sm font-semibold text-slate-50">
              {formatRetainerName(retainer)}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          {error && (
            <div className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
              {success}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Subject / Name for this conversation
            </label>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Example: Route A � night shift coverage"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">Message</label>
            <textarea
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[80px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Introduce yourself and what you�re looking for�"
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-1.5 rounded-full text-xs font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? "Sending�" : "Send"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const BulkComposeMessagePopover: React.FC<{
  count: number;
  onClose: () => void;
  onSend: (subject: string, body: string) => void;
}> = ({ count, onClose, onSend }) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSend = () => {
    setError(null);
    if (!subject.trim()) {
      setError("Please add a subject for this conversation.");
      return;
    }
    if (!body.trim()) {
      setError("Please write a short message.");
      return;
    }
    onSend(subject.trim(), body.trim());
    setSubject("");
    setBody("");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end pointer-events-none">
      <div className="pointer-events-auto mb-4 mr-4 w-full max-w-md rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-xs uppercase tracking-wide text-slate-400">Bulk message</div>
          <div className="text-sm font-semibold text-slate-50">{count} retainers</div>
        </div>
        <div className="px-4 py-3 space-y-3">
          {error && (
            <div className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">Subject / Name for this conversation</label>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Example: Route A - night shift coverage"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">Message</label>
            <textarea
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[80px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Introduce yourself and what you-re looking for-"
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSend}
            className="px-4 py-1.5 rounded-full text-xs font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition"
          >
            Send
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* Subcontractors tab                                                 */
/* ------------------------------------------------------------------ */

const SubcontractorAdminView: React.FC<{
  seeker?: Seeker;
  subcontractors: Subcontractor[];
  onCreate: (input: Partial<Subcontractor>) => void;
  onRemove: (id: string) => void;
}> = ({ seeker, subcontractors, onCreate, onRemove }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!seeker) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
        Select or create a Seeker profile first.
      </div>
    );
  }

  const canManage = (seeker as any).status === "APPROVED";

  const handlePhotoFile = async (file: File | null) => {
    if (!file) return;
    try {
      setError(null);
      const url = await uploadImageWithFallback(file, MAX_IMAGE_BYTES);
      setPhotoUrl(url);
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canManage) return;
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    onCreate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      title: title.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      photoUrl: photoUrl.trim() || undefined,
      bio: bio.trim() || undefined,
    });
    setFirstName("");
    setLastName("");
    setTitle("");
    setEmail("");
    setPhone("");
    setPhotoUrl("");
    setBio("");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
        <h3 className="text-lg font-semibold text-slate-50 mb-1">Subcontractors</h3>
        <p className="text-sm text-slate-300">
          Add contract drivers who work under your master Seeker profile.
        </p>
        {!canManage && (
          <p className="mt-2 text-xs text-amber-300">
            User management unlocks after Admin approves your Seeker profile.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-100">Create subcontractor</h4>
          {error && (
            <div className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">First Name</label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">Last Name</label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={!canManage}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">Position</label>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Route Specialist"
                disabled={!canManage}
              />
            </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">Email</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">Phone</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">Profile photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoFile(e.target.files?.[0] ?? null)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:text-slate-200 hover:file:bg-slate-700"
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">Photo URL (optional)</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    disabled={!canManage}
                  />
                </div>
              </div>

              {photoUrl && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden border border-slate-700 bg-slate-900">
                    <img src={photoUrl} alt="Subcontractor preview" className="h-full w-full object-cover" />
                  </div>
                  <div className="text-xs text-slate-400">Photo preview</div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">Short bio</label>
                <textarea
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[90px]"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Brief background or responsibilities."
                  disabled={!canManage}
                />
              </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Add subcontractor
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-100">Current subcontractors</h4>
          {subcontractors.length === 0 ? (
            <p className="text-xs text-slate-400">No subcontractors yet.</p>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {subcontractors.map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs flex items-center justify-between gap-2"
                >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-50 truncate">
                        {sub.firstName} {sub.lastName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {sub.title || "Subcontractor"}
                      </div>
                      {sub.bio && (
                        <div className="text-[10px] text-slate-500 truncate">
                          {sub.bio}
                        </div>
                      )}
                    </div>
                  <button
                    type="button"
                    onClick={() => onRemove(sub.id)}
                    disabled={!canManage}
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-rose-500/10 border border-rose-500/40 text-rose-200 hover:bg-rose-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const ReadOnlyField: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-200">{label}</label>
      <div className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 min-h-[2.25rem] flex items-center">
        {children ?? <span className="text-slate-500">�</span>}
      </div>
    </div>
  );
};

const SubcontractorProfileView: React.FC<{ subcontractor?: Subcontractor }> = ({
  subcontractor,
}) => {
  if (!subcontractor) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
        Select a subcontractor to view their profile.
      </div>
    );
  }

    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">Subcontractor Profile</h3>
          <p className="text-sm text-slate-400">
            This view is limited to profile information and messaging.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center text-sm text-slate-400">
            {subcontractor.photoUrl ? (
              <img
                src={subcontractor.photoUrl}
                alt={`${subcontractor.firstName} ${subcontractor.lastName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              `${subcontractor.firstName?.slice(0, 1) ?? ""}${subcontractor.lastName?.slice(0, 1) ?? ""}`.toUpperCase()
            )}
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-50">
              {subcontractor.firstName} {subcontractor.lastName}
            </div>
            <div className="text-sm text-slate-400">
              {subcontractor.title ?? "Subcontractor"}
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Name">
            {subcontractor.firstName} {subcontractor.lastName}
          </ReadOnlyField>
          <ReadOnlyField label="Position">{subcontractor.title ?? "-"}</ReadOnlyField>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Email">{subcontractor.email ?? "-"}</ReadOnlyField>
          <ReadOnlyField label="Phone">{subcontractor.phone ?? "-"}</ReadOnlyField>
        </div>
        <ReadOnlyField label="Bio">{subcontractor.bio ?? "-"}</ReadOnlyField>
      </div>
    );
  };

const SubcontractorMessagingView: React.FC<{
  masterSeeker?: Seeker;
  subcontractor?: Subcontractor;
}> = ({ masterSeeker, subcontractor }) => {
  const [messages, setMessages] = useState(() =>
    masterSeeker && subcontractor
      ? getSubcontractorMessages(masterSeeker.id, subcontractor.id)
      : []
  );
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!masterSeeker || !subcontractor) {
      setMessages([]);
      return;
    }
    setMessages(getSubcontractorMessages(masterSeeker.id, subcontractor.id));
  }, [masterSeeker, subcontractor]);

  if (!masterSeeker || !subcontractor) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
        Select a subcontractor profile first.
      </div>
    );
  }

  const handleSend = () => {
    setError(null);
    if (!body.trim()) {
      setError("Write a message before sending.");
      return;
    }
    try {
      setSending(true);
      addSubcontractorMessage({
        seekerId: masterSeeker.id,
        subcontractorId: subcontractor.id,
        sender: "SUBCONTRACTOR",
        body,
      });
      setBody("");
      setMessages(getSubcontractorMessages(masterSeeker.id, subcontractor.id));
    } catch (err) {
      console.error(err);
      setError("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full min-h-0 rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-50">Message Master Contractor</h3>
        <p className="text-sm text-slate-400">
          Messages are only visible between you and the master contractor.
        </p>
      </div>

      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="text-sm text-slate-400">No messages yet.</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{msg.sender === "SUBCONTRACTOR" ? "You" : "Master"}</span>
                <span>{new Date(msg.createdAt).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-slate-200 whitespace-pre-wrap">{msg.body}</div>
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
          {error}
        </div>
      )}

      <div className="shrink-0 space-y-2">
        <textarea
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[90px]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Send an update to your master contractor."
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 rounded-full text-sm font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SeekerHierarchyView: React.FC<{
  seeker?: Seeker;
  subcontractors: Subcontractor[];
  readOnly?: boolean;
  onUpdateNodes: (nodes: { id: string; x: number; y: number; parentId?: string }[]) => void;
}> = ({ seeker, subcontractors, readOnly = false, onUpdateNodes }) => {
  if (!seeker) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
        Select or create a Seeker profile first.
      </div>
    );
  }

  const ownerName = `${(seeker as any).firstName ?? ""} ${(seeker as any).lastName ?? ""}`.trim() || "Seeker";
  const ownerTitle = (seeker as any).companyName || "Master Seeker";
  const owner = {
    id: (seeker as any).id,
    name: ownerName,
    title: ownerTitle,
    meta: (seeker as any).email || undefined,
    photoUrl: (seeker as any).photoUrl || (seeker as any).profileImageUrl || undefined,
  };

  const items = subcontractors.map((sub) => ({
    id: sub.id,
    name: `${sub.firstName} ${sub.lastName}`.trim() || "Subcontractor",
    title: sub.title || "Subcontractor",
    meta: sub.bio || sub.email || "Subcontractor",
    photoUrl: sub.photoUrl,
  }));

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-50">Subcontractor Hierarchy</h3>
        <p className="text-sm text-slate-400">
          Drag subcontractors from the left panel to build your tree.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-400">
            Loading hierarchy?
          </div>
        }
      >
        <LazyHierarchyCanvas
          owner={owner}
          items={items}
          nodes={(seeker as any).hierarchyNodes ?? []}
          onNodesChange={onUpdateNodes}
          readOnly={readOnly}
          showList={!readOnly}
          emptyHint="No subcontractors created yet."
        />
      </Suspense>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Seeker profile form & helpers                                      */
/* ------------------------------------------------------------------ */

type SeekerProfileFormProps = {
  mode: "create" | "edit";
  initial?: Seeker;
  onSaved: (id?: string) => void;
};

type SeekerProfileEditPageKey =
  | "core"
  | "insuranceVerticals"
  | "vehicleNotes"
  | "photos";

export const SeekerProfileForm: React.FC<SeekerProfileFormProps> = ({
  mode,
  initial,
  onSaved,
}) => {
  const isEdit = mode === "edit";
  const [activePage, setActivePage] =
    useState<SeekerProfileEditPageKey>("core");

  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [email, setEmail] = useState((initial as any)?.email ?? "");
  const [phone, setPhone] = useState((initial as any)?.phone ?? "");
  const [birthday, setBirthday] = useState((initial as any)?.birthday ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [stateCode, setStateCode] = useState(initial?.state ?? "FL");
  const [zip, setZip] = useState(initial?.zip ?? "");
  const [yearsInBusiness, setYearsInBusiness] = useState(
    initial?.yearsInBusiness != null ? String(initial.yearsInBusiness) : ""
  );
  const [vehicle, setVehicle] = useState((initial as any)?.vehicle ?? "");
  const [notes, setNotes] = useState((initial as any)?.notes ?? "");
  const [insuranceType, setInsuranceType] = useState(
    initial?.insuranceType ?? INSURANCE_TYPES[0]
  );
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>(
    initial?.deliveryVerticals ?? []
  );
  const [photoUrl, setPhotoUrl] = useState(
    (initial as any)?.photoUrl ?? (initial as any)?.profileImageUrl ?? ""
  );
  const [vehiclePhoto1, setVehiclePhoto1] = useState(
    (initial as any)?.vehiclePhoto1 ?? ""
  );
  const [vehiclePhoto2, setVehiclePhoto2] = useState(
    (initial as any)?.vehiclePhoto2 ?? ""
  );
  const [vehiclePhoto3, setVehiclePhoto3] = useState(
    (initial as any)?.vehiclePhoto3 ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const toggleVertical = (v: string) => {
    setSelectedVerticals((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  };

  const pages: { key: SeekerProfileEditPageKey; label: string }[] = [
    { key: "core", label: "Profile 1: Core Info" },
    { key: "insuranceVerticals", label: "Profile 2: Insurance & Verticals" },
    { key: "vehicleNotes", label: "Profile 3: Vehicle & Notes" },
    { key: "photos", label: "Profile 4: Photos" },
  ];

  const currentIndex = pages.findIndex((p) => p.key === activePage);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const canGoPrev = safeIndex > 0;
  const canGoNext = safeIndex < pages.length - 1;

  const goToIndex = (index: number) => {
    if (index < 0 || index >= pages.length) return;
    setActivePage(pages[index].key);
  };

  const goPrev = () => {
    if (!canGoPrev) return;
    goToIndex(safeIndex - 1);
  };

  const goNext = () => {
    if (!canGoNext) return;
    goToIndex(safeIndex + 1);
  };

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (e.deltaY > 0) goNext();
    else if (e.deltaY < 0) goPrev();
  };

  const handlePhotoFile = async (
    file: File | null,
    setter: (value: string) => void
  ) => {
    if (!file) return;
    try {
      setError(null);
      const url = await uploadImageWithFallback(file, MAX_IMAGE_BYTES);
      setter(url);
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError("First name, last name, and email are required.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        birthday: birthday || undefined,
        city: city.trim() || undefined,
        state: stateCode || undefined,
        zip: zip.trim() || undefined,
        yearsInBusiness: yearsInBusiness ? Number(yearsInBusiness) : undefined,
        deliveryVerticals:
          selectedVerticals.length > 0 ? selectedVerticals : undefined,
        vehicle: vehicle.trim() || undefined,
        insuranceType: insuranceType || undefined,
        notes: notes.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
        vehiclePhoto1: vehiclePhoto1.trim() || undefined,
        vehiclePhoto2: vehiclePhoto2.trim() || undefined,
        vehiclePhoto3: vehiclePhoto3.trim() || undefined,
      };

      if (isEdit) {
        if (!initial) {
          setError("No existing profile to update.");
          return;
        }
        const updated: Seeker = {
          ...initial,
          ...payload,
        };
        updateSeekerInStorage(updated);
        setSuccessMsg("Profile updated. Admin and other views will see your latest info.");
        onSaved(updated.id);
      } else {
        const created = addSeekerForcePending(payload as any);
        setSuccessMsg("Profile created and set to Pending. Admin must approve it before Retainers see you.");
        onSaved(created.id);
      }
    } catch (err) {
      console.error(err);
      setError(isEdit ? "Something went wrong updating your profile." : "Something went wrong creating your profile.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4"
      onWheel={handleWheel}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">
            {isEdit ? "Edit Seeker Profile" : "Create Seeker Profile"}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {pages[safeIndex]?.label} � Scroll, use arrows, or click a page.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrev}
            className={[
              "h-8 w-8 rounded-full border text-sm flex items-center justify-center transition",
              canGoPrev
                ? "border-slate-700 text-slate-200 hover:bg-slate-800"
                : "border-slate-800 text-slate-600 cursor-not-allowed opacity-50",
            ].join(" ")}
            title="Previous page"
          >
            ?
          </button>
          <span className="text-[11px] text-slate-400">
            {safeIndex + 1} / {pages.length}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className={[
              "h-8 w-8 rounded-full border text-sm flex items-center justify-center transition",
              canGoNext
                ? "border-slate-700 text-slate-200 hover:bg-slate-800"
                : "border-slate-800 text-slate-600 cursor-not-allowed opacity-50",
            ].join(" ")}
            title="Next page"
          >
            ?
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {pages.map((p) => {
          const isActive = p.key === activePage;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setActivePage(p.key)}
              className={[
                "px-3 py-1.5 rounded-full text-xs font-medium border transition",
                isActive
                  ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-200 shadow-sm"
                  : "bg-slate-900/70 border-slate-700 text-slate-300 hover:bg-slate-800",
              ].join(" ")}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {successMsg}
          </div>
        )}

        {activePage === "core" && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  First Name<span className="text-red-400"> *</span>
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jordan"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Last Name<span className="text-red-400"> *</span>
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Rivera"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Company (DBA)
              </label>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Bayline Courier LLC"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Email<span className="text-red-400"> *</span>
                </label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Phone
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Birthday
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">City</label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Tampa"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">State</label>
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                >
                  {US_STATES.map((st) => (
                    <option key={st} value={st} className="bg-slate-900 text-slate-50">
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">ZIP Code</label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="33602"
                />
              </div>
            </div>
          </>
        )}

        {activePage === "insuranceVerticals" && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">Years in Business</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={yearsInBusiness}
                  onChange={(e) => setYearsInBusiness(e.target.value)}
                  min={0}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">Insurance Type</label>
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={insuranceType}
                  onChange={(e) => setInsuranceType(e.target.value)}
                >
                  {INSURANCE_TYPES.map((x) => (
                    <option key={x} value={x} className="bg-slate-900 text-slate-50">
                      {x}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Delivery Verticals (pick a few)
              </label>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2 max-h-56 overflow-y-auto text-xs space-y-1">
                {DELIVERY_VERTICALS.map((v) => (
                  <label key={v} className="flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                      checked={selectedVerticals.includes(v)}
                      onChange={() => toggleVertical(v)}
                    />
                    <span>{v}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {activePage === "vehicleNotes" && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">Vehicle</label>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="2020 Ford Transit 250 High Roof"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">Notes</label>
              <textarea
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[120px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything you want Retainers and Admin to know�"
              />
            </div>
          </>
        )}

        {activePage === "photos" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-100">Profile photo</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">Upload</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoFile(e.target.files?.[0] ?? null, setPhotoUrl)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:text-slate-200 hover:file:bg-slate-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">Photo URL (optional)</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                  />
                </div>
              </div>
              {photoUrl && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden border border-slate-700 bg-slate-900">
                    <img src={photoUrl} alt="Profile preview" className="h-full w-full object-cover" />
                  </div>
                  <div className="text-xs text-slate-400">Preview</div>
                </div>
              )}
            </div>

            {[
              { key: "vehiclePhoto1", label: "Vehicle photo 1", value: vehiclePhoto1, set: setVehiclePhoto1 },
              { key: "vehiclePhoto2", label: "Vehicle photo 2", value: vehiclePhoto2, set: setVehiclePhoto2 },
              { key: "vehiclePhoto3", label: "Vehicle photo 3", value: vehiclePhoto3, set: setVehiclePhoto3 },
            ].map((slot) => (
              <div key={slot.key} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                <div className="text-sm font-semibold text-slate-100">{slot.label}</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-200">Upload</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoFile(e.target.files?.[0] ?? null, slot.set)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:text-slate-200 hover:file:bg-slate-700"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-200">Photo URL (optional)</label>
                    <input
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
                      value={slot.value}
                      onChange={(e) => slot.set(e.target.value)}
                      placeholder="https://example.com/vehicle.jpg"
                    />
                  </div>
                </div>
                {slot.value && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full overflow-hidden border border-slate-700 bg-slate-900">
                      <img src={slot.value} alt={`${slot.label} preview`} className="h-full w-full object-cover" />
                    </div>
                    <div className="text-xs text-slate-400">Preview</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting
              ? isEdit
                ? "Saving changes..."
                : "Saving..."
              : isEdit
                ? "Save Changes"
                : "Create Profile"}
          </button>
        </div>
      </form>
    </div>
  );
};

function updateSeekerInStorage(updated: Seeker) {
  if (typeof window === "undefined" || !updated || !updated.id) return;

  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;

      const raw = storage.getItem(key);
      if (!raw) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      // New-style store envelope: { schemaVersion, data: [...] }
      if (
        parsed &&
        typeof parsed === "object" &&
        "schemaVersion" in (parsed as any) &&
        "data" in (parsed as any)
      ) {
        const env = parsed as any;
        if (!Array.isArray(env.data)) continue;

        const idx = env.data.findIndex(
          (item: any) =>
            item &&
            item.id === updated.id &&
            (item.role === "SEEKER" || item.role === (updated as any)["role"])
        );
        if (idx === -1) continue;

        const next = [...env.data];
        next[idx] = updated;
        storage.setItem(
          key,
          JSON.stringify({ schemaVersion: env.schemaVersion, data: next })
        );
        break;
      }

      // Legacy raw arrays (older code paths)
      if (Array.isArray(parsed)) {
        const idx = parsed.findIndex(
          (item: any) =>
            item &&
            item.id === updated.id &&
            (item.role === "SEEKER" || item.role === (updated as any)["role"])
        );
        if (idx === -1) continue;

        const next = [...parsed];
        next[idx] = updated;
        storage.setItem(key, JSON.stringify(next));
        break;
      }
    }
  } catch (err) {
    console.error("Failed to update seeker in localStorage", err);
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function resolveCurrentSeekerId(seekers: Seeker[], prevId: string | null): string | null {
  if (!seekers || seekers.length === 0) return null;

  const findById = (id: string | null) => (id ? seekers.find((s) => s.id === id) : undefined);

  const prev = findById(prevId);
  if (prev && prev.status !== "DELETED") return prev.id;

  let storedId: string | null = null;
  if (typeof window !== "undefined") {
    storedId = window.localStorage.getItem(CURRENT_SEEKER_KEY) ?? null;
  }
  const stored = findById(storedId);
  if (stored && stored.status !== "DELETED") return stored.id;

  const nonDeleted = seekers.find((s) => s.status !== "DELETED");
  if (nonDeleted) return nonDeleted.id;

  return null;
}

function persistCurrentSeekerId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(CURRENT_SEEKER_KEY, id);
  else window.localStorage.removeItem(CURRENT_SEEKER_KEY);
}

function formatSeekerName(s: Seeker): string {
  const full = `${(s as any).firstName ?? ""} ${(s as any).lastName ?? ""}`.trim();
  if (full) return full;
  return (s as any).name || "Seeker";
}

function formatRetainerName(r: Retainer): string {
  return (r as any).companyName || (r as any).name || (r as any).ceoName || "Retainer";
}

function getRetainerPhotoUrl(r: Retainer): string | undefined {
  return (
    (r as any).logoUrl ||
    (r as any).photoUrl ||
    (r as any).profileImageUrl ||
    getStockImageUrl("RETAINER", (r as any).id)
  );
}

function renderHeaderTitle(tab: TabKey): string {
  switch (tab) {
    case "dashboard":
      return "Seeker Dashboard";
    case "action":
      return "Action Center";
    case "find":
      return "Find Retainers";
    case "linking":
      return "Linking";
    case "badges":
      return "Badges";
    case "editProfile":
      return "Seeker Profile";
    case "messages":
      return "Messaging Center";
    case "hierarchy":
      return "Hierarchy Builder";
    default:
      return "Seeker Dashboard";
  }
}

function renderHeaderSubtitle(tab: TabKey): string {
  switch (tab) {
    case "dashboard":
      return "Link requests, feed updates, and badge progress at a glance.";
    case "action":
      return "Routes, scheduling, and profile tools in one place.";
    case "find":
      return "Spin the wheel and sort Retainers into your working lists.";
    case "linking":
      return "Confirm video calls and approve links with Retainers to unlock linked-only content.";
    case "badges":
      return "Select up to 4 badges and confirm weekly progress with linked Retainers.";
    case "editProfile":
      return "Create and manage your profile so Admin and Retainers can understand who you are.";
    case "messages":
      return "Navigate conversations by Retainer and subject using the left rail.";
    case "hierarchy":
      return "Drag subcontractor cards into the tree to build your org view.";
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/* Schedule (Seeker)                                                  */
/* ------------------------------------------------------------------ */

const SeekerScheduleView: React.FC<{
  seeker?: Seeker;
  onSaved: () => void;
}> = ({ seeker, onSaved }) => {
  const initial: WeeklyAvailability = useMemo(() => {
    const tz =
      typeof window !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined;
    return (seeker as any)?.availability?.blocks
      ? (seeker as any).availability
      : { timezone: tz, blocks: [] };
  }, [seeker?.id]);

  const [timezone, setTimezone] = useState<string>(initial.timezone || "");
  const [enabledDays, setEnabledDays] = useState<Set<DayOfWeek>>(() => {
    const days = new Set<DayOfWeek>();
    for (const b of initial.blocks || []) days.add(b.day);
    return days;
  });

  const [timesByDay, setTimesByDay] = useState<Record<DayOfWeek, { start: string; end: string }>>(
    () => {
      const base: Record<DayOfWeek, { start: string; end: string }> = {
        MON: { start: "08:00", end: "16:00" },
        TUE: { start: "08:00", end: "16:00" },
        WED: { start: "08:00", end: "16:00" },
        THU: { start: "08:00", end: "16:00" },
        FRI: { start: "08:00", end: "16:00" },
        SAT: { start: "09:00", end: "15:00" },
        SUN: { start: "09:00", end: "15:00" },
      };

      for (const b of initial.blocks || []) {
        base[b.day] = { start: b.start, end: b.end };
      }
      return base;
    }
  );

  const summary = useMemo(() => {
    const blocks: { day: DayOfWeek; start: string; end: string }[] = [];
    for (const d of DAYS.map((x) => x.key)) {
      if (!enabledDays.has(d)) continue;
      const t = timesByDay[d];
      blocks.push({ day: d, start: t.start, end: t.end });
    }
    return blocks.length === 0 ? "No availability set" : `${formatDaysShort(blocks.map((b) => b.day))}`;
  }, [enabledDays, timesByDay]);

  if (!seeker) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
        Select or create a Seeker profile first.
      </div>
    );
  }

  const toggleDay = (day: DayOfWeek) => {
    setEnabledDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const applyPreset = (preset: "WEEKDAYS_AM" | "WEEKDAYS_PM" | "NIGHTS" | "WEEKENDS") => {
    if (preset === "WEEKDAYS_AM") {
      setEnabledDays(new Set(["MON", "TUE", "WED", "THU", "FRI"]));
      setTimesByDay((prev) => ({
        ...prev,
        MON: { start: "08:00", end: "16:00" },
        TUE: { start: "08:00", end: "16:00" },
        WED: { start: "08:00", end: "16:00" },
        THU: { start: "08:00", end: "16:00" },
        FRI: { start: "08:00", end: "16:00" },
      }));
    } else if (preset === "WEEKDAYS_PM") {
      setEnabledDays(new Set(["MON", "TUE", "WED", "THU", "FRI"]));
      setTimesByDay((prev) => ({
        ...prev,
        MON: { start: "14:00", end: "22:00" },
        TUE: { start: "14:00", end: "22:00" },
        WED: { start: "14:00", end: "22:00" },
        THU: { start: "14:00", end: "22:00" },
        FRI: { start: "14:00", end: "22:00" },
      }));
    } else if (preset === "NIGHTS") {
      setEnabledDays(new Set(["MON", "TUE", "WED", "THU", "FRI"]));
      setTimesByDay((prev) => ({
        ...prev,
        MON: { start: "18:00", end: "23:00" },
        TUE: { start: "18:00", end: "23:00" },
        WED: { start: "18:00", end: "23:00" },
        THU: { start: "18:00", end: "23:00" },
        FRI: { start: "18:00", end: "23:00" },
      }));
    } else {
      setEnabledDays(new Set(["SAT", "SUN"]));
      setTimesByDay((prev) => ({
        ...prev,
        SAT: { start: "09:00", end: "15:00" },
        SUN: { start: "09:00", end: "15:00" },
      }));
    }
  };

  const handleSave = () => {
    const blocks: WeeklyAvailability["blocks"] = [];
    for (const day of DAYS.map((x) => x.key)) {
      if (!enabledDays.has(day)) continue;
      const t = timesByDay[day];
      if (!t?.start || !t?.end) continue;
      blocks.push({ day, start: t.start, end: t.end });
    }

    const nextAvailability: WeeklyAvailability = {
      timezone: timezone.trim() || undefined,
      blocks,
    };

    const updated: Seeker = { ...(seeker as any), availability: nextAvailability };
    updateSeekerInStorage(updated);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
        <h3 className="text-lg font-semibold text-slate-50 mb-1">Availability</h3>
        <p className="text-sm text-slate-300">
          This availability is used to calculate schedule match badges on Retainer and Route cards.
        </p>
        <div className="text-xs text-slate-400 mt-2">
          Current: <span className="text-slate-200">{summary}</span>
        </div>
      </div>

      <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-slate-400">Presets</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset("WEEKDAYS_AM")}
                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
              >
                Weekdays (AM)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("WEEKDAYS_PM")}
                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
              >
                Weekdays (PM)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("NIGHTS")}
                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
              >
                Nights
              </button>
              <button
                type="button"
                onClick={() => applyPreset("WEEKENDS")}
                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
              >
                Weekends
              </button>
            </div>
          </div>

          <div className="min-w-[220px]">
            <label className="text-xs font-medium text-slate-200">Timezone</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Example: America/New_York"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 overflow-hidden">
          <div className="grid grid-cols-[120px_1fr_1fr] gap-0 border-b border-slate-800 px-4 py-2 text-[11px] text-slate-400">
            <div>Day</div>
            <div>Start</div>
            <div>End</div>
          </div>

          <div className="divide-y divide-slate-800">
            {DAYS.map((d) => {
              const enabled = enabledDays.has(d.key);
              const t = timesByDay[d.key];
              return (
                <div key={d.key} className="grid grid-cols-[120px_1fr_1fr] gap-0 px-4 py-2 items-center">
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleDay(d.key)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                    />
                    <span>{d.short}</span>
                  </label>

                  <input
                    type="time"
                    value={t.start}
                    disabled={!enabled}
                    onChange={(e) =>
                      setTimesByDay((prev) => ({
                        ...prev,
                        [d.key]: { ...prev[d.key], start: e.target.value },
                      }))
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />

                  <input
                    type="time"
                    value={t.end}
                    disabled={!enabled}
                    onChange={(e) =>
                      setTimesByDay((prev) => ({
                        ...prev,
                        [d.key]: { ...prev[d.key], end: e.target.value },
                      }))
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
            onClick={() => {
              setEnabledDays(new Set());
            }}
          >
            Clear availability
          </button>

          <button
            type="button"
            className="px-4 py-2 rounded-full text-sm font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition"
            onClick={handleSave}
          >
            Save schedule
          </button>
        </div>
      </section>
    </div>
  );
};

const RetainerWheelExpandedCard: React.FC<{
  seekerId?: string | null;
  retainer: Retainer;
  scheduleMatch?: ScheduleMatch;
  routeCount?: number;
  isLinked?: boolean;
  canMessage: boolean;
  onClose: () => void;
  onOpenFullProfile: () => void;
  onMessage: () => void;
  onClassify: (bucket: RetainerBucketKey) => void;
}> = ({
  seekerId,
  retainer,
  scheduleMatch,
  routeCount,
  isLinked,
  canMessage,
  onClose,
  onOpenFullProfile,
  onMessage,
  onClassify,
}) => {
  const name = formatRetainerName(retainer);
  const city = (retainer as any).city ?? "�";
  const state = (retainer as any).state ?? "�";
  const zip = (retainer as any).zip ?? "�";
  const mission = (retainer as any).mission ?? (retainer as any).missionStatement ?? "";
  const photoUrl = getRetainerPhotoUrl(retainer);

  const reputation = getReputationScoreForProfile({ ownerRole: "RETAINER", ownerId: retainer.id });
  const pctFromCounts = (yesCount: number, noCount: number) => {
    const total = yesCount + noCount;
    if (total <= 0) return null;
    return Math.round((yesCount / total) * 100);
  };

  const paymentOnTime = getBadgeProgress(
    "RETAINER",
    retainer.id,
    "retainer_on_time_payment" as any
  );
  const paymentAccuracy = getBadgeProgress(
    "RETAINER",
    retainer.id,
    "retainer_payment_accuracy" as any
  );
  const paymentOnTimePct = pctFromCounts(
    paymentOnTime.yesCount,
    paymentOnTime.noCount
  );
  const paymentAccuracyPct = pctFromCounts(
    paymentAccuracy.yesCount,
    paymentAccuracy.noCount
  );

  const activeRoutes: Route[] = useMemo(() => {
    if (!seekerId) return [];
    const routes = getVisibleRoutesForSeeker(seekerId);
    return routes
      .filter((r) => r.retainerId === retainer.id && r.status === "ACTIVE")
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [retainer.id, seekerId]);

  const recentPosts: RetainerPost[] = useMemo(() => {
    const list = getRetainerPosts(retainer.id).filter((p) => p.status === "ACTIVE");
    const visible = isLinked ? list : list.filter((p) => p.audience === "PUBLIC");
    return visible.slice(0, 2);
  }, [isLinked, retainer.id]);

  const formatPay = (r: Route): string => {
    const model = r.payModel ? `${r.payModel}: ` : "";
    const min = typeof r.payMin === "number" ? r.payMin : null;
    const max = typeof r.payMax === "number" ? r.payMax : null;
    const fmt = (n: number) =>
      n.toLocaleString(undefined, { style: "currency", currency: "USD" });
    if (min != null && max != null) return `${model}${fmt(min)}�${fmt(max)}`;
    if (min != null) return `${model}${fmt(min)}+`;
    if (max != null) return `${model}Up to ${fmt(max)}`;
    return model ? model.trim() : "Pay not listed";
  };

  const routeScheduleLabel = (r: Route): string => {
    if (r.scheduleDays?.length && r.scheduleStart && r.scheduleEnd) {
      return `${formatDaysShort(r.scheduleDays)} ${r.scheduleStart}�${r.scheduleEnd}`;
    }
    return r.schedule || "Schedule not listed";
  };

  const topBadges = getBadgeSummaryForProfile({
    ownerRole: "RETAINER",
    ownerId: retainer.id,
    max: 8,
  });

  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="text-sm text-slate-200 font-semibold truncate">{name}</div>
        <button
          type="button"
          onClick={onClose}
          className="h-9 w-9 rounded-full border border-slate-700 text-slate-200 hover:bg-slate-900 transition"
          title="Close"
        >
          �
        </button>
      </div>

      <div className="p-4 md:flex md:gap-4">
        <div className="w-full md:w-72 shrink-0">
          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-[320px] w-full max-w-[320px] mx-auto md:mx-0 md:h-72 md:w-72 md:max-w-none flex items-center justify-center">
            {photoUrl ? (
              <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="text-sm text-slate-400">No photo</div>
            )}
          </div>
        </div>

        <div className="mt-4 md:mt-0 flex-1 min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
          {isLinked && (
            <span className="inline-flex items-center rounded-full bg-white/10 border border-white/10 px-2.5 py-1 text-xs text-white/80">
              Linked
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-200">
            Approved
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-900 border border-slate-800 px-2.5 py-1 text-xs text-slate-200">
            {city}, {state} {zip !== "-" ? zip : ""}
          </span>
          </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-100">
            {badgeIconFor("shield", "h-4 w-4")}
            <span className="font-semibold">
              {reputation.score == null ? "Reputation ?" : `Reputation ${reputation.score}`}
            </span>
            {reputation.total > 0 && <span className="text-slate-400">({reputation.total})</span>}
          </span>

          {scheduleMatch && scheduleMatch.percent > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
              {badgeIconFor("clock", "h-4 w-4")}
              <span className="font-semibold">{scheduleMatch.percent}% schedule match</span>
              {scheduleMatch.overlapDays.length > 0 && (
                <span className="text-emerald-200/70">
                  � {formatDaysShort(scheduleMatch.overlapDays)}
                </span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-xs text-slate-400">
              {badgeIconFor("clock", "h-4 w-4")}
              Schedule �
            </span>
          )}

          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-xs text-slate-300">
            {badgeIconFor("route", "h-4 w-4")}
            Routes: {typeof routeCount === "number" ? routeCount : "�"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-xs text-slate-200">
            {badgeIconFor("cash", "h-4 w-4")}
            <span className="font-semibold">
              On-time pay: {paymentOnTimePct == null ? "�" : `${paymentOnTimePct}%`}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-xs text-slate-200">
            {badgeIconFor("check", "h-4 w-4")}
            <span className="font-semibold">
              Pay accuracy: {paymentAccuracyPct == null ? "�" : `${paymentAccuracyPct}%`}
            </span>
          </span>
          {scheduleMatch && scheduleMatch.overlapMinutes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-xs text-slate-300">
              {badgeIconFor("clock", "h-4 w-4")}
              Overlap: {Math.round(scheduleMatch.overlapMinutes / 60)}h
            </span>
          )}
        </div>

        {activeRoutes.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Currently Recruiting For
              </div>
              <div className="text-[11px] text-slate-500">
                Showing {Math.min(3, activeRoutes.length)} of {activeRoutes.length}
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {activeRoutes.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-100">
                      {r.title}
                    </div>
                    <div className="text-xs text-slate-400">
                      {r.city && r.state ? `${r.city}, ${r.state}` : "�"}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/30 px-2 py-0.5">
                      {badgeIconFor("clock", "h-3.5 w-3.5")}
                      {routeScheduleLabel(r)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/30 px-2 py-0.5">
                      {badgeIconFor("cash", "h-3.5 w-3.5")}
                      {formatPay(r)}
                    </span>
                    {typeof r.openings === "number" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/30 px-2 py-0.5">
                        Openings: {r.openings}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentPosts.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Recent Highlights
            </div>
            <div className="mt-3 grid gap-2">
              {recentPosts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-100">
                      {p.title}
                    </div>
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      {p.type === "AD" ? "Ad" : "Update"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-300 whitespace-pre-wrap">
                    {p.body.length > 180 ? `${p.body.slice(0, 180)}�` : p.body}
                  </div>
                </div>
              ))}
            </div>
            {!isLinked && (
              <div className="mt-3 text-[11px] text-slate-500">
                Showing public highlights. Link to unlock full updates.
              </div>
            )}
          </div>
        )}

        {mission && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Mission
            </div>
            <div className="text-sm text-slate-100 mt-2 whitespace-pre-wrap">
              {mission}
            </div>
          </div>
        )}

        {topBadges.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Top Badges
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {topBadges.map((b) => (
                <span
                  key={b.badge.id}
                  title={`${b.badge.title} � Level ${b.maxLevel}\n${b.badge.description}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs text-slate-100"
                >
                  {badgeIconFor(b.badge.iconKey, "h-4 w-4")}
                  <span className="font-semibold">{b.badge.title}</span>
                  <span className="text-slate-400">Lv {b.maxLevel}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenFullProfile}
              className="px-4 py-2 rounded-full text-sm font-medium bg-slate-900 border border-slate-700 text-slate-100 hover:bg-slate-800 transition"
            >
              Open full profile
            </button>
            <button
              type="button"
              onClick={onMessage}
              disabled={!canMessage}
              className={[
                "px-4 py-2 rounded-full text-sm font-medium border transition",
                canMessage
                  ? "bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 border-emerald-400/20"
                  : "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed opacity-60",
              ].join(" ")}
            >
              Message
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onClassify("excellent")}
              className="px-3 py-2 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-100 border border-emerald-500/50 hover:bg-emerald-500/30 transition"
            >
              Excellent
            </button>
            <button
              type="button"
              onClick={() => onClassify("possible")}
              className="px-3 py-2 rounded-full text-xs font-medium bg-sky-500/15 text-sky-100 border border-sky-500/40 hover:bg-sky-500/25 transition"
            >
              Possible
            </button>
            <button
              type="button"
              onClick={() => onClassify("notNow")}
              className="px-3 py-2 rounded-full text-xs font-medium bg-rose-500/15 text-rose-100 border border-rose-500/40 hover:bg-rose-500/25 transition"
            >
              Not now
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Linking (Seeker)                                                   */
/* ------------------------------------------------------------------ */

const SeekerLinkingView: React.FC<{
  seekerId: string | null;
  retainers: Retainer[];
  onToast: (msg: string) => void;
  onMessage: (r: Retainer) => void;
}> = ({ seekerId, retainers, onToast, onMessage }) => {
  const [q, setQ] = useState("");
  const [refresh, setRefresh] = useState(0);

  const links = useMemo<LinkingLink[]>(
    () => (seekerId ? getLinksForSeeker(seekerId) : []),
    [seekerId, refresh]
  );

  const linkByRetainerId = useMemo(() => {
    const m = new Map<string, LinkingLink>();
    for (const l of links) m.set(l.retainerId, l);
    return m;
  }, [links]);

  const filteredRetainers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return retainers;
    return retainers.filter((r) => (r.companyName || "").toLowerCase().includes(needle));
  }, [q, retainers]);

  if (!seekerId) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
        Select or create a Seeker profile first.
      </div>
    );
  }

  const ensureLink = (retainerId: string) => {
    const existing = linkByRetainerId.get(retainerId) ?? null;
    if (existing) return existing;
    return requestLink({ seekerId, retainerId, by: "SEEKER" });
  };

  const statusBadge = (status: LinkingLink["status"] | "NONE") => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-500/15 border-emerald-500/40 text-emerald-200";
      case "PENDING":
        return "bg-sky-500/10 border-sky-500/30 text-sky-200";
      case "REJECTED":
        return "bg-rose-500/10 border-rose-500/30 text-rose-200";
      case "DISABLED":
        return "bg-amber-500/10 border-amber-500/30 text-amber-200";
      case "NONE":
      default:
        return "bg-white/5 border-white/10 text-white/70";
    }
  };

  const statusForRetainer = (retainerId: string) =>
    (linkByRetainerId.get(retainerId)?.status ?? "NONE") as LinkingLink["status"] | "NONE";

  const linkedRetainers = useMemo(
    () => filteredRetainers.filter((r) => statusForRetainer(r.id) === "ACTIVE"),
    [filteredRetainers, linkByRetainerId]
  );

  const pendingRetainers = useMemo(
    () => filteredRetainers.filter((r) => statusForRetainer(r.id) !== "ACTIVE"),
    [filteredRetainers, linkByRetainerId]
  );

  const renderRetainerCard = (r: Retainer) => {
    const link = linkByRetainerId.get(r.id) ?? null;
    const status = link?.status ?? ("NONE" as const);
    const retainerName = r.companyName || "Retainer";
    const pendingParts =
      link && status === "PENDING"
        ? [
            !link.videoConfirmedBySeeker ? "your video" : null,
            !link.videoConfirmedByRetainer ? "retainer video" : null,
            !link.approvedBySeeker ? "your approval" : null,
            !link.approvedByRetainer ? "retainer approval" : null,
          ].filter(Boolean)
        : [];

    return (
      <div
        key={r.id}
        className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <ProfileAvatar role="RETAINER" profile={r} name={retainerName} />
            <div className="min-w-0">
              <div className="text-lg font-semibold text-slate-50 truncate">
                {retainerName}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {(r.city || r.state) && (
                  <span>
                    {r.city ?? "Unknown"}, {r.state ?? "Unknown"}{" "}
                  </span>
                )}
                <span>
                  Status:{" "}
                  <span
                    className={[
                      "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px]",
                      statusBadge(status),
                    ].join(" ")}
                  >
                    {status}
                  </span>
                  {pendingParts.length > 0 && (
                    <span className="ml-2 text-[10px] text-slate-500">
                      Waiting on {pendingParts.join(", ")}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <Link
              to={`/retainers/${r.id}`}
              className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
            >
              Open profile
            </Link>
            <button
              type="button"
              className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
              onClick={() => onMessage(r)}
            >
              Direct message
            </button>
          </div>
        </div>

        {link ? (
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-200">
                <span>Video confirmed (you)</span>
                <input
                  type="checkbox"
                  checked={link.videoConfirmedBySeeker}
                  onChange={(e) => {
                    ensureLink(r.id);
                    const updated = setLinkVideoConfirmed({
                      seekerId,
                      retainerId: r.id,
                      by: "SEEKER",
                      value: e.target.checked,
                    });
                    if (e.target.checked) {
                      onToast(
                        updated?.status === "ACTIVE"
                          ? "Link is now active."
                          : "Video confirmation saved. Waiting on the other side."
                      );
                    }
                    setRefresh((n) => n + 1);
                  }}
                />
              </label>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
                <span>Video confirmed (retainer)</span>
                <span className="text-slate-200">
                  {link.videoConfirmedByRetainer ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-200">
                <span>Approve link (you)</span>
                <input
                  type="checkbox"
                  checked={link.approvedBySeeker}
                  onChange={(e) => {
                    ensureLink(r.id);
                    const updated = setLinkApproved({
                      seekerId,
                      retainerId: r.id,
                      by: "SEEKER",
                      value: e.target.checked,
                    });
                    if (e.target.checked) {
                      onToast(
                        updated?.status === "ACTIVE"
                          ? "Link is now active."
                          : "Approval saved. Waiting on the other side."
                      );
                    }
                    setRefresh((n) => n + 1);
                  }}
                />
              </label>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
                <span>Approved (retainer)</span>
                <span className="text-slate-200">
                  {link.approvedByRetainer ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {link.status === "PENDING" && (
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl text-xs bg-rose-500/15 border border-rose-500/40 text-rose-100 hover:bg-rose-500/20 transition"
                  onClick={() => {
                    setLinkStatus({
                      seekerId,
                      retainerId: r.id,
                      status: "REJECTED",
                    });
                    onToast("Link rejected");
                    setRefresh((n) => n + 1);
                  }}
                >
                  Reject
                </button>
              )}

              {link.status === "ACTIVE" && (
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl text-xs bg-amber-500/15 border border-amber-500/40 text-amber-100 hover:bg-amber-500/20 transition"
                  onClick={() => {
                    setLinkStatus({
                      seekerId,
                      retainerId: r.id,
                      status: "DISABLED",
                    });
                    onToast("Link disabled");
                    setRefresh((n) => n + 1);
                  }}
                >
                  Disable link
                </button>
              )}

              {(link.status === "REJECTED" || link.status === "DISABLED") && (
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                  onClick={() => {
                    resetLink(r.id, seekerId);
                    requestLink({ seekerId, retainerId: r.id, by: "SEEKER" });
                    onToast("Started a new link request");
                    setRefresh((n) => n + 1);
                  }}
                >
                  Start new request
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400">
            No link record yet. Request a link to begin.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
        <h3 className="text-lg font-semibold text-slate-50 mb-1">Linking</h3>
        <p className="text-sm text-slate-300">
          A link becomes active only after both sides confirm the video call and
          approve the link.
        </p>
      </div>

      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="text-sm text-slate-300">
          {retainers.length} approved Retainers available
        </div>
        <div className="flex gap-2">
          <input
            className="w-full md:w-80 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Search retainers"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Refresh
          </button>
        </div>
      </div>

      {filteredRetainers.length === 0 ? (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
          No retainers match your search.
        </div>
      ) : (
        <div className="grid gap-3 md:gap-4 md:grid-cols-2 min-h-0 flex-1 w-full">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col min-h-0 w-full">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Linked profiles
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Active connections ready for badge check-ins.
                </div>
              </div>
              <div className="text-xs text-slate-400">{linkedRetainers.length}</div>
            </div>
            {linkedRetainers.length === 0 ? (
              <div className="mt-3 text-xs text-slate-400">No linked profiles yet.</div>
            ) : (
              <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                {linkedRetainers.map(renderRetainerCard)}
              </div>
            )}
          </div>
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col min-h-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Pending links
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Requests awaiting confirmation or approval.
                </div>
              </div>
              <div className="text-xs text-slate-400">{pendingRetainers.length}</div>
            </div>
            {pendingRetainers.length === 0 ? (
              <div className="mt-3 text-xs text-slate-400">No pending links right now.</div>
            ) : (
              <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                {pendingRetainers.map(renderRetainerCard)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
const SeekerRoutesView: React.FC<{
  seekerId: string | null;
  retainers: Retainer[];
  onToast: (msg: string) => void;
}> = ({ seekerId, retainers, onToast }) => {
  const [refresh, setRefresh] = useState(0);
  const [noticeDraftRouteId, setNoticeDraftRouteId] = useState<string | null>(null);
  const [noticeEndDate, setNoticeEndDate] = useState("");
  const [noticeTick, setNoticeTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setNoticeTick((n) => n + 1);
    window.addEventListener(ROUTE_NOTICE_EVENT, handler);
    return () => window.removeEventListener(ROUTE_NOTICE_EVENT, handler);
  }, []);

  const routes = useMemo<Route[]>(
    () => getVisibleRoutesForSeeker(seekerId ?? ""),
    [seekerId, refresh]
  );

  const interestSet = useMemo(() => {
    if (!seekerId) return new Set<string>();
    const list = getInterestsForSeeker(seekerId);
    return new Set(list.map((i) => i.routeId));
  }, [seekerId, refresh]);

  const retainerById = useMemo(
    () => new Map(retainers.map((r) => [r.id, r] as const)),
    [retainers]
  );

  const routeNotices = useMemo(
    () => (seekerId ? getRouteNoticesForSeeker(seekerId) : []),
    [seekerId, noticeTick]
  );

  const toInputDate = (iso: string) => {
    const dt = new Date(iso);
    if (Number.isNaN(dt.valueOf())) return "";
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const defaultNoticeDate = () => {
    const dt = new Date();
    dt.setDate(dt.getDate() + 14);
    return toInputDate(dt.toISOString());
  };

  const formatDateLabel = (iso: string) => {
    const dt = new Date(iso);
    if (Number.isNaN(dt.valueOf())) return "-";
    return dt.toLocaleDateString();
  };

  const noticeDaysLeft = (iso: string) => {
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) return 0;
    const diff = ts - Date.now();
    return Math.max(0, Math.ceil(diff / 86_400_000));
  };

  if (!seekerId) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
        Select or create a Seeker profile first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
        <h3 className="text-lg font-semibold text-slate-50 mb-1">Routes</h3>
        <p className="text-sm text-slate-300">
          Routes are visible based on audience rules. Linked-only routes appear
          after both sides confirm and approve linking.
        </p>
      </div>

      {routes.length === 0 ? (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
          No routes are visible yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {routes.map((route) => {
            const retainer = retainerById.get(route.retainerId);
            const retainerName = retainer?.companyName ?? "Retainer";
            const interested = interestSet.has(route.id);
            const isDedicated = route.commitmentType === "DEDICATED";
            const activeNotice = routeNotices.find(
              (notice) => notice.routeId === route.id && notice.status === "ACTIVE"
            );
            const noticeDays = activeNotice
              ? noticeDaysLeft(activeNotice.effectiveEndAt)
              : null;
            const noticeDateLabel = activeNotice
              ? formatDateLabel(activeNotice.effectiveEndAt)
              : null;

            return (
              <div
                key={route.id}
                className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm uppercase tracking-wide text-slate-400">
                      {retainerName}
                    </div>
                    <div className="text-lg font-semibold text-slate-50">
                      {route.title}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {(route.city || route.state) && (
                        <span>
                          {route.city ?? "�"}, {route.state ?? "�"} �{" "}
                        </span>
                      )}
                      <span>
                        Audience:{" "}
                        <span className="text-slate-200">{route.audience}</span>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const { interested: next } = toggleInterest(
                          seekerId,
                          route.id
                        );
                        onToast(next ? "Marked Interested" : "Interest removed");
                        setRefresh((n) => n + 1);
                      } catch (err: any) {
                        onToast(err?.message || "Could not update interest");
                      }
                    }}
                    className={[
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition",
                      interested
                        ? "bg-emerald-500/20 text-emerald-100 border-emerald-500/50 hover:bg-emerald-500/25"
                        : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
                    ].join(" ")}
                  >
                    {interested ? "Interested ?" : "Interested"}
                  </button>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-slate-300">
                  {route.vertical && (
                    <div>
                      <span className="text-slate-400">Vertical:</span>{" "}
                      {route.vertical}
                    </div>
                  )}
                  {route.schedule && (
                    <div>
                      <span className="text-slate-400">Schedule:</span>{" "}
                      {route.schedule}
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Commitment:</span>{" "}
                    {isDedicated ? "Dedicated (notice tracked)" : "Flexible"}
                  </div>
                  {(route.payMin != null || route.payMax != null) && (
                    <div>
                      <span className="text-slate-400">Pay:</span>{" "}
                      {route.payMin ?? "�"}�{route.payMax ?? "�"}{" "}
                      {route.payModel ? `(${route.payModel})` : ""}
                    </div>
                  )}
                  {route.openings != null && (
                    <div>
                      <span className="text-slate-400">Openings:</span>{" "}
                      {route.openings}
                    </div>
                  )}
                  {route.requirements && (
                    <div className="text-slate-300 whitespace-pre-wrap">
                      <span className="text-slate-400">Requirements:</span>{" "}
                      {route.requirements}
                    </div>
                  )}
                </div>

                {isDedicated && (
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-400">
                          Dedicated route notice
                        </div>
                        <div className="text-xs text-slate-300 mt-1">
                          Use this if you are leaving a repeating route. This notice is a request to the retainer and is not a guarantee of work.
                        </div>
                      </div>
                      {activeNotice ? (
                        <span className="inline-flex items-center rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100">
                          Notice active: {noticeDays ?? 0}d
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setNoticeDraftRouteId(route.id);
                            setNoticeEndDate(defaultNoticeDate());
                          }}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                        >
                          Give notice
                        </button>
                      )}
                    </div>

                    {activeNotice && noticeDateLabel && (
                      <div className="text-[11px] text-slate-400">
                        End date: <span className="text-slate-200">{noticeDateLabel}</span>
                      </div>
                    )}

                    {noticeDraftRouteId === route.id && (
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="text-[11px] text-slate-400">End date</label>
                        <input
                          type="date"
                          value={noticeEndDate}
                          onChange={(e) => setNoticeEndDate(e.target.value)}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!noticeEndDate) {
                              onToast("Select a notice end date");
                              return;
                            }
                            try {
                              const iso = new Date(`${noticeEndDate}T00:00:00`).toISOString();
                              createRouteNotice({
                                routeId: route.id,
                                retainerId: route.retainerId,
                                seekerId,
                                effectiveEndAt: iso,
                              });
                              setNoticeDraftRouteId(null);
                              setNoticeEndDate("");
                              setNoticeTick((n) => n + 1);
                              onToast("Notice submitted");
                            } catch (err: any) {
                              onToast(err?.message || "Could not submit notice");
                            }
                          }}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition"
                        >
                          Submit notice
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNoticeDraftRouteId(null);
                            setNoticeEndDate("");
                          }}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {activeNotice && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNoticeDraftRouteId(route.id);
                            setNoticeEndDate(toInputDate(activeNotice.effectiveEndAt));
                          }}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                        >
                          Update notice
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            cancelRouteNotice(activeNotice.id);
                            setNoticeTick((n) => n + 1);
                            onToast("Notice cancelled");
                          }}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/15 border border-rose-500/40 text-rose-100 hover:bg-rose-500/20 transition"
                        >
                          Cancel notice
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function renderSubcontractorHeaderTitle(tab: TabKey): string {
  switch (tab) {
    case "messages":
      return "Message Master Contractor";
    case "hierarchy":
      return "Hierarchy Viewer";
    default:
      return "Subcontractor Profile";
  }
}

function renderSubcontractorHeaderSubtitle(tab: TabKey): string {
  switch (tab) {
    case "messages":
      return "Send updates directly to your master contractor.";
    case "hierarchy":
      return "Read-only view of the current org tree.";
    default:
      return "View your own profile details.";
  }
}

export default SeekerPage;
