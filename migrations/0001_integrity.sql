-- Custom migration: database-level integrity guarantees that the ORM schema
-- cannot express. Applied automatically by `npm run db:migrate`.

-- 1) Append-only tables: reject UPDATE and DELETE at the database level.
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

DROP TRIGGER IF EXISTS budget_transactions_immutable ON budget_transactions;
CREATE TRIGGER budget_transactions_immutable
  BEFORE UPDATE OR DELETE ON budget_transactions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

DROP TRIGGER IF EXISTS leadership_points_history_immutable ON leadership_points_history;
CREATE TRIGGER leadership_points_history_immutable
  BEFORE UPDATE OR DELETE ON leadership_points_history
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

DROP TRIGGER IF EXISTS disciplinary_actions_immutable ON disciplinary_actions;
CREATE TRIGGER disciplinary_actions_immutable
  BEFORE UPDATE OR DELETE ON disciplinary_actions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- 2) Ledger arithmetic must always hold: balance_after = balance_before + amount.
ALTER TABLE budget_transactions
  DROP CONSTRAINT IF EXISTS budget_transactions_balance_math;
ALTER TABLE budget_transactions
  ADD CONSTRAINT budget_transactions_balance_math
  CHECK (balance_after = balance_before + amount);

ALTER TABLE budget_transactions
  DROP CONSTRAINT IF EXISTS budget_transactions_type_matches_amount;
ALTER TABLE budget_transactions
  ADD CONSTRAINT budget_transactions_type_matches_amount
  CHECK (
    (type = 'deposit' AND amount > 0) OR
    (type = 'withdrawal' AND amount < 0)
  );

-- 3) Closed terms must carry dismissal metadata; open terms must not.
ALTER TABLE leadership_terms
  DROP CONSTRAINT IF EXISTS leadership_terms_dismissal_metadata;
ALTER TABLE leadership_terms
  ADD CONSTRAINT leadership_terms_dismissal_metadata
  CHECK (
    (status = 'active' AND dismissed_at IS NULL) OR
    (status = 'dismissed' AND dismissed_at IS NOT NULL)
  );

-- 4) Enum-like status domains.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_status_domain;
ALTER TABLE users
  ADD CONSTRAINT users_status_domain
  CHECK (status IN ('active', 'suspended', 'blocked', 'inactive'));

ALTER TABLE leadership_terms
  DROP CONSTRAINT IF EXISTS leadership_terms_status_domain;
ALTER TABLE leadership_terms
  ADD CONSTRAINT leadership_terms_status_domain
  CHECK (status IN ('active', 'dismissed'));

ALTER TABLE disciplinary_actions
  DROP CONSTRAINT IF EXISTS disciplinary_actions_type_domain;
ALTER TABLE disciplinary_actions
  ADD CONSTRAINT disciplinary_actions_type_domain
  CHECK (type IN ('warning', 'reprimand'));

ALTER TABLE oauth_accounts
  DROP CONSTRAINT IF EXISTS oauth_accounts_provider_domain;
ALTER TABLE oauth_accounts
  ADD CONSTRAINT oauth_accounts_provider_domain
  CHECK (provider IN ('discord', 'vk'));

-- 5) A faction budget balance cannot be negative unless the setting allows it is
--    enforced in the service layer; the CHECK below is the hard lower bound.
ALTER TABLE budget_accounts
  DROP CONSTRAINT IF EXISTS budget_accounts_balance_floor;
ALTER TABLE budget_accounts
  ADD CONSTRAINT budget_accounts_balance_floor
  CHECK (balance >= -1000000000);

-- 6) Updated-at maintenance.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','roles','factions','faction_positions','budget_accounts','system_settings','integration_api_keys']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_set_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t || '_set_updated_at', t
    );
  END LOOP;
END $$;
