import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  onClick?: () => void;
}

export default function Card({ children, className = '', glow, onClick }: CardProps) {
  return (
    <div
      className={`panel p-4 ${glow ? 'animate-pulse-glow' : ''} ${onClick ? 'cursor-pointer hover:border-[var(--blue)] transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between mb-3 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-xs font-bold uppercase tracking-widest text-[var(--muted)] ${className}`}>
      {children}
    </h3>
  );
}
