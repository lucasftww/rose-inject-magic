
-- Add unique constraint on user_id + product_id to enforce 1 review per product per user
ALTER TABLE public.product_reviews ADD CONSTRAINT product_reviews_user_product_unique UNIQUE (user_id, product_id);
