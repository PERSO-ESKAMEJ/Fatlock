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

function fmt(n: number, decimals = 1): string {
  return (n >= 0 ? '+' : '') + n.toFixed(decimals);
}

function buildPrompt(
  weekNumber: number,
  currCompo: BodyComposition,
  prevCompo: BodyComposition | null,
  hasPrevPhoto: boolean
): string {
  const mgPct = ((currCompo.fatMassKg / currCompo.weightKg) * 100).toFixed(1);
  const eauPct = currCompo.waterPercent?.toFixed(0) ?? 'N/A';

  // ── VERSION 1 : Semaine 1, sans photo S0 ────────────────────────────────────
  if ((weekNumber === 1 || !prevCompo) && !hasPrevPhoto) {
    const dPoids  = prevCompo ? fmt(currCompo.weightKg    - prevCompo.weightKg)    : 'N/A';
    const dMG     = prevCompo ? fmt(currCompo.fatMassKg   - prevCompo.fatMassKg)   : 'N/A';
    const dMM     = prevCompo ? fmt(currCompo.muscleMassKg - prevCompo.muscleMassKg) : 'N/A';

    return `Tu es un juge d'intégrité pour un challenge de transformation physique sur 8 semaines. Tu évalues la CRÉDIBILITÉ des données déclarées par un participant, pas sa performance. Score élevé = données cohérentes et plausibles. Score bas = incohérence interne ou claim physiologiquement impossible.

CONTEXTE PHOTO
Tu reçois 1 seule photo : celle de la Semaine 1. Aucune photo antérieure n'est disponible. Tu ne peux donc PAS évaluer une évolution visuelle — n'invente aucune progression.

DONNÉES DÉCLARÉES
- Poids actuel : ${currCompo.weightKg} kg
- Masse grasse : ${currCompo.fatMassKg} kg (${mgPct} %)
- Masse musculaire : ${currCompo.muscleMassKg} kg
- Eau : ${eauPct} %
- Variation vs mesure de départ : poids ${dPoids} kg | masse grasse ${dMG} kg | masse musculaire ${dMM} kg

RÈGLES PHYSIOLOGIQUES
- En semaine 1, une forte perte de poids est NORMALE (eau, glycogène, déshydratation). Ne la pénalise pas.
- Les balances à impédance ont ±1 à 2 kg d'erreur sur la masse grasse et attribuent souvent la perte d'eau à de la graisse. En S1, une perte de masse grasse déclarée élevée n'est donc PAS un indice de triche.
- La masse musculaire ne varie pas de plus de ±0,5 kg en une semaine.
- Tu NE PEUX PAS voir une perte de graisse ≤ 2 kg sur une photo. L'absence de changement visible est normale.

GRILLE DE SCORING — note chaque rubrique indépendamment, puis additionne (total /100)

1. Plausibilité de la perte de masse grasse — /30
   30 : ${dMG} cohérent, ou perte élevée explicable par l'eau/glycogène en S1
   15 : perte annoncée extrême mais pas strictement impossible
   0  : perte de graisse réellement impossible (> ~4 kg réels en 1 semaine)

2. Cohérence interne des métriques — /30
   30 : ${dPoids} ≈ somme des variations (graisse + muscle + eau), à la marge de mesure près
   15 : écart inexpliqué modéré
   0  : contradiction nette (ex : poids stable mais −3 kg de graisse sans gain musculaire ni perte d'eau)

3. Stabilité de la masse musculaire — /20
   20 : |${dMM}| ≤ 0,5 kg
   10 : entre 0,5 et 1,5 kg
   0  : variation > 1,5 kg en une semaine (impossible)

4. Cohérence photo / % de masse grasse déclaré — /20
   20 : la silhouette est compatible avec ${mgPct} %
   10 : léger décalage
   0  : contradiction flagrante (ex : 10 % déclaré mais aucune définition visible, ou silhouette nettement plus grasse)

SCORE FINAL = somme des 4 rubriques.

Réponds UNIQUEMENT avec ce JSON, sans texte autour ni balises Markdown :
{"credibilityScore": <0-100>, "analysis": "<2 à 3 phrases en français, directes et factuelles, expliquant les points retirés. Aucun jugement moral, aucun conseil.>"}`;
  }

  // ── VERSION 2 : Semaine 1, avec photo S0 ────────────────────────────────────
  if ((weekNumber === 1 || !prevCompo) && hasPrevPhoto) {
    const dPoids  = prevCompo ? fmt(currCompo.weightKg     - prevCompo.weightKg)     : 'N/A';
    const dMG     = prevCompo ? fmt(currCompo.fatMassKg    - prevCompo.fatMassKg)    : 'N/A';
    const dMM     = prevCompo ? fmt(currCompo.muscleMassKg - prevCompo.muscleMassKg) : 'N/A';

    return `Tu es un juge d'intégrité pour un challenge de transformation physique sur 8 semaines. Tu évalues la CRÉDIBILITÉ des données déclarées par un participant, pas sa performance. Score élevé = données cohérentes et plausibles. Score bas = incohérence interne, claim impossible ou photo non authentique.

ORDRE DES PHOTOS — IMPORTANT
Tu reçois 2 photos dans cet ordre exact :
1) Photo 1 = état de DÉPART (S0, avant le challenge)
2) Photo 2 = Semaine 1 (S1, après une semaine)
Compare TOUJOURS la photo 2 par rapport à la photo 1.

DONNÉES DÉCLARÉES
- Poids actuel : ${currCompo.weightKg} kg
- Masse grasse : ${currCompo.fatMassKg} kg (${mgPct} %)
- Masse musculaire : ${currCompo.muscleMassKg} kg
- Eau : ${eauPct} %
- Variation S0 → S1 : poids ${dPoids} kg | masse grasse ${dMG} kg | masse musculaire ${dMM} kg

RÈGLES PHYSIOLOGIQUES
- En semaine 1, une forte perte de poids est NORMALE (eau, glycogène). Ne la pénalise pas.
- Les balances à impédance ont ±1 à 2 kg d'erreur sur la masse grasse et confondent souvent perte d'eau et graisse. Une perte de masse grasse déclarée élevée en S1 n'est donc PAS un indice de triche.
- La masse musculaire ne varie pas de plus de ±0,5 kg en une semaine.
- Tu NE PEUX PAS voir une perte de graisse ≤ 2 kg entre deux photos. Ne rien voir de différent est NORMAL, jamais suspect.

GRILLE DE SCORING — note chaque rubrique indépendamment, puis additionne (total /100)

1. Plausibilité de la perte de masse grasse — /25
   25 : cohérent ou perte élevée explicable par l'eau/glycogène en S1
   12 : extrême mais pas strictement impossible
   0  : > ~4 kg de graisse réelle en 1 semaine (impossible)

2. Cohérence interne des métriques — /25
   25 : ${dPoids} ≈ somme des variations (graisse + muscle + eau)
   12 : écart inexpliqué modéré
   0  : contradiction nette (poids stable mais grosse perte de graisse sans gain musculaire ni perte d'eau)

3. Stabilité de la masse musculaire — /15
   15 : |${dMM}| ≤ 0,5 kg
   7  : entre 0,5 et 1,5 kg
   0  : > 1,5 kg en une semaine

4. Cohérence photo S1 / % de masse grasse déclaré — /15
   15 : silhouette compatible avec ${mgPct} %
   7  : léger décalage
   0  : contradiction flagrante

5. Authenticité et cohérence visuelle S0 → S1 — /20
   20 : les deux photos sont distinctes (pose, angle, tenue ou lumière différents) et ne contredisent pas les données ; l'absence de différence visible compte comme normale et vaut le plein
   10 : doute léger sur la réutilisation
   0  : photo manifestement réutilisée (pose, tenue, lumière et fond identiques) OU la silhouette contredit franchement la direction déclarée

SCORE FINAL = somme des 5 rubriques.

Réponds UNIQUEMENT avec ce JSON, sans texte autour ni balises Markdown :
{"credibilityScore": <0-100>, "analysis": "<2 à 3 phrases en français, directes et factuelles, expliquant les points retirés. Aucun jugement moral, aucun conseil.>"}`;
  }

  // ── VERSION 3 : Semaine 2+, avec ou sans photo précédente ───────────────────
  const dPoids  = fmt(currCompo.weightKg     - prevCompo!.weightKg);
  const dMG     = fmt(currCompo.fatMassKg    - prevCompo!.fatMassKg);
  const dMM     = fmt(currCompo.muscleMassKg - prevCompo!.muscleMassKg);
  const maxMGLoss = (currCompo.weightKg * 0.01).toFixed(2);

  return `Tu es un juge d'intégrité pour un challenge de transformation physique sur 8 semaines. Tu évalues la CRÉDIBILITÉ des données déclarées par un participant, pas sa performance. Score élevé = données cohérentes et plausibles. Score bas = incohérence interne, claim impossible ou photo non authentique.

ORDRE DES PHOTOS — IMPORTANT
${hasPrevPhoto
  ? `Tu reçois 2 photos dans cet ordre exact :\n1) Photo 1 = semaine précédente S${weekNumber - 1}\n2) Photo 2 = semaine actuelle S${weekNumber}\nCompare TOUJOURS la photo 2 par rapport à la photo 1.`
  : `Tu reçois 1 seule photo : la semaine actuelle S${weekNumber}. Aucune comparaison visuelle possible, n'invente aucune progression.`}

DONNÉES DÉCLARÉES
- Poids actuel : ${currCompo.weightKg} kg
- Masse grasse : ${currCompo.fatMassKg} kg (${mgPct} %)
- Masse musculaire : ${currCompo.muscleMassKg} kg
- Eau : ${eauPct} %
- Variation vs semaine précédente : poids ${dPoids} kg | masse grasse ${dMG} kg | masse musculaire ${dMM} kg

RÈGLES PHYSIOLOGIQUES (semaine 2+)
- L'eau et le glycogène sont désormais stabilisés : la tolérance de la S1 ne s'applique PLUS.
- Perte de graisse réaliste : maximum ~1 % du poids corporel par semaine, soit environ ${maxMGLoss} kg pour ce participant.
- Les balances à impédance gardent ±1 à 2 kg d'erreur sur la masse grasse.
- La masse musculaire ne varie pas de plus de ±0,5 kg en une semaine.
- Tu NE PEUX PAS voir une perte de graisse ≤ 2 kg entre deux photos. Ne rien voir de différent est NORMAL, jamais suspect.

GRILLE DE SCORING — note chaque rubrique indépendamment, puis additionne

1. Plausibilité de la perte de masse grasse — /25
   25 : perte de graisse ≤ 1 % du poids (≈ ${maxMGLoss} kg)
   12 : entre 1 % et 2 % du poids (haute mais tolérée avec la marge d'impédance)
   0  : > 2 % du poids en une semaine (physiologiquement impossible hors S1)

2. Cohérence interne des métriques — /25
   25 : ${dPoids} ≈ somme des variations (graisse + muscle + eau)
   12 : écart inexpliqué modéré
   0  : contradiction nette (ex : poids stable mais grosse perte de graisse sans gain musculaire ni perte d'eau)

3. Stabilité de la masse musculaire — /15
   15 : |${dMM}| ≤ 0,5 kg
   7  : entre 0,5 et 1,5 kg
   0  : > 1,5 kg en une semaine

4. Cohérence photo actuelle / % de masse grasse déclaré — /15
   15 : silhouette compatible avec ${mgPct} %
   7  : léger décalage
   0  : contradiction flagrante

5. Authenticité et cohérence visuelle — /20
${hasPrevPhoto
  ? `   20 : photos distinctes (pose, angle, tenue ou lumière différents) et non contradictoires ; l'absence de différence visible compte comme normale et vaut le plein
   10 : doute léger sur la réutilisation
   0  : photo manifestement réutilisée (pose, tenue, lumière et fond identiques) OU silhouette contredisant franchement la direction déclarée`
  : `   Tu n'as reçu qu'1 photo. N'applique PAS cette rubrique 5. Note uniquement les rubriques 1 à 4 (total /80) puis multiplie le score final par 1,25 pour le ramener sur 100.`}

SCORE FINAL = somme des rubriques applicables (voir condition rubrique 5).

Réponds UNIQUEMENT avec ce JSON, sans texte autour ni balises Markdown :
{"credibilityScore": <0-100>, "analysis": "<2 à 3 phrases en français, directes et factuelles, expliquant les points retirés. Aucun jugement moral, aucun conseil.>"}`;
}

export async function runAIAnalysis(params: AIAnalysisParams): Promise<AIAnalysisResult> {
  const { userId, weekNumber, prevCompo, currCompo, photo, prevPhoto, apiKey } = params;

  const hasPrevPhoto = !!prevPhoto;
  const prompt = buildPrompt(weekNumber, currCompo, prevCompo, hasPrevPhoto);

  // Photos : prev (AVANT) d'abord, puis current (APRÈS)
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
      temperature: 0,
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
