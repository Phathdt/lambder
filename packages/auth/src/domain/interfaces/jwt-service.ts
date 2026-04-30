export type JwtKind = 'access' | 'refresh';

export interface JwtClaims {
  sub: string;
  jti: string;
  kind: JwtKind;
  iat: number;
  exp: number;
}

export interface SignedToken {
  token: string;
  jti: string;
  expiresAt: number;
}

export interface JwtService {
  sign(input: { sub: string; kind: JwtKind; ttlSeconds: number }): Promise<SignedToken>;
  verify(token: string): Promise<JwtClaims>;
}
