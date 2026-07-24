import { Injectable } from '@nestjs/common';
import { Module } from './entities/module.entity';
import { TenantConnectionService } from '../../database/tenant-connection.service';

@Injectable()
export class ModulesService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  findAll() {
    return this.tenantDb.withBypass((manager) =>
      manager.getRepository(Module).find({
        where: { isActive: true },
        order: { name: 'ASC' },
      }),
    );
  }

  findAllIncludingInactive() {
    return this.tenantDb.withBypass((manager) =>
      manager.getRepository(Module).find({
        order: { name: 'ASC' },
      }),
    );
  }

  findByCode(code: string) {
    return this.tenantDb.withBypass((manager) =>
      manager.getRepository(Module).findOne({
        where: { code: code as never },
      }),
    );
  }
}
