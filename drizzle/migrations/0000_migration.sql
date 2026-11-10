CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_date date NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open menu read" ON public.menu_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "open menu write" ON public.menu_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cutoff_hour int NOT NULL DEFAULT 16 CHECK (cutoff_hour BETWEEN 0 AND 23)
);
GRANT SELECT, UPDATE ON public.settings TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open settings read" ON public.settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "open settings update" ON public.settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
INSERT INTO public.settings (id, cutoff_hour) VALUES (1, 16);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_name text NOT NULL CHECK (length(trim(staff_name)) > 0),
  department text NOT NULL,
  order_date date NOT NULL,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  skipped boolean NOT NULL DEFAULT false,
  staff_key text GENERATED ALWAYS AS (lower(trim(staff_name)) || '|' || lower(department)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_key, order_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open orders read" ON public.orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "open orders write" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Cutoff enforced in the database: orders for a date lock at cutoff_hour (UTC) the day before.
CREATE OR REPLACE FUNCTION public.enforce_order_cutoff()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE h int;
BEGIN
  SELECT cutoff_hour INTO h FROM public.settings WHERE id = 1;
  IF now() >= ((NEW.order_date - 1)::timestamp + make_interval(hours => coalesce(h,16))) AT TIME ZONE 'UTC' THEN
    RAISE EXCEPTION 'Ordering for % is closed', NEW.order_date;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER orders_cutoff BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_cutoff();

-- Seed menus for this week and the next two weeks (Mon-Fri)
WITH days AS (
  SELECT d::date AS d FROM generate_series(date_trunc('week', current_date)::date, date_trunc('week', current_date)::date + 20, interval '1 day') d
  WHERE extract(isodow FROM d) BETWEEN 1 AND 5
), dishes(dow, name, description, tags) AS (VALUES
  (1,'Jollof Rice & Grilled Chicken','Smoky party jollof, plantain, coleslaw', ARRAY['spicy']),
  (1,'Vegetable Fried Rice','Mixed vegetables, tofu, sweet corn', ARRAY['vegetarian']),
  (1,'Caesar Salad Wrap','Chicken, romaine, parmesan', ARRAY[]::text[]),
  (2,'Banku & Tilapia','Grilled tilapia, shito, pepper sauce', ARRAY['spicy','fish']),
  (2,'Pasta Primavera','Penne, seasonal vegetables, tomato basil', ARRAY['vegetarian']),
  (2,'Beef Burger & Fries','Toasted bun, cheddar, house sauce', ARRAY[]::text[]),
  (3,'Waakye Special','Rice & beans, egg, gari, stew', ARRAY['spicy']),
  (3,'Chicken Shawarma','Garlic sauce, pickles, fries', ARRAY[]::text[]),
  (3,'Lentil Curry','Coconut lentils, basmati rice', ARRAY['vegetarian','vegan']),
  (4,'Fufu & Light Soup','Goat meat light soup', ARRAY['spicy']),
  (4,'Grilled Salmon Bowl','Quinoa, avocado, greens', ARRAY['fish']),
  (4,'Veggie Pizza Slices','Peppers, olives, mozzarella', ARRAY['vegetarian']),
  (5,'Red Red & Plantain','Black-eyed bean stew, fried plantain', ARRAY['vegetarian','vegan']),
  (5,'Assorted Fried Rice','Chicken, beef, shrimp', ARRAY['contains shellfish']),
  (5,'Club Sandwich','Turkey, bacon, egg, lettuce', ARRAY[]::text[])
)
INSERT INTO public.menu_items (menu_date, name, description, tags)
SELECT days.d, dishes.name, dishes.description, dishes.tags
FROM days JOIN dishes ON dishes.dow = extract(isodow FROM days.d);