
-- Tabela de prêmios da raspadinha
CREATE TABLE public.scratch_card_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  win_percentage numeric NOT NULL DEFAULT 5,
  prize_value numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.scratch_card_prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scratch prizes" ON public.scratch_card_prizes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active scratch prizes" ON public.scratch_card_prizes
  FOR SELECT USING (true);

-- Tabela de jogadas da raspadinha
CREATE TABLE public.scratch_card_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prize_id uuid REFERENCES public.scratch_card_prizes(id),
  won boolean NOT NULL DEFAULT false,
  amount_paid numeric NOT NULL DEFAULT 2.50,
  grid_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.scratch_card_plays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plays" ON public.scratch_card_plays
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plays" ON public.scratch_card_plays
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all plays" ON public.scratch_card_plays
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Configuração geral da raspadinha
CREATE TABLE public.scratch_card_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price numeric NOT NULL DEFAULT 2.50,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.scratch_card_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scratch config" ON public.scratch_card_config
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage scratch config" ON public.scratch_card_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default config
INSERT INTO public.scratch_card_config (price, active) VALUES (2.50, true);
