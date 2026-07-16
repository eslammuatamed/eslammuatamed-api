import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import { LocaleEntity } from './entities/locale.entity';
import { LocalesService } from './locales.service';

@ApiTags('locales')
@Controller('locales')
export class LocalesController {
  constructor(private readonly localesService: LocalesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List enabled content locales.' })
  @ApiOkEnvelope(LocaleEntity, {
    description: 'Enabled locales, ordered.',
    isArray: true,
  })
  list(): Promise<LocaleEntity[]> {
    return this.localesService.listEnabled();
  }
}
