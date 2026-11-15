import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { Response } from "express";
import { PoolClient } from "pg";
import { z } from "zod";
import { adminRoles, day, id, User } from "@edubest/shared";
import { db, transaction } from "./db";
import { AuthRequest, parse, permit, uid, uuid } from "./security";
import { enforceRate, requireRecent } from "./protection";
import { invoiceNotice } from "./mail";
import { payroll } from "./compensation";
import { workbook } from "./xlsx";

export async function studentIdentity(
  c: PoolClient,
  u: User,
  v: { user_id?: string | null; name: string },
  sid?: string,
) {
  if (!v.user_id) return v.name;
  await c.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text,9147))",
    [v.user_id],
  );
  const account = (
    await c.query(
      "SELECT name FROM users WHERE tenant_id=$1 AND id=$2 AND role='STUDENT' AND active FOR UPDATE",
      [u.tenant_id, v.user_id],
    )
  ).rows[0];
  if (!account) throw new BadRequestException("Compte élève invalide");
  const links = await c.query(
    "SELECT id,user_id FROM students WHERE tenant_id=$1 AND user_id=$2 AND ($3::uuid IS NULL OR id<>$3)",
    [u.tenant_id, v.user_id, sid ?? null],
  );
  if (links.rowCount)
    throw new ConflictException(
      "Ce compte possède déjà un dossier dans Élèves & familles. Modifiez ce dossier au lieu de créer un doublon.",
    );
  const current = sid
    ? (
        await c.query(
          "SELECT user_id FROM students WHERE tenant_id=$1 AND id=$2",
          [u.tenant_id, sid],
        )
      ).rows[0]
    : null;
  if (current?.user_id === v.user_id) {
    await c.query("UPDATE users SET name=$1 WHERE tenant_id=$2 AND id=$3", [
      v.name,
      u.tenant_id,
      v.user_id,
    ]);
    return v.name;
  }
  return account.name as string;
}
export function reportRange(query: Record<string, unknown> = {}) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Algiers",
  });
  const v = parse(
    z
      .object({ from: day, to: day })
      .refine(
        (v) =>
          v.from <= v.to &&
          (Date.parse(v.to) - Date.parse(v.from)) / 86400000 <= 731,
        "Période invalide (deux ans maximum)",
      ),
    {
      from:
        query.from ??
        new Date(Date.now() - 29 * 86400000).toLocaleDateString("en-CA", {
          timeZone: "Africa/Algiers",
        }),
      to: query.to ?? today,
    },
  );
  return v;
}
export async function attendanceReport(u: User, range = reportRange()) {
  const args: unknown[] = [
    u.tenant_id,
    `${range.from}T00:00:00+01:00`,
    `${range.to}T00:00:00+01:00`,
  ];
  let scope = "";
  if (u.role === "TEACHER") {
    args.push(u.id);
    scope = " AND l.teacher_id=$4";
  }
  if (u.role === "PARENT") {
    args.push(u.id);
    scope = " AND s.parent_id=$4";
  }
  if (u.role === "STUDENT") {
    args.push(u.id);
    scope = " AND s.user_id=$4";
  }
  const base = `FROM attendance a JOIN lessons l ON l.tenant_id=a.tenant_id AND l.id=a.lesson_id JOIN students s ON s.tenant_id=a.tenant_id AND s.id=a.student_id LEFT JOIN users t ON t.tenant_id=l.tenant_id AND t.id=l.teacher_id WHERE a.tenant_id=$1 AND l.status='completed' AND l.starts_at>=$2::timestamptz AND l.starts_at<$3::timestamptz+interval '1 day' ${scope}`;
  const counts = `count(*) FILTER(WHERE a.status='present')::int AS present,count(*) FILTER(WHERE a.status='late')::int AS late,count(*) FILTER(WHERE a.status='absent')::int AS absent,count(*) FILTER(WHERE a.status IN ('present','late','absent'))::int AS marked,count(*) FILTER(WHERE a.status='unmarked')::int AS unmarked`;
  const decorate = (row: any) => ({
    ...row,
    presence_rate: row.marked
      ? Math.round(((row.present + row.late) * 10000) / row.marked) / 100
      : null,
    absence_rate: row.marked
      ? Math.round((row.absent * 10000) / row.marked) / 100
      : null,
  });
  const students = (
    await db.query(
      `SELECT s.id,s.name,${counts} ${base} GROUP BY s.id,s.name ORDER BY s.name`,
      args,
    )
  ).rows.map(decorate);
  const teachers = (
    await db.query(
      `SELECT l.teacher_id AS id,COALESCE(t.name,'Non attribué') AS name,${counts} ${base} GROUP BY l.teacher_id,t.name ORDER BY name`,
      args,
    )
  ).rows.map(decorate);
  return {
    from: range.from,
    to: range.to,
    students,
    teachers,
    definition:
      "Présences des élèves : présents + retards / appels renseignés. Absences : absents / appels renseignés. Séances terminées uniquement ; non renseignés exclus.",
  };
}
async function exportData(
  u: User,
  range: { from: string; to: string },
  dataset: string,
) {
  const args = [
    u.tenant_id,
    `${range.from}T00:00:00+01:00`,
    `${range.to}T00:00:00+01:00`,
  ];
  const sets: { name: string; rows: Record<string, unknown>[] }[] = [];
  const add = async (
    name: string,
    sql: string,
    values: unknown[] = [u.tenant_id],
  ) => {
    const rows = (await db.query(sql, values)).rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          k.endsWith("_DA") && v !== null ? Number(v) : v,
        ]),
      ),
    );
    if (rows.length > 50000)
      throw new BadRequestException(
        "Export trop volumineux : réduisez la période.",
      );
    sets.push({ name, rows });
  };
  if (["all", "students"].includes(dataset))
    await add(
      "Eleves",
      `SELECT s.id,s.name AS nom,s.level AS niveau,s.phone AS telephone,s.birth_date AS naissance,s.active AS actif,p.name AS parent,p.email AS email_parent,u.email AS email_eleve FROM students s LEFT JOIN users p ON p.tenant_id=s.tenant_id AND p.id=s.parent_id LEFT JOIN users u ON u.tenant_id=s.tenant_id AND u.id=s.user_id WHERE s.tenant_id=$1 ORDER BY s.name`,
    );
  if (["all", "parents", "teachers"].includes(dataset)) {
    for (const [which, role, title] of [
      ["parents", "PARENT", "Parents"],
      ["teachers", "TEACHER", "Enseignants"],
    ]) {
      if (dataset !== "all" && dataset !== which) continue;
      await add(
        title,
        "SELECT id,name AS nom,email,locale AS langue,verified AS email_verifie,active AS actif FROM users WHERE tenant_id=$1 AND role=$2 ORDER BY name",
        [u.tenant_id, role],
      );
    }
  }
  if (["all", "finance"].includes(dataset)) {
    await add(
      "Echeances",
      `SELECT i.id,s.name AS eleve,i.label AS libelle,i.due_date AS echeance,i.status AS statut,i.amount_centimes/100.0 AS montant_DA,i.paid_centimes/100.0 AS paye_DA,i.balance_centimes/100.0 AS solde_DA FROM invoice_balances i JOIN students s ON s.tenant_id=i.tenant_id AND s.id=i.student_id WHERE i.tenant_id=$1 AND i.due_date>=$2::timestamptz::date AND i.due_date<=$3::timestamptz::date ORDER BY i.due_date`,
      args,
    );
    await add(
      "Mouvements",
      `SELECT p.id,p.created_at AS date,p.kind AS nature,p.method AS mode,p.receipt_number AS recu,s.name AS eleve,p.amount_centimes/100.0 AS montant_DA,p.reference FROM payments p JOIN invoices i ON i.tenant_id=p.tenant_id AND i.id=p.invoice_id JOIN students s ON s.tenant_id=i.tenant_id AND s.id=i.student_id WHERE p.tenant_id=$1 AND p.created_at>=$2::timestamptz AND p.created_at<$3::timestamptz+interval '1 day' ORDER BY p.created_at`,
      args,
    );
    await add(
      "Remunerations versees",
      `SELECT t.name AS enseignant,p.month AS mois,p.amount_centimes/100.0 AS montant_DA,p.reference,p.created_at AS date FROM payroll_payments p JOIN users t ON t.tenant_id=p.tenant_id AND t.id=p.teacher_id WHERE p.tenant_id=$1 AND p.created_at>=$2::timestamptz AND p.created_at<$3::timestamptz+interval '1 day' ORDER BY p.created_at`,
      args,
    );
    const remuneration: Record<string, unknown>[] = [];
    const cursor = new Date(range.from.slice(0, 7) + "-01T00:00:00Z");
    while (cursor.toISOString().slice(0, 7) <= range.to.slice(0, 7)) {
      const month = cursor.toISOString().slice(0, 7);
      for (const t of await payroll(u, month))
        remuneration.push({
          mois: month,
          enseignant: t.name,
          calcule_DA: t.earned_centimes / 100,
          verse_DA: t.paid_centimes / 100,
          solde_DA: t.balance_centimes / 100,
          base: "Mois entier incluant les dates sélectionnées",
        });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    sets.push({ name: "Remunerations par mois", rows: remuneration });
    await add(
      "Bilan",
      `SELECT COALESCE(sum(amount_centimes) FILTER(WHERE kind='payment'),0)/100.0 AS encaissements_DA,COALESCE(sum(amount_centimes) FILTER(WHERE kind='refund'),0)/100.0 AS remboursements_DA,COALESCE(sum(CASE WHEN kind='payment' THEN amount_centimes ELSE -amount_centimes END),0)/100.0 AS encaissements_nets_DA,(SELECT COALESCE(sum(amount_centimes),0)/100.0 FROM payroll_payments WHERE tenant_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz+interval '1 day') AS remunerations_versees_DA FROM payments WHERE tenant_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz+interval '1 day'`,
      args,
    );
  }
  if (["all", "attendance"].includes(dataset)) {
    const stats = await attendanceReport(u, range);
    sets.push(
      { name: "Presences par eleve", rows: stats.students },
      { name: "Presences par enseignant", rows: stats.teachers },
    );
  }
  return sets;
}
export async function schoolService(
  req: AuthRequest,
  res: Response,
  key: string,
  p: string,
  body: unknown,
): Promise<{ handled: boolean; value?: unknown }> {
  const u = req.user;
  if (key === "GET profile") return { handled: true, value: { ...u } };
  if (key === "GET attendance-stats")
    return {
      handled: true,
      value: await attendanceReport(u, reportRange(req.query)),
    };
  if (key === "GET reports/export") {
    permit(u, adminRoles);
    await requireRecent(req);
    await enforceRate("report-export:" + u.id, 10, 3600);
    const range = reportRange(req.query);
    const v = parse(
      z.object({
        dataset: z
          .enum([
            "all",
            "students",
            "parents",
            "teachers",
            "finance",
            "attendance",
          ])
          .default("all"),
        format: z.enum(["json", "xlsx"]).default("json"),
      }),
      req.query,
    );
    const sheets = await exportData(u, range, v.dataset);
    await db.query(
      "INSERT INTO audit(id,tenant_id,user_id,action,entity_id,detail) VALUES($1,$2,$3,'report.export',$2::uuid::text,$4)",
      [uid(), u.tenant_id, u.id, JSON.stringify({ ...range, ...v })],
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="edubest-${v.dataset}-${range.from}-${range.to}.${v.format}"`,
    );
    if (v.format === "xlsx") {
      res.type(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      return { handled: true, value: new StreamableFile(workbook(sheets)) };
    }
    return {
      handled: true,
      value: {
        school: u.school,
        exported_at: new Date().toISOString(),
        period: range,
        currency: "DZD",
        period_basis:
          "Factures : date d’échéance. Encaissements et rémunérations versées : date du mouvement (heure d’Alger). Présences : date des séances terminées.",
        sheets,
      },
    };
  }
  if (key === "GET delivery") {
    permit(u, adminRoles);
    const jobs = (
      await db.query(
        `SELECT o.id,o.channel,o.topic,o.resource_id,o.state,o.attempts,o.error_code,o.last_error,o.created_at,o.updated_at,o.receipt_checked,(o.state='failed' AND o.topic<>'account' AND o.recipient<>'' AND o.payload<>'{}'::jsonb) AS retryable,u.name AS recipient_name,u.email AS recipient_email FROM outbox o LEFT JOIN users u ON u.id=o.user_id AND u.tenant_id=o.tenant_id WHERE o.tenant_id=$1 ORDER BY o.created_at DESC LIMIT 300`,
        [u.tenant_id],
      )
    ).rows;
    return {
      handled: true,
      value: {
        jobs,
        smtp_configured: !!(process.env.SMTP_HOST || process.env.BREVO_API_KEY),
        sender: process.env.SMTP_FROM ?? "",
        delivery_note:
          "SMTP accepté ne garantit pas la réception. Un refus Microsoft lié à SPF/DKIM/DMARC ou à la réputation IP doit être corrigé chez l’hébergeur. Aucun DNS n’est modifié par le code.",
      },
    };
  }
  if (req.method === "POST" && /^delivery\/[\w-]+\/retry$/.test(p)) {
    permit(u, adminRoles);
    await requireRecent(req);
    await enforceRate("delivery-retry:" + u.id, 20, 3600);
    const r = await db.query(
      "UPDATE outbox SET state='pending',attempts=0,error_code='',last_error='',next_at=now(),updated_at=now() WHERE tenant_id=$1 AND id=$2 AND state='failed' AND topic<>'account' AND recipient<>'' AND payload<>'{}'::jsonb RETURNING id",
      [u.tenant_id, uuid(p.split("/")[1])],
    );
    if (!r.rowCount)
      throw new BadRequestException(
        "Envoi non relançable ; pour une invitation utilisez Renvoyer l’invitation.",
      );
    return { handled: true, value: { ok: true } };
  }
  if (req.method === "POST" && /^invoices\/[\w-]+\/send$/.test(p)) {
    permit(u, ["OWNER", "MANAGER", "CASHIER"]);
    await enforceRate("invoice-send:" + u.id, 30, 3600);
    const v = await transaction(async (c) => {
      const invoice = uuid(p.split("/")[1]);
      const found = await c.query(
        "SELECT 1 FROM invoices WHERE tenant_id=$1 AND id=$2 AND status='open'",
        [u.tenant_id, invoice],
      );
      if (!found.rowCount) throw new NotFoundException("Échéance introuvable");
      return invoiceNotice(c, u.tenant_id, invoice);
    });
    return { handled: true, value: v };
  }
  return { handled: false };
}
