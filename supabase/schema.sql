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
  payment_method text not null default 'cod',      -- 'cod' or 'card'
  status         text not null default 'new'
                 check (status in ('new', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  total          numeric(10,2) not null default 0,
  created_at     timestamptz not null default now()
);
alter table public.orders
  add column if not exists payment_status    text not null default 'unpaid'
      check (payment_status in ('unpaid', 'pending', 'paid', 'failed')),  -- unpaid = cash on delivery
  add column if not exists stripe_session_id text,
  add column if not exists paid_at           timestamptz;

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
--  5. PRIVATE SETTINGS (email + Telegram alert details). Not reachable from the website.
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1)
);
alter table public.app_settings
  add column if not exists resend_api_key          text,    -- from resend.com → API Keys
  add column if not exists notify_email            text,    -- where YOU receive new-order emails
  add column if not exists email_from              text not null default 'Scent Drip <onboarding@resend.dev>',
  add column if not exists customer_emails_enabled boolean not null default false, -- needs your own domain in Resend
  add column if not exists shop_url                text,    -- e.g. https://scent-drip.pages.dev
  add column if not exists currency                text not null default '',
  add column if not exists telegram_bot_token      text,    -- optional
  add column if not exists telegram_chat_id        text;    -- optional
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

grant usage on schema public to anon, authenticated, service_role;
grant select on public.perfumes to anon;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.perfumes, public.perfume_costs, public.orders, public.order_items to authenticated;
revoke all on public.app_settings from anon, authenticated;

-- ---------------------------------------------------------------------
--  7. NEW-ORDER ALERTS: email (Resend) and/or Telegram.
--     Each one does nothing until you add its details (README → Phase 5).
-- ---------------------------------------------------------------------
create or replace function public.html_escape(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(replace(coalesce(t, ''),
         '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

create or replace function public.notify_new_order(p_order_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  s          public.app_settings%rowtype;
  o          public.orders%rowtype;
  v_total    text;
  v_items    text;
  v_rows     text;
  v_customer text;
  v_payment  text;
begin
  select * into s from public.app_settings where id = 1;
  select * into o from public.orders where id = p_order_id;
  v_total := trim(coalesce(s.currency, '') || ' ' || to_char(o.total, 'FM999,999,990.00'));
  v_payment := case when o.payment_method = 'card' then 'Paid by card ✅' else 'Cash on delivery' end;

  select string_agg(format('• %s × %s', quantity, perfume_name), E'\n' order by id),
         string_agg(format('<tr><td style="padding:6px 0">%s × %s</td><td style="padding:6px 0;text-align:right">%s</td></tr>',
                           quantity, html_escape(perfume_name), to_char(unit_price * quantity, 'FM999,999,990.00')), '' order by id)
    into v_items, v_rows
    from public.order_items where order_id = p_order_id;

  v_customer := format('<p style="margin:16px 0 0"><b>%s</b><br>📞 %s%s<br>📍 %s%s</p>',
                       html_escape(o.customer_name), html_escape(o.customer_phone),
                       coalesce('<br>✉️ ' || html_escape(o.customer_email), ''),
                       html_escape(o.address),
                       coalesce('<br>📝 ' || html_escape(o.notes), ''));

  -- 1) Email to you
  if s.resend_api_key is not null and s.notify_email is not null then
    begin
      perform net.http_post(
        url     := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || s.resend_api_key, 'Content-Type', 'application/json'),
        body    := jsonb_build_object(
          'from', s.email_from,
          'to', jsonb_build_array(s.notify_email),
          'subject', format('🛍️ New order #%s · %s from %s', o.id, v_total, o.customer_name),
          'html', format('<div style="font-family:Arial,sans-serif;max-width:520px">'
                         '<h2 style="margin:0 0 12px">New order #%s</h2>'
                         '<table style="width:100%%;border-collapse:collapse">%s'
                         '<tr><td style="padding:8px 0;border-top:1px solid #ddd"><b>Total</b></td>'
                         '<td style="padding:8px 0;border-top:1px solid #ddd;text-align:right"><b>%s</b></td></tr></table>'
                         '%s<p style="margin:16px 0 0;color:#666">Payment: %s%s</p></div>',
                         o.id, v_rows, html_escape(v_total), v_customer, v_payment,
                         coalesce(' · <a href="' || html_escape(rtrim(s.shop_url, '/')) || '/admin.html">Open admin</a>', ''))),
        timeout_milliseconds := 10000
      );
    exception when others then
      raise warning 'Order email failed: %', sqlerrm;
    end;
  end if;

  -- 2) Confirmation email to the customer (only works once you verify your own domain in Resend)
  if s.customer_emails_enabled and s.resend_api_key is not null and o.customer_email is not null then
    begin
      perform net.http_post(
        url     := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || s.resend_api_key, 'Content-Type', 'application/json'),
        body    := jsonb_build_object(
          'from', s.email_from,
          'to', jsonb_build_array(o.customer_email),
          'reply_to', s.notify_email,
          'subject', format('Your Scent Drip order #%s ✦', o.id),
          'html', format('<div style="font-family:Arial,sans-serif;max-width:520px">'
                         '<h2 style="margin:0 0 8px">Thanks, %s! 💅</h2>'
                         '<p>We got your order #%s. We''ll call you on %s to confirm delivery.</p>'
                         '<table style="width:100%%;border-collapse:collapse">%s'
                         '<tr><td style="padding:8px 0;border-top:1px solid #ddd"><b>Total · %s</b></td>'
                         '<td style="padding:8px 0;border-top:1px solid #ddd;text-align:right"><b>%s</b></td></tr></table>'
                         '<p style="color:#666">Scent Drip · 100%% authentic, always</p></div>',
                         html_escape(o.customer_name), o.id, html_escape(o.customer_phone), v_rows, v_payment, html_escape(v_total))),
        timeout_milliseconds := 10000
      );
    exception when others then
      raise warning 'Customer email failed: %', sqlerrm;
    end;
  end if;

  -- 3) Telegram message to you (optional)
  if s.telegram_bot_token is not null and s.telegram_chat_id is not null then
    begin
      perform net.http_post(
        url  := 'https://api.telegram.org/bot' || s.telegram_bot_token || '/sendMessage',
        body := jsonb_build_object(
          'chat_id', s.telegram_chat_id,
          'text', format(E'🛍️ New order #%s\n\n%s\n\nTotal: %s · %s\n\n👤 %s\n📞 %s\n📍 %s%s',
                         o.id, v_items, v_total, v_payment, o.customer_name, o.customer_phone, o.address,
                         coalesce(E'\n📝 ' || o.notes, '')))
      );
    exception when others then
      raise warning 'Telegram alert failed: %', sqlerrm;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------
--  8. PLACING ORDERS
--     Prices come from the database (customers can't change them),
--     stock is checked and reduced automatically.
--     • Cash on delivery → place_order()       (called from the shop page)
--     • Card (Stripe)    → place_card_order()  (called only by the secure server
--                                              function in functions/api/checkout.js)
-- ---------------------------------------------------------------------
drop function if exists public.place_order(text, text, text, text, text, jsonb);

create or replace function public.create_order_internal(
  p_name text, p_phone text, p_email text, p_address text, p_notes text, p_items jsonb, p_payment_method text
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
    raise exception 'Your bag is empty.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many items in one order.';
  end if;

  -- Release stock held by card payments that were abandoned (Stripe pages expire after 30 min).
  update public.orders set status = 'cancelled', payment_status = 'failed'
   where payment_method = 'card' and payment_status = 'pending' and status <> 'cancelled'
     and created_at < now() - interval '1 hour';

  insert into public.orders (customer_name, customer_phone, customer_email, address, notes, payment_method, payment_status)
  values (left(trim(p_name), 100), left(trim(p_phone), 30), nullif(left(trim(coalesce(p_email, '')), 200), ''),
          left(trim(p_address), 500), nullif(left(trim(coalesce(p_notes, '')), 500), ''),
          p_payment_method, case when p_payment_method = 'card' then 'pending' else 'unpaid' end)
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
      raise exception 'A perfume in your bag is no longer available. Please refresh the page.';
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
  return v_order_id;
end $$;

-- Cash on delivery (the shop page calls this)
create or replace function public.place_order(
  p_name text, p_phone text, p_email text, p_address text, p_notes text, p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  v_id := public.create_order_internal(p_name, p_phone, p_email, p_address, p_notes, p_items, 'cod');
  perform public.notify_new_order(v_id);
  return v_id;
end $$;

-- Card payment: creates a "waiting for payment" order and returns what Stripe needs.
create or replace function public.place_card_order(
  p_name text, p_phone text, p_email text, p_address text, p_notes text, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  v_id := public.create_order_internal(p_name, p_phone, p_email, p_address, p_notes, p_items, 'card');
  return jsonb_build_object(
    'id', v_id,
    'email', (select customer_email from public.orders where id = v_id),
    'items', (select jsonb_agg(jsonb_build_object('name', perfume_name, 'unit_price', unit_price, 'quantity', quantity) order by id)
                from public.order_items where order_id = v_id));
end $$;

create or replace function public.attach_stripe_session(p_order_id bigint, p_session_id text) returns void
language sql security definer set search_path = public as $$
  update public.orders set stripe_session_id = p_session_id where id = p_order_id and payment_status = 'pending';
$$;

-- Stripe confirmed the payment → mark paid and send the new-order email.
create or replace function public.mark_order_paid(p_order_id bigint, p_session_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  update public.orders set payment_status = 'paid', paid_at = now()
   where id = p_order_id and stripe_session_id = p_session_id and payment_status = 'pending'
  returning id into v_id;
  if v_id is not null then
    perform public.notify_new_order(v_id);
  end if;
  return v_id is not null;
end $$;

-- Payment abandoned or failed → cancel the order (stock goes back automatically).
create or replace function public.cancel_unpaid_order(p_order_id bigint, p_session_id text default null) returns void
language sql security definer set search_path = public as $$
  update public.orders set status = 'cancelled', payment_status = 'failed'
   where id = p_order_id and payment_status = 'pending'
     and (p_session_id is null or stripe_session_id = p_session_id);
$$;

revoke execute on function public.notify_new_order(bigint) from public, anon, authenticated;
revoke execute on function public.html_escape(text) from public, anon, authenticated;
revoke execute on function public.create_order_internal(text, text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.place_card_order(text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.attach_stripe_session(bigint, text) from public, anon, authenticated;
revoke execute on function public.mark_order_paid(bigint, text) from public, anon, authenticated;
revoke execute on function public.cancel_unpaid_order(bigint, text) from public, anon, authenticated;
grant execute on function public.place_card_order(text, text, text, text, text, jsonb) to service_role;
grant execute on function public.attach_stripe_session(bigint, text) to service_role;
grant execute on function public.mark_order_paid(bigint, text) to service_role;
grant execute on function public.cancel_unpaid_order(bigint, text) to service_role;
grant execute on function public.place_order(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
--  9. CANCELLING or DELETING an order puts the perfumes back into stock
-- ---------------------------------------------------------------------
create or replace function public.restock_on_cancel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.perfumes p set stock = p.stock + i.qty, updated_at = now()
      from (select perfume_id, sum(quantity) qty from public.order_items where order_id = new.id group by perfume_id) i
     where i.perfume_id = p.id;
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    update public.perfumes p set stock = p.stock - i.qty, updated_at = now()
      from (select perfume_id, sum(quantity) qty from public.order_items where order_id = new.id group by perfume_id) i
     where i.perfume_id = p.id;
  end if;
  return new;
end $$;

drop trigger if exists orders_restock on public.orders;
create trigger orders_restock after update of status on public.orders
  for each row execute function public.restock_on_cancel();

-- Deleting an order that still holds stock (not already cancelled) returns its bottles.
create or replace function public.restock_on_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'cancelled' then
    update public.perfumes p set stock = p.stock + i.qty, updated_at = now()
      from (select perfume_id, sum(quantity) qty from public.order_items where order_id = old.id group by perfume_id) i
     where i.perfume_id = p.id;
  end if;
  return old;
end $$;

drop trigger if exists orders_restock_on_delete on public.orders;
create trigger orders_restock_on_delete before delete on public.orders
  for each row execute function public.restock_on_delete();

-- ---------------------------------------------------------------------
--  9b. TRACK ORDER — customers look up their own order with the order
--      number + the phone number they used. Shows no address or email.
-- ---------------------------------------------------------------------
create or replace function public.track_order(p_order_id bigint, p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  o       public.orders%rowtype;
  v_given text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9);
begin
  if length(v_given) < 7 then
    return null;
  end if;
  select * into o from public.orders
   where id = p_order_id
     and right(regexp_replace(customer_phone, '\D', '', 'g'), 9) = v_given;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'total', o.total,
    'created_at', o.created_at,
    'items', (select jsonb_agg(jsonb_build_object('name', perfume_name, 'quantity', quantity) order by id)
                from public.order_items where order_id = o.id));
end $$;

revoke execute on function public.track_order(bigint, text) from public;
grant execute on function public.track_order(bigint, text) to anon, authenticated;

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

-- Done! Next: create your admin login (README → Phase 1, step 4).
