-- ============================================================
-- FATLOCK — Script RLS Supabase (copier-coller dans SQL Editor)
-- À exécuter UNE SEULE FOIS après avoir créé les tables.
-- ============================================================
-- Ce que fait ce script :
--   1. Active Row Level Security (RLS) sur les tables recaps et master_leaderboards
--   2. Crée les politiques d'accès pour la clé anonyme (anon)
--   3. Configure les politiques du bucket Storage "fatlock-photos"
--
-- Ce que ce script NE peut PAS faire sans authentification Supabase :
--   - Restreindre l'accès par utilisateur individuel
--   - Empêcher un membre du groupe de lire les données des autres membres
--     (tous partagent la même clé anon)
--   → Pour une protection complète, voir la note sur les Edge Functions en bas.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Table "recaps"
-- ────────────────────────────────────────────────────────────

-- Crée la table si elle n'existe pas encore
CREATE TABLE IF NOT EXISTS recaps (
  challenge_id  TEXT        NOT NULL,
  user_id       TEXT        NOT NULL,
  week_number   INTEGER     NOT NULL,
  exported_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  data          JSONB       NOT NULL,
  PRIMARY KEY (challenge_id, user_id, week_number)
);

-- Active RLS (sans politique = accès bloqué par défaut)
ALTER TABLE recaps ENABLE ROW LEVEL SECURITY;

-- Lecture : autorisée pour la clé anon (tout membre du groupe peut lire les récaps)
CREATE POLICY "recaps_select" ON recaps
  FOR SELECT TO anon
  USING (true);

-- Insertion : autorisée pour la clé anon
CREATE POLICY "recaps_insert" ON recaps
  FOR INSERT TO anon
  WITH CHECK (true);

-- Mise à jour : autorisée pour la clé anon (upsert)
CREATE POLICY "recaps_update" ON recaps
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Suppression : bloquée (protection contre la suppression accidentelle ou malveillante)
-- Si tu veux permettre la suppression, décommente :
-- CREATE POLICY "recaps_delete" ON recaps
--   FOR DELETE TO anon
--   USING (true);


-- ────────────────────────────────────────────────────────────
-- 2. Table "master_leaderboards"
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS master_leaderboards (
  challenge_id  TEXT        NOT NULL PRIMARY KEY,
  data          JSONB       NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE master_leaderboards ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les membres peuvent voir le classement
CREATE POLICY "lb_select" ON master_leaderboards
  FOR SELECT TO anon
  USING (true);

-- Insertion + mise à jour : autorisées (seul l'admin publie en pratique)
CREATE POLICY "lb_insert" ON master_leaderboards
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "lb_update" ON master_leaderboards
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Suppression : bloquée
-- (décommenter si nécessaire)


-- ────────────────────────────────────────────────────────────
-- 3. Bucket Storage "fatlock-photos"
-- ────────────────────────────────────────────────────────────
-- À configurer dans : Storage > fatlock-photos > Policies
-- Ou via SQL comme ci-dessous (nécessite l'extension storage activée)

-- Crée le bucket s'il n'existe pas (public = false pour ne pas exposer les URLs directement)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fatlock-photos', 'fatlock-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Politique de lecture : toute personne avec la clé anon peut lire les photos
-- (protège contre l'accès sans clé, pas contre les membres du groupe entre eux)
CREATE POLICY "photos_select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'fatlock-photos');

-- Politique d'écriture (upload/upsert)
CREATE POLICY "photos_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'fatlock-photos');

CREATE POLICY "photos_update" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'fatlock-photos');

-- Politique de suppression (pour clearAllPhotos())
CREATE POLICY "photos_delete" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'fatlock-photos');


-- ────────────────────────────────────────────────────────────
-- 3b. Table "final_vote_packages"
-- ────────────────────────────────────────────────────────────
-- Stocke le package du vote final (cartes anonymes, votes, verdicts IA, résultats).
-- Une seule ligne par challenge (upsert sur challenge_id).

CREATE TABLE IF NOT EXISTS final_vote_packages (
  challenge_id  TEXT        NOT NULL PRIMARY KEY,
  data          JSONB       NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE final_vote_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fvp_select" ON final_vote_packages
  FOR SELECT TO anon USING (true);

CREATE POLICY "fvp_insert" ON final_vote_packages
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "fvp_update" ON final_vote_packages
  FOR UPDATE TO anon USING (true) WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- 4. Table "group_members"
-- ────────────────────────────────────────────────────────────
-- Enregistre les participants au moment où ils rejoignent via le lien d'invitation.
-- Permet à l'admin de voir la liste avant le début du challenge.

CREATE TABLE IF NOT EXISTS group_members (
  challenge_id  TEXT        NOT NULL,
  user_id       TEXT        NOT NULL,
  user_name     TEXT        NOT NULL,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Lecture : l'admin (et tous les membres) peuvent voir la liste
CREATE POLICY "gm_select" ON group_members
  FOR SELECT TO anon USING (true);

-- Insertion : le participant s'enregistre lui-même au join
CREATE POLICY "gm_insert" ON group_members
  FOR INSERT TO anon WITH CHECK (true);

-- Mise à jour : permet de corriger le nom si l'utilisateur refait l'onboarding
CREATE POLICY "gm_update" ON group_members
  FOR UPDATE TO anon USING (true) WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- 5. Table "excluded_members"
-- ────────────────────────────────────────────────────────────
-- Participants exclus par l'admin. Filtrés lors de l'agrégation du classement.

CREATE TABLE IF NOT EXISTS excluded_members (
  challenge_id  TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  user_name     TEXT NOT NULL,
  PRIMARY KEY (challenge_id, user_id)
);

ALTER TABLE excluded_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "em_select" ON excluded_members FOR SELECT TO anon USING (true);
CREATE POLICY "em_insert" ON excluded_members FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "em_delete" ON excluded_members FOR DELETE TO anon USING (true);


-- ────────────────────────────────────────────────────────────
-- 6. Index utiles pour les performances
-- ────────────────────────────────────────────────────────────

-- Accélère la lecture des récaps par groupe (requête principale de l'admin)
CREATE INDEX IF NOT EXISTS idx_recaps_challenge_id ON recaps (challenge_id);

-- Accélère la recherche du dernier récap d'un participant
CREATE INDEX IF NOT EXISTS idx_recaps_user_week ON recaps (challenge_id, user_id, week_number DESC);


-- ============================================================
-- NOTE : Limites de cette configuration
-- ============================================================
-- Ce script protège contre :
--   ✓ L'accès sans clé anon (crawlers, requêtes non authentifiées)
--   ✓ Les écritures accidentelles si RLS était désactivé
--
-- Ce script NE protège PAS contre :
--   ✗ Un membre du groupe qui lit les photos des autres (tous ont la même clé anon)
--   ✗ Un membre qui écrase le master_leaderboard (admin usurpé)
--   ✗ Un participant qui forge un recap valide
--
-- Pour une protection complète : utiliser une Supabase Edge Function comme
-- intermédiaire (la clé service_role reste côté serveur, jamais dans le client).
-- Voir https://supabase.com/docs/guides/functions
-- ============================================================
