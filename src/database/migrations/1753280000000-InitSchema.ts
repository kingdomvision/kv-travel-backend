import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1753280000000 implements MigrationInterface {
  name = 'InitSchema1753280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TYPE "tenant_status_enum" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');
      CREATE TYPE "platform_role_enum" AS ENUM ('SUPER_ADMIN', 'OPS', 'SUPPORT');
      CREATE TYPE "tenant_role_enum" AS ENUM ('TENANT_ADMIN', 'AGENT', 'FINANCE');
      CREATE TYPE "document_status_enum" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');
      CREATE TYPE "audit_actor_type_enum" AS ENUM ('PLATFORM_USER', 'TENANT_USER', 'SYSTEM');
    `);

    await queryRunner.query(`
      CREATE TABLE "plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar NOT NULL UNIQUE,
        "name" varchar NOT NULL,
        "description" text,
        "max_users" int NOT NULL DEFAULT 10,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      );

      CREATE TABLE "tenants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" varchar NOT NULL UNIQUE,
        "name" varchar NOT NULL,
        "status" "tenant_status_enum" NOT NULL DEFAULT 'PENDING',
        "plan_id" uuid REFERENCES "plans"("id"),
        "legal_name" varchar,
        "country_code" char(2),
        "timezone" varchar NOT NULL DEFAULT 'UTC',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      );

      CREATE TABLE "platform_users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL UNIQUE,
        "password_hash" varchar NOT NULL,
        "full_name" varchar NOT NULL,
        "role" "platform_role_enum" NOT NULL DEFAULT 'OPS',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      );

      CREATE TABLE "tenant_users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "email" varchar NOT NULL,
        "password_hash" varchar NOT NULL,
        "full_name" varchar NOT NULL,
        "role" "tenant_role_enum" NOT NULL DEFAULT 'AGENT',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE ("tenant_id", "email")
      );
      CREATE INDEX "IDX_tenant_users_tenant_id" ON "tenant_users" ("tenant_id");

      CREATE TABLE "documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "uploaded_by_id" uuid,
        "file_name" varchar NOT NULL,
        "content_type" varchar NOT NULL,
        "size_bytes" int NOT NULL,
        "storage_key" varchar NOT NULL,
        "status" "document_status_enum" NOT NULL DEFAULT 'UPLOADED',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_documents_tenant_id" ON "documents" ("tenant_id");

      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL,
        "actor_type" "audit_actor_type_enum" NOT NULL,
        "actor_id" uuid,
        "action" varchar NOT NULL,
        "entity_type" varchar,
        "entity_id" varchar,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_audit_logs_tenant_id" ON "audit_logs" ("tenant_id");
      CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at");

      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "subject" varchar NOT NULL,
        "audience" varchar NOT NULL,
        "token_hash" varchar NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "revoked_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_refresh_tokens_subject" ON "refresh_tokens" ("subject");
    `);

    // Row Level Security — defense in depth; app layer also filters by tenant_id
    await queryRunner.query(`
      ALTER TABLE "tenant_users" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

      CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean AS $$
        SELECT coalesce(nullif(current_setting('app.bypass_rls', true), ''), 'false') = 'true';
      $$ LANGUAGE sql STABLE;

      CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS uuid AS $$
        SELECT nullif(current_setting('app.current_tenant_id', true), '')::uuid;
      $$ LANGUAGE sql STABLE;

      CREATE POLICY tenant_users_isolation ON "tenant_users"
        USING (app_bypass_rls() OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_bypass_rls() OR tenant_id = app_current_tenant_id());

      CREATE POLICY documents_isolation ON "documents"
        USING (app_bypass_rls() OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_bypass_rls() OR tenant_id = app_current_tenant_id());

      CREATE POLICY audit_logs_isolation ON "audit_logs"
        USING (
          app_bypass_rls()
          OR tenant_id IS NULL
          OR tenant_id = app_current_tenant_id()
        )
        WITH CHECK (
          app_bypass_rls()
          OR tenant_id IS NULL
          OR tenant_id = app_current_tenant_id()
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS audit_logs_isolation ON "audit_logs";
      DROP POLICY IF EXISTS documents_isolation ON "documents";
      DROP POLICY IF EXISTS tenant_users_isolation ON "tenant_users";
      DROP FUNCTION IF EXISTS app_current_tenant_id();
      DROP FUNCTION IF EXISTS app_bypass_rls();
      DROP TABLE IF EXISTS "refresh_tokens";
      DROP TABLE IF EXISTS "audit_logs";
      DROP TABLE IF EXISTS "documents";
      DROP TABLE IF EXISTS "tenant_users";
      DROP TABLE IF EXISTS "platform_users";
      DROP TABLE IF EXISTS "tenants";
      DROP TABLE IF EXISTS "plans";
      DROP TYPE IF EXISTS "audit_actor_type_enum";
      DROP TYPE IF EXISTS "document_status_enum";
      DROP TYPE IF EXISTS "tenant_role_enum";
      DROP TYPE IF EXISTS "platform_role_enum";
      DROP TYPE IF EXISTS "tenant_status_enum";
    `);
  }
}
