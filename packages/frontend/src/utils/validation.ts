export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  custom?: (value: any) => string | null;
}

export interface ValidationSchema {
  [field: string]: ValidationRule;
}

export interface ValidationErrors {
  [field: string]: string;
}

export class Validator {
  /**
   * Validate a single field value against a rule
   */
  static validateField(value: any, rule: ValidationRule, fieldName: string): string | null {
    // Required validation
    if (rule.required) {
      if (value === null || value === undefined || value === '') {
        return `${fieldName} is required`;
      }
      if (typeof value === 'string' && !value.trim()) {
        return `${fieldName} is required`;
      }
    }

    // Skip other validations if value is empty and not required
    if (!rule.required && (value === null || value === undefined || value === '')) {
      return null;
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        return `${fieldName} must be at least ${rule.minLength} characters`;
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        return `${fieldName} must be at most ${rule.maxLength} characters`;
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        return `${fieldName} format is invalid`;
      }
      if (rule.email && !this.isValidEmail(value)) {
        return `${fieldName} must be a valid email address`;
      }
      if (rule.url && !this.isValidUrl(value)) {
        return `${fieldName} must be a valid URL`;
      }
    }

    // Number validations
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))) {
      const numValue = typeof value === 'number' ? value : Number(value);
      if (rule.min !== undefined && numValue < rule.min) {
        return `${fieldName} must be at least ${rule.min}`;
      }
      if (rule.max !== undefined && numValue > rule.max) {
        return `${fieldName} must be at most ${rule.max}`;
      }
    }

    // Custom validation
    if (rule.custom) {
      return rule.custom(value);
    }

    return null;
  }

  /**
   * Validate an entire form data object against a schema
   */
  static validate(data: Record<string, any>, schema: ValidationSchema): ValidationErrors {
    const errors: ValidationErrors = {};

    for (const [field, rule] of Object.entries(schema)) {
      const value = data[field];
      const fieldLabel = this.formatFieldName(field);
      const error = this.validateField(value, rule, fieldLabel);
      if (error) {
        errors[field] = error;
      }
    }

    return errors;
  }

  /**
   * Check if validation errors exist
   */
  static hasErrors(errors: ValidationErrors): boolean {
    return Object.keys(errors).length > 0;
  }

  /**
   * Format field name for display (e.g., "first_name" -> "First name")
   */
  private static formatFieldName(field: string): string {
    return field
      .split('_')
      .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ');
  }

  /**
   * Validate email format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate date range (end date after start date)
   */
  static validateDateRange(startDate: string, endDate: string): string | null {
    if (!startDate || !endDate) {
      return null;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return 'End date must be after start date';
    }
    return null;
  }

  /**
   * Validate progress percentage (0-100)
   */
  static validateProgress(progress: number): string | null {
    if (progress < 0 || progress > 100) {
      return 'Progress must be between 0 and 100';
    }
    return null;
  }
}

/**
 * Common validation schemas for reuse
 */
export const CommonSchemas = {
  project: {
    name: { required: true, minLength: 3, maxLength: 100 },
    location: { required: true, minLength: 2, maxLength: 200 },
    budget: { required: true, min: 0 },
    start_date: { required: true },
    planned_end_date: { required: true },
  },
  task: {
    name: { required: true, minLength: 3, maxLength: 100 },
    phase: { required: true, minLength: 2, maxLength: 50 },
    duration_days: { required: true, min: 0 },
  },
  user: {
    username: { required: true, minLength: 3, maxLength: 50 },
    email: { required: true, email: true },
    password: { required: true, minLength: 8 },
  },
  login: {
    username: { required: true },
    password: { required: true },
  },
  progress: {
    progress: {
      required: true,
      min: 0,
      max: 100,
      custom: (value: number) => Validator.validateProgress(value),
    },
  },
};
