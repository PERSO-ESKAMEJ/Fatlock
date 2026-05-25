import React from 'react';

interface PageWrapperProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export default function PageWrapper({ children, title, subtitle, className = '' }: PageWrapperProps) {
  return (
    <main className={`max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-10 animate-fade-in ${className}`}>
      {(title || subtitle) && (
        <div className="mb-6">
          {title && (
            <h1 className="font-display text-3xl uppercase tracking-wider text-[var(--ink)]">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </main>
  );
}