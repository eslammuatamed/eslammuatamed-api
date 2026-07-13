import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global (doc 07 §2): one PrismaService instance is the data-mapper for every module.
// Services inject it directly — there is no repository layer (D07-2).
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
