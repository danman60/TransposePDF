begin;

create extension if not exists pgcrypto;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table public.songs (
  id uuid primary key, team_id uuid not null references public.teams(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb, revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(), updated_by uuid not null references auth.users(id),
  deleted_at timestamptz
);
create table public.sessions (
  id uuid primary key, team_id uuid not null references public.teams(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb, revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(), updated_by uuid not null references auth.users(id), deleted_at timestamptz
);
create table public.versions (
  id uuid primary key, team_id uuid not null references public.teams(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb, revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(), updated_by uuid not null references auth.users(id), deleted_at timestamptz
);
create table public.corrections (
  id uuid primary key, team_id uuid not null references public.teams(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb, revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(), updated_by uuid not null references auth.users(id), deleted_at timestamptz
);

create table public.sync_changes (
  sequence bigint generated always as identity primary key,
  operation_id uuid not null unique,
  team_id uuid not null references public.teams(id) on delete cascade,
  entity_type text not null check (entity_type in ('song','session','version','correction')),
  entity_id uuid not null,
  revision bigint not null,
  operation text not null check (operation in ('upsert','delete')),
  changed_at timestamptz not null default now()
);
create index sync_changes_team_sequence on public.sync_changes(team_id, sequence);
create index songs_team_updated on public.songs(team_id, updated_at);
create index sessions_team_updated on public.sessions(team_id, updated_at);
create index versions_team_updated on public.versions(team_id, updated_at);
create index corrections_team_updated on public.corrections(team_id, updated_at);

create or replace function public.jsonb_has_forbidden_key(value jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog, public as $$
declare entry record; child jsonb;
begin
  if jsonb_typeof(value) = 'object' then
    for entry in select * from jsonb_each(value) loop
      if lower(entry.key) ~ '(rawanalysis|transcript|authoritativelyrics|audio|pdf|blob|bytes|filepath|localpath|recordingfingerprint)'
        or public.jsonb_has_forbidden_key(entry.value) then return true; end if;
    end loop;
  elsif jsonb_typeof(value) = 'array' then
    for child in select * from jsonb_array_elements(value) loop
      if public.jsonb_has_forbidden_key(child) then return true; end if;
    end loop;
  end if;
  return false;
end $$;

create or replace function public.valid_sync_payload(value jsonb)
returns boolean language sql immutable set search_path = pg_catalog, public as $$
  select jsonb_typeof(value) = 'object'
    and octet_length(value::text) <= 2097152
    and not public.jsonb_has_forbidden_key(value)
$$;

alter table public.songs add constraint songs_payload_safe check (public.valid_sync_payload(payload));
alter table public.sessions add constraint sessions_payload_safe check (public.valid_sync_payload(payload));
alter table public.versions add constraint versions_payload_safe check (public.valid_sync_payload(payload));
alter table public.corrections add constraint corrections_payload_safe check (public.valid_sync_payload(payload));

create or replace function public.is_team_member(target_team uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists(select 1 from public.team_members where team_id = target_team and user_id = auth.uid())
$$;
create or replace function public.can_edit_team(target_team uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists(select 1 from public.team_members where team_id = target_team and user_id = auth.uid() and role in ('owner','editor'))
$$;
create or replace function public.owns_team(target_team uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists(select 1 from public.team_members where team_id = target_team and user_id = auth.uid() and role = 'owner')
$$;

create or replace function public.add_team_owner()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  insert into public.team_members(team_id,user_id,role) values(new.id,new.created_by,'owner');
  return new;
end $$;
create trigger teams_add_owner after insert on public.teams for each row execute function public.add_team_owner();

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.songs enable row level security;
alter table public.sessions enable row level security;
alter table public.versions enable row level security;
alter table public.corrections enable row level security;
alter table public.sync_changes enable row level security;

create policy teams_select on public.teams for select using (public.is_team_member(id));
create policy teams_insert on public.teams for insert with check (created_by = auth.uid());
create policy teams_update on public.teams for update using (public.owns_team(id)) with check (public.owns_team(id));
create policy teams_delete on public.teams for delete using (public.owns_team(id));
create policy members_select on public.team_members for select using (public.is_team_member(team_id));
create policy members_write on public.team_members for all using (public.owns_team(team_id)) with check (public.owns_team(team_id));

do $$ declare table_name text; begin
  foreach table_name in array array['songs','sessions','versions','corrections'] loop
    execute format('create policy %I_select on public.%I for select using (public.is_team_member(team_id))', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert with check (public.can_edit_team(team_id) and updated_by = auth.uid())', table_name, table_name);
    execute format('create policy %I_update on public.%I for update using (public.can_edit_team(team_id)) with check (public.can_edit_team(team_id) and updated_by = auth.uid())', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete using (public.can_edit_team(team_id))', table_name, table_name);
  end loop;
end $$;
create policy changes_select on public.sync_changes for select using (public.is_team_member(team_id));

create or replace function public.sync_upsert(
  p_team_id uuid, p_entity_type text, p_entity_id uuid, p_payload jsonb,
  p_expected_revision bigint, p_operation text, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare target_table text; current_row record; affected_count integer; next_revision bigint; existing_change public.sync_changes%rowtype;
begin
  if not public.can_edit_team(p_team_id) then raise exception 'permission denied' using errcode='42501'; end if;
  if p_entity_type not in ('song','session','version','correction') then raise exception 'invalid entity type' using errcode='22023'; end if;
  if p_operation not in ('upsert','delete') then raise exception 'invalid operation' using errcode='22023'; end if;
  if not public.valid_sync_payload(coalesce(p_payload,'{}'::jsonb)) then raise exception 'unsafe or oversized payload' using errcode='22023'; end if;
  select * into existing_change from public.sync_changes where operation_id = p_operation_id;
  if found then return jsonb_build_object('ok',true,'idempotent',true,'revision',existing_change.revision,'sequence',existing_change.sequence); end if;
  target_table := case p_entity_type when 'song' then 'songs' when 'session' then 'sessions' when 'version' then 'versions' else 'corrections' end;
  execute format('select team_id,revision,payload,deleted_at,updated_at from public.%I where id=$1 for update',target_table)
    into current_row using p_entity_id;
  get diagnostics affected_count = row_count;
  if affected_count > 0 and current_row.team_id <> p_team_id then raise exception 'entity belongs to another team' using errcode='42501'; end if;
  if affected_count > 0 and current_row.revision <> coalesce(p_expected_revision,0) then
    return jsonb_build_object('ok',false,'conflict',true,'remote',jsonb_build_object('id',p_entity_id,'revision',current_row.revision,'payload',current_row.payload,'deletedAt',current_row.deleted_at,'updatedAt',current_row.updated_at));
  end if;
  if affected_count = 0 and coalesce(p_expected_revision,0) <> 0 then
    return jsonb_build_object('ok',false,'conflict',true,'remote',null);
  end if;
  next_revision := coalesce(current_row.revision,0)+1;
  execute format('insert into public.%I(id,team_id,payload,revision,updated_at,updated_by,deleted_at) values($1,$2,$3,$4,now(),auth.uid(),$5) on conflict(id) do update set payload=excluded.payload,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by,deleted_at=excluded.deleted_at',target_table)
    using p_entity_id,p_team_id,coalesce(p_payload,'{}'::jsonb),next_revision,case when p_operation='delete' then now() else null end;
  insert into public.sync_changes(operation_id,team_id,entity_type,entity_id,revision,operation)
    values(p_operation_id,p_team_id,p_entity_type,p_entity_id,next_revision,p_operation)
    returning sequence into existing_change.sequence;
  return jsonb_build_object('ok',true,'revision',next_revision,'sequence',existing_change.sequence);
end $$;

create or replace view public.sync_entities as
select 'song'::text entity_type,id,team_id,payload,deleted_at from public.songs union all
select 'session',id,team_id,payload,deleted_at from public.sessions union all
select 'version',id,team_id,payload,deleted_at from public.versions union all
select 'correction',id,team_id,payload,deleted_at from public.corrections;
revoke all on public.sync_entities from anon, authenticated;

create or replace function public.sync_changes_since(p_team_id uuid, p_cursor bigint default 0, p_limit integer default 200)
returns table(sequence bigint,operation_id uuid,entity_type text,entity_id uuid,revision bigint,operation text,changed_at timestamptz,payload jsonb,deleted_at timestamptz)
language sql stable security definer set search_path = pg_catalog, public as $$
  select c.sequence,c.operation_id,c.entity_type,c.entity_id,c.revision,c.operation,c.changed_at,e.payload,e.deleted_at
  from public.sync_changes c left join public.sync_entities e
    on e.entity_type=c.entity_type and e.id=c.entity_id and e.team_id=c.team_id
  where c.team_id=p_team_id and c.sequence>greatest(p_cursor,0) and public.is_team_member(p_team_id)
  order by c.sequence limit least(greatest(p_limit,1),1000)
$$;

revoke all on function public.sync_upsert(uuid,text,uuid,jsonb,bigint,text,uuid) from public;
grant execute on function public.sync_upsert(uuid,text,uuid,jsonb,bigint,text,uuid) to authenticated;
revoke all on function public.sync_changes_since(uuid,bigint,integer) from public;
grant execute on function public.sync_changes_since(uuid,bigint,integer) to authenticated;

commit;
