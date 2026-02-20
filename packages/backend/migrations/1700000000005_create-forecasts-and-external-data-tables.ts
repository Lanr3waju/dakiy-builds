import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands: any = undefined;

/**
 * Migration: Create forecasts and external data tables
 * 
 * This migration creates:
 * 1. risk_level enum type (low, medium, high)
 * 2. forecasts table with completion date, risk level, and explanation
 * 3. weather_data table for historical weather records
 * 4. holidays table for calendar management
 * 5. audit_logs table for system actions
 * 6. Indexes for timestamp and project lookups
 * 
 * Requirements validated: 5.2, 5.3, 5.4, 6.4, 7.3, 15.1
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create risk_level enum
  pgm.createType('risk_level', ['low', 'medium', 'high']);

  // Create forecasts table
  pgm.createTable('forecasts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    project_id: {
      type: 'uuid',
      notNull: true,
      references: 'projects',
      onDelete: 'CASCADE',
      comment: 'Project this forecast is for',
    },
    estimated_completion_date: {
      type: 'date',
      notNull: true,
      comment: 'AI-predicted completion date',
    },
    risk_level: {
      type: 'risk_level',
      notNull: true,
      comment: 'Risk assessment: low, medium, or high',
    },
    explanation: {
      type: 'text',
      notNull: true,
      comment: 'Human-readable explanation for the forecast',
    },
    confidence_score: {
      type: 'decimal(5,2)',
      notNull: false,
      comment: 'Confidence score (0-100) for the prediction',
    },
    factors_considered: {
      type: 'jsonb',
      notNull: false,
      default: '{}',
      comment: 'JSON object with factors used in forecast (weather, holidays, progress, etc.)',
    },
    generated_by: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
      comment: 'User who requested the forecast',
    },
    is_cached: {
      type: 'boolean',
      notNull: true,
      default: true,
      comment: 'Whether this forecast is cached',
    },
    cache_expires_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'When the cached forecast expires',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Add constraint to ensure confidence_score is between 0 and 100
  pgm.addConstraint('forecasts', 'check_confidence_score_range', {
    check: 'confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)',
  });

  // Create indexes for forecasts table
  pgm.createIndex('forecasts', 'project_id', {
    name: 'idx_forecasts_project_id',
  });

  pgm.createIndex('forecasts', 'created_at', {
    name: 'idx_forecasts_created_at',
  });

  pgm.createIndex('forecasts', 'cache_expires_at', {
    name: 'idx_forecasts_cache_expires_at',
  });

  // Composite index for project forecast queries with cache status
  pgm.createIndex('forecasts', ['project_id', 'is_cached', 'created_at'], {
    name: 'idx_forecasts_project_cached_created',
  });

  // Create weather_data table
  pgm.createTable('weather_data', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    location: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Location identifier (city, coordinates, etc.)',
    },
    date: {
      type: 'date',
      notNull: true,
      comment: 'Date for this weather record',
    },
    temperature_celsius: {
      type: 'decimal(5,2)',
      notNull: false,
      comment: 'Temperature in Celsius',
    },
    precipitation_mm: {
      type: 'decimal(6,2)',
      notNull: false,
      comment: 'Precipitation in millimeters',
    },
    wind_speed_kmh: {
      type: 'decimal(5,2)',
      notNull: false,
      comment: 'Wind speed in km/h',
    },
    conditions: {
      type: 'varchar(100)',
      notNull: false,
      comment: 'Weather conditions (sunny, rainy, cloudy, etc.)',
    },
    is_adverse: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether conditions are adverse for construction work',
    },
    raw_data: {
      type: 'jsonb',
      notNull: false,
      default: '{}',
      comment: 'Raw weather data from external API',
    },
    source: {
      type: 'varchar(100)',
      notNull: false,
      comment: 'Weather data source/provider',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create unique constraint to prevent duplicate weather records for same location and date
  pgm.addConstraint('weather_data', 'unique_location_date', {
    unique: ['location', 'date'],
  });

  // Create indexes for weather_data table
  pgm.createIndex('weather_data', 'location', {
    name: 'idx_weather_data_location',
  });

  pgm.createIndex('weather_data', 'date', {
    name: 'idx_weather_data_date',
  });

  // Composite index for location and date range queries
  pgm.createIndex('weather_data', ['location', 'date'], {
    name: 'idx_weather_data_location_date',
  });

  // Index for adverse weather queries
  pgm.createIndex('weather_data', ['location', 'is_adverse', 'date'], {
    name: 'idx_weather_data_location_adverse_date',
  });

  // Create holidays table
  pgm.createTable('holidays', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Holiday name',
    },
    date: {
      type: 'date',
      notNull: true,
      comment: 'Holiday date',
    },
    region: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'Region/country code (e.g., US, CA, UK)',
    },
    is_recurring: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether this holiday recurs annually',
    },
    description: {
      type: 'text',
      notNull: false,
      comment: 'Optional description of the holiday',
    },
    configured_by: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
      comment: 'Admin user who configured this holiday',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create trigger to auto-update updated_at for holidays
  pgm.createTrigger('holidays', 'update_holidays_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });

  // Create unique constraint to prevent duplicate holidays for same region and date
  pgm.addConstraint('holidays', 'unique_region_date_name', {
    unique: ['region', 'date', 'name'],
  });

  // Create indexes for holidays table
  pgm.createIndex('holidays', 'region', {
    name: 'idx_holidays_region',
  });

  pgm.createIndex('holidays', 'date', {
    name: 'idx_holidays_date',
  });

  // Composite index for region and date range queries
  pgm.createIndex('holidays', ['region', 'date'], {
    name: 'idx_holidays_region_date',
  });

  // Create audit_logs table
  pgm.createTable('audit_logs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: false,
      references: 'users',
      onDelete: 'SET NULL',
      comment: 'User who performed the action (null for system actions)',
    },
    action: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'Action performed (e.g., CREATE_PROJECT, UPDATE_TASK, DELETE_DOCUMENT)',
    },
    entity_type: {
      type: 'varchar(50)',
      notNull: false,
      comment: 'Type of entity affected (project, task, document, user, etc.)',
    },
    entity_id: {
      type: 'uuid',
      notNull: false,
      comment: 'ID of the entity affected',
    },
    details: {
      type: 'jsonb',
      notNull: false,
      default: '{}',
      comment: 'Additional details about the action (changes, metadata, etc.)',
    },
    ip_address: {
      type: 'varchar(45)',
      notNull: false,
      comment: 'IP address of the user (supports IPv6)',
    },
    user_agent: {
      type: 'text',
      notNull: false,
      comment: 'User agent string from the request',
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'success',
      comment: 'Status of the action (success, failure, error)',
    },
    error_message: {
      type: 'text',
      notNull: false,
      comment: 'Error message if action failed',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create indexes for audit_logs table
  pgm.createIndex('audit_logs', 'user_id', {
    name: 'idx_audit_logs_user_id',
  });

  pgm.createIndex('audit_logs', 'action', {
    name: 'idx_audit_logs_action',
  });

  pgm.createIndex('audit_logs', 'entity_type', {
    name: 'idx_audit_logs_entity_type',
  });

  pgm.createIndex('audit_logs', 'entity_id', {
    name: 'idx_audit_logs_entity_id',
  });

  pgm.createIndex('audit_logs', 'created_at', {
    name: 'idx_audit_logs_created_at',
  });

  pgm.createIndex('audit_logs', 'status', {
    name: 'idx_audit_logs_status',
  });

  // Composite index for user action history
  pgm.createIndex('audit_logs', ['user_id', 'created_at'], {
    name: 'idx_audit_logs_user_created',
  });

  // Composite index for entity audit trail
  pgm.createIndex('audit_logs', ['entity_type', 'entity_id', 'created_at'], {
    name: 'idx_audit_logs_entity_created',
  });

  // Composite index for action filtering
  pgm.createIndex('audit_logs', ['action', 'status', 'created_at'], {
    name: 'idx_audit_logs_action_status_created',
  });

  // Create GIN index for details JSONB for efficient JSON queries
  pgm.createIndex('audit_logs', 'details', {
    name: 'idx_audit_logs_details',
    method: 'gin',
  });

  // Add comments to tables and columns
  pgm.sql(`
    COMMENT ON TABLE forecasts IS 'AI-generated project completion forecasts with risk assessment';
    COMMENT ON TABLE weather_data IS 'Historical and forecasted weather data for project locations';
    COMMENT ON TABLE holidays IS 'Public holidays and non-working days by region';
    COMMENT ON TABLE audit_logs IS 'System audit trail for user actions and security events';
    COMMENT ON TYPE risk_level IS 'Risk levels for forecasts: low, medium, high';
    COMMENT ON COLUMN forecasts.project_id IS 'Project this forecast is for';
    COMMENT ON COLUMN forecasts.estimated_completion_date IS 'AI-predicted completion date';
    COMMENT ON COLUMN forecasts.risk_level IS 'Risk assessment: low, medium, or high';
    COMMENT ON COLUMN forecasts.explanation IS 'Human-readable explanation for the forecast';
    COMMENT ON COLUMN forecasts.confidence_score IS 'Confidence score (0-100) for the prediction';
    COMMENT ON COLUMN forecasts.factors_considered IS 'JSON object with factors used in forecast (weather, holidays, progress, etc.)';
    COMMENT ON COLUMN forecasts.generated_by IS 'User who requested the forecast';
    COMMENT ON COLUMN forecasts.is_cached IS 'Whether this forecast is cached';
    COMMENT ON COLUMN forecasts.cache_expires_at IS 'When the cached forecast expires';
    COMMENT ON COLUMN weather_data.location IS 'Location identifier (city, coordinates, etc.)';
    COMMENT ON COLUMN weather_data.date IS 'Date for this weather record';
    COMMENT ON COLUMN weather_data.temperature_celsius IS 'Temperature in Celsius';
    COMMENT ON COLUMN weather_data.precipitation_mm IS 'Precipitation in millimeters';
    COMMENT ON COLUMN weather_data.wind_speed_kmh IS 'Wind speed in km/h';
    COMMENT ON COLUMN weather_data.conditions IS 'Weather conditions (sunny, rainy, cloudy, etc.)';
    COMMENT ON COLUMN weather_data.is_adverse IS 'Whether conditions are adverse for construction work';
    COMMENT ON COLUMN weather_data.raw_data IS 'Raw weather data from external API';
    COMMENT ON COLUMN weather_data.source IS 'Weather data source/provider';
    COMMENT ON COLUMN holidays.name IS 'Holiday name';
    COMMENT ON COLUMN holidays.date IS 'Holiday date';
    COMMENT ON COLUMN holidays.region IS 'Region/country code (e.g., US, CA, UK)';
    COMMENT ON COLUMN holidays.is_recurring IS 'Whether this holiday recurs annually';
    COMMENT ON COLUMN holidays.description IS 'Optional description of the holiday';
    COMMENT ON COLUMN holidays.configured_by IS 'Admin user who configured this holiday';
    COMMENT ON COLUMN audit_logs.user_id IS 'User who performed the action (null for system actions)';
    COMMENT ON COLUMN audit_logs.action IS 'Action performed (e.g., CREATE_PROJECT, UPDATE_TASK, DELETE_DOCUMENT)';
    COMMENT ON COLUMN audit_logs.entity_type IS 'Type of entity affected (project, task, document, user, etc.)';
    COMMENT ON COLUMN audit_logs.entity_id IS 'ID of the entity affected';
    COMMENT ON COLUMN audit_logs.details IS 'Additional details about the action (changes, metadata, etc.)';
    COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the user (supports IPv6)';
    COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string from the request';
    COMMENT ON COLUMN audit_logs.status IS 'Status of the action (success, failure, error)';
    COMMENT ON COLUMN audit_logs.error_message IS 'Error message if action failed';
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop tables in reverse order
  pgm.dropTable('audit_logs', { cascade: true });
  pgm.dropTable('holidays', { cascade: true });
  pgm.dropTable('weather_data', { cascade: true });
  pgm.dropTable('forecasts', { cascade: true });

  // Drop risk_level enum
  pgm.dropType('risk_level');
}
