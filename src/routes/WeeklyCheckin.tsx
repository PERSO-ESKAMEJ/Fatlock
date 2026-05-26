import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import { getCurrentWeek, getChallengeState } from '../store/useChallengeStore';
import { savePhoto } from '../lib/db';
import { buildWeeklyScore } from '../lib/scoring';
import { BodyComposition } from '../types';
import PageWrapper from '../components/layout/PageWrapper';
import BodyCompForm from '../components/weekly/BodyCompForm';
import PhotoUploadCrop from '../components/weekly/PhotoUploadCrop';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

export default function WeeklyCheckin() {
  const profile = useProfileStore((s) => s.profile)!;
  const challenge = useProfileStore((s) => s.challenge)!;
  const { addBodyComposition, addWeeklyScore, bodyCompositions, dailyLogs } = useLogStore();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const navigate = useNavigate();
  const durationWeeks = challenge.durationWeeks ?? challenge.customSettings?.durationWeeks ?? 8;
  const challengeState = getChallengeState(challenge.startDate, durationWeeks);
  const currentWeek = getCurrentWeek(challenge.startDate, durationWeeks);
  const isBaseline = searchParams.get('week') === '0';
  const targetWeek = isBaseline ? 0 : currentWeek;

  const trackPhotos = challenge.challengeType === 'custom'
    ? (challenge.customSettings?.trackPhotos ?? 'required')
    : 'required';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [savedComp, setSavedComp] = useState<BodyComposition | null>(null);
  const [frontB64, setFrontB64] = useState('');
  const [sideB64, setSideB64] = useState('');
  const [backB64, setBackB64] = useState('');
  const [saving, setSaving] = useState(false);

  const userComps = bodyCompositions.filter((c) => c.userId === profile.id);
  const previousComp = isBaseline
    ? undefined
    : userComps.find((c) => c.weekNumber === currentWeek - 1) ?? userComps[userComps.length - 1];
  const alreadyDone = userComps.some((c) => c.weekNumber === targetWeek);

  function handleCompSave(comp: BodyComposition) {
    setSavedComp(comp);
    setStep(trackPhotos === 'disabled' ? 3 : 2);
  }

  async function handleConfirm() {
    if (!savedComp || (trackPhotos === 'required' && (!frontB64 || !sideB64))) {
      showToast('Photos face + profil obligatoires', 'error');
      return;
    }
    setSaving(true);
    try {
      await savePhoto({
        userId: profile.id,
        weekNumber: targetWeek,
        capturedAt: new Date().toISOString(),
        frontBase64: frontB64,
        sideBase64: sideB64,
        backBase64: backB64 || undefined,
      });

      addBodyComposition(savedComp);

      if (!isBaseline) {
        const challengeStart = new Date(challenge.startDate + 'T12:00:00');
        const weekStartDate = new Date(challengeStart);
        weekStartDate.setDate(challengeStart.getDate() + (currentWeek - 1) * 7);
        const weekEndDate = new Date(challengeStart);
        weekEndDate.setDate(challengeStart.getDate() + currentWeek * 7);
        const weekStartStr = weekStartDate.toISOString().slice(0, 10);
        const weekEndStr = weekEndDate.toISOString().slice(0, 10);
        const weekLogs = dailyLogs.filter(
          (l) => l.userId === profile.id && l.date >= weekStartStr && l.date < weekEndStr
        );
        const startComp = userComps.find((c) => c.weekNumber === 0) ?? null;
        const customRituals = challenge.challengeType === 'custom'
          ? challenge.customSettings?.rituals
          : undefined;
        const allUserLogs = dailyLogs.filter((l) => l.userId === profile.id);
        const score = buildWeeklyScore(
          profile.id,
          currentWeek,
          weekLogs,
          profile.intensity,
          startComp,
          savedComp,
          null,
          7,
          customRituals,
          durationWeeks,
          allUserLogs
        );
        addWeeklyScore(score);
      }

      showToast(isBaseline ? 'Mesures de départ enregistrées !' : `Semaine ${currentWeek} validée !`, 'success');
      setStep(3);
    } catch (err) {
      showToast('Erreur lors de la sauvegarde', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (challengeState === 'pending' && !isBaseline) {
    return (
      <PageWrapper title="Check-in">
        <div className="panel p-8 text-center mt-4">
          <div className="text-3xl mb-3">🔒</div>
          <div className="font-bold text-[var(--ink)] mb-1">Challenge pas encore commencé</div>
          <div className="text-sm text-[var(--muted)] mb-5">
            Les check-ins hebdomadaires seront disponibles dès le J1.
            Tu peux dès maintenant enregistrer tes mesures de départ.
          </div>
          <button
            onClick={() => navigate('/checkin?week=0')}
            className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
            style={{ background: 'var(--blue)', color: 'white' }}
          >
            Enregistrer mes mesures S0 →
          </button>
        </div>
      </PageWrapper>
    );
  }

  // S0 verrouillé une fois le challenge démarré — anti-triche
  if (isBaseline && alreadyDone && challengeState !== 'pending' && step !== 3) {
    return (
      <PageWrapper title="Mesures S0">
        <div className="panel p-6 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <div className="font-bold text-lg text-[var(--ink)] mb-1">Mesures S0 verrouillées</div>
          <p className="text-sm text-[var(--muted)]">
            Le challenge a démarré. Les mesures de départ ne peuvent plus être modifiées pour garantir l'équité du classement.
          </p>
        </div>
      </PageWrapper>
    );
  }

  // Check-ins hebdomadaires : une seule validation par semaine
  if (!isBaseline && alreadyDone && step !== 3) {
    return (
      <PageWrapper title={`Check-in S${currentWeek}`}>
        <div className="panel p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="font-bold text-lg text-[var(--ink)] mb-1">
            Semaine {currentWeek} déjà validée
          </div>
          <p className="text-sm text-[var(--muted)]">
            Reviens la semaine prochaine pour le prochain check-in.
          </p>
        </div>
      </PageWrapper>
    );
  }

  const pageTitle = isBaseline ? 'Mesures de départ — S0' : `Check-in Semaine ${currentWeek}`;

  return (
    <PageWrapper title={pageTitle}>
      {isBaseline && (
        <div
          className="mb-4 px-3 py-2 rounded-lg text-xs"
          style={{ background: 'rgba(47,227,154,0.07)', border: '1px solid rgba(47,227,154,0.2)', color: 'var(--muted)' }}
        >
          Ces mesures servent de référence de départ. Elles seront comparées à ta transformation finale pour le vote.
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              style={{
                background: step >= s ? 'var(--blue)' : 'var(--panel)',
                color: step >= s ? 'white' : 'var(--muted)',
                border: `1px solid ${step >= s ? 'var(--blue)' : 'var(--border)'}`,
              }}
            >
              {s}
            </div>
            {s < 3 && <div className="flex-1 h-0.5 w-8" style={{ background: step > s ? 'var(--blue)' : 'var(--border)' }} />}
          </div>
        ))}
        <div className="ml-2 text-xs text-[var(--muted)]">
          {step === 1 ? 'Composition corporelle' : step === 2 ? 'Photos' : 'Confirmation'}
        </div>
      </div>

      {/* Step 1: Body comp */}
      {step === 1 && (
        <div>
          <h2 className="font-bold text-[var(--ink)] mb-4">Composition corporelle</h2>
          <BodyCompForm
            userId={profile.id}
            weekNumber={targetWeek}
            previous={previousComp}
            onSave={handleCompSave}
          />
        </div>
      )}

      {/* Step 2: Photos */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="font-bold text-[var(--ink)]">
            {isBaseline ? 'Photos de départ' : 'Photos de progression'}
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Pose standardisée — même éclairage, même distance, vêtements de sport révélant l'abdomen.
          </p>
          <PhotoUploadCrop label="Face" required onSave={setFrontB64} existing={frontB64} />
          <PhotoUploadCrop label="Profil" required onSave={setSideB64} existing={sideB64} />
          <PhotoUploadCrop label="Dos (optionnel)" onSave={setBackB64} existing={backB64} />

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(1)}>← Retour</Button>
            <Button className="flex-1" onClick={() => setStep(3)} disabled={trackPhotos === 'required' && (!frontB64 || !sideB64)}>
              Continuer →
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && savedComp && (
        <div className="space-y-4">
          <h2 className="font-bold text-[var(--ink)]">
            {isBaseline ? 'Confirmation — Mesures S0' : `Confirmation — Semaine ${currentWeek}`}
          </h2>

          <div className="panel2 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Poids</span>
              <span className="font-mono font-bold">{savedComp.weightKg} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Masse musculaire</span>
              <span className="font-mono">{savedComp.muscleMassKg} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Masse grasse</span>
              <span className="font-mono">{savedComp.fatMassKg} kg ({((savedComp.fatMassKg / savedComp.weightKg) * 100).toFixed(1)}%)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Eau</span>
              <span className="font-mono">{savedComp.waterPercent}%</span>
            </div>
          </div>

          <div className="flex gap-2">
            {frontB64 && <img src={frontB64} alt="Face" className="w-20 h-20 object-cover rounded-lg" style={{ border: '1px solid var(--border)' }} />}
            {sideB64 && <img src={sideB64} alt="Profil" className="w-20 h-20 object-cover rounded-lg" style={{ border: '1px solid var(--border)' }} />}
            {backB64 && <img src={backB64} alt="Dos" className="w-20 h-20 object-cover rounded-lg" style={{ border: '1px solid var(--border)' }} />}
          </div>

          {alreadyDone ? (
            <div className="panel p-4 text-center text-[var(--green)]">
              <div className="text-3xl mb-2">✅</div>
              <div className="font-bold">
                {isBaseline ? 'Mesures S0 enregistrées !' : `Semaine ${currentWeek} validée !`}
              </div>
              {!isBaseline && (
                <p className="text-sm text-[var(--muted)] mt-1">Exporte ton récap depuis le classement pour partager avec l'admin.</p>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(2)}>← Retour</Button>
              <Button className="flex-1" onClick={handleConfirm} loading={saving}>
                {isBaseline ? 'Enregistrer mes mesures S0' : `Valider la semaine ${currentWeek}`}
              </Button>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}