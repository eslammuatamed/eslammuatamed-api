import { ApiProperty } from '@nestjs/swagger';

export class LivenessStatus {
  @ApiProperty({ example: 'ok' })
  readonly status!: 'ok';

  @ApiProperty({ example: 12345.6, description: 'Process uptime in seconds.' })
  readonly uptime!: number;

  @ApiProperty({ example: '2026-07-13T12:00:00.000Z' })
  readonly timestamp!: string;
}

export class ReadinessStatus {
  @ApiProperty({ example: 'ok' })
  readonly status!: 'ok';

  @ApiProperty({ example: 'up', enum: ['up'] })
  readonly database!: 'up';
}
