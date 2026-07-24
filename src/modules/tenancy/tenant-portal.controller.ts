import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import {
  CreateTenantUserDto,
  TenantUsersService,
  UpdateTenantUserDto,
} from './tenant-users.service';
import { UpdateTenantProfileDto } from './dto/tenant.dto';
import {
  CurrentUser,
  AuthUser,
  RequireTenantRoles,
} from '../../common/decorators';
import { TenantRole } from '../../common/enums';
import { TenantGuard } from '../identity/guards';
import { AuditService } from '../identity/audit.service';

@ApiTags('tenant')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('tenant')
export class TenantPortalController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly usersService: TenantUsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get('me/company')
  @RequireTenantRoles(
    TenantRole.TENANT_ADMIN,
    TenantRole.AGENT,
    TenantRole.FINANCE,
  )
  getCompany(@CurrentUser() user: AuthUser) {
    return this.tenantsService.findOne(user.tenantId!);
  }

  @Patch('me/company')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN)
  updateCompany(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTenantProfileDto,
  ) {
    return this.tenantsService.updateProfile(user.tenantId!, dto, user);
  }

  @Get('me/users')
  @RequireTenantRoles(
    TenantRole.TENANT_ADMIN,
    TenantRole.AGENT,
    TenantRole.FINANCE,
  )
  listUsers(@CurrentUser() user: AuthUser) {
    return this.usersService.list(user.tenantId!);
  }

  @Post('me/users')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN)
  createUser(@CurrentUser() user: AuthUser, @Body() dto: CreateTenantUserDto) {
    return this.usersService.create(user.tenantId!, dto, user);
  }

  @Patch('me/users/:id')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN)
  updateUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantUserDto,
  ) {
    return this.usersService.update(user.tenantId!, id, dto, user);
  }

  @Get('me/audit-logs')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN)
  listAudit(@CurrentUser() user: AuthUser) {
    return this.auditService.listForTenant(user.tenantId!, 50);
  }
}
