import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import {
  PermissionCatalogEntity,
  RoleEntity,
} from './entities/access-control.entities';

@ApiTags('access-control')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin')
export class RolesAdminController {
  constructor(private readonly accessControl: AccessControlService) {}

  @Get('permissions')
  @RequirePermission('roles.read')
  @ApiOperation({
    summary: 'The read-only code-defined permission catalog (D10-9).',
  })
  @ApiOkEnvelope(PermissionCatalogEntity)
  getPermissions(): PermissionCatalogEntity {
    return this.accessControl.getPermissionCatalog();
  }

  @Get('roles')
  @RequirePermission('roles.read')
  @ApiOperation({ summary: 'List roles with their granted permission keys.' })
  @ApiOkEnvelope(RoleEntity, { isArray: true })
  listRoles(): Promise<RoleEntity[]> {
    return this.accessControl.listRoles();
  }

  @Get('roles/:id')
  @RequirePermission('roles.read')
  @ApiOperation({ summary: 'Get one role.' })
  @ApiOkEnvelope(RoleEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Role not found.')
  @ApiUuidParamBadRequest('role')
  getRole(@Param('id', ParseUUIDPipe) id: string): Promise<RoleEntity> {
    return this.accessControl.getRole(id);
  }

  @Post('roles')
  @RequirePermission('roles.create')
  @ApiOperation({
    summary: 'Create a custom role and grant it permission keys.',
  })
  @ApiCreatedEnvelope(RoleEntity)
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Unknown permission key or duplicate name.',
  )
  createRole(@Body() dto: CreateRoleDto): Promise<RoleEntity> {
    return this.accessControl.createRole(dto);
  }

  @Patch('roles/:id')
  @RequirePermission('roles.update')
  @ApiOperation({
    summary: 'Update a custom role (system roles reject edits with 422).',
  })
  @ApiOkEnvelope(RoleEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Role not found.')
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'System role, unknown key, or duplicate name.',
  )
  @ApiUuidParamBadRequest('role')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleEntity> {
    return this.accessControl.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @RequirePermission('roles.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a custom role (system role or still-assigned role → 422).',
  })
  @ApiNoContentResponse({ description: 'Role deleted.' })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Role not found.')
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'System role or still assigned to users.',
  )
  @ApiUuidParamBadRequest('role')
  async deleteRole(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.accessControl.deleteRole(id);
  }
}
