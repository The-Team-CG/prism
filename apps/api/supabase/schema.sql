create table if not exists floor_plans (
  id text primary key,
  name text not null,
  width integer not null default 1400,
  height integer not null default 900,
  grid_size integer not null default 20,
  owner_id text not null,
  template_id text,
  event_id text,
  objects jsonb not null default '[]'::jsonb,
  seats jsonb not null default '[]'::jsonb,
  seat_categories jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists floor_plan_objects (
  floor_plan_id text not null references floor_plans(id) on delete cascade,
  object_id text not null,
  kind text not null,
  z_index integer not null default 0,
  object_data jsonb not null,
  svg_markup text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (floor_plan_id, object_id)
);

create table if not exists venue_templates (
  id text primary key,
  owner_id text not null,
  name text not null,
  description text not null default '',
  venue_rules text not null default '',
  permanent_features jsonb not null default '[]'::jsonb,
  floor_plan_id text not null unique references floor_plans(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Migration: add new columns to existing venue_templates table
alter table venue_templates add column if not exists venue_rules text not null default '';
alter table venue_templates add column if not exists permanent_features jsonb not null default '[]'::jsonb;

create table if not exists event_instances (
  id text primary key,
  owner_id text not null,
  template_id text not null references venue_templates(id) on delete cascade,
  floor_plan_id text not null unique references floor_plans(id) on delete cascade,
  name text not null,
  starts_at timestamptz not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists published_snapshots (
  id text primary key,
  slug text not null unique,
  event_id text not null unique references event_instances(id) on delete cascade,
  floor_plan jsonb not null,
  published_at timestamptz not null default now()
);

create or replace function set_floor_plans_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create or replace function set_floor_plan_objects_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_floor_plans_updated_at on floor_plans;
create trigger trg_floor_plans_updated_at
before update on floor_plans
for each row
execute function set_floor_plans_updated_at();

drop trigger if exists trg_floor_plan_objects_updated_at on floor_plan_objects;
create trigger trg_floor_plan_objects_updated_at
before update on floor_plan_objects
for each row
execute function set_floor_plan_objects_updated_at();

create index if not exists idx_floor_plans_template_id on floor_plans(template_id);
create index if not exists idx_floor_plans_event_id on floor_plans(event_id);
create index if not exists idx_floor_plan_objects_floor_plan_z on floor_plan_objects(floor_plan_id, z_index);
create index if not exists idx_floor_plan_objects_kind on floor_plan_objects(kind);
create index if not exists idx_venue_templates_created_at on venue_templates(created_at desc);
create index if not exists idx_event_instances_created_at on event_instances(created_at desc);
