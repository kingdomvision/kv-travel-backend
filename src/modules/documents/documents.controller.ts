import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateDocumentDto, DocumentsService } from './documents.service';
import {
  AuthUser,
  CurrentUser,
  RequireTenantRoles,
} from '../../common/decorators';
import { TenantRole } from '../../common/enums';
import { TenantGuard } from '../identity/guards';

@ApiTags('tenant-documents')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('tenant/me/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequireTenantRoles(
    TenantRole.TENANT_ADMIN,
    TenantRole.AGENT,
    TenantRole.FINANCE,
  )
  list(@CurrentUser() user: AuthUser) {
    return this.documentsService.list(user.tenantId!);
  }

  @Post()
  @RequireTenantRoles(TenantRole.TENANT_ADMIN, TenantRole.AGENT)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.documentsService.create(user.tenantId!, dto, user);
  }

  @Get(':id/download-url')
  @RequireTenantRoles(
    TenantRole.TENANT_ADMIN,
    TenantRole.AGENT,
    TenantRole.FINANCE,
  )
  downloadUrl(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documentsService.getDownloadUrl(user.tenantId!, id);
  }
}
