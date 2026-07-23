import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditActorType } from '../../common/enums';
import { getTenantStore } from '../../common/tenant-context';
import { TenantConnectionService } from '../../database/tenant-connection.service';

@Injectable()
export class AuditService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async log(input: {
    action: string;
    actorType: AuditActorType;
    actorId?: string | null;
    tenantId?: string | null;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const store = getTenantStore();
    const tenantId = input.tenantId ?? store.tenantId ?? null;

    const persist = async (manager: EntityManager) => {
      const repo = manager.getRepository(AuditLog);
      await repo.save(
        repo.create({
          action: input.action,
          actorType: input.actorType,
          actorId: input.actorId ?? null,
          tenantId,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          metadata: input.metadata ?? null,
        }),
      );
    };

    // Reuse current ALS RLS mode when already inside withBypass/withTenant.
    if (store.bypassRls || store.tenantId) {
      await this.tenantDb.transaction(persist);
      return;
    }
    if (tenantId) {
      await this.tenantDb.withTenant(tenantId, persist);
      return;
    }
    await this.tenantDb.withBypass(persist);
  }

  list(limit = 50) {
    return this.tenantDb.withBypass((manager) =>
      manager.getRepository(AuditLog).find({
        order: { createdAt: 'DESC' },
        take: limit,
      }),
    );
  }

  listForTenant(tenantId: string, limit = 50) {
    return this.tenantDb.withTenant(tenantId, (manager) =>
      manager.getRepository(AuditLog).find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        take: limit,
      }),
    );
  }
}
