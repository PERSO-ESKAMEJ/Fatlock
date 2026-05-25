import { AIAnalysisResult } from '../../types';

interface AIAnalysisCardProps {
  result: AIAnalysisResult;
  showPrivate?: boolean;
}

export default function AIAnalysisCard({ result, showPrivate = false }: AIAnalysisCardProps) {
  const score = result.credibilityScore;
  const color = score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--gold)' : 'var(--red)';
  const label = score >= 85 ? 'Très crédible' : score >= 65 ? 'Crédible' : score >= 45 ? 'Incohérence mineure' : 'Incohérence significative';

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
          Analyse IA — Semaine {result.weekNumber}
        </div>
        <div className="text-xs text-[var(--muted)]">
          {new Date(result.generatedAt).toLocaleDateString('fr-FR')}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--panel2)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={color} strokeWidth="3"
              strokeDasharray={`${score} ${100 - score}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-sm font-bold" style={{ color }}>{score}</span>
          </div>
        </div>
        <div>
          <div className="font-bold text-sm" style={{ color }}>{label}</div>
          <div className="text-xs text-[var(--muted)] mt-0.5">Score de crédibilité</div>
        </div>
      </div>

      {showPrivate && result.analysis && (
        <div
          className="panel2 p-3 text-sm leading-relaxed"
          style={{ color: 'var(--ink)', borderLeft: `3px solid ${color}` }}
        >
          {result.analysis}
        </div>
      )}
    </div>
  );
}