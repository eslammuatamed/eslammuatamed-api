import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import {
  mailRetryBackoffProvider,
  mailTransportProvider,
} from './mail.transport';

// Delivery infrastructure, imported by the domain modules that send. Not @Global: exactly one
// module sends mail today, and a global provider would make the next sender invisible in its own
// module's imports. AppConfigModule is @Global (like PrismaModule), so AppConfigService is injected
// into the transport factory without importing it here.
@Module({
  providers: [MailService, mailTransportProvider, mailRetryBackoffProvider],
  exports: [MailService],
})
export class MailModule {}
