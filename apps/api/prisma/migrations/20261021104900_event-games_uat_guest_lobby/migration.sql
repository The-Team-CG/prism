-- This opt-in UAT data seed runs only when Talga temporarily sets prism.uat_seed_enabled=true.
-- prism-owner: event-games
-- prism-kind: data
-- prism-risk: medium

INSERT INTO event_games.game_definitions (
  id, event_id, slug, title, game_kind, entry_mode, status, created_by,
  updated_by, published_at, updated_at
)
SELECT
  'game_uat_live_word_scramble', 'evt_uat_live_261024', 'uat-word-scramble', 'UAT Word Scramble',
  'word-scramble', 'independent', 'published', 'usr_pmcm', 'usr_pmcm', now(), now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_games.game_config_versions (id, game_definition_id, event_id, version, config, created_by)
SELECT
  'game_config_uat_live_v1', 'game_uat_live_word_scramble', 'evt_uat_live_261024', 1,
  '{"configuration":{"kind":"word-scramble","rounds":[{"key":"uat-round-1","scrambledWord":"LEPPA","answer":"APPLE","points":100,"durationSeconds":300}]}}'::jsonb,
  'usr_pmcm'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_games.game_definitions WHERE id = 'game_uat_live_word_scramble')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_games.lobby_slugs (event_id, lobby_slug, brand_theme)
SELECT 'evt_uat_live_261024', 'oATVL2EZ5zn4APl7pUyAKuuQNyzKuSH-e5zNRmJHeBc', 'prism'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
ON CONFLICT (event_id) DO NOTHING;
