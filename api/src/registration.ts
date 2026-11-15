import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import {
  adminRoles,
  registrationDecision,
  registrationInput,
  registrationRoles,
  SCHOOL_SLUG,
} from "@edubest/shared";
import { authEmail } from "./auth";
import { db, transaction } from "./db";
import { emailJob } from "./mail";
import { hashPassword } from "./passwords";
import { enforceRate, requireRecent, securityEvent } from "./protection";
import { reviewEnabled } from "./review";
import {
  AuthGuard,
  AuthRequest,
  checkOrigin,
  hash,
  parse,
  permit,
  token,
  uid,
  uuid,
} from "./security";

const publicEnabled = () =>
  process.env.EDUBEST_REGISTRATION_ENABLED !== "false" && !reviewEnabled();
const publicCourseFields = "g.id,g.name,g.subject,g.level";
const fullCourse = `(SELECT count(*) FROM enrollments e JOIN students s
  ON s.tenant_id=e.tenant_id AND s.id=e.student_id AND s.active
  WHERE e.tenant_id=g.tenant_id AND e.group_id=g.id)>=g.capacity`;

function ensurePublic(req: Request) {
  if (!publicEnabled())
    throw new NotFoundException("Inscriptions indisponibles.");
  checkOrigin(req, true);
}

function staff(req: AuthRequest) {
  permit(req.user, registrationRoles);
  if (!req.user.verified)
    throw new ForbiddenException("Vérifiez votre adresse email.");
  return req.user.tenant_id;
}

async function lockRequest(c: PoolClient, tenant: string, requestId: string) {
  const row = (
    await c.query(
      "SELECT * FROM registration_requests WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
      [tenant, requestId],
    )
  ).rows[0];
  if (!row) throw new NotFoundException("Demande introuvable.");
  return row;
}

const nameKey = (value: string) =>
  value.normalize("NFKC").toLowerCase().trim().split(/\s+/).sort().join(" ");

@Controller("api/registrations")
export class RegistrationController {
  @Get("catalog") async catalog() {
    if (!publicEnabled()) return { enabled: false, courses: [] };
    const school = (
      await db.query("SELECT id FROM tenants WHERE slug=$1", [SCHOOL_SLUG])
    ).rows[0];
    if (!school) return { enabled: false, courses: [] };
    const courses = await db.query(
      `SELECT ${publicCourseFields},${fullCourse} AS full FROM groups g
       WHERE g.tenant_id=$1 AND g.active AND g.registration_open ORDER BY g.subject,g.level,g.name`,
      [school.id],
    );
    return { enabled: true, courses: courses.rows };
  }

  @Post("request") async request(@Req() req: Request, @Body() body: unknown) {
    ensurePublic(req);
    const v = parse(registrationInput, body);
    await enforceRate("registration-email:" + hash(v.email), 5, 3600);
    return transaction(async (c) => {
      const school = (
        await c.query("SELECT id FROM tenants WHERE slug=$1", [SCHOOL_SLUG])
      ).rows[0];
      if (!school) throw new NotFoundException("Inscriptions indisponibles.");
      await c.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 9206))",
        [school.id + ":" + v.email],
      );
      const current = (
        await c.query(
          `SELECT id,status,locale,verification_expires_at>now()+interval '23 hours 30 minutes' AS cooldown
         FROM registration_requests WHERE tenant_id=$1 AND email=$2 AND status IN ('email_pending','pending') FOR UPDATE`,
          [school.id, v.email],
        )
      ).rows[0];
      if (current?.status === "pending" || current?.cooldown)
        return { ok: true };
      if (v.group_ids.length) {
        const choices = await c.query(
          `SELECT g.id FROM groups g WHERE g.tenant_id=$1 AND g.active AND g.registration_open
           AND g.id=ANY($2::uuid[]) AND NOT (${fullCourse})`,
          [school.id, v.group_ids],
        );
        if (choices.rowCount !== v.group_ids.length)
          throw new ConflictException(
            "Un cours sélectionné est complet ou indisponible. Actualisez la liste des cours.",
          );
      }
      const raw = token();
      const requestId = current?.id ?? uid();
      if (current) {
        // Keep the original application until its owner confirms it.
        await c.query(
          `UPDATE registration_requests SET verification_hash=$2,verification_expires_at=now()+interval '24 hours'
           WHERE id=$1`,
          [requestId, hash(raw)],
        );
        await c.query(
          `UPDATE outbox SET state='failed',error_code='SUPERSEDED',recipient='',payload='{}'
           WHERE resource_id=$1 AND topic='registration.confirm' AND state='pending'`,
          [requestId],
        );
      } else {
        await c.query(
          `INSERT INTO registration_requests
          (id,tenant_id,role,student_kind,first_name,last_name,phone,email,child_first_name,child_last_name,level,group_ids,locale,verification_hash,verification_expires_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now()+interval '24 hours')`,
          [
            requestId,
            school.id,
            v.role,
            v.student_kind,
            v.first_name,
            v.last_name,
            v.phone,
            v.email,
            v.child_first_name,
            v.child_last_name,
            v.level,
            v.group_ids,
            v.locale,
            hash(raw),
          ],
        );
      }
      const locale = current?.locale ?? v.locale;
      const url = `${process.env.WEB_URL ?? "http://localhost:3100"}/inscription?lang=${locale}#confirm=${raw}`;
      await emailJob(
        v.email,
        locale === "ar"
          ? "تأكيد بريد طلب التسجيل في إديوبيست"
          : "EduBest · Confirmez votre demande d’inscription",
        locale === "ar"
          ? `لتأكيد طلب التسجيل، افتح الرابط واضغط على زر التأكيد. الرابط صالح لمدة 24 ساعة. إذا لم تطلب التسجيل فتجاهل هذه الرسالة.\n\n${url}`
          : `Ouvrez ce lien et cliquez sur « Confirmer ma demande ». Il est valable 24 heures. Si vous n’avez pas demandé d’inscription, ignorez ce message.\n\n${url}`,
        c,
        {
          tenant: school.id,
          topic: "registration.confirm",
          resource: requestId,
        },
      );
      return { ok: true };
    });
  }

  @Post("confirm") async confirm(@Req() req: Request, @Body() body: unknown) {
    ensurePublic(req);
    const v = parse(
      z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
      body,
    );
    const result = await db.query(
      `UPDATE registration_requests r SET status='pending',verified_at=now(),verification_hash=NULL,verification_expires_at=NULL
       FROM tenants t WHERE r.tenant_id=t.id AND t.slug=$2 AND r.verification_hash=$1
       AND r.status='email_pending' AND r.verification_expires_at>now()`,
      [hash(v.token), SCHOOL_SLUG],
    );
    if (!result.rowCount)
      throw new BadRequestException(
        "Lien expiré ou déjà utilisé. Si nécessaire, renvoyez votre demande.",
      );
    return { ok: true };
  }

  @UseGuards(AuthGuard) @Get() async list(
    @Req() req: AuthRequest,
    @Query("history") history?: string,
    @Query("offset") offset?: string,
  ) {
    const tenant = staff(req);
    const skip = parse(
      z.coerce.number().int().min(0).max(100000),
      offset ?? "0",
    );
    const result = await db.query(
      `SELECT r.id,r.role,r.student_kind,r.first_name,r.last_name,r.phone,r.email,r.child_first_name,r.child_last_name,r.level,
       r.status,r.reason,r.created_at,(r.status='approved' AND u.active AND NOT u.verified) IS TRUE AS can_resend,
       COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.subject,c.name)
       FROM (SELECT ${publicCourseFields},g.active,${fullCourse} AS full FROM groups g
       WHERE g.tenant_id=r.tenant_id AND g.id=ANY(r.group_ids)) c),'[]'::jsonb) AS courses
       FROM registration_requests r LEFT JOIN users u ON u.tenant_id=r.tenant_id AND u.id=r.user_id
       WHERE r.tenant_id=$1 AND r.status=ANY($2::text[])
       ORDER BY CASE WHEN r.status='pending' THEN r.created_at END ASC,
       r.decided_at DESC NULLS LAST,r.id LIMIT 51 OFFSET $3`,
      [
        tenant,
        history === "true" ? ["approved", "rejected"] : ["pending"],
        skip,
      ],
    );
    return {
      requests: result.rows.slice(0, 50),
      has_more: result.rows.length > 50,
    };
  }

  @UseGuards(AuthGuard) @Get("dossiers") async dossiers(
    @Req() req: AuthRequest,
    @Query("q") query: unknown,
  ) {
    const tenant = staff(req);
    const q = parse(z.string().trim().min(2).max(120), query);
    return (
      await db.query(
        `SELECT id,name,level,parent_id IS NOT NULL AS has_parent,user_id IS NOT NULL AS has_login
       FROM students WHERE tenant_id=$1 AND active AND strpos(lower(name),lower($2))>0 ORDER BY name LIMIT 25`,
        [tenant, q],
      )
    ).rows;
  }

  @UseGuards(AuthGuard) @Get("catalog/manage") async manageCatalog(
    @Req() req: AuthRequest,
  ) {
    const tenant = staff(req);
    permit(req.user, adminRoles);
    return (
      await db.query(
        `SELECT ${publicCourseFields},g.registration_open,${fullCourse} AS full FROM groups g
       WHERE g.tenant_id=$1 AND g.active ORDER BY g.subject,g.level,g.name`,
        [tenant],
      )
    ).rows;
  }

  @UseGuards(AuthGuard) @Patch("catalog/:id") async changeCatalog(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const tenant = staff(req);
    permit(req.user, adminRoles);
    await requireRecent(req);
    const course = uuid(id),
      v = parse(z.strictObject({ open: z.boolean() }), body);
    return transaction(async (c) => {
      if (
        !(
          await c.query(
            "UPDATE groups SET registration_open=$3 WHERE tenant_id=$1 AND id=$2 AND active",
            [tenant, course, v.open],
          )
        ).rowCount
      )
        throw new NotFoundException("Cours actif introuvable.");
      await securityEvent(
        req.user,
        v.open ? "registration.catalog.open" : "registration.catalog.close",
        course,
        "success",
        c,
      );
      return { ok: true };
    });
  }

  @UseGuards(AuthGuard) @Post(":id/approve") async approve(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const tenant = staff(req),
      requestId = uuid(id);
    await requireRecent(req);
    const v = parse(registrationDecision, body);
    return transaction(async (c) => {
      const r = await lockRequest(c, tenant, requestId);
      if (r.status === "approved") return { ok: true, already_approved: true };
      if (r.status !== "pending")
        throw new ConflictException("Cette demande n’est plus à traiter.");
      if (
        r.student_kind === "existing" &&
        (!v.student_id || v.group_ids.length)
      )
        throw new BadRequestException(
          "Sélectionnez le dossier existant sans ajouter de cours.",
        );
      if (
        r.student_kind === "new" &&
        v.group_ids.some((g) => !r.group_ids.includes(g))
      )
        throw new BadRequestException(
          "Sélectionnez uniquement des cours demandés.",
        );

      const applicant = `${r.first_name} ${r.last_name}`;
      const child =
        r.role === "PARENT"
          ? `${r.child_first_name} ${r.child_last_name}`
          : applicant;
      const account = (
        await c.query(
          "SELECT id,name,role,active,verified FROM users WHERE tenant_id=$1 AND email=$2 FOR UPDATE",
          [tenant, r.email],
        )
      ).rows[0];
      if (
        account &&
        (r.role !== "PARENT" ||
          account.role !== "PARENT" ||
          !account.active ||
          !account.verified)
      )
        throw new ConflictException(
          "Un compte utilise déjà cet email. Vérifiez l’accès existant avec la famille.",
        );
      if (account && nameKey(account.name) !== nameKey(applicant))
        throw new ConflictException(
          "Le nom ne correspond pas au compte parent existant.",
        );
      const userId = account?.id ?? uid(),
        studentId = v.student_id ?? uid();
      let student:
        | {
            id: string;
            name: string;
            parent_id: string | null;
            user_id: string | null;
          }
        | undefined;
      // Keep group locks in the same order for concurrent decisions.
      const groupIds = [...v.group_ids].sort();
      if (groupIds.length) {
        const groups = await c.query(
          "SELECT id FROM groups WHERE tenant_id=$1 AND active AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE",
          [tenant, groupIds],
        );
        if (groups.rowCount !== groupIds.length)
          throw new ConflictException("Un cours n’est plus actif.");
      }
      if (v.student_id) {
        student = (
          await c.query(
            "SELECT id,name,parent_id,user_id FROM students WHERE tenant_id=$1 AND id=$2 AND active FOR UPDATE",
            [tenant, studentId],
          )
        ).rows[0];
        if (!student || nameKey(student.name) !== nameKey(child))
          throw new BadRequestException(
            "Le dossier choisi ne correspond pas au nom de l’élève.",
          );
        if (r.role === "STUDENT" && student.user_id)
          throw new ConflictException(
            "Ce dossier est déjà lié à un compte élève.",
          );
        if (
          r.role === "PARENT" &&
          student.parent_id &&
          student.parent_id !== userId
        )
          throw new ConflictException(
            "Ce dossier est déjà lié à un autre parent. La direction doit vérifier ce lien séparément.",
          );
      }
      if (groupIds.length) {
        const capacity = await c.query(
          `SELECT g.name FROM groups g WHERE g.tenant_id=$1 AND g.id=ANY($2::uuid[]) AND (${fullCourse})
           AND NOT EXISTS(SELECT 1 FROM enrollments e WHERE e.tenant_id=g.tenant_id AND e.group_id=g.id AND e.student_id=$3)`,
          [tenant, groupIds, studentId],
        );
        if (capacity.rowCount)
          throw new ConflictException(
            "Groupe complet : " + capacity.rows[0].name,
          );
      }
      if (!account)
        await c.query(
          "INSERT INTO users(id,tenant_id,name,phone,email,password_hash,role,locale) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            userId,
            tenant,
            r.role === "STUDENT" ? (student?.name ?? applicant) : applicant,
            r.phone,
            r.email,
            await hashPassword(token()),
            r.role,
            r.locale,
          ],
        );
      if (student) {
        if (r.role === "PARENT")
          await c.query(
            "UPDATE students SET parent_id=$3 WHERE tenant_id=$1 AND id=$2",
            [tenant, studentId, userId],
          );
        else
          await c.query(
            "UPDATE students SET user_id=$3,phone=$4 WHERE tenant_id=$1 AND id=$2",
            [tenant, studentId, userId, r.phone],
          );
      } else {
        await c.query(
          "INSERT INTO students(id,tenant_id,name,phone,level,user_id,parent_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            studentId,
            tenant,
            child,
            r.phone,
            r.level ?? "",
            r.role === "STUDENT" ? userId : null,
            r.role === "PARENT" ? userId : null,
          ],
        );
      }
      if (groupIds.length)
        await c.query(
          "INSERT INTO enrollments(tenant_id,group_id,student_id) SELECT $1,unnest($2::uuid[]),$3 ON CONFLICT DO NOTHING",
          [tenant, groupIds, studentId],
        );
      await c.query(
        "UPDATE registration_requests SET status='approved',reviewer_id=$2,user_id=$3,student_id=$4,decided_at=now() WHERE id=$1",
        [requestId, req.user.id, userId, studentId],
      );
      if (!account)
        await authEmail(
          c,
          { id: userId, name: applicant, email: r.email, locale: r.locale },
          "invite",
          72,
        );
      else
        await emailJob(
          r.email,
          r.locale === "ar"
            ? "قُبل طلب تسجيل إديوبيست"
            : "EduBest · Demande approuvée",
          r.locale === "ar"
            ? "قُبل طلبك. يمكنك الاطلاع على الملف من حسابك المعتاد."
            : "Votre demande a été approuvée. Retrouvez le dossier depuis votre compte habituel.",
          c,
          {
            tenant,
            user: userId,
            topic: "registration.decision",
            resource: requestId,
          },
        );
      await securityEvent(
        req.user,
        "registration.approve",
        requestId,
        "success",
        c,
      );
      return { ok: true };
    });
  }

  @UseGuards(AuthGuard) @Post(":id/reject") async reject(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const tenant = staff(req),
      requestId = uuid(id);
    await requireRecent(req);
    const v = parse(
      z.strictObject({ reason: z.string().trim().min(5).max(500) }),
      body,
    );
    return transaction(async (c) => {
      const r = await lockRequest(c, tenant, requestId);
      if (r.status === "rejected") return { ok: true };
      if (r.status !== "pending")
        throw new ConflictException("Cette demande n’est plus à traiter.");
      await c.query(
        "UPDATE registration_requests SET status='rejected',reason=$2,reviewer_id=$3,decided_at=now() WHERE id=$1",
        [requestId, v.reason, req.user.id],
      );
      await emailJob(
        r.email,
        r.locale === "ar"
          ? "رد المدرسة على طلب التسجيل"
          : "EduBest · Réponse à votre demande",
        r.locale === "ar"
          ? `لم يُقبل طلب التسجيل. توضيح المدرسة:\n${v.reason}`
          : `Votre demande n’a pas été acceptée. Message de l’école :\n${v.reason}`,
        c,
        { tenant, topic: "registration.decision", resource: requestId },
      );
      await securityEvent(
        req.user,
        "registration.reject",
        requestId,
        "success",
        c,
      );
      return { ok: true };
    });
  }

  @UseGuards(AuthGuard) @Post(":id/resend") async resend(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    const tenant = staff(req),
      requestId = uuid(id);
    await requireRecent(req);
    await enforceRate("registration-resend:" + requestId, 3, 3600);
    return transaction(async (c) => {
      const r = await lockRequest(c, tenant, requestId);
      const account =
        r.status === "approved" &&
        (
          await c.query(
            "SELECT id,name,email,locale FROM users WHERE tenant_id=$1 AND id=$2 AND active AND NOT verified FOR UPDATE",
            [tenant, r.user_id],
          )
        ).rows[0];
      if (!account)
        throw new ConflictException(
          "Ce compte n’a pas d’activation en attente.",
        );
      await authEmail(c, account, "invite", 72);
      await securityEvent(
        req.user,
        "registration.resend",
        requestId,
        "success",
        c,
      );
      return { ok: true };
    });
  }
}
