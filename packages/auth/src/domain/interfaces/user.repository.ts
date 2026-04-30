import type { NewUser, User, UserWithHash } from '../entities/user.entity.js';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByEmailWithHash(email: string): Promise<UserWithHash | null>;
  findById(id: string): Promise<User | null>;
  create(input: NewUser): Promise<User>;
}
