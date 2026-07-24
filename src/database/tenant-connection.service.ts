import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  getTenantStore,
  tenantAls,
  TenantStore,
} from '../common/tenant-context';

@Injectable()
export class TenantConnectionService {
  constructor(private readonly dataSource: DataSource) {}

  /** Apply RLS session vars inside an existing transaction/manager. */
  async applyRlsSettings(
    manager: EntityManager = this.dataSource.manager,
    store: TenantStore = getTenantStore(),
  ): Promise<void> {
    if (store.bypassRls) {
      await manager.query(`SELECT set_config('app.bypass_rls', 'true', true)`);
      await manager.query(
        `SELECT set_config('app.current_tenant_id', '', true)`,
      );
      return;
    }
    await manager.query(`SELECT set_config('app.bypass_rls', 'false', true)`);
    await manager.query(
      `SELECT set_config('app.current_tenant_id', $1, true)`,
      [store.tenantId ?? ''],
    );
  }

  async transaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await this.applyRlsSettings(manager);
      return work(manager);
    });
  }

  async withBypass<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const store: TenantStore = { tenantId: null, bypassRls: true };
    return tenantAls.run(store, () =>
      this.dataSource.transaction(async (manager) => {
        await this.applyRlsSettings(manager, store);
        return work(manager);
      }),
    );
  }

  async withTenant<T>(
    tenantId: string,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const store: TenantStore = { tenantId, bypassRls: false };
    return tenantAls.run(store, () =>
      this.dataSource.transaction(async (manager) => {
        await this.applyRlsSettings(manager, store);
        return work(manager);
      }),
    );
  }
}
