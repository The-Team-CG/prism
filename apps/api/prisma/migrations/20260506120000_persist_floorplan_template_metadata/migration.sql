ALTER TABLE "venue_templates"
  ADD COLUMN "venue" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "pax" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "include_guests" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "include_suppliers" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "guests" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "suppliers" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "source_type" TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "floor_plans"
  ADD COLUMN "venue" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "pax" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "guests" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "suppliers" JSONB NOT NULL DEFAULT '[]';

CREATE TEMP TABLE "_prism_seeded_floorplan_templates" AS
WITH seeded_templates AS (
  SELECT
    'tpl_builtin_blank' AS template_id,
    'plan_tpl_builtin_blank' AS floor_plan_id,
    'Blank Canvas' AS name,
    'Start with an empty floor.' AS description,
    'PMCM Template Library' AS venue,
    30 AS width,
    20 AS height,
    1 AS grid_size,
    120 AS pax,
    '[]'::jsonb AS objects
  UNION ALL
  SELECT
    'tpl_builtin_corporate_gala',
    'plan_tpl_builtin_corporate_gala',
    'Corporate Gala',
    'Stage + round banquet tables, LED wall.',
    'PMCM Template Library',
    30,
    20,
    1,
    120,
    jsonb_build_array(
      jsonb_build_object('id', 'tpl_corporate_stage', 'name', 'Stage', 'kind', 'rect', 'category', 'stage', 'x', 12, 'y', 0.3, 'w', 6, 'h', 3, 'rotation', 0, 'fill', '#9060A0', 'stroke', '#c01867', 'strokeWidth', 0.04, 'locked', false, 'hidden', false),
      jsonb_build_object('id', 'tpl_corporate_led_wall', 'name', 'LED Wall', 'kind', 'rect', 'category', 'stage', 'x', 12.5, 'y', 0.2, 'w', 5, 'h', 0.4, 'rotation', 0, 'fill', '#1B1B1F', 'stroke', '#000000', 'strokeWidth', 0.04, 'locked', false, 'hidden', false),
      jsonb_build_object('id', 'tpl_corporate_podium', 'name', 'Podium', 'kind', 'rect', 'category', 'stage', 'x', 17.1, 'y', 1.7, 'w', 0.8, 'h', 0.6, 'rotation', 0, 'fill', '#9060A0', 'stroke', '#171216', 'strokeWidth', 0.04, 'locked', false, 'hidden', false)
    )
    || (
      SELECT jsonb_agg(
        jsonb_build_object('id', 'tpl_corporate_table_' || n, 'name', 'Round Banquet (10pax)', 'kind', 'ellipse', 'category', 'furniture', 'x', 1 + (28.0 / 9) * (((n - 1) % 9) + 0.5) - 0.9, 'y', 5 + 7.5 * (floor((n - 1)::numeric / 9) + 0.5) - 0.9, 'w', 1.8, 'h', 1.8, 'rotation', 0, 'fill', '#FFF4EC', 'stroke', '#9060A0', 'strokeWidth', 0.04, 'label', 'T' || n, 'seats', 10, 'locked', false, 'hidden', false)
        ORDER BY n
      )
      FROM generate_series(1, 12) AS n
    )
    || jsonb_build_array(
      jsonb_build_object('id', 'tpl_corporate_reg_desk', 'name', 'Registration Desk', 'kind', 'rect', 'category', 'registration', 'x', 1, 'y', 18.6, 'w', 2, 'h', 0.8, 'rotation', 0, 'fill', '#E9F7FB', 'stroke', '#9060A0', 'strokeWidth', 0.04, 'locked', false, 'hidden', false)
    )
  UNION ALL
  SELECT
    'tpl_builtin_wedding',
    'plan_tpl_builtin_wedding',
    'Wedding Reception',
    'VIP table up front, banquet rounds.',
    'PMCM Template Library',
    30,
    20,
    1,
    120,
    jsonb_build_array(
      jsonb_build_object('id', 'tpl_wedding_stage', 'name', 'Stage', 'kind', 'rect', 'category', 'stage', 'x', 12, 'y', 0.3, 'w', 6, 'h', 3, 'rotation', 0, 'fill', '#9060A0', 'stroke', '#c01867', 'strokeWidth', 0.04, 'locked', false, 'hidden', false),
      jsonb_build_object('id', 'tpl_wedding_vip_table', 'name', 'VIP Table', 'kind', 'rect', 'category', 'furniture', 'x', 13.6, 'y', 4, 'w', 2.8, 'h', 1, 'rotation', 0, 'fill', '#FFF0E6', 'stroke', '#F06030', 'strokeWidth', 0.04, 'label', 'VIP', 'seats', 10, 'locked', false, 'hidden', false)
    )
    || (
      SELECT jsonb_agg(
        jsonb_build_object('id', 'tpl_wedding_table_' || n, 'name', 'Round Banquet (10pax)', 'kind', 'ellipse', 'category', 'furniture', 'x', 1 + (28.0 / 9) * (((n - 1) % 9) + 0.5) - 0.9, 'y', 5 + 7.5 * (floor((n - 1)::numeric / 9) + 0.5) - 0.9, 'w', 1.8, 'h', 1.8, 'rotation', 0, 'fill', '#FFF4EC', 'stroke', '#9060A0', 'strokeWidth', 0.04, 'label', 'T' || n, 'seats', 10, 'locked', false, 'hidden', false)
        ORDER BY n
      )
      FROM generate_series(1, 11) AS n
    )
  UNION ALL
  SELECT
    'tpl_builtin_conference',
    'plan_tpl_builtin_conference',
    'Conference',
    'Classroom-style rows facing stage.',
    'PMCM Template Library',
    30,
    20,
    1,
    120,
    jsonb_build_array(
      jsonb_build_object('id', 'tpl_conference_stage', 'name', 'Stage', 'kind', 'rect', 'category', 'stage', 'x', 12, 'y', 0.3, 'w', 6, 'h', 3, 'rotation', 0, 'fill', '#9060A0', 'stroke', '#c01867', 'strokeWidth', 0.04, 'locked', false, 'hidden', false)
    )
    || (
      SELECT jsonb_agg(
        jsonb_build_object('id', 'tpl_conference_desk_' || n, 'name', 'Classroom Desk', 'kind', 'rect', 'category', 'furniture', 'x', 1 + 1.7 * (((n - 1) % 16) + 0.5) - 0.75, 'y', 5 + 1.2 * floor((n - 1)::numeric / 16) - 0.25, 'w', 1.5, 'h', 0.5, 'rotation', 0, 'fill', '#FFF4EC', 'stroke', '#9060A0', 'strokeWidth', 0.04, 'seats', 2, 'locked', false, 'hidden', false)
        ORDER BY n
      )
      FROM generate_series(1, 60) AS n
    )
  UNION ALL
  SELECT
    'tpl_builtin_cocktail',
    'plan_tpl_builtin_cocktail',
    'Cocktail',
    'Scatter of high-tops, buffet strip.',
    'PMCM Template Library',
    30,
    20,
    1,
    120,
    (
      SELECT jsonb_agg(
        jsonb_build_object('id', 'tpl_cocktail_high_top_' || n, 'name', 'Cocktail High-Top', 'kind', 'ellipse', 'category', 'furniture', 'x', 1 + (28.0 / 10) * (((n - 1) % 10) + 0.5) - 0.35, 'y', 4 + (14.0 / 6) * (floor((n - 1)::numeric / 10) + 0.5) - 0.35, 'w', 0.7, 'h', 0.7, 'rotation', 0, 'fill', '#FFF4EC', 'stroke', '#9060A0', 'strokeWidth', 0.04, 'locked', false, 'hidden', false)
        ORDER BY n
      )
      FROM generate_series(1, 60) AS n
    )
    || jsonb_build_array(
      jsonb_build_object('id', 'tpl_cocktail_buffet', 'name', 'Buffet Table', 'kind', 'rect', 'category', 'furniture', 'x', 13.5, 'y', 18.6, 'w', 3, 'h', 0.8, 'rotation', 0, 'fill', '#FFF0E6', 'stroke', '#F06030', 'strokeWidth', 0.04, 'locked', false, 'hidden', false)
    )
  UNION ALL
  SELECT
    'tpl_builtin_classroom',
    'plan_tpl_builtin_classroom',
    'Classroom',
    'Tight grid of desks.',
    'PMCM Template Library',
    30,
    20,
    1,
    120,
    (
      SELECT jsonb_agg(
        jsonb_build_object('id', 'tpl_classroom_desk_' || n, 'name', 'Classroom Desk', 'kind', 'rect', 'category', 'furniture', 'x', 0.5 + 1.7 * (((n - 1) % 17) + 0.5) - 0.75, 'y', 1.5 + 1.1 * floor((n - 1)::numeric / 17) - 0.25, 'w', 1.5, 'h', 0.5, 'rotation', 0, 'fill', '#FFF4EC', 'stroke', '#9060A0', 'strokeWidth', 0.04, 'seats', 2, 'locked', false, 'hidden', false)
        ORDER BY n
      )
      FROM generate_series(1, 68) AS n
    )
  UNION ALL
  SELECT
    'tpl_builtin_banquet',
    'plan_tpl_builtin_banquet',
    'Banquet',
    'Full room of round tables.',
    'PMCM Template Library',
    30,
    20,
    1,
    120,
    (
      SELECT jsonb_agg(
        jsonb_build_object('id', 'tpl_banquet_table_' || n, 'name', 'Round Banquet (10pax)', 'kind', 'ellipse', 'category', 'furniture', 'x', 1 + (28.0 / 9) * (((n - 1) % 9) + 0.5) - 0.9, 'y', 5 + 7.5 * (floor((n - 1)::numeric / 9) + 0.5) - 0.9, 'w', 1.8, 'h', 1.8, 'rotation', 0, 'fill', '#FFF4EC', 'stroke', '#9060A0', 'strokeWidth', 0.04, 'label', 'T' || n, 'seats', 10, 'locked', false, 'hidden', false)
        ORDER BY n
      )
      FROM generate_series(1, 12) AS n
    )
) SELECT * FROM seeded_templates;

INSERT INTO "floor_plans" (
  "id",
  "name",
  "venue",
  "width",
  "height",
  "grid_size",
  "pax",
  "owner_id",
  "template_id",
  "objects",
  "guests",
  "suppliers",
  "seats",
  "seat_categories"
)
SELECT
  floor_plan_id,
  name || ' Base Layout',
  venue,
  width,
  height,
  grid_size,
  pax,
  'owner-sample',
  template_id,
  objects,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"id":"seat_vip","name":"VIP","colorHex":"#4f7a5e"},{"id":"seat_standard","name":"Standard","colorHex":"#d3d9d5"}]'::jsonb
FROM "_prism_seeded_floorplan_templates"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "venue_templates" (
  "id",
  "owner_id",
  "name",
  "description",
  "venue",
  "floor_plan_id",
  "pax",
  "include_guests",
  "include_suppliers",
  "guests",
  "suppliers",
  "source_type"
)
SELECT
  template_id,
  'owner-sample',
  name,
  description,
  venue,
  floor_plan_id,
  pax,
  false,
  false,
  '[]'::jsonb,
  '[]'::jsonb,
  'template'
FROM "_prism_seeded_floorplan_templates"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "floor_plan_objects" (
  "floor_plan_id",
  "object_id",
  "kind",
  "z_index",
  "object_data",
  "svg_markup"
)
SELECT
  seeded_templates.floor_plan_id,
  object_rows.object_data ->> 'id',
  object_rows.object_data ->> 'kind',
  (object_rows.z_index - 1)::integer,
  object_rows.object_data,
  NULL
FROM "_prism_seeded_floorplan_templates" AS seeded_templates
CROSS JOIN LATERAL jsonb_array_elements(seeded_templates.objects) WITH ORDINALITY AS object_rows(object_data, z_index)
ON CONFLICT ("floor_plan_id", "object_id") DO NOTHING;

DROP TABLE "_prism_seeded_floorplan_templates";

UPDATE "ops_floor_plan_drafts"
SET "source_type" = 'template'
WHERE "source_type" = 'preset';
