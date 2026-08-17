import { Module } from '@nestjs/common';
import { UploadUserIpThrottlerGuard } from '../../common/throttling/upload-user-ip-throttler.guard';
import { LocalesModule } from '../locales/locales.module';
import { MediaAdminController } from './media.admin.controller';
import { MediaDescriptorResolver } from './media-descriptor.resolver';
import { MediaProcessingService } from './media-processing.service';
import { MediaService } from './media.service';
import { ProcessingConcurrencyLimiter } from './processing-concurrency.limiter';
import { RetryAfterInterceptor } from './retry-after.interceptor';
import { StorageModule } from './storage/storage.module';

// The reusable media library. Imports StorageModule (the STORAGE_ADAPTER seam) and
// LocalesModule (alt-locale validation). PrismaService is global. `MediaProcessingService`, the
// orchestration service, and the in-process concurrency limiter are module-local providers.
// MediaDescriptorResolver is EXPORTED so public modules (projects/articles/testimonials/settings —
// and a future page-SEO read) resolve descriptors without duplicating media/URL logic.
@Module({
  imports: [StorageModule, LocalesModule],
  controllers: [MediaAdminController],
  providers: [
    MediaService,
    MediaProcessingService,
    ProcessingConcurrencyLimiter,
    RetryAfterInterceptor,
    MediaDescriptorResolver,
    // Registered so its onModuleInit runs (builds the route-local upload tier) and @UseGuards on the
    // upload route resolves this singleton from DI.
    UploadUserIpThrottlerGuard,
  ],
  exports: [MediaDescriptorResolver],
})
export class MediaModule {}
