/**
 * Tests d'intégration - Sprint 3.3 & 3.4
 *
 * Ce fichier teste l'intégration complète entre:
 * - RLSGenerator + RLSValidator (Sprint 3.3)
 * - MigrationGenerator + SandboxExecutor (Sprint 3.4)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRLSGenerator } from './generators/RLSGenerator';
import { createRLSValidator } from './validators/RLSValidator';
import { createMigrationGenerator } from './generators/MigrationGenerator';
import { createSandboxExecutor } from './SandboxExecutor';
import type { Schema, Table, Column, Migration } from './types';

describe('RLS Integration', () => {
  const createTestTable = (overrides?: Partial<Table>): Table => ({
    name: 'posts',
    schema: 'public',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isForeignKey: false, isUnique: true, defaultValue: 'gen_random_uuid()' },
      { name: 'user_id', type: 'uuid', nullable: false, isPrimaryKey: false, isForeignKey: true, isUnique: false, references: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      { name: 'title', type: 'text', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
      { name: 'created_at', type: 'timestamptz', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false, defaultValue: 'now()' },
    ],
    indexes: [],
    constraints: [],
    ...overrides,
  });

  const createTestSchema = (tables: Table[] = [createTestTable()]): Schema => ({
    tables,
    rls: [],
    functions: [],
    triggers: [],
    indexes: [],
    enums: [],
  });

  describe('RLSGenerator -> RLSValidator', () => {
    it('should generate valid ownerOnly policies', () => {
      const generator = createRLSGenerator();
      const validator = createRLSValidator();
      const schema = createTestSchema();

      // Générer les politiques
      const generationResult = generator.generate(schema);
      expect(generationResult.policies.length).toBe(4); // SELECT, INSERT, UPDATE, DELETE

      // Valider les politiques générées
      const validationResult = validator.validate(generationResult.policies);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.securityScore).toBeGreaterThanOrEqual(80);
    });

    it('should generate valid publicReadOwnerWrite policies', () => {
      const generator = createRLSGenerator();
      const validator = createRLSValidator();

      const tableWithPublished = createTestTable({
        name: 'articles',
        columns: [
          ...createTestTable().columns,
          { name: 'published', type: 'bool', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
        ],
      });

      const schema = createTestSchema([tableWithPublished]);
      const generationResult = generator.generate(schema);

      // Valider les politiques
      const validationResult = validator.validate(generationResult.policies);
      expect(validationResult.isValid).toBe(true);

      // Vérifier que SELECT est public
      const selectPolicy = generationResult.policies.find(p => p.action === 'SELECT');
      expect(selectPolicy?.roles).toContain('anon');
    });

    it('should generate valid teamBased policies', () => {
      const generator = createRLSGenerator();
      const validator = createRLSValidator();

      const teamTable = createTestTable({
        name: 'team_documents',
        columns: [
          ...createTestTable().columns,
          { name: 'team_id', type: 'uuid', nullable: false, isPrimaryKey: false, isForeignKey: true, isUnique: false, references: { table: 'teams', column: 'id' } },
        ],
      });

      const schema = createTestSchema([teamTable]);
      const generationResult = generator.generate(schema);

      // Vérifier que les politiques utilisent team_id
      const policies = generationResult.policies;
      expect(policies.some(p => p.using?.includes('team_id'))).toBe(true);

      // Valider les politiques
      const validationResult = validator.validate(policies);
      expect(validationResult.isValid).toBe(true);
    });

    it('should generate valid SQL that can be validated', () => {
      const generator = createRLSGenerator();
      const schema = createTestSchema();

      const result = generator.generate(schema);

      // Vérifier le SQL généré
      expect(result.sql).toContain('ENABLE ROW LEVEL SECURITY');
      expect(result.sql).toContain('FORCE ROW LEVEL SECURITY');
      expect(result.sql).toContain('CREATE POLICY');
      expect(result.sql).toContain('auth.uid()');
    });

    it('should detect and warn about public pattern', () => {
      const generator = createRLSGenerator();
      const validator = createRLSValidator();

      const schema = createTestSchema();
      const result = generator.generate(schema, [
        { table: 'posts', pattern: 'public' },
      ]);

      // Le générateur doit avertir
      expect(result.warnings.some(w => w.includes('public'))).toBe(true);

      // Le validateur doit détecter les politiques trop permissives
      const validation = validator.validate(result.policies);
      expect(validation.policyAnalysis.some(a => a.securityLevel !== 'high')).toBe(true);
    });

    it('should generate adminOnly policies with proper JWT check', () => {
      const generator = createRLSGenerator();
      const validator = createRLSValidator();

      const schema = createTestSchema();
      const result = generator.generate(schema, [
        { table: 'posts', pattern: 'adminOnly' },
      ]);

      // Vérifier que les politiques utilisent auth.jwt()
      expect(result.policies.some(p => p.using?.includes('auth.jwt()'))).toBe(true);

      // Valider les politiques
      const validation = validator.validate(result.policies);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Multi-table schema', () => {
    it('should handle multiple tables with different patterns', () => {
      const generator = createRLSGenerator();
      const validator = createRLSValidator();

      const usersTable: Table = {
        name: 'users',
        schema: 'public',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isForeignKey: false, isUnique: true },
          { name: 'email', type: 'text', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: true },
        ],
        indexes: [],
        constraints: [],
      };

      const postsTable = createTestTable();

      const categoriesTable: Table = {
        name: 'categories',
        schema: 'public',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isForeignKey: false, isUnique: true },
          { name: 'name', type: 'text', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: true },
        ],
        indexes: [],
        constraints: [],
      };

      const schema = createTestSchema([usersTable, postsTable, categoriesTable]);
      const result = generator.generate(schema);

      // Toutes les tables doivent avoir des politiques
      const tableNames = new Set(result.policies.map(p => p.table));
      expect(tableNames.size).toBe(3);

      // Valider toutes les politiques
      const validation = validator.validate(result.policies);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Security validation', () => {
    it('should reject policies with SQL injection patterns', () => {
      const validator = createRLSValidator();

      const maliciousPolicies = [
        {
          name: 'malicious_policy',
          table: 'test',
          action: 'SELECT' as const,
          roles: ['authenticated'],
          using: 'id = 1; DROP TABLE users;',
          permissive: true,
        },
      ];

      const validation = validator.validate(maliciousPolicies);
      expect(validation.isValid).toBe(false);
      expect(validation.policyAnalysis[0].securityLevel).toBe('critical');
    });

    it('should calculate accurate security scores', () => {
      const generator = createRLSGenerator();
      const validator = createRLSValidator();

      // Générer des politiques sécurisées
      const schema = createTestSchema();
      const result = generator.generate(schema);
      const validation = validator.validate(result.policies);

      // Score élevé pour des politiques ownerOnly avec auth.uid()
      expect(validation.securityScore).toBeGreaterThanOrEqual(80);
    });
  });
});

// =============================================================================
// Sprint 3.4 Integration Tests: MigrationGenerator + SandboxExecutor
// =============================================================================

describe('Migration Integration', () => {
  let sandboxExecutor: ReturnType<typeof createSandboxExecutor>;

  beforeEach(() => {
    sandboxExecutor = createSandboxExecutor({ cleanupDelay: 100 });
  });

  afterEach(async () => {
    await sandboxExecutor.cleanupAll();
  });

  const createColumn = (overrides?: Partial<Column>): Column => ({
    name: 'id',
    type: 'uuid',
    nullable: false,
    isPrimaryKey: true,
    isForeignKey: false,
    isUnique: true,
    defaultValue: 'gen_random_uuid()',
    ...overrides,
  });

  const createTable = (name: string, columns: Partial<Column>[] = []): Table => ({
    name,
    schema: 'public',
    columns: [
      createColumn(),
      createColumn({ name: 'created_at', type: 'timestamptz', isPrimaryKey: false, isUnique: false, defaultValue: 'now()' }),
      ...columns.map(c => createColumn(c)),
    ],
    indexes: [],
    constraints: [],
  });

  const createSchema = (tables: Table[] = []): Schema => ({
    tables,
    rls: [],
    functions: [],
    triggers: [],
    indexes: [],
    enums: [],
  });

  describe('MigrationGenerator -> SandboxExecutor', () => {
    it('should generate and test valid CREATE TABLE migration', async () => {
      const generator = createMigrationGenerator();

      const currentSchema = createSchema([]);
      const targetSchema = createSchema([
        createTable('users', [
          { name: 'email', type: 'text', isPrimaryKey: false, isForeignKey: false, isUnique: true, nullable: false },
          { name: 'name', type: 'text', isPrimaryKey: false, isForeignKey: false, isUnique: false, nullable: true },
        ]),
      ]);

      // Generate migration
      const result = generator.generate(currentSchema, targetSchema);
      expect(result.migration.up).toContain('CREATE TABLE');
      expect(result.migration.up).toContain('users');
      expect(result.isDestructive).toBe(false);

      // Test migration in sandbox
      const testResult = await sandboxExecutor.testMigration(result.migration);
      expect(testResult.success).toBe(true);
    });

    it('should generate and test valid ADD COLUMN migration', async () => {
      const generator = createMigrationGenerator();

      const currentSchema = createSchema([createTable('posts')]);
      const targetSchema = createSchema([
        createTable('posts', [
          { name: 'title', type: 'text', isPrimaryKey: false, isForeignKey: false, isUnique: false, nullable: false },
          { name: 'content', type: 'text', isPrimaryKey: false, isForeignKey: false, isUnique: false, nullable: true },
        ]),
      ]);

      const result = generator.generate(currentSchema, targetSchema);
      expect(result.migration.up).toContain('ADD COLUMN');
      expect(result.migration.up).toContain('title');

      const testResult = await sandboxExecutor.testMigration(result.migration);
      expect(testResult.success).toBe(true);
    });

    it('should detect destructive migrations', async () => {
      const generator = createMigrationGenerator();

      const currentSchema = createSchema([createTable('old_table')]);
      const targetSchema = createSchema([]);

      const result = generator.generate(currentSchema, targetSchema);
      expect(result.isDestructive).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.migration.up).toContain('DROP TABLE');
    });

    it('should generate valid rollback SQL', async () => {
      const generator = createMigrationGenerator();

      const currentSchema = createSchema([]);
      const targetSchema = createSchema([createTable('new_table')]);

      const result = generator.generate(currentSchema, targetSchema);

      // DOWN should drop the table
      expect(result.migration.down).toContain('DROP TABLE');
      expect(result.migration.down).toContain('new_table');

      // Validate rollback
      const rollbackValidation = generator.validateRollback(result.migration);
      expect(rollbackValidation.isValid).toBe(true);
    });

    it('should test migration with regression queries', async () => {
      const generator = createMigrationGenerator();

      const currentSchema = createSchema([]);
      const targetSchema = createSchema([createTable('products')]);

      const result = generator.generate(currentSchema, targetSchema);

      const regressionResult = await sandboxExecutor.testRegression(result.migration, [
        { name: 'Select products', sql: 'SELECT 1;', critical: true },
        { name: 'Check schema', sql: 'SELECT current_schema();', critical: false },
      ]);

      expect(regressionResult.migrationFailed).toBe(false);
    });

    it('should fail sandbox test for dangerous SQL', async () => {
      const dangerousMigration: Migration = {
        id: 'test_dangerous',
        name: 'dangerous_migration',
        timestamp: Date.now(),
        up: 'DROP DATABASE production;',
        down: '',
        checksum: 'abc123',
      };

      const testResult = await sandboxExecutor.testMigration(dangerousMigration);
      expect(testResult.success).toBe(false);
      expect(testResult.phase).toBe('up');
    });
  });

  describe('End-to-end migration workflow', () => {
    it('should handle complete schema evolution', async () => {
      const generator = createMigrationGenerator();

      // Step 1: Empty -> Users table
      const schema1 = createSchema([]);
      const schema2 = createSchema([
        createTable('users', [
          { name: 'email', type: 'text', isPrimaryKey: false, isForeignKey: false, isUnique: true, nullable: false },
        ]),
      ]);

      const migration1 = generator.generate(schema1, schema2, 'create_users');
      expect(migration1.affectedTables).toContain('users');

      const test1 = await sandboxExecutor.testMigration(migration1.migration);
      expect(test1.success).toBe(true);

      // Step 2: Add posts table with foreign key
      const schema3 = createSchema([
        ...schema2.tables,
        {
          name: 'posts',
          schema: 'public',
          columns: [
            createColumn(),
            createColumn({
              name: 'user_id',
              type: 'uuid',
              isPrimaryKey: false,
              isForeignKey: true,
              isUnique: false,
              references: { table: 'users', column: 'id', onDelete: 'CASCADE' },
            }),
            createColumn({ name: 'title', type: 'text', isPrimaryKey: false, isForeignKey: false, isUnique: false, nullable: false }),
          ],
          indexes: [],
          constraints: [],
        },
      ]);

      const migration2 = generator.generate(schema2, schema3, 'create_posts');
      expect(migration2.affectedTables).toContain('posts');
      expect(migration2.migration.up).toContain('user_id');

      const test2 = await sandboxExecutor.testMigration(migration2.migration);
      expect(test2.success).toBe(true);
    });

    it('should generate checksum for migration integrity', () => {
      const generator = createMigrationGenerator();

      const schema1 = createSchema([]);
      const schema2 = createSchema([createTable('test')]);

      const result = generator.generate(schema1, schema2);

      // Checksum should be non-empty
      expect(result.migration.checksum).toBeTruthy();
      expect(result.migration.checksum.length).toBeGreaterThan(8);
    });
  });

  describe('RLS + Migration integration', () => {
    it('should generate migration with RLS policies', async () => {
      const migrationGenerator = createMigrationGenerator();
      const rlsGenerator = createRLSGenerator();

      // Create schema with RLS
      const tableWithUserColumn = createTable('documents', [
        {
          name: 'user_id',
          type: 'uuid',
          isPrimaryKey: false,
          isForeignKey: true,
          isUnique: false,
          nullable: false,
          references: { table: 'users', column: 'id' },
        },
      ]);

      const currentSchema = createSchema([]);
      const targetSchema = createSchema([tableWithUserColumn]);

      // Generate migration
      const migrationResult = migrationGenerator.generate(currentSchema, targetSchema);
      expect(migrationResult.migration.up).toContain('ENABLE ROW LEVEL SECURITY');

      // Generate RLS policies
      const rlsResult = rlsGenerator.generate(targetSchema);
      expect(rlsResult.policies.length).toBeGreaterThan(0);
      expect(rlsResult.policies[0].using).toContain('auth.uid()');

      // Test migration
      const testResult = await sandboxExecutor.testMigration(migrationResult.migration);
      expect(testResult.success).toBe(true);
    });
  });
});
