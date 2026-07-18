import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { PublicMediaImageDescriptor } from '../../media/entities/media-descriptor.entity';

export class PublicTestimonialEntity {
  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  readonly avatarId!: string | null;
  @ApiProperty({
    type: PublicMediaImageDescriptor,
    nullable: true,
    description: 'Resolved avatar image (null when no avatar is set).',
  })
  readonly avatar!: PublicMediaImageDescriptor | null;
  @ApiProperty() readonly order!: number;
  @ApiProperty() readonly quote!: string;
  @ApiProperty() readonly authorName!: string;
  @ApiProperty() readonly authorRole!: string;
  @ApiProperty({ type: [String], example: ['en', 'ar'] })
  readonly availableLocales!: string[];
}

export class TestimonialTranslationEntity {
  @ApiProperty() readonly quote!: string;
  @ApiProperty() readonly authorName!: string;
  @ApiProperty() readonly authorRole!: string;
}

@ApiExtraModels(TestimonialTranslationEntity)
export class AdminTestimonialEntity {
  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  readonly avatarId!: string | null;
  @ApiProperty() readonly order!: number;
  @ApiProperty() readonly isVisible!: boolean;
  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(TestimonialTranslationEntity) },
  })
  readonly translations!: Record<string, TestimonialTranslationEntity>;
}
