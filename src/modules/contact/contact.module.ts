import { Module } from '@nestjs/common';
import { ContactThrottlerGuard } from '../../common/throttling/contact-throttler.guard';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { MessagesAdminController } from './messages.admin.controller';

// PrismaModule is @Global, so ContactService injects PrismaService without importing it here (matches
// every sibling module). ContactThrottlerGuard is registered as a provider so its onModuleInit runs
// (materializing its route-local 3/hour + 10/day windows) and @UseGuards on POST /contact resolves
// this singleton from DI — the same wiring MediaModule uses for UploadUserIpThrottlerGuard (T2).
@Module({
  controllers: [ContactController, MessagesAdminController],
  providers: [ContactService, ContactThrottlerGuard],
})
export class ContactModule {}
