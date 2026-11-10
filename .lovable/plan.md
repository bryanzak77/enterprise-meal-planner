# Enterprise Insurance — Staff Lunch Ordering

## What staff see (home page `/`)
- Enter **name + department** once (remembered on their device, editable anytime). No sign-up.
- See next week's menu, Monday to Friday, as five day cards.
- Pick one meal per day (or "skip this day") for any or all days, then submit in one go.
- Orders for a day lock at a cutoff (e.g. 4pm the day before), so kitchen gets "tomorrow's" list in time.
- "My orders" panel shows what they've chosen this week and lets them change it before cutoff.

## Admin pages (open, no password, as requested)
- `/admin` **Dashboard**: metrics
  - Total orders for tomorrow and this week
  - Meals per dish per day (kitchen prep counts)
  - Orders by department
  - Participation: staff who ordered vs. skipped
  - Most / least popular dishes, weekly trend chart
  - Export tomorrow's list (CSV / print view)
- `/admin/menu`: set the weekly menu (dishes per day, name, short description, vegetarian/allergen tags) and the order cutoff time.
- `/admin/orders`: searchable full order list, filter by day/department.

## Design
- Navy Trust palette: deep navy #0f1b3d, #1e3a5f, accent #3b6fa0, soft background #e8edf3.
- Clean corporate feel, generous spacing, clear day cards with selected-state highlight, simple charts on the dashboard.

## Technical details
- Lovable Cloud database: tables for `menu_items` (day, week, dish), `orders` (staff name, department, date, menu item), `settings` (cutoff). Seeded with a sample week's menu.
- Staff identity stored in browser localStorage; orders keyed by name + department + date (one order per person per day, upsert on change).
- Public read/write access via server functions; cutoff enforced server-side.
- Note: with no admin protection, anyone with the link can view metrics and edit the menu — a passcode can be added later.
