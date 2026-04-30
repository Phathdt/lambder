export interface User {
  readonly id: string;
  readonly email: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UserWithHash extends User {
  readonly passwordHash: string;
}

export interface NewUser {
  readonly email: string;
  readonly passwordHash: string;
}

export const toPublicUser = (u: User) => ({ id: u.id, email: u.email });
