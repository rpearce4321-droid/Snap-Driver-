// src/components/PermissionGate.tsx
import React from "react";
import type { Action, PermissionContext, Resource } from "../lib/permissions";
import { can } from "../lib/permissions";

type Props = {
  resource: Resource;
  action: Action;
  ctx: PermissionContext;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export default function PermissionGate({
  resource,
  action,
  ctx,
  children,
  fallback = null,
}: Props) {
  return <>{can(resource, action, ctx) ? children : fallback}</>;
}

