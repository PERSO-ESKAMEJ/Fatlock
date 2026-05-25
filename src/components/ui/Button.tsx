import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-bold uppercase tracking-widest rounded-lg transition-all duration-200 select-none focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed';

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
  };

  const variants = {
    primary:
      'bg-gradient-to-r from-[var(--blue)] to-[var(--cyan)] text-white hover:brightness-110 active:scale-95',
    ghost:
      'bg-transparent border border-[var(--border)] text-[var(--muted)] hover:border-[var(--blue)] hover:text-[var(--ink)] active:scale-95',
    danger:
      'bg-transparent border border-[var(--red)] text-[var(--red)] hover:bg-[var(--red)] hover:text-white active:scale-95',
    success:
      'bg-[var(--green)] text-[var(--bg)] hover:brightness-110 active:scale-95',
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
