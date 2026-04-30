import { type Result, err, ok, type ConflictError } from '@lambder/shared-kernel';
import type { Hasher } from '../../domain/interfaces/hasher';
import type { UserRepository } from '../../domain/interfaces/user.repository';
import { toPublicUser } from '../../domain/entities/user.entity';
import { emailTaken } from '../../domain/errors';

export interface SignupInput {
  email: string;
  password: string;
}
export type SignupOutput = ReturnType<typeof toPublicUser>;

export class SignupService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: Hasher,
  ) {}

  async execute(input: SignupInput): Promise<Result<SignupOutput, ConflictError>> {
    const email = input.email.toLowerCase().trim();
    if (await this.users.findByEmail(email)) return err(emailTaken());
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({ email, passwordHash });
    return ok(toPublicUser(user));
  }
}
