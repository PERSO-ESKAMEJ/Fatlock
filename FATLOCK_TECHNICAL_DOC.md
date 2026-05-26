# FATLOCK — Documentation Technique Complète
> Version du document : 2026-05-26 (rev. 2)  
> Destinée à : Opus 4.7 pour audit de failles et chantiers d'amélioration

---

## 0. Mission du produit

FATLOCK est une PWA de challenge de transformation physique en groupe sur 8 semaines. Le groupe s'engage financièrement (mise), suit des rituels quotidiens, déclare des métriques hebdomadaires (poids, composition corporelle, photos), et reçoit un classement généré par l'admin chaque semaine. Une analyse IA (Claude Haiku) évalue la crédibilité des données déclarées pour limiter la triche.

---

## 1. Stack technique

| Couche | Techno |
|---|---|
| Framework UI | React 18 + TypeScript + Vite |
| State management | Zustand 5 + `persist` middleware (localStorage) |
| Routing | React Router v6 (HashRouter ou BrowserRouter) |
| Photos | IndexedDB via `idb` |
| Backend optionnel | Supabase (Postgres + Storage) |
| IA | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) via API Anthropic directe depuis le navigateur |
| Graphiques | Recharts |
| Styles | Tailwind CSS + variables CSS custom (`var(--bg)`, `var(--ink)`, etc.) |
| Déploiement | GitHub Pages (`base: '/Fatlock/'` dans vite.config) |

L'app est un SPA full client-side. Pas de serveur backend propre. Le backend Supabase est entièrement optionnel — l'app fonctionne hors ligne en local-only.

---

## 2. Modèle de données (types/index.ts)

### 2.1 Énumérations et primitives

```typescript
Sex = 'M' | 'F'
Intensity = 'safe' | 'standard' | 'flow'          // niveau d'engagement du participant
DayType = 'muscu_j1' | 'muscu_j2' | 'muscu_j3' | 'cardio' | 'repos'
ChallengeType = 'fatlock' | 'custom'
WeightDirection = 'down' | 'up' | 'stable'
CaloricDirection = 'deficit' | 'surplus' | 'manual'
PhotoTracking = 'required' | 'optional' | 'disabled'
RankTier = 'Corps Brut' | 'En Construction' | 'Challenger' | 'Affûté' | 'Élite' | 'Ego Manifeste' | 'Apex'
```

### 2.2 UserProfile
```typescript
{
  id: string                  // crypto.randomUUID() à la création
  name: string
  sex: Sex
  age: number
  height: number              // cm
  startWeight: number         // kg
  activityLevel: number       // 1.2 à 1.9 (multiplicateur TDEE)
  intensity: Intensity
  trainingDays: {             // planning semaine, chaque jour = DayType | null
    monday | tuesday | ... | sunday: DayType | null
  }
  groupCode: string           // code à 6 caractères partagé par le groupe
  isAdmin: boolean
  createdAt: string           // ISO date
}
```

### 2.3 ChallengeConfig
```typescript
{
  id: string                  // UUID partagé par TOUS les participants (transmis via invite link)
  groupName: string
  groupCode: string           // identique dans tous les profils du groupe
  groupSecret: string         // secret pour le code quotidien (algo djb2)
  startDate: string           // ISO date de départ
  stakeAmount: number         // mise en euros
  adminId: string             // userId de l'admin
  participantIds: string[]    // liste des userId
  anthropicApiKey?: string    // clé API Anthropic (admin only, stockée en localStorage)
  supabaseUrl?: string
  supabaseAnonKey?: string
  challengeType?: ChallengeType
  customSettings?: CustomChallengeSettings
}
```

### 2.4 DailyLog
```typescript
{
  userId: string
  date: string                // 'YYYY-MM-DD'
  codeConfirmed: boolean      // code quotidien validé ce jour-là
  dayType: DayType | null     // muscu, cardio, repos
  rituals: Record<string, boolean>   // { no_refined_sugar: true, ... }
  weightKg?: number           // pesée quotidienne optionnelle
  customMetricValue?: number
  notes?: string
}
```

### 2.5 BodyComposition
```typescript
{
  userId: string
  date: string
  weekNumber: number          // 0 = baseline S0, 1-8 = semaines du challenge
  weightKg: number
  muscleMassKg: number
  fatMassKg: number
  waterPercent: number
  boneMassKg: number
}
```

### 2.6 WeeklyPhoto
```typescript
{
  userId: string
  weekNumber: number          // 0 = photo de départ
  capturedAt: string
  frontBase64: string         // image encodée base64
  sideBase64: string
  backBase64?: string
}
```
⚠️ Les photos ne sont PAS stockées dans Supabase Postgres mais dans un bucket Storage (`fatlock-photos`), et en local dans IndexedDB. Le contenu base64 est potentiellement très volumineux.

### 2.7 AIAnalysisResult
```typescript
{
  userId: string
  weekNumber: number
  credibilityScore: number    // 0-100
  analysis: string            // 2-3 phrases en français
  generatedAt: string
}
```

### 2.8 WeeklyScore
```typescript
{
  userId: string
  weekNumber: number
  egoPoints: number           // points rituels bruts
  streakBonus: number         // bonus de streak (jours consécutifs valides × 5)
  aiBonus: number             // malus/bonus IA (-35 à +20 selon intensité)
  transformationScore: number // score de transformation corporelle
  regularityScore: number     // % jours avec code confirmé (0-100)
  totalComposite: number      // score composite final
}
```

### 2.9 LeaderboardEntry
```typescript
{
  userId: string
  name: string
  sex: Sex
  intensity: Intensity
  currentRank: number
  previousRank: number
  tier: RankTier
  cumulativeEgoPoints: number
  regularityPercent: number
  transformationPercent: number
  compositeScore: number
  currentStreak: number
  weeklyCredibilityScore?: number
}
```

### 2.10 RecapFile
Fichier JSON produit par chaque participant et envoyé à l'admin.
```typescript
{
  version: '1.0'
  userId, userName, challengeId, weekNumber, exportedAt
  profile: UserProfile
  dailyLogs: DailyLog[]
  bodyCompositions: BodyComposition[]
  weeklyPhotos: WeeklyPhoto[]        // base64 inclus !
  weeklyScores: WeeklyScore[]
  checksum: string                   // SHA-256 de tout le payload sans le checksum
}
```
⚠️ La taille du fichier peut être considérable (photos base64 incluses). Le checksum protège contre l'altération mais pas contre la fabrication from scratch.

### 2.11 MasterLeaderboard
```typescript
{
  challengeId: string
  updatedAt: string
  weekNumber: number
  entries: LeaderboardEntry[]
  weeklyHighlights: {
    biggestMover: string     // nom du participant
    topStreak: string
    topCredibility: string
  }
  aiAnalyses?: AIAnalysisResult[]    // résultats IA de tous les participants, distribués via Supabase
}
```

### 2.12 CustomChallengeSettings / CustomRitual
Pour les challenges "CUSTOMLOCK" configurés librement :
```typescript
CustomRitual = {
  id: string
  label: string
  points: 1 | 2 | 3          // multiplicateur (×10 dans le scoring)
  required: boolean           // détermine le seuil de validité d'un jour
}
CustomChallengeSettings = {
  description, durationWeeks (1-52), trackWeight, weightDirection,
  trackBodyFat, trackPhotos: PhotoTracking, customMetricLabel?,
  nutritionEnabled, caloricDirection, manualKcal?,
  rituals: CustomRitual[], aiAnalysisEnabled
}
```

Constante `FATLOCK_DEFAULT_CUSTOM_RITUALS` : 10 rituels prédéfinis utilisés comme base pour les challenges personnalisés (no_refined_sugar, protein_target_met, hydration_2L, sleep_7h, training_done comme required=true).

---

## 3. Architecture des stores (Zustand + persist)

### 3.1 useProfileStore (`fatlock-profile`)
Store principal. Gère les profils et challenges.

**État :**
- `entries: ProfileEntry[]` — liste de tous les groupes/profils locaux (multi-groupe)
- `activeId: string | null` — userId actif
- `profile: UserProfile | null` — profil actif (shortcut)
- `challenge: ChallengeConfig | null` — challenge actif (shortcut)

**Actions clés :**
- `addEntry(profile, challenge)` — ajoute ou écrase une entrée, active ce profil
- `switchEntry(profileId)` — change de groupe actif
- `updateProfile / updateChallenge` — mise à jour partielle, propage dans `entries`
- `reset()` — supprime le profil actif, passe au suivant
- `resetAll()` — efface tout

**Migration v0→v1 :** Si l'ancien format (profil unique sans `entries[]`) est détecté, il est automatiquement migré vers le nouveau format multi-entrée.

⚠️ **Faille** : La clé API Anthropic et les credentials Supabase sont stockés en clair dans localStorage via le persist de ce store.

### 3.2 useLogStore (`fatlock-logs`)
Toutes les données de suivi.

**État :**
- `dailyLogs: DailyLog[]`
- `bodyCompositions: BodyComposition[]`
- `weeklyScores: WeeklyScore[]`
- `aiResults: AIAnalysisResult[]`

**Actions clés :**
- `upsertDailyLog(log)` — insère ou remplace par (userId, date)
- `addBodyComposition(comp)` — upsert par (userId, weekNumber)
- `addWeeklyScore(score)` — upsert par (userId, weekNumber)
- `addAIResult(result)` — upsert par (userId, weekNumber)
- `getLatestBodyComp(userId)` — retourne la composition la plus récente (weekNumber max)

⚠️ **Faille** : Tous les utilisateurs ayant utilisé le même appareil partagent le même store. Le filtrage se fait à la volée par `userId` à chaque lecture. Si deux personnes partagent un iPhone, les données se mélangent dans le même store.

### 3.3 useLeaderboardStore (`fatlock-leaderboard`)
Classement officiel.

**État :**
- `masterLeaderboard: MasterLeaderboard | null`

**Actions :** `setMasterLeaderboard`, `getEntry(userId)`, `reset()`

### 3.4 useChallengeStore (`fatlock-challenge`)
Dates de confirmation du code quotidien.

**État :**
- `codeConfirmedDates: Record<string, string[]>` — dates 'YYYY-MM-DD' confirmées, indexées par `groupCode`

**Migration :** v1→v2 : l'ancienne structure `string[]` plate est abandonnée (impossible de mapper sans la clé de groupe) et réinitialisée.

**Actions :**
- `confirmCode(groupKey: string, date: string)` — ajoute la date à `codeConfirmedDates[groupKey]`
- `isCodeConfirmed(groupKey: string, date: string): boolean` — vérifie la présence dans `codeConfirmedDates[groupKey]`
- `reset()` — réinitialise à `{}`

**Fonctions utilitaires exportées :**
- `getChallengeState(startDate, durationWeeks?): 'pending' | 'active' | 'completed'`
- `getDaysUntilStart(startDate): number`
- `getCurrentWeek(startDate, durationWeeks?): number` — semaine courante (1–N) depuis la date de départ
- `getDaysRemaining(startDate, durationWeeks?): number` — jours restants jusqu'à la fin du challenge
- `getChallengeEndDate(startDate, durationWeeks?): string` — date de fin au format 'YYYY-MM-DD'

---

## 4. Structure de l'app (App.tsx + routing)

```
App.tsx
├── ToastProvider (contexte global)
├── useEffect → setupSupabase si credentials présents dans challenge
├── NavBar (si profil actif)
└── Routes
    /            → Welcome (onboarding)
    /dashboard   → Dashboard (accueil quotidien)
    /rituels     → Rituals (log quotidien)
    /nutrition   → Nutrition (objectifs macros)
    /entrainement→ Training (planning + séances)
    /checkin     → WeeklyCheckin (check-in hebdomadaire)
    /progression → Progress (graphiques + IA)
    /classement  → Leaderboard (classement + sync)
    /vote-final  → FinalVote
    /parametres  → Settings
    /dev         → DevSeed (seeding de données de test)
    *            → redirect dashboard ou /
```

`ProtectedRoute` : redirige vers `/` si `profile` ou `challenge` est null.

---

## 5. Flux complets

### 5.1 Flux d'onboarding (Welcome.tsx)

**Mode CREATE (créer un groupe) :**
1. Choix du type : FATLOCK ou CUSTOMLOCK
2. Si CUSTOMLOCK → configuration du challenge (durée, métriques, rituels personnalisés)
3. Saisie du profil (sexe, prénom, âge, taille, poids, niveau d'activité, intensité)
4. Sélection des jours d'entraînement (planning hebdo, chaque jour = DayType)
5. Affichage des objectifs nutritionnels calculés → confirmation
6. Configuration du challenge (nom de groupe, mise, date de départ)
7. `addEntry(profile, challenge)` → localStorage
8. Redirect `/dashboard`

**Mode JOIN (rejoindre un groupe) :**
1. URL params analysés : `?join=GROUPCODE&gname=NOM&cid=UUID`
2. Étapes identiques au mode CREATE pour le profil et planning
3. Challenge créé avec :
   - `id` = `cidParam` (UUID de l'admin transmis dans le lien — **critique pour l'alignement Supabase**)
   - `groupCode` = code du lien
   - `groupName` = nom du lien
   - `groupSecret` généré localement (**faille : différent de celui de l'admin**)
   - `adminId` = userId de l'admin (connu seulement si embedé dans le lien — **actuellement absent**)
4. `addEntry` → localStorage
5. Redirect `/dashboard`

⚠️ **Failles identifiées :**
- `groupSecret` généré localement pour le joineur → le code quotidien du joineur sera DIFFÉRENT de celui de l'admin. Chaque participant génère son propre secret et ne peut pas valider le code des autres.
- `adminId` non transmis dans le lien → le participant ne sait pas qui est l'admin
- `participantIds` non synchronisé → l'admin ne voit pas automatiquement qui a rejoint

### 5.2 Flux du log quotidien (Dashboard + Rituals)

**Dashboard :**
1. Affiche le code quotidien du jour (composant `DailyCode`)
2. Code calculé : `getDailyCode(groupSecret, dateStr)` → hash djb2 → adjectif+nombre
3. Le participant saisit le code reçu du groupe (Slack, WhatsApp) → `isTodaysCode()` → `confirmCode(date)`
4. `DailyLog.codeConfirmed = true` pour ce jour

**Rituals (page /rituels) :**
1. Sélection du type de jour (muscu_j1, cardio, repos...)
2. Affichage des rituels disponibles selon `dayType × intensity`
3. Cochage des rituels → `upsertDailyLog()`

**Calcul de validité d'un jour (`isDayValid`) :**
- Mode custom : ratio rituels cochés / pool (required en priorité) ≥ seuil d'intensité (flow:1.0, standard:0.8, safe:0.6)
- Mode standard : points bruts ≥ 60% des points max du jour

### 5.3 Flux du check-in hebdomadaire (WeeklyCheckin.tsx)

1. Saisie de la composition corporelle (poids, masse musculaire, masse grasse, eau, masse osseuse)
2. Upload des photos (front obligatoire, side optionnel, back optionnel)
   - `saveWeeklyPhoto()` → IndexedDB + upload Supabase Storage async (fire-and-forget)
3. `addBodyComposition()` → useLogStore
4. `buildWeeklyScore()` → calcul du score hebdomadaire
5. `addWeeklyScore()` → useLogStore

### 5.4 Flux de l'analyse IA (AdminSync.tsx → aiAnalysis.ts)

**Déclenchement :** Admin uniquement, après agrégation des récaps (Étape 2).

**Pour chaque participant dans `processedRecaps` :**
1. `getWeeklyPhoto(userId, weekNumber)` — photo courante (IndexedDB → Supabase fallback)
2. `getWeeklyPhoto(userId, weekNumber - 1)` — photo précédente (si S2+) ou S0 (si S1)
3. Récupération de `currCompo` et `prevCompo` depuis le RecapFile
4. `runAIAnalysis({ userId, weekNumber, prevCompo, currCompo, photo, prevPhoto, apiKey })`
   - `buildPrompt()` → choisit l'une des 3 versions selon `weekNumber` et `hasPrevPhoto`
   - Appel API Anthropic direct depuis le navigateur de l'admin (`anthropic-dangerous-direct-browser-access: true`)
   - Model : `claude-haiku-4-5-20251001`, `temperature: 0`, `max_tokens: 400`
   - Réponse attendue : JSON `{ credibilityScore: number, analysis: string }`
   - Nettoyage des balises markdown éventuelles, fallback si JSON malformé
5. Résultats agrégés → `aiAnalyses: AIAnalysisResult[]`
6. Embedded dans `MasterLeaderboard.aiAnalyses`
7. Push Supabase `master_leaderboards.upsert({ data: masterLeaderboard })`

**Distribution aux participants :**
- Participant fait `handleFetchMasterFromSupabase()`
- `lb.aiAnalyses?.find(r => r.userId === profile.id)` → `addAIResult(myAI)` → localStorage

### 5.5 Flux de synchronisation du classement (AdminSync + Leaderboard)

**Admin — Étape 1 : Agrégation**

Option A (Supabase) :
1. `handleFetchAndAggregate()` → `sb.from('recaps').select('data').eq('challenge_id', challenge.id)`
2. Résultats filtrés : un récap par userId, celui avec `week_number` le plus élevé
3. `handleAggregate(recaps)` :
   - Admin auto-inclus via `buildAdminRecap()` (construit son RecapFile depuis le store local)
   - Pour chaque récap : calcul `buildWeeklyScore()`
   - Calcul `calcTransformationScore()` (entre S0 et dernière compo)
   - Calcul `calcRegularityScore()` (% jours avec codeConfirmed)
   - Tri des entrées par `compositeScore` DESC → attribution des ranks
   - Calcul des `weeklyHighlights`
   - Stockage dans `processedRecaps` (état local de AdminSync)

Option B (fichiers manuels) :
1. Upload de fichiers JSON via input file
2. Parsing → même pipeline `handleAggregate()`

**Admin — Étape 2 : IA (optionnel)**

`handleRunAI()` — voir flux 5.4 ci-dessus.

**Admin — Publication :**
1. `setMasterLeaderboard(lb)` → useLeaderboardStore (localStorage)
2. `sb.from('master_leaderboards').upsert({ challenge_id, data: lb })` → Supabase

**Participant :**
1. Page Classement → tab "Classement en direct" → bouton "↻ Récupérer le classement"
2. `handleFetchMasterFromSupabase()` → charge le MasterLeaderboard complet
3. Extrait et sauvegarde son AIAnalysisResult local
4. Affichage du classement + "Mur de la honte" (crédibilité IA)

---

## 6. Moteur de scoring (scoring.ts)

### 6.1 Rituels et points

**Rituels SAFE** (disponibles tous niveaux) :
| Ritual | Points | Jours |
|---|---|---|
| no_refined_sugar | 10 | tous |
| hydration_2L | 10 | tous |
| sleep_7h | 10 | tous |
| training_done | 20 | muscu_j1/j2/j3, cardio |
| repos_actif | 10 | repos |

**Rituels STANDARD** (+ les safe) :
| Ritual | Points |
|---|---|
| veggies_daily | 10 |
| protein_target_met | 15 |
| no_snacking | 10 |
| no_alcohol | 15 |
| no_lapse | 15 |

**Rituels FLOW** (+ standard + safe) :
| Ritual | Points |
|---|---|
| intermittent_fasting | 15 |
| no_simple_carbs_after_18 | 15 |
| steps_10k | 10 |
| last_meal_before_20 | 10 |
| cardio_extra | 15 (repos seulement) |

**Multiplicateurs d'intensité :**
```
INTENSITY_MULTIPLIER = { safe: 1.0, standard: 1.4, flow: 2.0 }
```
Les points bruts sont multipliés → les joueurs FLOW gagnent deux fois plus de points par rituel coché qu'un joueur SAFE.

### 6.2 Score ego hebdomadaire
```
egoPoints = Σ calcDayRitualPoints(log, intensity, customRituals)
streakBonus = calcCurrentStreak(logs) × 5   // jours consécutifs valides
```

### 6.3 Score de transformation
```
fatLostKg        = startCompo.fatMassKg - currentCompo.fatMassKg
muscleGainedKg   = currentCompo.muscleMassKg - startCompo.muscleMassKg

// Caps physiologiques proportionnels à la durée (évite les déclarations aberrantes)
fatCapKg         = startCompo.weightKg × 0.015 × durationWeeks   // ~1%/semaine × semaines
muscleCapKg      = 0.1875 × durationWeeks                        // ~1.5 kg sur 8 semaines

fatLostCapped    = min(max(0, fatLostKg), fatCapKg)
muscleGainCapped = min(max(0, muscleGainedKg), muscleCapKg)

fatScore         = round((fatLostCapped / 0.5) × 10)     // 10 pts par 500g de graisse perdue
muscleScore      = round((muscleGainCapped / 0.5) × 15)  // 15 pts par 500g de muscle gagné
transformationScore = fatScore + muscleScore              // max ≈ 150 pts sur 8 semaines
```

### 6.4 Score de régularité
```
regularityScore = (jours avec codeConfirmed) / totalDays × 100
```
`totalDays` est le nombre de jours écoulés depuis le début du challenge (calculé à l'agrégation).

### 6.5 Bonus/Malus IA (`calcAIBonus`)
| credibilityScore | SAFE | STANDARD | FLOW |
|---|---|---|---|
| ≥ 85 | +10 | +15 | +20 |
| 65-84 | +5 | +8 | +10 |
| 45-64 | 0 | 0 | 0 |
| 25-44 | -10 | -15 | -20 |
| < 25 | -15 | -25 | -35 |

### 6.6 Score composite final
```
// Normalisation des trois composantes vers une plage commune 0–1 000
egoNorm   = min(egoPoints + streakBonus + aiBonus, 5000) / 5    // all-in FLOW ≈ 5 000 pts → 1 000
transNorm = min(transformationScore, 150) × (1000 / 150)        // cap 150 pts → 1 000
regNorm   = regularityPercent × 10                              // 0–100% → 0–1 000

totalComposite = round(egoNorm × 0.50 + transNorm × 0.25 + regNorm × 0.25)
// Contribution maximale : ego ≈ 500, transformation ≈ 250, régularité ≈ 250
```
Pondération : 50 % effort quotidien · 25 % transformation corporelle · 25 % régularité.

### 6.7 Paliers de rang (RANK_TIERS)
| Palier | Points min | Couleur |
|---|---|---|
| Corps Brut | 0 | #566186 |
| En Construction | 200 | #7d8db4 |
| Challenger | 500 | #2f7bff |
| Affûté | 900 | #21e6ff |
| Élite | 1400 | #ffc23d |
| Ego Manifeste | 2000 | #ff4d5e |
| Apex | 2800 | #ffffff |

---

## 7. Moteur nutritionnel (nutrition.ts)

### 7.1 Calcul des objectifs (`calculateTargets`)

1. **BMR (Mifflin-St Jeor) :**
   - Homme : `10 × poids + 6.25 × taille - 5 × âge + 5`
   - Femme : `10 × poids + 6.25 × taille - 5 × âge - 161`

2. **TDEE :** `BMR × activityLevel` (1.2 à 1.9)

3. **Déficit cible selon intensité :**
   - safe : 0.5% du poids corporel/semaine → ~déficit modéré
   - standard : 0.75%
   - flow : 1.0%
   - Conversion : 1 kg de graisse ≈ 7700 kcal → déficit journalier = (objectif perte/semaine × 7700) / 7

4. **Cible calorique :** `TDEE - déficit`

5. **Plancher de sécurité :**
   - FLOW : max(cible, 1400)
   - autres : max(cible, BMR × 1.1)

6. **Protéines adaptatives :** 1.8g/kg (safe) → 2.0 (standard) → 2.2 (flow)

7. **Macros :** Calories restantes (après protéines) → 37% glucides / 63% lipides

### 7.2 Multiplicateurs INTENSITY_MULTIPLIER
```
{ safe: 1.0, standard: 1.4, flow: 2.0 }
```
Utilisé **uniquement pour le scoring des rituels** (`calcDayRitualPoints`). Les calculs nutritionnels de `calculateTargets` utilisent `WEEKLY_LOSS_RATE` (`{ safe: 0.005, standard: 0.0075, flow: 0.01 }`) et non `INTENSITY_MULTIPLIER`.

---

## 8. Code quotidien (dailyCode.ts)

```typescript
getDailyCode(groupSecret: string, dateStr: string): string
```
1. Hash djb2 de `groupSecret + dateStr`
2. `index = |hash| % 12` → choisit dans `['APEX','FLOW','BURN','LOCK','FIRE','EDGE','BOLT','IRON','RAGE','CORE','PEAK','WILD']`
3. `suffix = |hash % 100|` → padStart 2 (`'07'`)
4. Résultat : `"BURN-61"` par exemple

```typescript
isTodaysCode(groupSecret: string, inputCode: string): boolean
```
Compare (case-insensitive, trim) le code saisi avec `getDailyCode(groupSecret, today)`.

⚠️ **Faille critique** : Comme expliqué dans le flux onboarding, chaque participant génère son propre `groupSecret` différent. Le code quotidien est donc **différent pour chaque appareil**. Le système anti-triche par code partagé ne fonctionne en réalité que si l'admin partage manuellement le code (via Slack/WhatsApp) ET que le participant le saisit exactement. La validation est locale, contre le secret local, pas contre un secret partagé.

---

## 9. Stockage photos (db.ts — IndexedDB + Supabase Storage)

### 9.1 IndexedDB
- Base : `fatlock-db` v1
- Object store : `weeklyPhotos`
- Clé primaire : `${userId}_${weekNumber}`
- Index : `byUser` (pour `getAllPhotosForUser`)

### 9.2 Fonctions principales

**`saveWeeklyPhoto(photo)`** :
1. `db.put('weeklyPhotos', {...photo, key})` — synchrone, bloquant
2. `uploadPhotoToSupabase(photo).catch(console.warn)` — fire-and-forget (non bloquant)
   - Path : `${challengeId}/${userId}/week${weekNumber}.json`
   - Format : JSON stringifié du `WeeklyPhoto` (base64 inclus), uploadé comme blob `application/json`

**`getWeeklyPhoto(userId, weekNumber)`** :
1. Cherche dans IndexedDB
2. Si absent → `downloadPhotoFromSupabase()` → cache dans IndexedDB
3. Retourne null si nulle part trouvé

⚠️ **Faille** : La photo de l'admin (utilisateur actif) est toujours dans son IndexedDB local. Pour les participants, l'admin doit avoir Supabase configuré ET les photos uploadées par les participants. Si un participant n'avait pas Supabase configuré lors de son upload, ses photos restent locales et l'admin ne peut pas les récupérer.

### 9.3 Fonctions de nettoyage
- `clearUserPhotos(userId)` — supprime toutes les photos d'un utilisateur en IndexedDB + leur dossier dans Supabase Storage
- `clearAllPhotos()` — vide l'intégralité de l'IndexedDB + le dossier `{challengeId}/{userId}` dans Supabase Storage

**Alias exportés :** `savePhoto = saveWeeklyPhoto`, `getPhotosByWeek = getWeeklyPhoto` (compatibilité composants).

---

## 10. Système de récap (recap.ts)

### 10.1 Génération (`generateRecapFile`)
Construit le `RecapFile` complet avec :
- Données de profil, logs, compos, photos, scores
- Timestamp d'export
- **Checksum SHA-256** calculé via `crypto.subtle.digest` (Web Crypto API)
  - Input du hash : JSON stringifié du payload **sans** le champ `checksum`
  - Garantit l'intégrité mais PAS l'authenticité (un participant peut reconstruire un RecapFile valide)

### 10.2 Export (`exportRecapAsFile`)
Crée un Blob JSON, déclenche un download dans le navigateur :
```
fatlock_recap_PRENOM_S3_2026-05-26.json
```

### 10.3 Vérification (`verifyRecapFile`)
Recalcule le SHA-256 et compare. Utilisé par AdminSync pour valider les fichiers importés manuellement.

⚠️ **Faille** : La vérification du checksum valide uniquement que le fichier n'a pas été modifié APRÈS génération. Elle ne prouve pas que les données elles-mêmes (photos, compositions) sont authentiques. Un participant motivé peut générer un RecapFile from scratch avec de fausses données et un checksum valide.

---

## 11. Backend Supabase

### 11.1 Architecture du client (supabase.ts)
```typescript
let _client: SupabaseClient | null = null

setupSupabase(url, anonKey)   // initialise le singleton
supabase()                    // retourne _client ou null
isSupabaseReady()             // boolean
```
Le client est (re-)initialisé dans `App.tsx` via `useEffect` sur `challenge.supabaseUrl/anonKey`.

⚠️ **Faille** : L'appel à `setupSupabase` dans l'effect dépend de `[challenge?.supabaseUrl, challenge?.supabaseAnonKey]`. Si ces valeurs sont null au premier rendu (profil non encore chargé depuis localStorage), Supabase n'est pas initialisé. Le re-render déclenché par l'hydratation du persist remédie généralement à cela, mais une race condition existe au démarrage.

### 11.2 Tables Supabase

**`recaps`** :
```sql
(challenge_id TEXT, user_id TEXT, week_number INT, exported_at TIMESTAMPTZ, data JSONB)
-- PK composite : (challenge_id, user_id, week_number)
-- UPSERT onConflict: 'challenge_id,user_id,week_number'
```
Le champ `data` contient le RecapFile complet en JSON (photos base64 incluses → lignes potentiellement énormes).

**`master_leaderboards`** :
```sql
(challenge_id TEXT PRIMARY KEY, data JSONB, updated_at TIMESTAMPTZ)
-- UPSERT onConflict: 'challenge_id'
```
Le champ `data` contient le MasterLeaderboard complet (avec `aiAnalyses[]`).

**`fatlock-photos`** (Storage bucket) :
```
Path : {challengeId}/{userId}/week{N}.json
Content : WeeklyPhoto JSON (base64 inclus)
```

### 11.3 Politiques RLS
Non documentées dans le code source. Supposées permissives (anon key utilisé côté client) ou inexistantes. **Risque majeur** : n'importe qui avec la clé anon peut lire/écrire les données de tous les groupes si les RLS ne sont pas configurées par challenge_id.

### 11.4 Lecture des récaps par l'admin
```typescript
sb.from('recaps')
  .select('data')
  .eq('challenge_id', challenge.id)
```
Retourne tous les récaps du groupe. Le code conserve ensuite un seul récap par userId (le plus récent par `weekNumber`).

---

## 12. Analyse IA — détail des prompts (aiAnalysis.ts)

### 12.1 Version 1 : S1 sans photo S0
4 rubriques additives (total /100) :
1. Plausibilité perte MG — /30 (tolérance élevée S1 eau/glycogène)
2. Cohérence interne métriques — /30
3. Stabilité masse musculaire — /20 (seuil ±0.5 kg)
4. Cohérence photo / % MG déclaré — /20

### 12.2 Version 2 : S1 avec photo S0
5 rubriques additives (total /100) :
1. Plausibilité perte MG — /25
2. Cohérence interne métriques — /25
3. Stabilité masse musculaire — /15
4. Cohérence photo S1 / % MG — /15
5. Authenticité visuelle S0→S1 — /20

### 12.3 Version 3 : S2+ (avec ou sans photo précédente)
4 ou 5 rubriques :
1. Plausibilité perte MG — /25 (cap 1% du poids corporel/semaine)
2. Cohérence interne métriques — /25
3. Stabilité masse musculaire — /15
4. Cohérence photo actuelle / % MG — /15
5. Authenticité visuelle — /20 OU : si 1 seule photo, normalisation ×1.25 pour ramener sur 100

### 12.4 Construction du message API
Images envoyées dans l'ordre : `[prevPhoto.front, prevPhoto.side?, currPhoto.front, currPhoto.side?]` suivi du prompt textuel.

### 12.5 Parsing de la réponse
```typescript
cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
parsed = JSON.parse(cleaned)
// Fallback : regex extraction { ... "credibilityScore" ... }
// Double fallback : { credibilityScore: 50, analysis: cleaned }
```

---

## 13. Gestion multi-groupes (Settings.tsx)

- L'utilisateur peut appartenir à plusieurs groupes (famille, amis, collègues)
- `useProfileStore.entries[]` stocke chaque (profile, challenge)
- `switchEntry(profileId)` change l'actif
- Chaque groupe a ses propres données dans le store commun (filtrées par `userId`)
- La clé API Anthropic et les credentials Supabase sont stockés dans `ChallengeConfig` → chaque groupe peut avoir ses propres backends

---

## 14. Lien d'invitation (Settings.tsx)

```typescript
const link = `${base}?join=${challenge.groupCode}&gname=${encodeURIComponent(challenge.groupName)}&cid=${challenge.id}`;
```
Paramètres transmis :
- `join` = groupCode (6 chars)
- `gname` = nom du groupe (encoded)
- `cid` = challenge.id UUID (**crucial pour l'alignement Supabase**)

Paramètres NON transmis :
- `groupSecret` — **faille** : le code quotidien ne sera pas identique chez tous
- `adminId` — le participant ne connaît pas l'admin
- `supabaseUrl/anonKey` — doit être configuré manuellement par chaque participant
- `anthropicApiKey` — doit être configuré par l'admin uniquement

---

## 15. Flux final vote (FinalVote.tsx)

Route `/vote-final`. Nécessite Supabase. Disponible uniquement quand `challengeState === 'completed'`.

**Table Supabase :** `final_vote_packages` — `(challenge_id TEXT PRIMARY KEY, data JSONB)`.

**Types impliqués :** `FinalVotePackage`, `FinalTransformationCard`, `FinalAIVerdict`, `FinalResult`.

### 15.1 Flux Admin

**Étape 1 — Génération du package (admin only) :**
1. Les `LeaderboardEntry[]` du `masterLeaderboard` sont mélangés aléatoirement
2. Chaque entrée reçoit un `anonymousId` généré par `generateAnonymousName(i)` depuis `cagnotte.ts`
3. Calcul de `weeklyCredibilityAvgs` : moyenne des `credibilityScore` IA par userId
4. Création d'un `FinalVotePackage { status: 'open', cards, votes: [], ... }` → push Supabase

**Étape 2 — Analyse IA finale (optionnel) :**
- Pour chaque `card`, charge la photo S0 et la dernière photo disponible (de `durationWeeks` vers 1)
- Appelle `runFinalAIAnalysis({ userId, s0Photo, s8Photo, apiKey, durationWeeks })`
- `adjustedScore = transformationScore × credibilityFactor(avgCredibility)` où `credibilityFactor` : ≥75→×1.0 / ≥50→×0.75 / ≥25→×0.5 / <25→×0.25
- `aiBonus = (adjustedScore - 50) × 0.15`
- Résultats stockés dans `pkg.aiVerdicts`

**Étape 3 — Révélation :**
- `computeResults()` : score final = `voteScore + aiBonus + hebdoBonus`
  - `voteScore = (votesReçus / totalVoters) × 100`
  - `hebdoBonus = +5` si le participant est dans le top 25% du classement hebdo
- Package mis à jour avec `status: 'revealed'`, `finalResults`, `participantNames`
- Distribution des gains via `distributePrizes(stakeAmount, finalResults)` depuis `cagnotte.ts`

### 15.2 Flux Participant

1. Charge le `FinalVotePackage` depuis Supabase au montage
2. Affiche les `TransformationCard` (photos S0→Sfinal anonymisées, chargées depuis IndexedDB/Supabase)
3. Un participant ne peut pas voter pour lui-même
4. Vote soumis : refetch du package pour éviter les conflits de concurrence → append du vote → push Supabase
5. Une fois `status: 'revealed'`, affiche les résultats avec noms, scores et gains

⚠️ **Faille** : L'admin n'a pas d'interface de vote — il est exclu du décompte des votants (`totalParticipants = cards.filter(c => c.userId !== profile.id).length`). Mais ses photos sont incluses dans les transformations votables.

---

## 16. Synthèse des failles et interrogations identifiées

### 🔴 Critiques

1. **groupSecret non partagé** : Chaque joineur génère son propre secret → les codes quotidiens divergent → le mécanisme anti-triche principal (confirmer le code du jour) ne fonctionne pas entre appareils différents.

2. **Clés API en localStorage clair** : `anthropicApiKey`, `supabaseAnonKey`, `supabaseUrl` stockées non chiffrées. Quiconque a accès au navigateur peut les extraire.

3. **Checksum non authentifiant** : Le SHA-256 du RecapFile peut être recalculé par n'importe qui. La vérification prouve l'intégrité (pas de modification post-génération) mais pas l'authenticité (les données peuvent être fabriquées).

4. **Photos base64 dans RecapFile/Supabase Postgres** : Stocker des images base64 dans des lignes JSON dans Postgres est une anti-pattern. Les lignes peuvent atteindre plusieurs Mo. Le storage est théoriquement dans Supabase Storage, mais le RecapFile (qui passe par `recaps` Postgres) inclut les base64.

5. **RLS Supabase inconnues** : Si non configurées, toutes les données sont publiques pour qui connaît la clé anon (qui est transmise dans le lien d'invitation).

### 🟡 Importantes

6. **adminId non transmis dans le lien** : Le participant ne peut pas identifier l'admin → impossible de valider que le classement reçu vient du bon admin.

7. **groupSecret différent pour le joineur** → `getDailyCode()` retourne un code différent → `codeConfirmed` basé sur des codes incohérents entre participants → `regularityScore` et `streakBonus` perdent leur sens comme anti-triche.

8. **Normalisation composite empirique** : Les facteurs ×10 et ×20 dans `calcCompositeScore` ne sont pas calibrés. Selon la taille du groupe et les comportements, certaines composantes peuvent dominer de façon imprévue.

9. ~~**Score de transformation sans borne**~~ — **Résolu.** `calcTransformationScore` applique désormais des caps physiologiques : perte de graisse plafonnée à `poids × 1.5% × durationWeeks` et gain musculaire plafonné à `0.1875 kg/semaine × durationWeeks` (≈1.5 kg sur 8 semaines). Le score maximum est d'environ 150 points, qui se normalise à ~250 points composites.

10. **Photos non disponibles en cas d'absence de Supabase** : Si un participant n'a pas Supabase configuré, ses photos restent dans son IndexedDB local et l'admin ne peut pas les récupérer → analyse IA impossible pour ce participant.

11. **RecapFile contient les photos** : Si le participant envoie son récap à l'admin, toutes ses photos sont incluses en base64 dans le JSON → fichier potentiellement > 10 Mo → lent, risque d'échouer sur Supabase (limite 5 Mo par défaut pour Postgres JSONB via PostgREST ?).

12. **Pas de pagination/limit sur les requêtes Supabase** : `sb.from('recaps').select('data').eq('challenge_id', challenge.id)` retourne tous les récaps de tous les participants de toutes les semaines → peut être volumineux.

13. **Pas de validation côté "serveur"** : Toutes les validations (cohérence des données, droits admin, etc.) se font côté client. Supabase est utilisé comme un simple data store sans logique business.

### 🟢 Mineures / UX

14. **Pas de gestion de conflits de profils multi-appareils** : Si l'utilisateur installe l'app sur un second appareil et rejoint le même groupe, un nouveau `userId` est généré → apparaît comme un nouveau participant.

15. **DailyCode sur repos vs entraînement** : Le code est le même pour tout le monde quel que soit le type de jour, mais `training_done` n'est disponible que sur les jours d'entraînement → un joueur safe sur un jour repos ne peut pas obtenir 100% des points même en cochant tout.

16. **`weeklyHighlights` calculés mais peu validés** : Les champs `biggestMover`, `topStreak`, `topCredibility` sont strings (noms) sans vérification de cohérence.

17. **Absence de gestion de la semaine 0** : `getCurrentWeek()` retourne min 1. Mais `weekNumber === 0` est utilisé pour la baseline. Si l'admin démarre le challenge aujourd'hui, `getCurrentWeek` peut retourner 1 même si la baseline n'a pas été faite.

18. **Pas de confirmation avant reset** : `reset()` et `resetAll()` dans les stores sont des suppressions immédiates sans confirmation supplémentaire (la UI peut avoir un confirm dialog, mais le store lui-même ne protège pas).

---

## 17. Chantiers d'amélioration potentiels (non exhaustif)

- Partage du `groupSecret` via le lien d'invitation (chiffré ou via Supabase)
- Chiffrement des clés API en storage (Web Crypto AES-GCM avec clé dérivée du PIN)
- Séparation photos et RecapFile : envoyer les photos via Storage, le recap sans photos via Postgres
- RLS Supabase par `challenge_id` avec validation JWT ou code partagé
- ~~Cap sur le score de transformation~~ — Implémenté (caps physiologiques proportionnels à la durée)
- Calibration empirique des poids dans `calcCompositeScore`
- Transmission de `adminId` et `groupSecret` (hashé) dans le lien d'invitation
- Pagination des requêtes Supabase
- Validation de cohérence à l'import du récap (ex: `challengeId` correspond au groupe actif)
- Score de régularité calculé côté participant et vérifié côté admin (actuellement recalculé côté admin uniquement)
- Synchronisation des `participantIds` via Supabase (registre des membres)
- Gestion multi-appareils du même participant (UUID stable par groupe)

---

*Fin de la documentation technique FATLOCK v1.0*