import { SignJWT, importPKCS8, importSPKI, jwtVerify, type KeyLike } from 'jose';
import { randomUUID } from 'node:crypto';
import type {
  JwtClaims,
  JwtKind,
  JwtService,
  SignedToken,
} from '../../domain/interfaces/jwt-service';

const ALG = 'EdDSA';

export interface JoseJwtConfig {
  privateKeyPem: string;
  publicKeyPem: string;
  issuer?: string;
  audience?: string;
}

export class JoseJwtService implements JwtService {
  private privKey: KeyLike | undefined;
  private pubKey: KeyLike | undefined;

  constructor(private readonly config: JoseJwtConfig) {}

  private async keys(): Promise<{ priv: KeyLike; pub: KeyLike }> {
    if (!this.privKey) this.privKey = await importPKCS8(this.config.privateKeyPem, ALG);
    if (!this.pubKey) this.pubKey = await importSPKI(this.config.publicKeyPem, ALG);
    return { priv: this.privKey, pub: this.pubKey };
  }

  async sign(input: { sub: string; kind: JwtKind; ttlSeconds: number }): Promise<SignedToken> {
    const { priv } = await this.keys();
    const jti = randomUUID();
    const builder = new SignJWT({ kind: input.kind })
      .setProtectedHeader({ alg: ALG })
      .setSubject(input.sub)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(`${input.ttlSeconds}s`);
    if (this.config.issuer) builder.setIssuer(this.config.issuer);
    if (this.config.audience) builder.setAudience(this.config.audience);
    const token = await builder.sign(priv);
    const expiresAt = Math.floor(Date.now() / 1000) + input.ttlSeconds;
    return { token, jti, expiresAt };
  }

  async verify(token: string): Promise<JwtClaims> {
    const { pub } = await this.keys();
    const opts: Parameters<typeof jwtVerify>[2] = { algorithms: [ALG] };
    if (this.config.issuer) opts.issuer = this.config.issuer;
    if (this.config.audience) opts.audience = this.config.audience;
    const { payload } = await jwtVerify(token, pub, opts);
    /* c8 ignore next 2 */
    if (!payload.sub || !payload.jti || !payload.iat || !payload.exp) {
      throw new Error('Malformed token claims');
    }
    const kind = payload.kind;
    /* c8 ignore next 1 */
    if (kind !== 'access' && kind !== 'refresh') throw new Error('Invalid kind');
    return {
      sub: payload.sub,
      jti: payload.jti,
      kind,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
