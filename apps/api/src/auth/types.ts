import type { AppRole } from "@nexafood/shared";

export type AuthMembership = {
  establishmentId: string;
  organizationId: string;
  establishmentName: string;
  establishmentSlug: string;
  logoUrl: string | null;
  isOpen: boolean;
  status: string;
  role: AppRole;
  active: boolean;
};

export type AuthUserDto = {
  id: string;
  email: string;
  fullName: string;
  status: string;
};

export type AuthMeResponse = {
  user: AuthUserDto;
  isPlatformAdmin: boolean;
  memberships: Array<{
    establishmentId: string;
    organizationId: string;
    establishmentName: string;
    establishmentSlug: string;
    logoUrl: string | null;
    isOpen: boolean;
    status: string;
    role: AppRole;
  }>;
  currentEstablishmentId: string | null;
};

export type AuthContext = {
  userId: string;
  sessionId: string;
  currentEstablishmentId: string | null;
  memberships: AuthMembership[];
  isPlatformAdmin: boolean;
  user: AuthUserDto;
};

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}
