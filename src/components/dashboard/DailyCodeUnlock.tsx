import { useState } from 'react';
import { useProfileStore } from '../../store/useProfileStore';
import { useChallengeStore } from '../../store/useChallengeStore';
import { useLogStore } from '../../store/useLogStore';
import { isTodaysCode, getTodayStr } from '../../lib/dailyCode';
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
  const alreadyConfirmed = isCodeConfirmed(today);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  if (alreadyConfirmed) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg"
        style={{ background: 'rgba(47,227,154,0.08)', border: '1px solid rgba(47,227,154,0.25)' }}
      >
        <span className="text-xl">✓</span>
        <div>
          <div className="text-sm font-bold text-[var(--green)]">Code du jour confirmé</div>
          <div className="text-xs text-[var(--muted)]">{today}</div>
        </div>
      </div>
    );
  }

  function handleConfirm() {
    if (!isTodaysCode(challenge.groupSecret, input.trim())) {
      setError('Code incorrect. Vérifie auprès du groupe.');
      return;
    }
    confirmCode(today);

    const existing = getDailyLog(profile.id, today);
    upsertDailyLog({
      userId: profile.id,
      date: today,
      codeConfirmed: true,
      dayType: existing?.dayType ?? 'repos',
      rituals: existing?.rituals ?? {},
    });

    showToast('Code confirmé ! Rituels débloqués.', 'success');
    setInput('');
    setError('');
  }

  return (
    <div
      className="panel p-4 animate-pulse-glow"
      style={{ borderColor: 'var(--blue)' }}
    >
      <div className="text-xs font-bold uppercase tracking-widest text-[var(--blue-bright)] mb-3">
        🔐 Code du jour requis
      </div>
      <p className="text-sm text-[var(--muted)] mb-3">
        Entre le code partagé dans le groupe pour débloquer les rituels du jour.
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