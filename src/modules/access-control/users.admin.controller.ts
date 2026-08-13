import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
} from '../../common/swagger/api-envelope';
import {
  ApiAdminErrorResponses,
  ApiProblemResponse,
  ApiUuidParamBadRequest,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { AccessControlService } from './access-control.service';
import { RequirePermission } from './decorators/require-permission.decorator';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UserEntity } from './entities/access-control.entities';

@ApiTags('access-control')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/users')
export class UsersAdminController {
  constructor(private readonly accessControl: AccessControlService) {}

  @Get()
  @RequirePermission('users.read')
  @ApiOperation({
    summary: 'List operator accounts with their role and active status.',
  })
  @ApiOkEnvelope(UserEntity)
  list(): Promise<UserEntity[]> {
    return this.accessControl.listUsers();
  }

  @Post()
  @RequirePermission('users.create')
  @ApiOperation({ summary: 'Create an operator account with a role.' })
  @ApiCreatedEnvelope(UserEntity)
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Unknown role or duplicate email.',
  )
  create(@Body() dto: CreateUserDto): Promise<UserEntity> {
    return this.accessControl.createUser(dto);
  }

  @Patch(':id')
  @RequirePermission('users.update')
  @ApiOperation({ summary: 'Assign a role or activate/deactivate an account.' })
  @ApiOkEnvelope(UserEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'User not found.')
  @ApiProblemResponse(HttpStatus.UNPROCESSABLE_ENTITY, 'Unknown role.')
  @ApiUuidParamBadRequest('user')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserEntity> {
    return this.accessControl.updateUser(id, dto);
  }
}
