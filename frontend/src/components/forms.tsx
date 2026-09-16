import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const baseField =
  "w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-green-50 dark:placeholder:text-green-100/30 dark:focus:border-primary-400 dark:focus:ring-primary-500/20 dark:disabled:bg-white/5";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = "", id, ...rest },
  ref,
) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, "-") : undefined);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-green-100/80">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`${baseField} h-9.5 ${error ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, children, className = "", id, ...rest },
  ref,
) {
  const selectId = id ?? (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, "-") : undefined);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700 dark:text-green-100/80">
          {label}
        </label>
      )}
      <select ref={ref} id={selectId} className={`${baseField} h-9.5 cursor-pointer ${className}`} {...rest}>
        {children}
      </select>
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className = "", id, ...rest },
  ref,
) {
  const areaId = id ?? (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, "-") : undefined);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={areaId} className="text-sm font-medium text-gray-700 dark:text-green-100/80">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={areaId}
        className={`${baseField} min-h-20 py-2 ${error ? "border-red-400" : ""}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});
