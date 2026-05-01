import type { EmailEnqueuer } from '@lambder/email';
import {
  AuthError,
  ConflictError,
  type Logger,
  type Result,
  err,
  ok,
} from '@lambder/shared-kernel';
import { toPublicUser, type PublicUser } from '../../domain/entities/user.entity';
import { emailTaken, invalidCredentials, invalidToken, tokenReused } from '../../domain/errors';
import type {
  AuthService as AuthServiceContract,
  LoginInput,
  LogoutInput,
  RefreshInput,
  SignupInput,
  TokenPair,
} from '../../domain/interfaces/auth.service';
import type { Hasher } from '../../domain/interfaces/hasher';
import type { JwtService } from '../../domain/interfaces/jwt-service';
import type { TokenStore } from '../../domain/interfaces/token-store';
import type { UserRepository } from '../../domain/interfaces/user.repository';

export interface AuthServiceConfig {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

// Single service class that owns the auth use-cases. Routes/HTTP adapters
// only depend on the interface (AuthServiceContract); this concrete class
// composes the lower-level ports (UserRepository, Hasher, JwtService,
// TokenStore) into the four operations.
export class AuthService implements AuthServiceContract {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: Hasher,
    private readonly jwt: JwtService,
    private readonly tokens: TokenStore,
    private readonly emailEnqueuer: EmailEnqueuer,
    private readonly config: AuthServiceConfig,
    private readonly logger?: Logger,
  ) {}

  async signup(input: SignupInput): Promise<Result<PublicUser, ConflictError>> {
    const email = input.email.toLowerCase().trim();
    if (await this.users.findByEmail(email)) return err(emailTaken());
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({ email, passwordHash });

    // Fire-and-forget welcome email. SQS / provider outages must NEVER 5xx
    // a signup. Failures are surfaced via structured logs for ops alerting.
    try {
      await this.emailEnqueuer.enqueueWelcome({ userId: user.id, email: user.email });
    } catch (error) {
      this.logger?.error({ err: error, userId: user.id }, 'welcome-email.enqueue-failed');
    }

    return ok(toPublicUser(user));
  }

  async login(input: LoginInput): Promise<Result<TokenPair, AuthError>> {
    const email = input.email.toLowerCase().trim();
    const user = await this.users.findByEmailWithHash(email);
    if (!user) return err(invalidCredentials());
    const valid = await this.hasher.verify(input.password, user.passwordHash);
    if (!valid) return err(invalidCredentials());

    return ok(await this.issueTokenPair(user.id));
  }

  async logout(input: LogoutInput): Promise<void> {
    await this.tokens.revoke(input.userId, input.jti);
  }

  async refresh(input: RefreshInput): Promise<Result<TokenPair, AuthError>> {
    let claims: Awaited<ReturnType<JwtService['verify']>>;
    try {
      claims = await this.jwt.verify(input.refreshToken);
    } catch {
      return err(invalidToken('Invalid refresh token'));
    }
    if (claims.kind !== 'refresh') return err(invalidToken('Not a refresh token'));

    const stillValid = await this.tokens.isWhitelisted(claims.sub, claims.jti);
    if (!stillValid) {
      // Reuse detection: revoke ALL active sessions for this user.
      await this.tokens.revokeAll(claims.sub);
      return err(tokenReused());
    }
    await this.tokens.revoke(claims.sub, claims.jti);
    return ok(await this.issueTokenPair(claims.sub));
  }

  // Mints a new access + refresh pair, whitelisting both jti's so the
  // token-store treats them as live until logout / revoke.
  private async issueTokenPair(userId: string): Promise<TokenPair> {
    const access = await this.jwt.sign({
      sub: userId,
      kind: 'access',
      ttlSeconds: this.config.accessTtlSeconds,
    });
    const refresh = await this.jwt.sign({
      sub: userId,
      kind: 'refresh',
      ttlSeconds: this.config.refreshTtlSeconds,
    });
    await this.tokens.whitelist(userId, access.jti, this.config.accessTtlSeconds);
    await this.tokens.whitelist(userId, refresh.jti, this.config.refreshTtlSeconds);
    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: this.config.accessTtlSeconds,
    };
  }
}
