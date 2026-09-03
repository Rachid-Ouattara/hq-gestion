-- ============================================================
-- HQ Gestion — Migration initiale (socle)
-- PostgreSQL 13+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ------------------------------------------------------------
-- Rôles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,            -- admin | secretaire | direction
  name        TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,  -- rôle non supprimable
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Modules métier (registre) — les 7 modules de l'organigramme
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modules (
  code        TEXT PRIMARY KEY,               -- administrative, rh, achats...
  name        TEXT NOT NULL,
  color       TEXT,                            -- code couleur (repris de l'organigramme)
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ------------------------------------------------------------
-- Utilisateurs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role_id       UUID NOT NULL REFERENCES roles(id),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- ------------------------------------------------------------
-- RBAC : droits d'accès par (rôle, module)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_module_permissions (
  role_id      UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_code  TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
  can_read     BOOLEAN NOT NULL DEFAULT FALSE,
  can_create   BOOLEAN NOT NULL DEFAULT FALSE,
  can_update   BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete   BOOLEAN NOT NULL DEFAULT FALSE,
  can_validate BOOLEAN NOT NULL DEFAULT FALSE,  -- couche Direction : validation/décision
  PRIMARY KEY (role_id, module_code)
);

-- ------------------------------------------------------------
-- Refresh tokens (rotation)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_hash ON refresh_tokens(token_hash);

-- ------------------------------------------------------------
-- Journal d'audit (traçabilité des actions)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,                  -- login, create, update, delete, validate...
  module_code  TEXT,
  entity_type  TEXT,
  entity_id    TEXT,
  details      JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_log(module_code);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- ------------------------------------------------------------
-- Moteur de validation générique (couche Direction)
-- Découplé de chaque module : référence (module, type, id métier)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS validations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code  TEXT NOT NULL REFERENCES modules(code),
  entity_type  TEXT NOT NULL,                  -- ex: bon_de_commande, depense, devis
  entity_id    TEXT NOT NULL,                  -- id de l'enregistrement métier
  status       TEXT NOT NULL DEFAULT 'submitted'
               CHECK (status IN ('draft','submitted','validated','rejected')),
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at   TIMESTAMPTZ,
  comment      TEXT
);

CREATE INDEX IF NOT EXISTS idx_validations_entity
  ON validations(module_code, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_validations_status ON validations(status);
