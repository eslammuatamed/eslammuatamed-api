import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { RedirectsController } from './redirects.controller';
import { RedirectService } from './redirect.service';

// PrismaModule is @Global, so RedirectService injects PrismaService without importing it here
// (matches every sibling module). LocalesModule is imported for assertEnabled; RedirectService is
// exported so ArticlesModule/ProjectsModule can call buildRedirectOps inside update() (T7).
@Module({
  imports: [LocalesModule],
  controllers: [RedirectsController],
  providers: [RedirectService],
  exports: [RedirectService],
})
export class RedirectsModule {}
