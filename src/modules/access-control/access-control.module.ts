import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessControlService } from './access-control.service';
import { RolesAdminController } from './roles.admin.controller';
import { UsersAdminController } from './users.admin.controller';

// Dynamic RBAC administration (FR-DSH-090): roles, grants, and operator accounts. AuthModule is
// imported for its exported PasswordService (argon2id hashing of new accounts). The global
// PermissionsGuard is registered in AppModule (it needs only PrismaService + Reflector, both
// global) so it can run in guard order right after the JWT guard.
@Module({
  imports: [AuthModule],
  controllers: [RolesAdminController, UsersAdminController],
  providers: [AccessControlService],
})
export class AccessControlModule {}
