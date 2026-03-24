-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  role       text not null check (role in ('customer', 'business')) default 'customer',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'customer')
  );

  -- If customer, auto-create a card
  if coalesce(new.raw_user_meta_data->>'role', 'customer') = 'customer' then
    insert into public.cards (user_id, qr_token)
    values (new.id, gen_random_uuid()::text);
  end if;

  -- If business, auto-create a business record
  if new.raw_user_meta_data->>'role' = 'business' then
    insert into public.businesses (user_id, name)
    values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─────────────────────────────────────────
-- CARDS
-- ─────────────────────────────────────────
create table public.cards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  qr_token   text not null unique,
  created_at timestamptz not null default now()
);

alter table public.cards enable row level security;

create policy "Card owner can read their card"
  on public.cards for select
  using (auth.uid() = user_id);

-- Businesses need to look up cards by qr_token during scan
-- This is handled via the service role key in the API


-- ─────────────────────────────────────────
-- BUSINESSES
-- ─────────────────────────────────────────
create table public.businesses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  wp_post_id integer,                    -- Links to WordPress eat CPT post ID
  created_at timestamptz not null default now()
);

alter table public.businesses enable row level security;

create policy "Business owner can read their business"
  on public.businesses for select
  using (auth.uid() = user_id);

create policy "Business owner can update their business"
  on public.businesses for update
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────
-- OFFERS
-- ─────────────────────────────────────────
create table public.offers (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  title            text not null,
  description      text,
  terms            text,
  redemption_type  text not null check (
                     redemption_type in ('one_time', 'unlimited', 'once_per_day', 'once_per_week', 'once_per_month')
                   ) default 'unlimited',
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.offers enable row level security;

-- Business owners manage their own offers
create policy "Business owner can manage offers"
  on public.offers for all
  using (
    exists (
      select 1 from public.businesses
      where businesses.id = offers.business_id
        and businesses.user_id = auth.uid()
    )
  );

-- Customers can read active offers
create policy "Customers can read active offers"
  on public.offers for select
  using (is_active = true);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger offers_updated_at
  before update on public.offers
  for each row execute procedure public.set_updated_at();


-- ─────────────────────────────────────────
-- REDEMPTIONS
-- ─────────────────────────────────────────
create table public.redemptions (
  id           uuid primary key default gen_random_uuid(),
  card_id      uuid not null references public.cards(id) on delete cascade,
  offer_id     uuid not null references public.offers(id) on delete cascade,
  business_id  uuid not null references public.businesses(id) on delete cascade,
  redeemed_by  uuid not null references public.profiles(id),  -- business user who scanned
  redeemed_at  timestamptz not null default now()
);

alter table public.redemptions enable row level security;

-- Card owner can see their redemption history
create policy "Card owner can read their redemptions"
  on public.redemptions for select
  using (
    exists (
      select 1 from public.cards
      where cards.id = redemptions.card_id
        and cards.user_id = auth.uid()
    )
  );

-- Business owner can see redemptions for their business
create policy "Business owner can read their redemptions"
  on public.redemptions for select
  using (
    exists (
      select 1 from public.businesses
      where businesses.id = redemptions.business_id
        and businesses.user_id = auth.uid()
    )
  );

-- Inserts are only performed via the service role (Railway API)


-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
create index on public.cards (user_id);
create index on public.cards (qr_token);
create index on public.offers (business_id);
create index on public.offers (is_active);
create index on public.redemptions (card_id);
create index on public.redemptions (offer_id);
create index on public.redemptions (business_id);
create index on public.redemptions (redeemed_at desc);
