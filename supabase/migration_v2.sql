-- =============================================
-- HU NOW Migration v2
-- Drop Supabase offers table (offers live in WordPress ACF)
-- Update redemptions to store offer title + WP post ID
-- =============================================

-- Drop old offers table (no longer needed)
DROP TABLE IF EXISTS public.offers CASCADE;

-- Recreate redemptions with WP-based fields
DROP TABLE IF EXISTS public.redemptions CASCADE;

CREATE TABLE IF NOT EXISTS public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  offer_title TEXT NOT NULL,
  offer_index INTEGER,
  wp_post_id INTEGER,
  redeemed_by UUID NOT NULL REFERENCES public.profiles(id),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "redemptions_select_customer" ON public.redemptions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cards WHERE id = card_id AND user_id = auth.uid())
);
CREATE POLICY "redemptions_select_business" ON public.redemptions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.businesses WHERE id = business_id AND user_id = auth.uid())
);
CREATE POLICY "redemptions_insert_service" ON public.redemptions FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.redemptions TO postgres, service_role;
