import { PoolClient } from "pg";
import { z } from "zod";
import { User, adminRoles } from "@edubest/shared";
import { db } from "./db";
import { parse, permit } from "./security";
type DB = PoolClient | typeof db;
export async function payroll(u: User, month: string, c: DB = db) {
  permit(u, [...adminRoles, "CASHIER", "TEACHER"]);
  parse(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), month);
  const teachers = (
    await c.query(
      `SELECT id,name,active FROM users WHERE tenant_id=$1 AND role='TEACHER' ${u.role === "TEACHER" ? "AND active AND id=$2" : ""} ORDER BY name`,
      u.role === "TEACHER" ? [u.tenant_id, u.id] : [u.tenant_id],
    )
  ).rows;
  const result = [];
  for (const t of teachers) {
    const parts = (
      await c.query(
        `SELECT g.id::text||':'||l.pay_mode||':'||l.pay_value::text AS id,g.name,l.pay_mode,l.pay_value,count(*)::int AS session_count,sum(extract(epoch FROM(l.ends_at-l.starts_at))/3600)::float AS hours,0::bigint AS collected_centimes FROM lessons l JOIN groups g ON g.id=l.group_id AND g.tenant_id=l.tenant_id WHERE l.tenant_id=$1 AND l.teacher_id=$3 AND l.status='completed' AND l.pay_mode IN('session','hour') AND to_char(l.starts_at AT TIME ZONE 'Africa/Algiers','YYYY-MM')=$2 GROUP BY g.id,g.name,l.pay_mode,l.pay_value UNION ALL SELECT g.id::text||':percent:'||i.pay_percent_bp::text,g.name,'percent',i.pay_percent_bp,0,0,COALESCE(sum(CASE WHEN p.kind='payment' THEN p.amount_centimes ELSE -p.amount_centimes END),0)::bigint FROM payments p JOIN invoices i ON i.id=p.invoice_id AND i.tenant_id=p.tenant_id JOIN groups g ON g.id=i.group_id AND g.tenant_id=i.tenant_id WHERE p.tenant_id=$1 AND i.teacher_id=$3 AND i.pay_percent_bp>0 AND to_char(p.created_at AT TIME ZONE 'Africa/Algiers','YYYY-MM')=$2 GROUP BY g.id,g.name,i.pay_percent_bp`,
        [u.tenant_id, month, t.id],
      )
    ).rows;
    for (const g of parts)
      g.earned_centimes = Math.round(
        g.pay_mode === "percent"
          ? (g.collected_centimes * g.pay_value) / 10000
          : g.pay_mode === "hour"
            ? g.hours * g.pay_value
            : g.session_count * g.pay_value,
      );
    const earned = parts.reduce(
      (n, g) =>
        n +
        Math.round(
          g.pay_mode === "percent"
            ? (g.collected_centimes * g.pay_value) / 10000
            : g.pay_mode === "hour"
              ? g.hours * g.pay_value
              : g.session_count * g.pay_value,
        ),
      0,
    );
    const paid = (
      await c.query(
        "SELECT COALESCE(sum(amount_centimes),0)::bigint AS total FROM payroll_payments WHERE tenant_id=$1 AND teacher_id=$2 AND month=$3",
        [u.tenant_id, t.id, month],
      )
    ).rows[0].total;
    result.push({
      ...t,
      earned_centimes: earned,
      paid_centimes: paid,
      balance_centimes: earned - paid,
      groups: parts,
    });
  }
  return result;
}
