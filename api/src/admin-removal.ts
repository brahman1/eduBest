import { ConflictException, NotFoundException } from "@nestjs/common";
import { adminRoles } from "@edubest/shared";
import { AuthRequest, permit, uuid, uid } from "./security";
import { requireRecent } from "./protection";
import { transaction } from "./db";
import { notify } from "./mail";

/** Retire active records without destroying attendance, invoices or earned pay. */
export async function adminRemoval(
  req: AuthRequest,
  key: string,
  path: string,
) {
  if (!/^DELETE (groups|sessions|users)\/[\w-]+$/.test(key))
    return { handled: false };
  const u = req.user;
  permit(u, adminRoles);
  await requireRecent(req);
  const [kind, raw] = path.split("/"),
    id = uuid(raw);
  const result = await transaction(async (c) => {
    await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
      u.tenant_id,
    ]);
    let groupIds: string[] = [],
      action = "",
      detail: Record<string, unknown> = {},
      title = "",
      message = "";
    if (kind === "groups") {
      const g = (
        await c.query(
          "SELECT * FROM groups WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
          [u.tenant_id, id],
        )
      ).rows[0];
      if (!g) throw new NotFoundException("Cours introuvable");
      if (!g.active) return { ok: true, already_removed: true };
      const cancelled = await c.query(
        "UPDATE lessons SET status='cancelled' WHERE tenant_id=$1 AND group_id=$2 AND status='scheduled' AND starts_at>=now() RETURNING id",
        [u.tenant_id, id],
      );
      await c.query(
        "UPDATE groups SET active=false WHERE tenant_id=$1 AND id=$2",
        [u.tenant_id, id],
      );
      groupIds = [id];
      action = "group.archive";
      detail = { cancelled: cancelled.rowCount };
      title = "Cours retiré / سحب درس";
      message = `${g.name} : cours retiré des groupes actifs. ${cancelled.rowCount} séances futures annulées. L’historique et les échéances sont conservés. / تم سحب الدرس من المجموعات النشطة وإلغاء حصصه القادمة، مع حفظ السجل والمستحقات.`;
    } else if (kind === "sessions") {
      const l = (
        await c.query(
          "SELECT l.*,g.name AS group_name FROM lessons l JOIN groups g ON g.tenant_id=l.tenant_id AND g.id=l.group_id WHERE l.tenant_id=$1 AND l.id=$2 FOR UPDATE OF l",
          [u.tenant_id, id],
        )
      ).rows[0];
      if (!l) throw new NotFoundException("Séance introuvable");
      if (l.status === "cancelled") return { ok: true, already_removed: true };
      if (l.status !== "scheduled" || Date.parse(l.starts_at) < Date.now())
        throw new ConflictException(
          "Seule une séance future non commencée peut être supprimée. L’historique reste conservé.",
        );
      await c.query(
        "UPDATE lessons SET status='cancelled' WHERE tenant_id=$1 AND id=$2",
        [u.tenant_id, id],
      );
      groupIds = [l.group_id];
      action = "session.remove";
      title = "Séance annulée / حصة ملغاة";
      message = `${l.group_name} · ${new Date(l.starts_at).toLocaleString("fr-DZ", { timeZone: "Africa/Algiers" })} : séance retirée du planning actif. / تم إلغاء هذه الحصة. راجع جدولك.`;
    } else {
      const teacher = (
        await c.query(
          "SELECT id,name,active FROM users WHERE tenant_id=$1 AND id=$2 AND role='TEACHER' FOR UPDATE",
          [u.tenant_id, id],
        )
      ).rows[0];
      if (!teacher) throw new NotFoundException("Enseignant introuvable");
      if (!teacher.active) return { ok: true, already_removed: true };
      groupIds = (
        await c.query(
          "SELECT id FROM groups WHERE tenant_id=$1 AND teacher_id=$2 AND active",
          [u.tenant_id, id],
        )
      ).rows.map((r) => r.id);
      await c.query(
        "UPDATE groups SET teacher_id=NULL WHERE tenant_id=$1 AND teacher_id=$2 AND active",
        [u.tenant_id, id],
      );
      const reassigned = await c.query(
        "UPDATE lessons SET teacher_id=NULL WHERE tenant_id=$1 AND teacher_id=$2 AND status='scheduled' AND starts_at>=now() RETURNING id",
        [u.tenant_id, id],
      );
      await c.query(
        "UPDATE users SET active=false WHERE tenant_id=$1 AND id=$2",
        [u.tenant_id, id],
      );
      await c.query("DELETE FROM auth_sessions WHERE user_id=$1", [id]);
      await c.query("DELETE FROM auth_tokens WHERE user_id=$1", [id]);
      await c.query("DELETE FROM device_tokens WHERE user_id=$1", [id]);
      await c.query(
        "UPDATE outbox SET state='failed',last_error='Compte retiré',error_code='account_disabled' WHERE tenant_id=$1 AND user_id=$2 AND state IN('pending','sending')",
        [u.tenant_id, id],
      );
      action = "teacher.archive";
      detail = { groups: groupIds.length, sessions: reassigned.rowCount };
      title = "Enseignant à réaffecter / أستاذ قيد التعيين";
      message = `${teacher.name} ne fait plus partie de l’équipe active. Les cours restent programmés ; la direction doit réaffecter l’enseignant. / لم يعد الأستاذ ضمن الفريق النشط. تبقى الحصص مبرمجة وسيُعيَّن أستاذ لها.`;
    }
    if (groupIds.length) {
      const recipients = (
        await c.query(
          "SELECT DISTINCT r.id FROM (SELECT g.teacher_id AS id FROM groups g WHERE g.tenant_id=$1 AND g.id=ANY($2::uuid[]) UNION SELECT unnest(ARRAY[s.parent_id,s.user_id]) FROM students s JOIN enrollments e ON e.tenant_id=s.tenant_id AND e.student_id=s.id WHERE s.tenant_id=$1 AND s.active AND e.group_id=ANY($2::uuid[])) r JOIN users u ON u.tenant_id=$1 AND u.id=r.id AND u.active",
          [u.tenant_id, groupIds],
        )
      ).rows;
      for (const r of recipients)
        await notify(c, u.tenant_id, r.id, title, message, {
          path: "sessions",
          topic: "planning",
          resource: id,
        });
    }
    await c.query(
      "INSERT INTO audit(id,tenant_id,user_id,action,entity_id,detail) VALUES($1,$2,$3,$4,$5,$6)",
      [uid(), u.tenant_id, u.id, action, id, JSON.stringify(detail)],
    );
    return { ok: true, ...detail };
  });
  return { handled: true, value: result };
}
