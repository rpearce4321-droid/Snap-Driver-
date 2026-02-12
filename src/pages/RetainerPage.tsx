// src/pages/RetainerPage.tsx

import React, { useMemo, useState, useEffect, useRef, lazy, Suspense } from "react";

import type { CSSProperties } from "react";

import { Link, useLocation, useNavigate } from "react-router-dom";

import {

  US_STATES,

  DELIVERY_VERTICALS,

  TRAITS,

  PAYMENT_TERMS,
  PAY_CYCLE_FREQUENCIES,

  getRetainers,

  getSeekers,

  buildRetainerRecord,
  upsertRetainerRecord,

  addRetainerUser,

  removeRetainerUser,

  setRetainerUserLevelLabels,

  setRetainerHierarchyNodes,

  type PaymentTerm,
  type PayCycleFrequency,
  type VideoApprovalStatus,

} from "../lib/data";

import {

  createConversationWithFirstMessage,

  getConversationsForRetainer,

} from "../lib/messages";

import {

  getLinksForRetainer,

  requestLink,

  resetLink,

  setLinkApproved,

  setLinkStatus,

  setLinkVideoConfirmed,

  isWorkingTogether,

  type Link as LinkingLink,

} from "../lib/linking";

import { getRetainerRatingSummary } from "../lib/ratings";

import {

  createRoute,

  getAllRouteInterests,

  getInterestsForRoute,

  getRoutesForRetainer,

  updateRoute,

  type Route,

  type RouteAudience,

  type RouteCommitmentType,

  type RouteStatus,

} from "../lib/routes";

import {

  getActiveBadExitSummaryForSeeker,

  getActiveNoticeSummaryForSeeker,

  getActiveRouteNoticesForRetainer,

  confirmRouteNotice,

  daysUntil,

  getNextBadExitTierForSeeker,

  ROUTE_NOTICE_EVENT,

} from "../lib/routeNotices";

import {

  getRetainerPosts,

  updateRetainerPost,

  type RetainerPost,

  type RetainerPostStatus,

  type RetainerPostType,

} from "../lib/posts";

import {

  createRetainerBroadcast,

  getRetainerBroadcasts,

  updateRetainerBroadcast,

  type RetainerBroadcast,

  type RetainerBroadcastAudience,

  type RetainerBroadcastStatus,

} from "../lib/broadcasts";

import { deliverRetainerBroadcastToLinkedSeekers } from "../lib/broadcastDelivery";
import { changePassword, logout, resetPassword, syncUpsert } from "../lib/api";

import { getFeedForRetainer, type FeedItem } from "../lib/feed";
import {
  getRouteResponseCounts,
  getRouteResponsesGrouped,
  getUnreadRouteResponseCount,
  markRouteResponsesSeen,
  NOT_INTERESTED_REASONS,
  ROUTE_RESPONSES_EVENT,
} from "../lib/routeResponses";
import {
  getPostResponseCounts,
  getPostResponsesGrouped,
  POST_RESPONSES_EVENT,
} from "../lib/postResponses";
import {
  FEED_REACTION_OPTIONS,
  FEED_REACTIONS_EVENT,
  getFeedReactionCounts,
  getFeedReactionsGrouped,
  type FeedReactionItemKind,
} from "../lib/feedReactions";

const LazyHierarchyCanvas = lazy(() => import("../components/HierarchyCanvas"));
import { type HierarchyNode } from "../components/HierarchyCanvas";

const LazyBadgesCenter = lazy(() => import("../components/BadgesCenter"));

const LazyRetainerMessagingCenter = lazy(() => import("../components/RetainerMessagingCenter"));

import ProfileAvatar from "../components/ProfileAvatar";
import ProfileVideoSection from "../components/ProfileVideoSection";

import { getStockImageUrl } from "../lib/stockImages";
import { uploadImageWithFallback, MAX_IMAGE_BYTES } from "../lib/uploads";
import { pullFromServer, isServerAuthoritative } from "../lib/serverSync";
import {
  addMeetingProposal,
  cancelMeeting,
  createInterviewMeeting,
  finalizeMeeting,
  getMeetingsForRetainer,
  markMeetingOutcome,
  requestMeetingReschedule,
  type InterviewMeeting,
} from "../lib/meetings";
import { disconnectGoogleOAuth, getGoogleOAuthStatus } from "../lib/api";

import {

  getActiveBadges,

  getBadgeCheckins,

  getBadgeDefinition,

  getBadgeProgress,

  getBadgeSummaryForProfile,

  getPendingBadgeApprovalsForProfile,

  getReputationScoreForProfile,

  getCurrentPeriodKey,

} from "../lib/badges";

import {
  createRouteAssignment,
  createWorkUnitPeriod,
  getAssignmentsForRetainer,
  getPeriodByKey,
  submitWorkUnitCounts,
  type RouteAssignment,
  type WorkUnitAssignmentType,
  type WorkUnitType,
} from "../lib/workUnits";

import { badgeIconFor } from "../components/badgeIcons";

import { clearPortalContext, clearSession, getSession, setPortalContext, setSession } from "../lib/session";

import { getRetainerEntitlements } from "../lib/entitlements";

import {
  DAYS,
  type DayOfWeek,
  formatDaysShort,
  bestMatchForRoutes,
  type ScheduleMatch,
  type WeeklyAvailability,
} from "../lib/schedule";

// Derive types from data helpers

type Retainer = ReturnType<typeof getRetainers>[number];

type Seeker = ReturnType<typeof getSeekers>[number];

type RetainerUser = NonNullable<Retainer["users"]>[number];

type RetainerUserLevel = RetainerUser["level"];

type RetainerUserLevelLabels = NonNullable<Retainer["userLevelLabels"]>;

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
  backLabel = "Back",
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

  | "posts"

  | "messages"

  | "badges";

type ActionTabKey =

  | "wheel"

  | "lists"

  | "routes"

  | "schedule"

  | "editProfile"

  | "addUsers"

  | "hierarchy";

type SeekerBucketKey = "excellent" | "possible" | "notNow";

const CURRENT_RETAINER_KEY = "snapdriver_current_retainer_id";
const CURRENT_SEEKER_KEY = "snapdriver_current_seeker_id";

const RETAINER_SEEKER_BUCKETS_KEY = "snapdriver_retainer_seeker_buckets";

const retainerActiveUserKey = (retainerId: string) =>

  `snapdriver_retainer_active_user_${retainerId}`;

const RetainerPage: React.FC = () => {

  const navigate = useNavigate();

  const location = useLocation();

  const session = useMemo(() => getSession(), []);
  const isSessionRetainer = session?.role === "RETAINER";
  const sessionRetainerId = isSessionRetainer ? session.retainerId ?? null : null;
  const sessionEmail = session?.email ? String(session.email).toLowerCase() : null;
  const retainerUpsertedRef = useRef(false);

  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1024;
  });
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore logout network errors
    }
    clearSession();
    clearPortalContext();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CURRENT_RETAINER_KEY);
      window.localStorage.removeItem(CURRENT_SEEKER_KEY);
    }
    navigate("/");
  };

  const [actionTab, setActionTab] = useState<ActionTabKey>("wheel");

  const [noticeTick, setNoticeTick] = useState(0);
  const [linkTick] = useState(0);

  useEffect(() => {

    if (typeof window === "undefined") return;

    const handler = () => setNoticeTick((n) => n + 1);

    window.addEventListener(ROUTE_NOTICE_EVENT, handler);

    return () => window.removeEventListener(ROUTE_NOTICE_EVENT, handler);

  }, []);

  useEffect(() => {

    setPortalContext("RETAINER");

  }, []);

  // All retainers + seekers

  const [retainers, setRetainers] = useState<Retainer[]>(() => getRetainers());

  const [seekers] = useState<Seeker[]>(() => getSeekers());

  const approvedSeekers = useMemo(

    () => seekers.filter((s: any) => s.status === "APPROVED"),

    [seekers]

  );

  // Wheel + buckets for seekers

  const [wheelSeekers, setWheelSeekers] = useState<Seeker[]>([]);

  const [seekerBuckets, setSeekerBuckets] = useState<{

    excellent: Seeker[];

    possible: Seeker[];

    notNow: Seeker[];

  }>({

    excellent: [],

    possible: [],

    notNow: [],

  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Compose pop-out (message from dashboard)

  const [composeTargetSeeker, setComposeTargetSeeker] = useState<Seeker | null>(

    null

  );

  const [selectedSeekerIds, setSelectedSeekerIds] = useState<Set<string>>(

    () => new Set()

  );

  const [bulkComposeTargets, setBulkComposeTargets] = useState<Seeker[] | null>(

    null

  );

  // "Acting as" retainer id

  const [currentRetainerId, setCurrentRetainerId] = useState<string | null>(() => {

    const initialList = getRetainers();

    const id = sessionRetainerId ?? resolveCurrentRetainerId(initialList, null);

    if (id) persistCurrentRetainerId(id);

    return id;

  });

  const currentRetainer = useMemo(

    () =>

      currentRetainerId

        ? retainers.find((r: any) => r.id === currentRetainerId)

        : undefined,

    [retainers, currentRetainerId]

  );

  const sessionRetainer = useMemo(
    () => (sessionRetainerId ? retainers.find((r: any) => r.id === sessionRetainerId) : undefined),
    [retainers, sessionRetainerId]
  );

  const effectiveRetainer = useMemo(() => {
    if (!isSessionRetainer) return sessionRetainer;
    if (sessionRetainer) return sessionRetainer;
    if (!currentRetainer || !sessionEmail) return undefined;
    const match = String((currentRetainer as any).email ?? "").toLowerCase();
    return match && match === sessionEmail ? currentRetainer : undefined;
  }, [isSessionRetainer, sessionRetainer, currentRetainer, sessionEmail]);

  useEffect(() => {
    if (!isSessionRetainer || !sessionRetainerId) {
      return;
    }
    if (sessionRetainer) {
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
      const refreshed = getRetainers();
      setRetainers(refreshed);
      let found = sessionRetainerId ? refreshed.find((r: any) => r.id === sessionRetainerId) : undefined;
      if (!found && email) {
        found = refreshed.find((r: any) => String((r as any).email ?? "").toLowerCase() === email);
      }
      if (found) {
        setCurrentRetainerId(found.id);
        persistCurrentRetainerId(found.id);
        setSession({ role: "RETAINER", retainerId: found.id, email: email ?? undefined });
      }
    };
    hydrate();
  }, [isSessionRetainer, sessionRetainerId, sessionRetainer, session?.email]);

  useEffect(() => {
    if (!effectiveRetainer || sessionRetainer) return;
    if (retainerUpsertedRef.current) return;
    retainerUpsertedRef.current = true;
    setCurrentRetainerId(effectiveRetainer.id);
    persistCurrentRetainerId(effectiveRetainer.id);
    setSession({ role: "RETAINER", retainerId: effectiveRetainer.id, email: sessionEmail ?? undefined });
    syncUpsert({ retainers: [effectiveRetainer] }).catch(() => undefined);
  }, [effectiveRetainer, sessionRetainer, sessionEmail]);

  useEffect(() => {
    if (!isSessionRetainer || !sessionRetainerId) return;
    if (currentRetainerId !== sessionRetainerId) {
      setCurrentRetainerId(sessionRetainerId);
      persistCurrentRetainerId(sessionRetainerId);
    }
  }, [isSessionRetainer, sessionRetainerId, currentRetainerId]);

  const retainerUsers = useMemo(

    () => (currentRetainer ? currentRetainer.users ?? [] : []),

    [currentRetainer]

  );

  const [currentRetainerUserId, setCurrentRetainerUserId] = useState<string | null>(null);

  useEffect(() => {

    if (!currentRetainerId) {

      setCurrentRetainerUserId(null);

      return;

    }

    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(retainerActiveUserKey(currentRetainerId));

    const next = stored && retainerUsers.some((u) => u.id === stored) ? stored : null;

    setCurrentRetainerUserId(next);

  }, [currentRetainerId, retainerUsers]);

  const activeRetainerUser = useMemo(

    () =>

      currentRetainerUserId

        ? retainerUsers.find((u) => u.id === currentRetainerUserId)

        : undefined,

    [currentRetainerUserId, retainerUsers]

  );

  const retainerUserLevel = activeRetainerUser?.level ?? 3;

  const retainerLevelLabels =

    currentRetainer?.userLevelLabels ?? { level1: "Level 1", level2: "Level 2", level3: "Level 3" };

  const canManageUsers = retainerUserLevel === 3;

  const canEditPortal = retainerUserLevel > 1;

  const canSendExternal = retainerUserLevel > 1;

  const canSendInternal = retainerUserLevel >= 1;

  const refreshRetainersAndSession = () => {

    const updated = getRetainers();

    setRetainers(updated);

    const newId = resolveCurrentRetainerId(updated, currentRetainerId);

    setCurrentRetainerId(newId);

    if (newId) persistCurrentRetainerId(newId);

    else persistCurrentRetainerId(null);

  };

  const handleRetainerCreated = () => {

    refreshRetainersAndSession();

    setActiveTab("dashboard");
    setToastMessage(
      "Profile created. Head to Badges to choose your badges while you wait for approval."
    );

  };

  const handleRetainerUpdated = () => {

    refreshRetainersAndSession();

    setActiveTab("dashboard");
    setToastMessage("Profile updated.");

  };

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

  const classifyLabel = (bucket: SeekerBucketKey): string => {

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

    excellent: Seeker[];

    possible: Seeker[];

    notNow: Seeker[];

  }) => {

    if (typeof window === "undefined") return;

    try {

      const payload = {

        excellent: buckets.excellent.map((s: any) => s.id),

        possible: buckets.possible.map((s: any) => s.id),

        notNow: buckets.notNow.map((s: any) => s.id),

      };

      window.localStorage.setItem(RETAINER_SEEKER_BUCKETS_KEY, JSON.stringify(payload));

    } catch (err) {

      console.error("Failed to persist Seeker buckets", err);

    }

  };

  const handleClassifySeeker = (seeker: Seeker, bucket: SeekerBucketKey) => {

    if (!canEditPortal) return;

    const addUnique = (list: Seeker[], s: Seeker) => {

      if (list.some((x: any) => (x as any).id === (s as any).id)) return list;

      return [...list, s];

    };

    // Remove from wheel

    setWheelSeekers((prev) => prev.filter((s: any) => (s as any).id !== (seeker as any).id));

    // Update buckets + persist

    setSeekerBuckets((prev) => {

      const next = {

        excellent: prev.excellent.filter((s: any) => (s as any).id !== (seeker as any).id),

        possible: prev.possible.filter((s: any) => (s as any).id !== (seeker as any).id),

        notNow: prev.notNow.filter((s: any) => (s as any).id !== (seeker as any).id),

      };

      if (bucket === "excellent") {

        next.excellent = addUnique(next.excellent, seeker);

      } else if (bucket === "possible") {

        next.possible = addUnique(next.possible, seeker);

      } else {

        next.notNow = addUnique(next.notNow, seeker);

      }

      persistBuckets(next);

      return next;

    });

    const name = formatSeekerName(seeker);

    const label = classifyLabel(bucket);

    setToastMessage(`${name} sent to "${label}" list`);

  };

  const handleReturnSeekerToWheel = (seeker: Seeker) => {

    if (!canEditPortal) return;

    setSeekerBuckets((prev) => {

      const next = {

        excellent: prev.excellent.filter((s: any) => (s as any).id !== (seeker as any).id),

        possible: prev.possible.filter((s: any) => (s as any).id !== (seeker as any).id),

        notNow: prev.notNow.filter((s: any) => (s as any).id !== (seeker as any).id),

      };

      persistBuckets(next);

      return next;

    });

    setWheelSeekers((prev) =>

      prev.some((s: any) => (s as any).id === (seeker as any).id) ? prev : [...prev, seeker]

    );

    setToastMessage(`${formatSeekerName(seeker)} returned to wheel`);

  };

  useEffect(() => {

    const valid = new Set<string>([

      ...seekerBuckets.excellent.map((s: any) => String((s as any).id)),

      ...seekerBuckets.possible.map((s: any) => String((s as any).id)),

      ...seekerBuckets.notNow.map((s: any) => String((s as any).id)),

    ]);

    setSelectedSeekerIds((prev) => {

      if (prev.size === 0) return prev;

      const next = new Set<string>();

      for (const id of prev) if (valid.has(id)) next.add(id);

      return next.size === prev.size ? prev : next;

    });

  }, [seekerBuckets.excellent, seekerBuckets.possible, seekerBuckets.notNow]);

  const toggleSelectedSeeker = (seekerId: string) => {

    setSelectedSeekerIds((prev) => {

      const next = new Set(prev);

      if (next.has(seekerId)) next.delete(seekerId);

      else next.add(seekerId);

      return next;

    });

  };

  const clearSelectedSeekers = () => setSelectedSeekerIds(new Set());

  const selectAllSeekersInLists = () => {

    setSelectedSeekerIds(

      new Set([

        ...seekerBuckets.excellent.map((s: any) => String((s as any).id)),

        ...seekerBuckets.possible.map((s: any) => String((s as any).id)),

        ...seekerBuckets.notNow.map((s: any) => String((s as any).id)),

      ])

    );

  };

  const selectedSeekersInLists = useMemo(() => {

    if (selectedSeekerIds.size === 0) return [];

    const all = [...seekerBuckets.excellent, ...seekerBuckets.possible, ...seekerBuckets.notNow];

    return all.filter((s: any) => selectedSeekerIds.has(String((s as any).id)));

  }, [seekerBuckets.excellent, seekerBuckets.possible, seekerBuckets.notNow, selectedSeekerIds]);

  const bulkReturnSelectedSeekersToWheel = () => {

    if (!canEditPortal) return;

    if (selectedSeekersInLists.length === 0) return;

    const selectedIds = new Set(selectedSeekersInLists.map((s: any) => String((s as any).id)));

    setSeekerBuckets((prev) => {

      const next = {

        excellent: prev.excellent.filter((s: any) => !selectedIds.has(String((s as any).id))),

        possible: prev.possible.filter((s: any) => !selectedIds.has(String((s as any).id))),

        notNow: prev.notNow.filter((s: any) => !selectedIds.has(String((s as any).id))),

      };

      persistBuckets(next);

      return next;

    });

    setWheelSeekers((prev) => {

      const existing = new Set(prev.map((s: any) => String((s as any).id)));

      const toAdd = selectedSeekersInLists.filter((s: any) => !existing.has(String((s as any).id)));

      return toAdd.length === 0 ? prev : [...prev, ...toAdd];

    });

    clearSelectedSeekers();

    setToastMessage(

      selectedSeekersInLists.length === 1

        ? `${formatSeekerName(selectedSeekersInLists[0])} returned to wheel`

        : `${selectedSeekersInLists.length} seekers returned to wheel`

    );

  };

  const bulkRequestLinksForSelectedSeekers = () => {

    if (!canEditPortal) return;

    if (!currentRetainerId) return;

    if (selectedSeekersInLists.length === 0) return;

    let blocked = 0;
    for (const s of selectedSeekersInLists as any[]) {
      try {
        requestLink({
          seekerId: String((s as any).id),
          retainerId: currentRetainerId,
          by: "RETAINER",
        });
      } catch {
        blocked += 1;
      }
    }

    const sentCount = selectedSeekersInLists.length - blocked;
    if (blocked > 0) {
      setToastMessage(
        sentCount > 0
          ? `${sentCount} link requests sent. ${blocked} seekers need to upgrade before linking.`
          : `${blocked} seekers need to upgrade before linking.`
      );
      return;
    }

    setToastMessage(
      selectedSeekersInLists.length === 1
        ? "Link request sent."
        : `Link requests sent to ${selectedSeekersInLists.length} seekers.`
    );

  };

  const bulkMessageSelectedSeekers = () => {

    if (!canEditPortal) return;

    if (!currentRetainerId) return;

    if (selectedSeekersInLists.length === 0) return;

    setBulkComposeTargets(selectedSeekersInLists);

  };

  const handleRebucketById = (seekerId: string, targetBucket: SeekerBucketKey) => {

    if (!canEditPortal) return;

    setSeekerBuckets((prev) => {

      let moving: Seeker | undefined;

      const removeFrom = (list: Seeker[]) => {

        const idx = list.findIndex((s: any) => (s as any).id === seekerId);

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

      const addUnique = (list: Seeker[], s: Seeker) =>

        list.some((x: any) => (x as any).id === (s as any).id) ? list : [...list, s];

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

  const handleMessageSeeker = (seeker: Seeker) => {

    if (!canEditPortal) return;

    setComposeTargetSeeker(seeker);

  };

  const handleOpenSeekerProfileFromAction = (seeker: Seeker) => {

    if (!(seeker as any)?.id) return;

    navigate(`/seekers/${(seeker as any).id}`, {
      state: { returnTo: "action", returnActionTab: actionTab },
    });

  };

  // Auto-dismiss toast

  useEffect(() => {

    if (!toastMessage) return;

    const id = window.setTimeout(() => setToastMessage(null), 2000);

    return () => window.clearTimeout(id);

  }, [toastMessage]);

  // Rebuild buckets + wheel from localStorage on mount / when approvedSeekers changes

  useEffect(() => {

    if (approvedSeekers.length === 0) {

      setWheelSeekers([]);

      setSeekerBuckets({ excellent: [], possible: [], notNow: [] });

      return;

    }

    if (typeof window === "undefined") {

      setWheelSeekers(approvedSeekers);

      return;

    }

    try {

      const raw = window.localStorage.getItem(RETAINER_SEEKER_BUCKETS_KEY);

      if (!raw) {

        setWheelSeekers(approvedSeekers);

        return;

      }

      const parsed = JSON.parse(raw) as {

        excellent?: string[];

        possible?: string[];

        notNow?: string[];

      };

      const byId = new Map<string, Seeker>(approvedSeekers.map((s: any) => [(s as any).id, s]));

      const mapIds = (ids?: string[]) =>

        (ids || []).map((id) => byId.get(id)).filter((s): s is Seeker => !!s);

      const excellent = mapIds(parsed.excellent);

      const possible = mapIds(parsed.possible);

      const notNow = mapIds(parsed.notNow);

      const bucketIds = new Set<string>([

        ...excellent.map((s: any) => (s as any).id),

        ...possible.map((s: any) => (s as any).id),

        ...notNow.map((s: any) => (s as any).id),

      ]);

      const wheel = approvedSeekers.filter((s: any) => !bucketIds.has((s as any).id));

      setSeekerBuckets({ excellent, possible, notNow });

      setWheelSeekers(wheel);

    } catch (err) {

      console.error("Failed to load Seeker buckets from localStorage", err);

      setWheelSeekers(approvedSeekers);

    }

  }, [approvedSeekers]);

  const approvalGate: { title: string; body: string; status?: string } | null =
    isSessionRetainer && effectiveRetainer && (effectiveRetainer as any).status !== "APPROVED"
      ? {
          ...getApprovalGateCopy("Retainer", (effectiveRetainer as any).status),
          status: (effectiveRetainer as any).status,
        }
      : null;

  if (approvalGate) {
    return (
      <ApprovalGate
        title={approvalGate.title}
        body={approvalGate.body}
        status={approvalGate.status}
        onBack={() => navigate(-1)}
      />
    );
  }

  const miniProfileCard = (
    <button
      type="button"
      onClick={() => setActiveTab("dashboard")}
      className="group flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-left hover:bg-slate-900/90 transition"
      title="Go to dashboard"
    >
      <span className="h-10 w-10 rounded-xl overflow-hidden border border-slate-700 bg-slate-950/60 shrink-0">
        <img
          src={getStockImageUrl("RETAINER", currentRetainerId ?? undefined)}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-wide text-slate-500">
          Dashboard
        </span>
        <span className="block text-sm font-semibold text-slate-100 truncate">
          {currentRetainer ? formatRetainerName(currentRetainer) : "Retainer Portal"}
        </span>
        <span className="block text-[10px] text-slate-500">
          Status: {(currentRetainer as any)?.status ?? "Not set"}
        </span>
      </span>
    </button>
  );

  return (

    <div className="min-h-screen lg:h-screen bg-slate-950 text-slate-50 flex flex-col lg:flex-row overflow-x-hidden lg:overflow-hidden">

      {/* Left sidebar */}

      <aside className="hidden lg:flex w-72 shrink-0 border-r border-slate-800 bg-slate-900/70 backdrop-blur-sm p-4 flex flex-col min-h-0">

        <div className="mb-6">

          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">

            Snap Driver

          </div>

          <h1 className="text-xl font-semibold text-slate-50">Retainer Portal</h1>

        </div>

        {currentRetainer ? (
          <div className="mb-6 rounded-2xl bg-slate-800/80 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Your Company
            </div>
            <div className="font-semibold text-slate-50 truncate">
              {formatRetainerName(currentRetainer)}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
              <span>
                Status:{" "}
                <span className="font-medium text-emerald-400">
                  {(currentRetainer as any).status}
                </span>
              </span>
              {(() => {
                const summary = getRetainerRatingSummary((currentRetainer as any).id);
                if (!summary.count) return null;
                return (
                  <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/60 px-2 py-0.5 text-[10px] text-amber-100">
                    * {summary.avg.toFixed(1)} ({summary.count})
                  </span>
                );
              })()}
            </div>
            {currentRetainerId && (
              <div className="mt-2">
                <Link
                  to={`/retainers/${currentRetainerId}`}
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
              You&apos;re not currently acting as any Retainer. Use{" "}
              <button
                type="button"
                onClick={() => {
                  setActionTab("editProfile");
                  setActiveTab("action");
                }}
                className="font-semibold text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline"
              >
                Edit Profile
              </button>{" "}
              to create a company profile.
            </div>
          </div>
        )}

<nav className="space-y-1 flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">

          <SidebarButton label="Dashboard" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} />

          <SidebarButton
            label="Find Seekers"
            active={activeTab === "find"}
            onClick={() => {
              setActiveTab("find");
              setActionTab("wheel");
            }}
          />

          <SidebarButton label="Action" active={activeTab === "action"} onClick={() => setActiveTab("action")} />

          <SidebarButton label="Linking" active={activeTab === "linking"} onClick={() => setActiveTab("linking")} />

          <SidebarButton label="Posts" active={activeTab === "posts"} onClick={() => setActiveTab("posts")} />

          <SidebarButton label="Messaging Center" active={activeTab === "messages"} onClick={() => setActiveTab("messages")} />

          <SidebarButton label="Badges" active={activeTab === "badges"} onClick={() => setActiveTab("badges")} />

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
              <div className="space-y-3">
                {miniProfileCard}
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    Snap Driver
                  </div>
                  <div className="text-lg font-semibold text-slate-50">Retainer Portal</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    Section
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    {renderHeaderTitle(activeTab)}
                  </div>
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
                  <div className="text-sm font-semibold text-slate-100">Retainer Menu</div>
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
                {currentRetainer ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                      Your Company
                    </div>
                    <div className="font-semibold text-slate-50 truncate">
                      {formatRetainerName(currentRetainer)}
                    </div>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                      <span>
                        Status:{" "}
                        <span className="font-medium text-emerald-400">
                          {(currentRetainer as any).status}
                        </span>
                      </span>
                      {(() => {
                        const summary = getRetainerRatingSummary((currentRetainer as any).id);
                        if (!summary.count) return null;
                        return (
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/60 px-2 py-0.5 text-[10px] text-amber-100">
                            * {summary.avg.toFixed(1)} ({summary.count})
                          </span>
                        );
                      })()}
                    </div>
                    {currentRetainerId && (
                      <div className="text-xs">
                        <Link
                          to={`/retainers/${currentRetainerId}`}
                          className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
                        >
                          View profile
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
                    No retainer selected yet.
                  </div>
                )}
              </div>
<nav className="space-y-2">
                <SidebarButton
                  label="Dashboard"
                  active={activeTab === "dashboard"}
                  onClick={() => {
                    setActiveTab("dashboard");
                    setIsMobileNavOpen(false);
                  }}
                />
                <SidebarButton
                  label="Find Seekers"
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
                  label="Posts"
                  active={activeTab === "posts"}
                  onClick={() => {
                    setActiveTab("posts");
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
                  label="Badges"
                  active={activeTab === "badges"}
                  onClick={() => {
                    setActiveTab("badges");
                    setIsMobileNavOpen(false);
                  }}
                />
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
          <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {miniProfileCard}
              <div>
                <h2 className="text-2xl font-semibold text-slate-50">
                  {renderHeaderTitle(activeTab)}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {renderHeaderSubtitle(activeTab)}
                </p>
              </div>
            </div>
          </div>
        </header>
        <section

          className={[

            "flex-1 min-h-0 p-4 lg:p-6",

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

            {activeTab === "dashboard" && (

              <DashboardView

                retainerId={currentRetainerId}

                currentRetainer={currentRetainer}

                seekers={seekers}

                isDesktop={isDesktop}

                onToast={(msg) => setToastMessage(msg)}

                onOpenProfile={(s) => navigate(`/seekers/${(s as any).id}`)}

                onMessage={handleMessageSeeker}

                canInteract={canEditPortal}

                onGoToMessages={() => setActiveTab("messages")}

                onGoToPosts={() => setActiveTab("posts")}

                onGoToRoutes={() => openActionTab("routes")}

                onGoToLinking={() => setActiveTab("linking")}

                onGoToBadges={() => setActiveTab("badges")}

              />

            )}

            {activeTab === "find" && (

              <ActionView

                actionTab={actionTab}

                noticeTick={noticeTick}

                onChangeTab={setActionTab}

                retainerId={currentRetainerId}

                currentRetainer={currentRetainer}

                seekers={seekers}

                wheelSeekers={wheelSeekers}

                excellentSeekers={seekerBuckets.excellent}

                possibleSeekers={seekerBuckets.possible}

                notNowSeekers={seekerBuckets.notNow}

                selectedSeekerIds={selectedSeekerIds}

                onToggleSelectedSeeker={toggleSelectedSeeker}

                onSelectAllSeekers={selectAllSeekersInLists}

                onClearSelectedSeekers={clearSelectedSeekers}

                onBulkMessageSelected={bulkMessageSelectedSeekers}

                onBulkRequestLinkSelected={bulkRequestLinksForSelectedSeekers}

                onBulkReturnToWheelSelected={bulkReturnSelectedSeekersToWheel}

                onClassifySeeker={handleClassifySeeker}

                onOpenProfile={handleOpenSeekerProfileFromAction}

                onReturnToWheel={handleReturnSeekerToWheel}

                onRebucketById={handleRebucketById}

                onMessage={handleMessageSeeker}

                visibleTabs={["wheel", "lists"]}

                retainerRoutes={currentRetainer ? getRoutesForRetainer(currentRetainer.id) : []}

                canInteract={canEditPortal}

                retainerUsers={retainerUsers}

                retainerLevelLabels={retainerLevelLabels}

                canManageUsers={canManageUsers}

                onCreateUser={(input) => {

                  if (!currentRetainer) return;

                  const created = addRetainerUser(currentRetainer.id, input);

                  if (!created) {

                    setToastMessage("Cannot add user: plan limit reached.");

                    return;

                  }

                  refreshRetainersAndSession();

                }}

                onRemoveUser={(id) => {

                  if (!currentRetainer) return;

                  removeRetainerUser(currentRetainer.id, id);

                  refreshRetainersAndSession();

                }}

                onUpdateUserLabels={(labels) => {

                  if (!currentRetainer) return;

                  setRetainerUserLevelLabels(currentRetainer.id, labels);

                  refreshRetainersAndSession();

                }}

                onUpdateHierarchyNodes={(nodes) => {

                  if (!currentRetainer || !canEditPortal) return;

                  setRetainerHierarchyNodes(currentRetainer.id, nodes);

                  refreshRetainersAndSession();

                }}

                onRetainerCreated={handleRetainerCreated}

                onRetainerUpdated={handleRetainerUpdated}

                onToast={(msg) => setToastMessage(msg)}

              />

            )}

            {activeTab === "action" && (

              <ActionView

                actionTab={actionTab}

                noticeTick={noticeTick}

                onChangeTab={setActionTab}

                retainerId={currentRetainerId}

                currentRetainer={currentRetainer}

                seekers={seekers}

                wheelSeekers={wheelSeekers}

                excellentSeekers={seekerBuckets.excellent}

                possibleSeekers={seekerBuckets.possible}

                notNowSeekers={seekerBuckets.notNow}

                selectedSeekerIds={selectedSeekerIds}

                onToggleSelectedSeeker={toggleSelectedSeeker}

                onSelectAllSeekers={selectAllSeekersInLists}

                onClearSelectedSeekers={clearSelectedSeekers}

                onBulkMessageSelected={bulkMessageSelectedSeekers}

                onBulkRequestLinkSelected={bulkRequestLinksForSelectedSeekers}

                onBulkReturnToWheelSelected={bulkReturnSelectedSeekersToWheel}

                onClassifySeeker={handleClassifySeeker}

                onOpenProfile={handleOpenSeekerProfileFromAction}

                onReturnToWheel={handleReturnSeekerToWheel}

                onRebucketById={handleRebucketById}

                onMessage={handleMessageSeeker}

                visibleTabs={["routes", "schedule", "editProfile", "addUsers", "hierarchy"]}

                retainerRoutes={currentRetainer ? getRoutesForRetainer(currentRetainer.id) : []}

                canInteract={canEditPortal}

                retainerUsers={retainerUsers}

                retainerLevelLabels={retainerLevelLabels}

                canManageUsers={canManageUsers}

                onCreateUser={(input) => {

                  if (!currentRetainer) return;

                  const created = addRetainerUser(currentRetainer.id, input);

                  if (!created) {

                    setToastMessage("Cannot add user: plan limit reached.");

                    return;

                  }

                  refreshRetainersAndSession();

                }}

                onRemoveUser={(id) => {

                  if (!currentRetainer) return;

                  removeRetainerUser(currentRetainer.id, id);

                  refreshRetainersAndSession();

                }}

                onUpdateUserLabels={(labels) => {

                  if (!currentRetainer) return;

                  setRetainerUserLevelLabels(currentRetainer.id, labels);

                  refreshRetainersAndSession();

                }}

                onUpdateHierarchyNodes={(nodes) => {

                  if (!currentRetainer || !canEditPortal) return;

                  setRetainerHierarchyNodes(currentRetainer.id, nodes);

                  refreshRetainersAndSession();

                }}

                onRetainerCreated={handleRetainerCreated}

                onRetainerUpdated={handleRetainerUpdated}

                onToast={(msg) => setToastMessage(msg)}

              />

            )}

            {activeTab === "linking" && (

              <RetainerLinkingView

                retainerId={currentRetainerId}

                seekers={approvedSeekers}
                canEdit={canEditPortal}

                onMessage={handleMessageSeeker}

                onToast={(msg) => setToastMessage(msg)}

              />

            )}

            {activeTab === "posts" && (

              <RetainerPostsView

                retainer={currentRetainer}

                canEdit={canEditPortal}

                onToast={(msg) => setToastMessage(msg)}

              />

            )}

            {activeTab === "messages" && (

              <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-4">

                <div className="flex-1 min-h-0">

                  <MessagingCenterView

                    currentRetainer={currentRetainer}

                    seekers={seekers}

                    retainerUsers={retainerUsers}

                    activeRetainerUser={activeRetainerUser}

                    canSendExternal={canSendExternal}

                    canSendInternal={canSendInternal}

                  />

                </div>

                {!isDesktop && (

                  <RetainerFeedPanel

                    retainerId={currentRetainerId}

                    currentRetainer={currentRetainer}

                    seekers={seekers}

                    linkTick={linkTick}

                    canInteract={canEditPortal}

                    onOpenProfile={(s) => navigate(`/seekers/${(s as any).id}`)}

                    onMessage={handleMessageSeeker}

                    onGoToPosts={() => setActiveTab("posts")}

                    onGoToMessages={() => setActiveTab("messages")}

                    onGoToRoutes={() => openActionTab("routes")}

                    className="min-h-[320px]"

                  />

                )}

              </div>

            )}

            {activeTab === "badges" && (

              <>

                {badgesReturnTo && (

                  <button type="button" onClick={handleBadgesBack} className="btn">

                    ← Back to Profile

                  </button>

                )}

                <Suspense fallback={<div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-400">Loading badges?</div>}>
                  <LazyBadgesCenter
                    role="RETAINER"
                    ownerId={currentRetainerId}
                    readOnly={retainerUserLevel === 1}
                  />
                </Suspense>
              </>

            )}

          </div>

        </section>

        {composeTargetSeeker && currentRetainer && (

          <ComposeMessagePopover

            seeker={composeTargetSeeker}

            retainer={currentRetainer}

            onClose={() => setComposeTargetSeeker(null)}

          />

        )}

        {bulkComposeTargets && currentRetainer && (

          <BulkComposeMessagePopover

            count={bulkComposeTargets.length}

            onClose={() => setBulkComposeTargets(null)}

            onSend={(subject, body) => {

              if (!currentRetainerId) return;

              let sent = 0;

              for (const s of bulkComposeTargets) {

                try {

                  createConversationWithFirstMessage({

                    seekerId: String((s as any).id),

                    retainerId: currentRetainerId,

                    subject,

                    body,

                    senderRole: "RETAINER",

                  });

                  sent += 1;

                } catch (err) {

                  console.error(err);

                }

              }

              setBulkComposeTargets(null);

              setToastMessage(

                sent === 1 ? "Message sent." : `Messages sent to ${sent} seekers.`

              );

            }}

          />

        )}

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

export default RetainerPage;

type RetainerFeedPanelProps = {
  retainerId: string | null;
  currentRetainer?: Retainer;
  seekers: Seeker[];
  linkTick: number;
  canInteract: boolean;
  onOpenProfile: (s: Seeker) => void;
  onMessage: (s: Seeker) => void;
  onGoToPosts: () => void;
  onGoToMessages: () => void;
  onGoToRoutes: () => void;
  className?: string;
};

type FeedFilterKey = "POST" | "BROADCAST" | "ROUTE" | "MESSAGE" | "PROFILE";

const FEED_FILTER_OPTIONS: Array<{ key: FeedFilterKey; label: string }> = [
  { key: "POST", label: "Posts" },
  { key: "BROADCAST", label: "Broadcasts" },
  { key: "ROUTE", label: "Routes" },
  { key: "MESSAGE", label: "Messages" },
  { key: "PROFILE", label: "New profiles" },
];

const RetainerFeedPanel: React.FC<RetainerFeedPanelProps> = ({
  retainerId,
  currentRetainer,
  seekers,
  linkTick,
  canInteract,
  onOpenProfile,
  onMessage,
  onGoToPosts,
  onGoToMessages,
  onGoToRoutes,
  className,
}) => {
  const retainerDisplayName = currentRetainer ? formatRetainerName(currentRetainer) : "Retainer";
  const retainerCompany = currentRetainer?.companyName || retainerDisplayName;

  const seekerById = useMemo(
    () => new Map<string, Seeker>(seekers.map((s) => [s.id, s])),
    [seekers]
  );

  const activeLinkSeekerIds = useMemo(() => {
    if (!retainerId) return new Set<string>();
    return new Set(
      getLinksForRetainer(retainerId)
        .filter((l) => l.status === "ACTIVE")
        .map((l) => l.seekerId)
    );
  }, [retainerId, linkTick]);

  const [feedTick, setFeedTick] = useState(0);
  const [feedFilters, setFeedFilters] = useState<Set<FeedFilterKey>>(
    () => new Set(FEED_FILTER_OPTIONS.map((item) => item.key))
  );
  const [expandedFeedKey, setExpandedFeedKey] = useState<string | null>(null);
  const feedItems = useMemo(
    () => (retainerId ? getFeedForRetainer(retainerId) : []),
    [retainerId, feedTick]
  );

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
    if (!retainerId || typeof window === "undefined") return;
    const raw = window.localStorage.getItem("snapdriver_feed_jump");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { role?: string; kind?: string; id?: string };
      if (parsed?.role !== "RETAINER" || !parsed.kind || !parsed.id) return;
      setExpandedFeedKey(`${parsed.kind}:${parsed.id}`);
      const nextKey: FeedFilterKey =
        parsed.kind === "ROUTE"
          ? "ROUTE"
          : parsed.kind === "BROADCAST"
            ? "BROADCAST"
            : parsed.kind === "MESSAGE"
              ? "MESSAGE"
              : parsed.kind === "PROFILE_APPROVED"
                ? "PROFILE"
                : "POST";
      setFeedFilters((prev) => {
        const next = new Set(prev);
        next.add(nextKey);
        return next;
      });
      window.localStorage.removeItem("snapdriver_feed_jump");
    } catch {
      // ignore
    }
  }, [retainerId, feedItems]);

  const filteredFeedItems = useMemo(() => {
    const mapKey = (it: FeedItem): FeedFilterKey => {
      if (it.kind === "POST") return "POST";
      if (it.kind === "BROADCAST") return "BROADCAST";
      if (it.kind === "ROUTE") return "ROUTE";
      if (it.kind === "MESSAGE") return "MESSAGE";
      return "PROFILE";
    };
    return feedItems.filter((it) => feedFilters.has(mapKey(it)));
  }, [feedFilters, feedItems]);

  const visibleFeedItems = useMemo(
    () => filteredFeedItems.slice(0, 12),
    [filteredFeedItems]
  );

  const fmtWhen = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  const feedWhen = (it: FeedItem) =>
    it.kind === "BROADCAST" || it.kind === "PROFILE_APPROVED"
      ? it.createdAt
      : (it as any).updatedAt;

  const feedTitle = (it: FeedItem) => {
    if (it.kind === "POST") return it.post.title || "Post";
    if (it.kind === "ROUTE") return it.route.title || "Route";
    if (it.kind === "MESSAGE") return it.subject || "Message";
    if (it.kind === "PROFILE_APPROVED") {
      return `New ${it.profileRole === "RETAINER" ? "Retainer" : "Seeker"} approved`;
    }
    return it.broadcast.subject || "Broadcast";
  };

  const feedBadge = (it: FeedItem) =>
    it.kind === "POST"
      ? it.post.type
      : it.kind === "ROUTE"
        ? "ROUTE"
        : it.kind === "MESSAGE"
          ? "MESSAGE"
          : it.kind === "PROFILE_APPROVED"
            ? "NEW PROFILE"
            : "BROADCAST";

  const feedKey = (it: FeedItem) => `${it.kind}:${it.id}`;

  const toggleFeedItem = (it: FeedItem) => {
    const key = feedKey(it);
    setExpandedFeedKey((prev) => (prev === key ? null : key));
    if (it.kind === "ROUTE" && retainerId) {
      markRouteResponsesSeen(retainerId, it.route.id);
    }
  };

  const renderFeedDetails = (it: FeedItem) => {
    if (it.kind === "MESSAGE") {
      const seeker = seekerById.get(it.seekerId);
      const name = seeker ? formatSeekerName(seeker) : "Seeker";
      return (
        <div className="space-y-2 text-sm text-slate-200">
          <div>
            <span className="text-slate-400">From: </span>
            {name}
          </div>
          {it.preview ? (
            <div className="text-slate-200 whitespace-pre-wrap">{it.preview}</div>
          ) : (
            <div className="text-xs text-slate-400">No preview available.</div>
          )}
          <button
            type="button"
            onClick={() => {
              if (!retainerId || typeof window === "undefined") return;
              window.localStorage.setItem(
                `snapdriver_retainer_active_seeker_${retainerId}`,
                it.seekerId
              );
              window.localStorage.setItem(
                `snapdriver_retainer_active_conversation_${retainerId}`,
                it.conversationId
              );
              onGoToMessages();
            }}
            className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
          >
            Open conversation
          </button>
        </div>
      );
    }

    if (it.kind === "PROFILE_APPROVED") {
      const place = [it.city, it.state].filter(Boolean).join(", ");
      return (
        <div className="space-y-2 text-sm text-slate-200">
          <div>
            <span className="text-slate-400">Name: </span>
            {it.name}
          </div>
          {place && (
            <div>
              <span className="text-slate-400">Location: </span>
              {place}
            </div>
          )}
          {it.profileRole === "SEEKER" && (
            <button
              type="button"
              onClick={() => {
                const seeker = seekerById.get(it.profileId);
                if (seeker) onOpenProfile(seeker);
              }}
              className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
            >
              View profile
            </button>
          )}
        </div>
      );
    }

    if (it.kind === "POST") {
      const visibility = it.post.audience === "PUBLIC" ? "Area" : "Linked only";
      return (
        <div className="space-y-2 text-sm text-slate-200">
          <div className="text-xs text-slate-400">Visibility: {visibility}</div>
          <div className="text-sm text-slate-200 whitespace-pre-wrap">{it.post.body}</div>
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

  const renderRouteResponses = (route: Route) => {
    const grouped = getRouteResponsesGrouped(route.id);
    const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
    if (total === 0) {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
          No responses yet.
        </div>
      );
    }

    const typeOrder: Array<{
      key: "INTERESTED" | "REQUEST_INFO" | "DIRECT_MESSAGE" | "NOT_INTERESTED";
      label: string;
      tone: string;
    }> = [
      { key: "INTERESTED", label: "Interested", tone: "text-emerald-200" },
      { key: "REQUEST_INFO", label: "Request info", tone: "text-sky-200" },
      { key: "DIRECT_MESSAGE", label: "Direct messages", tone: "text-amber-200" },
      { key: "NOT_INTERESTED", label: "Not interested", tone: "text-rose-200" },
    ];

    const reasonLabel = (code?: string) => {
      if (!code) return "No reason provided";
      const match = NOT_INTERESTED_REASONS.find((r) => r.code === code);
      return match ? match.label : code;
    };

    return (
      <div className="space-y-3">
        {typeOrder.map((group) => {
          const list = grouped[group.key];
          if (!list || list.length === 0) return null;

          return (
            <div key={group.key} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className={`text-xs font-semibold uppercase tracking-wide ${group.tone}`}>
                  {group.label}
                </div>
                <div className="text-[11px] text-slate-400">{list.length}</div>
              </div>
              <div className="space-y-2">
                {list.map((resp) => {
                  const seeker = seekerById.get(String(resp.seekerId));
                  const name = seeker ? formatSeekerName(seeker) : `Seeker (${resp.seekerId})`;
                  const canMessage = seeker && activeLinkSeekerIds.has(String(resp.seekerId));

                  return (
                    <div key={resp.id} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-50 truncate">{name}</div>
                        <div className="text-[11px] text-slate-400">{fmtWhen(resp.createdAt)}</div>
                        {group.key === "NOT_INTERESTED" && (
                          <div className="text-[11px] text-slate-400">Reason: {reasonLabel(resp.reasonCode)}</div>
                        )}
                        {resp.note && (
                          <div className="text-[11px] text-slate-300 mt-1">{resp.note}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (seeker) onOpenProfile(seeker);
                          }}
                          disabled={!seeker}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          View profile
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (seeker) onMessage(seeker);
                          }}
                          disabled={!canMessage || !canInteract}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title={canMessage ? "" : "Direct message is only available for linked Seekers"}
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPostResponses = (post: RetainerPost) => {
    const grouped = getPostResponsesGrouped(post.id);
    const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
    if (total === 0) {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
          No responses yet.
        </div>
      );
    }

    const typeOrder: Array<{
      key: "INTERESTED" | "REQUEST_INFO" | "DIRECT_MESSAGE" | "NOT_INTERESTED";
      label: string;
      tone: string;
    }> = [
      { key: "INTERESTED", label: "Interested", tone: "text-emerald-200" },
      { key: "REQUEST_INFO", label: "Request info", tone: "text-sky-200" },
      { key: "DIRECT_MESSAGE", label: "Direct messages", tone: "text-amber-200" },
      { key: "NOT_INTERESTED", label: "Not interested", tone: "text-rose-200" },
    ];

    const reasonLabel = (code?: string) => {
      if (!code) return "No reason provided";
      const match = NOT_INTERESTED_REASONS.find((r) => r.code === code);
      return match ? match.label : code;
    };

    return (
      <div className="space-y-3">
        {typeOrder.map((group) => {
          const list = grouped[group.key];
          if (!list || list.length === 0) return null;

          return (
            <div key={group.key} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className={`text-xs font-semibold uppercase tracking-wide ${group.tone}`}>
                  {group.label}
                </div>
                <div className="text-[11px] text-slate-400">{list.length}</div>
              </div>
              <div className="space-y-2">
                {list.map((resp) => {
                  const seeker = seekerById.get(String(resp.seekerId));
                  const name = seeker ? formatSeekerName(seeker) : `Seeker (${resp.seekerId})`;
                  const canMessage = seeker && activeLinkSeekerIds.has(String(resp.seekerId));

                  return (
                    <div key={resp.id} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-50 truncate">{name}</div>
                        <div className="text-[11px] text-slate-400">{fmtWhen(resp.createdAt)}</div>
                        {group.key === "NOT_INTERESTED" && (
                          <div className="text-[11px] text-slate-400">Reason: {reasonLabel(resp.reasonCode)}</div>
                        )}
                        {resp.note && (
                          <div className="text-[11px] text-slate-300 mt-1">{resp.note}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (seeker) onOpenProfile(seeker);
                          }}
                          disabled={!seeker}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          View profile
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (seeker) onMessage(seeker);
                          }}
                          disabled={!canMessage || !canInteract}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title={canMessage ? "" : "Direct message is only available for linked Seekers"}
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderFeedReactions = (
    itemKind: FeedReactionItemKind,
    itemId: string
  ) => {
    const grouped = getFeedReactionsGrouped(itemKind, itemId);
    const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
    if (total === 0) {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
          No reactions yet.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {FEED_REACTION_OPTIONS.map((opt) => {
          const list = grouped[opt.type];
          if (!list || list.length === 0) return null;

          return (
            <div key={opt.type} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                  {opt.label}
                </div>
                <div className="text-[11px] text-slate-400">{list.length}</div>
              </div>
              <div className="space-y-2">
                {list.map((resp) => {
                  const seeker = seekerById.get(String(resp.seekerId));
                  const name = seeker ? formatSeekerName(seeker) : `Seeker (${resp.seekerId})`;
                  const canMessage = seeker && activeLinkSeekerIds.has(String(resp.seekerId));

                  return (
                    <div key={resp.id} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-50 truncate">{name}</div>
                        <div className="text-[11px] text-slate-400">{fmtWhen(resp.createdAt)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (seeker) onOpenProfile(seeker);
                          }}
                          disabled={!seeker}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          View profile
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (seeker) onMessage(seeker);
                          }}
                          disabled={!canMessage || !canInteract}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title={canMessage ? "" : "Direct message is only available for linked Seekers"}
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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
          <div className="text-xs uppercase tracking-wide text-slate-400">Feed</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Posts, broadcasts, routes, and messages tied to your account.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onGoToPosts}
            disabled={!retainerId || !canInteract}
            className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Create post/broadcast
          </button>
          <button
            type="button"
            onClick={onGoToMessages}
            disabled={!retainerId}
            className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            View messages
          </button>
          <button
            type="button"
            onClick={onGoToRoutes}
            disabled={!retainerId}
            className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
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
        <button
          type="button"
          onClick={() =>
            setFeedFilters(new Set(FEED_FILTER_OPTIONS.map((item) => item.key)))
          }
          className={[
            "px-3 py-1 rounded-full text-[11px] border transition",
            feedFilters.size === FEED_FILTER_OPTIONS.length
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"
              : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
          ].join(" ")}
        >
          All
        </button>
        {FEED_FILTER_OPTIONS.map((item) => {
          const isActive = feedFilters.has(item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setFeedFilters((prev) => {
                  const next = new Set(prev);
                  if (next.has(item.key)) {
                    if (next.size === 1) return next;
                    next.delete(item.key);
                    return next;
                  }
                  next.add(item.key);
                  return next;
                });
              }}
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

      {!retainerId ? (
        <div className="mt-3 text-xs text-slate-400">
          Select or create a Retainer profile to see your feed.
        </div>
      ) : visibleFeedItems.length === 0 ? (
        <div className="mt-3 text-xs text-slate-400">
          No recent activity yet. Create a post, broadcast, or route to get started.
        </div>
      ) : (
        <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">
          <ul className="space-y-2">
            {visibleFeedItems.map((it) => {
              const retainerName = retainerCompany || "Retainer";
              const when = feedWhen(it);
              const badge = feedBadge(it);
              const feedKeyValue = feedKey(it);
              const isExpanded = expandedFeedKey === feedKeyValue;
              const isAd = it.kind === "POST" && it.post.type === "AD";
              const isUpdate = it.kind === "POST" && it.post.type === "UPDATE";
              const isBroadcast = it.kind === "BROADCAST";
              const isMessage = it.kind === "MESSAGE";
              const isProfile = it.kind === "PROFILE_APPROVED";
              const seekerForItem =
                it.kind === "MESSAGE"
                  ? seekerById.get(it.seekerId)
                  : it.kind === "PROFILE_APPROVED"
                    ? seekerById.get(it.profileId)
                    : undefined;
              const displayName =
                isMessage || isProfile
                  ? seekerForItem
                    ? formatSeekerName(seekerForItem)
                    : isProfile
                      ? it.name
                      : "Seeker"
                  : retainerName;
              const responseCounts =
                it.kind === "ROUTE"
                  ? getRouteResponseCounts(it.route.id)
                  : isAd
                    ? getPostResponseCounts(it.post.id)
                    : null;
              const reactionCounts =
                isBroadcast || isUpdate
                  ? getFeedReactionCounts(isBroadcast ? "BROADCAST" : "POST", it.id)
                  : null;
              const unreadCount =
                it.kind === "ROUTE" && retainerId
                  ? getUnreadRouteResponseCount(retainerId, it.route.id)
                  : isMessage
                    ? it.unreadCount
                    : 0;

              return (
                <li
                  key={`${it.kind}:${it.id}`}
                  onClick={() => toggleFeedItem(it)}
                  className={[
                    "rounded-xl border bg-slate-950/60 px-3 py-2 cursor-pointer transition",
                    isExpanded
                      ? "border-emerald-500/40"
                      : "border-slate-800 hover:border-slate-700",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-start gap-2">
                      <ProfileAvatar
                        role={isMessage || isProfile ? "SEEKER" : "RETAINER"}
                        profile={
                          (isMessage || isProfile
                            ? seekerForItem ?? { id: isMessage ? it.seekerId : it.id }
                            : currentRetainer ?? { id: retainerId || "retainer" }) as any
                        }
                        name={displayName}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFeedItem(it);
                            }}
                            className="text-[11px] text-slate-300 hover:text-slate-100 transition truncate max-w-[180px]"
                            title="View feed details"
                          >
                            {displayName}
                          </button>
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
                        {responseCounts && (
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-100">
                              Interested {responseCounts.INTERESTED}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-100">
                              Info {responseCounts.REQUEST_INFO}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-100">
                              DM {responseCounts.DIRECT_MESSAGE}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-100">
                              Not interested {responseCounts.NOT_INTERESTED}
                            </span>
                            {it.kind === "ROUTE" && unreadCount > 0 && (
                              <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-emerald-100">
                                +{unreadCount} new
                              </span>
                            )}
                          </div>
                        )}
                        {reactionCounts && (
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-100">
                              Thumbs up {reactionCounts.LIKE}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-100">
                              Thumbs down {reactionCounts.DISLIKE}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-100">
                              Question {reactionCounts.QUESTION}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-100">
                              Acknowledged {reactionCounts.ACKNOWLEDGE}
                            </span>
                          </div>
                        )}
                        {isMessage && (
                          <div className="mt-1 text-[10px] text-slate-400 truncate max-w-[260px]">
                            {it.preview || "New message"}
                            {unreadCount > 0 && (
                              <span className="ml-2 inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-emerald-100">
                                Unread {unreadCount}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFeedItem(it);
                        }}
                        className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                      >
                        View
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div
                      className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-xs uppercase tracking-wide text-slate-400">Feed details</div>
                      {renderFeedDetails(it)}
                      {it.kind === "ROUTE" && renderRouteResponses(it.route)}
                      {isAd && renderPostResponses(it.post)}
                      {(isBroadcast || isUpdate) &&
                        renderFeedReactions(isBroadcast ? "BROADCAST" : "POST", it.id)}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {it.kind === "ROUTE" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onGoToRoutes();
                            }}
                            className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                          >
                            View in Routes
                          </button>
                        )}
                        {it.kind === "MESSAGE" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!retainerId || typeof window === "undefined") return;
                              window.localStorage.setItem(
                                `snapdriver_retainer_active_seeker_${retainerId}`,
                                it.seekerId
                              );
                              window.localStorage.setItem(
                                `snapdriver_retainer_active_conversation_${retainerId}`,
                                it.conversationId
                              );
                              onGoToMessages();
                            }}
                            className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                          >
                            Open messages
                          </button>
                        )}
                        {it.kind === "PROFILE_APPROVED" && it.profileRole === "SEEKER" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const seeker = seekerById.get(it.profileId);
                              if (seeker) onOpenProfile(seeker);
                            }}
                            className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                          >
                            View profile
                          </button>
                        )}
                        {(it.kind === "POST" || it.kind === "BROADCAST") && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onGoToPosts();
                            }}
                            className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                          >
                            View in Posts
                          </button>
                        )}
                      </div>
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

        <span className="text-[10px] uppercase tracking-wide text-emerald-300">Active</span>

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

const DashboardView: React.FC<{

  retainerId: string | null;

  currentRetainer?: Retainer;

  seekers: Seeker[];
  isDesktop: boolean;

  onToast: (message: string) => void;

  onOpenProfile: (s: Seeker) => void;

  onMessage: (s: Seeker) => void;

  canInteract?: boolean;

  onGoToMessages: () => void;

  onGoToPosts: () => void;

  onGoToRoutes: () => void;

  onGoToLinking: () => void;

  onGoToBadges: () => void;

}> = ({

  retainerId,

  currentRetainer,

  seekers,
  isDesktop,

  onToast,

  onOpenProfile,

  onMessage,

  canInteract = true,

  onGoToMessages,

  onGoToPosts,

  onGoToRoutes,

  onGoToLinking,

  onGoToBadges,

}) => {

  const retainerRoutes = useMemo<Route[]>(() => {

    if (!retainerId) return [];

    return getRoutesForRetainer(retainerId);

  }, [retainerId]);

  const [meetingTick, setMeetingTick] = useState(0);

  const stats = useMemo(() => {

    if (!retainerId) {

      return {

        activeLinks: 0,

        unreadMessages: 0,

        activeRoutes: 0,

        routeInterests: 0,

        badgeApprovals: 0,

        scheduledEvents: 0,

        approvalTotals: { yes: 0, no: 0, neutral: 0, total: 0 },

      };

    }

    const links = getLinksForRetainer(retainerId);

    const activeLinks = links.filter((l) => l.status === "ACTIVE").length;

    const unreadMessages = getConversationsForRetainer(retainerId).reduce(

      (sum, c) => sum + (c.retainerUnreadCount || 0),

      0

    );

    const activeRoutes = retainerRoutes.filter((r) => r.status === "ACTIVE").length;

    const routeIds = new Set(retainerRoutes.map((r) => r.id));

    const routeInterests = getAllRouteInterests().filter((i) => routeIds.has(i.routeId))

      .length;

    const badgeApprovals = getPendingBadgeApprovalsForProfile({

      ownerRole: "RETAINER",

      ownerId: retainerId,

    }).count;

    const now = Date.now();
    const scheduledEvents = getMeetingsForRetainer(retainerId).filter((meeting) => {
      if (meeting.status !== "FINALIZED") return false;
      if (!meeting.startsAt) return false;
      return Date.parse(meeting.startsAt) > now;
    }).length;

    const approvalTotals = (() => {

      const totals = { yes: 0, no: 0, neutral: 0, total: 0 };

      const checkins = getBadgeCheckins().filter(

        (c) => c.targetRole === "RETAINER" && c.targetId === retainerId

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

      activeRoutes,

      routeInterests,

      badgeApprovals,

      scheduledEvents,

      approvalTotals,

    };

  }, [retainerId, retainerRoutes, meetingTick]);

  const [feedTick, setFeedTick] = useState(0);
  const [feedFilters, setFeedFilters] = useState<Set<FeedFilterKey>>(
    () => new Set(FEED_FILTER_OPTIONS.map((item) => item.key))
  );

  const [expandedFeedKey, setExpandedFeedKey] = useState<string | null>(null);

  const feedItems = useMemo(() => getFeedForRetainer(retainerId), [retainerId, feedTick]);

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
    if (!retainerId || typeof window === "undefined") return;
    const raw = window.localStorage.getItem("snapdriver_feed_jump");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { role?: string; kind?: string; id?: string };
      if (parsed?.role !== "RETAINER" || !parsed.kind || !parsed.id) return;
      setExpandedFeedKey(`${parsed.kind}:${parsed.id}`);
      const nextKey: FeedFilterKey =
        parsed.kind === "ROUTE"
          ? "ROUTE"
          : parsed.kind === "BROADCAST"
            ? "BROADCAST"
            : parsed.kind === "MESSAGE"
              ? "MESSAGE"
              : parsed.kind === "PROFILE_APPROVED"
                ? "PROFILE"
                : "POST";
      setFeedFilters((prev) => {
        const next = new Set(prev);
        next.add(nextKey);
        return next;
      });
      window.localStorage.removeItem("snapdriver_feed_jump");
    } catch {
      // ignore
    }
  }, [retainerId, feedItems]);

  const filteredFeedItems = useMemo(() => {
    const mapKey = (it: FeedItem): FeedFilterKey => {
      if (it.kind === "POST") return "POST";
      if (it.kind === "BROADCAST") return "BROADCAST";
      if (it.kind === "ROUTE") return "ROUTE";
      if (it.kind === "MESSAGE") return "MESSAGE";
      return "PROFILE";
    };
    return feedItems.filter((it) => feedFilters.has(mapKey(it)));
  }, [feedFilters, feedItems]);

  const visibleFeedItems = useMemo(

    () => filteredFeedItems.slice(0, 12),

    [filteredFeedItems]

  );

  const fmtWhen = (iso: string) => {

    const d = new Date(iso);

    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();

  };

  const feedWhen = (it: FeedItem) =>
    it.kind === "BROADCAST" || it.kind === "PROFILE_APPROVED"
      ? it.createdAt
      : (it as any).updatedAt;

  const feedTitle = (it: FeedItem) => {
    if (it.kind === "POST") return it.post.title || "Post";
    if (it.kind === "ROUTE") return it.route.title || "Route";
    if (it.kind === "MESSAGE") return it.subject || "Message";
    if (it.kind === "PROFILE_APPROVED") {
      return `New ${it.profileRole === "RETAINER" ? "Retainer" : "Seeker"} approved`;
    }
    return it.broadcast.subject || "Broadcast";
  };

  const feedBadge = (it: FeedItem) =>
    it.kind === "POST"
      ? it.post.type
      : it.kind === "ROUTE"
        ? "ROUTE"
        : it.kind === "MESSAGE"
          ? "MESSAGE"
          : it.kind === "PROFILE_APPROVED"
            ? "NEW PROFILE"
            : "BROADCAST";

  const feedKey = (it: FeedItem) => `${it.kind}:${it.id}`;

  const toggleFeedItem = (it: FeedItem) => {

    const key = feedKey(it);

    setExpandedFeedKey((prev) => (prev === key ? null : key));

    if (it.kind === "ROUTE" && retainerId) {

      markRouteResponsesSeen(retainerId, it.route.id);

    }

  };

  const renderFeedDetails = (it: FeedItem) => {
    if (it.kind === "MESSAGE") {
      const seeker = seekers.find((s) => s.id === it.seekerId);
      const name = seeker ? formatSeekerName(seeker) : "Seeker";
      return (
        <div className="space-y-2 text-sm text-slate-200">
          <div>
            <span className="text-slate-400">From: </span>
            {name}
          </div>
          {it.preview ? (
            <div className="text-slate-200 whitespace-pre-wrap">{it.preview}</div>
          ) : (
            <div className="text-xs text-slate-400">No preview available.</div>
          )}
          <button
            type="button"
            onClick={() => {
              if (!retainerId || typeof window === "undefined") return;
              window.localStorage.setItem(
                `snapdriver_retainer_active_seeker_${retainerId}`,
                it.seekerId
              );
              window.localStorage.setItem(
                `snapdriver_retainer_active_conversation_${retainerId}`,
                it.conversationId
              );
              onGoToMessages();
            }}
            className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
          >
            Open conversation
          </button>
        </div>
      );
    }

    if (it.kind === "PROFILE_APPROVED") {
      const place = [it.city, it.state].filter(Boolean).join(", ");
      return (
        <div className="space-y-2 text-sm text-slate-200">
          <div>
            <span className="text-slate-400">Name: </span>
            {it.name}
          </div>
          {place && (
            <div>
              <span className="text-slate-400">Location: </span>
              {place}
            </div>
          )}
        </div>
      );
    }

    if (it.kind === "POST") {
      const visibility = it.post.audience === "PUBLIC" ? "Area" : "Linked only";
      return (
        <div className="space-y-2 text-sm text-slate-200">
          <div className="text-xs text-slate-400">Visibility: {visibility}</div>
          <div className="text-sm text-slate-200 whitespace-pre-wrap">{it.post.body}</div>
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

  const renderRouteResponses = (route: Route) => {

    const grouped = getRouteResponsesGrouped(route.id);

    const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);

    if (total === 0) {

      return (

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">

          No responses yet.

        </div>

      );

    }

    const typeOrder: Array<{

      key: "INTERESTED" | "REQUEST_INFO" | "DIRECT_MESSAGE" | "NOT_INTERESTED";

      label: string;

      tone: string;

    }> = [

      { key: "INTERESTED", label: "Interested", tone: "text-emerald-200" },

      { key: "REQUEST_INFO", label: "Request info", tone: "text-sky-200" },

      { key: "DIRECT_MESSAGE", label: "Direct messages", tone: "text-amber-200" },

      { key: "NOT_INTERESTED", label: "Not interested", tone: "text-rose-200" },

    ];

    const reasonLabel = (code?: string) => {

      if (!code) return "No reason provided";

      const match = NOT_INTERESTED_REASONS.find((r) => r.code === code);

      return match ? match.label : code;

    };

    return (

      <div className="space-y-3">

        {typeOrder.map((group) => {

          const list = grouped[group.key];

          if (!list || list.length === 0) return null;

          return (

            <div key={group.key} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">

              <div className="flex items-center justify-between">

                <div className={`text-xs font-semibold uppercase tracking-wide ${group.tone}`}>

                  {group.label}

                </div>

                <div className="text-[11px] text-slate-400">{list.length}</div>

              </div>

              <div className="space-y-2">

                {list.map((resp) => {

                  const seeker = seekerById.get(String(resp.seekerId));

                  const name = seeker ? formatSeekerName(seeker) : `Seeker (${resp.seekerId})`;

                  const canMessage = seeker && activeLinkSeekerIds.has(String(resp.seekerId));

                  return (

                    <div key={resp.id} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-start justify-between gap-3">

                      <div className="min-w-0">

                        <div className="text-sm font-semibold text-slate-50 truncate">{name}</div>

                        <div className="text-[11px] text-slate-400">{fmtWhen(resp.createdAt)}</div>

                        {group.key === "NOT_INTERESTED" && (

                          <div className="text-[11px] text-slate-400">Reason: {reasonLabel(resp.reasonCode)}</div>

                        )}

                        {resp.note && (

                          <div className="text-[11px] text-slate-300 mt-1">{resp.note}</div>

                        )}

                      </div>

                      <div className="flex items-center gap-2">

                        <button

                          type="button"

                          onClick={(e) => {

                            e.stopPropagation();

                            if (seeker) onOpenProfile(seeker);

                          }}

                          disabled={!seeker}

                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"

                        >

                          View profile

                        </button>

                        <button

                          type="button"

                          onClick={(e) => {

                            e.stopPropagation();

                            if (seeker) onMessage(seeker);

                          }}

                          disabled={!canMessage || !canInteract}

                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"

                          title={canMessage ? "" : "Direct message is only available for linked Seekers"}

                        >

                          Message

                        </button>

                      </div>

                    </div>

                  );

                })}

              </div>

            </div>

          );

        })}

      </div>

    );

  };

  const renderPostResponses = (post: RetainerPost) => {
    const grouped = getPostResponsesGrouped(post.id);
    const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
    if (total === 0) {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
          No responses yet.
        </div>
      );
    }

    const typeOrder: Array<{
      key: "INTERESTED" | "REQUEST_INFO" | "DIRECT_MESSAGE" | "NOT_INTERESTED";
      label: string;
      tone: string;
    }> = [
      { key: "INTERESTED", label: "Interested", tone: "text-emerald-200" },
      { key: "REQUEST_INFO", label: "Request info", tone: "text-sky-200" },
      { key: "DIRECT_MESSAGE", label: "Direct messages", tone: "text-amber-200" },
      { key: "NOT_INTERESTED", label: "Not interested", tone: "text-rose-200" },
    ];

    const reasonLabel = (code?: string) => {
      if (!code) return "No reason provided";
      const match = NOT_INTERESTED_REASONS.find((r) => r.code === code);
      return match ? match.label : code;
    };

    return (
      <div className="space-y-3">
        {typeOrder.map((group) => {
          const list = grouped[group.key];
          if (!list || list.length === 0) return null;

          return (
            <div key={group.key} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className={`text-xs font-semibold uppercase tracking-wide ${group.tone}`}>
                  {group.label}
                </div>
                <div className="text-[11px] text-slate-400">{list.length}</div>
              </div>
              <div className="space-y-2">
                {list.map((resp) => {
                  const seeker = seekerById.get(String(resp.seekerId));
                  const name = seeker ? formatSeekerName(seeker) : `Seeker (${resp.seekerId})`;
                  const canMessage = seeker && activeLinkSeekerIds.has(String(resp.seekerId));

                  return (
                    <div key={resp.id} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-50 truncate">{name}</div>
                        <div className="text-[11px] text-slate-400">{fmtWhen(resp.createdAt)}</div>
                        {group.key === "NOT_INTERESTED" && (
                          <div className="text-[11px] text-slate-400">Reason: {reasonLabel(resp.reasonCode)}</div>
                        )}
                        {resp.note && (
                          <div className="text-[11px] text-slate-300 mt-1">{resp.note}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (seeker) onOpenProfile(seeker);
                          }}
                          disabled={!seeker}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          View profile
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (seeker) onMessage(seeker);
                          }}
                          disabled={!canMessage || !canInteract}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title={canMessage ? "" : "Direct message is only available for linked Seekers"}
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderFeedReactions = (
    itemKind: FeedReactionItemKind,
    itemId: string
  ) => {
    const grouped = getFeedReactionsGrouped(itemKind, itemId);
    const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
    if (total === 0) {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
          No reactions yet.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {FEED_REACTION_OPTIONS.map((opt) => {
          const list = grouped[opt.type];
          if (!list || list.length === 0) return null;

          return (
            <div key={opt.type} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                  {opt.label}
                </div>
                <div className="text-[11px] text-slate-400">{list.length}</div>
              </div>
              <div className="space-y-2">
                {list.map((resp) => {
                  const seeker = seekerById.get(String(resp.seekerId));
                  const name = seeker ? formatSeekerName(seeker) : `Seeker (${resp.seekerId})`;
                  const canMessage = seeker && activeLinkSeekerIds.has(String(resp.seekerId));

                  return (
                    <div key={resp.id} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-50 truncate">{name}</div>
                        <div className="text-[11px] text-slate-400">{fmtWhen(resp.createdAt)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (seeker) onOpenProfile(seeker);
                          }}
                          disabled={!seeker}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          View profile
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (seeker) onMessage(seeker);
                          }}
                          disabled={!canMessage || !canInteract}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title={canMessage ? "" : "Direct message is only available for linked Seekers"}
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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

    if (!retainerId) return [];

    const ids = getActiveBadges("RETAINER", retainerId);

    return ids

      .map((id) => getBadgeDefinition(id))

      .filter((b): b is NonNullable<typeof b> => Boolean(b))

      .slice(0, 3);

  }, [retainerId]);

  const retainerReputation = retainerId

    ? getReputationScoreForProfile({ ownerRole: "RETAINER", ownerId: retainerId })

    : null;

  const [linkTick] = useState(0);

  const pendingLinks = useMemo(() => {

    if (!retainerId) return [];

    return getLinksForRetainer(retainerId).filter((l) => l.status === "PENDING");

  }, [retainerId, linkTick]);

  const activeLinkSeekerIds = useMemo(() => {

    if (!retainerId) return new Set<string>();

    return new Set(

      getLinksForRetainer(retainerId)

        .filter((l) => l.status === "ACTIVE")

        .map((l) => String(l.seekerId))

    );

  }, [retainerId, linkTick]);

  const seekerById = useMemo(

    () => new Map<string, Seeker>(seekers.map((s) => [s.id, s])),

    [seekers]

  );

  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = useState("Interview");
  const [meetingNote, setMeetingNote] = useState("");
  const [meetingDuration, setMeetingDuration] = useState(30);
  const [meetingTimezone, setMeetingTimezone] = useState(() => {
    if (currentRetainer?.payCycleTimezone) return currentRetainer.payCycleTimezone;
    if (typeof window === "undefined") return "America/New_York";
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  });
  const [meetingSlotInput, setMeetingSlotInput] = useState("");
  const [meetingSlots, setMeetingSlots] = useState<
    Array<{ startAt: string; durationMinutes: number }>
  >([]);
  const [meetingInviteIds, setMeetingInviteIds] = useState<Set<string>>(
    () => new Set()
  );
  const [inviteQuery, setInviteQuery] = useState("");
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<{
    connected: boolean;
    expiresAt?: string | null;
  } | null>(null);

  const refreshGoogleStatus = async () => {
    if (!retainerId) {
      setGoogleStatus(null);
      return;
    }
    try {
      const status = await getGoogleOAuthStatus();
      if (status && status.ok) {
        setGoogleStatus({ connected: status.connected, expiresAt: status.expiresAt });
      } else {
        setGoogleStatus({ connected: false });
      }
    } catch {
      setGoogleStatus({ connected: false });
    }
  };

  useEffect(() => {
    refreshGoogleStatus();
  }, [retainerId]);

  useEffect(() => {
    if (!retainerId) return;
    setMeetingInviteIds(new Set());
    setMeetingSlots([]);
    setMeetingSlotInput("");
    setMeetingError(null);
    setMeetingNote("");
    setMeetingTitle("Interview");
  }, [retainerId]);

  useEffect(() => {
    if (!activeMeetingId) return;
    setMeetingSlotInput("");
    setMeetingError(null);
  }, [activeMeetingId]);

  useEffect(() => {
    if (currentRetainer?.payCycleTimezone) {
      setMeetingTimezone((prev) => prev || currentRetainer.payCycleTimezone || prev);
    }
  }, [currentRetainer?.payCycleTimezone]);

  const meetings = useMemo(
    () => (retainerId ? getMeetingsForRetainer(retainerId) : []),
    [retainerId, meetingTick]
  );

  const activeMeeting = useMemo(
    () => meetings.find((m) => m.id === activeMeetingId) ?? null,
    [meetings, activeMeetingId]
  );

  useEffect(() => {
    if (activeMeetingId && !activeMeeting) setActiveMeetingId(null);
  }, [activeMeetingId, activeMeeting]);

  const scheduledMeetings = useMemo(
    () => meetings.filter((m) => m.status === "FINALIZED"),
    [meetings]
  );
  const pendingMeetings = useMemo(
    () => meetings.filter((m) => m.status !== "FINALIZED" && m.status !== "CANCELED"),
    [meetings]
  );
  const canceledMeetings = useMemo(
    () => meetings.filter((m) => m.status === "CANCELED"),
    [meetings]
  );

  const inviteCandidates = useMemo(() => {
    if (!retainerId) return [];
    return seekers
      .filter((s) => (s as any).status === "APPROVED")
      .sort((a, b) => formatSeekerName(a).localeCompare(formatSeekerName(b)));
  }, [seekers, retainerId]);

  const filteredInviteCandidates = useMemo(() => {
    const needle = inviteQuery.trim().toLowerCase();
    if (!needle) return inviteCandidates;
    return inviteCandidates.filter((s) => {
      const name = formatSeekerName(s).toLowerCase();
      const email = String((s as any).email ?? "").toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });
  }, [inviteCandidates, inviteQuery]);

  const formatMeetingTime = (iso: string, timezone?: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    try {
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone || undefined,
      }).format(d);
    } catch {
      return d.toLocaleString();
    }
  };

  const renderMeetingCard = (meeting: InterviewMeeting) => {
    const confirmed = meeting.attendees.filter((a) => a.responseStatus === "CONFIRMED")
      .length;
    const reschedules = meeting.attendees.filter((a) => a.rescheduleRequested).length;
    const total = meeting.attendees.length;
    const timeLabel = meeting.startsAt
      ? formatMeetingTime(meeting.startsAt, meeting.timezone)
      : meeting.proposals[0]
        ? formatMeetingTime(meeting.proposals[0].startAt, meeting.timezone)
        : "Awaiting time slots";

    return (
      <button
        key={meeting.id}
        type="button"
        onClick={() => setActiveMeetingId(meeting.id)}
        className="text-left rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 hover:bg-slate-900/70 transition"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">
                        {meeting.title || "Interview"}{" - "}
            </div>
            <div className="text-[11px] text-slate-500">{timeLabel}</div>
          </div>
          <div className="text-[11px] text-slate-400">{meeting.status}</div>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          {confirmed}/{total} confirmed{reschedules ? ` · ${reschedules} reschedule` : ""}
        </div>
      </button>
    );
  };

  const handleGoogleConnect = () => {
    if (typeof window === "undefined") return;
    const url = new URL("/api/google/oauth/start", window.location.origin);
    window.location.assign(url.toString());
  };

  const handleGoogleDisconnect = async () => {
    try {
      await disconnectGoogleOAuth();
      await refreshGoogleStatus();
      onToast("Google Calendar disconnected.");
    } catch {
      onToast("Unable to disconnect Google Calendar.");
    }
  };

  const handleMeetingRefresh = async () => {
    try {
      await pullFromServer();
    } catch {
      // ignore
    }
    setMeetingTick((n) => n + 1);
    await refreshGoogleStatus();
  };

  const retainerDisplayName = currentRetainer ? formatRetainerName(currentRetainer) : "Retainer";

  const retainerCompany = currentRetainer?.companyName || retainerDisplayName;

  const retainerUserName =

    (currentRetainer as any)?.name || (currentRetainer as any)?.ceoName || retainerDisplayName;

  const profileCard = (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 min-h-[240px]">
      <div className="flex items-start gap-4">
        <div className="w-1/3 max-w-[140px] min-w-[96px]">
          <div className="aspect-square rounded-2xl border border-slate-800 bg-slate-950/60 p-1.5">
            <ProfileAvatar
              role="RETAINER"
              profile={(currentRetainer ?? { id: retainerId || "retainer" }) as any}
              name={retainerCompany}
              size="lg"
              className="h-full w-full rounded-xl"
            />
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="text-lg font-semibold text-slate-50 truncate">
            {retainerId ? retainerCompany : "Retainer"}
          </div>
          <div className="text-sm text-slate-300 truncate">
            {retainerId ? retainerUserName : "Select a Retainer profile"}
          </div>
          <div className="text-sm text-emerald-200">
            {retainerReputation?.score == null
              ? "Reputation -"
              : `Reputation ${retainerReputation.score}`}
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-400/80"
              style={{ width: `${retainerReputation?.scorePercent ?? 0}%` }}
            />
          </div>
          <div className="text-xs text-slate-500">
            Member since {formatMemberSince(currentRetainer?.createdAt)}
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
    <>
      <div className="grid grid-cols-1 gap-0 sm:gap-4 lg:gap-6 lg:grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_420px] lg:items-stretch flex-1 min-h-0 lg:h-full w-full max-w-full">

      <div className="flex flex-col gap-6 min-h-0 order-2 lg:order-1 w-full max-w-full">
        {!isDesktop && profileCard}

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div>

              <div className="text-xs uppercase tracking-wide text-slate-400">Now</div>

              <div className="text-[11px] text-slate-500 mt-1">

                Quick links and live activity for this profile.

              </div>

            </div>

            <button

              type="button"

              onClick={onGoToMessages}

              className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition">

              Open inbox

            </button>

          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">

            <button

              type="button"

              onClick={onGoToLinking}

              disabled={!retainerId}

              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:bg-slate-900/70 transition disabled:opacity-60 disabled:cursor-not-allowed">

              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Links</div>

              <div className="text-xl font-semibold text-slate-50">{stats.activeLinks}</div>

            </button>

            <button

              type="button"

              onClick={onGoToLinking}

              disabled={!retainerId}

              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:bg-slate-900/70 transition disabled:opacity-60 disabled:cursor-not-allowed">

              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Pending links</div>

              <div className="text-xl font-semibold text-slate-50">{pendingLinks.length}</div>

            </button>

            <button

              type="button"

              onClick={onGoToMessages}

              disabled={!retainerId}

              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:bg-slate-900/70 transition disabled:opacity-60 disabled:cursor-not-allowed">

              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Unread</div>

              <div className="text-xl font-semibold text-slate-50">{stats.unreadMessages}</div>

            </button>

            <button

              type="button"

              onClick={onGoToLinking}

              disabled={!retainerId}

              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:bg-slate-900/70 transition disabled:opacity-60 disabled:cursor-not-allowed">

              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Scheduled events</div>

              <div className="text-xl font-semibold text-slate-50">{stats.scheduledEvents}</div>

            </button>

            <button

              type="button"

              onClick={onGoToRoutes}

              disabled={!retainerId}

              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:bg-slate-900/70 transition disabled:opacity-60 disabled:cursor-not-allowed">

              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Interested</div>

              <div className="text-xl font-semibold text-slate-50">{stats.routeInterests}</div>

            </button>

            <button

              type="button"

              onClick={onGoToBadges}

              disabled={!retainerId}

              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:bg-slate-900/70 transition disabled:opacity-60 disabled:cursor-not-allowed">

              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Pending approvals</div>

              <div className="text-xl font-semibold text-slate-50">{stats.badgeApprovals}</div>

            </button>

          </div>

        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col min-h-0 flex-1">

          <div className="flex flex-wrap items-start justify-between gap-3">

            <div>

              <div className="text-xs uppercase tracking-wide text-slate-400">Feed</div>

              <div className="text-[11px] text-slate-500 mt-1">

                Posts, broadcasts, routes, and messages tied to your account.

              </div>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              <button

                type="button"

                onClick={onGoToPosts}

                disabled={!retainerId || !canInteract}

                className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"

              >

                Create post/broadcast

              </button>

              <button

                type="button"

                onClick={onGoToMessages}

                disabled={!retainerId}

                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"

              >

                View messages

              </button>

              <button

                type="button"

                onClick={onGoToRoutes}

                disabled={!retainerId}

                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"

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

            <button
              type="button"
              onClick={() =>
                setFeedFilters(new Set(FEED_FILTER_OPTIONS.map((item) => item.key)))
              }
              className={[
                "px-3 py-1 rounded-full text-[11px] border transition",
                feedFilters.size === FEED_FILTER_OPTIONS.length
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"
                  : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
              ].join(" ")}
            >
              All
            </button>
            {FEED_FILTER_OPTIONS.map((item) => {
              const isActive = feedFilters.has(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setFeedFilters((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.key)) {
                        if (next.size === 1) return next;
                        next.delete(item.key);
                        return next;
                      }
                      next.add(item.key);
                      return next;
                    });
                  }}
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

          {!retainerId ? (

            <div className="mt-3 text-xs text-slate-400">

              Select or create a Retainer profile to see your feed.

            </div>

          ) : visibleFeedItems.length === 0 ? (

            <div className="mt-3 text-xs text-slate-400">

              No recent activity yet. Create a post, broadcast, or route to get started.

            </div>

          ) : (

            <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">

              <ul className="space-y-2">

                {visibleFeedItems.map((it) => {

                  const retainerName = retainerCompany || "Retainer";

                  const when = feedWhen(it);

                  const badge = feedBadge(it);

                  const feedKeyValue = feedKey(it);

                  const isExpanded = expandedFeedKey === feedKeyValue;

                  const isAd = it.kind === "POST" && it.post.type === "AD";

                  const isUpdate = it.kind === "POST" && it.post.type === "UPDATE";

                  const isBroadcast = it.kind === "BROADCAST";
                  const isMessage = it.kind === "MESSAGE";
                  const isProfile = it.kind === "PROFILE_APPROVED";
                  const seekerForItem =
                    it.kind === "MESSAGE"
                      ? seekerById.get(it.seekerId)
                      : it.kind === "PROFILE_APPROVED"
                        ? seekerById.get(it.profileId)
                        : undefined;
                  const displayName =
                    isMessage || isProfile
                      ? seekerForItem
                        ? formatSeekerName(seekerForItem)
                        : isProfile
                          ? it.name
                          : "Seeker"
                      : retainerName;

                  const responseCounts =

                    it.kind === "ROUTE"

                      ? getRouteResponseCounts(it.route.id)

                      : isAd

                        ? getPostResponseCounts(it.post.id)

                        : null;

                  const reactionCounts =

                    isBroadcast || isUpdate

                      ? getFeedReactionCounts(isBroadcast ? "BROADCAST" : "POST", it.id)

                      : null;

                  const unreadCount =

                    it.kind === "ROUTE" && retainerId

                      ? getUnreadRouteResponseCount(retainerId, it.route.id)

                      : isMessage
                        ? it.unreadCount
                        : 0;

                  return (

                    <li

                      key={`${it.kind}:${it.id}`}

                      onClick={() => toggleFeedItem(it)}

                      className={[

                        "rounded-xl border bg-slate-950/60 px-3 py-2 cursor-pointer transition",

                        isExpanded

                          ? "border-emerald-500/40"

                          : "border-slate-800 hover:border-slate-700",

                      ].join(" ")}

                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0 flex items-start gap-2">

                          <ProfileAvatar
                            role={isMessage || isProfile ? "SEEKER" : "RETAINER"}
                            profile={
                              (isMessage || isProfile
                                ? seekerForItem ?? { id: isMessage ? it.seekerId : it.id }
                                : currentRetainer ?? { id: retainerId || "retainer" }) as any
                            }
                            name={displayName}
                            size="lg"
                          />

                          <div className="min-w-0">

                            <div className="flex flex-wrap items-center gap-2">

                              <button

                                type="button"

                                onClick={(e) => { e.stopPropagation(); toggleFeedItem(it); }}

                                className="text-[11px] text-slate-300 hover:text-slate-100 transition truncate max-w-[180px]"

                                title="View feed details"

                              >

                                {displayName}

                              </button>

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

                            {responseCounts && (

                              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">

                                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-100">

                                  Interested {responseCounts.INTERESTED}

                                </span>

                                <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-100">

                                  Info {responseCounts.REQUEST_INFO}

                                </span>

                                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-100">

                                  DM {responseCounts.DIRECT_MESSAGE}

                                </span>

                                <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-100">

                                  Not interested {responseCounts.NOT_INTERESTED}

                                </span>

                                {it.kind === "ROUTE" && unreadCount > 0 && (

                                  <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-emerald-100">

                                    +{unreadCount} new

                                  </span>

                                )}

                              </div>

                            )}

                            {reactionCounts && (

                              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">

                                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-100">

                                  Thumbs up {reactionCounts.LIKE}

                                </span>

                                <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-100">

                                  Thumbs down {reactionCounts.DISLIKE}

                                </span>

                                <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-100">

                                  Question {reactionCounts.QUESTION}

                                </span>

                                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-100">

                                  Acknowledged {reactionCounts.ACKNOWLEDGE}

                                </span>

                              </div>

                            )}

                            {isMessage && (
                              <div className="mt-1 text-[10px] text-slate-400 truncate max-w-[260px]">
                                {it.preview || "New message"}
                                {unreadCount > 0 && (
                                  <span className="ml-2 inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-emerald-100">
                                    Unread {unreadCount}
                                  </span>
                                )}
                              </div>
                            )}

                          </div>

                        </div>

                        <div className="shrink-0 flex gap-2">

                          {it.kind === "ROUTE" ? (

                            <button

                              type="button"

                              onClick={(e) => { e.stopPropagation(); toggleFeedItem(it); }}

                              className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"

                            >

                              View

                            </button>

                          ) : (

                            <button

                              type="button"

                              onClick={(e) => { e.stopPropagation(); toggleFeedItem(it); }}

                              className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"

                            >

                              View

                            </button>

                          )}

                        </div>

                      </div>

                      {isExpanded && (

                        <div

                          className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-3"

                          onClick={(e) => e.stopPropagation()}

                        >

                          <div className="text-xs uppercase tracking-wide text-slate-400">Feed details</div>

                          {renderFeedDetails(it)}

                          {it.kind === "ROUTE" && renderRouteResponses(it.route)}

                          {isAd && renderPostResponses(it.post)}

                          {(isBroadcast || isUpdate) &&
                            renderFeedReactions(isBroadcast ? "BROADCAST" : "POST", it.id)}

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {it.kind === "ROUTE" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onGoToRoutes();
                                }}
                                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                              >
                                View in Routes
                              </button>
                            )}
                            {it.kind === "MESSAGE" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!retainerId || typeof window === "undefined") return;
                                  window.localStorage.setItem(
                                    `snapdriver_retainer_active_seeker_${retainerId}`,
                                    it.seekerId
                                  );
                                  window.localStorage.setItem(
                                    `snapdriver_retainer_active_conversation_${retainerId}`,
                                    it.conversationId
                                  );
                                  onGoToMessages();
                                }}
                                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                              >
                                Open messages
                              </button>
                            )}
                            {it.kind === "PROFILE_APPROVED" && it.profileRole === "SEEKER" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const seeker = seekerById.get(it.profileId);
                                  if (seeker) onOpenProfile(seeker);
                                }}
                                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                              >
                                View profile
                              </button>
                            )}
                            {(it.kind === "POST" || it.kind === "BROADCAST") && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onGoToPosts();
                                }}
                                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                              >
                                View in Posts
                              </button>
                            )}

                          </div>

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

      <aside className="hidden lg:flex lg:order-2 lg:sticky lg:top-6 lg:flex-col lg:gap-5 lg:space-y-0 lg:overflow-hidden min-h-0 lg:h-full w-full max-w-full">
        {profileCard}

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex-1 min-h-0 overflow-y-auto">

          <div className="text-xs uppercase tracking-wide text-slate-400 mb-3">

            Badge progress

          </div>

          <div className="text-[11px] text-slate-500 mb-3">

            {retainerId

              ? "Active badges for this profile."

              : "Select a Retainer profile to track progress."}

          </div>

          {!retainerId ? (

            <div className="text-xs text-slate-400">

              Select or create a Retainer profile to see badge progress.

            </div>

          ) : activeBadges.length === 0 ? (

            <div className="text-xs text-slate-400">

              No active badges yet. Activate badges to start tracking progress.

            </div>

          ) : (

            <div className="grid gap-3">

              {activeBadges.map((badge) => {

                const progress = getBadgeProgress("RETAINER", retainerId, badge.id as any);

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

                      {total == 0

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
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Interview scheduling
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Connect Google Calendar to send Meet invites.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {googleStatus?.connected ? (
                <button
                  type="button"
                  onClick={handleGoogleDisconnect}
                  disabled={!retainerId}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Disconnect Google
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleConnect}
                  disabled={!retainerId}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Connect Google
                </button>
              )}
              <button
                type="button"
                onClick={handleMeetingRefresh}
                disabled={!retainerId}
                className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Refresh
              </button>
            </div>
          </div>
          {!googleStatus?.connected && (
            <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
              Google Calendar is required to send interview invites.
            </div>
          )}
        </div>

        {!retainerId ? (
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
              Select or create a Retainer profile first.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      New interview
                    </div>
                    <div className="text-sm text-slate-300 mt-1">
                      Invite multiple seekers to a single meeting and propose time slots.
                    </div>
                  </div>
                </div>

                {meetingError && (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
                    {meetingError}
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <div className="text-xs font-medium text-slate-200">Title</div>
                    <input
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Interview"
                    />
                  </label>
                  <label className="space-y-1">
                    <div className="text-xs font-medium text-slate-200">Duration</div>
                    <select
                      value={meetingDuration}
                      onChange={(e) => setMeetingDuration(Number(e.target.value) || 30)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={20}>20 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                    </select>
                  </label>
                </div>

                <label className="space-y-1">
                  <div className="text-xs font-medium text-slate-200">Timezone</div>
                  <input
                    value={meetingTimezone}
                    onChange={(e) => setMeetingTimezone(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="America/New_York"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs font-medium text-slate-200">Note (optional)</div>
                  <input
                    value={meetingNote}
                    onChange={(e) => setMeetingNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Example: Intro + route fit"
                  />
                </label>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Invite seekers
                  </div>
                  <input
                    value={inviteQuery}
                    onChange={(e) => setInviteQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Search by name or email"
                  />
                  <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                    {filteredInviteCandidates.length === 0 ? (
                      <div className="text-xs text-slate-400">No seekers found.</div>
                    ) : (
                      filteredInviteCandidates.map((s) => {
                        const name = formatSeekerName(s);
                        const email = String((s as any).email ?? "");
                        const hasEmail = Boolean(email);
                        return (
                          <label
                            key={s.id}
                            className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-200"
                          >
                            <input
                              type="checkbox"
                              checked={meetingInviteIds.has(s.id)}
                              onChange={() => {
                                setMeetingInviteIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(s.id)) next.delete(s.id);
                                  else next.add(s.id);
                                  return next;
                                });
                              }}
                              disabled={!hasEmail}
                              className="mt-1 h-3.5 w-3.5 rounded border-slate-600 bg-slate-900"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-100 truncate">{name}</div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {hasEmail ? email : "Email required to invite"}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Selected: {meetingInviteIds.size}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Time slots
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input
                      type="datetime-local"
                      value={meetingSlotInput}
                      onChange={(e) => setMeetingSlotInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMeetingError(null);
                        if (!meetingSlotInput) {
                          setMeetingError("Pick a time slot first.");
                          return;
                        }
                        const dt = new Date(meetingSlotInput);
                        if (Number.isNaN(dt.getTime())) {
                          setMeetingError("Invalid date/time.");
                          return;
                        }
                        const iso = dt.toISOString();
                        const dayKey = (() => {
                          try {
                            return new Intl.DateTimeFormat("en-CA", {
                              timeZone: meetingTimezone || undefined,
                            }).format(new Date(iso));
                          } catch {
                            return iso.slice(0, 10);
                          }
                        })();
                        const sameDayCount = meetingSlots.filter((slot) => {
                          const key = (() => {
                            try {
                              return new Intl.DateTimeFormat("en-CA", {
                                timeZone: meetingTimezone || undefined,
                              }).format(new Date(slot.startAt));
                            } catch {
                              return slot.startAt.slice(0, 10);
                            }
                          })();
                          return key === dayKey;
                        }).length;
                        if (sameDayCount >= 3) {
                          setMeetingError("Limit 3 slots per day.");
                          return;
                        }
                        setMeetingSlots((prev) => [
                          ...prev,
                          { startAt: iso, durationMinutes: meetingDuration },
                        ]);
                        setMeetingSlotInput("");
                      }}
                      className="px-3 py-2 rounded-xl text-xs bg-emerald-500/80 hover:bg-emerald-400 text-slate-950 transition"
                    >
                      Add slot
                    </button>
                  </div>
                  {meetingSlots.length === 0 ? (
                    <div className="text-xs text-slate-500">No slots added yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {meetingSlots.map((slot, idx) => (
                        <div
                          key={`${slot.startAt}_${idx}`}
                          className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-center justify-between text-xs text-slate-200"
                        >
                          <div>
                            {formatMeetingTime(slot.startAt, meetingTimezone)} ·{" "}
                            {slot.durationMinutes}m
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setMeetingSlots((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="px-2 py-1 rounded-full text-[10px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!retainerId) return;
                      setMeetingError(null);
                      const selected = inviteCandidates.filter((s) =>
                        meetingInviteIds.has(s.id)
                      );
                      if (selected.length === 0) {
                        setMeetingError("Select at least one seeker to invite.");
                        return;
                      }
                      if (meetingSlots.length === 0) {
                        setMeetingError("Add at least one time slot.");
                        return;
                      }
                      const missingEmails = selected.filter(
                        (s) => !String((s as any).email ?? "").includes("@")
                      );
                      if (missingEmails.length > 0) {
                        setMeetingError(
                          `Missing email for ${missingEmails
                            .map((s) => formatSeekerName(s))
                            .join(", ")}.`
                        );
                        return;
                      }
                      try {
                        createInterviewMeeting({
                          retainerId,
                          title: meetingTitle.trim() || "Interview",
                          note: meetingNote,
                          timezone: meetingTimezone,
                          durationMinutes: meetingDuration,
                          proposals: meetingSlots,
                          attendees: selected.map((s) => ({
                            seekerId: s.id,
                            seekerName: formatSeekerName(s),
                            seekerEmail: (s as any).email,
                          })),
                        });
                        setMeetingInviteIds(new Set());
                        setMeetingSlots([]);
                        setMeetingSlotInput("");
                        setMeetingNote("");
                        setMeetingTitle("Interview");
                        setMeetingTick((n) => n + 1);
                        onToast("Interview created.");
                      } catch (err: any) {
                        setMeetingError(err?.message || "Unable to create interview.");
                      }
                    }}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition"
                  >
                    Create interview
                  </button>
                  <div className="text-[11px] text-slate-500">
                    Max 3 slots per day.
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:gap-4 md:grid-cols-2 min-h-0 flex-1 w-full">
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col min-h-0 w-full">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Scheduled
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Meetings with a finalized slot.
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">{scheduledMeetings.length}</div>
                  </div>
                  {scheduledMeetings.length === 0 ? (
                    <div className="mt-3 text-xs text-slate-400">
                      No scheduled interviews yet.
                    </div>
                  ) : (
                    <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
                      {scheduledMeetings.map(renderMeetingCard)}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col min-h-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Pending
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Meetings waiting on confirmations.
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">{pendingMeetings.length}</div>
                  </div>
                  {pendingMeetings.length === 0 ? (
                    <div className="mt-3 text-xs text-slate-400">
                      No pending meetings.
                    </div>
                  ) : (
                    <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
                      {pendingMeetings.map(renderMeetingCard)}
                    </div>
                  )}
                </div>
              </div>

              {canceledMeetings.length > 0 && (
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Canceled
                  </div>
                  <div className="mt-3 grid gap-2">
                    {canceledMeetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400"
                      >
                        {meeting.title || "Interview"}{" - "}
                        {meeting.attendees.length} attendees
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {activeMeeting && retainerId && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setActiveMeetingId(null)}
          />
          <div className="relative h-full w-full p-6 md:p-10 flex items-center justify-center overflow-y-auto">
            <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Interview details
                  </div>
                  <div className="text-sm font-semibold text-slate-100 truncate">
                    {activeMeeting.title || "Interview"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveMeetingId(null)}
                  className="h-9 w-9 rounded-full border border-slate-700 text-slate-200 hover:bg-slate-900 transition"
                  title="Close"
                >
                  x
                </button>
              </div>

              <div className="p-4 space-y-4">
                {meetingError && (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
                    {meetingError}
                  </div>
                )}

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-1">
                  <div className="text-xs text-slate-400">
                    Status: <span className="text-slate-200">{activeMeeting.status}</span>
                  </div>
                  {activeMeeting.startsAt && (
                    <div className="text-sm text-slate-100">
                      {formatMeetingTime(activeMeeting.startsAt, activeMeeting.timezone)} ·{" "}
                      {activeMeeting.durationMinutes}m
                    </div>
                  )}
                  {activeMeeting.meetLink ? (
                    <a
                      href={activeMeeting.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-emerald-200 underline"
                    >
                      Open Meet link
                    </a>
                  ) : activeMeeting.status === "FINALIZED" ? (
                    <div className="text-[11px] text-slate-500">
                      Meet link pending. Refresh in a moment.
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Proposed slots
                  </div>
                  {activeMeeting.proposals.length === 0 ? (
                    <div className="text-xs text-slate-500">No slots yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {activeMeeting.proposals
                        .slice()
                        .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
                        .map((p) => {
                          const confirmed = activeMeeting.attendees.filter(
                            (a) =>
                              a.responseStatus === "CONFIRMED" &&
                              a.selectedProposalId === p.id
                          ).length;
                          const isFinal = activeMeeting.finalizedProposalId === p.id;
                          return (
                            <div
                              key={p.id}
                              className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-center justify-between gap-2"
                            >
                              <div>
                                <div className="text-sm text-slate-100">
                                  {formatMeetingTime(p.startAt, activeMeeting.timezone)}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {p.durationMinutes}m · {confirmed} confirmed
                                </div>
                              </div>
                              {isFinal ? (
                                <span className="text-[11px] text-emerald-200">Finalized</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!googleStatus?.connected) {
                                      onToast("Connect Google Calendar first.");
                                      return;
                                    }
                                    const next = finalizeMeeting({
                                      meetingId: activeMeeting.id,
                                      proposalId: p.id,
                                    });
                                    if (next) {
                                      setActiveMeetingId(next.id);
                                      setMeetingTick((n) => n + 1);
                                      onToast("Meeting finalized.");
                                      await pullFromServer();
                                    }
                                  }}
                                  disabled={!googleStatus?.connected || confirmed === 0}
                                  className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  Finalize
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input
                      type="datetime-local"
                      value={meetingSlotInput}
                      onChange={(e) => setMeetingSlotInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMeetingError(null);
                        if (!meetingSlotInput) {
                          setMeetingError("Pick a time slot first.");
                          return;
                        }
                        const dt = new Date(meetingSlotInput);
                        if (Number.isNaN(dt.getTime())) {
                          setMeetingError("Invalid date/time.");
                          return;
                        }
                        const iso = dt.toISOString();
                        const dayKey = (() => {
                          try {
                            return new Intl.DateTimeFormat("en-CA", {
                              timeZone: activeMeeting.timezone || undefined,
                            }).format(new Date(iso));
                          } catch {
                            return iso.slice(0, 10);
                          }
                        })();
                        const sameDayCount = activeMeeting.proposals.filter((slot) => {
                          const key = (() => {
                            try {
                              return new Intl.DateTimeFormat("en-CA", {
                                timeZone: activeMeeting.timezone || undefined,
                              }).format(new Date(slot.startAt));
                            } catch {
                              return slot.startAt.slice(0, 10);
                            }
                          })();
                          return key === dayKey;
                        }).length;
                        if (sameDayCount >= 3) {
                          setMeetingError("Limit 3 slots per day.");
                          return;
                        }
                        const next = addMeetingProposal({
                          meetingId: activeMeeting.id,
                          startAt: iso,
                          durationMinutes: activeMeeting.durationMinutes,
                        });
                        if (next) {
                          setActiveMeetingId(next.id);
                          setMeetingSlotInput("");
                          setMeetingTick((n) => n + 1);
                        }
                      }}
                      className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                    >
                      Add slot
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Attendees
                  </div>
                  <div className="space-y-2">
                    {activeMeeting.attendees.map((a) => {
                      const name =
                        a.seekerName ||
                        formatSeekerName(seekerById.get(a.seekerId) as any);
                      return (
                        <div
                          key={a.id}
                          className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm text-slate-100 truncate">{name}</div>
                            <div className="text-[11px] text-slate-500">
                              {a.responseStatus}
                              {a.rescheduleRequested ? " · Reschedule requested" : ""}
                            </div>
                          </div>
                          {activeMeeting.status === "FINALIZED" && (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = markMeetingOutcome({
                                    meetingId: activeMeeting.id,
                                    seekerId: a.seekerId,
                                    by: "RETAINER",
                                    outcome: "MET",
                                  });
                                  if (next) {
                                    setActiveMeetingId(next.id);
                                    setMeetingTick((n) => n + 1);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition"
                              >
                                Met
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = markMeetingOutcome({
                                    meetingId: activeMeeting.id,
                                    seekerId: a.seekerId,
                                    by: "RETAINER",
                                    outcome: "NO_SHOW",
                                  });
                                  if (next) {
                                    setActiveMeetingId(next.id);
                                    setMeetingTick((n) => n + 1);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                              >
                                No-show
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {activeMeeting.status === "FINALIZED" && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = requestMeetingReschedule({
                            meetingId: activeMeeting.id,
                            by: "RETAINER",
                          });
                          if (next) {
                            setActiveMeetingId(next.id);
                            setMeetingTick((n) => n + 1);
                          }
                        }}
                        className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                      >
                        Reopen scheduling
                      </button>
                    )}
                    {activeMeeting.status !== "CANCELED" && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = cancelMeeting({ meetingId: activeMeeting.id });
                          if (next) {
                            setActiveMeetingId(next.id);
                            setMeetingTick((n) => n + 1);
                          }
                        }}
                        className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                      >
                        Cancel meeting
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Outcomes are admin-visible only.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );

};

/* ------------------------------------------------------------------ */
/* Action tab                                                         */
/* ------------------------------------------------------------------ */

const ActionView: React.FC<{
  actionTab: ActionTabKey;
  noticeTick: number;
  onChangeTab: (tab: ActionTabKey) => void;
  retainerId: string | null;
  currentRetainer?: Retainer;
  seekers: Seeker[];
  wheelSeekers: Seeker[];
  excellentSeekers: Seeker[];
  possibleSeekers: Seeker[];
  notNowSeekers: Seeker[];
  selectedSeekerIds: Set<string>;
  onToggleSelectedSeeker: (seekerId: string) => void;
  onSelectAllSeekers: () => void;
  onClearSelectedSeekers: () => void;
  onBulkMessageSelected: () => void;
  onBulkRequestLinkSelected: () => void;
  onBulkReturnToWheelSelected: () => void;
  onClassifySeeker: (seeker: Seeker, bucket: SeekerBucketKey) => void;
  onOpenProfile: (seeker: Seeker) => void;
  onReturnToWheel: (seeker: Seeker) => void;
  onRebucketById: (seekerId: string, targetBucket: SeekerBucketKey) => void;
  onMessage: (seeker: Seeker) => void;
  visibleTabs?: ActionTabKey[];
  retainerRoutes: Route[];
  canInteract?: boolean;
  retainerUsers: RetainerUser[];
  retainerLevelLabels: RetainerUserLevelLabels;
  canManageUsers: boolean;
  onCreateUser: (input: Partial<RetainerUser> & { level: RetainerUserLevel }) => void;
  onRemoveUser: (id: string) => void;
  onUpdateUserLabels: (labels: RetainerUserLevelLabels) => void;
  onUpdateHierarchyNodes: (nodes: HierarchyNode[]) => void;
  onRetainerCreated: () => void;
  onRetainerUpdated: () => void;
  onToast: (msg: string) => void;
}> = ({
  actionTab,
  noticeTick,
  onChangeTab,
  retainerId,
  currentRetainer,
  seekers,
  wheelSeekers,
  excellentSeekers,
  possibleSeekers,
  notNowSeekers,
  selectedSeekerIds,
  onToggleSelectedSeeker,
  onSelectAllSeekers,
  onClearSelectedSeekers,
  onBulkMessageSelected,
  onBulkRequestLinkSelected,
  onBulkReturnToWheelSelected,
  onClassifySeeker,
  onOpenProfile,
  onReturnToWheel,
  onRebucketById,
  onMessage,
  visibleTabs,
  retainerRoutes,
  canInteract = true,
  retainerUsers,
  retainerLevelLabels,
  canManageUsers,
  onCreateUser,
  onRemoveUser,
  onUpdateUserLabels,
  onUpdateHierarchyNodes,
  onRetainerCreated,
  onRetainerUpdated,
  onToast,
}) => {
  const selectedCount = selectedSeekerIds.size;
  const [seekerSort, setSeekerSort] = useState<"default" | "match">("default");

  const scheduleMatchBySeekerId = useMemo(() => {
    const map = new Map<string, ScheduleMatch>();
    if (!retainerId || retainerRoutes.length === 0) return map;
    for (const seeker of seekers) {
      const availability = (seeker as any)?.availability as
        | WeeklyAvailability
        | undefined;
      if (!availability || !availability.blocks?.length) continue;
      const match = bestMatchForRoutes({
        availability,
        routes: retainerRoutes as any,
      });
      if (match.percent > 0) map.set(String(seeker.id), match);
    }
    return map;
  }, [retainerId, retainerRoutes, seekers]);

  const sortByMatch = (list: Seeker[]) => {
    if (seekerSort !== "match") return list;
    const next = [...list];
    next.sort(
      (a, b) =>
        (scheduleMatchBySeekerId.get(String(b.id))?.percent ?? 0) -
        (scheduleMatchBySeekerId.get(String(a.id))?.percent ?? 0)
    );
    return next;
  };

  const sortedWheelSeekers = useMemo(
    () => sortByMatch(wheelSeekers),
    [wheelSeekers, seekerSort, scheduleMatchBySeekerId]
  );
  const sortedExcellentSeekers = useMemo(
    () => sortByMatch(excellentSeekers),
    [excellentSeekers, seekerSort, scheduleMatchBySeekerId]
  );
  const sortedPossibleSeekers = useMemo(
    () => sortByMatch(possibleSeekers),
    [possibleSeekers, seekerSort, scheduleMatchBySeekerId]
  );
  const sortedNotNowSeekers = useMemo(
    () => sortByMatch(notNowSeekers),
    [notNowSeekers, seekerSort, scheduleMatchBySeekerId]
  );

  const getScheduleMatch = (seekerId: string): ScheduleMatch | undefined =>
    scheduleMatchBySeekerId.get(seekerId);

  const actionTabs: { key: ActionTabKey; label: string }[] = useMemo(
    () => [
      { key: "wheel", label: "Wheel" },
      { key: "lists", label: "Sorting Lists" },
      { key: "routes", label: "Routes" },
      { key: "schedule", label: "Scheduling" },
      { key: "editProfile", label: "Edit Profile" },
      { key: "addUsers", label: "User access" },
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

  const normalizedLabels = useMemo(
    () => ({
      level1: retainerLevelLabels?.level1 || "Level 1",
      level2: retainerLevelLabels?.level2 || "Level 2",
      level3: retainerLevelLabels?.level3 || "Level 3",
    }),
    [retainerLevelLabels]
  );

  const [level1Label, setLevel1Label] = useState(normalizedLabels.level1);
  const [level2Label, setLevel2Label] = useState(normalizedLabels.level2);
  const [level3Label, setLevel3Label] = useState(normalizedLabels.level3);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newLevel, setNewLevel] = useState<RetainerUserLevel>(1);

  useEffect(() => {
    setLevel1Label(normalizedLabels.level1);
    setLevel2Label(normalizedLabels.level2);
    setLevel3Label(normalizedLabels.level3);
  }, [normalizedLabels.level1, normalizedLabels.level2, normalizedLabels.level3]);

  const effectiveCanManageUsers = canManageUsers && Boolean(currentRetainer);

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
          <ViewSeekersView
            wheelSeekers={sortedWheelSeekers}
            excellentSeekers={sortedExcellentSeekers}
            possibleSeekers={sortedPossibleSeekers}
            notNowSeekers={sortedNotNowSeekers}
            seekerSort={seekerSort}
            onChangeSeekerSort={setSeekerSort}
            scheduleMatchBySeekerId={scheduleMatchBySeekerId}
            onClassify={onClassifySeeker}
            onOpenProfile={onOpenProfile}
            onMessage={onMessage}
            retainerRoutes={retainerRoutes}
            canInteract={canInteract}
          />
        )}

        {actionTab === "lists" && (
          <div className="flex flex-col gap-6 min-h-0 flex-1 overflow-hidden">
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
              <h3 className="text-lg font-semibold text-slate-50 mb-1">Your Seeker lists</h3>
              <p className="text-sm text-slate-300">
                Save approved Seekers into Excellent, Possible, or Not now. Drag cards between lists and message directly.
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
                  onClick={onSelectAllSeekers}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={onClearSelectedSeekers}
                  disabled={selectedCount === 0}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={onBulkMessageSelected}
                  disabled={selectedCount === 0 || !retainerId || !canInteract}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  title={!retainerId ? "Select a Retainer profile first" : "Send one message to all selected"}
                >
                  Message all
                </button>
                <button
                  type="button"
                  onClick={onBulkRequestLinkSelected}
                  disabled={selectedCount === 0 || !retainerId || !canInteract}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-sky-500/15 border border-sky-500/40 text-sky-100 hover:bg-sky-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  title={!retainerId ? "Select a Retainer profile first" : "Request links for all selected"}
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
              <SeekerBucketPanel
                title="Excellent"
                color="emerald"
                seekers={sortedExcellentSeekers}
                bucketKey="excellent"
                selectedSeekerIds={selectedSeekerIds}
                onToggleSelectedSeeker={onToggleSelectedSeeker}
                onOpenProfile={onOpenProfile}
                onReturnToWheel={onReturnToWheel}
                onDropToBucket={onRebucketById}
                onMessage={onMessage}
                canInteract={canInteract}
                getScheduleMatch={getScheduleMatch}
              />
              <SeekerBucketPanel
                title="Possible"
                color="sky"
                seekers={sortedPossibleSeekers}
                bucketKey="possible"
                selectedSeekerIds={selectedSeekerIds}
                onToggleSelectedSeeker={onToggleSelectedSeeker}
                onOpenProfile={onOpenProfile}
                onReturnToWheel={onReturnToWheel}
                onDropToBucket={onRebucketById}
                onMessage={onMessage}
                canInteract={canInteract}
                getScheduleMatch={getScheduleMatch}
              />
              <SeekerBucketPanel
                title="Not now"
                color="rose"
                seekers={sortedNotNowSeekers}
                bucketKey="notNow"
                selectedSeekerIds={selectedSeekerIds}
                onToggleSelectedSeeker={onToggleSelectedSeeker}
                onOpenProfile={onOpenProfile}
                onReturnToWheel={onReturnToWheel}
                onDropToBucket={onRebucketById}
                onMessage={onMessage}
                canInteract={canInteract}
                getScheduleMatch={getScheduleMatch}
              />
            </div>
          </div>
        )}

        {actionTab === "routes" && (
          <RetainerRoutesView
            retainer={currentRetainer}
            seekers={seekers}
            canEdit={canInteract}
            noticeTick={noticeTick}
            onToast={onToast}
          />
        )}

        {actionTab === "schedule" && (
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 space-y-3 text-sm text-slate-300">
            <div className="text-xs uppercase tracking-wide text-slate-400">Scheduling</div>
            <div>
              Route schedules are managed per route. Update the schedule on each route to influence matching.
            </div>
            <button
              type="button"
              onClick={() => onChangeTab("routes")}
              className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
            >
              Go to routes
            </button>
          </div>
        )}

        {actionTab === "editProfile" && (
          <div className="space-y-4">
            <RetainerProfileForm
              mode={currentRetainer ? "edit" : "create"}
              initial={currentRetainer}
              onSaved={currentRetainer ? onRetainerUpdated : onRetainerCreated}
              readOnly={!canInteract}
            />
            <ChangePasswordPanel email={(currentRetainer as any)?.email ?? null} />
          </div>
        )}

        {actionTab === "addUsers" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
              <h3 className="text-lg font-semibold text-slate-50 mb-1">User access</h3>
              <p className="text-sm text-slate-300">
                Add team members and manage their permission levels.
              </p>
              <ul className="mt-2 text-xs text-slate-400 space-y-1">
                <li>Level 1: View-only access, internal notes, no external messaging.</li>
                <li>Level 2: Can post, broadcast, route, and message external Seekers.</li>
                <li>Level 3: Full access including user management and hierarchy edits.</li>
              </ul>

              {!effectiveCanManageUsers && (
                <div className="text-xs text-amber-300 mt-2">
                  View-only access. Level 3 required to manage users.
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Level labels</div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-xs text-slate-300">
                  <span>Level 1</span>
                  <input
                    value={level1Label}
                    onChange={(e) => setLevel1Label(e.target.value)}
                    disabled={!effectiveCanManageUsers}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </label>

                <label className="space-y-1 text-xs text-slate-300">
                  <span>Level 2</span>
                  <input
                    value={level2Label}
                    onChange={(e) => setLevel2Label(e.target.value)}
                    disabled={!effectiveCanManageUsers}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </label>

                <label className="space-y-1 text-xs text-slate-300">
                  <span>Level 3</span>
                  <input
                    value={level3Label}
                    onChange={(e) => setLevel3Label(e.target.value)}
                    disabled={!effectiveCanManageUsers}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() =>
                  onUpdateUserLabels({
                    level1: level1Label,
                    level2: level2Label,
                    level3: level3Label,
                  })
                }
                disabled={!effectiveCanManageUsers}
                className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Save labels
              </button>
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Add user</div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="First name"
                  disabled={!effectiveCanManageUsers}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <input
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="Last name"
                  disabled={!effectiveCanManageUsers}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title"
                  disabled={!effectiveCanManageUsers}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email"
                  disabled={!effectiveCanManageUsers}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Phone"
                  disabled={!effectiveCanManageUsers}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <select
                  value={newLevel}
                  onChange={(e) => setNewLevel(Number(e.target.value) as RetainerUserLevel)}
                  disabled={!effectiveCanManageUsers}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value={1}>{normalizedLabels.level1}</option>
                  <option value={2}>{normalizedLabels.level2}</option>
                  <option value={3}>{normalizedLabels.level3}</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!effectiveCanManageUsers) return;
                  onCreateUser({
                    firstName: newFirstName.trim() || "New",
                    lastName: newLastName.trim() || "User",
                    title: newTitle.trim() || undefined,
                    email: newEmail.trim() || undefined,
                    phone: newPhone.trim() || undefined,
                    level: newLevel,
                  });
                  setNewFirstName("");
                  setNewLastName("");
                  setNewTitle("");
                  setNewEmail("");
                  setNewPhone("");
                  setNewLevel(1);
                }}
                disabled={!effectiveCanManageUsers}
                className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Add user
              </button>
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-3">
                Current users
              </div>
              {retainerUsers.length === 0 ? (
                <div className="text-sm text-slate-400">No additional users yet.</div>
              ) : (
                <div className="space-y-3">
                  {retainerUsers.map((u) => (
                    <div
                      key={u.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-50">
                          {(u.firstName || "User") + " " + (u.lastName || "")}
                        </div>
                        <div className="text-xs text-slate-400">
                          {normalizedLabels[`level${u.level}` as keyof RetainerUserLevelLabels] ??
                            `Level ${u.level}`}
                          {u.email ? ` - ${u.email}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveUser(u.id)}
                        disabled={!effectiveCanManageUsers}
                        className="px-3 py-1 rounded-full text-[11px] bg-rose-500/15 border border-rose-500/40 text-rose-100 hover:bg-rose-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {actionTab === "hierarchy" && (
          !currentRetainer ? (
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
              Select or create a Retainer profile first.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
                <h3 className="text-lg font-semibold text-slate-50 mb-1">Hierarchy</h3>
                <p className="text-sm text-slate-300">
                  Map reporting lines and responsibilities for your team.
                </p>
                {!effectiveCanManageUsers && (
                  <div className="text-xs text-amber-300 mt-2">
                    View-only access. Level 3 required to edit the hierarchy.
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 min-h-[520px]">
                <Suspense
                  fallback={
                    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-400">
                      Loading hierarchy?
                    </div>
                  }
                >
                  <LazyHierarchyCanvas
                    owner={{
                      id: String((currentRetainer as any).id),
                      name: formatRetainerName(currentRetainer),
                      title:
                        (currentRetainer as any)?.companyName ||
                        (currentRetainer as any)?.name ||
                        "Retainer",
                      meta: (currentRetainer as any)?.email || undefined,
                      photoUrl:
                        (currentRetainer as any)?.logoUrl ||
                        (currentRetainer as any)?.photoUrl ||
                        (currentRetainer as any)?.profileImageUrl ||
                        undefined,
                    }}
                    items={retainerUsers.map((u) => ({
                      id: u.id,
                      name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User",
                      title: u.title || normalizedLabels[`level${u.level}` as keyof RetainerUserLevelLabels],
                      meta: u.email || u.phone || undefined,
                      photoUrl: (u as any).photoUrl || (u as any).avatarUrl || undefined,
                    }))}
                    nodes={(currentRetainer as any)?.hierarchyNodes ?? []}
                    onNodesChange={onUpdateHierarchyNodes}
                    readOnly={!effectiveCanManageUsers}
                    showList
                    emptyHint="Add users to start building your org chart."
                  />
                </Suspense>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

const SeekerBucketPanel: React.FC<{

  title: string;

  color: "emerald" | "sky" | "rose";

  seekers: Seeker[];

  bucketKey: SeekerBucketKey;

  selectedSeekerIds: Set<string>;

  onToggleSelectedSeeker: (seekerId: string) => void;

  onOpenProfile: (s: Seeker) => void;

  onReturnToWheel: (s: Seeker) => void;

  onDropToBucket: (seekerId: string, targetBucket: SeekerBucketKey) => void;

  onMessage: (s: Seeker) => void;

  canInteract?: boolean;

  getScheduleMatch?: (seekerId: string) => ScheduleMatch | undefined;

}> = ({

  title,

  color,

  seekers,

  bucketKey,

  selectedSeekerIds,

  onToggleSelectedSeeker,

  onOpenProfile,

  onReturnToWheel,

  onDropToBucket,

  onMessage,

  canInteract = true,

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

    if (!canInteract) return;

    e.preventDefault();

    const id = e.dataTransfer.getData("application/x-seeker-id");

    if (!id) return;

    onDropToBucket(id, bucketKey);

  };

  return (

    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col min-h-0 h-full">

      <div className="px-4 pt-3 pb-2 border-b border-slate-800 flex items-center justify-between">

        <div>

          <div className={`text-xs uppercase tracking-wide ${c.label} font-semibold`}>{title}</div>

          <div className="text-[11px] text-slate-500">

            {seekers.length} saved {seekers.length === 1 ? "driver" : "drivers"}

          </div>

        </div>

      </div>

      <div

        className="px-3 pb-3 pt-2 flex-1 min-h-0 overflow-y-auto space-y-2"

        onDragOver={(e) => {

          if (!canInteract) return;

          e.preventDefault();

          e.dataTransfer.dropEffect = "move";

        }}

        onDrop={handleDrop}

      >

        {seekers.length === 0 ? (

          <div className="text-xs text-slate-500 mt-1">

            Nothing here yet. Spin the wheel and sort a few Seekers, or drag one here from another list.

          </div>

        ) : (

          seekers.map((s: any) => {

            const name = formatSeekerName(s);

            const match = getScheduleMatch ? getScheduleMatch(String(s.id)) : undefined;

            const city = s.city ?? "-";

            const state = s.state ?? "-";

            return (

              <div

                key={s.id}

                draggable={canInteract}

                onDragStart={(e) => {

                  if (!canInteract) return;

                  e.dataTransfer.setData("application/x-seeker-id", s.id);

                  e.dataTransfer.effectAllowed = "move";

                }}

                onClick={() => onOpenProfile(s)}

                className={`rounded-xl border ${c.border} bg-slate-950/80 px-3 py-2 text-xs flex flex-col gap-1 cursor-pointer hover:bg-slate-900/80 transition`}

              >

                <div className="flex items-center justify-between gap-2">

                  <div>

                    <div className="font-semibold text-slate-50 truncate">{name}</div>

                    <div className="text-[11px] text-slate-400">

                      {city !== "-" || state !== "-" ? `${city}, ${state}` : "Location not set"}

                    </div>

                    {match && match.percent > 0 && (

                      <div className="text-[11px] text-slate-400">

                        Schedule match:{" "}

                        <span className="text-slate-200 font-medium">{match.percent}%</span>

                        {match.overlapDays.length > 0 && (

                          <span className="text-slate-500">

                            {" "}

                            - {formatDaysShort(match.overlapDays)}

                          </span>

                        )}

                      </div>

                    )}

                  </div>

                  <div className="flex items-center gap-2">

                    <label

                      className="inline-flex items-center"

                      onClick={(e) => e.stopPropagation()}

                      title="Select for bulk actions"

                    >

                      <input

                        type="checkbox"

                        checked={selectedSeekerIds.has(String(s.id))}

                        onChange={() => onToggleSelectedSeeker(String(s.id))}

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

                      onReturnToWheel(s);

                    }}

                    disabled={!canInteract}

                    className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"

                  >

                    Return to wheel

                  </button>

                  <button

                    type="button"

                    onClick={(e) => {

                      e.stopPropagation();

                      onMessage(s);

                    }}

                    disabled={!canInteract}

                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${c.button} transition disabled:opacity-60 disabled:cursor-not-allowed`}

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

/* View Seekers - vertical wheel                                      */

/* ------------------------------------------------------------------ */

const ViewSeekersView: React.FC<{
  wheelSeekers: Seeker[];
  excellentSeekers: Seeker[];
  possibleSeekers: Seeker[];
  notNowSeekers: Seeker[];
  seekerSort: "default" | "match";
  onChangeSeekerSort: (value: "default" | "match") => void;
  scheduleMatchBySeekerId: Map<string, ScheduleMatch>;
  onClassify: (seeker: Seeker, bucket: SeekerBucketKey) => void;
  onOpenProfile: (seeker: Seeker) => void;
  onMessage: (seeker: Seeker) => void;
  retainerRoutes: Route[];
  canInteract?: boolean;
}> = ({
  wheelSeekers,
  excellentSeekers,
  possibleSeekers,
  notNowSeekers,
  seekerSort,
  onChangeSeekerSort,
  scheduleMatchBySeekerId,
  onClassify,
  onOpenProfile,
  onMessage,
  retainerRoutes,
  canInteract = true,
}) => {
  const [centerIndex, setCenterIndex] = useState(0);
  const wheelAccumulatorRef = useRef(0);
  const [expandedSeeker, setExpandedSeeker] = useState<Seeker | null>(null);

  const activeRoutes = useMemo(
    () => (retainerRoutes || []).filter((r) => r.status === "ACTIVE"),
    [retainerRoutes]
  );

  const sortedWheelSeekers = wheelSeekers;
  const sortedExcellentSeekers = excellentSeekers;
  const sortedPossibleSeekers = possibleSeekers;
  const sortedNotNowSeekers = notNowSeekers;

  useEffect(() => {
    if (sortedWheelSeekers.length === 0) setCenterIndex(0);
    else setCenterIndex((prev) => Math.max(0, Math.min(prev, sortedWheelSeekers.length - 1)));
  }, [sortedWheelSeekers.length]);

  const goToNext = (direction: number) => {
    if (sortedWheelSeekers.length === 0) return;
    const nextIndex =
      (centerIndex + direction + sortedWheelSeekers.length) % sortedWheelSeekers.length;
    if (nextIndex === centerIndex) return;
    setCenterIndex(nextIndex);
  };

  const handleClassifyCurrent = (bucket: SeekerBucketKey) => {
    if (!currentSeeker) return;
    onClassify(currentSeeker, bucket);
  };

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (sortedWheelSeekers.length === 0) return;
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

  useEffect(() => {
    if (!expandedSeeker) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedSeeker(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedSeeker]);

  const currentSeeker = sortedWheelSeekers[centerIndex] ?? null;
  const nextSeeker =
    sortedWheelSeekers.length > 1
      ? sortedWheelSeekers[(centerIndex + 1) % sortedWheelSeekers.length]
      : null;
  const prevPeek =
    sortedWheelSeekers.length > 1
      ? sortedWheelSeekers[
          (centerIndex - 1 + sortedWheelSeekers.length) % sortedWheelSeekers.length
        ]
      : null;
  const nextPeek = nextSeeker;
  const remaining = Math.max(0, sortedWheelSeekers.length - centerIndex - 1);

    const renderPeekCard = (s: Seeker) => {
    const name = formatSeekerName(s);
    const city = (s as any).city ?? "-";
    const state = (s as any).state ?? "-";
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <ProfileAvatar role="SEEKER" profile={s} name={name} size="sm" />
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

  const renderRailCard = (s: Seeker, tone: keyof typeof railTone) => {
    const name = formatSeekerName(s);
    const city = (s as any).city ?? "-";
    const state = (s as any).state ?? "-";
    return (
      <div className={`rounded-2xl bg-slate-900/80 border px-4 py-3 ${railTone[tone]}`}>
        <div className="flex items-center gap-3 min-w-0">
          <ProfileAvatar role="SEEKER" profile={s} name={name} size="sm" />
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
          <h3 className="text-lg font-semibold text-slate-50">Approved Seekers</h3>
          <p className="text-xs text-slate-400">
            Scroll to browse one profile at a time. Click to open the full profile, or sort them into your lists.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-300">
            <span className="text-slate-400">Sort</span>
            <select
              value={seekerSort}
              onChange={(e) => onChangeSeekerSort(e.target.value as "default" | "match")}
              className="bg-transparent text-[11px] text-slate-100 focus:outline-none"
            >
              <option value="default">Default order</option>
              <option value="match">Schedule match</option>
            </select>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-300">
            Scroll to browse ? Click to expand
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
        <span>
          Profile {sortedWheelSeekers.length === 0 ? 0 : centerIndex + 1} of{" "}
          {sortedWheelSeekers.length}
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

          {currentSeeker && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full max-w-md">
              <SeekerWheelCard
                seeker={currentSeeker}
                isCenter={true}
                onOpenProfile={() => setExpandedSeeker(currentSeeker)}
                onMessage={() => onMessage(currentSeeker)}
                onClassify={(bucket) => handleClassifyCurrent(bucket)}
                canInteract={canInteract}
                scheduleMatch={scheduleMatchBySeekerId.get(String(currentSeeker.id))}
              />
            </div>
          )}

          {!currentSeeker && (
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
            <div className="text-[11px] text-emerald-100 mt-1">{sortedExcellentSeekers.length} saved</div>
            <div className="mt-2 space-y-2 overflow-y-auto pr-1">
              {sortedExcellentSeekers.map((s) => (
                <div key={s.id}>{renderRailCard(s, "emerald")}</div>
              ))}
            </div>
          </div>

          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3 py-3 h-[28%] flex flex-col">
            <div className="text-xs uppercase tracking-wide text-sky-200">Possible</div>
            <div className="text-[11px] text-sky-100 mt-1">{sortedPossibleSeekers.length} saved</div>
            <div className="mt-2 space-y-2 overflow-y-auto pr-1">
              {sortedPossibleSeekers.map((s) => (
                <div key={s.id}>{renderRailCard(s, "sky")}</div>
              ))}
            </div>
          </div>

          <div className="absolute left-0 right-0 bottom-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 h-[28%] flex flex-col">
            <div className="text-xs uppercase tracking-wide text-rose-200">Not now</div>
            <div className="text-[11px] text-rose-100 mt-1">{sortedNotNowSeekers.length} saved</div>
            <div className="mt-2 space-y-2 overflow-y-auto pr-1">
              {sortedNotNowSeekers.map((s) => (
                <div key={s.id}>{renderRailCard(s, "rose")}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {expandedSeeker && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setExpandedSeeker(null)}
          />
          <div className="relative h-full w-full p-6 md:p-10 flex items-center justify-center overflow-y-auto">
            <div role="dialog" aria-modal="true" className="w-full max-w-5xl">
              <SeekerWheelExpandedCard
                seeker={expandedSeeker}
                scheduleMatch={scheduleMatchBySeekerId.get(String(expandedSeeker.id))}
                activeRoutes={activeRoutes}
                canInteract={canInteract}
                onClose={() => setExpandedSeeker(null)}
                onOpenFullProfile={() => {
                  onOpenProfile(expandedSeeker);
                  setExpandedSeeker(null);
                }}
                onMessage={() => {
                  onMessage(expandedSeeker);
                  setExpandedSeeker(null);
                }}
                onClassify={(bucket) => {
                  onClassify(expandedSeeker, bucket);
                  setExpandedSeeker(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SeekerWheelCard: React.FC<{

  seeker: Seeker;

  style?: CSSProperties;

  isCenter: boolean;

  scheduleMatch?: ScheduleMatch;

  onOpenProfile: () => void;

  onMessage: () => void;

  onClassify: (bucket: SeekerBucketKey) => void;

  canInteract?: boolean;

}> = ({ seeker, style, isCenter, scheduleMatch, onOpenProfile, onMessage, onClassify, canInteract = true }) => {

  const s: any = seeker as any;

  const name = formatSeekerName(seeker);

  const city = s.city ?? "-";

  const state = s.state ?? "-";

  const verts: string[] = Array.isArray(s.deliveryVerticals) ? s.deliveryVerticals : [];

  const photoUrl = getSeekerPhotoUrl(seeker);
  const introVideoUrl =
    s.introVideoStatus === "APPROVED" ? s.introVideoUrl : undefined;

  const reputation = getReputationScoreForProfile({

    ownerRole: "SEEKER",

    ownerId: String(seeker.id),

  });

  const topBadges = getBadgeSummaryForProfile({

    ownerRole: "SEEKER",

    ownerId: String(seeker.id),

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

        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950/60 h-20 sm:h-24 md:h-28 lg:h-32 xl:h-36 w-full flex items-center justify-center">

          {introVideoUrl ? (

            <video
              src={introVideoUrl}
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
              poster={photoUrl}
              className="h-full w-full object-cover"
            />

          ) : photoUrl ? (

            <img src={photoUrl} alt={name} className="h-full w-full object-cover" />

          ) : (

            <div className="text-xs text-slate-400">No media</div>

          )}

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

            {city !== "-" || state !== "-" ? `${city}, ${state}` : "Location not set"}

          </div>

        </div>

        <button

          type="button"

          title="Message"

          onClick={(e) => {

            e.stopPropagation();

            if (!canInteract) return;

            onMessage();

          }}

          disabled={!canInteract}

          className={[

            "h-8 w-8 rounded-full border flex items-center justify-center transition",

            canInteract

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
                {reputation.score == null ? "Reputation -" : `Reputation ${reputation.score}`}
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
                <span className="text-emerald-200/70">- {formatDaysShort(scheduleMatch.overlapDays)}</span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/30 px-2 py-0.5 text-[10px] text-slate-400">
              {badgeIconFor("clock", "h-3.5 w-3.5")}
              Schedule -
            </span>
          )}
        </div>
      </div>

      {topBadges.length > 0 && (

        <div className="mt-2 flex items-center justify-between gap-3">

          <div className="flex items-center gap-1.5">

            {topBadges.map((b) => (

              <span

                key={b.badge.id}

                title={`${b.badge.title} - Level ${b.maxLevel}\n${b.badge.description}`}

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

              {verts.slice(0, 2).join(" - ")}

              {verts.length > 2 ? ` - +${verts.length - 2}` : ""}

            </div>

          )}

        </div>

      )}

      {topBadges.length === 0 && verts.length > 0 && (

        <div className="flex flex-wrap gap-1 mt-2">

          {verts.slice(0, 3).map((v) => (

            <span

              key={v}

              className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">

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

              if (!canInteract) return;

              onClassify("excellent");

            }}

            disabled={!canInteract}

            className="px-3 py-1 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-100 border border-emerald-500/50 hover:bg-emerald-500/30 transition disabled:opacity-60 disabled:cursor-not-allowed"

          >

            Excellent

          </button>

          <button

            type="button"

            onClick={(e) => {

              e.stopPropagation();

              if (!canInteract) return;

              onClassify("possible");

            }}

            disabled={!canInteract}

            className="px-3 py-1 rounded-full text-[11px] font-medium bg-sky-500/15 text-sky-100 border border-sky-500/40 hover:bg-sky-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"

          >

            Possible

          </button>

          <button

            type="button"

            onClick={(e) => {

              e.stopPropagation();

              if (!canInteract) return;

              onClassify("notNow");

            }}

            disabled={!canInteract}

            className="px-3 py-1 rounded-full text-[11px] font-medium bg-rose-500/15 text-rose-100 border border-rose-500/40 hover:bg-rose-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"

          >

            Not now

          </button>

        </div>

      </div>

    </div>

  );

};

/* ------------------------------------------------------------------ */

/* Compose pop-out from dashboard (Retainer -> Seeker)                */

/* ------------------------------------------------------------------ */

const ComposeMessagePopover: React.FC<{

  seeker: Seeker;

  retainer: Retainer;

  onClose: () => void;

}> = ({ seeker, retainer, onClose }) => {

  const [subject, setSubject] = useState("");

  const [body, setBody] = useState("");

  const [sending, setSending] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);

  const handleSend = () => {

    setError(null);

    setSuccess(null);

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

      createConversationWithFirstMessage({

        seekerId: (seeker as any).id,

        retainerId: (retainer as any).id,

        subject,

        body,

        senderRole: "RETAINER",

      });

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

            <div className="text-sm font-semibold text-slate-50">{formatSeekerName(seeker)}</div>

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

              placeholder="Introduce your company and what you-re looking for-"

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

            {sending ? "Sending..." : "Send"}

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
          <div className="text-sm font-semibold text-slate-50">{count} seekers</div>
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
              placeholder="Introduce your company and what you-re looking for-"
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

/* Messaging Center - Rails + Search + Persist selection              */

/* ------------------------------------------------------------------ */

const MessagingCenterView: React.FC<{

  currentRetainer?: Retainer;

  seekers: Seeker[];

  retainerUsers: RetainerUser[];

  activeRetainerUser?: RetainerUser;

  canSendExternal?: boolean;

  canSendInternal?: boolean;

}> = ({

  currentRetainer,

  seekers,

  retainerUsers,

  activeRetainerUser,

  canSendExternal,

  canSendInternal,

}) => {

  void retainerUsers;

  void activeRetainerUser;

  void canSendExternal;

  void canSendInternal;

  return (

    <Suspense fallback={<div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-400">Loading messages?</div>}>
      <LazyRetainerMessagingCenter currentRetainer={currentRetainer} seekers={seekers} />
    </Suspense>

  );

};

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */

/* Retainer profile form                                              */

/* ------------------------------------------------------------------ */

type RetainerProfileFormProps = {

  mode: "create" | "edit";

  initial?: Retainer;

  onSaved: (id?: string) => void;

  readOnly?: boolean;

};

type RetainerProfileEditPageKey =

  | "core"

  | "company"

  | "preferences"

  | "photos";

const RetainerProfileForm: React.FC<RetainerProfileFormProps> = ({

  mode,

  initial,

  onSaved,

  readOnly = false,

}) => {

  const isEdit = mode === "edit";

  const [activePage, setActivePage] = useState<RetainerProfileEditPageKey>("core");

  const [companyName, setCompanyName] = useState((initial as any)?.companyName ?? "");

  const [ceoName, setCeoName] = useState((initial as any)?.ceoName ?? "");

  const [email, setEmail] = useState((initial as any)?.email ?? "");

  const [phone, setPhone] = useState((initial as any)?.phone ?? "");

  const [city, setCity] = useState((initial as any)?.city ?? "");

  const [stateCode, setStateCode] = useState((initial as any)?.state ?? "FL");

  const [zip, setZip] = useState((initial as any)?.zip ?? "");

  const [yearsInBusiness, setYearsInBusiness] = useState(

    (initial as any)?.yearsInBusiness != null ? String((initial as any).yearsInBusiness) : ""

  );

  const [employees, setEmployees] = useState(

    (initial as any)?.employees != null ? String((initial as any).employees) : ""

  );

  const [mission, setMission] = useState((initial as any)?.mission ?? "");

  const [selectedVerticals, setSelectedVerticals] = useState<string[]>(

    (initial as any)?.deliveryVerticals ?? []

  );

  const [selectedTraits, setSelectedTraits] = useState<string[]>(

    (initial as any)?.desiredTraits ?? []

  );

  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm>(

    (initial as any)?.paymentTerms ?? PAYMENT_TERMS[0].value

  );

  const [payCycleCloseDay, setPayCycleCloseDay] = useState<DayOfWeek>(
    (initial as any)?.payCycleCloseDay ?? "FRI"
  );
  const [payCycleFrequency, setPayCycleFrequency] = useState<PayCycleFrequency>(
    (initial as any)?.payCycleFrequency ?? PAY_CYCLE_FREQUENCIES[0].value
  );

  const [logoUrl, setLogoUrl] = useState(

    (initial as any)?.logoUrl ?? (initial as any)?.photoUrl ?? (initial as any)?.profileImageUrl ?? ""

  );

  const [introVideoUrl, setIntroVideoUrl] = useState(
    (initial as any)?.introVideoUrl ?? ""
  );
  const [introVideoStatus, setIntroVideoStatus] = useState<
    VideoApprovalStatus | undefined
  >((initial as any)?.introVideoStatus ?? undefined);
  const [introVideoSubmittedAt, setIntroVideoSubmittedAt] = useState<
    string | undefined
  >((initial as any)?.introVideoSubmittedAt ?? undefined);
  const [introVideoApprovedAt, setIntroVideoApprovedAt] = useState<
    string | undefined
  >((initial as any)?.introVideoApprovedAt ?? undefined);
  const [introVideoApprovedBy, setIntroVideoApprovedBy] = useState<
    string | undefined
  >((initial as any)?.introVideoApprovedBy ?? undefined);
  const [introVideoApprovedByEmail, setIntroVideoApprovedByEmail] = useState<
    string | undefined
  >((initial as any)?.introVideoApprovedByEmail ?? undefined);
  const [introVideoRejectedAt, setIntroVideoRejectedAt] = useState<
    string | undefined
  >((initial as any)?.introVideoRejectedAt ?? undefined);
  const [introVideoRejectedBy, setIntroVideoRejectedBy] = useState<
    string | undefined
  >((initial as any)?.introVideoRejectedBy ?? undefined);
  const [introVideoRejectedByEmail, setIntroVideoRejectedByEmail] = useState<
    string | undefined
  >((initial as any)?.introVideoRejectedByEmail ?? undefined);
  const [introVideoDurationSec, setIntroVideoDurationSec] = useState<
    number | undefined
  >((initial as any)?.introVideoDurationSec ?? undefined);
  const [introVideoSizeBytes, setIntroVideoSizeBytes] = useState<
    number | undefined
  >((initial as any)?.introVideoSizeBytes ?? undefined);
  const [introVideoMime, setIntroVideoMime] = useState<string | undefined>(
    (initial as any)?.introVideoMime ?? undefined
  );

  const [companyPhotoUrl, setCompanyPhotoUrl] = useState(

    (initial as any)?.companyPhotoUrl ?? (initial as any)?.imageUrl ?? ""

  );

  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const next = initial as any;
    setActivePage("core");
    setCompanyName(next?.companyName ?? "");
    setCeoName(next?.ceoName ?? "");
    setEmail(next?.email ?? "");
    setPhone(next?.phone ?? "");
    setCity(next?.city ?? "");
    setStateCode(next?.state ?? "FL");
    setZip(next?.zip ?? "");
    setYearsInBusiness(
      next?.yearsInBusiness != null ? String(next.yearsInBusiness) : ""
    );
    setEmployees(next?.employees != null ? String(next.employees) : "");
    setMission(next?.mission ?? "");
    setSelectedVerticals(next?.deliveryVerticals ?? []);
    setSelectedTraits(next?.desiredTraits ?? []);
    setPaymentTerms(next?.paymentTerms ?? PAYMENT_TERMS[0].value);
    setPayCycleCloseDay(next?.payCycleCloseDay ?? "FRI");
    setPayCycleFrequency(next?.payCycleFrequency ?? PAY_CYCLE_FREQUENCIES[0].value);
    setLogoUrl(next?.logoUrl ?? next?.photoUrl ?? next?.profileImageUrl ?? "");
    setIntroVideoUrl(next?.introVideoUrl ?? "");
    setIntroVideoStatus(next?.introVideoStatus ?? undefined);
    setIntroVideoSubmittedAt(next?.introVideoSubmittedAt ?? undefined);
    setIntroVideoApprovedAt(next?.introVideoApprovedAt ?? undefined);
    setIntroVideoApprovedBy(next?.introVideoApprovedBy ?? undefined);
    setIntroVideoApprovedByEmail(next?.introVideoApprovedByEmail ?? undefined);
    setIntroVideoRejectedAt(next?.introVideoRejectedAt ?? undefined);
    setIntroVideoRejectedBy(next?.introVideoRejectedBy ?? undefined);
    setIntroVideoRejectedByEmail(next?.introVideoRejectedByEmail ?? undefined);
    setIntroVideoDurationSec(next?.introVideoDurationSec ?? undefined);
    setIntroVideoSizeBytes(next?.introVideoSizeBytes ?? undefined);
    setIntroVideoMime(next?.introVideoMime ?? undefined);
    setCompanyPhotoUrl(next?.companyPhotoUrl ?? next?.imageUrl ?? "");
    setError(null);
    setSuccessMsg(null);
  }, [initial?.id, mode]);

  const pages: { key: RetainerProfileEditPageKey; label: string }[] = [

    { key: "core", label: "Profile 1: Core" },

    { key: "company", label: "Profile 2: Company" },

    { key: "preferences", label: "Profile 3: Preferences" },

    { key: "photos", label: "Profile 4: My Media" },

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

  const toggleVertical = (v: string) => {

    setSelectedVerticals((prev) =>

      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]

    );

  };

  const toggleTrait = (t: string) => {

    setSelectedTraits((prev) =>

      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]

    );

  };
  const handlePhotoFile = async (
    file: File | null,
    setter: (value: string) => void
  ) => {
    if (!file || readOnly) return;
    try {
      setError(null);
      const url = await uploadImageWithFallback(file, MAX_IMAGE_BYTES);
      setter(url);
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    }
  };

  const updateIntroVideo = (patch: {
    introVideoUrl?: string;
    introVideoStatus?: VideoApprovalStatus;
    introVideoSubmittedAt?: string;
    introVideoDurationSec?: number;
    introVideoSizeBytes?: number;
    introVideoMime?: string;
  }) => {
    if ("introVideoUrl" in patch) setIntroVideoUrl(patch.introVideoUrl ?? "");
    if ("introVideoStatus" in patch) setIntroVideoStatus(patch.introVideoStatus);
    if ("introVideoSubmittedAt" in patch) {
      setIntroVideoSubmittedAt(patch.introVideoSubmittedAt);
    }
    if ("introVideoDurationSec" in patch) {
      setIntroVideoDurationSec(patch.introVideoDurationSec);
    }
    if ("introVideoSizeBytes" in patch) {
      setIntroVideoSizeBytes(patch.introVideoSizeBytes);
    }
    if ("introVideoMime" in patch) {
      setIntroVideoMime(patch.introVideoMime);
    }

    if (patch.introVideoStatus === "PENDING") {
      setIntroVideoApprovedAt(undefined);
      setIntroVideoApprovedBy(undefined);
      setIntroVideoApprovedByEmail(undefined);
      setIntroVideoRejectedAt(undefined);
      setIntroVideoRejectedBy(undefined);
      setIntroVideoRejectedByEmail(undefined);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {

    e.preventDefault();

    setError(null);

    setSuccessMsg(null);

    if (readOnly) return;

    if (!companyName.trim()) {

      setError("Company name is required.");

      return;

    }

    try {

      setSubmitting(true);

      const payload: any = {

        companyName: companyName.trim(),

        ceoName: ceoName.trim() || undefined,

        email: email.trim() || undefined,

        phone: phone.trim() || undefined,

        city: city.trim() || undefined,

        state: stateCode || undefined,

        zip: zip.trim() || undefined,

        yearsInBusiness: yearsInBusiness ? Number(yearsInBusiness) : undefined,

        employees: employees ? Number(employees) : undefined,

        mission: mission.trim() || undefined,

        deliveryVerticals: selectedVerticals.length ? selectedVerticals : undefined,

        desiredTraits: selectedTraits.length ? selectedTraits : undefined,

        paymentTerms: paymentTerms || undefined,
        payCycleCloseDay: payCycleCloseDay || undefined,
        payCycleFrequency: payCycleFrequency || undefined,
        payCycleTimezone: "EST",

        logoUrl: logoUrl.trim() || undefined,
        introVideoUrl: introVideoUrl.trim() || undefined,
        introVideoStatus: introVideoStatus || undefined,
        introVideoSubmittedAt: introVideoSubmittedAt || undefined,
        introVideoApprovedAt: introVideoApprovedAt || undefined,
        introVideoApprovedBy: introVideoApprovedBy || undefined,
        introVideoApprovedByEmail: introVideoApprovedByEmail || undefined,
        introVideoRejectedAt: introVideoRejectedAt || undefined,
        introVideoRejectedBy: introVideoRejectedBy || undefined,
        introVideoRejectedByEmail: introVideoRejectedByEmail || undefined,
        introVideoDurationSec: introVideoDurationSec ?? undefined,
        introVideoSizeBytes: introVideoSizeBytes ?? undefined,
        introVideoMime: introVideoMime || undefined,

        companyPhotoUrl: companyPhotoUrl.trim() || undefined,

      };

      if (isEdit) {

        if (!initial) {

          setError("No existing profile to update.");

          return;

        }

        const updated: any = { ...(initial as any), ...payload };

        if (isServerAuthoritative()) {
          try {
            await syncUpsert({ retainers: [updated] });
          } catch (err: any) {
            setError(err?.message || "Server save failed. Please try again.");
            return;
          }
        }
        updateRetainerInStorage(updated);

        setSuccessMsg("Profile updated.");

        onSaved(updated.id);

      } else {

        const created = buildRetainerRecord({ ...(payload as any), status: "PENDING" });
        if (isServerAuthoritative()) {
          try {
            await syncUpsert({ retainers: [created] });
          } catch (err: any) {
            setError(err?.message || "Server save failed. Please try again.");
            return;
          }
        }
        upsertRetainerRecord(created);

        setSuccessMsg("Profile created and set to Pending.");

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

            {isEdit ? "Edit Retainer Profile" : "Create Retainer Profile"}

          </h3>

          <p className="text-sm text-slate-400 mt-1">

            {pages[safeIndex]?.label} - scroll, use arrows, or click a page.

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

            {"<"}

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

            {">"}

          </button>

        </div>

      </div>

      {readOnly && (

        <div className="text-xs text-amber-300">

          View-only access. Editing is disabled for this user.

        </div>

      )}

      <div className="flex flex-wrap gap-2">

        {pages.map((p, idx) => {

          const isActive = idx === safeIndex;

          return (

            <button

              key={p.key}

              type="button"

              onClick={() => setActivePage(p.key)}

              className={[

                "px-3 py-1.5 rounded-full text-xs border transition",

                isActive

                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"

                  : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800",

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

          <div className="grid gap-4 md:grid-cols-2">

            <div className="space-y-1">

              <label className="text-xs font-medium text-slate-200">Company name</label>

              <input

                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                value={companyName}

                onChange={(e) => setCompanyName(e.target.value)}

                placeholder="Company name"

                disabled={readOnly}

              />

            </div>

            <div className="space-y-1">

              <label className="text-xs font-medium text-slate-200">Owner name</label>

              <input

                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                value={ceoName}

                onChange={(e) => setCeoName(e.target.value)}

                placeholder="Owner name"

                disabled={readOnly}

              />

            </div>

            <div className="space-y-1">

              <label className="text-xs font-medium text-slate-200">Email</label>

              <input

                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                value={email}

                onChange={(e) => setEmail(e.target.value)}

                placeholder="name@company.com"

                disabled={readOnly}

              />

            </div>

            <div className="space-y-1">

              <label className="text-xs font-medium text-slate-200">Phone</label>

              <input

                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                value={phone}

                onChange={(e) => setPhone(e.target.value)}

                placeholder="(555) 555-5555"

                disabled={readOnly}

              />

            </div>

            <div className="space-y-1">

              <label className="text-xs font-medium text-slate-200">City</label>

              <input

                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                value={city}

                onChange={(e) => setCity(e.target.value)}

                disabled={readOnly}

              />

            </div>

            <div className="space-y-1">

              <label className="text-xs font-medium text-slate-200">State</label>

              <select

                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                value={stateCode}

                onChange={(e) => setStateCode(e.target.value)}

                disabled={readOnly}

              >

                {US_STATES.map((st) => (

                  <option key={st} value={st} className="bg-slate-900 text-slate-50">

                    {st}

                  </option>

                ))}

              </select>

            </div>

            <div className="space-y-1">

              <label className="text-xs font-medium text-slate-200">Zip</label>

              <input

                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                value={zip}

                onChange={(e) => setZip(e.target.value)}

                disabled={readOnly}

              />

            </div>

          </div>

        )}

        {activePage === "company" && (

          <div className="space-y-4">

            <div className="grid gap-4 md:grid-cols-2">

              <div className="space-y-1">

                <label className="text-xs font-medium text-slate-200">Years in business</label>

                <input

                  type="number"

                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                  value={yearsInBusiness}

                  onChange={(e) => setYearsInBusiness(e.target.value)}

                  min={0}

                  disabled={readOnly}

                />

              </div>

              <div className="space-y-1">

                <label className="text-xs font-medium text-slate-200">Number of employees</label>

                <input

                  type="number"

                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                  value={employees}

                  onChange={(e) => setEmployees(e.target.value)}

                  min={0}

                  disabled={readOnly}

                />

              </div>

            </div>

            <div className="space-y-1">

              <label className="text-xs font-medium text-slate-200">Mission statement</label>

              <textarea

                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[90px]"

                value={mission}

                onChange={(e) => setMission(e.target.value)}

                placeholder="Share a brief mission statement drivers will see"

                disabled={readOnly}

              />

            </div>

          </div>

        )}

        {activePage === "preferences" && (

          <div className="space-y-4">

            <div>

              <div className="text-xs font-medium text-slate-200">Delivery verticals</div>

              <div className="mt-2 flex flex-wrap gap-2">

                {DELIVERY_VERTICALS.map((v) => {

                  const active = selectedVerticals.includes(v);

                  return (

                    <button

                      key={v}

                      type="button"

                      disabled={readOnly}

                      onClick={() => toggleVertical(v)}

                      className={[

                        "px-3 py-1.5 rounded-full text-xs border transition",

                        active

                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"

                          : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800",

                        readOnly ? "opacity-60 cursor-not-allowed" : "",

                      ].join(" ")}

                    >

                      {v}

                    </button>

                  );

                })}

              </div>

            </div>

            <div>

              <div className="text-xs font-medium text-slate-200">Desired traits</div>

              <div className="mt-2 flex flex-wrap gap-2">

                {TRAITS.map((t) => {

                  const active = selectedTraits.includes(t);

                  return (

                    <button

                      key={t}

                      type="button"

                      disabled={readOnly}

                      onClick={() => toggleTrait(t)}

                      className={[

                        "px-3 py-1.5 rounded-full text-xs border transition",

                        active

                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"

                          : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800",

                        readOnly ? "opacity-60 cursor-not-allowed" : "",

                      ].join(" ")}

                    >

                      {t}

                    </button>

                  );

                })}

              </div>

            </div>

            <div className="space-y-1">

              <label className="text-xs font-medium text-slate-200">Payment terms</label>

              <select

                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                value={paymentTerms}

                onChange={(e) => setPaymentTerms(e.target.value as PaymentTerm)}

                disabled={readOnly}

              >

                {PAYMENT_TERMS.map((term) => (

                  <option key={term.value} value={term.value} className="bg-slate-900 text-slate-50">

                    {term.label}

                  </option>

                ))}

              </select>

            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">Pay cycle close day (EST)</label>
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={payCycleCloseDay}
                  onChange={(e) => setPayCycleCloseDay(e.target.value as DayOfWeek)}
                  disabled={readOnly}
                >
                  {DAYS.map((day) => (
                    <option key={day.key} value={day.key} className="bg-slate-900 text-slate-50">
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">Pay cycle frequency</label>
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={payCycleFrequency}
                  onChange={(e) => setPayCycleFrequency(e.target.value as PayCycleFrequency)}
                  disabled={readOnly}
                >
                  {PAY_CYCLE_FREQUENCIES.map((freq) => (
                    <option key={freq.value} value={freq.value} className="bg-slate-900 text-slate-50">
                      {freq.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>

        )}

        {activePage === "photos" && (

          <div className="space-y-4">
            <ProfileVideoSection
              introVideoUrl={introVideoUrl}
              introVideoStatus={introVideoStatus}
              introVideoSubmittedAt={introVideoSubmittedAt}
              introVideoDurationSec={introVideoDurationSec}
              introVideoSizeBytes={introVideoSizeBytes}
              introVideoMime={introVideoMime}
              onUpdate={updateIntroVideo}
              readOnly={readOnly}
            />

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">

              <div className="text-xs uppercase tracking-wide text-slate-400">Company logo</div>

              {logoUrl ? (

                <div className="h-24 w-24 rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">

                  <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />

                </div>

              ) : (

                <div className="text-xs text-slate-500">No logo uploaded.</div>

              )}

              <input

                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                value={logoUrl}

                onChange={(e) => setLogoUrl(e.target.value)}

                placeholder="Logo URL"

                disabled={readOnly}

              />

              <input

                type="file"

                accept="image/*"

                disabled={readOnly}

                onChange={(e) => handlePhotoFile(e.target.files?.[0] ?? null, setLogoUrl)}

                className="text-xs text-slate-300"

              />

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">

              <div className="text-xs uppercase tracking-wide text-slate-400">Company photo</div>

              {companyPhotoUrl ? (

                <div className="h-20 sm:h-24 md:h-28 lg:h-32 xl:h-36 w-full rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">

                  <img src={companyPhotoUrl} alt="Company" className="h-full w-full object-cover" />

                </div>

              ) : (

                <div className="text-xs text-slate-500">No company photo uploaded.</div>

              )}

              <input

                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                value={companyPhotoUrl}

                onChange={(e) => setCompanyPhotoUrl(e.target.value)}

                placeholder="Company photo URL"

                disabled={readOnly}

              />

              <input

                type="file"

                accept="image/*"

                disabled={readOnly}

                onChange={(e) => handlePhotoFile(e.target.files?.[0] ?? null, setCompanyPhotoUrl)}

                className="text-xs text-slate-300"

              />

            </div>

          </div>

        )}

        <div className="flex justify-end gap-3 pt-2">

          <button

            type="submit"

            disabled={readOnly || submitting}

            className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed"

          >

            {submitting ? (isEdit ? "Saving changes..." : "Saving...") : isEdit ? "Save Changes" : "Create Profile"}

          </button>

        </div>

      </form>

    </div>

  );

};

export { RetainerProfileForm };

function updateRetainerInStorage(updated: any) {

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
            (item.role === "RETAINER" || item.role === updated["role"])
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

      if (!Array.isArray(parsed)) continue;

      const idx = (parsed as any[]).findIndex(

        (item: any) =>

          item &&

          item.id === updated.id &&

          (item.role === "RETAINER" || item.role === updated["role"])

      );

      if (idx === -1) continue;

      const next = [...(parsed as any[])];

      next[idx] = updated;

      storage.setItem(key, JSON.stringify(next));

      break;

    }

  } catch (err) {

    console.error("Failed to update retainer in localStorage", err);

  }

}

/* ------------------------------------------------------------------ */

/* Helpers                                                            */

/* ------------------------------------------------------------------ */

function resolveCurrentRetainerId(retainers: Retainer[], prevId: string | null): string | null {

  if (!retainers || retainers.length === 0) return null;

  const findById = (id: string | null) =>

    id ? (retainers as any[]).find((r) => r.id === id) : undefined;

  const prev = findById(prevId);

  if (prev && prev.status !== "DELETED") return prev.id;

  let storedId: string | null = null;

  if (typeof window !== "undefined") {

    storedId = window.localStorage.getItem(CURRENT_RETAINER_KEY) ?? null;

  }

  const stored = findById(storedId);

  if (stored && stored.status !== "DELETED") return stored.id;

  const nonDeleted = (retainers as any[]).find((r) => r.status !== "DELETED");

  if (nonDeleted) return nonDeleted.id;

  return null;

}

function persistCurrentRetainerId(id: string | null) {

  if (typeof window === "undefined") return;

  if (id) window.localStorage.setItem(CURRENT_RETAINER_KEY, id);

  else window.localStorage.removeItem(CURRENT_RETAINER_KEY);

}


function formatRetainerName(r: Retainer): string {

  const rr: any = r as any;

  return rr.companyName || rr.name || rr.ceoName || "Retainer";

}

function formatSeekerName(s: Seeker): string {

  const ss: any = s as any;

  const full = `${ss.firstName ?? ""} ${ss.lastName ?? ""}`.trim();

  if (full) return full;

  return ss.name || "Seeker";

}

function getSeekerPhotoUrl(s: Seeker): string | undefined {

  const ss: any = s as any;

  return (

    ss.photoUrl ||

    ss.profileImageUrl ||

    ss.avatarUrl ||

    ss.imageUrl ||

    ss.driverPhotoUrl ||

    getStockImageUrl("SEEKER", String((ss as any).id ?? ""))

  );

}

function renderHeaderTitle(tab: TabKey): string {

  switch (tab) {

    case "dashboard":

      return "Retainer Dashboard";

    case "action":

      return "Action Center";

    case "find":

      return "Find Seekers";

    case "linking":

      return "Linking";

    case "posts":

      return "Posts";

    case "messages":

      return "Messaging Center";

    case "badges":

      return "Badges";

    default:

      return "Retainer Dashboard";

  }

}

function renderHeaderSubtitle(tab: TabKey): string {

  switch (tab) {

    case "dashboard":

      return "High-level overview of your Retainer account and sorted Seeker lists.";

    case "action":

      return "Manage routes, schedules, and profile actions.";

    case "find":

      return "Spin the wheel and sort Seekers into your working lists.";

    case "linking":

      return "Confirm video calls and approve links with Seekers to enable linked-only content.";

    case "posts":

      return "Create linked-only posts and broadcasts for your connected Seekers.";

    case "messages":

      return "View and continue message chains organized by Seeker and subject.";

    case "badges":

      return "Select up to 4 badges and confirm weekly progress with linked Seekers.";

    default:

      return "";

  }

}

/* ------------------------------------------------------------------ */

/* Linking (Retainer)                                                 */

/* ------------------------------------------------------------------ */

const RetainerLinkingView: React.FC<{

  retainerId: string | null;

  seekers: Seeker[];

  canEdit: boolean;

  onToast: (msg: string) => void;

  onMessage: (s: Seeker) => void;

}> = ({ retainerId, seekers, canEdit, onToast, onMessage }) => {

  const [q, setQ] = useState("");

  const [refresh, setRefresh] = useState(0);

  const links = useMemo<LinkingLink[]>(

    () => (retainerId ? getLinksForRetainer(retainerId) : []),

    [retainerId, refresh]

  );

  const linkBySeekerId = useMemo(() => {

    const m = new Map<string, LinkingLink>();

    for (const l of links) m.set(l.seekerId, l);

    return m;

  }, [links]);

  const filteredSeekers = useMemo(() => {

    const needle = q.trim().toLowerCase();

    if (!needle) return seekers;

    return seekers.filter((s) => formatSeekerName(s).toLowerCase().includes(needle));

  }, [q, seekers]);

  if (!retainerId) {

    return (

      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">

        Select or create a Retainer profile first.

      </div>

    );

  }

  const ensureLink = (seekerId: string) => {

    const existing = linkBySeekerId.get(seekerId) ?? null;

    if (existing) return existing;

    try {
      return requestLink({ seekerId, retainerId, by: "RETAINER" });
    } catch (err: any) {
      onToast(err?.message || "Unable to request link.");
      return null;
    }

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

  const statusForSeeker = (seekerId: string) =>

    (linkBySeekerId.get(seekerId)?.status ?? "NONE") as LinkingLink["status"] | "NONE";

  const linkedSeekers = useMemo(

    () => filteredSeekers.filter((s) => statusForSeeker(s.id) === "ACTIVE"),

    [filteredSeekers, linkBySeekerId]

  );

  const pendingSeekers = useMemo(
    () => filteredSeekers.filter((s) => statusForSeeker(s.id) === "PENDING"),
    [filteredSeekers, linkBySeekerId]
  );

  const renderSeekerCard = (s: Seeker) => {

    const link = linkBySeekerId.get(s.id) ?? null;

    const status = link?.status ?? ("NONE" as const);

    const seekerName = formatSeekerName(s);

    const pendingParts =
      link && status === "PENDING"
        ? [
            !link.videoConfirmedBySeeker ? "seeker video" : null,
            !link.videoConfirmedByRetainer ? "your video" : null,
            !link.approvedBySeeker ? "seeker approval" : null,
            !link.approvedByRetainer ? "your approval" : null,
          ].filter(Boolean)
        : [];

    const showExitSignals = status === "ACTIVE" || status === "PENDING";

    const noticeSummary = getActiveNoticeSummaryForSeeker(s.id);

    const badExitSummary = getActiveBadExitSummaryForSeeker(s.id);

    const noticeLabel =
      noticeSummary.count > 1
        ? `Route notices: ${noticeSummary.count} (${noticeSummary.daysLeft ?? 0}d)`
        : `Route notice: ${noticeSummary.daysLeft ?? 0}d`;

    const badExitLabel =
      badExitSummary.count > 1
        ? `Bad exits: ${badExitSummary.count} (${badExitSummary.daysLeft ?? 0}d, -${badExitSummary.penaltyPercent}%)`
        : `Bad exit: ${badExitSummary.daysLeft ?? 0}d (-${badExitSummary.penaltyPercent}%)`;

    return (

      <div

        key={s.id}

        className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3"

      >

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

          <div className="flex items-start gap-3 min-w-0">

            <ProfileAvatar role="SEEKER" profile={s} name={seekerName} />

            <div className="min-w-0">

              <div className="flex items-center gap-2 min-w-0">
                <div className="text-lg font-semibold text-slate-50 truncate">
                  {seekerName}
                </div>
                {s.isDemo && (
                  <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                    Demo
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-400 mt-1">

                {(s.city || s.state) && (

                  <span>

                    {s.city ?? "Unknown"}, {s.state ?? "Unknown"}{" "}

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

              {showExitSignals && (noticeSummary.count > 0 || badExitSummary.count > 0) && (

                <div className="flex flex-wrap gap-2 mt-2">

                  {noticeSummary.count > 0 && (

                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] bg-amber-500/10 border-amber-500/30 text-amber-200">

                      {noticeLabel}

                    </span>

                  )}

                  {badExitSummary.count > 0 && (

                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] bg-rose-500/10 border-rose-500/30 text-rose-200">

                      {badExitLabel}

                    </span>

                  )}

                </div>

              )}

            </div>

          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">

            <Link

              to={`/seekers/${s.id}`}

              className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition">

              Open profile

            </Link>

            <button

              type="button"

              disabled={!canEdit}

              className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"

              onClick={() => onMessage(s)}>

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

                  disabled={!canEdit}

                  checked={link.videoConfirmedByRetainer}

                  onChange={(e) => {
                    const ensured = ensureLink(s.id);
                    if (!ensured) return;
                    let updated: LinkingLink | null = null;
                    try {
                      updated = setLinkVideoConfirmed({
                        seekerId: s.id,
                        retainerId,
                        by: "RETAINER",
                        value: e.target.checked,
                      });
                    } catch (err: any) {
                      onToast(err?.message || "Unable to update link.");
                      return;
                    }

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

                <span>Video confirmed (seeker)</span>

                <span className="text-slate-200">

                  {link.videoConfirmedBySeeker ? "Yes" : "No"}

                </span>

              </div>

            </div>

            <div className="grid gap-3 md:grid-cols-2">

              <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-200">

                <span>Approve link (you)</span>

                <input

                  type="checkbox"

                  disabled={!canEdit}

                  checked={link.approvedByRetainer}

                  onChange={(e) => {
                    const ensured = ensureLink(s.id);
                    if (!ensured) return;
                    let updated: LinkingLink | null = null;
                    try {
                      updated = setLinkApproved({
                        seekerId: s.id,
                        retainerId,
                        by: "RETAINER",
                        value: e.target.checked,
                      });
                    } catch (err: any) {
                      onToast(err?.message || "Unable to update link.");
                      return;
                    }

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

                <span>Approved (seeker)</span>

                <span className="text-slate-200">

                  {link.approvedBySeeker ? "Yes" : "No"}

                </span>

              </div>

            </div>

            <div className="flex flex-wrap gap-2">

              {link.status === "PENDING" && (

                <button

                  type="button"

                  disabled={!canEdit}

                  className="px-3 py-2 rounded-xl text-xs bg-rose-500/15 border border-rose-500/40 text-rose-100 hover:bg-rose-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"

                  onClick={() => {

                    setLinkStatus({

                      seekerId: s.id,

                      retainerId,

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

                  disabled={!canEdit}

                  className="px-3 py-2 rounded-xl text-xs bg-amber-500/15 border border-amber-500/40 text-amber-100 hover:bg-amber-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"

                  onClick={() => {

                    setLinkStatus({

                      seekerId: s.id,

                      retainerId,

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

                  disabled={!canEdit}

                  className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"

                  onClick={() => {
                    resetLink(s.id, retainerId);
                    try {
                      requestLink({ seekerId: s.id, retainerId, by: "RETAINER" });
                    } catch (err: any) {
                      onToast(err?.message || "Unable to request link.");
                      return;
                    }

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

        {!canEdit && (

          <div className="text-xs text-amber-300 mt-2">

            View-only access: level 2+ required to change link state.

          </div>

        )}

      </div>

      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">

        <div className="text-sm text-slate-300">

          {seekers.length} approved Seekers available

        </div>

        <div className="flex gap-2">

          <input

            className="w-full md:w-80 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"

            placeholder="Search seekers"

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

      {filteredSeekers.length === 0 ? (

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">

          No seekers match your search.

        </div>

      ) : (

        <div className="grid gap-4 lg:grid-cols-2 min-h-0 flex-1">

          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col min-h-0">

            <div className="flex items-start justify-between gap-3">

              <div>

                <div className="text-xs uppercase tracking-wide text-slate-400">

                  Linked profiles

                </div>

                <div className="text-[11px] text-slate-500 mt-1">

                  Active connections ready for badge check-ins.

                </div>

              </div>

              <div className="text-xs text-slate-400">{linkedSeekers.length}</div>

            </div>

            {linkedSeekers.length === 0 ? (

              <div className="mt-3 text-xs text-slate-400">No linked profiles yet.</div>

            ) : (

              <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">

                {linkedSeekers.map(renderSeekerCard)}

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

              <div className="text-xs text-slate-400">{pendingSeekers.length}</div>

            </div>

            {pendingSeekers.length === 0 ? (

              <div className="mt-3 text-xs text-slate-400">No pending links right now.</div>

            ) : (

              <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">

                {pendingSeekers.map(renderSeekerCard)}

              </div>

            )}

          </div>

        </div>

      )}

    </div>

  );

};

const SeekerWheelExpandedCard: React.FC<{

  seeker: Seeker;

  scheduleMatch?: ScheduleMatch;

  activeRoutes?: Route[];

  canInteract: boolean;

  onClose: () => void;

  onOpenFullProfile: () => void;

  onMessage: () => void;

  onClassify: (bucket: SeekerBucketKey) => void;

}> = ({

  seeker,

  scheduleMatch,

  activeRoutes = [],

  canInteract,

  onClose,

  onOpenFullProfile,

  onMessage,

  onClassify,

}) => {

  const s: any = seeker as any;

  const name = formatSeekerName(seeker);

  const city = s.city ?? "-";

  const state = s.state ?? "-";

  const zip = s.zip ?? "-";

  const photoUrl = getSeekerPhotoUrl(seeker);

  const reputation = getReputationScoreForProfile({ ownerRole: "SEEKER", ownerId: String(seeker.id) });

  const pctFromCounts = (yesCount: number, noCount: number) => {

    const total = yesCount + noCount;

    if (total <= 0) return null;

    return Math.round((yesCount / total) * 100);

  };

  const noDroppedRoutes = getBadgeProgress(

    "SEEKER",

    String(seeker.id),

    "seeker_no_dropped_routes" as any

  );

  const quickResponse = getBadgeProgress(

    "SEEKER",

    String(seeker.id),

    "seeker_quick_response" as any

  );

  const noDroppedPct = pctFromCounts(noDroppedRoutes.yesCount, noDroppedRoutes.noCount);

  const quickResponsePct = pctFromCounts(quickResponse.yesCount, quickResponse.noCount);

  const availabilityLines = useMemo<string[]>(() => {

    const availability = (s as any).availability as any;

    const blocks = Array.isArray(availability?.blocks) ? availability.blocks : [];

    if (blocks.length === 0) return [];

    const order = new Map(DAYS.map((d, idx) => [d.key, idx] as const));

    return blocks

      .filter((b: any) => b && typeof b.day === "string" && b.start && b.end)

      .slice()

      .sort((a: any, b: any) => {

        const ao = order.get(a.day) ?? 99;

        const bo = order.get(b.day) ?? 99;

        if (ao !== bo) return ao - bo;

        return String(a.start).localeCompare(String(b.start));

      })

      .slice(0, 6)

      .map((b: any) => `${b.day} ${b.start}-${b.end}`);

  }, [seeker]);

  const formatPay = (r: Route): string => {

    const model = r.payModel ? `${r.payModel}: ` : "";

    const min = typeof r.payMin === "number" ? r.payMin : null;

    const max = typeof r.payMax === "number" ? r.payMax : null;

    const fmt = (n: number) =>

      n.toLocaleString(undefined, { style: "currency", currency: "USD" });

    if (min != null && max != null) return `${model}${fmt(min)}-${fmt(max)}`;

    if (min != null) return `${model}${fmt(min)}+`;

    if (max != null) return `${model}Up to ${fmt(max)}`;

    return model ? model.trim() : "Pay not listed";

  };

  const routeScheduleLabel = (r: Route): string => {

    if (r.scheduleDays?.length && r.scheduleStart && r.scheduleEnd) {

      return `${formatDaysShort(r.scheduleDays)} ${r.scheduleStart}-${r.scheduleEnd}`;

    }

    return r.schedule || "Schedule not listed";

  };

  const topBadges = getBadgeSummaryForProfile({

    ownerRole: "SEEKER",

    ownerId: String(seeker.id),

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

          -

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

              {reputation.score == null ? "Reputation -" : `Reputation ${reputation.score}`}

            </span>

            {reputation.total > 0 && <span className="text-slate-400">({reputation.total})</span>}

          </span>

          {scheduleMatch && scheduleMatch.percent > 0 ? (

            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">

              {badgeIconFor("clock", "h-4 w-4")}

              <span className="font-semibold">{scheduleMatch.percent}% schedule match</span>

              {scheduleMatch.overlapDays.length > 0 && (

                <span className="text-emerald-200/70">

                  - {formatDaysShort(scheduleMatch.overlapDays)}

                </span>

              )}

            </span>

          ) : (

            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-xs text-slate-400">

              {badgeIconFor("clock", "h-4 w-4")}

              Schedule -

            </span>

          )}

        </div>

        <div className="flex flex-wrap items-center gap-2">

          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-xs text-slate-200">

            {badgeIconFor("route", "h-4 w-4")}

            <span className="font-semibold">

              No dropped routes: {noDroppedPct == null ? "-" : `${noDroppedPct}%`}

            </span>

          </span>

          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-xs text-slate-200">

            {badgeIconFor("bolt", "h-4 w-4")}

            <span className="font-semibold">

              Quick response: {quickResponsePct == null ? "-" : `${quickResponsePct}%`}

            </span>

          </span>

          {scheduleMatch && scheduleMatch.overlapMinutes > 0 && (

            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-xs text-slate-300">

              {badgeIconFor("clock", "h-4 w-4")}

              Overlap: {Math.round(scheduleMatch.overlapMinutes / 60)}h

            </span>

          )}

        </div>

        {availabilityLines.length > 0 && (

          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">

            <div className="text-xs uppercase tracking-wide text-slate-400">

              Availability Snapshot

            </div>

            <div className="mt-3 grid gap-1 text-sm text-slate-100">

              {availabilityLines.map((line) => (

                <div key={line} className="flex items-center gap-2">

                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />

                  <span className="text-slate-200">{line}</span>

                </div>

              ))}

            </div>

          </div>

        )}

        {activeRoutes.length > 0 && (

          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">

            <div className="flex items-center justify-between gap-3">

              <div className="text-xs uppercase tracking-wide text-slate-400">

                Routes You Could Match

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

                      {r.city && r.state ? `${r.city}, ${r.state}` : "-"}

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

        {topBadges.length > 0 && (

          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">

            <div className="text-xs uppercase tracking-wide text-slate-400">

              Top Badges

            </div>

            <div className="mt-3 flex flex-wrap gap-2">

              {topBadges.map((b) => (

                <span

                  key={b.badge.id}

                  title={`${b.badge.title} - Level ${b.maxLevel}\n${b.badge.description}`}

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

              className="px-4 py-2 rounded-full text-sm font-medium bg-slate-900 border border-slate-700 text-slate-100 hover:bg-slate-800 transition">

              Open full profile

            </button>

            <button

              type="button"

              onClick={onMessage}

              disabled={!canInteract}

              className={[

                "px-4 py-2 rounded-full text-sm font-medium border transition",

                canInteract

                  ? "bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 border-emerald-400/20"

                  : "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed opacity-60",

              ].join(" ")}>

              Message

            </button>

          </div>

          <div className="flex flex-wrap items-center gap-2">

            <button

              type="button"

              onClick={() => onClassify("excellent")}

              disabled={!canInteract}

              className="px-3 py-2 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-100 border border-emerald-500/50 hover:bg-emerald-500/30 transition disabled:opacity-60 disabled:cursor-not-allowed">

              Excellent

            </button>

            <button

              type="button"

              onClick={() => onClassify("possible")}

              disabled={!canInteract}

              className="px-3 py-2 rounded-full text-xs font-medium bg-sky-500/15 text-sky-100 border border-sky-500/40 hover:bg-sky-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed">

              Possible

            </button>

            <button

              type="button"

              onClick={() => onClassify("notNow")}

              disabled={!canInteract}

              className="px-3 py-2 rounded-full text-xs font-medium bg-rose-500/15 text-rose-100 border border-rose-500/40 hover:bg-rose-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed">

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

/* Posts (Retainer)                                                   */

/* ------------------------------------------------------------------ */

const RetainerPostsView: React.FC<{

  retainer?: Retainer;

  canEdit: boolean;

  onToast: (msg: string) => void;

}> = ({ retainer, canEdit, onToast }) => {

  const [refresh, setRefresh] = useState(0);

  const [showArchived, setShowArchived] = useState(false);

  const ent = useMemo(

    () => (retainer ? getRetainerEntitlements(retainer.id) : null),

    [retainer?.id]

  );

  const posts = useMemo<RetainerPost[]>(() => {

    if (!retainer) return [];

    const all = getRetainerPosts(retainer.id);

    return all.filter((p) => (showArchived ? true : p.status === "ACTIVE"));

  }, [retainer?.id, refresh, showArchived]);

  const broadcasts = useMemo<RetainerBroadcast[]>(() => {

    if (!retainer) return [];

    const all = getRetainerBroadcasts(retainer.id);

    return all.filter((b) => (showArchived ? true : b.status === "ACTIVE"));

  }, [retainer?.id, refresh, showArchived]);

  const monthKey = (d: Date) =>

    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const publicPostsUsedThisMonth = useMemo(() => {

    if (!retainer) return 0;

    const mk = monthKey(new Date());

    return getRetainerPosts(retainer.id).filter((p) => {

      if (p.status !== "ACTIVE") return false;

      if (p.audience !== "PUBLIC") return false;

      const d = new Date(p.createdAt);

      if (Number.isNaN(d.getTime())) return false;

      return monthKey(d) === mk;

    }).length;

  }, [retainer?.id, refresh]);

  const broadcastsUsedThisMonth = useMemo(() => {

    if (!retainer) return 0;

    const mk = monthKey(new Date());

    return getRetainerBroadcasts(retainer.id).filter((b) => {

      if (b.status !== "ACTIVE") return false;

      const d = new Date(b.createdAt);

      if (Number.isNaN(d.getTime())) return false;

      return monthKey(d) === mk;

    }).length;

  }, [retainer?.id, refresh]);

  const [broadcastAudience] = useState<RetainerBroadcastAudience>("LINKED_ONLY");

  const [broadcastSubject, setBroadcastSubject] = useState("");

  const [broadcastBody, setBroadcastBody] = useState("");

  const [broadcastSendToInbox] = useState(true);

  if (!retainer) {

    return (

      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">

        Select or create a Retainer profile first.

      </div>

    );

  }

  const postBadge = (type: RetainerPostType) =>

    type === "AD"

      ? "bg-fuchsia-500/15 border-fuchsia-500/35 text-fuchsia-200"

      : "bg-sky-500/10 border-sky-500/30 text-sky-200";

  const audienceBadge = (aud: "LINKED_ONLY" | "PUBLIC") =>

    aud === "PUBLIC"

      ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-200"

      : "bg-white/5 border-white/10 text-white/70";

  const audienceLabel = (aud: "LINKED_ONLY" | "PUBLIC") =>
    aud === "PUBLIC" ? "Area" : "Linked only";

  const fmtWhen = (iso: string) => {

    const d = new Date(iso);

    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();

  };

  const handleCreateBroadcast = () => {

    try {

      const b = createRetainerBroadcast({

        retainerId: retainer.id,

        audience: broadcastAudience,

        subject: broadcastSubject,

        body: broadcastBody,

      });

      if (broadcastSendToInbox) {

        const res = deliverRetainerBroadcastToLinkedSeekers({

          retainerId: retainer.id,

          subject: b.subject,

          body: b.body,

        });

        if (res.delivered > 0) {

          onToast(`Broadcast sent to ${res.delivered} linked Seekers`);

        } else {

          onToast("Broadcast created (no active linked Seekers to deliver to)");

        }

      } else {

        onToast("Broadcast created");

      }

      setBroadcastSubject("");

      setBroadcastBody("");

      setRefresh((n) => n + 1);

    } catch (err) {

      const msg =

        err instanceof Error ? err.message : "Failed to create broadcast.";

      onToast(msg);

    }

  };

  return (

    <div className="space-y-5">

      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">

        <h3 className="text-lg font-semibold text-slate-50 mb-1">

          Posts & Broadcasts

        </h3>

        <p className="text-sm text-slate-300">
          Posts appear to Seekers in your area. Broadcasts reach active linked
          Seekers who are currently working with you.
        </p>

        {ent && (

          <div className="text-xs text-slate-400 mt-2">

            Tier: <span className="text-slate-200">{ent.tier}</span> - Area posts:{" "}

            <span className="text-slate-200">

              {ent.canPostPublic ? "Enabled" : "Not enabled"}

            </span>{" "}

            - Area posts this month:{" "}

            <span className="text-slate-200">

              {publicPostsUsedThisMonth} / {ent.maxPublicPostsPerMonth}

            </span>{" "}

            - Broadcasts this month:{" "}

            <span className="text-slate-200">

              {broadcastsUsedThisMonth} / {ent.maxBroadcastsPerMonth}

            </span>

          </div>

        )}

        {!canEdit && (

          <div className="text-xs text-amber-300 mt-2">

            View-only access: level 2+ required to create or archive items.

          </div>

        )}

      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

        <label className="flex items-center gap-2 text-xs text-slate-300">

          <input

            type="checkbox"

            checked={showArchived}

            onChange={(e) => setShowArchived(e.target.checked)}

          />

          Show archived

        </label>

        <button

          type="button"

          className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"

          onClick={() => setRefresh((n) => n + 1)}

        >

          Refresh

        </button>

      </div>

      <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-4">

        <div className="flex items-center justify-between gap-3">

          <h4 className="text-sm font-semibold text-slate-100">

            Create a broadcast

          </h4>

          {!canEdit && (

            <span className="text-xs text-slate-400">View-only access</span>

          )}

        </div>

        <div className="grid gap-3 md:grid-cols-2">

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">Audience</label>
            <div className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
              Linked only (active linked workers)
            </div>
          </div>

          <div className="space-y-1">

            <label className="text-xs font-medium text-slate-200">

              Subject

            </label>

            <input

              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"

              value={broadcastSubject}

              onChange={(e) => setBroadcastSubject(e.target.value)}

              placeholder="Example: Safety reminder"

              disabled={!canEdit}

            />

          </div>

        </div>

        <div className="space-y-1">

          <label className="text-xs font-medium text-slate-200">Body</label>

          <textarea

            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[90px]"

            value={broadcastBody}

            onChange={(e) => setBroadcastBody(e.target.value)}

            placeholder="This broadcast will appear in the Seeker feed-"

            disabled={!canEdit}

          />

        </div>

        <div className="flex justify-end">

          <button

            type="button"

            className="px-4 py-2 rounded-full text-sm font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed"

            disabled={!canEdit}

            onClick={handleCreateBroadcast}

          >

            Create broadcast

          </button>

        </div>

      </section>

      <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-4">

        <h4 className="text-sm font-semibold text-slate-100">

          Your posts ({posts.length})

        </h4>

        {posts.length === 0 ? (

          <div className="text-xs text-slate-400">No posts yet.</div>

        ) : (

          <div className="space-y-2">

            {posts.map((p) => (

              <div

                key={p.id}

                className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 space-y-1"

              >

                <div className="flex items-center justify-between gap-2">

                  <div className="flex flex-wrap items-center gap-2">

                    <span

                      className={[

                        "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px]",

                        postBadge(p.type),

                      ].join(" ")}

                    >

                      {p.type}

                    </span>

                    <span

                      className={[

                        "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px]",

                        audienceBadge(p.audience),

                      ].join(" ")}

                    >

                      {audienceLabel(p.audience)}

                    </span>

                    {p.status === "ARCHIVED" && (

                      <span className="text-[11px] text-amber-300">Archived</span>

                    )}

                  </div>

                  <div className="text-[11px] text-slate-500 whitespace-nowrap">

                    {fmtWhen(p.updatedAt)}

                  </div>

                </div>

                <div className="text-sm font-semibold text-slate-50">

                  {p.title}

                </div>

                <div className="text-xs text-slate-300 whitespace-pre-wrap">

                  {p.body}

                </div>

                {canEdit && (

                  <div className="flex justify-end gap-2 pt-1">

                    <button

                      type="button"

                      className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"

                      onClick={() => {

                        const next: RetainerPostStatus =

                          p.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";

                        updateRetainerPost(p.id, { status: next });

                        setRefresh((n) => n + 1);

                      }}

                    >

                      {p.status === "ARCHIVED" ? "Unarchive" : "Archive"}

                    </button>

                  </div>

                )}

              </div>

            ))}

          </div>

        )}

      </section>

      <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-4">

        <h4 className="text-sm font-semibold text-slate-100">

          Your broadcasts ({broadcasts.length})

        </h4>

        {broadcasts.length === 0 ? (

          <div className="text-xs text-slate-400">No broadcasts yet.</div>

        ) : (

          <div className="space-y-2">

            {broadcasts.map((b) => (

              <div

                key={b.id}

                className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 space-y-1"

              >

                <div className="flex items-center justify-between gap-2">

                  <div className="flex flex-wrap items-center gap-2">

                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] bg-indigo-500/10 border-indigo-500/30 text-indigo-200">

                      BROADCAST

                    </span>

                    <span

                      className={[

                        "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px]",

                        audienceBadge(b.audience),

                      ].join(" ")}

                    >

                      {audienceLabel(b.audience)}

                    </span>

                    {b.status === "ARCHIVED" && (

                      <span className="text-[11px] text-amber-300">Archived</span>

                    )}

                  </div>

                  <div className="text-[11px] text-slate-500 whitespace-nowrap">

                    {fmtWhen(b.createdAt)}

                  </div>

                </div>

                <div className="text-sm font-semibold text-slate-50">

                  {b.subject}

                </div>

                <div className="text-xs text-slate-300 whitespace-pre-wrap">

                  {b.body}

                </div>

                {canEdit && (

                  <div className="flex justify-end gap-2 pt-1">

                    <button

                      type="button"

                      className="px-3 py-1.5 rounded-full text-[11px] bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"

                      onClick={() => {

                        const next: RetainerBroadcastStatus =

                          b.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";

                        updateRetainerBroadcast(b.id, { status: next });

                        setRefresh((n) => n + 1);

                      }}

                    >

                      {b.status === "ARCHIVED" ? "Unarchive" : "Archive"}

                    </button>

                  </div>

                )}

              </div>

            ))}

          </div>

        )}

      </section>

    </div>

  );

};

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */

/* Routes (Retainer)                                                  */

/* ------------------------------------------------------------------ */

const RetainerRoutesView: React.FC<{

  retainer?: Retainer;

  seekers: Seeker[];

  canEdit: boolean;

  noticeTick: number;

  onToast: (msg: string) => void;

}> = ({ retainer, seekers, canEdit, noticeTick, onToast }) => {

  const [refresh, setRefresh] = useState(0);

  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(true);

  const [showRoutes, setShowRoutes] = useState(true);

  const [createStep, setCreateStep] = useState<

    "basics" | "schedule" | "pay" | "requirements" | "review"

  >("basics");

  const ent = useMemo(

    () => (retainer ? getRetainerEntitlements(retainer.id) : null),

    [retainer?.id]

  );

  const routes = useMemo<Route[]>(

    () => (retainer ? getRoutesForRetainer(retainer.id) : []),

    [retainer?.id, refresh]

  );

  const seekerById = useMemo(

    () => new Map(seekers.map((s) => [s.id, s] as const)),

    [seekers]

  );

  const routesById = useMemo(

    () => new Map(routes.map((r) => [r.id, r] as const)),

    [routes]

  );

  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});

  const assignments = useMemo<RouteAssignment[]>(
    () => (retainer ? getAssignmentsForRetainer(retainer.id) : []),
    [retainer?.id, refresh]
  );

  const assignmentsByRouteId = useMemo(() => {
    const map = new Map<string, RouteAssignment[]>();
    assignments.forEach((assignment) => {
      const list = map.get(assignment.routeId) ?? [];
      list.push(assignment);
      map.set(assignment.routeId, list);
    });
    map.forEach((list) => {
      list.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    });
    return map;
  }, [assignments]);

  const linksBySeekerId = useMemo(() => {
    if (!retainer) return new Map<string, LinkingLink>();
    const links = getLinksForRetainer(retainer.id);
    const map = new Map<string, LinkingLink>();
    links.forEach((link) => map.set(link.seekerId, link));
    return map;
  }, [retainer?.id, refresh]);

  const [lockDrafts, setLockDrafts] = useState<
    Record<
      string,
      {
        seekerId: string;
        startDate: string;
        expectedUnits: string;
        unitType: WorkUnitType;
      }
    >
  >({});

  const [workUnitDrafts, setWorkUnitDrafts] = useState<
    Record<
      string,
      {
        completedUnits: string;
        acceptedUnits: string;
      }
    >
  >({});

  const activeNotices = useMemo(() => {

    if (!retainer) return [];

    return getActiveRouteNoticesForRetainer(retainer.id).sort((a, b) => {

      const aEnd = Date.parse(a.effectiveEndAt);

      const bEnd = Date.parse(b.effectiveEndAt);

      if (!Number.isFinite(aEnd) || !Number.isFinite(bEnd)) return 0;

      return aEnd - bEnd;

    });

  }, [retainer?.id, noticeTick]);

  const formatNoticeDate = (iso: string) => {

    const dt = new Date(iso);

    if (Number.isNaN(dt.valueOf())) return "-";

    return dt.toLocaleDateString();

  };

  const toInputDate = (iso: string) => {
    const dt = new Date(iso);
    if (Number.isNaN(dt.valueOf())) return "";
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayInput = () => toInputDate(new Date().toISOString());

  const [title, setTitle] = useState("");

  const [audience, setAudience] = useState<RouteAudience>("LINKED_ONLY");

  const [vertical, setVertical] = useState("");

  const [city, setCity] = useState("");

  const [state, setState] = useState("FL");

  const [scheduleDays, setScheduleDays] = useState<DayOfWeek[]>([

    "MON",

    "TUE",

    "WED",

    "THU",

    "FRI",

  ]);

  const [scheduleStart, setScheduleStart] = useState("08:00");

  const [scheduleEnd, setScheduleEnd] = useState("16:00");

  const [scheduleTimezone, setScheduleTimezone] = useState<string>(() => {

    if (typeof window === "undefined") return "";

    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";

  });

  const [scheduleNotes, setScheduleNotes] = useState("");

  const [commitmentType, setCommitmentType] = useState<RouteCommitmentType>("FLEX");

  const [payModel, setPayModel] = useState("Per day");

  const [payMin, setPayMin] = useState("");

  const [payMax, setPayMax] = useState("");

  const [openings, setOpenings] = useState("1");

  const [requirements, setRequirements] = useState("");

  const createSteps: Array<{ key: typeof createStep; label: string }> = [

    { key: "basics", label: "Basics" },

    { key: "schedule", label: "Schedule" },

    { key: "pay", label: "Pay" },

    { key: "requirements", label: "Requirements" },

    { key: "review", label: "Review" },

  ];

  const createIndex = createSteps.findIndex((s) => s.key === createStep);

  const canPrev = createIndex > 0;

  const canNext = createIndex < createSteps.length - 1;

  const goPrev = () => {

    if (!canPrev) return;

    setCreateStep(createSteps[createIndex - 1].key);

  };

  const goNext = () => {

    if (!canNext) return;

    setCreateStep(createSteps[createIndex + 1].key);

  };

  useEffect(() => {

    if (!retainer) return;

    setCity((retainer as any).city ?? "");

    setState((retainer as any).state ?? "FL");

  }, [retainer?.id]);

  if (!retainer) {

    return (

      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">

        Select or create a Retainer profile first.

      </div>

    );

  }

  const scheduleLabel =

    scheduleDays.length > 0

      ? `${formatDaysShort(scheduleDays)} ${scheduleStart}-${scheduleEnd}${

          scheduleTimezone?.trim() ? ` (${scheduleTimezone.trim()})` : ""

        }`

      : "";

  const paySummary = (() => {

    const min = payMin ? Number(payMin) : null;

    const max = payMax ? Number(payMax) : null;

    if (min != null && max != null) return `$${min} - $${max}`;

    if (min != null) return `$${min}+`;

    if (max != null) return `Up to $${max}`;

    return "Not set";

  })();

  const handleCreateRoute = () => {

    try {

      const scheduleText = scheduleLabel

        ? scheduleNotes.trim()

          ? `${scheduleLabel} - ${scheduleNotes.trim()}`

          : scheduleLabel

        : scheduleNotes.trim() || undefined;

      createRoute({

        retainerId: retainer.id,

        title,

        audience,

        vertical,

        city,

        state,

        schedule: scheduleText,

        scheduleDays,

        scheduleStart,

        scheduleEnd,

        scheduleTimezone: scheduleTimezone?.trim() || undefined,

        commitmentType,

        payModel,

        payMin: payMin ? Number(payMin) : undefined,

        payMax: payMax ? Number(payMax) : undefined,

        openings: openings ? Number(openings) : undefined,

        requirements,

      });

      onToast("Route created");

      setTitle("");

      setVertical("");

      setScheduleDays(["MON", "TUE", "WED", "THU", "FRI"]);

      setScheduleStart("08:00");

      setScheduleEnd("16:00");

      setScheduleNotes("");

      setCommitmentType("FLEX");

      setPayMin("");

      setPayMax("");

      setOpenings("1");

      setRequirements("");

      setCreateStep("basics");

      setRefresh((n) => n + 1);

    } catch (err: any) {

      onToast(err?.message || "Could not create route");

    }

  };

  return (

    <div className="space-y-5">

      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">

        <h3 className="text-lg font-semibold text-slate-50 mb-1">Routes</h3>

        <p className="text-sm text-slate-300">

          Create route postings. Linked-only is available to all tiers; public

          visibility is tier gated.

        </p>

        {ent && (

          <div className="text-xs text-slate-400 mt-2">

            Tier: <span className="text-slate-200">{ent.tier}</span> - Max

            active routes: <span className="text-slate-200">{ent.maxActiveRoutes}</span> -

            Public routes: <span className="text-slate-200">{ent.canPostPublic ? "Enabled" : "Not enabled"}</span>

          </div>

        )}

      </div>

      <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">

        <div className="flex items-center justify-between gap-3">

          <button

            type="button"

            onClick={() => setShowCreate((prev) => !prev)}

            className="flex items-center gap-3 text-left"

          >

            <span className="text-sm font-semibold text-slate-100">Create a route</span>

            <span className="h-7 w-7 rounded-full border border-slate-700 text-slate-200 flex items-center justify-center">

              {showCreate ? "-" : "+"}

            </span>

          </button>

          {!canEdit && (

            <span className="text-xs text-slate-400">View-only access</span>

          )}

        </div>

        {showCreate && (

          <div className="space-y-4">

            <div className="flex flex-wrap gap-2">

              {createSteps.map((step) => {

                const active = step.key === createStep;

                return (

                  <button

                    key={step.key}

                    type="button"

                    onClick={() => setCreateStep(step.key)}

                    className={[

                      "px-3 py-1.5 rounded-full text-xs border transition",

                      active

                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100"

                        : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800",

                    ].join(" ")}

                  >

                    {step.label}

                  </button>

                );

              })}

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-4">

              {createStep === "basics" && (

                <div className="space-y-4">

                  <div className="grid gap-3 md:grid-cols-2">

                    <div className="space-y-1">

                      <label className="text-xs font-medium text-slate-200">Title</label>

                      <input

                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                        value={title}

                        onChange={(e) => setTitle(e.target.value)}

                        placeholder="Example: Route A - night shift coverage"

                        disabled={!canEdit}

                      />

                    </div>

                    <div className="space-y-1">

                      <label className="text-xs font-medium text-slate-200">Audience</label>

                      <select

                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                        value={audience}

                        onChange={(e) => setAudience(e.target.value as RouteAudience)}

                        disabled={!canEdit}

                      >

                        <option value="LINKED_ONLY">Linked only</option>

                        <option value="PUBLIC" disabled={!ent?.canPostPublic}>

                          Public (tier gated)

                        </option>

                      </select>

                    </div>

                  </div>

                  <div className="grid gap-3 md:grid-cols-3">

                    <div className="space-y-1">

                      <label className="text-xs font-medium text-slate-200">Vertical</label>

                      <input

                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                        value={vertical}

                        onChange={(e) => setVertical(e.target.value)}

                        placeholder="Final mile parcel"

                        disabled={!canEdit}

                      />

                    </div>

                    <div className="space-y-1">

                      <label className="text-xs font-medium text-slate-200">City</label>

                      <input

                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                        value={city}

                        onChange={(e) => setCity(e.target.value)}

                        disabled={!canEdit}

                      />

                    </div>

                    <div className="space-y-1">

                      <label className="text-xs font-medium text-slate-200">State</label>

                      <select

                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                        value={state}

                        onChange={(e) => setState(e.target.value)}

                        disabled={!canEdit}

                      >

                        {US_STATES.map((st) => (

                          <option key={st} value={st} className="bg-slate-900 text-slate-50">

                            {st}

                          </option>

                        ))}

                      </select>

                    </div>

                  </div>

                </div>

              )}

              {createStep === "schedule" && (

                <div className="space-y-3">

                  <div className="text-xs font-medium text-slate-200">Schedule (for matching)</div>

                  <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 space-y-3">

                    <div className="flex flex-wrap gap-2">

                      {DAYS.map((d) => {

                        const active = scheduleDays.includes(d.key);

                        return (

                          <button

                            key={d.key}

                            type="button"

                            disabled={!canEdit}

                            onClick={() => {

                              if (!canEdit) return;

                              setScheduleDays((prev) =>

                                prev.includes(d.key)

                                  ? prev.filter((x) => x !== d.key)

                                  : [...prev, d.key]

                              );

                            }}

                            className={[

                              "px-3 py-1.5 rounded-full text-xs border transition",

                              active

                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-100"

                                : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",

                              !canEdit ? "opacity-60 cursor-not-allowed" : "",

                            ].join(" ")}

                          >

                            {d.short}

                          </button>

                        );

                      })}

                    </div>

                    <div className="grid gap-2 md:grid-cols-3">

                      <div className="space-y-1">

                        <div className="text-[11px] text-slate-300">Start</div>

                        <input

                          type="time"

                          value={scheduleStart}

                          onChange={(e) => setScheduleStart(e.target.value)}

                          disabled={!canEdit}

                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"

                        />

                      </div>

                      <div className="space-y-1">

                        <div className="text-[11px] text-slate-300">End</div>

                        <input

                          type="time"

                          value={scheduleEnd}

                          onChange={(e) => setScheduleEnd(e.target.value)}

                          disabled={!canEdit}

                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"

                        />

                      </div>

                      <div className="space-y-1">

                        <div className="text-[11px] text-slate-300">Timezone</div>

                        <input

                          value={scheduleTimezone}

                          onChange={(e) => setScheduleTimezone(e.target.value)}

                          disabled={!canEdit}

                          placeholder="America/New_York"

                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"

                        />

                      </div>

                    </div>

                    <div className="space-y-1">

                      <div className="text-[11px] text-slate-300">Notes (optional)</div>

                      <input

                        value={scheduleNotes}

                        onChange={(e) => setScheduleNotes(e.target.value)}

                        disabled={!canEdit}

                        placeholder="Example: start time can shift by +/- 30 minutes"

                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"

                      />

                    </div>

                    <div className="space-y-1">

                      <div className="text-[11px] text-slate-300">Commitment type</div>

                      <select

                        value={commitmentType}

                        onChange={(e) => setCommitmentType(e.target.value as RouteCommitmentType)}

                        disabled={!canEdit}

                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"

                      >

                        <option value="FLEX">Flexible</option>

                        <option value="DEDICATED">Dedicated (notice tracked)</option>

                      </select>

                      <div className="text-[11px] text-slate-500">

                        Dedicated routes track notice and exit status. This is not a guarantee of work.

                      </div>

                    </div>

                  </div>

                </div>

              )}

              {createStep === "pay" && (

                <div className="space-y-4">

                  <div className="grid gap-3 md:grid-cols-2">

                    <div className="space-y-1">

                      <label className="text-xs font-medium text-slate-200">Pay model</label>

                      <input

                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                        value={payModel}

                        onChange={(e) => setPayModel(e.target.value)}

                        disabled={!canEdit}

                      />

                    </div>

                    <div className="space-y-1">

                      <label className="text-xs font-medium text-slate-200">Openings</label>

                      <input

                        type="number"

                        min={0}

                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                        value={openings}

                        onChange={(e) => setOpenings(e.target.value)}

                        disabled={!canEdit}

                      />

                    </div>

                  </div>

                  <div className="grid gap-3 md:grid-cols-2">

                    <div className="space-y-1">

                      <label className="text-xs font-medium text-slate-200">Pay min</label>

                      <input

                        type="number"

                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                        value={payMin}

                        onChange={(e) => setPayMin(e.target.value)}

                        disabled={!canEdit}

                      />

                    </div>

                    <div className="space-y-1">

                      <label className="text-xs font-medium text-slate-200">Pay max</label>

                      <input

                        type="number"

                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"

                        value={payMax}

                        onChange={(e) => setPayMax(e.target.value)}

                        disabled={!canEdit}

                      />

                    </div>

                  </div>

                </div>

              )}

              {createStep === "requirements" && (

                <div className="space-y-1">

                  <label className="text-xs font-medium text-slate-200">Requirements</label>

                  <textarea

                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[100px]"

                    value={requirements}

                    onChange={(e) => setRequirements(e.target.value)}

                    disabled={!canEdit}

                  />

                </div>

              )}

              {createStep === "review" && (

                <div className="space-y-2 text-sm text-slate-200">

                  <div><span className="text-slate-400">Title:</span> {title || "-"}</div>

                  <div><span className="text-slate-400">Audience:</span> {audience}</div>

                  <div><span className="text-slate-400">Vertical:</span> {vertical || "-"}</div>

                  <div><span className="text-slate-400">Location:</span> {city || "-"}, {state}</div>

                  <div><span className="text-slate-400">Schedule:</span> {scheduleLabel || "Not set"}</div>

                  <div><span className="text-slate-400">Commitment:</span> {commitmentType === "DEDICATED" ? "Dedicated" : "Flexible"}</div>

                  <div><span className="text-slate-400">Pay:</span> {paySummary}</div>

                  <div><span className="text-slate-400">Openings:</span> {openings || "-"}</div>

                  <div><span className="text-slate-400">Requirements:</span> {requirements || "-"}</div>

                </div>

              )}

            </div>

            <div className="flex items-center justify-between">

              <button

                type="button"

                onClick={goPrev}

                disabled={!canPrev}

                className="px-3 py-1.5 rounded-full text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"

              >

                Back

              </button>

              <div className="flex items-center gap-2">

                {canNext && (

                  <button

                    type="button"

                    onClick={goNext}

                    disabled={!canNext}

                    className="px-3 py-1.5 rounded-full text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"

                  >

                    Next

                  </button>

                )}

                {createStep == "review" && (

                  <button

                    type="button"

                    className="px-4 py-2 rounded-full text-sm font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed"

                    disabled={!canEdit}

                    onClick={handleCreateRoute}

                  >

                    Create route

                  </button>

                )}

              </div>

            </div>

          </div>

        )}

      </section>

      

      <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">

        <div className="flex items-center justify-between">

          <div>

            <div className="text-sm font-semibold text-slate-100">Route notices</div>

            <div className="text-xs text-slate-400 mt-1">

              Dedicated route notices from seekers. Confirmation is not a guarantee of work.

            </div>

          </div>

          <span className="text-xs text-slate-400">{activeNotices.length} active</span>

        </div>

        {activeNotices.length === 0 ? (

          <div className="text-sm text-slate-400">No active notices right now.</div>

        ) : (

          <div className="space-y-2">

            {activeNotices.map((notice) => {

              const seeker = seekerById.get(notice.seekerId);

              const seekerName = seeker ? formatSeekerName(seeker) : "Seeker";

              const route = routesById.get(notice.routeId);

              const routeTitle = route?.title ?? "Route";

              const commitmentLabel =

                route?.commitmentType === "DEDICATED" ? "Dedicated" : "Flexible";

              const daysLeft = daysUntil(notice.effectiveEndAt);

              const dateLabel = formatNoticeDate(notice.effectiveEndAt);

              const tierInfo = getNextBadExitTierForSeeker(notice.seekerId);

              const disputeNote = disputeNotes[notice.id] ?? "";

              return (

                <div

                  key={notice.id}

                  className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2"

                >

                  <div className="flex flex-wrap items-start justify-between gap-2">

                    <div>

                      <div className="text-sm font-semibold text-slate-50">{seekerName}</div>

                      <div className="text-xs text-slate-400">

                        Route: {routeTitle} ({commitmentLabel})

                      </div>

                      <div className="text-xs text-slate-400">

                        Notice ends {dateLabel} ({daysLeft}d)

                      </div>

                    </div>

                    <span className="inline-flex items-center rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100">

                      Active notice

                    </span>

                  </div>

                  <div className="text-[11px] text-slate-500">

                    If confirmed bad: tier {tierInfo.tier} - {tierInfo.penaltyPercent}% for {tierInfo.durationDays} days

                    {tierInfo.tier >= 3

                      ? " Includes 45-day suspension then blacklist (appeal placeholder after 90 days)."

                      : "."}

                  </div>

                  <div className="flex flex-wrap items-center gap-2">

                    <button

                      type="button"

                      disabled={!canEdit}

                      onClick={() => {

                        if (!canEdit) return;

                        try {

                          const updated = confirmRouteNotice({

                            noticeId: notice.id,

                            outcome: "GOOD",

                          });

                          if (!updated) throw new Error("Notice not found");

                          setDisputeNotes((prev) => {

                            if (!prev[notice.id]) return prev;

                            const next = { ...prev };

                            delete next[notice.id];

                            return next;

                          });

                          onToast("Notice confirmed");

                        } catch (err: any) {

                          onToast(err?.message || "Could not update notice");

                        }

                      }}

                      className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"

                    >

                      Confirm good

                    </button>

                    <button

                      type="button"

                      disabled={!canEdit}

                      onClick={() => {

                        if (!canEdit) return;

                        try {

                          const updated = confirmRouteNotice({

                            noticeId: notice.id,

                            outcome: "BAD",

                          });

                          if (!updated) throw new Error("Notice not found");

                          setDisputeNotes((prev) => {

                            if (!prev[notice.id]) return prev;

                            const next = { ...prev };

                            delete next[notice.id];

                            return next;

                          });

                          onToast("Bad exit confirmed");

                        } catch (err: any) {

                          onToast(err?.message || "Could not update notice");

                        }

                      }}

                      className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/15 border border-rose-500/40 text-rose-100 hover:bg-rose-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"

                    >

                      Confirm bad exit

                    </button>

                  </div>

                  <div className="flex flex-wrap items-center gap-2">

                    <input

                      value={disputeNote}

                      onChange={(e) =>

                        setDisputeNotes((prev) => ({

                          ...prev,

                          [notice.id]: e.target.value,

                        }))

                      }

                      disabled={!canEdit}

                      placeholder="Dispute note (optional)"

                      className="flex-1 min-w-[200px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed"

                    />

                    <button

                      type="button"

                      disabled={!canEdit}

                      onClick={() => {

                        if (!canEdit) return;

                        try {

                          const updated = confirmRouteNotice({

                            noticeId: notice.id,

                            outcome: "DISPUTE",

                            disputeNote,

                          });

                          if (!updated) throw new Error("Notice not found");

                          setDisputeNotes((prev) => {

                            if (!prev[notice.id]) return prev;

                            const next = { ...prev };

                            delete next[notice.id];

                            return next;

                          });

                          onToast("Notice disputed");

                        } catch (err: any) {

                          onToast(err?.message || "Could not update notice");

                        }

                      }}

                      className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"

                    >

                      Dispute

                    </button>

                  </div>

                </div>

              );

            })}

          </div>

        )}

      </section>

      <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">

        <div className="flex items-center justify-between">

          <button

            type="button"

            onClick={() => setShowRoutes((prev) => !prev)}

            className="flex items-center gap-3 text-left"

          >

            <span className="text-sm font-semibold text-slate-100">Your routes</span>

            <span className="h-7 w-7 rounded-full border border-slate-700 text-slate-200 flex items-center justify-center">

              {showRoutes ? "-" : "+"}

            </span>

          </button>

          <span className="text-xs text-slate-400">{routes.length} total</span>

        </div>

        {showRoutes && (

          <>

            {routes.length === 0 ? (

              <div className="text-sm text-slate-400">No routes created yet.</div>

            ) : (

              <div className="space-y-2">

                {routes.map((route) => {

                  const interests = getInterestsForRoute(route.id);

                  const isExpanded = expandedRouteId === route.id;

                  const assignmentsForRoute =
                    assignmentsByRouteId.get(route.id) ?? [];

                  const defaultExpectedUnits = route.scheduleDays?.length
                    ? route.scheduleDays.length
                    : 5;

                  const lockDraft =
                    lockDrafts[route.id] ??
                    ({
                      seekerId: interests[0]?.seekerId ?? "",
                      startDate: todayInput(),
                      expectedUnits: String(defaultExpectedUnits),
                      unitType: "DAY",
                    } as const);

                  return (

                    <div

                      key={route.id}

                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"

                    >

                      <div className="flex flex-wrap items-start justify-between gap-3">

                        <div>

                          <div className="text-sm font-semibold text-slate-50">

                            {route.title}

                          </div>

                          <div className="text-[11px] text-slate-500 mt-0.5">

                            {route.audience} - {route.status} - Commitment: {route.commitmentType === "DEDICATED" ? "Dedicated" : "Flexible"} - Interested: {interests.length}

                          </div>

                        </div>

                        <div className="flex items-center gap-2">

                          <select

                            className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-50"

                            value={route.status}

                            disabled={!canEdit}

                            onChange={(e) => {

                              try {

                                updateRoute(route.id, {

                                  status: e.target.value as RouteStatus,

                                });

                                setRefresh((n) => n + 1);

                              } catch (err: any) {

                                onToast(err?.message || "Could not update route");

                              }

                            }}

                          >

                            <option value="ACTIVE">Active</option>

                            <option value="PAUSED">Paused</option>

                            <option value="CLOSED">Closed</option>

                          </select>

                          <button

                            type="button"

                            className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"

                            onClick={() =>

                              setExpandedRouteId((prev) =>

                                prev === route.id ? null : route.id

                              )

                            }

                          >

                            {isExpanded ? "Hide interested" : "View interested"}

                          </button>

                        </div>

                      </div>

                      {isExpanded && (

                        <div className="mt-3 border-t border-slate-800 pt-3 space-y-2">

                          {interests.length === 0 ? (

                            <div className="text-xs text-slate-500">

                              No Interested signals yet.

                            </div>

                          ) : (

                            interests.map((i) => {

                              const s = seekerById.get(i.seekerId);

                              const name = s ? formatSeekerName(s) : "Seeker";

                              return (

                                <div

                                  key={i.id}

                                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs"

                                >

                                  <div className="text-slate-200">{name}</div>

                                  <div className="text-[11px] text-slate-500">

                                    {new Date(i.createdAt).toLocaleString()}

                                  </div>

                                </div>

                              );

                            })

                          )}

                          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-400">
                              Lock in seeker
                            </div>
                            {interests.length === 0 ? (
                              <div className="text-xs text-slate-500">
                                No Interested seekers yet.
                              </div>
                            ) : (
                              <>
                                <div className="grid gap-2 md:grid-cols-4">
                                  <div className="space-y-1 md:col-span-2">
                                    <label className="text-[11px] text-slate-400">
                                      Seeker
                                    </label>
                                    <select
                                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-100"
                                      value={lockDraft.seekerId}
                                      onChange={(e) =>
                                        setLockDrafts((prev) => ({
                                          ...prev,
                                          [route.id]: {
                                            ...lockDraft,
                                            seekerId: e.target.value,
                                          },
                                        }))
                                      }
                                      disabled={!canEdit}
                                    >
                                      {interests.map((i) => {
                                        const seeker = seekerById.get(i.seekerId);
                                        const name = seeker
                                          ? formatSeekerName(seeker)
                                          : "Seeker";
                                        const link =
                                          linksBySeekerId.get(i.seekerId) ?? null;
                                        const statusLabel = link
                                          ? link.status === "ACTIVE"
                                            ? isWorkingTogether(link)
                                              ? "Active + working"
                                              : "Active (enable working)"
                                            : link.status
                                          : "No link";
                                        return (
                                          <option key={i.seekerId} value={i.seekerId}>
                                            {name} - {statusLabel}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] text-slate-400">
                                      Start date
                                    </label>
                                    <input
                                      type="date"
                                      value={lockDraft.startDate}
                                      onChange={(e) =>
                                        setLockDrafts((prev) => ({
                                          ...prev,
                                          [route.id]: {
                                            ...lockDraft,
                                            startDate: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-100"
                                      disabled={!canEdit}
                                    />
                                  </div>
                                  {route.commitmentType === "DEDICATED" && (
                                    <div className="space-y-1">
                                      <label className="text-[11px] text-slate-400">
                                        Expected units
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        value={lockDraft.expectedUnits}
                                        onChange={(e) =>
                                          setLockDrafts((prev) => ({
                                            ...prev,
                                            [route.id]: {
                                              ...lockDraft,
                                              expectedUnits: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-100"
                                        disabled={!canEdit}
                                      />
                                    </div>
                                  )}
                                </div>
                                {route.commitmentType === "DEDICATED" && (
                                  <div className="grid gap-2 md:grid-cols-2">
                                    <div className="space-y-1">
                                      <label className="text-[11px] text-slate-400">
                                        Unit type
                                      </label>
                                      <select
                                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-100"
                                        value={lockDraft.unitType}
                                        onChange={(e) =>
                                          setLockDrafts((prev) => ({
                                            ...prev,
                                            [route.id]: {
                                              ...lockDraft,
                                              unitType: e.target.value as WorkUnitType,
                                            },
                                          }))
                                        }
                                        disabled={!canEdit}
                                      >
                                        <option value="DAY">Day</option>
                                        <option value="SHIFT">Shift</option>
                                      </select>
                                    </div>
                                    <div className="text-[11px] text-slate-500 self-end">
                                      Cadence uses the retainer pay cycle.
                                    </div>
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                    disabled={!canEdit}
                                    onClick={() => {
                                      if (!retainer) return;
                                      if (!lockDraft.seekerId) {
                                        onToast("Select a seeker first");
                                        return;
                                      }
                                      const link =
                                        linksBySeekerId.get(lockDraft.seekerId) ??
                                        null;
                                      if (!link || link.status !== "ACTIVE") {
                                        onToast("Link must be active to lock in");
                                        return;
                                      }
                                      if (
                                        assignmentsForRoute.some(
                                          (a) =>
                                            a.seekerId === lockDraft.seekerId &&
                                            a.status === "ACTIVE"
                                        )
                                      ) {
                                        onToast("Seeker is already locked to this route");
                                        return;
                                      }
                                      const assignmentType: WorkUnitAssignmentType =
                                        route.commitmentType === "DEDICATED"
                                          ? "DEDICATED"
                                          : "ON_DEMAND";
                                      const unitType: WorkUnitType =
                                        assignmentType === "ON_DEMAND"
                                          ? "JOB"
                                          : lockDraft.unitType;
                                      const expectedUnits =
                                        assignmentType === "DEDICATED"
                                          ? Number(lockDraft.expectedUnits)
                                          : undefined;
                                      if (
                                        assignmentType === "DEDICATED" &&
                                        (!Number.isFinite(expectedUnits) ||
                                          (expectedUnits ?? 0) <= 0)
                                      ) {
                                        onToast("Enter expected units per pay cycle");
                                        return;
                                      }
                                      const startDate = lockDraft.startDate
                                        ? new Date(
                                            `${lockDraft.startDate}T00:00:00`
                                          ).toISOString()
                                        : new Date().toISOString();
                                      try {
                                        createRouteAssignment({
                                          routeId: route.id,
                                          retainerId: retainer.id,
                                          seekerId: lockDraft.seekerId,
                                          assignmentType,
                                          unitType,
                                          cadence:
                                            retainer.payCycleFrequency ?? "WEEKLY",
                                          expectedUnitsPerPeriod: expectedUnits,
                                          startDate,
                                        });
                                        onToast("Seeker locked in to route");
                                        setRefresh((n) => n + 1);
                                        setLockDrafts((prev) => ({
                                          ...prev,
                                          [route.id]: {
                                            ...lockDraft,
                                            startDate: todayInput(),
                                            expectedUnits: String(defaultExpectedUnits),
                                          },
                                        }));
                                      } catch (err: any) {
                                        onToast(
                                          err?.message || "Could not lock in seeker"
                                        );
                                      }
                                    }}
                                  >
                                    Lock in
                                  </button>
                                  <div className="text-[11px] text-slate-500">
                                    Scoring requires an active link and Working Together.
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-400">
                              Locked assignments
                            </div>
                            {assignmentsForRoute.length === 0 ? (
                              <div className="text-xs text-slate-500">
                                No locked seekers yet.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {assignmentsForRoute.map((assignment) => {
                                  const seeker =
                                    seekerById.get(assignment.seekerId) ?? null;
                                  const name = seeker
                                    ? formatSeekerName(seeker)
                                    : "Seeker";
                                  const periodKey = getCurrentPeriodKey(
                                    assignment.cadence
                                  );
                                  const period = getPeriodByKey(
                                    assignment.id,
                                    periodKey
                                  );
                                  const workDraft =
                                    workUnitDrafts[assignment.id] ?? {
                                      completedUnits:
                                        period?.completedUnits != null
                                          ? String(period.completedUnits)
                                          : "",
                                      acceptedUnits:
                                        period?.acceptedUnits != null
                                          ? String(period.acceptedUnits)
                                          : "",
                                    };
                                  const expectedUnits =
                                    assignment.assignmentType === "DEDICATED"
                                      ? assignment.expectedUnitsPerPeriod ??
                                        period?.expectedUnits
                                      : undefined;
                                  const link =
                                    linksBySeekerId.get(assignment.seekerId) ??
                                    null;
                                  const canScore = isWorkingTogether(link);
                                  const canSubmit =
                                    canEdit &&
                                    assignment.status === "ACTIVE" &&
                                    canScore &&
                                    (!period || period.status === "PENDING");
                                  const windowLabel = period?.windowClosesAt
                                    ? new Date(
                                        period.windowClosesAt
                                      ).toLocaleString()
                                    : "-";
                                  const statusLabel = period
                                    ? `${period.status} (${period.periodKey})`
                                    : `No period yet (${periodKey})`;
                                  return (
                                    <div
                                      key={assignment.id}
                                      className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2"
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                          <div className="text-xs font-semibold text-slate-100">
                                            {name}
                                          </div>
                                          <div className="text-[11px] text-slate-500">
                                            {assignment.assignmentType === "DEDICATED"
                                              ? "Dedicated"
                                              : "On-demand"}{" "}
                                            - {assignment.cadence} - Start:{" "}
                                            {toInputDate(assignment.startDate)}
                                          </div>
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                          {statusLabel}
                                        </div>
                                      </div>

                                      {period && (
                                        <div className="text-[11px] text-slate-500">
                                          Window closes: {windowLabel}
                                        </div>
                                      )}

                                      <div className="grid gap-2 md:grid-cols-3">
                                        {assignment.assignmentType === "ON_DEMAND" ? (
                                          <div className="space-y-1">
                                            <label className="text-[11px] text-slate-400">
                                              Accepted jobs
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              value={workDraft.acceptedUnits}
                                              onChange={(e) =>
                                                setWorkUnitDrafts((prev) => ({
                                                  ...prev,
                                                  [assignment.id]: {
                                                    ...workDraft,
                                                    acceptedUnits: e.target.value,
                                                  },
                                                }))
                                              }
                                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-100"
                                              disabled={!canEdit}
                                            />
                                          </div>
                                        ) : (
                                          <div className="space-y-1">
                                            <label className="text-[11px] text-slate-400">
                                              Expected units
                                            </label>
                                            <div className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200">
                                              {expectedUnits ?? "-"}
                                            </div>
                                          </div>
                                        )}
                                        <div className="space-y-1">
                                          <label className="text-[11px] text-slate-400">
                                            Completed units
                                          </label>
                                          <input
                                            type="number"
                                            min={0}
                                            value={workDraft.completedUnits}
                                            onChange={(e) =>
                                              setWorkUnitDrafts((prev) => ({
                                                ...prev,
                                                [assignment.id]: {
                                                  ...workDraft,
                                                  completedUnits: e.target.value,
                                                },
                                              }))
                                            }
                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-100"
                                            disabled={!canEdit}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[11px] text-slate-400">
                                            Missed units
                                          </label>
                                          <div className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200">
                                            {period?.missedUnits ?? "-"}
                                          </div>
                                        </div>
                                      </div>

                                      {!canScore && (
                                        <div className="text-[11px] text-amber-300">
                                          Enable Working Together on the link to
                                          submit reputation points.
                                        </div>
                                      )}

                                      {period?.status === "DISPUTED" && (
                                        <div className="text-[11px] text-rose-300">
                                          Disputed. Awaiting admin review.
                                        </div>
                                      )}

                                      <div className="flex flex-wrap items-center gap-2">
                                        <button
                                          type="button"
                                          className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                          disabled={!canSubmit}
                                          onClick={() => {
                                            const completed = Number(
                                              workDraft.completedUnits
                                            );
                                            if (
                                              !Number.isFinite(completed) ||
                                              completed < 0
                                            ) {
                                              onToast("Enter completed units");
                                              return;
                                            }
                                            if (
                                              assignment.assignmentType ===
                                              "DEDICATED"
                                            ) {
                                              if (
                                                expectedUnits == null ||
                                                expectedUnits <= 0
                                              ) {
                                                onToast(
                                                  "Expected units are required"
                                                );
                                                return;
                                              }
                                              if (completed > expectedUnits) {
                                                onToast(
                                                  "Completed units cannot exceed expected"
                                                );
                                                return;
                                              }
                                            } else {
                                              const accepted = Number(
                                                workDraft.acceptedUnits
                                              );
                                              if (
                                                !Number.isFinite(accepted) ||
                                                accepted < 0
                                              ) {
                                                onToast("Enter accepted jobs");
                                                return;
                                              }
                                              if (completed > accepted) {
                                                onToast(
                                                  "Completed units cannot exceed accepted"
                                                );
                                                return;
                                              }
                                            }
                                            try {
                                              const accepted =
                                                assignment.assignmentType ===
                                                "ON_DEMAND"
                                                  ? Number(workDraft.acceptedUnits)
                                                  : undefined;
                                              let targetPeriod = period;
                                              if (!targetPeriod) {
                                                targetPeriod = createWorkUnitPeriod({
                                                  assignmentId: assignment.id,
                                                  periodKey,
                                                  cadence: assignment.cadence,
                                                  expectedUnits,
                                                  acceptedUnits: accepted,
                                                });
                                              }
                                              if (
                                                targetPeriod &&
                                                targetPeriod.status !== "PENDING"
                                              ) {
                                                onToast(
                                                  "This period is already finalized"
                                                );
                                                return;
                                              }
                                              submitWorkUnitCounts({
                                                periodId: targetPeriod.id,
                                                completedUnits: completed,
                                                acceptedUnits: accepted,
                                                expectedUnits,
                                              });
                                              onToast("Reputation points submitted");
                                              setRefresh((n) => n + 1);
                                            } catch (err: any) {
                                              onToast(
                                                err?.message ||
                                                  "Could not submit reputation points"
                                              );
                                            }
                                          }}
                                        >
                                          Submit reputation points
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                        </div>

                      )}

                    </div>

                  );

                })}

              </div>

            )}

          </>

        )}

      </section>

    </div>

  );

};

