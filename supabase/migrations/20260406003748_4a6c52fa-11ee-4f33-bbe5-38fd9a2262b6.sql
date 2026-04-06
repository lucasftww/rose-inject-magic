-- Redistribute review timestamps to organic Brazilian hours (10h-23h BRT = 13h-02h UTC)
-- Keeps the same date, only changes the time component with random variation
UPDATE product_reviews
SET created_at = 
  date_trunc('day', created_at) 
  + make_interval(hours => 13 + floor(random() * 14)::int)
  + make_interval(mins => floor(random() * 60)::int)
  + make_interval(secs => floor(random() * 60)::int);
