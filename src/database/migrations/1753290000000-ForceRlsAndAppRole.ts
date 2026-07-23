import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FORCE ROW LEVEL SECURITY so table owners cannot bypass policies.
 * Auth/seed/platform paths must set app.bypass_rls=true inside a transaction.
 */
export class ForceRlsAndAppRole1753290000000 implements MigrationInterface {
  name = 'ForceRlsAndAppRole1753290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_users" FORCE ROW LEVEL SECURITY;
      ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
      ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_users" NO FORCE ROW LEVEL SECURITY;
      ALTER TABLE "documents" NO FORCE ROW LEVEL SECURITY;
      ALTER TABLE "audit_logs" NO FORCE ROW LEVEL SECURITY;
    `);
  }
}
