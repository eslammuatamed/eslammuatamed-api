import { Module } from '@nestjs/common';
import { ContactThrottlerGuard } from '../../common/throttling/contact-throttler.guard';
import { MailModule } from '../mail/mail.module';
import { ContactMailService } from './contact-mail.service';
import { ContactController } from './contact.controller';
import { ContactPurgeScheduler } from './contact-purge.scheduler';
import { ContactService } from './contact.service';
import { MessagesAdminController } from './messages.admin.controller';

// PrismaModule is @Global, so ContactService injects PrismaService without importing it here (matches
// every sibling module). ContactThrottlerGuard is registered as a provider so its onModuleInit runs
// (materializing its route-local 3/hour + 10/day windows) and @UseGuards on POST /contact resolves
// this singleton from DI — the same wiring MediaModule uses for UploadUserIpThrottlerGuard (T2).
// ContactPurgeScheduler is a provider so the global ScheduleModule (AppModule) discovers its @Cron
// handler — the same wiring ArticlesModule uses for ArticlesScheduler (D07-3, doc 19 §6/D19-10).
// MailModule supplies the delivery layer for the post-commit contact notifications; it is imported
// (not @Global) so this module's mail dependency is visible where the dependency actually is.
@Module({
  imports: [MailModule],
  controllers: [ContactController, MessagesAdminController],
  providers: [
    ContactService,
    ContactMailService,
    ContactThrottlerGuard,
    ContactPurgeScheduler,
  ],
})
export class ContactModule {}
