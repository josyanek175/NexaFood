import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { AppRole } from "@nexafood/shared";
import { hashPassword, normalizeEmail, verifyPassword } from "../auth/password.js";
import { generateSessionToken, hashSessionToken } from "../auth/session-token.js";
import type { AuthContext, AuthMeResponse, AuthMembership, AuthUserDto } from "../auth/types.js";
import type { Env } from "../config/env.js";
import type { Database } from "../db/client.js";
import {
  establishmentUsers,
  establishments,
  platformAdmins,
  sessions,
  users,
} from "../db/schema/index.js";
import { badRequest, conflict, forbidden, invalidCredentials, unauthorized } from "../lib/errors.js";

export type LoginMeta = {
  ipAddress?: string;
  userAgent?: string;
};

function toUserDto(row: { id: string; email: string; fullName: string; status: string }): AuthUserDto {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    status: row.status,
  };
}

export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly env: Env,
  ) {}

  private pepper() {
    return this.env.PASSWORD_PEPPER ? { pepper: this.env.PASSWORD_PEPPER } : {};
  }

  async loadMemberships(userId: string): Promise<AuthMembership[]> {
    const rows = await this.db
      .select({
        establishmentId: establishmentUsers.establishmentId,
        organizationId: establishments.organizationId,
        establishmentName: establishments.name,
        establishmentSlug: establishments.slug,
        logoUrl: establishments.logoUrl,
        isOpen: establishments.isOpen,
        status: establishments.status,
        role: establishmentUsers.role,
        active: establishmentUsers.active,
      })
      .from(establishmentUsers)
      .innerJoin(establishments, eq(establishments.id, establishmentUsers.establishmentId))
      .where(and(eq(establishmentUsers.userId, userId), eq(establishmentUsers.active, true)));

    return rows.map((r) => ({
      establishmentId: r.establishmentId,
      organizationId: r.organizationId,
      establishmentName: r.establishmentName,
      establishmentSlug: r.establishmentSlug,
      logoUrl: r.logoUrl,
      isOpen: r.isOpen,
      status: r.status,
      role: r.role as AppRole,
      active: r.active,
    }));
  }

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ userId: platformAdmins.userId })
      .from(platformAdmins)
      .where(eq(platformAdmins.userId, userId))
      .limit(1);
    return Boolean(row);
  }

  private resolveCurrentEstablishmentId(
    stored: string | null,
    memberships: AuthMembership[],
  ): string | null {
    if (stored && memberships.some((m) => m.establishmentId === stored && m.active)) {
      return stored;
    }
    return memberships[0]?.establishmentId ?? null;
  }

  private async buildMe(user: AuthUserDto, sessionCurrentEstablishmentId: string | null): Promise<AuthMeResponse> {
    const [memberships, isPlatformAdmin] = await Promise.all([
      this.loadMemberships(user.id),
      this.isPlatformAdmin(user.id),
    ]);
    const currentEstablishmentId = this.resolveCurrentEstablishmentId(
      sessionCurrentEstablishmentId,
      memberships,
    );

    return {
      user,
      isPlatformAdmin,
      memberships: memberships.map((m) => ({
        establishmentId: m.establishmentId,
        organizationId: m.organizationId,
        establishmentName: m.establishmentName,
        establishmentSlug: m.establishmentSlug,
        logoUrl: m.logoUrl,
        isOpen: m.isOpen,
        status: m.status,
        role: m.role,
      })),
      currentEstablishmentId,
    };
  }

  async register(input: {
    email: string;
    password: string;
    fullName: string;
    meta?: LoginMeta;
  }): Promise<{ token: string; me: AuthMeResponse }> {
    const email = normalizeEmail(input.email);
    if (input.password.length < 6) {
      throw badRequest("Senha deve ter pelo menos 6 caracteres.");
    }

    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (existing) throw conflict("Não foi possível criar a conta.");

    const passwordHash = await hashPassword(input.password, this.pepper());
    const [user] = await this.db
      .insert(users)
      .values({
        email,
        passwordHash,
        fullName: input.fullName.trim() || email,
        status: "ACTIVE",
      })
      .returning();
    if (!user) throw conflict("Não foi possível criar a conta.");

    return this.login(email, input.password, input.meta ?? {});
  }

  async login(
    emailRaw: string,
    password: string,
    meta: LoginMeta = {},
  ): Promise<{ token: string; me: AuthMeResponse }> {
    const email = normalizeEmail(emailRaw);
    const [user] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    // Uniform failure path — do not reveal which check failed.
    if (!user || user.status !== "ACTIVE" || !user.passwordHash) {
      throw invalidCredentials();
    }

    const ok = await verifyPassword(user.passwordHash, password, this.pepper());
    if (!ok) throw invalidCredentials();

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + this.env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const memberships = await this.loadMemberships(user.id);
    const currentEstablishmentId = memberships[0]?.establishmentId ?? null;

    await this.db.insert(sessions).values({
      userId: user.id,
      tokenHash,
      currentEstablishmentId,
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    });

    const me = await this.buildMe(toUserDto(user), currentEstablishmentId);
    return { token, me };
  }

  async logoutByToken(token: string | null): Promise<void> {
    if (!token) return;
    const tokenHash = hashSessionToken(token);
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
  }

  async resolveAuthFromToken(token: string | null): Promise<AuthContext | null> {
    if (!token) return null;
    const tokenHash = hashSessionToken(token);
    const now = new Date();

    const [row] = await this.db
      .select({
        sessionId: sessions.id,
        userId: sessions.userId,
        currentEstablishmentId: sessions.currentEstablishmentId,
        expiresAt: sessions.expiresAt,
        revokedAt: sessions.revokedAt,
        email: users.email,
        fullName: users.fullName,
        status: users.status,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
      .limit(1);

    if (!row || row.status !== "ACTIVE") return null;

    await this.db
      .update(sessions)
      .set({ lastSeenAt: now })
      .where(eq(sessions.id, row.sessionId));

    const user = toUserDto({
      id: row.userId,
      email: row.email,
      fullName: row.fullName,
      status: row.status,
    });
    const [memberships, isPlatformAdmin] = await Promise.all([
      this.loadMemberships(user.id),
      this.isPlatformAdmin(user.id),
    ]);
    const currentEstablishmentId = this.resolveCurrentEstablishmentId(
      row.currentEstablishmentId,
      memberships,
    );

    return {
      userId: user.id,
      sessionId: row.sessionId,
      currentEstablishmentId,
      memberships,
      isPlatformAdmin,
      user,
    };
  }

  async getMe(auth: AuthContext): Promise<AuthMeResponse> {
    return this.buildMe(auth.user, auth.currentEstablishmentId);
  }

  async setCurrentEstablishment(auth: AuthContext, establishmentId: string): Promise<AuthMeResponse> {
    const allowed = auth.memberships.some((m) => m.establishmentId === establishmentId && m.active);
    if (!allowed) {
      // Platform admins do not get silent cross-tenant switch here.
      throw forbidden("Estabelecimento não autorizado para este usuário.");
    }

    await this.db
      .update(sessions)
      .set({ currentEstablishmentId: establishmentId, lastSeenAt: new Date() })
      .where(eq(sessions.id, auth.sessionId));

    return this.buildMe(auth.user, establishmentId);
  }

  /** Test/helper: create a user with hashed password. */
  async createUser(input: {
    email: string;
    password: string;
    fullName: string;
    status?: "ACTIVE" | "SUSPENDED" | "TRIAL" | "INACTIVE";
  }) {
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password, this.pepper());
    const [row] = await this.db
      .insert(users)
      .values({
        email,
        passwordHash,
        fullName: input.fullName,
        status: input.status ?? "ACTIVE",
      })
      .returning();
    return row!;
  }
}

export function assertAuthenticated(auth: AuthContext | null | undefined): AuthContext {
  if (!auth) throw unauthorized();
  return auth;
}
