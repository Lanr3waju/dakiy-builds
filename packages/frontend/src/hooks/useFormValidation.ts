import { useState, useCallback } from 'react';
import { Validator, ValidationSchema, ValidationErrors } from '../utils/validation';

interface UseFormValidationOptions {
  schema: ValidationSchema;
  onSubmit: (data: Record<string, any>) => Promise<void> | void;
}

interface UseFormValidationReturn {
  values: Record<string, any>;
  errors: ValidationErrors;
  isSubmitting: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  setFieldValue: (field: string, value: any) => void;
  setFieldError: (field: string, error: string) => void;
  clearFieldError: (field: string) => void;
  clearAllErrors: () => void;
  resetForm: () => void;
  setValues: (values: Record<string, any>) => void;
}

/**
 * Custom hook for form validation and submission
 */
export function useFormValidation(
  initialValues: Record<string, any>,
  options: UseFormValidationOptions
): UseFormValidationReturn {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      
      // Handle checkbox
      if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setValues((prev) => ({ ...prev, [name]: checked }));
      } else {
        setValues((prev) => ({ ...prev, [name]: value }));
      }

      // Clear field error on change
      if (errors[name]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    },
    [errors]
  );

  const setFieldValue = useCallback((field: string, value: any) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setFieldError = useCallback((field: string, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setIsSubmitting(false);
  }, [initialValues]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      clearAllErrors();

      // Validate form
      const validationErrors = Validator.validate(values, options.schema);
      if (Validator.hasErrors(validationErrors)) {
        setErrors(validationErrors);
        return;
      }

      setIsSubmitting(true);

      try {
        await options.onSubmit(values);
      } catch (error) {
        // Error handling is done by the onSubmit function
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, options, clearAllErrors]
  );

  return {
    values,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    setFieldValue,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    resetForm,
    setValues,
  };
}
