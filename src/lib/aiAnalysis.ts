import { AIAnalysisResult, BodyComposition, WeeklyPhoto } from '../types';

interface AIAnalysisParams {
  userId: string;
  weekNumber: number;
  prevCompo: BodyComposition | null;
  currCompo: BodyComposition;
  photo: WeeklyPhoto;
  apiKey: string;
}

function parseBase64(dataUrl: string): { mediaType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Format photo invalide');
  return { mediaType: match[1], data: match[2] };
}

export async function runAIAnalysis(params: AIAnalysisParams): Promise<AIAnalysisResult> {
  const { userId, weekNumber, prevCompo, currCompo, photo, apiKey } = params;

  const delta = prevCompo
    ? `Évolution depuis S${weekNumber - 1} :
- Poids : ${(currCompo.weightKg - prevCompo.weightKg).toFixed(1)} kg
- Masse grasse : ${(currCompo.fatMassKg - prevCompo.fatMassKg).toFixed(1)} kg
- Masse musculaire : ${(currCompo.muscleMassKg - prevCompo.muscleMassKg).toFixed(1)} kg`
    : "Première mesure — pas d'historique disponible.";

  const prompt = `Tu es un expert en transformation physique pour une compétition sur 8 semaines.

Semaine ${weekNumber}/8 — Composition corporelle déclarée :
- Poids : ${currCompo.weightKg} kg
- Masse grasse : ${currCompo.fatMassKg} kg (${((currCompo.fatMassKg / currCompo.weightKg) * 100).toFixed(1)}%)
- Masse musculaire : ${currCompo.muscleMassKg} kg
- Eau : ${currCompo.waterPercent?.toFixed(0) ?? 'N/A'}%

${delta}

Analyse les photos jointes. Évalue la cohérence entre les mesures déclarées et la transformation visible.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{"credibilityScore": <entier 0-100>, "analysis": "<2-3 phrases en français, directes et précises>"}

Barème du score :
85-100 : transformation clairement visible, cohérence totale
65-84 : bonne cohérence, légères incertitudes
45-64 : cohérence partielle, doutes notables
25-44 : incohérences importantes
0-24 : déclarations très douteuses`;

  const images: object[] = [];
  const front = parseBase64(photo.frontBase64);
  images.push({ type: 'image', source: { type: 'base64', media_type: front.mediaType, data: front.data } });

  if (photo.sideBase64) {
    const side = parseBase64(photo.sideBase64);
    images.push({ type: 'image', source: { type: 'base64', media_type: side.mediaType, data: side.data } });
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [...images, { type: 'text', text: prompt }],
      }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Erreur API Anthropic (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  const text: string = json.content?.[0]?.text ?? '';

  let parsed: { credibilityScore: number; analysis: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { credibilityScore: 50, analysis: text };
  }

  return {
    userId,
    weekNumber,
    credibilityScore: Math.max(0, Math.min(100, Math.round(parsed.credibilityScore))),
    analysis: parsed.analysis,
    generatedAt: new Date().toISOString(),
  };
}