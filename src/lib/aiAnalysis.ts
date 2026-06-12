import { AIAnalysisResult, BodyComposition, WeeklyPhoto, Intensity, DailyLog, CustomRitual } from '../types';

interface AIAnalysisParams {
  userId: string;
  weekNumber: number;
  prevCompo: BodyComposition | null;
  currCompo: BodyComposition;
  photo: WeeklyPhoto;
  prevPhoto?: WeeklyPhoto;
  apiKey: string;
  durationWeeks?: number;
  intensity?: Intensity;
  sex?: 'M' | 'F';
  weekLogs?: DailyLog[];
  targetKcal?: number;
  dailyDeficit?: number;
  customRituals?: CustomRitual[];
}

// Seuils de plausibilité de perte de graisse par rythme (% du poids corporel/semaine).
// maxPlausiblePct : plausible avec marge d'erreur d'impédance (~±0.5 kg sur la MG).
// impossiblePct   : physiologiquement impossible même à ce déficit.
const INTENSITY_FAT_LOSS: Record<Intensity, { label: string; deficit: string; maxPlausiblePct: number; impossiblePct: number }> = {
  safe:     { label: 'SÛRE',     deficit: '~300 kcal/j', maxPlausiblePct: 0.008, impossiblePct: 0.013 },
  standard: { label: 'STANDARD', deficit: '~500 kcal/j', maxPlausiblePct: 0.012, impossiblePct: 0.018 },
  flow:     { label: 'FLOW',     deficit: '~700 kcal/j', maxPlausiblePct: 0.015, impossiblePct: 0.022 },
};

function buildBehaviorBlock(
  weekLogs: DailyLog[] | undefined,
  targetKcal: number | undefined,
  dailyDeficit: number | undefined,
  weekNumber: number,
  customRituals?: CustomRitual[]
): string {
  if (!weekLogs || weekLogs.length === 0) return '';

  const sorted = [...weekLogs].sort((a, b) => a.date.localeCompare(b.date));
  const confirmedCount = sorted.filter((l) => l.codeConfirmed).length;

  const dayDetails = sorted.map((log) => {
    const keys = Object.keys(log.rituals);
    const done = Object.values(log.rituals).filter(Boolean).length;
    const total = keys.length > 0 ? keys.length : (customRituals?.length ?? '?');
    const pct = typeof total === 'number' && total > 0 ? Math.round((done / total) * 100) : '?';
    return `${log.date.slice(5)}: ${done}/${total} (${pct}%)`;
  }).join(' · ');

  const pcts = sorted
    .map((log) => {
      const keys = Object.keys(log.rituals);
      const done = Object.values(log.rituals).filter(Boolean).length;
      return keys.length > 0 ? done / keys.length : null;
    })
    .filter((v): v is number => v !== null);
  const avgPct = pcts.length > 0 ? Math.round((pcts.reduce((s, v) => s + v, 0) / pcts.length) * 100) : 0;
  const perfectDays = pcts.filter((p) => p >= 0.99).length;

  const dailyWeights = sorted.filter((l) => l.weightKg != null).map((l) => `${l.date.slice(5)}: ${l.weightKg} kg`).join(', ');

  let block = `\nCOMPORTEMENT DÉCLARÉ (semaine ${weekNumber})
- Jours avec code confirmé : ${confirmedCount}/7
- Complétion des rituels : ${dayDetails}
- Moyenne hebdomadaire : ${avgPct}% · Jours à 100% : ${perfectDays}/7`;

  if (targetKcal && dailyDeficit) {
    const maxFatLoss = ((dailyDeficit * 7) / 7700).toFixed(2);
    block += `\n- Objectif calorique : ${targetKcal} kcal/j · Déficit déclaré : ~${dailyDeficit} kcal/j → perte de graisse théorique max : ~${maxFatLoss} kg/semaine`;
  }
  if (dailyWeights) block += `\n- Pesées quotidiennes : ${dailyWeights}`;

  const maxFatFromDeficit = targetKcal && dailyDeficit ? ((dailyDeficit * 7) / 7700).toFixed(2) : null;

  block += `\n\nLIMITATIONS DES BALANCES À IMPÉDANCE (BIA) — contexte critique
Les balances BIA (InBody, Tanita, appareils de salle de sport) mesurent la résistance électrique au courant, puis infèrent la composition corporelle via une formule qui suppose une hydratation constante de la masse maigre (~73%). Ce modèle produit des erreurs systématiques dans ces situations :
- Entraînement dans les 12h précédant la mesure → déplétion glycogénique → moins d'eau dans les muscles → machine sous-estime la masse musculaire et surestime la graisse
- Jeûne prolongé (OMAD, jeûne intermittent) → même effet
- Mesure prise dans des conditions différentes de S0 (heure, repas, hydratation) → comparaison invalide
- Marge d'erreur sur le % de masse grasse : ±2 à 3% selon les études — une variation de 1% entre deux semaines est dans le bruit de mesure
- Une perte de poids réelle combinée à une légère hausse de % graisse peut indiquer uniquement une perte d'eau musculaire, pas une réalité biologique.

RAISONNEMENT DIAGNOSTIQUE — tu dois systématiquement distinguer ces deux cas :

CAS 1 — ARTEFACT DE MESURE (comportement fort + résultats BIA incohérents) :
Indicateurs : rituels complétés à ≥60% en moyenne, ≥4 jours confirmés, entraînements effectués, pesées quotidiennes montrant une tendance à la baisse, déficit calorique respecté.
→ Les résultats BIA contradictoires (ex : perte de poids mais hausse du % graisse) s'expliquent par les biais de la balance. Préconise une remesure en conditions standard : matin à jeun, 12h sans entraînement, même appareil, même heure.

CAS 2 — NON-RESPECT DU PROGRAMME (comportement faible + résultats stagnants) :
Indicateurs : <40% de complétion des rituels, <3 jours confirmés, pas de pesées quotidiennes, stagnation ou régression sans explication hydrique.
→ La stagnation est cohérente avec un manque de rigueur sur la diète et les entraînements. Signal d'alerte sur la crédibilité déclarée.

CAS MIXTE : comportement moyen + résultats ambigus → mentionne les deux hypothèses sans trancher.
${targetKcal && dailyDeficit ? `\n- Rappel : déficit de ${dailyDeficit} kcal/j → perte de graisse réelle max théorique ~${maxFatFromDeficit} kg/semaine (hors eau).` : ''}
${perfectDays === 7 ? '\n- TOUS les jours à 100% : croise avec les données biologiques — si les résultats ne suivent pas, incohérence probable.' : ''}
${confirmedCount === 0 ? '\n- 0 jours confirmés + résultats déclarés positifs = incohérence forte.' : confirmedCount <= 2 ? '\n- Très peu de jours confirmés : cohérence avec une perte significative est douteuse.' : ''}\n`;

  return block;
}

function parseBase64(dataUrl: string): { mediaType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Format photo invalide');
  return { mediaType: match[1], data: match[2] };
}

function fmt(n: number, decimals = 1): string {
  return (n >= 0 ? '+' : '') + n.toFixed(decimals);
}

// Le modèle imbrique parfois un second objet JSON complet dans le champ "analysis" —
// on déballe récursivement pour récupérer le résultat réellement destiné à l'utilisateur.
function unwrapNestedAnalysis(parsed: { credibilityScore: number; analysis: string; motivation?: string }): { credibilityScore: number; analysis: string; motivation?: string } {
  if (typeof parsed.analysis !== 'string') return parsed;
  const trimmed = parsed.analysis.trim();
  if (!trimmed.startsWith('{') || !trimmed.includes('"credibilityScore"')) return parsed;

  let inner: { credibilityScore: number; analysis: string; motivation?: string } | null = null;
  try {
    inner = JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*"credibilityScore"[\s\S]*\}/);
    if (match) {
      try {
        inner = JSON.parse(match[0]);
      } catch {
        inner = null;
      }
    }
  }

  if (inner && typeof inner.credibilityScore === 'number' && typeof inner.analysis === 'string') {
    return unwrapNestedAnalysis(inner);
  }
  return parsed;
}

function buildEgoVoiceBlock(sex: 'M' | 'F' | undefined): string {
  if (sex === 'M') {
    return `
VOIX FATLOCK — ÉGO MASCULIN
Tu es aussi le coach qui parle à cet homme après le verdict. Ton ton : direct, brutal, compétitif. Pas de consolation molle. L'ego masculin se forge dans la vérité, pas le confort.
- Si comportement fort malgré résultats trompeurs → stimule : "Ton ego a tenu. Les chiffres mentent, la discipline ne ment pas."
- Si résultats excellents → challenge de ne pas s'arrêter : "Tu avances. L'Apex ne s'installe pas — il continue."
- Si comportement faible → réprimande directe sans pitié : "Ton ego mérite mieux que ça. Les excuses ne transforment pas un corps."
- Si cohérence parfaite → valide et pousse plus loin : "C'est ça. Maintenant creuse encore."
Le champ "motivation" doit être 1 à 2 phrases percutantes, style Blue Lock, qui stimulent l'égo masculin selon le diagnostic.`;
  }
  return `
VOIX FATLOCK — ÉGO FÉMININ
Tu es aussi le coach qui parle à cette femme après le verdict. Ton ton : puissant, identitaire, sans complaisance. L'ego féminin se révèle dans la constance et la fierté du processus.
- Si comportement fort malgré résultats trompeurs → honore la rigueur : "Tu n'as pas transigé. Les chiffres de la machine ne définissent pas ta transformation."
- Si résultats excellents → célèbre et challenge : "Tu forges quelque chose de rare. Ne t'arrête pas au seuil de l'élite."
- Si comportement faible → interpelle l'identité : "Le corps se souvient de chaque choix. Cette semaine, que lui as-tu dit ?"
- Si cohérence parfaite → valide avec intensité : "C'est exactement ça. Continue à être sans concession."
Le champ "motivation" doit être 1 à 2 phrases percutantes, style Blue Lock, qui stimulent l'égo féminin selon le diagnostic.`;
}

function buildPrompt(
  weekNumber: number,
  currCompo: BodyComposition,
  prevCompo: BodyComposition | null,
  hasPrevPhoto: boolean,
  durationWeeks = 8,
  intensity: Intensity = 'standard',
  behaviorBlock = '',
  sex?: 'M' | 'F'
): string {
  const egoBlock = buildEgoVoiceBlock(sex);
  const mgPct = ((currCompo.fatMassKg / currCompo.weightKg) * 100).toFixed(1);
  const eauPct = currCompo.waterPercent?.toFixed(0) ?? 'N/A';
  const ic = INTENSITY_FAT_LOSS[intensity];
  const maxPlausibleKg = (currCompo.weightKg * ic.maxPlausiblePct).toFixed(2);
  const impossibleKg   = (currCompo.weightKg * ic.impossiblePct).toFixed(2);
  const intensityBlock = `RYTHME DU PARTICIPANT : ${ic.label} (déficit ${ic.deficit})\nPerte de graisse hebdomadaire plausible à ce rythme : jusqu'à ${maxPlausibleKg} kg. Au-delà de ${impossibleKg} kg : impossible physiologiquement.\n\n`;

  // ── VERSION 1 : Semaine 1, sans photo S0 ────────────────────────────────────
  if ((weekNumber === 1 || !prevCompo) && !hasPrevPhoto) {
    const dPoids  = prevCompo ? fmt(currCompo.weightKg    - prevCompo.weightKg)    : 'N/A';
    const dMG     = prevCompo ? fmt(currCompo.fatMassKg   - prevCompo.fatMassKg)   : 'N/A';
    const dMM     = prevCompo ? fmt(currCompo.muscleMassKg - prevCompo.muscleMassKg) : 'N/A';

    return `Tu es un juge d'intégrité pour un challenge de transformation physique sur ${durationWeeks} semaines. Tu évalues la CRÉDIBILITÉ des données déclarées par un participant, pas sa performance. Score élevé = données cohérentes et plausibles. Score bas = incohérence interne ou claim physiologiquement impossible.

${intensityBlock}${behaviorBlock}CONTEXTE PHOTO
Tu reçois 1 seule photo : celle de la Semaine 1. Aucune photo antérieure n'est disponible. Tu ne peux donc PAS évaluer une évolution visuelle — n'invente aucune progression.

DONNÉES DÉCLARÉES
- Poids actuel : ${currCompo.weightKg} kg
- Masse grasse : ${currCompo.fatMassKg} kg (${mgPct} %)
- Masse musculaire : ${currCompo.muscleMassKg} kg
- Eau : ${eauPct} %
- Variation vs mesure de départ : poids ${dPoids} kg | masse grasse ${dMG} kg | masse musculaire ${dMM} kg

RÈGLES PHYSIOLOGIQUES — CONTEXTE DÉBUT DE CHALLENGE (S1)
La transition d'une alimentation riche en glucides simples/aliments transformés vers une alimentation saine et protéinée provoque en S1 des effets massifs SANS lien avec la triche :
- Dépletion du glycogène musculaire et hépatique → libère 2 à 4 kg d'eau liée (1g glycogène = 3-4g eau)
- Réduction de la rétention d'eau inflammatoire due aux aliments transformés
- Réduction du bol alimentaire (aliments plus denses, moins de volume intestinal)
- Résultat : perte de poids apparente de 2 à 6 kg en S1, dont la quasi-totalité est de l'eau — PAS de la graisse réelle.
De plus, les mesures S0 ont pu être prises sans jeûne (après un repas normal, en soirée) alors que S1 est pris le matin à jeun. Cet écart de conditions peut créer un gap supplémentaire de 1 à 3 kg qui ne reflète aucune perte réelle.
CONCLUSION : cette tolérance maximale s'applique STRICTEMENT à la rubrique 1 (plausibilité de la perte de masse grasse) — une perte élevée en S1, même spectaculaire, ne doit JAMAIS faire baisser la rubrique 1.
ATTENTION : cette tolérance ne s'étend PAS aux rubriques 2 et 3. Pour la rubrique 2 (cohérence interne), calcule et compare réellement ${dPoids} à la somme des variations (graisse + muscle + eau estimée) : un écart important reste un écart, même en S1, et doit faire baisser la note en conséquence. Pour la rubrique 3 (stabilité musculaire), une variation de ${dMM} supérieure à 0,5 kg reste anormale même en S1.
- Les balances à impédance ont ±1 à 2 kg d'erreur sur la masse grasse et confondent systématiquement perte d'eau et graisse — utilise cette marge pour juger la rubrique 2, pas pour l'ignorer totalement.
- Tu NE PEUX PAS voir une perte de graisse ≤ 2 kg sur une photo. L'absence de changement visible est normale (rubrique 4).

GRILLE DE SCORING — note chaque rubrique sur une échelle continue (pas seulement des valeurs rondes), puis additionne (total /100). Deux participants avec des données légèrement différentes doivent obtenir des notes légèrement différentes.

1. Plausibilité de la perte de masse grasse — /30
   25-30 : ${dMG} cohérent, ou perte élevée explicable par l'eau/glycogène en S1 (30 = parfaitement cohérent, 25 = léger excès)
   10-24 : perte annoncée extrême mais pas strictement impossible — plus l'excès est important, plus la note est basse
   0-9   : perte de graisse réellement impossible (> ~4 kg réels en 1 semaine) — note selon la sévérité

2. Cohérence interne des métriques — /30
   25-30 : ${dPoids} ≈ somme des variations (graisse + muscle + eau), à la marge de mesure près (30 = parfaite, 25 = écart minime)
   10-24 : écart inexpliqué modéré — plus l'écart est grand, plus la note est basse
   0-9   : contradiction nette (ex : poids stable mais −3 kg de graisse sans gain musculaire ni perte d'eau)

3. Stabilité de la masse musculaire — /20
   17-20 : |${dMM}| ≤ 0,5 kg (20 = variation nulle, 17 = proche de 0,5)
   8-16  : entre 0,5 et 1,5 kg — plus proche de 1,5, plus la note est basse
   0-7   : variation > 1,5 kg en une semaine (impossible)

4. Cohérence photo / % de masse grasse déclaré — /20
   17-20 : la silhouette est compatible avec ${mgPct} %
   8-16  : léger décalage
   0-7   : contradiction flagrante (ex : 10 % déclaré mais aucune définition visible, ou silhouette nettement plus grasse)

RÈGLE DE DIFFÉRENCIATION ET D'ANCRAGE — IMPORTANT
- Ce participant a des chiffres réels qui lui sont propres (${dPoids}, ${dMG}, ${dMM}, ${mgPct} % ci-dessus, ainsi que le contenu visuel de sa photo). Pour chaque rubrique, situe d'abord la valeur réelle de CE participant dans la plage indiquée, puis choisis une note qui reflète précisément cette position — n'attribue jamais une note "par défaut" ou "ronde" parce que ça semble être un bon score global.
- Calcule chaque rubrique avec une précision décimale interne (ex : 23,4/25 plutôt que 25/20/15/10/5/0), en te basant sur la valeur EXACTE de ${dPoids}, ${dMG}, ${dMM} et ${mgPct} (fournies à 0,1 près). N'arrondis qu'à la toute fin, sur la somme totale. Deux participants ayant des décimales différentes sur ces variables ne devraient presque jamais obtenir le même score final.
- Les bornes basses (0-9, 0-7, etc.) restent pleinement utilisables en cas de contradiction nette ou d'impossibilité réelle : la consigne de continuité porte sur la granularité à l'intérieur d'une tranche, pas sur un adoucissement des pénalités justifiées.
- Avant de répondre, vérifie : si tu donnais ce même score à un participant dont ${dPoids}, ${dMG} ou ${dMM} seraient sensiblement différents, ce score serait-il toujours juste ? Si oui, c'est que tu n'as pas assez tenu compte des chiffres réels de CE participant — reprends rubrique par rubrique.

SCORE FINAL = somme des 4 rubriques (nombre entier, pas nécessairement rond).
${egoBlock}
Réponds UNIQUEMENT avec ce JSON, sans texte autour ni balises Markdown :
{"credibilityScore": <0-100>, "analysis": "<3 à 4 phrases factuelles : données observées, diagnostic CAS 1/2/mixte, recommandation concrète>", "motivation": "<1 à 2 phrases style FATLOCK/Blue Lock selon le sexe du participant et le diagnostic>"}`;
  }

  // ── VERSION 2 : Semaine 1, avec photo S0 ────────────────────────────────────
  if ((weekNumber === 1 || !prevCompo) && hasPrevPhoto) {
    const dPoids  = prevCompo ? fmt(currCompo.weightKg     - prevCompo.weightKg)     : 'N/A';
    const dMG     = prevCompo ? fmt(currCompo.fatMassKg    - prevCompo.fatMassKg)    : 'N/A';
    const dMM     = prevCompo ? fmt(currCompo.muscleMassKg - prevCompo.muscleMassKg) : 'N/A';

    return `Tu es un juge d'intégrité pour un challenge de transformation physique sur ${durationWeeks} semaines. Tu évalues la CRÉDIBILITÉ des données déclarées par un participant, pas sa performance. Score élevé = données cohérentes et plausibles. Score bas = incohérence interne, claim impossible ou photo non authentique.

${intensityBlock}${behaviorBlock}ORDRE DES PHOTOS — IMPORTANT
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

RÈGLES PHYSIOLOGIQUES — CONTEXTE DÉBUT DE CHALLENGE (S1)
La transition d'une alimentation riche en glucides simples/aliments transformés vers une alimentation saine et protéinée provoque en S1 des effets massifs SANS lien avec la triche :
- Dépletion du glycogène musculaire et hépatique → libère 2 à 4 kg d'eau liée (1g glycogène = 3-4g eau)
- Réduction de la rétention d'eau inflammatoire due aux aliments transformés
- Réduction du bol alimentaire (aliments plus denses, moins de volume intestinal)
- Résultat : perte de poids apparente de 2 à 6 kg en S1, dont la quasi-totalité est de l'eau — PAS de la graisse réelle.
De plus, la photo et mesure S0 ont pu être prises sans jeûne (après un repas normal, en soirée) alors que S1 est pris le matin à jeun. Cet écart de conditions peut créer un gap supplémentaire de 1 à 3 kg qui ne reflète aucune perte réelle. La photo S0 peut aussi montrer une silhouette plus gonflée qu'en réalité pour cette raison.
CONCLUSION : cette tolérance maximale s'applique STRICTEMENT à la rubrique 1 (plausibilité de la perte de masse grasse) — une perte élevée en S1, même spectaculaire, ne doit JAMAIS faire baisser la rubrique 1.
ATTENTION : cette tolérance ne s'étend PAS aux rubriques 2, 3 et 5. Pour la rubrique 2 (cohérence interne), calcule et compare réellement ${dPoids} à la somme des variations (graisse + muscle + eau estimée) : un écart important reste un écart, même en S1, et doit faire baisser la note en conséquence. Pour la rubrique 3 (stabilité musculaire), une variation de ${dMM} supérieure à 0,5 kg reste anormale même en S1. Pour la rubrique 5 (authenticité), "ne rien voir de différent est normal" s'applique à l'ABSENCE de changement visible lié à la perte de poids — pas à une photo manifestement réutilisée (même pose exacte, même éclairage, même arrière-plan au pixel près) ni à une silhouette qui contredit franchement la direction déclarée : ces signaux restent pleinement pénalisables.
- Les balances à impédance ont ±1 à 2 kg d'erreur sur la masse grasse et confondent systématiquement perte d'eau et graisse — utilise cette marge pour juger la rubrique 2, pas pour l'ignorer totalement.

GRILLE DE SCORING — note chaque rubrique sur une échelle continue (pas seulement des valeurs rondes), puis additionne (total /100). Deux participants avec des données légèrement différentes doivent obtenir des notes légèrement différentes.

1. Plausibilité de la perte de masse grasse — /25
   21-25 : cohérent ou perte élevée explicable par l'eau/glycogène en S1 (25 = parfaitement cohérent)
   8-20  : extrême mais pas strictement impossible — plus l'excès est important, plus la note est basse
   0-7   : > ~4 kg de graisse réelle en 1 semaine (impossible)

2. Cohérence interne des métriques — /25
   21-25 : ${dPoids} ≈ somme des variations (graisse + muscle + eau)
   8-20  : écart inexpliqué modéré — note selon l'ampleur de l'écart
   0-7   : contradiction nette (poids stable mais grosse perte de graisse sans gain musculaire ni perte d'eau)

3. Stabilité de la masse musculaire — /15
   13-15 : |${dMM}| ≤ 0,5 kg
   5-12  : entre 0,5 et 1,5 kg — plus proche de 1,5, plus la note est basse
   0-4   : > 1,5 kg en une semaine

4. Cohérence photo S1 / % de masse grasse déclaré — /15
   13-15 : silhouette compatible avec ${mgPct} %
   5-12  : léger décalage
   0-4   : contradiction flagrante

5. Authenticité et cohérence visuelle S0 → S1 — /20
   17-20 : les deux photos sont distinctes (pose, angle, tenue ou lumière différents) et ne contredisent pas les données ; l'absence de différence visible compte comme normale et vaut le plein
   8-16  : doute léger sur la réutilisation
   0-7   : photo manifestement réutilisée (pose, tenue, lumière et fond identiques) OU la silhouette contredit franchement la direction déclarée

RÈGLE DE DIFFÉRENCIATION ET D'ANCRAGE — IMPORTANT
- Ce participant a des chiffres réels qui lui sont propres (${dPoids}, ${dMG}, ${dMM}, ${mgPct} % ci-dessus, ainsi que le contenu visuel de ses deux photos). Pour chaque rubrique, situe d'abord la valeur réelle de CE participant dans la plage indiquée, puis choisis une note qui reflète précisément cette position — n'attribue jamais une note "par défaut" ou "ronde" parce que ça semble être un bon score global.
- Calcule chaque rubrique avec une précision décimale interne (ex : 23,4/25 plutôt que 25/20/15/10/5/0), en te basant sur la valeur EXACTE de ${dPoids}, ${dMG}, ${dMM} et ${mgPct} (fournies à 0,1 près). N'arrondis qu'à la toute fin, sur la somme totale. Deux participants ayant des décimales différentes sur ces variables ne devraient presque jamais obtenir le même score final.
- Les bornes basses (0-9, 0-7, etc.) restent pleinement utilisables en cas de contradiction nette ou d'impossibilité réelle, y compris pour la rubrique 5 (photo manifestement réutilisée) : la consigne de continuité porte sur la granularité à l'intérieur d'une tranche, pas sur un adoucissement des pénalités justifiées.
- Avant de répondre, vérifie : si tu donnais ce même score à un participant dont ${dPoids}, ${dMG} ou ${dMM} seraient sensiblement différents, ce score serait-il toujours juste ? Si oui, c'est que tu n'as pas assez tenu compte des chiffres réels de CE participant — reprends rubrique par rubrique.

SCORE FINAL = somme des 5 rubriques (nombre entier, pas nécessairement rond).
${egoBlock}
Réponds UNIQUEMENT avec ce JSON, sans texte autour ni balises Markdown :
{"credibilityScore": <0-100>, "analysis": "<3 à 4 phrases factuelles : données observées, diagnostic CAS 1/2/mixte, recommandation concrète>", "motivation": "<1 à 2 phrases style FATLOCK/Blue Lock selon le sexe du participant et le diagnostic>"}`;
  }

  // ── VERSION 3 : Semaine 2+, avec ou sans photo précédente ───────────────────
  const dPoids  = fmt(currCompo.weightKg     - prevCompo!.weightKg);
  const dMG     = fmt(currCompo.fatMassKg    - prevCompo!.fatMassKg);
  const dMM     = fmt(currCompo.muscleMassKg - prevCompo!.muscleMassKg);

  return `Tu es un juge d'intégrité pour un challenge de transformation physique sur ${durationWeeks} semaines. Tu évalues la CRÉDIBILITÉ des données déclarées par un participant, pas sa performance. Score élevé = données cohérentes et plausibles. Score bas = incohérence interne, claim impossible ou photo non authentique.

${intensityBlock}${behaviorBlock}ORDRE DES PHOTOS — IMPORTANT
${hasPrevPhoto
  ? `Tu reçois 2 photos dans cet ordre exact :\n1) Photo 1 = semaine précédente S${weekNumber - 1}\n2) Photo 2 = semaine actuelle S${weekNumber}\nCompare TOUJOURS la photo 2 par rapport à la photo 1.`
  : `Tu reçois 1 seule photo : la semaine actuelle S${weekNumber}. Aucune comparaison visuelle possible, n'invente aucune progression.`}

DONNÉES DÉCLARÉES
- Poids actuel : ${currCompo.weightKg} kg
- Masse grasse : ${currCompo.fatMassKg} kg (${mgPct} %)
- Masse musculaire : ${currCompo.muscleMassKg} kg
- Eau : ${eauPct} %
- Variation vs semaine précédente : poids ${dPoids} kg | masse grasse ${dMG} kg | masse musculaire ${dMM} kg

RÈGLES PHYSIOLOGIQUES (semaine ${weekNumber})
${weekNumber === 2
  ? `- S2 : la transition alimentaire peut encore produire des effets résiduels de dépletion glycogénique et réduction d'eau inflammatoire. Une perte supérieure à ${maxPlausibleKg} kg reste possible sans être suspecte si S1 était exceptionnel. Applique une tolérance modérée.\n- Les mesures S0 ayant pu être prises hors jeûne (après repas), l'écart de conditions avec S2 peut encore amplifier les chiffres déclarés sans triche.`
  : `- À partir de S2, la dépletion en eau et glycogène est largement stabilisée. Applique les seuils du rythme déclaré.`}
- Rythme ${ic.label} : perte de graisse plausible ≤ ${maxPlausibleKg} kg/semaine (déficit ${ic.deficit} + marge d'impédance). Au-delà de ${impossibleKg} kg : impossible à ce rythme.
- Les balances à impédance gardent ±1 à 2 kg d'erreur sur la masse grasse.
- La masse musculaire ne varie pas de plus de ±0,5 kg en une semaine.
- Tu NE PEUX PAS voir une perte de graisse ≤ 2 kg entre deux photos. Ne rien voir de différent est NORMAL, jamais suspect.

GRILLE DE SCORING — note chaque rubrique sur une échelle continue (pas seulement des valeurs rondes), puis additionne. Deux participants avec des données légèrement différentes doivent obtenir des notes légèrement différentes.

1. Plausibilité de la perte de masse grasse — /25
   21-25 : perte de graisse ≤ ${maxPlausibleKg} kg (seuil rythme ${ic.label} + marge d'impédance) — 25 = nettement en dessous, 21 = juste à la limite
   8-20  : entre ${maxPlausibleKg} kg et ${impossibleKg} kg — note décroissante selon la proximité de ${impossibleKg} kg
   0-7   : > ${impossibleKg} kg (impossible à ce rythme)

2. Cohérence interne des métriques — /25
   21-25 : ${dPoids} ≈ somme des variations (graisse + muscle + eau)
   8-20  : écart inexpliqué modéré — note selon l'ampleur de l'écart
   0-7   : contradiction nette (ex : poids stable mais grosse perte de graisse sans gain musculaire ni perte d'eau)

3. Stabilité de la masse musculaire — /15
   13-15 : |${dMM}| ≤ 0,5 kg
   5-12  : entre 0,5 et 1,5 kg — plus proche de 1,5, plus la note est basse
   0-4   : > 1,5 kg en une semaine

4. Cohérence photo actuelle / % de masse grasse déclaré — /15
   13-15 : silhouette compatible avec ${mgPct} %
   5-12  : léger décalage
   0-4   : contradiction flagrante

5. Authenticité et cohérence visuelle — /20
${hasPrevPhoto
  ? `   17-20 : photos distinctes (pose, angle, tenue ou lumière différents) et non contradictoires ; l'absence de différence visible compte comme normale et vaut le plein
   8-16  : doute léger sur la réutilisation
   0-7   : photo manifestement réutilisée (pose, tenue, lumière et fond identiques) OU silhouette contredisant franchement la direction déclarée`
  : `   Tu n'as reçu qu'1 photo. N'applique PAS cette rubrique 5. Note uniquement les rubriques 1 à 4 (total /80) puis multiplie le score final par 1,25 pour le ramener sur 100.`}

RÈGLE DE DIFFÉRENCIATION ET D'ANCRAGE — IMPORTANT
- Ce participant a des chiffres réels qui lui sont propres (${dPoids}, ${dMG}, ${dMM}, ${mgPct} % ci-dessus, ainsi que le contenu visuel de ses photos). Pour chaque rubrique, situe d'abord la valeur réelle de CE participant dans la plage indiquée, puis choisis une note qui reflète précisément cette position — n'attribue jamais une note "par défaut" ou "ronde" parce que ça semble être un bon score global.
- Calcule chaque rubrique avec une précision décimale interne (ex : 23,4/25 plutôt que 25/20/15/10/5/0), en te basant sur la valeur EXACTE de ${dPoids}, ${dMG}, ${dMM} et ${mgPct} (fournies à 0,1 près). N'arrondis qu'à la toute fin, sur la somme totale. Deux participants ayant des décimales différentes sur ces variables ne devraient presque jamais obtenir le même score final.
- Les bornes basses (0-7, 0-4, etc.) restent pleinement utilisables en cas de contradiction nette ou d'impossibilité réelle, y compris pour la rubrique 5 (photo manifestement réutilisée) : la consigne de continuité porte sur la granularité à l'intérieur d'une tranche, pas sur un adoucissement des pénalités justifiées.
- Avant de répondre, vérifie : si tu donnais ce même score à un participant dont ${dPoids}, ${dMG} ou ${dMM} seraient sensiblement différents, ce score serait-il toujours juste ? Si oui, c'est que tu n'as pas assez tenu compte des chiffres réels de CE participant — reprends rubrique par rubrique.

SCORE FINAL = somme des rubriques applicables (voir condition rubrique 5), nombre entier pas nécessairement rond.
${egoBlock}
Réponds UNIQUEMENT avec ce JSON, sans texte autour ni balises Markdown :
{"credibilityScore": <0-100>, "analysis": "<3 à 4 phrases factuelles : données observées, diagnostic CAS 1/2/mixte, recommandation concrète>", "motivation": "<1 à 2 phrases style FATLOCK/Blue Lock selon le sexe du participant et le diagnostic>"}`;
}

// ── Analyse IA finale S0→S8 ───────────────────────────────────────────────────

interface FinalAIParams {
  userId: string;
  s0Photo: WeeklyPhoto;
  s8Photo: WeeklyPhoto;
  apiKey: string;
  durationWeeks?: number;
}

interface FinalAIRawResult {
  transformationScore: number;
  analysis: string;
}

function buildFinalPrompt(durationWeeks = 8): string {
  return `Tu es un juge visuel pour un challenge de transformation physique sur ${durationWeeks} semaines.

ORDRE DES PHOTOS — IMPORTANT
Tu reçois entre 2 et 4 photos dans cet ordre exact :
1) Photo(s) de DÉPART (S0) — face obligatoire, profil optionnel
2) Photo(s) FINALE (S8) — face obligatoire, profil optionnel

Compare TOUJOURS les photos S8 par rapport aux photos S0.

MISSION
Évalue uniquement l'évolution visuelle entre S0 et S8. Tu notes la progression observable, pas le niveau athlétique absolu. Une progression modeste mais authentique vaut plus qu'une transformation spectaculaire douteuse.

GRILLE DE SCORING — note chaque rubrique indépendamment (total /100)

1. Évolution de la silhouette — /40
   40 : changement net et visible (affinement, resserrement, meilleure définition)
   20 : évolution légère mais perceptible
   0  : aucun changement visible ou évolution négative

2. Maintien ou progression de la tonicité musculaire — /30
   30 : tonicité préservée ou améliorée malgré la perte de masse
   15 : neutre
   0  : perte musculaire visible non compensée

3. Authenticité et cohérence des photos — /30
   30 : les deux séries sont cohérentes, clairement la même personne, conditions comparables
   15 : léger doute (éclairage très différent, angle trompeur)
   0  : photos manifestement suspectes ou non comparables

RÈGLES
- Tu ne peux pas détecter une différence de graisse ≤ 2 kg sur une photo. Sois prudent dans tes affirmations.
- Ne juge pas la beauté ni le niveau athlétique absolu, uniquement l'évolution entre S0 et S8.
- L'absence de changement visible est une réalité physiologique possible, pas forcément de la triche.

Réponds UNIQUEMENT avec ce JSON, sans texte autour ni balises Markdown :
{"transformationScore": <0-100>, "analysis": "<2 à 3 phrases en français, directes et factuelles, décrivant l'évolution visible.>"}`;
}

export async function runFinalAIAnalysis(params: FinalAIParams): Promise<FinalAIRawResult> {
  const { s0Photo, s8Photo, apiKey, durationWeeks = 8 } = params;

  const images: object[] = [];
  // S0 d'abord
  const s0Front = parseBase64(s0Photo.frontBase64);
  images.push({ type: 'image', source: { type: 'base64', media_type: s0Front.mediaType, data: s0Front.data } });
  if (s0Photo.sideBase64) {
    const s0Side = parseBase64(s0Photo.sideBase64);
    images.push({ type: 'image', source: { type: 'base64', media_type: s0Side.mediaType, data: s0Side.data } });
  }
  // S8 ensuite
  const s8Front = parseBase64(s8Photo.frontBase64);
  images.push({ type: 'image', source: { type: 'base64', media_type: s8Front.mediaType, data: s8Front.data } });
  if (s8Photo.sideBase64) {
    const s8Side = parseBase64(s8Photo.sideBase64);
    images.push({ type: 'image', source: { type: 'base64', media_type: s8Side.mediaType, data: s8Side.data } });
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
      temperature: 0,
      messages: [{
        role: 'user',
        content: [...images, { type: 'text', text: buildFinalPrompt(durationWeeks) }],
      }],
    }),
  });

  if (!res.ok) throw new Error(`Erreur API Anthropic (${res.status}): ${await res.text()}`);

  const json = await res.json();
  const raw: string = json.content?.[0]?.text ?? '';
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  let parsed: FinalAIRawResult;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*"transformationScore"[\s\S]*\}/);
    try {
      parsed = match ? JSON.parse(match[0]) : { transformationScore: 50, analysis: cleaned };
    } catch {
      parsed = { transformationScore: 50, analysis: cleaned };
    }
  }

  return {
    transformationScore: Math.max(0, Math.min(100, Math.round(parsed.transformationScore))),
    analysis: parsed.analysis,
  };
}

export async function runAIAnalysis(params: AIAnalysisParams): Promise<AIAnalysisResult> {
  const { userId, weekNumber, prevCompo, currCompo, photo, prevPhoto, apiKey, durationWeeks = 8, intensity = 'standard', sex, weekLogs, targetKcal, dailyDeficit, customRituals } = params;

  const hasPrevPhoto = !!prevPhoto;
  const behaviorBlock = buildBehaviorBlock(weekLogs, targetKcal, dailyDeficit, weekNumber, customRituals);
  const prompt = buildPrompt(weekNumber, currCompo, prevCompo, hasPrevPhoto, durationWeeks, intensity, behaviorBlock, sex);

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
      max_tokens: 700,
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

  let parsed: { credibilityScore: number; analysis: string; motivation?: string };
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

  parsed = unwrapNestedAnalysis(parsed);

  return {
    userId,
    weekNumber,
    credibilityScore: Math.max(0, Math.min(100, Math.round(parsed.credibilityScore))),
    analysis: parsed.analysis,
    motivation: parsed.motivation,
    generatedAt: new Date().toISOString(),
  };
}

// ── Passage 2 : recalibration relative des scores de crédibilité ───────────
// Les scores individuels (passage 1) sont calculés sans connaissance des autres
// participants, ce qui produit des paliers récurrents (ex: plusieurs personnes à 78).
// Ce second appel, uniquement textuel (pas de photos), recalibre les scores en les
// comparant entre eux pour garantir une vraie hiérarchie différenciée.
export interface CalibrationInput {
  userId: string;
  name: string;
  initialScore: number;
  dPoids: number | null;
  dMG: number | null;
  dMM: number | null;
  mgPct: number;
}

export async function runCredibilityCalibration(
  participants: CalibrationInput[],
  apiKey: string
): Promise<Record<string, number>> {
  const fallback = Object.fromEntries(participants.map((p) => [p.userId, p.initialScore]));
  if (participants.length < 2) return fallback;

  const table = participants
    .map((p) => `- ${p.name} (id:${p.userId}) : score initial ${p.initialScore}/100 | Δpoids ${p.dPoids != null ? fmt(p.dPoids) : 'N/A'} kg | Δgraisse ${p.dMG != null ? fmt(p.dMG) : 'N/A'} kg | Δmuscle ${p.dMM != null ? fmt(p.dMM) : 'N/A'} kg | masse grasse ${p.mgPct.toFixed(1)} %`)
    .join('\n');

  const prompt = `Tu es un juge d'intégrité pour un challenge de transformation physique. Voici les scores de crédibilité calculés INDÉPENDAMMENT pour chaque participant de la semaine, accompagnés de leurs données numériques déclarées :

${table}

Ces scores ont été calculés un par un, sans comparaison entre participants, ce qui crée des paliers artificiels (plusieurs personnes au même score alors que leurs données diffèrent).

TA TÂCHE : recalibre ces scores en les comparant TOUS ENTRE EUX, pour produire une hiérarchie continue et différenciée.

RÈGLES :
- Deux participants dont les données (Δpoids, Δgraisse, Δmuscle, % masse grasse) diffèrent, même légèrement, doivent obtenir des scores finaux différents — sauf si leurs profils sont véritablement quasi identiques sur TOUS ces critères.
- Respecte l'ordre et l'esprit des scores initiaux : un participant nettement moins crédible que les autres doit rester nettement plus bas, un participant très crédible doit rester très haut. Tu ajustes la granularité, pas le classement global.
- Chaque ajustement reste modéré (quelques points), l'objectif est de casser les égalités artificielles, pas de réécrire l'évaluation.
- Scores entiers, plage 0-100.

Réponds UNIQUEMENT avec ce JSON, sans texte autour ni balises Markdown :
{"scores": {"<id>": <0-100>, ...}}`;

  try {
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
        max_tokens: 500,
        temperature: 0.3,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      }),
    });

    if (!res.ok) throw new Error(`Erreur API Anthropic (calibration) (${res.status}): ${await res.text()}`);

    const json = await res.json();
    const raw: string = json.content?.[0]?.text ?? '';
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    const parsed = JSON.parse(cleaned) as { scores?: Record<string, number> };

    const result: Record<string, number> = {};
    for (const p of participants) {
      const score = parsed.scores?.[p.userId];
      result[p.userId] = typeof score === 'number' ? Math.max(0, Math.min(100, Math.round(score))) : p.initialScore;
    }
    return result;
  } catch (err) {
    console.warn('Calibration IA échouée, scores initiaux conservés', err);
    return fallback;
  }
}
