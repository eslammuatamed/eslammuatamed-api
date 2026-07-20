import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

// Admin inbox mutation (FR-DSH-060, D02-4): read/archive toggles only. There is deliberately no
// content mutation and no reply route — the inbox is read + triage, not a conversation.
export class UpdateMessageDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Mark the message read (true) or unread (false).',
  })
  @IsOptional()
  @IsBoolean()
  readonly isRead?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Archive (true) or unarchive (false) the message.',
  })
  @IsOptional()
  @IsBoolean()
  readonly isArchived?: boolean;
}
