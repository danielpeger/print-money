-- Books, opening quotes, fill spreads, and order reasons.
-- Row level security is on and no anon or authenticated policy is added.
-- api/cron.js writes these tables with the Supabase secret key.

create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.opening_quotes (
  id bigint generated always as identity primary key,
  session_date date not null,
  symbol text not null,
  quote_at timestamptz not null,
  bid numeric(18, 6) not null,
  ask numeric(18, 6) not null,
  bid_size numeric(18, 4),
  ask_size numeric(18, 4),
  feed text not null default 'sip' check (feed = 'sip'),
  midpoint numeric(18, 6) generated always as ((bid + ask) / 2) stored,
  spread numeric(18, 6) generated always as (ask - bid) stored,
  recorded_at timestamptz not null default now(),
  unique (session_date, symbol),
  constraint opening_quotes_prices check (bid > 0 and ask >= bid),
  constraint opening_quotes_symbol check (symbol = upper(symbol))
);

create table public.fill_spread_costs (
  id bigint generated always as identity primary key,
  strategy_id uuid not null references public.strategies (id),
  opening_quote_id bigint not null references public.opening_quotes (id),
  session_date date not null,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  client_order_id text not null unique,
  shares numeric(18, 6) not null check (shares > 0),
  fill_price numeric(18, 6) not null check (fill_price > 0),
  fill_at timestamptz not null,
  spread_cost_usd numeric(18, 6) not null,
  recorded_at timestamptz not null default now()
);

create index fill_spread_costs_strategy_session_idx
  on public.fill_spread_costs (strategy_id, session_date);

create table public.order_reasons (
  id bigint generated always as identity primary key,
  strategy_id uuid not null references public.strategies (id),
  session_date date not null,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  client_order_id text not null unique,
  reason text not null check (char_length(btrim(reason)) > 0),
  recorded_at timestamptz not null default now(),
  constraint order_reasons_symbol check (symbol = upper(symbol))
);

create index order_reasons_strategy_session_idx
  on public.order_reasons (strategy_id, session_date);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  run_id text not null unique,
  session_date date,
  status text not null,
  dry_run boolean not null default false,
  detail jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint runs_status check (status in (
    'started',
    'skipped_data_not_ready',
    'signals_calculated',
    'orders_submitted',
    'reconciled',
    'failed'
  ))
);

create index runs_session_date_idx on public.runs (session_date);

create table public.run_locks (
  session_date date primary key,
  run_id text not null,
  acquired_at timestamptz not null default now(),
  released_at timestamptz
);

create table public.book_state (
  strategy_id uuid primary key references public.strategies (id),
  positions jsonb not null default '[]'::jsonb,
  cooldown jsonb not null default '[]'::jsonb,
  opened boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.order_intents (
  id bigint generated always as identity primary key,
  strategy_id uuid not null references public.strategies (id),
  run_id text not null,
  session_date date not null,
  symbol text not null,
  side text not null,
  client_order_id text not null unique,
  notional numeric(18, 2),
  qty numeric(18, 6),
  reason text not null,
  slot_kind text,
  fallback_rank integer,
  opening boolean not null default false,
  status text not null,
  broker_order_id text,
  filled_qty numeric(18, 6),
  filled_avg_price numeric(18, 6),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_intents_side check (side in ('buy', 'sell')),
  constraint order_intents_symbol check (symbol = upper(symbol))
);

create index order_intents_strategy_session_idx
  on public.order_intents (strategy_id, session_date);

create table public.signal_snapshots (
  strategy_id uuid not null references public.strategies (id),
  session_date date not null,
  run_id text not null,
  signals jsonb not null,
  primary key (strategy_id, session_date)
);

create table public.alerts (
  id bigint generated always as identity primary key,
  run_id text not null,
  session_date date,
  kind text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index alerts_run_id_idx on public.alerts (run_id);

create table public.controls (
  id integer primary key,
  kill_switch boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint controls_singleton check (id = 1)
);

alter table public.strategies enable row level security;
alter table public.opening_quotes enable row level security;
alter table public.fill_spread_costs enable row level security;
alter table public.order_reasons enable row level security;
alter table public.runs enable row level security;
alter table public.run_locks enable row level security;
alter table public.book_state enable row level security;
alter table public.order_intents enable row level security;
alter table public.signal_snapshots enable row level security;
alter table public.alerts enable row level security;
alter table public.controls enable row level security;

revoke all on public.strategies from anon, authenticated;
revoke all on public.opening_quotes from anon, authenticated;
revoke all on public.fill_spread_costs from anon, authenticated;
revoke all on public.order_reasons from anon, authenticated;
revoke all on public.runs from anon, authenticated;
revoke all on public.run_locks from anon, authenticated;
revoke all on public.book_state from anon, authenticated;
revoke all on public.order_intents from anon, authenticated;
revoke all on public.signal_snapshots from anon, authenticated;
revoke all on public.alerts from anon, authenticated;
revoke all on public.controls from anon, authenticated;

insert into public.strategies (code, name) values
  ('trend', 'Trend'),
  ('dip', 'Dip'),
  ('control', 'Control');

insert into public.controls (id, kill_switch) values (1, false);
