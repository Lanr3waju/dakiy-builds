import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

/**
 * Helper class for PgLiteral values
 */
export class PgLiteral {
  value: string;
  
  constructor(value: string) {
    this.value = value;
  }
  
  toString(): string {
    return this.value;
  }
}

/**
 * Common column definitions for reuse across migrations
 */
export const commonColumns = {
  id: {
    type: 'uuid',
    primaryKey: true,
    default: new PgLiteral('gen_random_uuid()'),
  },
  createdAt: {
    type: 'timestamp',
    notNull: true,
    default: new PgLiteral('CURRENT_TIMESTAMP'),
  },
  updatedAt: {
    type: 'timestamp',
    notNull: true,
    default: new PgLiteral('CURRENT_TIMESTAMP'),
  },
};

/**
 * Adds standard timestamp columns (created_at, updated_at) to a table
 * and creates a trigger to automatically update updated_at
 */
export function addTimestamps(pgm: MigrationBuilder, tableName: string): void {
  pgm.addColumns(tableName, {
    created_at: {
      type: 'timestamp',
      notNull: true,
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
    },
  });

  // Set default values using SQL
  pgm.sql(`
    ALTER TABLE ${tableName} 
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP
  `);

  // Create trigger to auto-update updated_at
  pgm.sql(`
    CREATE TRIGGER update_${tableName}_updated_at
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);
}

/**
 * Removes timestamp columns and trigger from a table
 */
export function removeTimestamps(pgm: MigrationBuilder, tableName: string): void {
  pgm.sql(`DROP TRIGGER IF EXISTS update_${tableName}_updated_at ON ${tableName}`);
  pgm.dropColumns(tableName, ['created_at', 'updated_at']);
}

/**
 * Creates a standard ID column (UUID with auto-generation)
 */
export function createIdColumn(): ColumnDefinitions {
  return {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
  };
}

/**
 * Creates a foreign key column with standard naming
 */
export function createForeignKey(
  referencedTable: string,
  options: {
    nullable?: boolean;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  } = {}
): ColumnDefinitions {
  const columnName = `${referencedTable}_id`;
  return {
    [columnName]: {
      type: 'uuid',
      notNull: !options.nullable,
      references: referencedTable,
      onDelete: options.onDelete || 'CASCADE',
      onUpdate: options.onUpdate || 'CASCADE',
    },
  };
}

/**
 * Creates an enum type in PostgreSQL
 */
export function createEnum(
  pgm: MigrationBuilder,
  enumName: string,
  values: string[]
): void {
  pgm.createType(enumName, values);
}

/**
 * Drops an enum type from PostgreSQL
 */
export function dropEnum(pgm: MigrationBuilder, enumName: string): void {
  pgm.dropType(enumName);
}

/**
 * Adds a standard index on a column
 */
export function addIndex(
  pgm: MigrationBuilder,
  tableName: string,
  columnName: string | string[],
  options: { unique?: boolean; name?: string } = {}
): void {
  const columns = Array.isArray(columnName) ? columnName : [columnName];
  const indexName = options.name || `idx_${tableName}_${columns.join('_')}`;
  
  pgm.createIndex(tableName, columns, {
    name: indexName,
    unique: options.unique,
  });
}

/**
 * Creates a junction table for many-to-many relationships
 */
export function createJunctionTable(
  pgm: MigrationBuilder,
  table1: string,
  table2: string,
  additionalColumns: ColumnDefinitions = {}
): void {
  const tableName = `${table1}_${table2}`;
  
  pgm.createTable(tableName, {
    ...createIdColumn(),
    ...createForeignKey(table1),
    ...createForeignKey(table2),
    ...additionalColumns,
  });

  // Add composite unique constraint
  pgm.sql(`
    ALTER TABLE ${tableName}
    ADD CONSTRAINT ${tableName}_unique UNIQUE (${table1}_id, ${table2}_id)
  `);

  // Add indexes for foreign keys
  addIndex(pgm, tableName, `${table1}_id`);
  addIndex(pgm, tableName, `${table2}_id`);
}
