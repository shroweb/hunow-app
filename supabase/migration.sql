-- =============================================
-- HU NOW - Supabase Migration
-- Run this in Supabase SQL Editor
-- =============================================

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'business')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cards (one per customer)
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  qr_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Businesses
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  wp_post_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Offers
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  terms TEXT,
  redemption_type TEXT NOT NULL DEFAULT 'unlimited'
    CHECK (redemption_type IN ('one_time', 'unlimited', 'once_per_day', 'once_per_week', 'once_per_month')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Redemptions
CREATE TABLE IF NOT EXISTS public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  redeemed_by UUID NOT NULL REFERENCES public.profiles(id),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Triggers
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  user_name TEXT;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', '');

  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, user_name, user_role)
  ON CONFLICT (id) DO NOTHING;

  -- Auto-create card for customers
  IF user_role = 'customer' THEN
    INSERT INTO public.cards (user_id)
    VALUES (NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Auto-create business record for business users
  IF user_role = 'business' THEN
    INSERT INTO public.businesses (user_id, name)
    VALUES (NEW.id, user_name)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Auto-update updated_at on offers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_offers_updated ON public.offers;
CREATE TRIGGER on_offers_updated
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Cards: customers can read their own card
CREATE POLICY "cards_select_own" ON public.cards FOR SELECT USING (auth.uid() = user_id);
-- Businesses can read cards (needed for scan lookup)
CREATE POLICY "cards_select_business" ON public.cards FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'business')
);

-- Businesses: owners can read/update their own
CREATE POLICY "businesses_select_own" ON public.businesses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "businesses_update_own" ON public.businesses FOR UPDATE USING (auth.uid() = user_id);
-- Customers can read businesses (for venue pages)
CREATE POLICY "businesses_select_all" ON public.businesses FOR SELECT USING (true);

-- Offers: business owners manage their own
CREATE POLICY "offers_select_all" ON public.offers FOR SELECT USING (is_active = true OR
  EXISTS (SELECT 1 FROM public.businesses WHERE id = offers.business_id AND user_id = auth.uid())
);
CREATE POLICY "offers_insert_own" ON public.offers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.businesses WHERE id = business_id AND user_id = auth.uid())
);
CREATE POLICY "offers_update_own" ON public.offers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.businesses WHERE id = business_id AND user_id = auth.uid())
);
CREATE POLICY "offers_delete_own" ON public.offers FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.businesses WHERE id = business_id AND user_id = auth.uid())
);

-- Redemptions: insert via service role (API), read own
CREATE POLICY "redemptions_select_customer" ON public.redemptions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cards WHERE id = card_id AND user_id = auth.uid())
);
CREATE POLICY "redemptions_select_business" ON public.redemptions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.businesses WHERE id = business_id AND user_id = auth.uid())
);
CREATE POLICY "redemptions_insert_service" ON public.redemptions FOR INSERT WITH CHECK (true);
