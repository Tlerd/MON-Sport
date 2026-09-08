// Cong doi duoc (docs/PROMPT.md muc 1.3). Framework-agnostic: khong biet Nest hay
// Prisma ton tai. Ban dung bay gio: MockZaloProvider (apps/api/src/auth/providers).
// Ban sau nay: Zalo OAuth that — credential se doi hinh dang (authorization code
// thay vi externalId), sua interface luc do la binh thuong.
export interface ExternalIdentity {
  externalId: string;
  name: string;
  avatarUrl?: string;
}

export interface AuthProvider {
  resolveIdentity(credential: { externalId: string }): Promise<ExternalIdentity>;
}
