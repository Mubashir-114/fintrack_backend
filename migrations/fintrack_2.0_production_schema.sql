-- ============================================================================
-- FinTrack 2.0 — Production Baseline Schema for personal_finance
-- Target Engine: MySQL 8.4.11 LTS (InnoDB)
-- Character Set: utf8mb4 / Collation: utf8mb4_0900_ai_ci
-- ============================================================================
-- Invariants:
-- 1. Consolidated, authoritative fresh-install DDL for clean databases.
-- 2. Clean topological creation order; installs with FOREIGN_KEY_CHECKS enabled.
-- 3. Scopes transactions.sms_hash uniqueness to (user_id, sms_hash).
-- 4. Preserves child-first deletion integrity with strict RESTRICT guards on accounts,
--    transfers, and account_adjustments.
-- 5. Seeds canonical default categories and registers schema_migrations 0001–0007.
-- 6. Fresh databases only: never run this baseline against existing production data.
--    Apply 20261019_01_user_avatars.sql separately to enable profile photo storage.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Schema Migration Tracking Table
-- ----------------------------------------------------------------------------
CREATE TABLE schema_migrations (
  version VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 2. Core User Identity & Authentication Table
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 3. Canonical Financial Categories Table
-- ----------------------------------------------------------------------------
CREATE TABLE categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  type ENUM('income', 'expense') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name_type (name, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 4. Accounts Foundation (Bank, Cash, Wallet, Credit Card)
-- ----------------------------------------------------------------------------
CREATE TABLE accounts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  type ENUM('bank', 'cash', 'wallet', 'credit_card') NOT NULL,
  subtype ENUM('savings', 'current', 'salary', 'cash', 'stored_value', 'credit_card') NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  institution_name VARCHAR(100) NULL,
  masked_last4 CHAR(4) NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'INR',
  opening_amount_minor BIGINT NOT NULL DEFAULT 0,
  credit_limit_minor BIGINT NULL,
  statement_closing_day TINYINT UNSIGNED NULL,
  payment_due_day TINYINT UNSIGNED NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  client_creation_key VARCHAR(100) NOT NULL,
  creation_fingerprint CHAR(64) NOT NULL,
  active_default_asset_user_id INT UNSIGNED
    GENERATED ALWAYS AS (
      CASE
        WHEN status = 'active' AND is_default = TRUE AND type <> 'credit_card'
          THEN user_id
        ELSE NULL
      END
    ) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_user_creation_key (user_id, client_creation_key),
  UNIQUE KEY uq_accounts_active_default_asset (active_default_asset_user_id),
  KEY idx_accounts_user_status_created (user_id, status, created_at, id),
  KEY idx_accounts_user_type_status (user_id, type, status),
  CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_accounts_type_subtype CHECK (
    (type = 'bank' AND subtype IN ('savings', 'current', 'salary')) OR
    (type = 'cash' AND subtype = 'cash') OR
    (type = 'wallet' AND subtype = 'stored_value') OR
    (type = 'credit_card' AND subtype = 'credit_card')
  ),
  CONSTRAINT chk_accounts_currency CHECK (currency_code = 'INR'),
  CONSTRAINT chk_accounts_masked_last4 CHECK (
    masked_last4 IS NULL OR masked_last4 REGEXP '^[0-9]{4}$'
  ),
  CONSTRAINT chk_accounts_cash_metadata CHECK (
    type <> 'cash' OR (institution_name IS NULL AND masked_last4 IS NULL)
  ),
  CONSTRAINT chk_accounts_institution CHECK (
    type NOT IN ('bank', 'credit_card') OR institution_name IS NOT NULL
  ),
  CONSTRAINT chk_accounts_opening_amount CHECK (
    (type = 'bank' AND subtype = 'current') OR opening_amount_minor >= 0
  ),
  CONSTRAINT chk_accounts_credit_fields CHECK (
    (type = 'credit_card' AND credit_limit_minor IS NOT NULL
      AND credit_limit_minor > 0 AND opening_amount_minor >= 0 AND is_default = FALSE)
    OR
    (type <> 'credit_card' AND credit_limit_minor IS NULL)
  ),
  CONSTRAINT chk_accounts_billing_days CHECK (
    (type = 'credit_card' AND (statement_closing_day IS NULL OR (statement_closing_day BETWEEN 1 AND 31))
                           AND (payment_due_day IS NULL OR (payment_due_day BETWEEN 1 AND 31)))
    OR
    (type <> 'credit_card' AND statement_closing_day IS NULL AND payment_due_day IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 5. Primary Financial Transactions Table (Consolidated 0001/0003/0005)
-- ----------------------------------------------------------------------------
CREATE TABLE transactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  account_id INT UNSIGNED NULL,
  type ENUM('income', 'expense') NOT NULL,
  title VARCHAR(150) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_date DATE NOT NULL,
  note VARCHAR(1000) NULL,
  sms_hash VARCHAR(64) NULL,
  sender VARCHAR(50) NULL,
  bank VARCHAR(50) NULL,
  reference_number VARCHAR(100) NULL,
  source ENUM('manual', 'sms') NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transactions_user_date (user_id, transaction_date),
  KEY idx_transactions_user_category (user_id, category_id),
  KEY idx_transactions_user_account (user_id, account_id, transaction_date),
  UNIQUE KEY uq_transaction_sms_hash (user_id, sms_hash),
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transactions_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT chk_transactions_amount_positive CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 6. Category Budgets Table
-- ----------------------------------------------------------------------------
CREATE TABLE budgets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  month TINYINT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_category_month_year (user_id, category_id, month, year),
  KEY idx_budgets_user_period (user_id, year, month),
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT chk_budget_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_budget_month_valid CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT chk_budget_year_valid CHECK (year BETWEEN 2000 AND 2100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 7. Inter-Account Transfers Ledger Table
-- ----------------------------------------------------------------------------
CREATE TABLE transfers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  source_account_id INT UNSIGNED NOT NULL,
  destination_account_id INT UNSIGNED NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'INR',
  transfer_date DATE NOT NULL,
  note VARCHAR(1000) NULL,
  client_transfer_key VARCHAR(100) NOT NULL,
  transfer_fingerprint CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_transfers_user_client_key (user_id, client_transfer_key),
  KEY idx_transfers_user_date (user_id, transfer_date, id),
  KEY idx_transfers_source (user_id, source_account_id, transfer_date),
  KEY idx_transfers_destination (user_id, destination_account_id, transfer_date),
  CONSTRAINT fk_transfers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transfers_source_account FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transfers_dest_account FOREIGN KEY (destination_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT chk_transfers_distinct_accounts CHECK (source_account_id <> destination_account_id),
  CONSTRAINT chk_transfers_amount_positive CHECK (amount_minor > 0),
  CONSTRAINT chk_transfers_currency CHECK (currency_code = 'INR')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 8. Auditable Account Balance Adjustments Table
-- ----------------------------------------------------------------------------
CREATE TABLE account_adjustments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  account_id INT UNSIGNED NOT NULL,
  amount_minor BIGINT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  adjustment_date DATE NOT NULL,
  client_adjustment_key VARCHAR(100) NOT NULL,
  adjustment_fingerprint CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_adjustments_user_client_key (user_id, client_adjustment_key),
  KEY idx_adjustments_account (user_id, account_id, adjustment_date, id),
  CONSTRAINT fk_adjustments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_adjustments_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT chk_adjustments_amount_nonzero CHECK (amount_minor <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 9. Smart Detected Transactions & Staged Review Table
-- ----------------------------------------------------------------------------
CREATE TABLE detected_transactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  account_id INT UNSIGNED NULL,
  category_id INT UNSIGNED NULL,
  classification ENUM('expense', 'income', 'transfer', 'refund', 'credit_card_purchase', 'credit_card_repayment') NOT NULL DEFAULT 'expense',
  amount DECIMAL(15,2) NOT NULL,
  transaction_date DATE NOT NULL,
  merchant_raw VARCHAR(255) NULL,
  merchant_clean VARCHAR(150) NOT NULL,
  bank VARCHAR(50) NULL,
  sender VARCHAR(50) NULL,
  reference_number VARCHAR(100) NULL,
  masked_account_hint VARCHAR(20) NULL,
  sms_hash VARCHAR(64) NOT NULL,
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.50,
  confidence_reason VARCHAR(255) NULL,
  suggested_account_id INT UNSIGNED NULL,
  suggested_category_id INT UNSIGNED NULL,
  is_account_ambiguous TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('detected', 'suggested', 'confirmed', 'rejected') NOT NULL DEFAULT 'suggested',
  rejection_reason VARCHAR(255) NULL,
  confirmed_transaction_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_detected_user_sms_hash (user_id, sms_hash),
  KEY idx_detected_user_status (user_id, status, transaction_date, id),
  KEY idx_detected_user_ref (user_id, reference_number),
  KEY fk_detected_account (account_id),
  KEY fk_detected_category (category_id),
  KEY fk_detected_confirmed_tx (confirmed_transaction_id),
  CONSTRAINT fk_detected_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_detected_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_detected_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_detected_confirmed_tx FOREIGN KEY (confirmed_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
  CONSTRAINT chk_detected_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_detected_confidence CHECK (confidence >= 0.00 AND confidence <= 1.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 10. Savings Goals Table
-- ----------------------------------------------------------------------------
CREATE TABLE savings_goals (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(1000) NULL,
  target_amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  target_date DATE NULL,
  starting_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  status ENUM('active', 'completed', 'archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_goals_user_status (user_id, status, target_date),
  KEY idx_goals_user_target_date (user_id, target_date),
  CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_goals_target_amount_positive CHECK (target_amount > 0),
  CONSTRAINT chk_goals_starting_amount_non_negative CHECK (starting_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 11. Goal Contributions Allocation Ledger Table
-- ----------------------------------------------------------------------------
CREATE TABLE goal_contributions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  goal_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  contribution_date DATE NOT NULL,
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_contributions_goal (goal_id, contribution_date),
  KEY idx_contributions_user (user_id, contribution_date),
  CONSTRAINT fk_contributions_goal FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE,
  CONSTRAINT fk_contributions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_contributions_amount_positive CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 12. FIN Living Companion Preferences Table
-- ----------------------------------------------------------------------------
CREATE TABLE user_companion_preferences (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  preferred_name VARCHAR(100) NULL,
  response_style ENUM('friendly', 'concise', 'detailed') NOT NULL DEFAULT 'friendly',
  enable_personalized_greetings BOOLEAN NOT NULL DEFAULT TRUE,
  enable_character_animations BOOLEAN NOT NULL DEFAULT TRUE,
  priority_goal_id INT UNSIGNED NULL,
  focus_category VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_companion_user (user_id),
  CONSTRAINT fk_companion_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_companion_priority_goal FOREIGN KEY (priority_goal_id) REFERENCES savings_goals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- Default Seed: Canonical Transaction Categories
-- ----------------------------------------------------------------------------
INSERT INTO categories (id, name, type) VALUES
  (1, 'Salary', 'income'),
  (2, 'Other Income', 'income'),
  (3, 'Food', 'expense'),
  (4, 'Transport', 'expense'),
  (5, 'Housing', 'expense'),
  (6, 'Utilities', 'expense'),
  (7, 'Healthcare', 'expense'),
  (8, 'Entertainment', 'expense'),
  (9, 'Shopping', 'expense'),
  (10, 'Education', 'expense'),
  (11, 'Travel', 'expense'),
  (12, 'Other Expense', 'expense');

-- ----------------------------------------------------------------------------
-- Migration Bookkeeping: Record Baseline Migrations 0001–0007 as Installed
-- ----------------------------------------------------------------------------
INSERT INTO schema_migrations (version, description) VALUES
  ('0001', 'Reconstructed development baseline'),
  ('0002', 'Phase 3A.1 account foundation'),
  ('0003', 'Phase 3A.3 account transactions, transfers, and balance adjustments'),
  ('0004', 'Phase 3A.4 credit card billing and repayment configuration'),
  ('0005', 'Phase 3B smart transactions and user-scoped SMS hash'),
  ('0006', 'Savings goals and contribution tracking foundation'),
  ('0007', 'User companion preferences and relationship memory');
