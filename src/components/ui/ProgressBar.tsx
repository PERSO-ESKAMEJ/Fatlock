interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  max = 100,
  color = 'var(--blue)',
  height = 6,
  label,
  showValue,
  className = '',
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs text-[var(--muted)]">{label}</span>}
          {showValue && (
            <span className="text-xs font-mono text-[var(--ink)]">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height, background: 'var(--panel2)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
