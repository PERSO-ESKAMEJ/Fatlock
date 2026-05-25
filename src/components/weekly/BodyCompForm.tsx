import { useState } from 'react';
import { BodyComposition } from '../../types';
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
      date: new Date().toISOString().slice(0, 10),
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
      <p className="text-xs text-[var(--muted)] panel2 p-3 rounded-lg">
        📍 Disponible sur les balances InBody/Tanita de Basic-Fit, Fitness Park, etc. — à faire avant ta séance.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label>Poids (kg)</label>
          <input
            type="number" step="0.1" min="30" max="250"
            value={weight} onChange={(e) => setWeight(e.target.value)}
            placeholder="80.0"
          />
          {weightDelta && (
            <div className={`text-xs mt-1 ${parseFloat(weightDelta) < 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
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
        </div>

        <div>
          <label>Masse grasse (kg)</label>
          <input
            type="number" step="0.1" min="1" max="100"
            value={fat} onChange={(e) => setFat(e.target.value)}
            placeholder="15.0"
          />
          {fatPct && (
            <div className="text-xs text-[var(--muted)] mt-1">→ {fatPct}% de masse grasse</div>
          )}
        </div>

        <div>
          <label>Eau (%)</label>
          <input
            type="number" step="0.1" min="30" max="80"
            value={water} onChange={(e) => setWater(e.target.value)}
            placeholder="55.0"
          />
        </div>

        <div>
          <label>Masse osseuse (kg)</label>
          <input
            type="number" step="0.1" min="1" max="5"
            value={bone} onChange={(e) => setBone(e.target.value)}
            placeholder="2.5"
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={!isValid} className="w-full">
        Enregistrer la composition
      </Button>
    </div>
  );
}