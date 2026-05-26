import { useState } from 'react';
import { BodyComposition } from '../../types';
import { getTodayStr } from '../../lib/dailyCode';
import Button from '../ui/Button';

interface BodyCompFormProps {
  userId: string;
  weekNumber: number;
  previous?: BodyComposition;
  onSave: (comp: BodyComposition) => void;
}

export default function BodyCompForm({ userId, weekNumber, previous, onSave }: BodyCompFormProps) {
  const [weight, setWeight] = useState(previous?.weightKg?.toString() ?? '');
  const [muscle, setMuscle] = useState(previous?.muscleMassKg?.toString() ?? '');
  const [fat, setFat] = useState(previous?.fatMassKg?.toString() ?? '');
  const [water, setWater] = useState(previous?.waterPercent?.toString() ?? '');
  const [bone, setBone] = useState(previous?.boneMassKg?.toString() ?? '');

  const weightNum = parseFloat(weight);
  const fatNum = parseFloat(fat);
  const fatPct = weightNum && fatNum ? ((fatNum / weightNum) * 100).toFixed(1) : null;

  const prevWeight = previous?.weightKg;
  const weightDelta = prevWeight && weightNum ? (weightNum - prevWeight).toFixed(1) : null;

  function handleSave() {
    if (!weight || !muscle || !fat || !water || !bone) return;
    onSave({
      userId,
      date: getTodayStr(),
      weekNumber,
      weightKg: parseFloat(weight),
      muscleMassKg: parseFloat(muscle),
      fatMassKg: parseFloat(fat),
      waterPercent: parseFloat(water),
      boneMassKg: parseFloat(bone),
    });
  }

  const isValid = weight && muscle && fat && water && bone;

  return (
    <div className="space-y-4">
      <div className="text-xs panel2 p-3 rounded-lg space-y-1" style={{ color: 'var(--muted)' }}>
        <div>📍 <span className="text-[var(--ink)]">Balance impédancemètre</span> (InBody, Tanita) — Basic-Fit, Fitness Park, iFit, centres de santé.</div>
        <div>⏰ À faire le matin, avant ta séance, à jeun pour des mesures cohérentes d'une semaine à l'autre.</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label>Poids (kg)</label>
          <input
            type="number" step="0.1" min="30" max="250"
            value={weight} onChange={(e) => setWeight(e.target.value)}
            placeholder="80.0"
          />
          {weightDelta && (
            <div className={`text-xs mt-1 font-bold ${parseFloat(weightDelta) < 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
              {parseFloat(weightDelta) > 0 ? '+' : ''}{weightDelta} kg vs S{weekNumber - 1}
            </div>
          )}
        </div>

        <div>
          <label>Masse musculaire (kg)</label>
          <input
            type="number" step="0.1" min="10" max="120"
            value={muscle} onChange={(e) => setMuscle(e.target.value)}
            placeholder="35.0"
          />
          <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>Typique : 30–50 kg</div>
        </div>

        <div>
          <label>Masse grasse (kg)</label>
          <input
            type="number" step="0.1" min="1" max="100"
            value={fat} onChange={(e) => setFat(e.target.value)}
            placeholder="15.0"
          />
          {fatPct && (
            <div className="text-xs mt-1 font-bold" style={{ color: parseFloat(fatPct) > 25 ? 'var(--gold)' : 'var(--green)' }}>
              → {fatPct}% MG
            </div>
          )}
        </div>

        <div>
          <label>Eau (%)</label>
          <input
            type="number" step="0.1" min="30" max="80"
            value={water} onChange={(e) => setWater(e.target.value)}
            placeholder="55.0"
          />
          <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>Typique : 55–65%</div>
        </div>

        <div>
          <label>Masse osseuse (kg)</label>
          <input
            type="number" step="0.1" min="1" max="5"
            value={bone} onChange={(e) => setBone(e.target.value)}
            placeholder="2.5"
          />
          <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>Typique : 2.5–3.5 kg</div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={!isValid} className="w-full">
        Valider la composition →
      </Button>
    </div>
  );
}