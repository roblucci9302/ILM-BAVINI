/**
 * Tests d'intégration - RLSGenerator + RLSValidator
 *
 * Ce fichier teste l'intégration complète entre le générateur
 * et le validateur de politiques RLS.
 */

import { describe, it, expect } from 'vitest';
import { createRLSGenerator } from './generators/RLSGenerator';
import { createRLSValidator } from './validators/RLSValidator';
import type { Schema, Table } from './types';

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
