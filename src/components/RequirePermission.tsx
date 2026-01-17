// src/components/RequirePermission.tsx
import React, { useMemo } from "react";
import { getSession } from "../lib/session";
import {
  can,
  type Action,
  type PermissionContext,
  type Resource,
} from "../lib/permissions";

type Props = {
  resource: Resource;
  action: Action;
  ctx?: Omit<PermissionContext, "role">;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export default function RequirePermission({
  resource,
  action,
  ctx,
  children,
  fallback,
}: Props) {
  const session = useMemo(() => getSession(), []);
  const role = session?.role;

  const allowed = role ? can(resource, action, { role, ...(ctx ?? {}) }) : false;
  if (allowed) return <>{children}</>;

  return (
    <>
      {fallback ?? (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-200">
          <div className="text-lg font-semibold">Access denied</div>
          <div className="text-sm text-slate-400 mt-1">
            You don&apos;t have permission to view this section.
          </div>
        </div>
      )}
    </>
  );
}
