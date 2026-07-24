import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModuleAccessSystem1753300000000 implements MigrationInterface {
  name = 'ModuleAccessSystem1753300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // New enum types
    await queryRunner.query(`
      CREATE TYPE "travel_module_enum" AS ENUM (
        'FLIGHTS', 'HOTELS', 'PACKAGES', 'VISA',
        'TRANSFERS', 'INSURANCE', 'CRUISES'
      );
      CREATE TYPE "module_source_enum" AS ENUM ('PLAN', 'ADDON');
      CREATE TYPE "tenant_module_status_enum" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');
      CREATE TYPE "addon_billing_cycle_enum" AS ENUM ('MONTHLY', 'YEARLY');
      CREATE TYPE "addon_status_enum" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');
    `);

    // Add pricing columns to plans
    await queryRunner.query(`
      ALTER TABLE "plans"
        ADD COLUMN "price_monthly" int,
        ADD COLUMN "price_yearly" int;
    `);

    // Modules registry
    await queryRunner.query(`
      CREATE TABLE "modules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" "travel_module_enum" NOT NULL UNIQUE,
        "name" varchar NOT NULL,
        "description" text,
        "icon" varchar,
        "category" varchar NOT NULL DEFAULT 'travel',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // Plan-Module junction
    await queryRunner.query(`
      CREATE TABLE "plan_modules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
        "module_code" "travel_module_enum" NOT NULL,
        "limits" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE ("plan_id", "module_code")
      );
      CREATE INDEX "IDX_plan_modules_plan_id" ON "plan_modules" ("plan_id");
    `);

    // Tenant Module access
    await queryRunner.query(`
      CREATE TABLE "tenant_modules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "module_code" "travel_module_enum" NOT NULL,
        "source" "module_source_enum" NOT NULL,
        "status" "tenant_module_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "expires_at" TIMESTAMPTZ,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE ("tenant_id", "module_code")
      );
      CREATE INDEX "IDX_tenant_modules_tenant_id" ON "tenant_modules" ("tenant_id");
    `);

    // Addons catalog
    await queryRunner.query(`
      CREATE TABLE "addons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "module_code" "travel_module_enum" NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "price_monthly" int NOT NULL,
        "price_yearly" int,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // Tenant Addon subscriptions
    await queryRunner.query(`
      CREATE TABLE "tenant_addons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "addon_id" uuid NOT NULL REFERENCES "addons"("id") ON DELETE CASCADE,
        "status" "addon_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "billing_cycle" "addon_billing_cycle_enum" NOT NULL,
        "starts_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE ("tenant_id", "addon_id")
      );
      CREATE INDEX "IDX_tenant_addons_tenant_id" ON "tenant_addons" ("tenant_id");
    `);

    // RLS on tenant-scoped tables
    await queryRunner.query(`
      ALTER TABLE "tenant_modules" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "tenant_addons" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "plan_modules" ENABLE ROW LEVEL SECURITY;

      CREATE POLICY tenant_modules_isolation ON "tenant_modules"
        USING (app_bypass_rls() OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_bypass_rls() OR tenant_id = app_current_tenant_id());

      CREATE POLICY tenant_addons_isolation ON "tenant_addons"
        USING (app_bypass_rls() OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_bypass_rls() OR tenant_id = app_current_tenant_id());

      CREATE POLICY plan_modules_isolation ON "plan_modules"
        USING (app_bypass_rls());

      ALTER TABLE "tenant_modules" FORCE ROW LEVEL SECURITY;
      ALTER TABLE "tenant_addons" FORCE ROW LEVEL SECURITY;
      ALTER TABLE "plan_modules" FORCE ROW LEVEL SECURITY;
    `);

    // Seed modules
    await queryRunner.query(`
      INSERT INTO "modules" ("code", "name", "description", "category") VALUES
        ('FLIGHTS',   'Flights',   'Search, book, and manage flight itineraries', 'travel'),
        ('HOTELS',    'Hotels',    'Search, book, and manage hotel reservations', 'travel'),
        ('PACKAGES',  'Packages',  'Bundled travel packages (flight + hotel + activities)', 'travel'),
        ('VISA',      'Visa',      'Visa application processing and tracking', 'operations'),
        ('TRANSFERS', 'Transfers', 'Airport and ground transfer bookings', 'travel'),
        ('INSURANCE', 'Insurance', 'Travel insurance policy management', 'finance'),
        ('CRUISES',   'Crui ses',   'Cruise booking and itinerary management', 'travel');
    `);

    // Seed plans with pricing
    await queryRunner.query(`
      UPDATE "plans" SET
        "price_monthly" = 49900,
        "price_yearly" = 479000
      WHERE "code" = 'starter';

      UPDATE "plans" SET
        "price_monthly" = 149900,
        "price_yearly" = 1439000
      WHERE "code" = 'growth';
    `);

    // Seed plan_modules: starter gets Flights + Hotels
    await queryRunner.query(`
      INSERT INTO "plan_modules" ("plan_id", "module_code", "limits")
      SELECT p.id, 'FLIGHTS', '{"maxSearchesPerDay": 500, "maxBookingsPerMonth": 100}'
      FROM "plans" p WHERE p."code" = 'starter';

      INSERT INTO "plan_modules" ("plan_id", "module_code", "limits")
      SELECT p.id, 'HOTELS', '{"maxSearchesPerDay": 500, "maxBookingsPerMonth": 100}'
      FROM "plans" p WHERE p."code" = 'starter';
    `);

    // Seed plan_modules: growth gets all 7 modules
    await queryRunner.query(`
      INSERT INTO "plan_modules" ("plan_id", "module_code", "limits")
      SELECT p.id, m."code", NULL
      FROM "plans" p, "modules" m
      WHERE p."code" = 'growth';
    `);

    // Seed addons
    await queryRunner.query(`
      INSERT INTO "addons" ("module_code", "name", "description", "price_monthly", "price_yearly") VALUES
        ('PACKAGES',  'Packages Addon',  'Add bundled travel packages to your plan', 29900, 287000),
        ('VISA',      'Visa Addon',      'Add visa processing capabilities', 19900, 191000),
        ('TRANSFERS', 'Transfers Addon', 'Add airport and ground transfers', 14900, 143000),
        ('INSURANCE', 'Insurance Addon', 'Add travel insurance management', 24900, 239000),
        ('CRUISES',   'Crui ses Addon',   'Add cruise booking capabilities', 34900, 335000);
    `);

    // Sync tenant_modules for existing tenants from their plans
    await queryRunner.query(`
      INSERT INTO "tenant_modules" ("tenant_id", "module_code", "source", "status")
      SELECT t."id", pm."module_code", 'PLAN', 'ACTIVE'
      FROM "tenants" t
      JOIN "plan_modules" pm ON pm."plan_id" = t."plan_id"
      WHERE t."status" = 'ACTIVE';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS tenant_modules_isolation ON "tenant_modules";
      DROP POLICY IF EXISTS tenant_addons_isolation ON "tenant_addons";
      DROP POLICY IF EXISTS plan_modules_isolation ON "plan_modules";
      DROP FUNCTION IF EXISTS app_current_tenant_id();
      DROP FUNCTION IF EXISTS app_bypass_rls();
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "tenant_addons";
      DROP TABLE IF EXISTS "tenant_modules";
      DROP TABLE IF EXISTS "plan_modules";
      DROP TABLE IF EXISTS "addons";
      DROP TABLE IF EXISTS "modules";
    `);

    await queryRunner.query(`
      ALTER TABLE "plans" DROP COLUMN IF EXISTS "price_monthly";
      ALTER TABLE "plans" DROP COLUMN IF EXISTS "price_yearly";
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "addon_status_enum";
      DROP TYPE IF EXISTS "addon_billing_cycle_enum";
      DROP TYPE IF EXISTS "tenant_module_status_enum";
      DROP TYPE IF EXISTS "module_source_enum";
      DROP TYPE IF EXISTS "travel_module_enum";
    `);

    // Re-create RLS functions that were dropped
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean AS $$
        SELECT coalesce(nullif(current_setting('app.bypass_rls', true), ''), 'false') = 'true';
      $$ LANGUAGE sql STABLE;

      CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS uuid AS $$
        SELECT nullif(current_setting('app.current_tenant_id', true), '')::uuid;
      $$ LANGUAGE sql STABLE;
    `);
  }
}
