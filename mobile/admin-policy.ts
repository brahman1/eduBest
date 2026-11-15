import { adminRoles, Role } from "@edubest/shared";

export function canRemoveSession(
  role: Role,
  session: { status?: string; starts_at?: string },
  now = Date.now(),
) {
  return (
    adminRoles.includes(role) &&
    session.status === "scheduled" &&
    Date.parse(session.starts_at ?? "") > now
  );
}

export function canRemoveTeacher(
  role: Role,
  target: { role?: string; active?: boolean },
) {
  return (
    adminRoles.includes(role) &&
    target.role === "TEACHER" &&
    target.active === true
  );
}
