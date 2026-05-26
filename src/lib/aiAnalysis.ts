import { AIAnalysisResult, BodyComposition, WeeklyPhoto } from '../types';

interface AIAnalysisParams {
  userId: string;
  weekNumber: number;
  prevCompo: BodyComposition | null;
  currCompo: BodyComposition;
  photo: WeeklyPhoto;
  prevPhoto?: WeeklyPhoto;
  apiKey: string;
}

function parseBase64(dataUrl: string): { mediaType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Format photo invalide');
  return { mediaType: match[1], data: match[2] };
}

function buildPrompt(
  weekNumber: number,
  currCompo: BodyComposition,
  prevCompo: BodyComposition | null,
  hasPrevPhoto: boolean
): string {
  const fatPct = ((currCompo.fatMassKg / currCompo.weightKg) * 100).toFixed(1);

  // ── Semaine 1 : évaluation des mesures initiales uniquement ────────────────
  if (weekNumber === 1 || !prevCompo) {
    if (hasPrevPhoto) {
      // S0 + S1 disponibles : comparaison possible mais transformation limitée en 1 semaine
      const deltaWeight = (currCompo.weightKg - prevCompo!.weightKg).toFixed(1);
      const deltaFat = (currCompo.fatMassKg - prevCompo!.fatMassKg).toFixed(1);
      const prevFatPct = ((prevCompo!.fatMassKg / prevCompo!.weightKg) * 100).toFixed(1);

      return `Tu es un expert en composition corporelle.

Semaine 1/8 — Tu reçois DEUX photos : S0 (avant le challenge) puis S1 (fin de la première semaine).

Mesures S0 → S1 :
- Poids : ${prevCompo!.weightKg} kg → ${currCompo.weightKg} kg (${parseFloat(deltaWeight) > 0 ? '+' : ''}${deltaWeight} kg)
- Masse grasse : ${prevCompo!.fatMassKg} kg (${prevFatPct}%) → ${currCompo.fatMassKg} kg (${fatPct}%) (${parseFloat(deltaFat) > 0 ? '+' : ''}${deltaFat} kg)
- Masse musculaire : ${prevCompo!.muscleMassKg} kg → ${currCompo.muscleMassKg} kg

Contexte : c'est la première semaine du challenge. Une transformation VISIBLE en 7 jours est physiologiquement limitée. Une variation de poids importante peut être due à la rétention d'eau — ne la pénalise pas automatiquement.

Évalue :
1. Les mesures de base S0 sont-elles plausibles au regard de la photo S0 ?
2. Les mesures S1 sont-elles cohérentes avec la photo S1 ?
3. Si une évolution significative est déclarée, est-elle visible entre les deux photos, ou peut-elle s'expliquer par de la rétention d'eau ?

Réponds UNIQUEMENT en JSON strict, sans markdown :
{"credibilityScore": <entier 0-100>, "analysis": "<2-3 phrases en français, directes et précises>"}

Barème :
85-100 : mesures cohérentes sur les deux semaines, évolution plausible
65-84 : bonne cohérence globale, légères incertitudes
45-64 : quelques incohérences mais dans des marges acceptables pour S1
25-44 : incohérences notables, évolution déclarée peu crédible même en tenant compte de la rétention d'eau
0-24 : mesures très peu crédibles au regard des deux photos`;
    }

    // Pas de photo S0 — évaluation de la plausibilité des mesures S1 uniquement
    return `Tu es un expert en composition corporelle.

Semaine 1/8 — Tu reçois une seule photo (S1, fin de la première semaine). Pas de photo de référence S0 disponible.

Mesures déclarées :
- Poids : ${currCompo.weightKg} kg
- Masse grasse : ${currCompo.fatMassKg} kg (${fatPct}%)
- Masse musculaire : ${currCompo.muscleMassKg} kg
- Eau : ${currCompo.waterPercent?.toFixed(0) ?? 'N/A'}%

Ta mission : estimer si ces mesures sont physiologiquement plausibles au regard du physique visible.

Évalue :
1. Le % de masse grasse déclaré (${fatPct}%) correspond-il à la silhouette visible ?
2. La masse musculaire déclarée (${currCompo.muscleMassKg} kg) est-elle cohérente avec les proportions visibles ?

Ne pénalise PAS l'absence de transformation — aucune n'est attendue en semaine 1.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{"credibilityScore": <entier 0-100>, "analysis": "<2-3 phrases en français, directes et précises>"}

Barème :
85-100 : mesures très plausibles, correspondance physique claire
65-84 : mesures globalement crédibles, légères incertitudes
45-64 : quelques incohérences dans des marges acceptables
25-44 : incohérences notables entre physique et chiffres
0-24 : mesures peu crédibles au regard du physique visible`;
  }

  // ── Semaine 2+ : évaluation de l'évolution ────────────────────────────────
  const prevFatPct = ((prevCompo.fatMassKg / prevCompo.weightKg) * 100).toFixed(1);
  const deltaWeight = (currCompo.weightKg - prevCompo.weightKg).toFixed(1);
  const deltaFat = (currCompo.fatMassKg - prevCompo.fatMassKg).toFixed(1);
  const deltaMuscle = (currCompo.muscleMassKg - prevCompo.muscleMassKg).toFixed(1);

  const photoContext = hasPrevPhoto
    ? `Tu reçois DEUX séries de photos : d'abord les photos de S${weekNumber - 1} (AVANT), puis les photos de S${weekNumber} (APRÈS). Compare-les directement.`
    : `Tu reçois uniquement les photos de S${weekNumber}. Pas de photos S${weekNumber - 1} disponibles — évalue la cohérence des chiffres avec le physique actuel.`;

  return `Tu es un expert en transformation physique pour une compétition sur 8 semaines.

Semaine ${weekNumber}/8 — ${photoContext}

Mesures S${weekNumber - 1} → S${weekNumber} :
- Poids : ${prevCompo.weightKg} kg → ${currCompo.weightKg} kg (${parseFloat(deltaWeight) > 0 ? '+' : ''}${deltaWeight} kg)
- Masse grasse : ${prevCompo.fatMassKg} kg (${prevFatPct}%) → ${currCompo.fatMassKg} kg (${fatPct}%) (${parseFloat(deltaFat) > 0 ? '+' : ''}${deltaFat} kg)
- Masse musculaire : ${prevCompo.muscleMassKg} kg → ${currCompo.muscleMassKg} kg (${parseFloat(deltaMuscle) > 0 ? '+' : ''}${deltaMuscle} kg)

Évalue la COHÉRENCE entre l'évolution déclarée et ce qui est visible sur les photos.

Points de vigilance :
- Une perte de graisse déclarée est-elle compatible avec la transformation visible ?
- Une variation importante (>1.5 kg de graisse en 1 semaine) peut être de la rétention d'eau — ne pénalise pas automatiquement si le physique reste crédible
- Les proportions musculaires sont-elles stables ou évoluent-elles de façon cohérente ?

Réponds UNIQUEMENT en JSON strict, sans markdown :
{"credibilityScore": <entier 0-100>, "analysis": "<2-3 phrases en français, directes et précises>"}

Barème :
85-100 : évolution cohérente, transformation visible et crédible
65-84 : bonne cohérence globale, légères incertitudes
45-64 : cohérence partielle, doutes modérés
25-44 : incohérences importantes entre chiffres et photos
0-24 : évolution déclarée très peu crédible au regard des photos`;
}

export async function runAIAnalysis(params: AIAnalysisParams): Promise<AIAnalysisResult> {
  const { userId, weekNumber, prevCompo, currCompo, photo, prevPhoto, apiKey } = params;

  const hasPrevPhoto = !!prevPhoto;
  const prompt = buildPrompt(weekNumber, currCompo, prevCompo, hasPrevPhoto);

  // Build image list — prevPhoto first (AVANT), then current (APRÈS)
  const images: object[] = [];

  if (prevPhoto) {
    const prevFront = parseBase64(prevPhoto.frontBase64);
    images.push({ type: 'image', source: { type: 'base64', media_type: prevFront.mediaType, data: prevFront.data } });
    if (prevPhoto.sideBase64) {
      const prevSide = parseBase64(prevPhoto.sideBase64);
      images.push({ type: 'image', source: { type: 'base64', media_type: prevSide.mediaType, data: prevSide.data } });
    }
  }

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
      max_tokens: 400,
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
  const raw: string = json.content?.[0]?.text ?? '';

  // Strip markdown code blocks
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  let parsed: { credibilityScore: number; analysis: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*"credibilityScore"[\s\S]*\}/);
    try {
      parsed = match ? JSON.parse(match[0]) : { credibilityScore: 50, analysis: cleaned };
    } catch {
      parsed = { credibilityScore: 50, analysis: cleaned };
    }
  }

  return {
    userId,
    weekNumber,
    credibilityScore: Math.max(0, Math.min(100, Math.round(parsed.credibilityScore))),
    analysis: parsed.analysis,
    generatedAt: new Date().toISOString(),
  };
}
