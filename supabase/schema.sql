-- =====================================================================
--  SCENT DRIP — database setup
--  Paste this WHOLE file into Supabase → SQL Editor → "New query" → Run.
--  It is safe to run more than once.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_net with schema extensions;  -- used for Telegram order alerts

-- ---------------------------------------------------------------------
--  1. ADMINS — the people allowed to manage the shop (you)
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
--  2. PERFUMES — what customers see in the shop
-- ---------------------------------------------------------------------
create table if not exists public.perfumes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  brand         text,
  description   text,
  category      text,                    -- e.g. Men / Women / Unisex
  size_ml       int check (size_ml is null or size_ml > 0),
  selling_price numeric(10,2) not null check (selling_price >= 0),
  stock         int not null default 0 check (stock >= 0),
  image_url     text,
  is_active     boolean not null default true,  -- false = hidden from customers
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  3. PERFUME COSTS — what YOU paid. Kept in a separate table so that
--     customers can never see it. Only admins can read it.
-- ---------------------------------------------------------------------
create table if not exists public.perfume_costs (
  perfume_id uuid primary key references public.perfumes(id) on delete cascade,
  cost_price numeric(10,2) not null default 0 check (cost_price >= 0),
  supplier   text,
  notes      text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  4. ORDERS + ORDER ITEMS
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id             bigint generated always as identity primary key,
  customer_name  text not null,
  customer_phone text not null,
  customer_email text,
  address        text not null,
  notes          text,
  payment_method text not null default 'cod',
  status         text not null default 'new'
                 check (status in ('new', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  total          numeric(10,2) not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists public.order_items (
  id           bigint generated always as identity primary key,
  order_id     bigint not null references public.orders(id) on delete cascade,
  perfume_id   uuid references public.perfumes(id) on delete set null,
  perfume_name text not null,            -- copied so history survives deleting a perfume
  unit_price   numeric(10,2) not null,   -- selling price at time of order
  unit_cost    numeric(10,2),            -- your cost at time of order (for profit)
  quantity     int not null check (quantity > 0)
);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

-- ---------------------------------------------------------------------
--  5. PRIVATE SETTINGS (Telegram bot details). Not reachable from the website.
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id                 int primary key default 1 check (id = 1),
  telegram_bot_token text,
  telegram_chat_id   text
);
insert into public.app_settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
--  6. SECURITY (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.admins        enable row level security;
alter table public.perfumes      enable row level security;
alter table public.perfume_costs enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;
alter table public.app_settings  enable row level security;  -- no policies = nobody via the website

drop policy if exists "admins read self"        on public.admins;
drop policy if exists "public reads active"     on public.perfumes;
drop policy if exists "admins manage perfumes"  on public.perfumes;
drop policy if exists "admins manage costs"     on public.perfume_costs;
drop policy if exists "admins manage orders"    on public.orders;
drop policy if exists "admins manage items"     on public.order_items;

create policy "admins read self"       on public.admins        for select using (user_id = auth.uid());
create policy "public reads active"    on public.perfumes      for select using (is_active or public.is_admin());
create policy "admins manage perfumes" on public.perfumes      for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage costs"    on public.perfume_costs for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage orders"   on public.orders        for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage items"    on public.order_items   for all using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.perfumes to anon;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.perfumes, public.perfume_costs, public.orders, public.order_items to authenticated;
revoke all on public.app_settings from anon, authenticated;

-- ---------------------------------------------------------------------
--  7. TELEGRAM ALERT for new orders (does nothing until you add your bot details)
-- ---------------------------------------------------------------------
create or replace function public.notify_new_order(p_order_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  s       public.app_settings%rowtype;
  o       public.orders%rowtype;
  v_items text;
begin
  select * into s from public.app_settings where id = 1;
  if s.telegram_bot_token is null or s.telegram_chat_id is null then
    return;
  end if;

  select * into o from public.orders where id = p_order_id;
  select string_agg(format('• %s × %s', quantity, perfume_name), E'\n')
    into v_items from public.order_items where order_id = p_order_id;

  perform net.http_post(
    url  := 'https://api.telegram.org/bot' || s.telegram_bot_token || '/sendMessage',
    body := jsonb_build_object(
      'chat_id', s.telegram_chat_id,
      'text', format(E'🛍️ New order #%s\n\n%s\n\nTotal: %s\n\n👤 %s\n📞 %s\n📍 %s%s',
                     o.id, v_items, o.total, o.customer_name, o.customer_phone, o.address,
                     coalesce(E'\n📝 ' || o.notes, '')))
  );
exception when others then
  -- A failed alert must never block a customer's order.
  raise warning 'Order alert failed: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
--  8. PLACE ORDER — the ONLY way customers can create an order.
--     Prices come from the database (customers can't change them),
--     stock is checked and reduced automatically.
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_name text, p_phone text, p_email text, p_address text, p_notes text, p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_order_id bigint;
  v_total    numeric(10,2) := 0;
  v_item     jsonb;
  v_qty      int;
  p          public.perfumes%rowtype;
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' or coalesce(trim(p_address), '') = '' then
    raise exception 'Please fill in your name, phone number and address.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many items in one order.';
  end if;

  insert into public.orders (customer_name, customer_phone, customer_email, address, notes)
  values (left(trim(p_name), 100), left(trim(p_phone), 30), nullif(left(trim(coalesce(p_email, '')), 200), ''),
          left(trim(p_address), 500), nullif(left(trim(coalesce(p_notes, '')), 500), ''))
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 20 then
      raise exception 'Invalid quantity.';
    end if;

    select * into p from public.perfumes
     where id = (v_item ->> 'perfume_id')::uuid and is_active
     for update;
    if not found then
      raise exception 'A perfume in your cart is no longer available. Please refresh the page.';
    end if;
    if p.stock < v_qty then
      raise exception 'Sorry, only % left of "%".', p.stock, p.name;
    end if;

    update public.perfumes set stock = stock - v_qty, updated_at = now() where id = p.id;

    insert into public.order_items (order_id, perfume_id, perfume_name, unit_price, unit_cost, quantity)
    values (v_order_id, p.id, p.name, p.selling_price,
            (select cost_price from public.perfume_costs where perfume_id = p.id), v_qty);

    v_total := v_total + p.selling_price * v_qty;
  end loop;

  update public.orders set total = v_total where id = v_order_id;
  perform public.notify_new_order(v_order_id);
  return v_order_id;
end $$;

revoke execute on function public.notify_new_order(bigint) from public, anon, authenticated;
grant execute on function public.place_order(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
--  9. CANCELLING an order puts the perfumes back into stock
-- ---------------------------------------------------------------------
create or replace function public.restock_on_cancel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.perfumes p set stock = p.stock + i.quantity, updated_at = now()
      from public.order_items i where i.order_id = new.id and i.perfume_id = p.id;
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    update public.perfumes p set stock = p.stock - i.quantity, updated_at = now()
      from public.order_items i where i.order_id = new.id and i.perfume_id = p.id;
  end if;
  return new;
end $$;

drop trigger if exists orders_restock on public.orders;
create trigger orders_restock after update of status on public.orders
  for each row execute function public.restock_on_cancel();

-- ---------------------------------------------------------------------
-- 10. LIVE UPDATES — lets the admin page pop up new orders instantly
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object or undefined_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 11. IMAGE STORAGE for perfume photos (public to view, admins to upload)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('perfume-images', 'perfume-images', true)
on conflict (id) do nothing;

drop policy if exists "admins upload perfume images" on storage.objects;
drop policy if exists "admins update perfume images" on storage.objects;
drop policy if exists "admins delete perfume images" on storage.objects;

create policy "admins upload perfume images" on storage.objects for insert to authenticated
  with check (bucket_id = 'perfume-images' and public.is_admin());
create policy "admins update perfume images" on storage.objects for update to authenticated
  using (bucket_id = 'perfume-images' and public.is_admin());
create policy "admins delete perfume images" on storage.objects for delete to authenticated
  using (bucket_id = 'perfume-images' and public.is_admin());

-- Done! Next: create your admin login (see README, step 3).
