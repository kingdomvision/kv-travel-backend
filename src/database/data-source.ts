import { DataSource, DataSourceOptions } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { Plan } from '../modules/tenancy/entities/plan.entity';
import { Tenant } from '../modules/tenancy/entities/tenant.entity';
import { TenantUser } from '../modules/tenancy/entities/tenant-user.entity';
import { PlatformUser } from '../modules/identity/entities/platform-user.entity';
import { RefreshToken } from '../modules/identity/entities/refresh-token.entity';
import { AuditLog } from '../modules/identity/entities/audit-log.entity';
import { DocumentEntity } from '../modules/documents/entities/document.entity';

loadEnv();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    Plan,
    Tenant,
    TenantUser,
    PlatformUser,
    RefreshToken,
    AuditLog,
    DocumentEntity,
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
