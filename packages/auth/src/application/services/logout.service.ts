import type { TokenStore } from '../../domain/interfaces/token-store.js';

export interface LogoutInput {
  userId: string;
  jti: string;
}

export class LogoutService {
  constructor(private readonly tokens: TokenStore) {}

  async execute(input: LogoutInput): Promise<void> {
    await this.tokens.revoke(input.userId, input.jti);
  }
}
