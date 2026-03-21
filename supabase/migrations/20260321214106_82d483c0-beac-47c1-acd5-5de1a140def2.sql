-- Update all games with their image URLs
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/valorant.webp' WHERE slug = 'valorant';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/counter-strike-2.webp' WHERE slug = 'counter-strike-2';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/spoofers.webp' WHERE slug = 'spoofers';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/fortnite.webp' WHERE slug = 'fortnite';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/arena-breakout-infinite.webp' WHERE slug = 'arena-breakout-infinite';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/arc-raiders.webp' WHERE slug = 'arc-raiders';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/call-of-duty.webp' WHERE slug = 'call-of-duty';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/pubg.webp' WHERE slug = 'pubg';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/rust.webp' WHERE slug = 'rust';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/dayz.webp' WHERE slug = 'dayz';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/bloodstrike.webp' WHERE slug = 'bloodstrike';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/apex-legends.webp' WHERE slug = 'apex-legends';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/marvel-rivals.webp' WHERE slug = 'marvel-rivals';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/farlight-84.webp' WHERE slug = 'farlight-84';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/bodycam.webp' WHERE slug = 'bodycam';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/bloodhunt.webp' WHERE slug = 'bloodhunt';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/warface.webp' WHERE slug = 'warface';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/dead-by-daylight.webp' WHERE slug = 'dead-by-daylight';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/fivem.webp' WHERE slug = 'fivem';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/squad.webp' WHERE slug = 'squad';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/overwatch-2.webp' WHERE slug = 'overwatch-2';
UPDATE public.games SET image_url = 'https://cthqzetkshrbsjulfytl.supabase.co/storage/v1/object/public/game-images/games/hell-let-loose.webp' WHERE slug = 'hell-let-loose';

-- Remove temporary public upload policies
DROP POLICY IF EXISTS "Allow public uploads to game-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to game-images" ON storage.objects;