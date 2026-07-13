import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import { ApiProblemResponse } from '../../common/swagger/api-problem-response';
import {
  LivenessStatus,
  ReadinessStatus,
} from './entities/health-status.entity';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness probe (no database access).' })
  @ApiOkEnvelope(LivenessStatus)
  liveness(): LivenessStatus {
    return this.healthService.liveness();
  }

  @Get('ready')
  @Public()
  @ApiOperation({
    summary: 'Readiness probe — verifies the database connection.',
  })
  @ApiOkEnvelope(ReadinessStatus)
  @ApiProblemResponse(
    HttpStatus.SERVICE_UNAVAILABLE,
    'The database is unreachable.',
  )
  readiness(): Promise<ReadinessStatus> {
    return this.healthService.readiness();
  }
}
