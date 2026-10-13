// Migraciones de base de datos. REGLA: nunca edites una migración ya publicada;
// añade una nueva al final de la lista con un id nuevo (p. ej. "002_nuevo_campo").

export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_inicial",
    sql: `
create table if not exists users (
  id serial primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'lector',
  area text,
  active boolean not null default true,
  notify jsonb not null default '{}'::jsonb,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists weeks (
  year int not null,
  week int not null,
  start_date text,
  end_date text,
  is_closed boolean not null default false,
  orders_count double precision,
  sales_eur double precision,
  sales_prev_year_eur double precision,
  quotes_sent double precision,
  quotes_confirmed double precision,
  quotes_confirmed_eur double precision,
  served_eur double precision,
  served_count double precision,
  late_orders_count double precision,
  late_orders_eur double precision,
  pending_orders_count double precision,
  pending_orders_eur double precision,
  incidents_count double precision,
  incidents_late_count double precision,
  leads_generated double precision,
  cpl_eur double precision,
  landing_conversion_pct double precision,
  leads_to_sale double precision,
  leads_contacted double precision,
  leads_contacted_24h double precision,
  leads_reassigned double precision,
  owner text,
  comment text,
  weekly_action text,
  data_source text not null default 'manual',
  updated_by int references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (year, week)
);

create table if not exists targets (
  id serial primary key,
  kpi_key text not null,
  year int,
  month int,
  week int,
  value double precision not null,
  value_max double precision,
  note text,
  updated_at timestamptz not null default now()
);
create unique index if not exists targets_scope on targets (kpi_key, coalesce(year, 0), coalesce(month, 0), coalesce(week, 0));

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists kpi_comments (
  id serial primary key,
  year int not null,
  week int not null,
  kpi_key text not null,
  text text not null,
  author_id int references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists kpi_comments_week on kpi_comments (year, week);

create table if not exists actions (
  id serial primary key,
  title text not null,
  description text,
  kpi_key text,
  year int,
  week int,
  owner text,
  due_date text,
  priority text not null default 'media',
  status text not null default 'pendiente',
  result text,
  closed_at timestamptz,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists weekly_focus (
  year int not null,
  week int not null,
  kpi_key text,
  problem text,
  action text,
  owner text,
  review_date text,
  ai_summary text,
  ai_generated_at timestamptz,
  updated_by int references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (year, week)
);

create table if not exists meetings (
  id serial primary key,
  year int not null,
  week int not null,
  attendees text,
  notes text,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, week)
);

create table if not exists imports (
  id serial primary key,
  filename text,
  mapping text,
  user_id int references users(id) on delete set null,
  created_count int not null default 0,
  updated_count int not null default 0,
  rejected_count int not null default 0,
  log jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id serial primary key,
  entity text not null,
  entity_key text not null,
  field text not null,
  old_value text,
  new_value text,
  user_id int references users(id) on delete set null,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_entity on audit_log (entity, entity_key);
`,
  },
  {
    id: "002_comentarios_periodo",
    sql: `
create table if not exists period_comments (
  year int not null,
  kind text not null,
  period text not null,
  text text,
  updated_by int references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (year, kind, period)
);
`,
  },
  {
    // Con el driver de Postgres los JSON se guardaban como texto ("{...}"). Los convierte a JSON real.
    id: "003_reparar_json",
    sql: `
update settings set value = (value #>> '{}')::jsonb where jsonb_typeof(value) = 'string' and key <> 'seeded';
update users set notify = (notify #>> '{}')::jsonb where jsonb_typeof(notify) = 'string';
update imports set log = (log #>> '{}')::jsonb where jsonb_typeof(log) = 'string';
`,
  },
];
