CREATE OR REPLACE FUNCTION public.validate_lunch_order() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF extract(isodow FROM NEW.order_date) NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Lunch orders are Monday to Friday'; END IF;
 IF length(trim(NEW.staff_name)) NOT BETWEEN 1 AND 80 OR length(trim(NEW.department)) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid staff details'; END IF;
 IF NEW.skipped THEN
  IF NEW.menu_item_id IS NOT NULL THEN RAISE EXCEPTION 'Skipped days cannot include a meal'; END IF;
 ELSIF NOT EXISTS (SELECT 1 FROM public.menu_items WHERE id = NEW.menu_item_id AND menu_date = NEW.order_date) THEN
  RAISE EXCEPTION 'Choose a meal from this day';
 END IF;
 IF TG_OP = 'UPDATE' AND now() >= ((OLD.order_date - 1)::timestamp + make_interval(hours => coalesce((SELECT cutoff_hour FROM public.settings WHERE id = 1),16))) AT TIME ZONE 'UTC' THEN RAISE EXCEPTION 'Ordering for % is closed', OLD.order_date; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER orders_validate BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_lunch_order();
CREATE OR REPLACE FUNCTION public.protect_ordered_dishes() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.orders WHERE menu_item_id = OLD.id) THEN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'This dish has orders and cannot be removed'; END IF;
  IF NEW.menu_date <> OLD.menu_date THEN RAISE EXCEPTION 'Ordered dishes cannot change date'; END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER menu_protect_orders BEFORE DELETE OR UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.protect_ordered_dishes();