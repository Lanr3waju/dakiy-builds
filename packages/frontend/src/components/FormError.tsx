import '../styles/FormError.css';

interface FormErrorProps {
  error?: string;
  errors?: Record<string, string>;
  className?: string;
}

/**
 * Display inline form field error
 */
export function FormFieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <span className="form-error-inline">{error}</span>;
}

/**
 * Display multiple form errors in a box
 */
export function FormErrorBox({ errors, className }: FormErrorProps) {
  if (!errors || Object.keys(errors).length === 0) return null;

  const errorList = Object.entries(errors);

  return (
    <div className={`form-error-box ${className || ''}`}>
      <div className="form-error-box-title">
        <span>⚠️</span>
        <span>Please fix the following errors:</span>
      </div>
      <ul className="form-error-box-list">
        {errorList.map(([field, message]) => (
          <li key={field}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Display a single error message
 */
export function FormError({ error, className }: FormErrorProps) {
  if (!error) return null;
  return <div className={`form-error-box ${className || ''}`}>{error}</div>;
}

/**
 * Display success message
 */
export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="form-success-message">
      <span>✓</span>
      <span>{message}</span>
    </div>
  );
}

/**
 * Display warning message
 */
export function FormWarning({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="form-warning-message">
      <span>⚠️</span>
      <span>{message}</span>
    </div>
  );
}
