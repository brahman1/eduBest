import { calendarDay, shiftDay } from "./calendar";

export type HomeRow = Record<string, any>;
export const childColors = [
  "#315D76",
  "#236F59",
  "#80551E",
  "#74529A",
  "#A84046",
  "#276F85",
];
/** Presentation filters only. Authorization is enforced by the API before these data arrive. */
export function personalHome(data: HomeRow, selected = "", now = new Date()) {
  const personal = data.personal ?? {};
  const children: HomeRow[] = personal.children ?? [];
  const child = children.find((c) => c.id === selected);
  const childId = child?.id ?? "";
  const today = calendarDay(now);
  const matches = (r: HomeRow) =>
    !childId || r.children?.some((c: HomeRow) => c.id === childId);
  const agenda: HomeRow[] = (personal.agenda ?? [])
    .filter(matches)
    .sort(
      (a: HomeRow, b: HomeRow) =>
        Date.parse(a.starts_at) - Date.parse(b.starts_at),
    );
  const next = agenda.find(
    (r) => r.status === "scheduled" && Date.parse(r.ends_at) > now.getTime(),
  );
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(today, i));
  const week = agenda.filter((r) => days.includes(calendarDay(r.starts_at)));
  const day = week.filter((r) => calendarDay(r.starts_at) === today);
  const pending = agenda.filter(
    (r) =>
      r.call &&
      r.status !== "cancelled" &&
      Date.parse(r.starts_at) <= now.getTime(),
  );
  const outstanding: HomeRow[] = (
    data.outstanding_personal ??
    data.outstanding ??
    []
  ).filter((r: HomeRow) => !childId || r.student_id === childId);
  const announcements: HomeRow[] = (personal.announcements ?? []).filter(
    (r: HomeRow) =>
      !child || !r.group_id || child.group_ids.includes(r.group_id),
  );
  const absences: HomeRow[] = (personal.absences ?? []).filter(
    (r: HomeRow) => !childId || r.student_id === childId,
  );
  const stats = data.attendance_breakdown
    ? {
        ...data.attendance_breakdown,
        students: (data.attendance_breakdown.students ?? []).filter(
          (r: HomeRow) => !childId || r.id === childId,
        ),
        teachers: childId ? [] : data.attendance_breakdown.teachers,
      }
    : null;
  return {
    children,
    childId,
    today,
    days,
    week,
    day,
    next,
    pending,
    outstanding,
    announcements,
    absences,
    stats,
    notices: personal.notices ?? [],
    cancelled: week.filter(
      (r) => r.status === "cancelled" && Date.parse(r.ends_at) > now.getTime(),
    ),
  };
}
