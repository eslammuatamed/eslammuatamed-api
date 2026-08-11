import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

// Admin inbox mutation (FR-DSH-060, D02-4): read/archive toggles only. There is deliberately no
// content mutation on THIS route — a message's own text is never editable.
//
// The inbox is no longer triage-only: replying is a separate resource
// (`POST /admin/messages/{id}/replies`, D02-13) with its own permission, its own row and its own
// idempotency key. Keeping it off this DTO is the point — a reply is an append, not an edit.
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
