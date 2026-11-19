-- Foods added together keep their order. "Add all" of yesterday's meal and a saved meal put every
-- food in with one request, and now() is the same instant for the whole statement, so those rows
-- shared one logged_at and Today could show them in a different order on each load. A row now gets
-- the clock's time when it is inserted, so rows added together are one tick apart, in the order
-- they were sent. Rows logged earlier keep the times they have. Found while fixing SHU-22.
alter table public.user_logs alter column logged_at set default clock_timestamp();
