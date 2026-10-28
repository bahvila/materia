-- Baseline idempotente do banco Matéria Education.
-- O projeto remoto já possui estas tabelas; IF NOT EXISTS permite versionar sem recriá-las.

begin;
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text, email text, avatar_url text, telefone text,
  tipo_usuario text not null default 'aluno', status text not null default 'ativo',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(), nome text not null, slug text not null unique,
  descricao text, preco_centavos integer not null, moeda text not null default 'BRL',
  intervalo text not null, intervalo_quantidade integer not null default 1,
  recursos jsonb not null default '{}'::jsonb, provider_price_id text,
  ativo boolean not null default true, ordem integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.payment_customers (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null, provider_customer_id text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(provider, provider_customer_id), unique(user_id, provider)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict, status text not null,
  provider text not null, provider_subscription_id text, provider_customer_id text,
  current_period_start timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean not null default false, canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(provider, provider_subscription_id)
);

create table if not exists public.apostilas (
  id uuid primary key default gen_random_uuid(), titulo text not null, slug text not null unique,
  subtitulo text, descricao text, capa_path text, pdf_path text,
  preco_centavos integer not null default 0, moeda text not null default 'BRL',
  ano integer, categoria text, tags text[] not null default '{}', total_paginas integer,
  paginas_gratis integer not null default 20, status text not null default 'rascunho',
  destaque boolean not null default false, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);

create table if not exists public.simulados (
  id uuid primary key default gen_random_uuid(), titulo text not null, slug text not null unique,
  descricao text, imagem_path text, categoria text, nivel text, duracao_minutos integer,
  quantidade_questoes integer, is_premium boolean not null default false,
  status text not null default 'rascunho', configuracao jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(), enunciado text not null, comentario text,
  dificuldade text, assunto text, subsecao text, secao text, capitulo text, modulo text, bloco text,
  status text not null default 'rascunho', metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(), question_id uuid not null references public.questions(id) on delete cascade,
  letra text, texto text not null, correta boolean not null default false, ordem integer not null,
  created_at timestamptz not null default now(), unique(question_id, letra), unique(question_id, ordem)
);

create table if not exists public.simulado_questions (
  simulado_id uuid not null references public.simulados(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  ordem integer, peso numeric(8,2) not null default 1, created_at timestamptz not null default now(),
  primary key(simulado_id, question_id), unique(simulado_id, ordem)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(), codigo text not null unique, tipo text not null,
  valor numeric(12,2) not null default 0, apostila_id uuid references public.apostilas(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null, limite_total integer, limite_por_usuario integer,
  valid_from timestamptz, valid_until timestamptz, ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null, subtotal_centavos integer not null default 0, desconto_centavos integer not null default 0,
  total_centavos integer not null default 0, moeda text not null default 'BRL',
  coupon_id uuid references public.coupons(id) on delete set null, idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), paid_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  tipo text not null, apostila_id uuid references public.apostilas(id) on delete restrict,
  plan_id uuid references public.plans(id) on delete restrict, descricao text not null,
  quantidade integer not null default 1, valor_unitario_centavos integer not null,
  total_centavos integer not null, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict, provider text not null,
  provider_payment_id text, status text not null, metodo text, valor_centavos integer not null,
  moeda text not null default 'BRL', paid_at timestamptz, refunded_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(provider, provider_payment_id)
);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(), provider text not null, provider_event_id text not null,
  event_type text, payload jsonb not null, status text not null default 'received',
  processed_at timestamptz, error_message text, created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(), coupon_id uuid not null references public.coupons(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  apostila_id uuid references public.apostilas(id) on delete set null, redeemed_at timestamptz not null default now()
);

create table if not exists public.user_apostilas (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  apostila_id uuid not null references public.apostilas(id) on delete cascade, origem text not null,
  order_id uuid references public.orders(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(), expires_at timestamptz, revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb, unique(user_id, apostila_id)
);

create table if not exists public.reading_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  apostila_id uuid not null references public.apostilas(id) on delete cascade,
  pagina_atual integer not null default 1, percentual numeric(5,2) not null default 0,
  last_read_at timestamptz not null default now(), primary key(user_id, apostila_id)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  simulado_id uuid not null references public.simulados(id) on delete restrict,
  modo text not null, status text not null, total_questoes integer not null default 0,
  total_acertos integer not null default 0, nota numeric(8,2), duracao_segundos integer,
  configuracao jsonb not null default '{}'::jsonb, started_at timestamptz not null default now(), finished_at timestamptz
);

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  selected_option_id uuid references public.question_options(id) on delete set null,
  correta boolean, tempo_segundos integer, answered_at timestamptz not null default now(), unique(attempt_id, question_id)
);

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key, admin_user_id uuid references public.profiles(id) on delete set null,
  action text not null, entity_type text, entity_id text, old_data jsonb, new_data jsonb,
  ip_address inet, created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_status_idx on public.subscriptions(user_id, status);
create index if not exists apostilas_status_idx on public.apostilas(status, published_at desc);
create index if not exists apostilas_tags_idx on public.apostilas using gin(tags);
create index if not exists simulados_status_idx on public.simulados(status, published_at desc);
create index if not exists questions_taxonomy_idx on public.questions(assunto, secao, modulo);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists payments_user_created_idx on public.payments(user_id, created_at desc);
create index if not exists user_apostilas_user_idx on public.user_apostilas(user_id, revoked_at, expires_at);
create index if not exists attempts_user_created_idx on public.attempts(user_id, started_at desc);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.payment_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.apostilas enable row level security;
alter table public.simulados enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.simulado_questions enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.user_apostilas enable row level security;
alter table public.reading_progress enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.admin_audit_logs enable row level security;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('apostila-capas','apostila-capas',true,10485760,array['image/jpeg','image/png','image/webp']),
  ('apostila-pdfs','apostila-pdfs',false,104857600,array['application/pdf']),
  ('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

commit;
