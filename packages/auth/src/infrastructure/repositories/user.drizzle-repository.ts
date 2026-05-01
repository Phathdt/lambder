import type { Database } from '@lambder/db';
import { sql } from 'drizzle-orm';
import type { NewUser, User, UserWithHash } from '../../domain/entities/user.entity';
import type { UserRepository } from '../../domain/interfaces/user.repository';
import { users, type UserRow } from '../db/auth.schema';

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toUserWithHash = (row: UserRow): UserWithHash => ({
  ...toUser(row),
  passwordHash: row.passwordHash,
});

export class UserDrizzleRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByEmailWithHash(email: string): Promise<UserWithHash | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);
    return rows[0] ? toUserWithHash(rows[0]) : null;
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(sql`${users.id} = ${id}`)
      .limit(1);
    /* c8 ignore next 1 */
    return rows[0] ? toUser(rows[0]) : null;
  }

  async create(input: NewUser): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({ email: input.email, passwordHash: input.passwordHash })
      .returning();
    /* c8 ignore next 1 */
    if (!row) throw new Error('Failed to insert user');
    return toUser(row);
  }
}
