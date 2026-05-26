import { useState } from 'react';
import { useProfileStore } from '../../store/useProfileStore';
import { useChallengeStore } from '../../store/useChallengeStore';
import { useLogStore } from '../../store/useLogStore';
import { isTodaysCode, getTodayStr, getDailyCode } from '../../lib/dailyCode';
import { useToast } from '../ui/Toast';
import Button from '../ui/Button';

export default function DailyCodeUnlock() {
  const profile = useProfileStore((s) => s.profile)!;
  const challenge = useProfileStore((s) => s.challenge)!;
  const { confirmCode, isCodeConfirmed } = useChallengeStore();
  const upsertDailyLog = useLogStore((s) => s.upsertDailyLog);
  const getDailyLog = useLogStore((s) => s.getDailyLog);
  const { showToast } = useToast();

  const today = getTodayStr();
  const alreadyConfirmed = isCodeConfirmed(challenge.groupCode, today);
  const dailyCode = getDailyCode(challenge.groupSecret, today);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  function confirmAndLog() {
    confirmCode(challenge.groupCode, today);
    const existing = getDailyLog(profile.id, today);
    upsertDailyLog({
      userId: profile.id,
      date: today,
      codeConfirmed: true,
      dayType: existing?.dayType ?? 'repos',
      rituals: existing?.rituals ?? {},
    });
    showToast('Journée activée ! Rituels débloqués.', 'success');
    setInput('');
    setError('');
  }

  function handleConfirm() {
    if (profile.isAdmin) {
      confirmAndLog();
      return;
    }
    if (!isTodaysCode(challenge.groupSecret, input.trim())) {
      setError('Code invalide — demande le code du jour à l\'admin.');
      return;
    }
    confirmAndLog();
  }

  if (alreadyConfirmed) {
    return (
      <div
        className="flex items-center justify-between px-4 py-3 rounded-lg"
        style={{ background: 'rgba(47,227,154,0.08)', border: '1px solid rgba(47,227,154,0.25)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">✓</span>
          <div>
            <div className="text-sm font-bold text-[var(--green)]">Journée activée</div>
            <div className="text-xs text-[var(--muted)]">{today} · Rituels débloqués</div>
          </div>
        </div>
        {profile.isAdmin && (
          <div className="text-right">
            <div className="text-xs text-[var(--muted)] mb-0.5">Code du jour</div>
            <div
              className="font-mono font-bold text-lg tracking-widest cursor-pointer select-all"
              style={{ color: 'var(--cyan)' }}
              onClick={() => navigator.clipboard.writeText(dailyCode).then(() => showToast('Code copié !', 'success'))}
            >
              {dailyCode}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Admin — shows code directly, one click to confirm
  if (profile.isAdmin) {
    return (
      <div
        className="panel p-4"
        style={{ borderColor: 'var(--cyan)' }}
      >
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--cyan)' }}>
          Code du jour — à partager maintenant
        </div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div
            className="font-mono font-bold text-4xl tracking-widest cursor-pointer select-all"
            style={{ color: 'var(--cyan)' }}
            onClick={() => navigator.clipboard.writeText(dailyCode).then(() => showToast('Code copié !', 'success'))}
          >
            {dailyCode}
          </div>
          <div className="text-xs text-[var(--muted)] text-right">
            Clique pour copier<br />Envoie-le sur WhatsApp / Slack
          </div>
        </div>
        <Button className="w-full" onClick={handleConfirm}>
          Activer ma journée
        </Button>
      </div>
    );
  }

  // Non-admin — enter code
  return (
    <div
      className="panel p-4 animate-pulse-glow"
      style={{ borderColor: 'var(--blue)' }}
    >
      <div className="text-xs font-bold uppercase tracking-widest text-[var(--blue-bright)] mb-3">
        🔐 Code du jour requis
      </div>
      <p className="text-sm text-[var(--muted)] mb-3">
        L'admin partage ce code chaque matin via WhatsApp / Slack. Entre-le pour activer ta journée.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="ex: IRON-07"
          value={input}
          onChange={(e) => { setInput(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          className="flex-1 font-mono uppercase tracking-widest text-center text-lg"
          style={{ letterSpacing: '0.15em' }}
          autoComplete="off"
          spellCheck={false}
        />
        <Button onClick={handleConfirm} disabled={!input.trim()}>
          Confirmer
        </Button>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: 'var(--red)' }}>{error}</p>}
    </div>
  );
}