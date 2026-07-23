import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { getTenantStore } from '../common/tenant-context';

/**
 * Stamps tenant_id from ALS when missing on tenant-scoped entities.
 * RLS policies remain the DB-level isolation boundary.
 */
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<Record<string, unknown>>): void {
    this.applyTenantId(event.entity);
  }

  beforeUpdate(event: UpdateEvent<Record<string, unknown>>): void {
    this.applyTenantId(event.entity as Record<string, unknown> | undefined);
  }

  private applyTenantId(entity?: Record<string, unknown>): void {
    if (!entity || !('tenantId' in entity)) {
      return;
    }
    const store = getTenantStore();
    if (store.bypassRls || !store.tenantId) {
      return;
    }
    if (!entity.tenantId) {
      entity.tenantId = store.tenantId;
    }
  }
}

// Keep import used for TypeORM subscriber discovery side-effects in some setups
void DataSource;
