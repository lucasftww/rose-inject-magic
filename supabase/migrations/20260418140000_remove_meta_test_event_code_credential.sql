-- Remove deprecated Meta "Test events" credential; CAPI no longer reads META_TEST_EVENT_CODE.
DELETE FROM public.system_credentials WHERE env_key = 'META_TEST_EVENT_CODE';
