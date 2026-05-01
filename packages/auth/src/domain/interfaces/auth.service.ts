import type { AuthError, ConflictError, Result } from '@lambder/shared-kernel';
import type { PublicUser } from '../entities/user.entity';

// Domain-facing contract for the auth feature. Adapters depend on this; the
// concrete AuthService class lives in application/services.
export interface SignupInput {
  readonly email: string;
  readonly password: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface LogoutInput {
  readonly userId: string;
  readonly jti: string;
}

export interface RefreshInput {
  readonly refreshToken: string;
}

export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export interface AuthService {
  signup(input: SignupInput): Promise<Result<PublicUser, ConflictError>>;
  login(input: LoginInput): Promise<Result<TokenPair, AuthError>>;
  logout(input: LogoutInput): Promise<void>;
  refresh(input: RefreshInput): Promise<Result<TokenPair, AuthError>>;
}
