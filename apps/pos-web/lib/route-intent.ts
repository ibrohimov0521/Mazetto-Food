import { adminNavGroups } from "./admin-nav";

export type RouteIntent = "sidebar" | "child" | "workspace" | "hidden";

const sidebarRoutes = new Set(
  adminNavGroups.flatMap((group) => group.items.map((item) => item.href)),
);

const childRoutes = new Set([
  "/admin/orders/:id",
  "/admin/products/new",
  "/admin/products/:id",
  "/admin/staff/new",
  "/admin/staff/:id",
  "/admin/branches/:branchId",
  "/admin/branches/:branchId/devices",
  "/admin/branches/:branchId/halls/:hallId",
  "/admin/branches/:branchId/halls/:hallId/tables/:tableId",
]);

const workspaceRoutes = new Set(["/accounting", "/manager/dashboard"]);
const hiddenRoutes = new Set(["/admin", "/admin/menu", "/admin/tables"]);

export function resolveRouteIntent(pattern: string): RouteIntent | null {
  if (sidebarRoutes.has(pattern)) return "sidebar";
  if (childRoutes.has(pattern)) return "child";
  if (workspaceRoutes.has(pattern)) return "workspace";
  if (hiddenRoutes.has(pattern)) return "hidden";
  return null;
}

export const explicitNonSidebarRoutes = {
  child: childRoutes,
  workspace: workspaceRoutes,
  hidden: hiddenRoutes,
} as const;
