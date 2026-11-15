import { User } from "@edubest/shared";
import { db } from "./db";

type Row = Record<string, any>;
/** All supplied students, groups and lessons have already passed the domain scopes. */
export async function personalDashboard(
  u: User,
  students: Row[],
  groups: Row[],
  lessons: Row[],
) {
  if (!["PARENT", "STUDENT", "TEACHER"].includes(u.role)) return null;
  const family = u.role !== "TEACHER";
  const ids = family ? students.map((s) => s.id) : [];
  const groupIds = groups.map((g) => g.id);
  const [enrollments, notices, announcements, calls, absences] =
    await Promise.all([
      family
        ? db.query(
            "SELECT student_id,group_id FROM enrollments WHERE tenant_id=$1 AND student_id=ANY($2::uuid[])",
            [u.tenant_id, ids],
          )
        : Promise.resolve({ rows: [] }),
      db.query(
        "SELECT id,title,body,created_at FROM notifications WHERE tenant_id=$1 AND user_id=$2 AND NOT seen ORDER BY created_at DESC LIMIT 8",
        [u.tenant_id, u.id],
      ),
      db.query(
        "SELECT id,title,body,group_id,created_at FROM announcements WHERE tenant_id=$1 AND (group_id IS NULL OR group_id=ANY($2::uuid[])) AND created_at>=now()-interval '30 days' ORDER BY created_at DESC LIMIT 8",
        [u.tenant_id, groupIds],
      ),
      !family
        ? db.query(
            `SELECT l.id,count(s.id)::int AS expected,count(s.id) FILTER(WHERE a.status IN('present','late','absent'))::int AS marked FROM lessons l JOIN groups g ON g.tenant_id=l.tenant_id AND g.id=l.group_id JOIN enrollments e ON e.tenant_id=g.tenant_id AND e.group_id=g.id JOIN students s ON s.tenant_id=e.tenant_id AND s.id=e.student_id AND s.active LEFT JOIN attendance a ON a.tenant_id=l.tenant_id AND a.lesson_id=l.id AND a.student_id=s.id WHERE l.tenant_id=$1 AND g.teacher_id=$2 AND l.status IN('scheduled','completed') AND l.starts_at<=now() AND l.starts_at>=now()-interval '30 days' GROUP BY l.id HAVING count(s.id) FILTER(WHERE a.status IN('present','late','absent'))<count(s.id) OR l.status='scheduled' ORDER BY min(l.starts_at)`,
            [u.tenant_id, u.id],
          )
        : Promise.resolve({ rows: [] }),
      family
        ? db.query(
            `SELECT a.lesson_id,a.student_id,a.decision,l.starts_at,g.name AS group_name,s.name AS student_name FROM attendance a JOIN lessons l ON l.tenant_id=a.tenant_id AND l.id=a.lesson_id JOIN groups g ON g.tenant_id=l.tenant_id AND g.id=l.group_id JOIN students s ON s.tenant_id=a.tenant_id AND s.id=a.student_id WHERE a.tenant_id=$1 AND a.student_id=ANY($2::uuid[]) AND a.status='absent' AND l.status='completed' AND l.starts_at>=now()-interval '30 days' ORDER BY l.starts_at DESC LIMIT 12`,
            [u.tenant_id, ids],
          )
        : Promise.resolve({ rows: [] }),
    ]);
  const children = family
    ? students.map((s) => ({
        id: s.id,
        name: s.name,
        level: s.level,
        group_ids: enrollments.rows
          .filter((e: Row) => e.student_id === s.id)
          .map((e: Row) => e.group_id),
      }))
    : [];
  const agenda = lessons.map((l) => ({
    id: l.id,
    group_id: l.group_id,
    group_name: l.group_name,
    subject: l.subject,
    starts_at: l.starts_at,
    ends_at: l.ends_at,
    room: l.room,
    notes: l.notes,
    status: l.status,
    teacher_name: l.teacher_name,
    student_count: l.student_count,
    children: children
      .filter((c) => c.group_ids.includes(l.group_id))
      .map((c) => ({ id: c.id, name: c.name })),
    ...(family
      ? {}
      : { call: calls.rows.find((r: Row) => r.id === l.id) ?? null }),
  }));
  return {
    generated_at: new Date().toISOString(),
    children,
    agenda,
    notices: notices.rows,
    announcements: announcements.rows,
    absences: absences.rows,
  };
}
