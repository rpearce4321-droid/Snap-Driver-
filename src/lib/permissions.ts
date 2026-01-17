// src/lib/permissions.ts
export type Role = "ADMIN" | "SEEKER" | "RETAINER";

export type Resource =
  | "seekerProfile"
  | "retainerProfile"
  | "approvals"
  | "messages"
  | "adminDashboard"
  | "portal";

export type Action =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "restore"
  | "purge"
  | "send"
  | "flag"
  | "publish"
  | "hide";

export type PermissionContext = {
  role: Role;
  actorId?: string | null;

  // Optional ownership checks (use when you have ids available)
  seekerId?: string | null;
  retainerId?: string | null;

  // Portal hint (optional)
  portal?: Role | null;
};

type Rule = (action: Action, ctx: PermissionContext) => boolean;

const isAdmin: Rule = (_a, ctx) => ctx.role === "ADMIN";

const ownsSeeker: Rule = (_a, ctx) =>
  ctx.role === "SEEKER" &&
  !!ctx.actorId &&
  !!ctx.seekerId &&
  ctx.actorId === ctx.seekerId;

const ownsRetainer: Rule = (_a, ctx) =>
  ctx.role === "RETAINER" &&
  !!ctx.actorId &&
  !!ctx.retainerId &&
  ctx.actorId === ctx.retainerId;

/**
 * Central ACL table.
 * Keep it conservative — allow only what we explicitly want.
 */
const ACL: Record<Resource, Rule> = {
  portal: (action, _ctx) => {
    // Everyone can "view" their portal area in UI. (Real auth comes later.)
    if (action === "view") return true;
    return false;
  },

  adminDashboard: (action, ctx) => {
    if (!isAdmin(action, ctx)) return false;
    return action === "view";
  },

  seekerProfile: (action, ctx) => {
    // Admin can view/update/delete/purge/restore/approve/reject
    if (ctx.role === "ADMIN") {
      return (
        action === "view" ||
        action === "update" ||
        action === "delete" ||
        action === "restore" ||
        action === "purge" ||
        action === "approve" ||
        action === "reject" ||
        action === "create"
      );
    }

    // Seeker can view/update their own profile; create if they have none
    if (ctx.role === "SEEKER") {
      if (action === "create") return true;
      if (action === "view" || action === "update") return ownsSeeker(action, ctx);
      return false;
    }

    // Retainer can only view seekers that are approved (enforced elsewhere by filtering);
    // permission system stays conservative here.
    if (ctx.role === "RETAINER") {
      return action === "view";
    }

    return false;
  },

  retainerProfile: (action, ctx) => {
    if (ctx.role === "ADMIN") {
      return (
        action === "view" ||
        action === "update" ||
        action === "delete" ||
        action === "restore" ||
        action === "purge" ||
        action === "approve" ||
        action === "reject" ||
        action === "create"
      );
    }

    if (ctx.role === "RETAINER") {
      if (action === "create") return true;
      if (action === "view" || action === "update") return ownsRetainer(action, ctx);
      return false;
    }

    if (ctx.role === "SEEKER") {
      return action === "view";
    }

    return false;
  },

  approvals: (action, ctx) => {
    // Only admin approves/rejects
    if (!isAdmin(action, ctx)) return false;
    return action === "view" || action === "approve" || action === "reject";
  },

  messages: (action, ctx) => {
    // Admin: can view + flag
    if (ctx.role === "ADMIN") {
      return action === "view" || action === "flag";
    }

    // Seeker/Retainer: can view + send (ownership validated in messages layer by ids)
    if (ctx.role === "SEEKER") return action === "view" || action === "send";
    if (ctx.role === "RETAINER") return action === "view" || action === "send";

    return false;
  },
};

export function can(resource: Resource, action: Action, ctx: PermissionContext): boolean {
  const rule = ACL[resource];
  if (!rule) return false;
  return rule(action, ctx);
}

export function assertCan(
  resource: Resource,
  action: Action,
  ctx: PermissionContext,
  message?: string
): void {
  if (!can(resource, action, ctx)) {
    throw new Error(
      message ||
        `Permission denied: role=${ctx.role} cannot ${action} on ${resource}`
    );
  }
}

