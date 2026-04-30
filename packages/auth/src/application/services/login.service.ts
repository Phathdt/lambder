import { type AuthError, type Result, err, ok } from '@lambder/shared-kernel';
import type { Hasher } from '../../domain/interfaces/hasher.js';
import type { JwtService } from '../../domain/interfaces/jwt-service.js';
import type { TokenStore } from '../../domain/interfaces/token-store.js';
import type { UserRepository } from '../../domain/interfaces/user.repository.js';
import { invalidCredentials } from '../../domain/errors.js';

export interface LoginInput {
  email: string;
  password: string;
}
export interface LoginOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginConfig {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

export class LoginService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: Hasher,
    private readonly jwt: JwtService,
    private readonly tokens: TokenStore,
    private readonly config: LoginConfig,
  ) {}

  async execute(input: LoginInput): Promise<Result<LoginOutput, AuthError>> {
    const email = input.email.toLowerCase().trim();
    const user = await this.users.findByEmailWithHash(email);
    if (!user) return err(invalidCredentials());
    const valid = await this.hasher.verify(input.password, user.passwordHash);
    if (!valid) return err(invalidCredentials());

    const access = await this.jwt.sign({
      sub: user.id,
      kind: 'access',
      ttlSeconds: this.config.accessTtlSeconds,
    });
    const refresh = await this.jwt.sign({
      sub: user.id,
      kind: 'refresh',
      ttlSeconds: this.config.refreshTtlSeconds,
    });
    await this.tokens.whitelist(user.id, access.jti, this.config.accessTtlSeconds);
    await this.tokens.whitelist(user.id, refresh.jti, this.config.refreshTtlSeconds);

    return ok({
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: this.config.accessTtlSeconds,
    });
  }
}
