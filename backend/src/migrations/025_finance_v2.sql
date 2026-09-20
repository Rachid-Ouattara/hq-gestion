-- ============================================================
-- HQ Gestion — Refonte Gestion Financière v2
-- Trésorerie par moyen de paiement, prévisions face au réalisé,
-- créances/dettes avec échéances, engagements, activité/nature
-- pour le compte de résultat détaillé.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS finance_engagements_numero_seq;

-- ------------------------------------------------------------
-- Comptes : distinction du moyen de trésorerie (Banque/Caisse/Mobile Money)
-- ------------------------------------------------------------
ALTER TABLE finance_comptes ADD COLUMN IF NOT EXISTS type_tresorerie TEXT
  CHECK (type_tresorerie IN ('banque', 'caisse', 'mobile_money'));

-- ------------------------------------------------------------
-- Recettes : classification par activité (obligatoire, aucune ligne
-- existante aujourd'hui donc pas de backfill à risque)
-- ------------------------------------------------------------
ALTER TABLE finance_recettes ADD COLUMN IF NOT EXISTS activite TEXT NOT NULL DEFAULT 'autres_produits'
  CHECK (activite IN ('formation', 'vente_materiels', 'logiciels', 'projets_partenariats', 'prestations_diverses', 'autres_produits'));

-- ------------------------------------------------------------
-- Dépenses : classification par activité (optionnelle — seules les
-- charges directement attribuables le sont, le reste reste frais
-- généraux non affectés) + refonte de la nature des charges
-- ------------------------------------------------------------
ALTER TABLE finance_depenses ADD COLUMN IF NOT EXISTS activite TEXT
  CHECK (activite IN ('formation', 'vente_materiels', 'logiciels', 'projets_partenariats', 'prestations_diverses', 'autres_produits'));

ALTER TABLE finance_depenses DROP CONSTRAINT IF EXISTS finance_depenses_categorie_check;

UPDATE finance_depenses SET categorie = CASE categorie
  WHEN 'electricite' THEN 'energie_telecom'
  WHEN 'eau' THEN 'fonctionnement'
  WHEN 'fournitures' THEN 'fonctionnement'
  WHEN 'salaires' THEN 'personnel'
  WHEN 'transport' THEN 'transport_logistique'
  WHEN 'loyer' THEN 'loyers'
  ELSE categorie
END;

ALTER TABLE finance_depenses ADD CONSTRAINT finance_depenses_categorie_check
  CHECK (categorie IN ('personnel', 'fiscalite_sociale', 'loyers', 'fonctionnement', 'achats', 'communication', 'transport_logistique', 'energie_telecom', 'prestations_externes', 'autre'));

-- ------------------------------------------------------------
-- Dettes fournisseurs : échéance (parité avec commercial_factures.echeance)
-- ------------------------------------------------------------
ALTER TABLE bons_de_commande ADD COLUMN IF NOT EXISTS echeance DATE;

-- ------------------------------------------------------------
-- Prévisions de recettes (prévu saisi manuellement, par mois x activité —
-- même logique que finance_budgets mais dimensionnée dans le temps)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance_previsions_recettes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice      TEXT NOT NULL,
  mois          INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
  activite      TEXT NOT NULL CHECK (activite IN ('formation', 'vente_materiels', 'logiciels', 'projets_partenariats', 'prestations_diverses', 'autres_produits')),
  montant_prevu NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (montant_prevu >= 0),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exercice, mois, activite)
);

CREATE INDEX IF NOT EXISTS idx_finance_previsions_exercice ON finance_previsions_recettes(exercice);

-- ------------------------------------------------------------
-- Engagements (dépenses engagées mais pas encore soldées)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance_engagements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE DEFAULT
    ('ENG-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('finance_engagements_numero_seq')::text, 4, '0')),
  libelle         TEXT NOT NULL,
  montant         NUMERIC(14,2) NOT NULL CHECK (montant > 0),
  date_engagement DATE NOT NULL DEFAULT CURRENT_DATE,
  echeance        DATE,
  responsable_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  statut          TEXT NOT NULL DEFAULT 'a_payer' CHECK (statut IN ('a_payer', 'en_cours', 'solde')),
  notes           TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_engagements_statut ON finance_engagements(statut);
