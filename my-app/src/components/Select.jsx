import React from 'react';

const baseClasses =
  'w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-xs text-slate-700 font-medium shadow-sm outline-none transition duration-200';

const focusClasses =
  'focus:border-blue-400 focus:ring-4 focus:ring-blue-100';

const disabledClasses = 'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-slate-50';

const chevron = (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
  >
    <path
      fillRule="evenodd"
      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
      clipRule="evenodd"
    />
  </svg>
);

export default function Select({
  children,
  className = '',
  placeholder,
  disabled = false,
  ...props
}) {
  return (
    <div className="relative">
      <select
        disabled={disabled}
        className={`${baseClasses} ${focusClasses} ${disabled ? disabledClasses : ''} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      {chevron}
    </div>
  );
}
