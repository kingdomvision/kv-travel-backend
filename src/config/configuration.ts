import { registerAs } from '@nestjs/config';

function requireSecret(name: string, value: string | undefined, allowDevDefault: string): string {
  const trimmed = value?.trim() ?? '';
  if (process.env.NODE_ENV === 'production') {
    if (trimmed.length < 32) {
      throw new Error(
        `${name} must be set to a strong secret (min 32 chars) when NODE_ENV=production`,
      );
    }
    return trimmed;
  }
  return trimmed.length > 0 ? trimmed : allowDevDefault;
}

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:4200,http://localhost:4201')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: requireSecret(
      'JWT_ACCESS_SECRET',
      process.env.JWT_ACCESS_SECRET,
      'dev-only-access-secret-change-me-32b',
    ),
    refreshSecret: requireSecret(
      'JWT_REFRESH_SECRET',
      process.env.JWT_REFRESH_SECRET,
      'dev-only-refresh-secret-change-me-32',
    ),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  cookie: {
    refreshName: process.env.REFRESH_COOKIE_NAME ?? 'kv_refresh',
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax',
  },
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  storage: {
    provider: process.env.STORAGE_PROVIDER ?? 'minio',
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'kv-travel',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  uploads: {
    maxBytes: parseInt(process.env.UPLOAD_MAX_BYTES ?? String(10 * 1024 * 1024), 10),
    allowedContentTypes: (
      process.env.UPLOAD_ALLOWED_CONTENT_TYPES ??
      'application/pdf,image/jpeg,image/png,image/webp,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  },
  seed: {
    platformEmail: process.env.SEED_PLATFORM_EMAIL,
    platformPassword: process.env.SEED_PLATFORM_PASSWORD,
    tenantEmail: process.env.SEED_TENANT_EMAIL,
    tenantPassword: process.env.SEED_TENANT_PASSWORD,
  },
}));
