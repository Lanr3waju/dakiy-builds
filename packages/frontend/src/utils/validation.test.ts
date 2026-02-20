import { describe, it, expect } from 'vitest';
import { Validator, CommonSchemas } from './validation';

describe('Validator', () => {
  describe('validateField', () => {
    it('validates required fields', () => {
      const rule = { required: true };
      
      expect(Validator.validateField('', rule, 'Name')).toBe('Name is required');
      expect(Validator.validateField('  ', rule, 'Name')).toBe('Name is required');
      expect(Validator.validateField(null, rule, 'Name')).toBe('Name is required');
      expect(Validator.validateField(undefined, rule, 'Name')).toBe('Name is required');
      expect(Validator.validateField('value', rule, 'Name')).toBeNull();
    });

    it('validates minLength', () => {
      const rule = { minLength: 5 };
      
      expect(Validator.validateField('abc', rule, 'Name')).toBe('Name must be at least 5 characters');
      expect(Validator.validateField('abcde', rule, 'Name')).toBeNull();
      expect(Validator.validateField('abcdef', rule, 'Name')).toBeNull();
    });

    it('validates maxLength', () => {
      const rule = { maxLength: 5 };
      
      expect(Validator.validateField('abcdef', rule, 'Name')).toBe('Name must be at most 5 characters');
      expect(Validator.validateField('abcde', rule, 'Name')).toBeNull();
      expect(Validator.validateField('abc', rule, 'Name')).toBeNull();
    });

    it('validates min value', () => {
      const rule = { min: 10 };
      
      expect(Validator.validateField(5, rule, 'Age')).toBe('Age must be at least 10');
      expect(Validator.validateField('5', rule, 'Age')).toBe('Age must be at least 10');
      expect(Validator.validateField(10, rule, 'Age')).toBeNull();
      expect(Validator.validateField(15, rule, 'Age')).toBeNull();
    });

    it('validates max value', () => {
      const rule = { max: 100 };
      
      expect(Validator.validateField(150, rule, 'Age')).toBe('Age must be at most 100');
      expect(Validator.validateField('150', rule, 'Age')).toBe('Age must be at most 100');
      expect(Validator.validateField(100, rule, 'Age')).toBeNull();
      expect(Validator.validateField(50, rule, 'Age')).toBeNull();
    });

    it('validates email format', () => {
      const rule = { email: true };
      
      expect(Validator.validateField('invalid', rule, 'Email')).toBe('Email must be a valid email address');
      expect(Validator.validateField('invalid@', rule, 'Email')).toBe('Email must be a valid email address');
      expect(Validator.validateField('@invalid.com', rule, 'Email')).toBe('Email must be a valid email address');
      expect(Validator.validateField('valid@example.com', rule, 'Email')).toBeNull();
    });

    it('validates URL format', () => {
      const rule = { url: true };
      
      expect(Validator.validateField('invalid', rule, 'Website')).toBe('Website must be a valid URL');
      expect(Validator.validateField('http://', rule, 'Website')).toBe('Website must be a valid URL');
      expect(Validator.validateField('https://example.com', rule, 'Website')).toBeNull();
    });

    it('validates pattern', () => {
      const rule = { pattern: /^[A-Z]{3}$/ };
      
      expect(Validator.validateField('abc', rule, 'Code')).toBe('Code format is invalid');
      expect(Validator.validateField('AB', rule, 'Code')).toBe('Code format is invalid');
      expect(Validator.validateField('ABC', rule, 'Code')).toBeNull();
    });

    it('validates custom rules', () => {
      const rule = {
        custom: (value: string) => {
          if (value === 'forbidden') {
            return 'This value is not allowed';
          }
          return null;
        },
      };
      
      expect(Validator.validateField('forbidden', rule, 'Value')).toBe('This value is not allowed');
      expect(Validator.validateField('allowed', rule, 'Value')).toBeNull();
    });

    it('skips validation for empty non-required fields', () => {
      const rule = { minLength: 5 };
      
      expect(Validator.validateField('', rule, 'Name')).toBeNull();
      expect(Validator.validateField(null, rule, 'Name')).toBeNull();
      expect(Validator.validateField(undefined, rule, 'Name')).toBeNull();
    });
  });

  describe('validate', () => {
    it('validates entire form data', () => {
      const schema = {
        name: { required: true, minLength: 3 },
        email: { required: true, email: true },
        age: { min: 18, max: 100 },
      };

      const data = {
        name: 'Jo',
        email: 'invalid',
        age: 15,
      };

      const errors = Validator.validate(data, schema);

      expect(errors.name).toBe('Name must be at least 3 characters');
      expect(errors.email).toBe('Email must be a valid email address');
      expect(errors.age).toBe('Age must be at least 18');
    });

    it('returns empty object for valid data', () => {
      const schema = {
        name: { required: true, minLength: 3 },
        email: { required: true, email: true },
      };

      const data = {
        name: 'John',
        email: 'john@example.com',
      };

      const errors = Validator.validate(data, schema);

      expect(Object.keys(errors).length).toBe(0);
    });
  });

  describe('hasErrors', () => {
    it('returns true when errors exist', () => {
      const errors = { name: 'Name is required' };
      expect(Validator.hasErrors(errors)).toBe(true);
    });

    it('returns false when no errors exist', () => {
      const errors = {};
      expect(Validator.hasErrors(errors)).toBe(false);
    });
  });

  describe('validateDateRange', () => {
    it('validates end date is after start date', () => {
      expect(Validator.validateDateRange('2024-01-01', '2024-01-02')).toBeNull();
      expect(Validator.validateDateRange('2024-01-02', '2024-01-01')).toBe('End date must be after start date');
      expect(Validator.validateDateRange('2024-01-01', '2024-01-01')).toBe('End date must be after start date');
    });

    it('returns null for empty dates', () => {
      expect(Validator.validateDateRange('', '2024-01-01')).toBeNull();
      expect(Validator.validateDateRange('2024-01-01', '')).toBeNull();
    });
  });

  describe('validateProgress', () => {
    it('validates progress is between 0 and 100', () => {
      expect(Validator.validateProgress(0)).toBeNull();
      expect(Validator.validateProgress(50)).toBeNull();
      expect(Validator.validateProgress(100)).toBeNull();
      expect(Validator.validateProgress(-1)).toBe('Progress must be between 0 and 100');
      expect(Validator.validateProgress(101)).toBe('Progress must be between 0 and 100');
    });
  });

  describe('CommonSchemas', () => {
    it('validates project data', () => {
      const validProject = {
        name: 'Test Project',
        location: 'New York',
        budget: 100000,
        start_date: '2024-01-01',
        planned_end_date: '2024-12-31',
      };

      const errors = Validator.validate(validProject, CommonSchemas.project);
      expect(Object.keys(errors).length).toBe(0);
    });

    it('validates task data', () => {
      const validTask = {
        name: 'Test Task',
        phase: 'Foundation',
        duration_days: 10,
      };

      const errors = Validator.validate(validTask, CommonSchemas.task);
      expect(Object.keys(errors).length).toBe(0);
    });

    it('validates user data', () => {
      const validUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      };

      const errors = Validator.validate(validUser, CommonSchemas.user);
      expect(Object.keys(errors).length).toBe(0);
    });
  });
});
