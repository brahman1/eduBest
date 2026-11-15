import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  hashPassword,
  verifyPassword,
  needsPasswordUpgrade,
  dummyPasswordHash,
} from "./passwords";
import { z } from "zod";
import {
  SCHOOL_SLUG,
  login,
  email,
  password,
  name,
  roles,
  id,
} from "@edubest/shared";
import { db, transaction } from "./db";
import {
  AuthGuard,
  AuthRequest,
  checkOrigin,
  hash,
  parse,
  token,
  uid,
  permit,
} from "./security";
import { emailJob } from "./mail";
import { PoolClient } from "pg";
import { deploymentProfile } from "./deployment";
import {
  enforceRate,
  deviceLabel,
  securityEvent,
  verifyFactor,
  confirmPassword,
  requireRecent,
} from "./protection";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api",
  maxAge: 7 * 86400000,
});
export async function issueSession(
  c: PoolClient,
  userId: string,
  res: Response,
  req: Request,
) {
  const raw = token();
  await c.query(
    "INSERT INTO auth_sessions(token_hash,user_id,expires_at,device_label) VALUES($1,$2,now()+interval '7 days',$3)",
    [hash(raw), userId, deviceLabel(req)],
  );
  await c.query(
    "DELETE FROM auth_sessions WHERE user_id=$1 AND token_hash IN(SELECT token_hash FROM auth_sessions WHERE user_id=$1 ORDER BY created_at DESC OFFSET 10)",
    [userId],
  );
  res.cookie("edubest_session", raw, cookieOptions());
  return raw;
}
export async function authEmail(
  c: PoolClient,
  user: any,
  kind: "verify" | "reset" | "invite",
  hours: 1 | 72 = 1,
) {
  const raw = token();
  await c.query("DELETE FROM auth_tokens WHERE user_id=$1 AND kind=$2", [
    user.id,
    kind,
  ]);
  await c.query(
    "INSERT INTO auth_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,$3,now()+$4::int*interval '1 hour')",
    [hash(raw), user.id, kind, hours],
  );
  const url = `${process.env.WEB_URL ?? "http://localhost:3100"}/auth?mode=${kind}&token=${raw}`;
  const identity = (
    await c.query("SELECT tenant_id FROM users WHERE id=$1", [user.id])
  ).rows[0];
  await c.query(
    "UPDATE outbox SET state='failed',error_code='SUPERSEDED',last_error='Remplacé par un nouveau lien.',recipient='',payload='{}'::jsonb,updated_at=now() WHERE user_id=$1 AND topic='account' AND state='pending'",
    [user.id],
  );
  await emailJob(
    user.email,
    user.locale === "ar" && kind === "invite"
      ? "دعوة لتفعيل حساب إديوبيست"
      : kind === "verify"
        ? "Vérifiez votre compte EduBest"
        : kind === "reset"
          ? "Réinitialisez votre mot de passe EduBest"
          : "Votre invitation EduBest",
    user.locale === "ar" && kind === "invite"
      ? `مرحبًا ${user.name}،\n\nفعّل حسابك واختر كلمة المرور:\n${url}\n\nالرابط صالح لمدة ${hours} ساعة.`
      : `Bonjour ${user.name},\n\n${url}\n\nCe lien est valable ${hours === 1 ? "une heure" : "72 heures"}. Si vous n'avez pas demandé cette action, ignorez cet email.`,
    c,
    { tenant: identity?.tenant_id, user: user.id, topic: "account" },
  );
}
@Controller("api/auth")
export class AuthController {
  @Post("login") async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    checkOrigin(req, true);
    const v = parse(
      login.extend({
        session_mode: z.enum(["cookie", "token"]).default("token"),
        code: z.string().max(24).optional(),
      }),
      body,
    );
    await enforceRate("login-account:" + SCHOOL_SLUG + ":" + v.email, 12);
    const r = await db.query(
      "SELECT u.* FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE t.slug=$1 AND u.email=$2 AND u.active",
      [SCHOOL_SLUG, v.email],
    );
    const u = r.rows[0];
    const valid = await verifyPassword(
      v.password,
      u?.password_hash ?? dummyPasswordHash,
    );
    if (!u || !valid) {
      await securityEvent(u ?? null, "auth.login", "", "failure");
      throw new UnauthorizedException("Identifiants incorrects");
    }
    return transaction(async (c) => {
      const locked = (
        await c.query(
          "SELECT password_hash,active FROM users WHERE id=$1 FOR UPDATE",
          [u.id],
        )
      ).rows[0];
      if (!locked?.active || locked.password_hash !== u.password_hash)
        throw new UnauthorizedException("Identifiants incorrects");
      if (!(await verifyFactor(c, u.id, v.code))) {
        await securityEvent(u, "auth.mfa.login", "", "failure", c);
        return { mfa_required: true };
      }
      if (needsPasswordUpgrade(u.password_hash))
        await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
          await hashPassword(v.password),
          u.id,
        ]);
      const raw = await issueSession(c, u.id, res, req);
      await securityEvent(u, "auth.login", "", "success", c);
      return v.session_mode === "token" ? { token: raw } : { ok: true };
    });
  }
  @UseGuards(AuthGuard) @Get("me") me(@Req() req: AuthRequest) {
    return req.user;
  }
  @UseGuards(AuthGuard) @Post("logout") async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await db.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
      req.sessionHash,
    ]);
    await securityEvent(req.user, "auth.logout", "");
    res.clearCookie("edubest_session", { path: "/api" });
    return { ok: true };
  }
  @UseGuards(AuthGuard) @Post("resend") async resend(@Req() req: AuthRequest) {
    if (req.user.verified) return { ok: true };
    await enforceRate("verify-email:" + req.user.id, 3, 3600);
    await transaction((c) => authEmail(c, req.user, "verify"));
    return { ok: true };
  }
  @Post("forgot") async forgot(@Body() body: unknown, @Req() req: Request) {
    checkOrigin(req, true);
    const v = parse(
      z.object({ slug: z.literal(SCHOOL_SLUG).optional(), email }),
      body,
    );
    await enforceRate("forgot-account:" + hash(v.email), 3, 3600);
    const r = await db.query(
      "SELECT u.* FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE t.slug=$1 AND u.email=$2 AND u.active",
      [SCHOOL_SLUG, v.email],
    );
    if (r.rowCount) await transaction((c) => authEmail(c, r.rows[0], "reset"));
    return { ok: true };
  }
  @Post("consume") async consume(@Body() body: unknown, @Req() req: Request) {
    checkOrigin(req, true);
    const v = parse(
      z.object({
        token: z.string().min(20).max(100),
        password: password.optional(),
      }),
      body,
    );
    return transaction(async (c) => {
      const r = await c.query(
        "SELECT a.* FROM auth_tokens a JOIN users u ON u.id=a.user_id JOIN tenants t ON t.id=u.tenant_id WHERE a.token_hash=$1 AND a.expires_at>now() AND u.active AND t.slug='edubest' FOR UPDATE OF a",
        [hash(v.token)],
      );
      if (!r.rowCount)
        throw new BadRequestException("Lien expiré ou déjà utilisé");
      const a = r.rows[0];
      if (a.kind === "verify" && v.password)
        throw new BadRequestException(
          "Ce lien vérifie uniquement l’adresse email",
        );
      if (a.kind !== "verify" && !v.password)
        throw new BadRequestException("Mot de passe requis");
      if (v.password) {
        await c.query(
          "UPDATE users SET password_hash=$1,verified=true WHERE id=$2",
          [await hashPassword(v.password), a.user_id],
        );
        await c.query("DELETE FROM auth_sessions WHERE user_id=$1", [
          a.user_id,
        ]);
      } else
        await c.query("UPDATE users SET verified=true WHERE id=$1", [
          a.user_id,
        ]);
      await c.query("DELETE FROM auth_tokens WHERE user_id=$1", [a.user_id]);
      return { ok: true };
    });
  }
  @UseGuards(AuthGuard) @Post("password") async change(
    @Body() body: unknown,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const v = parse(
      z.object({
        current: z.string().max(128),
        password,
        code: z.string().max(24).optional(),
      }),
      body,
    );
    await enforceRate("password:" + req.user.id, 10);
    const r = await db.query("SELECT password_hash FROM users WHERE id=$1", [
      req.user.id,
    ]);
    if (!(await verifyPassword(v.current, r.rows[0].password_hash)))
      throw new UnauthorizedException("Mot de passe incorrect");
    const raw = await transaction(async (c) => {
      const locked = (
        await c.query(
          "SELECT password_hash,active FROM users WHERE id=$1 FOR UPDATE",
          [req.user.id],
        )
      ).rows[0];
      if (!locked?.active || locked.password_hash !== r.rows[0].password_hash)
        throw new UnauthorizedException(
          "Confirmez à nouveau votre mot de passe",
        );
      if (!(await verifyFactor(c, req.user.id, v.code)))
        throw new UnauthorizedException(
          "Code de double authentification requis ou incorrect",
        );
      await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        await hashPassword(v.password),
        req.user.id,
      ]);
      await c.query("DELETE FROM auth_sessions WHERE user_id=$1", [
        req.user.id,
      ]);
      await c.query("DELETE FROM auth_tokens WHERE user_id=$1", [req.user.id]);
      await securityEvent(req.user, "auth.password.change", "", "success", c);
      return issueSession(c, req.user.id, res, req);
    });
    return { ok: true, ...(req.headers.authorization ? { token: raw } : {}) };
  }
  @UseGuards(AuthGuard) @Post("invite") async invite(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    permit(req.user, ["OWNER", "MANAGER"]);
    await requireRecent(req);
    await enforceRate("invites:" + req.user.id, 40, 3600);
    if (!req.user.verified)
      throw new ForbiddenException("Vérifiez votre adresse email");
    const v = parse(
      z.object({
        name,
        email,
        role: z.enum(
          roles.filter((r) => r !== "OWNER") as [
            "MANAGER",
            "CASHIER",
            "SECRETARY",
            "TEACHER",
            "PARENT",
            "STUDENT",
          ],
        ),
        locale: z.enum(["fr", "ar"]).default("fr"),
        student_id: id.nullish(),
      }),
      body,
    );
    if (req.user.role !== "OWNER" && v.role === "MANAGER")
      throw new ForbiddenException(
        "Seul le propriétaire peut créer un responsable",
      );
    if (v.student_id && v.role !== "STUDENT")
      throw new BadRequestException(
        "Le dossier existant concerne uniquement une invitation élève.",
      );
    return transaction(async (c) => {
      if (v.student_id) {
        const s = (
          await c.query(
            "SELECT name,user_id FROM students WHERE tenant_id=$1 AND id=$2 AND active FOR UPDATE",
            [req.user.tenant_id, v.student_id],
          )
        ).rows[0];
        if (!s || s.user_id)
          throw new BadRequestException(
            "Dossier introuvable ou déjà associé à un compte.",
          );
      }
      const u = { id: uid(), ...v };
      await c.query(
        "INSERT INTO users(id,tenant_id,name,email,password_hash,role,locale) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          u.id,
          req.user.tenant_id,
          v.name,
          v.email,
          await hashPassword(token()),
          v.role,
          v.locale,
        ],
      );
      let studentId: string | null = null;
      if (v.role === "STUDENT") {
        studentId = v.student_id ?? uid();
        if (v.student_id)
          await c.query(
            "UPDATE students SET user_id=$1,name=$2 WHERE tenant_id=$3 AND id=$4",
            [u.id, v.name, req.user.tenant_id, studentId],
          );
        else
          await c.query(
            "INSERT INTO students(id,tenant_id,name,user_id) VALUES($1,$2,$3,$4)",
            [studentId, req.user.tenant_id, v.name, u.id],
          );
      }
      await authEmail(c, u, "invite");
      await c.query(
        "INSERT INTO audit(id,tenant_id,user_id,action,entity_id) VALUES($1,$2,$3,'invite',$4)",
        [uid(), req.user.tenant_id, req.user.id, u.id],
      );
      return { id: u.id, student_id: studentId };
    });
  }
  @UseGuards(AuthGuard) @Post("invite/resend") async resendInvitation(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    permit(req.user, ["OWNER", "MANAGER"]);
    await requireRecent(req);
    await enforceRate("resend-invitation:" + req.user.id, 20, 3600);
    const v = parse(z.object({ id }), body);
    return transaction(async (c) => {
      const target = (
        await c.query(
          "SELECT id,name,email,verified FROM users WHERE tenant_id=$1 AND id=$2 AND active FOR UPDATE",
          [req.user.tenant_id, v.id],
        )
      ).rows[0];
      if (!target || target.verified)
        throw new BadRequestException("Invitation en attente introuvable.");
      await authEmail(c, target, "invite");
      return { ok: true, queued: true };
    });
  }
  @UseGuards(AuthGuard) @Post("delete-account") async remove(
    @Body() body: unknown,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const v = parse(
      z.object({
        password: z.string().max(128),
        code: z.string().max(24).optional(),
      }),
      body,
    );
    await enforceRate("delete-account:" + req.user.id, 5);
    const r = await db.query("SELECT password_hash FROM users WHERE id=$1", [
      req.user.id,
    ]);
    if (!(await verifyPassword(v.password, r.rows[0].password_hash)))
      throw new UnauthorizedException("Mot de passe incorrect");
    if (req.user.role === "OWNER")
      throw new BadRequestException(
        "Transférez la propriété de votre établissement à un autre responsable avant de supprimer ce compte.",
      );
    await transaction(async (c) => {
      if (!(await verifyFactor(c, req.user.id, v.code)))
        throw new UnauthorizedException(
          "Code de double authentification requis ou incorrect",
        );
      await c.query(
        "UPDATE users SET active=false,name='Compte supprimé',phone='',email=$1,password_hash=$2 WHERE id=$3",
        [
          `deleted-${req.user.id}@invalid.local`,
          await hashPassword(token()),
          req.user.id,
        ],
      );
      await c.query("DELETE FROM auth_sessions WHERE user_id=$1", [
        req.user.id,
      ]);
      await c.query("DELETE FROM auth_tokens WHERE user_id=$1", [req.user.id]);
      await c.query("DELETE FROM device_tokens WHERE user_id=$1", [
        req.user.id,
      ]);
      await c.query("DELETE FROM notifications WHERE user_id=$1", [
        req.user.id,
      ]);
      await c.query("DELETE FROM user_mfa WHERE user_id=$1", [req.user.id]);
      await c.query(
        "UPDATE students SET parent_id=NULL WHERE tenant_id=$1 AND parent_id=$2",
        [req.user.tenant_id, req.user.id],
      );
      await c.query(
        "UPDATE students SET user_id=NULL WHERE tenant_id=$1 AND user_id=$2",
        [req.user.tenant_id, req.user.id],
      );
      await securityEvent(req.user, "auth.account.delete", "", "success", c);
    });
    res.clearCookie("edubest_session", { path: "/api" });
    return { ok: true };
  }
}
@Controller("api/public")
export class PublicController {
  @Get("notice") async notice() {
    const profile = deploymentProfile();
    const row = (
      await db.query(
        "SELECT privacy_contact,retention_policy,processing_basis FROM tenants WHERE slug=$1",
        [SCHOOL_SLUG],
      )
    ).rows[0];
    return {
      ...profile,
      privacy_email: row?.privacy_contact || profile.privacy_email,
      retention: row?.retention_policy || profile.retention,
      basis: row?.processing_basis || profile.basis,
    };
  }
  @Get("health") async health() {
    await db.query("SELECT 1");
    return { status: "ok" };
  }
}
