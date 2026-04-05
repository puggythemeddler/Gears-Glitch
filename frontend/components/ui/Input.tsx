import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = "", id, ...rest }: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={`field${error ? " field-error" : ""}`}>
      {label && <label htmlFor={inputId} className="input-label">{label}</label>}
      <input
        id={inputId}
        className={`input${error ? " input-error" : ""}${className ? " " + className : ""}`}
        aria-invalid={!!error}
        aria-describedby={errorId}
        {...rest}
      />
      {error && <p className="input-error-text" id={errorId} role="alert">{error}</p>}
      {hint && !error && <p className="input-hint">{hint}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, className = "", id, ...rest }: SelectProps) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className={`field${error ? " field-error" : ""}`}>
      {label && <label htmlFor={selectId} className="input-label">{label}</label>}
      <select id={selectId} className={`input${error ? " input-error" : ""}${className ? " " + className : ""}`} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="input-error-text" role="alert">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = "", id, ...rest }: TextareaProps) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className={`field${error ? " field-error" : ""}`}>
      {label && <label htmlFor={textareaId} className="input-label">{label}</label>}
      <textarea
        id={textareaId}
        className={`input input-textarea${error ? " input-error" : ""}${className ? " " + className : ""}`}
        {...rest}
      />
      {error && <p className="input-error-text" role="alert">{error}</p>}
    </div>
  );
}
