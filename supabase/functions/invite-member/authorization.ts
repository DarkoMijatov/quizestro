export type InviteRole = "user" | "admin";
export type CallerRole = "owner" | "admin" | "user";

export function isInviteRole(value: unknown): value is InviteRole {
  return value === "user" || value === "admin";
}

export function canInviteRole(callerRole: CallerRole, requestedRole: InviteRole): boolean {
  if (callerRole === "owner") return true;
  if (callerRole === "admin") return requestedRole === "user";
  return false;
}
