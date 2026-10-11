-- ZeroClash booking safety layer.
-- Run this only after confirming your existing public.bookings table has these logical fields:
-- equipment_id, start_at, end_at, status, and optionally purpose/requester user fields.
-- This migration does not create duplicate equipment or bookings tables.

create or replace function public.zero_clash_booking_column(column_candidates text[])
returns text
language sql
stable
as $$
  select column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'bookings'
    and column_name = any(column_candidates)
  order by array_position(column_candidates, column_name)
  limit 1;
$$;

create or replace function public.zero_clash_create_booking_guarded(
  p_equipment_id text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_purpose text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_equipment_col text := public.zero_clash_booking_column(array['equipment_id', 'unit_id', 'equipment_unit_id']);
  v_start_col text := public.zero_clash_booking_column(array['start_at', 'start_time', 'starts_at']);
  v_end_col text := public.zero_clash_booking_column(array['end_at', 'end_time', 'ends_at']);
  v_status_col text := public.zero_clash_booking_column(array['status', 'booking_status', 'state']);
  v_purpose_col text := public.zero_clash_booking_column(array['purpose', 'notes', 'description']);
  v_user_col text := public.zero_clash_booking_column(array['user_id', 'profile_id', 'requester_id', 'created_by']);
  v_equipment_type regtype;
  v_user_type regtype;
  v_has_conflict boolean;
  v_insert_cols text;
  v_insert_vals text;
  v_insert_sql text;
  v_row jsonb;
begin
  if to_regclass('public.bookings') is null then
    raise exception 'public.bookings table does not exist';
  end if;

  if v_equipment_col is null or v_start_col is null or v_end_col is null then
    raise exception 'public.bookings must expose equipment_id/unit_id plus start_at and end_at columns';
  end if;

  if p_equipment_id is null or length(trim(p_equipment_id)) = 0 then
    raise exception 'equipment id is required';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'invalid booking interval';
  end if;

  if p_start_at < now() - interval '1 minute' then
    raise exception 'booking start time cannot be in the past';
  end if;

  select format_type(a.atttypid, a.atttypmod)::regtype
  into v_equipment_type
  from pg_attribute a
  where a.attrelid = 'public.bookings'::regclass
    and a.attname = v_equipment_col
    and not a.attisdropped;

  perform pg_advisory_xact_lock(hashtext('zeroclash-booking-' || p_equipment_id));

  execute format(
    'select exists (
       select 1
       from public.bookings
       where %1$I::text = $1
         and %2$I < $3
         and %3$I > $2
         and coalesce(%4$s, ''confirmed'') not in (''cancelled'', ''canceled'', ''rejected'')
     )',
    v_equipment_col,
    v_start_col,
    v_end_col,
    case when v_status_col is null then 'null' else format('%I::text', v_status_col) end
  )
  using p_equipment_id, p_start_at, p_end_at
  into v_has_conflict;

  if v_has_conflict then
    raise exception 'booking conflict for equipment % between % and %', p_equipment_id, p_start_at, p_end_at;
  end if;

  v_insert_cols := format('%I, %I, %I', v_equipment_col, v_start_col, v_end_col);
  v_insert_vals := case
    when v_equipment_type::text = 'uuid' then '($1)::uuid, $2, $3'
    else '$1, $2, $3'
  end;

  if v_status_col is not null then
    v_insert_cols := v_insert_cols || format(', %I', v_status_col);
    v_insert_vals := v_insert_vals || ', ''confirmed''';
  end if;

  if v_purpose_col is not null then
    v_insert_cols := v_insert_cols || format(', %I', v_purpose_col);
    v_insert_vals := v_insert_vals || ', $4';
  end if;

  if v_user_col is not null then
    select format_type(a.atttypid, a.atttypmod)::regtype
    into v_user_type
    from pg_attribute a
    where a.attrelid = 'public.bookings'::regclass
      and a.attname = v_user_col
      and not a.attisdropped;

    v_insert_cols := v_insert_cols || format(', %I', v_user_col);
    v_insert_vals := v_insert_vals || case
      when v_user_type::text = 'uuid' then ', auth.uid()'
      else ', auth.uid()::text'
    end;
  end if;

  v_insert_sql := format('insert into public.bookings (%s) values (%s) returning to_jsonb(public.bookings.*)', v_insert_cols, v_insert_vals);
  execute v_insert_sql using p_equipment_id, p_start_at, p_end_at, p_purpose into v_row;
  return v_row;
end;
$$;

create or replace function public.zero_clash_cancel_booking(p_booking_id text)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_status_col text := public.zero_clash_booking_column(array['status', 'booking_status', 'state']);
  v_user_col text := public.zero_clash_booking_column(array['user_id', 'profile_id', 'requester_id', 'created_by']);
  v_sql text;
  v_row jsonb;
begin
  if to_regclass('public.bookings') is null then
    raise exception 'public.bookings table does not exist';
  end if;

  if v_status_col is null then
    raise exception 'public.bookings needs a status column to cancel safely';
  end if;

  v_sql := format('update public.bookings set %I = ''cancelled'' where id::text = $1', v_status_col);

  if v_user_col is not null then
    v_sql := v_sql || format(' and (%I::text = auth.uid()::text or auth.uid() is not null)', v_user_col);
  end if;

  v_sql := v_sql || ' returning to_jsonb(public.bookings.*)';
  execute v_sql using p_booking_id into v_row;

  if v_row is null then
    raise exception 'booking not found or not cancellable';
  end if;

  return v_row;
end;
$$;

grant execute on function public.zero_clash_create_booking_guarded(text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.zero_clash_cancel_booking(text) to authenticated;
