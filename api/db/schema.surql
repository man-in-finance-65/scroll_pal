-- Pal data model (BUILD_PLAN.md §6). Run once in the SurrealDB Cloud query editor.
-- Screening answers are never stored: only user.eligible.
DEFINE TABLE IF NOT EXISTS user SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS clerk_id ON user TYPE string;
DEFINE FIELD IF NOT EXISTS eligible ON user TYPE option<bool>;
DEFINE FIELD IF NOT EXISTS goal ON user TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS schedule_json ON user TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS created_at ON user TYPE datetime DEFAULT time::now() READONLY;

DEFINE TABLE IF NOT EXISTS source_item SCHEMALESS;   -- user, url, status, error
DEFINE TABLE IF NOT EXISTS recipe SCHEMALESS;        -- source_item, title, ingredients[{name,qty,unit,confirmed}], steps, computed_nutrition
DEFINE TABLE IF NOT EXISTS profile_fact SCHEMALESS;  -- user, text, scope, sensitive, approved (sensitive default unticked)
DEFINE TABLE IF NOT EXISTS plan SCHEMALESS;          -- user, week, meals[]
DEFINE TABLE IF NOT EXISTS shopping_item SCHEMALESS; -- plan, name, qty
DEFINE TABLE IF NOT EXISTS meal_log SCHEMALESS;      -- user, meal, eaten_at
DEFINE TABLE IF NOT EXISTS signup SCHEMALESS;        -- created_at (live counter, Gate F)

-- Meal Prep Swap. Pods hold members and chef votes; goals and dishes are one row per member.
DEFINE TABLE IF NOT EXISTS pod SCHEMALESS;    -- code, name, members[{userId,name}], votes{userId: chefId}
DEFINE INDEX IF NOT EXISTS pod_code ON pod FIELDS code UNIQUE;
DEFINE TABLE IF NOT EXISTS goal SCHEMALESS;   -- pod, user, goal{kind,...}
DEFINE TABLE IF NOT EXISTS dish SCHEMALESS;   -- pod, user, dish{name, ingredients, steps, macros, source}
