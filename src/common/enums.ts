export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

export enum PlatformRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OPS = 'OPS',
  SUPPORT = 'SUPPORT',
}

export enum TenantRole {
  TENANT_ADMIN = 'TENANT_ADMIN',
  AGENT = 'AGENT',
  FINANCE = 'FINANCE',
}

export enum DocumentStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export enum AuditActorType {
  PLATFORM_USER = 'PLATFORM_USER',
  TENANT_USER = 'TENANT_USER',
  SYSTEM = 'SYSTEM',
}

export enum TokenAudience {
  PLATFORM = 'platform',
  TENANT = 'tenant',
}
