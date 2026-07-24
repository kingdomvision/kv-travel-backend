import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { PlansService } from './plans.service';
import { ModulesService } from './modules.service';
import { AddonsService } from './addons.service';
import { TenantAddonsService } from './tenant-addons.service';
import { CreateTenantDto, UpdateTenantStatusDto } from './dto/tenant.dto';
import { ChangeTenantPlanDto } from './dto/tenant-module.dto';
import {
  CreatePlanDto,
  UpdatePlanDto,
  AssignPlanModuleDto,
} from './dto/plan.dto';
import {
  CreateAddonDto,
  UpdateAddonDto,
  PurchaseAddonDto,
} from './dto/addon.dto';
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
    private readonly plansService: PlansService,
    private readonly modulesService: ModulesService,
    private readonly addonsService: AddonsService,
    private readonly tenantAddonsService: TenantAddonsService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Tenants ──────────────────────────────────────────────

  @Get('tenants')
  @RequirePlatformRoles(
    PlatformRole.SUPER_ADMIN,
    PlatformRole.OPS,
    PlatformRole.SUPPORT,
  )
  listTenants() {
    return this.tenantsService.findAll();
  }

  @Get('tenants/:id')
  @RequirePlatformRoles(
    PlatformRole.SUPER_ADMIN,
    PlatformRole.OPS,
    PlatformRole.SUPPORT,
  )
  getTenant(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Get('tenants/:id/details')
  @RequirePlatformRoles(
    PlatformRole.SUPER_ADMIN,
    PlatformRole.OPS,
    PlatformRole.SUPPORT,
  )
  getTenantWithModules(@Param('id') id: string) {
    return this.tenantsService.findOneWithModules(id);
  }

  @Post('tenants')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  createTenant(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthUser) {
    return this.tenantsService.create(dto, user);
  }

  @Patch('tenants/:id')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  updateTenant(
    @Param('id') id: string,
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tenantsService.updateProfile(id, dto, user);
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

  @Patch('tenants/:id/plan')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  changeTenantPlan(
    @Param('id') id: string,
    @Body() dto: ChangeTenantPlanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tenantsService.changePlan(id, dto, user);
  }

  @Get('tenants/:id/modules')
  @RequirePlatformRoles(
    PlatformRole.SUPER_ADMIN,
    PlatformRole.OPS,
    PlatformRole.SUPPORT,
  )
  getTenantModules(@Param('id') id: string) {
    return this.tenantAddonsService.listForTenantModules(id);
  }

  @Post('tenants/:id/addons')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  purchaseAddon(
    @Param('id') id: string,
    @Body() dto: PurchaseAddonDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tenantAddonsService.purchase(id, dto, user);
  }

  @Get('tenants/:id/addons')
  @RequirePlatformRoles(
    PlatformRole.SUPER_ADMIN,
    PlatformRole.OPS,
    PlatformRole.SUPPORT,
  )
  getTenantAddons(@Param('id') id: string) {
    return this.tenantAddonsService.listForTenant(id);
  }

  @Delete('tenants/:id/addons/:addonId')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  cancelTenantAddon(
    @Param('id') id: string,
    @Param('addonId') addonId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tenantAddonsService.cancel(id, addonId, user);
  }

  // ─── Plans ──────────────────────────────────────────────

  @Get('plans')
  @RequirePlatformRoles(
    PlatformRole.SUPER_ADMIN,
    PlatformRole.OPS,
    PlatformRole.SUPPORT,
  )
  listPlans() {
    return this.plansService.findAll();
  }

  @Get('plans/:id')
  @RequirePlatformRoles(
    PlatformRole.SUPER_ADMIN,
    PlatformRole.OPS,
    PlatformRole.SUPPORT,
  )
  getPlan(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Post('plans')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  createPlan(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthUser) {
    return this.plansService.create(dto, user);
  }

  @Patch('plans/:id')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.plansService.update(id, dto, user);
  }

  @Delete('plans/:id')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN)
  deletePlan(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.plansService.remove(id, user);
  }

  @Post('plans/:id/modules')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  assignPlanModule(
    @Param('id') id: string,
    @Body() dto: AssignPlanModuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.plansService.assignModule(id, dto, user);
  }

  @Delete('plans/:id/modules/:moduleCode')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  removePlanModule(
    @Param('id') id: string,
    @Param('moduleCode') moduleCode: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.plansService.removeModule(id, moduleCode, user);
  }

  // ─── Modules ──────────────────────────────────────────────

  @Get('modules')
  @RequirePlatformRoles(
    PlatformRole.SUPER_ADMIN,
    PlatformRole.OPS,
    PlatformRole.SUPPORT,
  )
  listModules() {
    return this.modulesService.findAll();
  }

  // ─── Addons ──────────────────────────────────────────────

  @Get('addons')
  @RequirePlatformRoles(
    PlatformRole.SUPER_ADMIN,
    PlatformRole.OPS,
    PlatformRole.SUPPORT,
  )
  listAddons() {
    return this.addonsService.findAll();
  }

  @Get('addons/:id')
  @RequirePlatformRoles(
    PlatformRole.SUPER_ADMIN,
    PlatformRole.OPS,
    PlatformRole.SUPPORT,
  )
  getAddon(@Param('id') id: string) {
    return this.addonsService.findOne(id);
  }

  @Post('addons')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  createAddon(@Body() dto: CreateAddonDto, @CurrentUser() user: AuthUser) {
    return this.addonsService.create(dto, user);
  }

  @Patch('addons/:id')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  updateAddon(
    @Param('id') id: string,
    @Body() dto: UpdateAddonDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.addonsService.update(id, dto, user);
  }

  @Delete('addons/:id')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN)
  deleteAddon(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.addonsService.remove(id, user);
  }

  // ─── Audit Logs ──────────────────────────────────────────

  @Get('audit-logs')
  @RequirePlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.OPS)
  listAuditLogs() {
    return this.auditService.list(100);
  }
}
