import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { MediaAdminController } from './media.admin.controller';
import { MediaDescriptorResolver } from './media-descriptor.resolver';
import { MediaProcessingService } from './media-processing.service';
import { MediaService } from './media.service';
import { ProcessingConcurrencyLimiter } from './processing-concurrency.limiter';
import { RetryAfterInterceptor } from './retry-after.interceptor';
import { StorageModule } from './storage/storage.module';

// The reusable media library (feature 003). Imports StorageModule (the STORAGE_ADAPTER seam) and
// LocalesModule (alt-locale validation). PrismaService is global. The processing service (T5), the
// orchestration service, and the in-process concurrency limiter are module-local providers.
// MediaDescriptorResolver is EXPORTED so public modules (projects/articles/testimonials/settings —
// and a future page-SEO read) resolve descriptors without duplicating media/URL logic (T7).
@Module({
  imports: [StorageModule, LocalesModule],
  controllers: [MediaAdminController],
  providers: [
    MediaService,
    MediaProcessingService,
    ProcessingConcurrencyLimiter,
    RetryAfterInterceptor,
    MediaDescriptorResolver,
  ],
  exports: [MediaDescriptorResolver],
})
export class MediaModule {}
