-- Lune Finance Schema (PostgreSQL >= 13)

CREATE TABLE users (
    id bigserial PRIMARY KEY,
    email varchar(255) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    display_name varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE businesses (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    legal_form varchar(50),
    registration_number varchar(100),
    tax_id varchar(50),
    currency varchar(10),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_businesses UNIQUE (user_id, name)
);
CREATE INDEX idx_businesses_user_active ON businesses(user_id, is_active);

CREATE TABLE business_settings (
    business_id bigint PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    invoice_prefix varchar(20),
    invoice_next_number int NOT NULL DEFAULT 1 CHECK (invoice_next_number >= 1),
    quote_prefix varchar(20),
    quote_next_number int NOT NULL DEFAULT 1 CHECK (quote_next_number >= 1),
    default_vat_rate numeric(5,2) CHECK (default_vat_rate IS NULL OR (default_vat_rate >= 0 AND default_vat_rate <= 100)),
    default_payment_terms_days int NOT NULL DEFAULT 30 CHECK (default_payment_terms_days >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_settings (
    user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    main_currency varchar(10) NOT NULL DEFAULT 'EUR',
    first_day_of_month int NOT NULL DEFAULT 1 CHECK (first_day_of_month BETWEEN 1 AND 28),
    risk_tolerance varchar(20) CHECK (risk_tolerance IS NULL OR risk_tolerance IN ('low', 'medium', 'high')),
    notification_level varchar(20) CHECK (notification_level IS NULL OR notification_level IN ('none', 'light', 'normal', 'coach')),
    main_goal_type varchar(30),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    type varchar(50),
    email varchar(255),
    phone varchar(50),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_user_name ON contacts(user_id, name);

CREATE TABLE accounts (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id bigint REFERENCES businesses(id) ON DELETE SET NULL,
    name varchar(255) NOT NULL,
    type varchar(30) NOT NULL CHECK (type IN ('current', 'savings', 'investment', 'cash', 'other')),
    currency varchar(10) NOT NULL,
    provider varchar(100),
    is_active boolean NOT NULL DEFAULT true,
    include_in_budget boolean NOT NULL DEFAULT true,
    include_in_net_worth boolean NOT NULL DEFAULT true,
    connection_type varchar(30) CHECK (connection_type IS NULL OR connection_type IN ('manual', 'aggregator', 'api')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_accounts_business ON accounts(business_id);

CREATE TABLE categories (
    id bigserial PRIMARY KEY,
    user_id bigint REFERENCES users(id) ON DELETE CASCADE,
    name varchar(100) NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('income', 'expense', 'neutral')),
    parent_id bigint REFERENCES categories(id) ON DELETE SET NULL,
    is_system boolean NOT NULL DEFAULT false,
    include_in_budget boolean NOT NULL DEFAULT true,
    include_in_reports boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_categories_user_name_type_non_system ON categories(user_id, name, type) WHERE is_system = false;

CREATE TABLE category_groups (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(100) NOT NULL,
    description text,
    color varchar(20),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_category_groups UNIQUE (user_id, name)
);

CREATE TABLE category_group_members (
    id bigserial PRIMARY KEY,
    group_id bigint NOT NULL REFERENCES category_groups(id) ON DELETE CASCADE,
    category_id bigint NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_category_group_members UNIQUE (group_id, category_id)
);
CREATE INDEX idx_category_group_members_category ON category_group_members(category_id);

CREATE TABLE projects (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    description text,
    start_date date,
    end_date date,
    target_budget numeric(12,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

CREATE TABLE services (
    id bigserial PRIMARY KEY,
    business_id bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    type varchar(30),
    billing_mode varchar(20) NOT NULL CHECK (billing_mode IN ('fixed', 'hourly', 'daily', 'recurring', 'unit')),
    description text,
    unit_label varchar(30),
    default_price numeric(12,2),
    default_vat_rate numeric(5,2) CHECK (default_vat_rate IS NULL OR (default_vat_rate >= 0 AND default_vat_rate <= 100)),
    default_internal_cost numeric(12,2),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_services UNIQUE (business_id, name)
);
CREATE INDEX idx_services_business_active ON services(business_id, is_active);

CREATE TABLE clients (
    id bigserial PRIMARY KEY,
    business_id bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    contact_name varchar(255),
    email varchar(255),
    phone varchar(50),
    billing_address text,
    shipping_address text,
    vat_number varchar(50),
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'prospect')),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_clients UNIQUE (business_id, name)
);
CREATE INDEX idx_clients_business_status ON clients(business_id, status);

CREATE TABLE suppliers (
    id bigserial PRIMARY KEY,
    business_id bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    contact_name varchar(255),
    email varchar(255),
    phone varchar(50),
    billing_address text,
    vat_number varchar(50),
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_suppliers UNIQUE (business_id, name)
);
CREATE INDEX idx_suppliers_business_status ON suppliers(business_id, status);

CREATE TABLE business_projects (
    id bigserial PRIMARY KEY,
    business_id bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    client_id bigint REFERENCES clients(id) ON DELETE SET NULL,
    name varchar(255) NOT NULL,
    type varchar(50),
    status varchar(20) NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'proposal', 'active', 'on_hold', 'completed', 'cancelled')),
    budget_ht numeric(12,2),
    expected_margin_pct numeric(5,2),
    start_date date,
    end_date date,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date),
    CONSTRAINT uq_business_projects UNIQUE (business_id, name)
);
CREATE INDEX idx_business_projects_business_status ON business_projects(business_id, status);

CREATE TABLE project_service_lines (
    id bigserial PRIMARY KEY,
    project_id bigint NOT NULL REFERENCES business_projects(id) ON DELETE CASCADE,
    service_id bigint REFERENCES services(id) ON DELETE SET NULL,
    description varchar(255) NOT NULL,
    quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
    unit_price numeric(12,2),
    vat_rate numeric(5,2) CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),
    discount_pct numeric(5,2) CHECK (discount_pct IS NULL OR (discount_pct >= 0 AND discount_pct <= 100)),
    internal_cost_per_unit numeric(12,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_service_lines_project ON project_service_lines(project_id);

CREATE TABLE quotes (
    id bigserial PRIMARY KEY,
    business_id bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    client_id bigint NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    project_id bigint REFERENCES business_projects(id) ON DELETE SET NULL,
    quote_number varchar(50) NOT NULL,
    issue_date date NOT NULL,
    valid_until date,
    status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled')),
    currency varchar(10),
    subtotal_ht numeric(12,2) NOT NULL DEFAULT 0,
    discount_total numeric(12,2) NOT NULL DEFAULT 0,
    vat_total numeric(12,2) NOT NULL DEFAULT 0,
    total_ht numeric(12,2) NOT NULL DEFAULT 0,
    total_ttc numeric(12,2) NOT NULL DEFAULT 0,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (valid_until IS NULL OR issue_date <= valid_until),
    CONSTRAINT uq_quotes UNIQUE (business_id, quote_number)
);
CREATE INDEX idx_quotes_business_status ON quotes(business_id, status);
CREATE INDEX idx_quotes_business_client ON quotes(business_id, client_id);

CREATE TABLE quote_lines (
    id bigserial PRIMARY KEY,
    quote_id bigint NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    service_id bigint REFERENCES services(id) ON DELETE SET NULL,
    description text NOT NULL,
    quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
    unit varchar(30),
    unit_price numeric(12,2) NOT NULL DEFAULT 0,
    vat_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (vat_rate >= 0 AND vat_rate <= 100),
    discount_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_lines_quote ON quote_lines(quote_id);

CREATE TABLE invoices (
    id bigserial PRIMARY KEY,
    business_id bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    client_id bigint NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    project_id bigint REFERENCES business_projects(id) ON DELETE SET NULL,
    quote_id bigint REFERENCES quotes(id) ON DELETE SET NULL,
    invoice_number varchar(50) NOT NULL,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
    currency varchar(10),
    payment_terms_days int DEFAULT 30 CHECK (payment_terms_days IS NULL OR payment_terms_days >= 0),
    subtotal_ht numeric(12,2) NOT NULL DEFAULT 0,
    discount_total numeric(12,2) NOT NULL DEFAULT 0,
    vat_total numeric(12,2) NOT NULL DEFAULT 0,
    total_ht numeric(12,2) NOT NULL DEFAULT 0,
    total_ttc numeric(12,2) NOT NULL DEFAULT 0,
    amount_paid_cached numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid_cached >= 0),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (invoice_date <= due_date),
    CONSTRAINT uq_invoices UNIQUE (business_id, invoice_number)
);
CREATE INDEX idx_invoices_business_status ON invoices(business_id, status);
CREATE INDEX idx_invoices_business_due_date ON invoices(business_id, due_date);
CREATE INDEX idx_invoices_business_client ON invoices(business_id, client_id);

CREATE TABLE invoice_lines (
    id bigserial PRIMARY KEY,
    invoice_id bigint NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    service_id bigint REFERENCES services(id) ON DELETE SET NULL,
    description text NOT NULL,
    quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
    unit varchar(30),
    unit_price numeric(12,2) NOT NULL DEFAULT 0,
    vat_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (vat_rate >= 0 AND vat_rate <= 100),
    discount_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id);

CREATE TABLE income_sources (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    type varchar(30) CHECK (type IS NULL OR type IN ('salary', 'side_gig', 'freelance', 'business', 'pension', 'benefit', 'other')),
    contact_id bigint REFERENCES contacts(id) ON DELETE SET NULL,
    account_id bigint REFERENCES accounts(id) ON DELETE SET NULL,
    default_category_id bigint REFERENCES categories(id) ON DELETE SET NULL,
    default_frequency varchar(30),
    is_active boolean NOT NULL DEFAULT true,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_income_sources UNIQUE (user_id, name)
);
CREATE INDEX idx_income_sources_user_status ON income_sources(user_id, is_active);

CREATE TABLE recurring_series (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label varchar(255) NOT NULL,
    category_id bigint REFERENCES categories(id) ON DELETE SET NULL,
    amount_estimated numeric(12,2),
    frequency varchar(30),
    next_expected_date date,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_recurring_series_user_active ON recurring_series(user_id, is_active);

CREATE TABLE recurring_contracts (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    category_id bigint REFERENCES categories(id) ON DELETE SET NULL,
    account_id bigint REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id bigint REFERENCES contacts(id) ON DELETE SET NULL,
    amount_expected numeric(12,2) CHECK (amount_expected IS NULL OR amount_expected >= 0),
    frequency varchar(30) NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly', 'custom')),
    next_due_date date,
    start_date date,
    end_date date,
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended', 'cancelled')),
    auto_pay boolean NOT NULL DEFAULT false,
    tolerance_pct numeric(5,2) CHECK (tolerance_pct IS NULL OR (tolerance_pct >= 0 AND tolerance_pct <= 100)),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);
CREATE INDEX idx_recurring_contracts_user_status ON recurring_contracts(user_id, status);

CREATE TABLE recurring_contract_occurrences (
    id bigserial PRIMARY KEY,
    contract_id bigint NOT NULL REFERENCES recurring_contracts(id) ON DELETE CASCADE,
    due_date date NOT NULL,
    amount_expected numeric(12,2),
    amount_paid numeric(12,2),
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'skipped', 'cancelled', 'overdue')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_recurring_contract_occurrences UNIQUE (contract_id, due_date)
);
CREATE INDEX idx_recurring_contract_occurrences_contract_date ON recurring_contract_occurrences(contract_id, due_date);
CREATE INDEX idx_recurring_contract_occurrences_status ON recurring_contract_occurrences(status);

CREATE TABLE import_batches (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source varchar(50),
    external_reference varchar(100),
    status varchar(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    imported_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_batches_user_imported_at ON import_batches(user_id, imported_at);

CREATE TABLE transactions (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id bigint REFERENCES businesses(id) ON DELETE SET NULL,
    account_id bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date date NOT NULL,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    direction varchar(3) NOT NULL CHECK (direction IN ('in', 'out')),
    type varchar(30) NOT NULL CHECK (type IN ('income', 'expense', 'saving_in', 'saving_out', 'transfer', 'debt_payment', 'investment_trade', 'other')),
    label varchar(255) NOT NULL,
    raw_label varchar(255),
    category_id bigint REFERENCES categories(id) ON DELETE SET NULL,
    project_id bigint REFERENCES projects(id) ON DELETE SET NULL,
    contact_id bigint REFERENCES contacts(id) ON DELETE SET NULL,
    income_source_id bigint REFERENCES income_sources(id) ON DELETE SET NULL,
    invoice_id bigint REFERENCES invoices(id) ON DELETE SET NULL,
    supplier_id bigint REFERENCES suppliers(id) ON DELETE SET NULL,
    notes text,
    tags text,
    is_recurring boolean NOT NULL DEFAULT false,
    recurring_series_id bigint REFERENCES recurring_series(id) ON DELETE SET NULL,
    import_source varchar(50),
    import_batch_id bigint REFERENCES import_batches(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_transactions_user_category_date ON transactions(user_id, category_id, date);
CREATE INDEX idx_transactions_user_income_source_date ON transactions(user_id, income_source_id, date);
CREATE INDEX idx_transactions_business_date ON transactions(business_id, date);
CREATE INDEX idx_transactions_invoice ON transactions(invoice_id);
CREATE INDEX idx_transactions_supplier_date ON transactions(supplier_id, date);

CREATE TABLE invoice_payments (
    id bigserial PRIMARY KEY,
    invoice_id bigint NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    transaction_id bigint REFERENCES transactions(id) ON DELETE SET NULL,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    paid_at date NOT NULL,
    method varchar(30),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_invoice_payments_transaction ON invoice_payments(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);

CREATE TABLE recurring_contract_occurrence_transactions (
    id bigserial PRIMARY KEY,
    occurrence_id bigint NOT NULL REFERENCES recurring_contract_occurrences(id) ON DELETE CASCADE,
    transaction_id bigint NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    amount_applied numeric(12,2) CHECK (amount_applied IS NULL OR amount_applied >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_recurring_contract_occurrence_tx UNIQUE (occurrence_id, transaction_id)
);
CREATE INDEX idx_recurring_contract_occurrence_transactions_tx ON recurring_contract_occurrence_transactions(transaction_id);

CREATE TABLE transaction_rules (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    match_field varchar(30) NOT NULL CHECK (match_field IN ('label', 'raw_label', 'notes', 'tags')),
    pattern text NOT NULL,
    category_id bigint REFERENCES categories(id) ON DELETE SET NULL,
    income_source_id bigint REFERENCES income_sources(id) ON DELETE SET NULL,
    set_tags text,
    priority int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_transaction_rules UNIQUE (user_id, name)
);
CREATE INDEX idx_transaction_rules_user_active_priority ON transaction_rules(user_id, is_active, priority DESC);

CREATE TABLE account_daily_balance (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date date NOT NULL,
    balance_end_of_day numeric(12,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_account_daily_balance UNIQUE (account_id, date)
);

CREATE TABLE monthly_summary (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year int NOT NULL,
    month int NOT NULL CHECK (month BETWEEN 1 AND 12),
    total_income numeric(12,2) NOT NULL DEFAULT 0,
    total_expense numeric(12,2) NOT NULL DEFAULT 0,
    total_saving_in numeric(12,2) NOT NULL DEFAULT 0,
    total_saving_out numeric(12,2) NOT NULL DEFAULT 0,
    net_cashflow numeric(12,2) NOT NULL DEFAULT 0,
    net_after_saving numeric(12,2) NOT NULL DEFAULT 0,
    pct_income_spent numeric(5,2),
    pct_income_saved numeric(5,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_monthly_summary UNIQUE (user_id, year, month)
);

CREATE TABLE category_monthly_summary (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id bigint NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    year int NOT NULL,
    month int NOT NULL CHECK (month BETWEEN 1 AND 12),
    direction varchar(3) NOT NULL CHECK (direction IN ('in', 'out')),
    total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    nb_transactions int NOT NULL DEFAULT 0 CHECK (nb_transactions >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_category_monthly_summary UNIQUE (user_id, category_id, year, month, direction)
);

CREATE TABLE budgets (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255),
    period_type varchar(20) NOT NULL CHECK (period_type IN ('monthly', 'custom')),
    year int,
    month int,
    start_date date,
    end_date date,
    scenario varchar(20) NOT NULL DEFAULT 'base' CHECK (scenario IN ('base', 'optimistic', 'conservative', 'custom')),
    version_no int NOT NULL DEFAULT 1 CHECK (version_no >= 1),
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    total_spending_limit numeric(12,2),
    include_accounts jsonb,
    auto_generated boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (period_type = 'monthly' AND year IS NOT NULL AND month BETWEEN 1 AND 12)
        OR (period_type = 'custom' AND start_date IS NOT NULL AND end_date IS NOT NULL)
    ),
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);
CREATE UNIQUE INDEX uq_budgets_monthly_version ON budgets(user_id, year, month, scenario, version_no) WHERE period_type = 'monthly';
CREATE UNIQUE INDEX uq_budgets_custom_version ON budgets(user_id, start_date, end_date, scenario, version_no) WHERE period_type = 'custom';

CREATE TABLE budget_lines (
    id bigserial PRIMARY KEY,
    budget_id bigint NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    category_id bigint NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    category_group_id bigint REFERENCES category_groups(id) ON DELETE SET NULL,
    spending_limit numeric(12,2) CHECK (spending_limit IS NULL OR spending_limit >= 0),
    priority varchar(20) CHECK (priority IS NULL OR priority IN ('essential', 'comfort', 'nice_to_have')),
    alert_threshold_pct numeric(5,2) DEFAULT 80 CHECK (alert_threshold_pct BETWEEN 0 AND 100),
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_budget_lines UNIQUE (budget_id, category_id)
);
CREATE INDEX idx_budget_lines_category_group ON budget_lines(category_group_id);

CREATE TABLE savings_goals (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    target_amount numeric(12,2) NOT NULL CHECK (target_amount > 0),
    target_date date,
    priority varchar(20) CHECK (priority IS NULL OR priority IN ('low', 'normal', 'high')),
    linked_account_id bigint REFERENCES accounts(id) ON DELETE SET NULL,
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    current_amount_cached numeric(12,2) NOT NULL DEFAULT 0 CHECK (current_amount_cached >= 0),
    color varchar(20),
    emoji varchar(10),
    completed_at date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_savings_goals_user_status ON savings_goals(user_id, status);

CREATE TABLE savings_goal_progress_monthly (
    id bigserial PRIMARY KEY,
    goal_id bigint NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
    year int NOT NULL,
    month int NOT NULL CHECK (month BETWEEN 1 AND 12),
    amount_saved numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_saved >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_savings_goal_progress UNIQUE (goal_id, year, month)
);

CREATE TABLE savings_goal_allocations (
    id bigserial PRIMARY KEY,
    goal_id bigint NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
    transaction_id bigint NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_savings_goal_allocations UNIQUE (goal_id, transaction_id)
);

CREATE TABLE debts (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id bigint REFERENCES contacts(id) ON DELETE SET NULL,
    name varchar(255) NOT NULL,
    principal_amount numeric(12,2) NOT NULL CHECK (principal_amount > 0),
    interest_rate numeric(5,2) CHECK (interest_rate IS NULL OR (interest_rate >= 0 AND interest_rate <= 100)),
    start_date date,
    end_date_expected date,
    repayment_type varchar(20) CHECK (repayment_type IS NULL OR repayment_type IN ('amortizing', 'bullet', 'flexible')),
    monthly_payment_expected numeric(12,2) CHECK (monthly_payment_expected IS NULL OR monthly_payment_expected >= 0),
    linked_account_id bigint REFERENCES accounts(id) ON DELETE SET NULL,
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'written_off', 'cancelled')),
    grace_period_days int CHECK (grace_period_days IS NULL OR grace_period_days >= 0),
    collateral_description text,
    current_balance_cached numeric(14,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_debts_user_status ON debts(user_id, status);

CREATE TABLE claims (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id bigint REFERENCES contacts(id) ON DELETE SET NULL,
    name varchar(255) NOT NULL,
    principal_amount numeric(12,2) NOT NULL CHECK (principal_amount > 0),
    due_date date,
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'written_off', 'cancelled')),
    grace_period_days int CHECK (grace_period_days IS NULL OR grace_period_days >= 0),
    collateral_description text,
    current_balance_cached numeric(14,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_claims_user_status ON claims(user_id, status);

CREATE TABLE payment_schedules (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    debt_id bigint REFERENCES debts(id) ON DELETE CASCADE,
    claim_id bigint REFERENCES claims(id) ON DELETE CASCADE,
    date_due date NOT NULL,
    principal_due numeric(12,2) NOT NULL CHECK (principal_due >= 0),
    interest_due numeric(12,2) NOT NULL DEFAULT 0 CHECK (interest_due >= 0),
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'late')),
    transaction_id bigint REFERENCES transactions(id) ON DELETE SET NULL,
    paid_at date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(debt_id, claim_id) = 1)
);
CREATE INDEX idx_payment_schedules_user_date_due ON payment_schedules(user_id, date_due);
CREATE INDEX idx_payment_schedules_user_status ON payment_schedules(user_id, status);

CREATE TABLE planned_cashflow (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year int NOT NULL,
    month int NOT NULL CHECK (month BETWEEN 1 AND 12),
    scenario varchar(20) NOT NULL DEFAULT 'base' CHECK (scenario IN ('base', 'optimistic', 'conservative', 'custom')),
    status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'archived')),
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_planned_cashflow UNIQUE (user_id, year, month, scenario)
);
CREATE INDEX idx_planned_cashflow_user_date ON planned_cashflow(user_id, year, month);

CREATE TABLE planned_cashflow_lines (
    id bigserial PRIMARY KEY,
    plan_id bigint NOT NULL REFERENCES planned_cashflow(id) ON DELETE CASCADE,
    category_id bigint REFERENCES categories(id) ON DELETE SET NULL,
    category_group_id bigint REFERENCES category_groups(id) ON DELETE SET NULL,
    income_source_id bigint REFERENCES income_sources(id) ON DELETE SET NULL,
    direction varchar(3) NOT NULL CHECK (direction IN ('in', 'out')),
    type varchar(20) CHECK (type IS NULL OR type IN ('income', 'expense', 'saving', 'transfer')),
    label varchar(255),
    amount_planned numeric(12,2) NOT NULL CHECK (amount_planned >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (category_id IS NOT NULL OR category_group_id IS NOT NULL OR income_source_id IS NOT NULL OR label IS NOT NULL)
);
CREATE INDEX idx_planned_cashflow_lines_plan_direction ON planned_cashflow_lines(plan_id, direction);

CREATE TABLE cashflow_projections_monthly (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year int NOT NULL,
    month int NOT NULL CHECK (month BETWEEN 1 AND 12),
    scenario varchar(20) NOT NULL DEFAULT 'base' CHECK (scenario IN ('base', 'optimistic', 'conservative', 'custom')),
    projection_method varchar(30),
    projected_income numeric(12,2) NOT NULL DEFAULT 0,
    projected_expense numeric(12,2) NOT NULL DEFAULT 0,
    projected_saving_in numeric(12,2) NOT NULL DEFAULT 0,
    projected_saving_out numeric(12,2) NOT NULL DEFAULT 0,
    projected_net_cashflow numeric(12,2) NOT NULL DEFAULT 0,
    confidence_pct numeric(5,2) CHECK (confidence_pct IS NULL OR (confidence_pct >= 0 AND confidence_pct <= 100)),
    generated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_cashflow_projections UNIQUE (user_id, year, month, scenario)
);
CREATE INDEX idx_cashflow_projections_user_date ON cashflow_projections_monthly(user_id, year, month);

CREATE TABLE portfolios (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    account_id bigint REFERENCES accounts(id) ON DELETE SET NULL,
    type varchar(30) NOT NULL CHECK (type IN ('brokerage', 'assurance_vie', 'crypto', 'real_estate', 'other')),
    currency varchar(10) NOT NULL,
    goal varchar(50),
    risk_tolerance_override varchar(20) CHECK (risk_tolerance_override IS NULL OR risk_tolerance_override IN ('low', 'medium', 'high')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE investment_positions (
    id bigserial PRIMARY KEY,
    portfolio_id bigint NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    symbol varchar(50) NOT NULL,
    name varchar(255),
    asset_type varchar(30),
    sector varchar(100),
    region varchar(100),
    quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    avg_cost numeric(12,4) CHECK (avg_cost IS NULL OR avg_cost >= 0),
    invested_amount numeric(14,2) CHECK (invested_amount IS NULL OR invested_amount >= 0),
    current_price numeric(12,4) CHECK (current_price IS NULL OR current_price >= 0),
    current_value numeric(14,2),
    unrealized_pl_amount numeric(14,2),
    unrealized_pl_pct numeric(7,4),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_investment_positions UNIQUE (portfolio_id, symbol)
);

CREATE TABLE investment_movements (
    id bigserial PRIMARY KEY,
    portfolio_id bigint NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    position_id bigint REFERENCES investment_positions(id) ON DELETE CASCADE,
    date date NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('buy', 'sell', 'dividend', 'fee', 'interest', 'deposit', 'withdrawal')),
    quantity numeric(18,6) CHECK (quantity IS NULL OR quantity >= 0),
    price numeric(12,4) CHECK (price IS NULL OR price >= 0),
    fees numeric(12,2) CHECK (fees IS NULL OR fees >= 0),
    cash_amount numeric(14,2),
    linked_transaction_id bigint REFERENCES transactions(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_investment_movements_portfolio_date ON investment_movements(portfolio_id, date);

CREATE TABLE alert_settings (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type varchar(50) NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    threshold numeric(12,4),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_alert_settings UNIQUE (user_id, type)
);

CREATE TABLE alerts (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type varchar(50) NOT NULL,
    related_entity_type varchar(50),
    related_entity_id bigint,
    message text NOT NULL,
    severity varchar(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    created_at timestamptz NOT NULL DEFAULT now(),
    seen_at timestamptz
);
CREATE INDEX idx_alerts_user_created ON alerts(user_id, created_at);

CREATE TABLE currency_rates (
    id bigserial PRIMARY KEY,
    base_currency varchar(10) NOT NULL,
    quote_currency varchar(10) NOT NULL,
    rate numeric(18,6) NOT NULL CHECK (rate > 0),
    rate_date date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_currency_rates UNIQUE (base_currency, quote_currency, rate_date)
);

CREATE TABLE business_monthly_summary (
    id bigserial PRIMARY KEY,
    business_id bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    year int NOT NULL,
    month int NOT NULL CHECK (month BETWEEN 1 AND 12),
    total_invoiced_ht numeric(12,2) NOT NULL DEFAULT 0,
    total_invoiced_ttc numeric(12,2) NOT NULL DEFAULT 0,
    total_collected numeric(12,2) NOT NULL DEFAULT 0,
    total_costs numeric(12,2) NOT NULL DEFAULT 0,
    gross_margin_ht numeric(12,2) NOT NULL DEFAULT 0,
    gross_margin_pct numeric(5,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_business_monthly_summary UNIQUE (business_id, year, month)
);
CREATE INDEX idx_business_monthly_summary_date ON business_monthly_summary(business_id, year, month);

CREATE TABLE client_monthly_summary (
    id bigserial PRIMARY KEY,
    business_id bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    client_id bigint NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    year int NOT NULL,
    month int NOT NULL CHECK (month BETWEEN 1 AND 12),
    total_invoiced_ht numeric(12,2) NOT NULL DEFAULT 0,
    total_invoiced_ttc numeric(12,2) NOT NULL DEFAULT 0,
    total_collected numeric(12,2) NOT NULL DEFAULT 0,
    total_costs numeric(12,2) NOT NULL DEFAULT 0,
    gross_margin_ht numeric(12,2) NOT NULL DEFAULT 0,
    gross_margin_pct numeric(5,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_client_monthly_summary UNIQUE (business_id, client_id, year, month)
);
CREATE INDEX idx_client_monthly_summary_date ON client_monthly_summary(business_id, client_id, year, month);
-- ============================================================
-- Attachments (documents liés : factures PDF, devis, contrats…)
-- ============================================================

CREATE TABLE attachments (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id bigint REFERENCES businesses(id) ON DELETE SET NULL,
    related_type varchar(50) NOT NULL CHECK (
        related_type IN (
            'invoice',
            'quote',
            'business_project',
            'transaction',
            'business',
            'client',
            'supplier',
            'service',
            'recurring_contract',
            'recurring_contract_occurrence'
        )
    ),
    related_id bigint NOT NULL,
    file_url text NOT NULL,
    filename varchar(255),
    mime_type varchar(100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_related ON attachments(related_type, related_id);
CREATE INDEX idx_attachments_business ON attachments(business_id);