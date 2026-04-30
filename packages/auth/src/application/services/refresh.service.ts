import { type AuthError, type Result, err, ok } from '@lambder/shared-kernel';
import type { JwtService } from '../../domain/interfaces/jwt-service';
import type { TokenStore } from '../../domain/interfaces/token-store';
import { invalidToken, tokenReused } from '../../domain/errors';

export interface RefreshInput {
  refreshToken: string;
}
export interface RefreshOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshConfig {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

export class RefreshService {
  constructor(
    private readonly jwt: JwtService,
    private readonly tokens: TokenStore,
    private readonly config: RefreshConfig,
  ) {}

  async execute(input: RefreshInput): Promise<Result<RefreshOutput, AuthError>> {
    let claims: Awaited<ReturnType<JwtService['verify']>>;
    try {
      claims = await this.jwt.verify(input.refreshToken);
    } catch {
      return err(invalidToken('Invalid refresh token'));
    }
    if (claims.kind !== 'refresh') return err(invalidToken('Not a refresh token'));

    const stillValid = await this.tokens.isWhitelisted(claims.sub, claims.jti);
    if (!stillValid) {
      await this.tokens.revokeAll(claims.sub);
      return err(tokenReused());
    }

    await this.tokens.revoke(claims.sub, claims.jti);

    const access = await this.jwt.sign({
      sub: claims.sub,
      kind: 'access',
      ttlSeconds: this.config.accessTtlSeconds,
    });
    const refresh = await this.jwt.sign({
      sub: claims.sub,
      kind: 'refresh',
      ttlSeconds: this.config.refreshTtlSeconds,
    });
    await this.tokens.whitelist(claims.sub, access.jti, this.config.accessTtlSeconds);
    await this.tokens.whitelist(claims.sub, refresh.jti, this.config.refreshTtlSeconds);

    return ok({
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: this.config.accessTtlSeconds,
    });
  }
}
