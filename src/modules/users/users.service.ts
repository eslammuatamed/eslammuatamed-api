import { Injectable } from '@nestjs/common';
import { Prisma, User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type UserWithRole = Prisma.UserGetPayload<{ include: { role: true } }>;

// Operator accounts. This module registers no controller of its own (doc 07 module map) — but
// operator-account CRUD IS exposed over HTTP, by `AccessControlModule`'s
// `users.admin.controller.ts` (`/admin/users`), which reads and writes `prisma.user` directly
// rather than through this service. This service exists so
// AuthService can look accounts up without touching the User model itself. Login needs the
// role relation for the response; refresh only needs identity + active status.
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
