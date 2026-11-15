import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  HttpException,
} from "@nestjs/common";
import { Request } from "express";
import { User, Role } from "@edubest/shared";
import { z } from "zod";
import { db } from "./db";
import { reviewEnabled } from "./review";
export type AuthRequest = Request & { user: User; sessionHash: string };
export const uid = randomUUID;
export const token = () => randomBytes(32).toString("base64url");
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const adminMfaRequired = () =>
  !reviewEnabled() &&
  (process.env.NODE_ENV === "production" ||
    process.env.REQUIRE_ADMIN_MFA === "true");
export function parse<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success)
    throw new BadRequestException(
      r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  return r.data;
}
export function permit(u: User, roles: readonly Role[]) {
  if (!roles.includes(u.role)) throw new ForbiddenException("Accès interdit");
}
export function uuid(v: string) {
  return parse(z.uuid(), v);
}
export const origins = () =>
  new Set(
    (
      process.env.ALLOWED_ORIGINS ??
      process.env.WEB_URL ??
      "http://localhost:3100"
    )
      .split(",")
      .map((s) => s.trim()),
  );
export function checkOrigin(req: Request, nativeAuth = false) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  if (req.headers.origin) {
    if (!origins().has(req.headers.origin))
      throw new ForbiddenException("Origine non autorisée");
    return;
  }
  const bearer = /^Bearer [A-Za-z0-9_-]{43}$/.test(
    req.headers.authorization ?? "",
  );
  const native =
    nativeAuth &&
    !req.cookies?.edubest_session &&
    req.headers.authorization === "Bearer mobile";
  if (!bearer && !native) throw new ForbiddenException("Origine non autorisée");
}
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    checkOrigin(req);
    const bearer = req.headers.authorization?.match(
      /^Bearer ([A-Za-z0-9_-]{43})$/,
    )?.[1];
    if (req.headers.authorization && !bearer)
      throw new UnauthorizedException("Session invalide");
    const raw = bearer ?? req.cookies?.edubest_session;
    if (typeof raw !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(raw))
      throw new UnauthorizedException("Connectez-vous");
    const h = hash(raw);
    const r = await db.query(
      `SELECT u.id,u.tenant_id,u.name,u.email,u.phone,u.role,u.locale,u.verified,t.name AS school,t.slug FROM auth_sessions s JOIN users u ON u.id=s.user_id JOIN tenants t ON t.id=u.tenant_id WHERE s.token_hash=$1 AND s.expires_at>now() AND s.last_seen_at>now()-interval '12 hours' AND u.active AND t.slug='edubest'`,
      [h],
    );
    if (!r.rowCount) throw new UnauthorizedException("Session expirée");
    req.user = r.rows[0];
    req.sessionHash = h;
    if (
      req.user.role === "SECRETARY" &&
      ![
        "/api/auth/me",
        "/api/auth/logout",
        "/api/auth/password",
        "/api/auth/resend",
        "/api/auth/delete-account",
        "/api/profile",
      ].includes(req.path) &&
      !["/api/registrations", "/api/security", "/api/privacy"].some(
        (path) => req.path === path || req.path.startsWith(path + "/"),
      )
    )
      throw new ForbiddenException(
        "Accès réservé à la gestion des inscriptions.",
      );
    if (
      req.user.role === "STUDENT" &&
      !["/api/auth/me", "/api/auth/logout", "/api/profile"].includes(
        req.path,
      ) &&
      !req.path.startsWith("/api/security/") &&
      !req.path.startsWith("/api/privacy/")
    ) {
      const links = await db.query(
        "SELECT count(*)::int AS n FROM students WHERE tenant_id=$1 AND user_id=$2 AND active",
        [req.user.tenant_id, req.user.id],
      );
      if (links.rows[0].n > 1)
        throw new ForbiddenException(
          "Ce compte est associé à plusieurs dossiers élèves. Demandez à la direction de corriger les liens dans Élèves & familles.",
        );
    }
    if (
      adminMfaRequired() &&
      ["OWNER", "MANAGER"].includes(req.user.role) &&
      !["/api/auth/me", "/api/auth/logout"].includes(req.path) &&
      !req.path.startsWith("/api/security/") &&
      req.path !== "/api/privacy/notice" &&
      req.path !== "/api/privacy/requests"
    ) {
      const m = await db.query(
        "SELECT 1 FROM user_mfa WHERE user_id=$1 AND enabled",
        [req.user.id],
      );
      if (!m.rowCount)
        throw new HttpException(
          "Activez la double authentification depuis Sécurité & confidentialité.",
          428,
        );
    }
    await db.query(
      "UPDATE auth_sessions SET last_seen_at=now() WHERE token_hash=$1 AND last_seen_at<now()-interval '1 minute'",
      [h],
    );
    return true;
  }
}
