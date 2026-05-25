import Anthropic from '@anthropic-ai/sdk';
import { AIAnalysisResult, BodyComposition, WeeklyPhoto } from '../types';

interface AnalysisInput {
  userId: string;
  weekNumber: number;
  prevCompo: BodyComposition | null;
  currCompo: BodyComposition;
  photo: WeeklyPhoto;
  apiKey: string;
}

interface RawAnalysis {
  credibilityScore: number;
  bodyCompositionCredibility: string;
  visualConsistency: string;
  progressObservations: string;
  recommendations: string;
  overallAnalysis: string;
}

export async function runAIAnalysis(input: AnalysisInput): Promise<AIAnalysisResult> {
  const { userId, weekNumber, prevCompo, currCompo, photo, apiKey } = input;

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const compoDiff = prevCompo
    ? {
        weightChange: +(currCompo.weightKg - prevCompo.weightKg).toFixed(2),
        muscleDelta: +(currCompo.muscleMassKg - prevCompo.muscleMassKg).toFixed(2),
        fatDelta: +(currCompo.fatMassKg - prevCompo.fatMassKg).toFixed(2),
        waterDelta: +(currCompo.waterPercent - prevCompo.waterPercent).toFixed(1),
      }
    : null;

  const systemPrompt = `Tu es un expert en analyse de composition corporelle et de transformation physique.
Tu analyses des photos de progression hebdomadaire et des données de composition corporelle pour évaluer la crédibilité et la cohérence des résultats déclarés.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après.`;

  const userPrompt = `Analyse la progression de la semaine ${weekNumber}.

Données composition corporelle actuelles:
- Poids: ${currCompo.weightKg} kg
- Masse musculaire: ${currCompo.muscleMassKg} kg
- Masse grasse: ${currCompo.fatMassKg} kg
- Eau: ${currCompo.waterPercent}%
- Masse osseuse: ${currCompo.boneMassKg} kg

${
  compoDiff
    ? `Évolution vs semaine précédente:
- Variation poids: ${compoDiff.weightChange > 0 ? '+' : ''}${compoDiff.weightChange} kg
- Variation musculaire: ${compoDiff.muscleDelta > 0 ? '+' : ''}${compoDiff.muscleDelta} kg
- Variation graisseuse: ${compoDiff.fatDelta > 0 ? '+' : ''}${compoDiff.fatDelta} kg
- Variation eau: ${compoDiff.waterDelta > 0 ? '+' : ''}${compoDiff.waterDelta}%`
    : 'Première mesure disponible.'
}

Évalue la crédibilité de ces données par rapport aux photos fournies.

Réponds en JSON avec exactement ce format:
{
  "credibilityScore": <0-100>,
  "bodyCompositionCredibility": "<évaluation en 1-2 phrases>",
  "visualConsistency": "<cohérence visuelle photo/données>",
  "progressObservations": "<observations sur la progression>",
  "recommendations": "<recommandations>",
  "overallAnalysis": "<analyse globale en 2-3 phrases>"
}`;

  const imageContent: Anthropic.ImageBlockParam[] = [];

  if (photo.frontBase64) {
    imageContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: photo.frontBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
      },
    });
  }

  if (photo.sideBase64) {
    imageContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: photo.sideBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
      },
    });
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: userPrompt },
        ],
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error("Pas de réponse texte de l'IA");
  }

  let parsed: RawAnalysis;
  try {
    parsed = JSON.parse(textContent.text) as RawAnalysis;
  } catch {
    throw new Error("Impossible de parser la réponse JSON de l'IA");
  }

  const credibilityScore = Math.max(0, Math.min(100, Math.round(parsed.credibilityScore)));
  const analysis = [
    parsed.overallAnalysis,
    '',
    `**Crédibilité composition:** ${parsed.bodyCompositionCredibility}`,
    '',
    `**Cohérence visuelle:** ${parsed.visualConsistency}`,
    '',
    `**Observations:** ${parsed.progressObservations}`,
    '',
    `**Recommandations:** ${parsed.recommendations}`,
  ].join('\n');

  return {
    userId,
    weekNumber,
    credibilityScore,
    analysis,
    generatedAt: new Date().toISOString(),
  };
}