import { ConflictException } from '@nestjs/common';
import { MediaUsageEntity } from './entities/media-usage.entity';

// 409 raised when a referenced asset is deleted (doc 10 §6). The blocking references travel in the
// response object as a `usages` array; AllExceptionsFilter surfaces them as an RFC 7807 extension
// member. No rows or objects are touched when this is thrown.
export class MediaInUseException extends ConflictException {
  constructor(usages: MediaUsageEntity[]) {
    super({
      message:
        'The media asset is referenced by other records and cannot be deleted.',
      usages,
    });
  }
}
