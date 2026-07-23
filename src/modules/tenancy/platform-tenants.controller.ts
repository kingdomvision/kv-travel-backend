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
  CreateTenantDto,
  UpdateTenantStatusDto,
} from './dto/tenant.dto';
import {
  CurrentUser,
  AuthUser,
  RequirePlatformRoles,
} from '../../common/decorators';
import { PlatformRole } from '../../common/enums';
import { PlatformGuard } from '../identity/guards';
import { AuditService } from '../identity/audit.service';

@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(PlatformGuard)
@Controller('platform')
export class PlatformTenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('tenants')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS, PlatformRole.SUPPORT)
  listTenants() {
    return this.tenantsService.findAll();
  }

  @Get('tenants/:id')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS, PlatformRole.SUPPORT)
  getTenant(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post('tenants')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  createTenant(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthUser) {
    return this.tenantsService.create(dto, user);
  }

  @Patch('tenants/:id/status')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tenantsService.updateStatus(id, dto, user);
  }

  @Get('plans')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS, PlatformRole.SUPPORT)
  listPlans() {
    return this.tenantsService.listPlans();
  }

  @Get('audit-logs')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  listAuditLogs() {
    return this.auditService.list(100);
  }
}
