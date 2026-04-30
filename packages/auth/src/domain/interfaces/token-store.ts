export interface TokenStore {
  whitelist(userId: string, jti: string, ttlSeconds: number): Promise<void>;
  isWhitelisted(userId: string, jti: string): Promise<boolean>;
  revoke(userId: string, jti: string): Promise<void>;
  revokeAll(userId: string): Promise<void>;
}
