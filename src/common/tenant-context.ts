import { AsyncLocalStorage } from 'async_hooks';

export type TenantStore = {
  tenantId: string | null;
  bypassRls: boolean;
};

export const tenantAls = new AsyncLocalStorage<TenantStore>();

export function getTenantStore(): TenantStore {
  return tenantAls.getStore() ?? { tenantId: null, bypassRls: false };
}
