# Power BI Dashboard Build Guide — NHL Analytics
## Step-by-step: Exact visuals, tables, and fields for all 6 pages (incl. dedicated **Page 6 — Dream Team** roster dashboard)

> The deliverable is **one Power BI report (.pbix)** containing 6 pages. Page 6 is the highlighted "Dream Team Dashboard" — a fully dynamic fantasy-style roster builder that uses season slicer and pre-aggregated gold data to instantly surface the best players by position. Perfect as a showcase page.

---

## SETUP — Before You Build Any Page

### Step 1: Connect to Fabric Lakehouse (DirectLake)

1. Open **Power BI Desktop**
2. **Home → Get Data → Microsoft Fabric (Preview)**
3. Select your Workspace → select your Lakehouse (`nhl_lakehouse`)
4. Mode: **DirectLake** (not Import)
5. Select these tables and click **Load**:
   - `dim_team`
   - `dim_player`
   - `dim_date`
   - `fact_game_performance`
   - `fact_player_stats`
   - `fact_play_events`
   - `gold_player_season_stats`   ← required for Page 6 Dream Team (and useful player analytics)

   **Optional (per your specific mentor/project requirements only):**
   - `silver_team_game_stats_valid`  ← validated raw per-team-per-game. Same grain as fact_game_performance, source for its population. Only include if required (e.g. to use raw columns or demonstrate silver layer). Not needed for any of the 6 dashboard pages as documented.

---

### Step 2: Set Up Relationships (Model View)

Go to **Model View** (left sidebar icon). Create these relationships by dragging column to column:

| From (Many side) | To (One side) | Active? |
|-----------------|---------------|---------|
| `fact_game_performance.team_id` | `dim_team.team_id` | ✅ Yes |
| `fact_game_performance.opponent_team_id` | `dim_team.team_id` | ❌ No (inactive) |
| `fact_game_performance.date_key` | `dim_date.date_key` | ✅ Yes |
| `fact_player_stats.player_id` | `dim_player.player_id` | ✅ Yes |
| `fact_player_stats.team_id` | `dim_team.team_id` | ✅ Yes |
| `fact_player_stats.date_key` | `dim_date.date_key` | ✅ Yes |
| `fact_play_events.team_id_for` | `dim_team.team_id` | ✅ Yes |
| `fact_play_events.date_key` | `dim_date.date_key` | ✅ Yes |

**Optional silver relationship (include only if you loaded the table above per requirements):**
| `silver_team_game_stats_valid.team_id` | `dim_team.team_id` | ✅ Yes |

**silver_team_game_stats_valid note (optional, only if loaded):**
This silver table is at the same grain as `fact_game_performance` (team x game). It was the direct source used to populate the fact table in ETL. It includes raw columns not present in fact (`faceOffWinPercentage`, `startRinkSide`, original `HoA` casing, etc.). Add the relationship to `dim_team` only if you load the table. Use page/visual filters or cross-filtering for seasons/dates. Not required for the documented 6-page dashboard.

> **Why inactive for opponent_team_id?**
> Power BI only allows one active relationship between two tables.
> Use `USERELATIONSHIP()` in DAX when you need to filter by opponent.

---

### Step 3: Create a Measures Table

1. **Home → Enter Data** → name it `_Measures` → click Load
2. Right-click `_Measures` in the data pane → **New Measure** for each DAX below

> **Optional silver table column names:** Only if you loaded `silver_team_game_stats_valid` and need to reference it, use original source casing (e.g. `faceOffWinPercentage`, `HoA`, `startRinkSide`).

#### Core Measures

```dax
Games Played =
DISTINCTCOUNT(fact_game_performance[game_id])
-- Format: #,##0

Total Goals =
SUM(fact_game_performance[goals])
-- Format: #,##0

Total Wins =
CALCULATE(
    COUNTROWS(fact_game_performance),
    fact_game_performance[won] = TRUE()
)
-- Format: #,##0

Win % =
DIVIDE([Total Wins], [Games Played], 0)
-- Format: 0.0%

Goals Per Game =
DIVIDE([Total Goals], [Games Played], 0)
-- Format: 0.00

Home Games =
CALCULATE(
    COUNTROWS(fact_game_performance),
    fact_game_performance[home_or_away] = "home"
)

Home Wins =
CALCULATE(
    COUNTROWS(fact_game_performance),
    fact_game_performance[home_or_away] = "home",
    fact_game_performance[won] = TRUE()
)

Home Win % =
DIVIDE([Home Wins], [Home Games], 0)
-- Format: 0.0%

Away Win % =
CALCULATE(
    DIVIDE(
        CALCULATE(COUNTROWS(fact_game_performance), fact_game_performance[won] = TRUE()),
        COUNTROWS(fact_game_performance),
        0
    ),
    fact_game_performance[home_or_away] = "away"
)
-- Format: 0.0%
```

#### Player Measures

```dax
Player Goals =
SUM(fact_player_stats[goals])
-- Format: #,##0

Player Assists =
SUM(fact_player_stats[assists])
-- Format: #,##0

Player Points =
[Player Goals] + [Player Assists]
-- Format: #,##0

Points Per Game =
DIVIDE([Player Points], DISTINCTCOUNT(fact_player_stats[game_id]), 0)
-- Format: 0.00

Shooting % =
DIVIDE(SUM(fact_player_stats[goals]), SUM(fact_player_stats[shots]), 0)
-- Format: 0.0%

Avg Plus Minus =
AVERAGE(fact_player_stats[plus_minus])
-- Format: +0.00;-0.00;0.00

Total Blocked Shots =
SUM(fact_player_stats[blocked])
-- Format: #,##0

Total Hits =
SUM(fact_player_stats[hits])
-- Format: #,##0

Avg TOI =
AVERAGE(fact_player_stats[toi_minutes])
-- Format: 0.00

Save % =
CALCULATE(
    AVERAGE(fact_player_stats[save_pct]),
    fact_player_stats[player_type] = "goalie"
)
-- Format: 0.0% (values already in decimal e.g. 0.912)

GAA =
CALCULATE(
    AVERAGE(fact_player_stats[goals_against_avg]),
    fact_player_stats[player_type] = "goalie"
)
-- Format: 0.00
```

#### Dream Team Measures
Use these with the `gold_player_season_stats` table (recommended for speed and pre-aggregated per player+season).

```dax
-- Base: Dream Team Qualified (filter visual to >=20 GP typical for awards/dream lists)
Min GP Threshold =
20
```

```dax
-- Dream Team Top 1 Center by total points (for Card visuals or combined score)
Dream Center Points =
CALCULATE(
    SUM(gold_player_season_stats[points]),
    gold_player_season_stats[position] = "C",
    TOPN(
        1,
        CALCULATETABLE(
            gold_player_season_stats,
            gold_player_season_stats[position] = "C",
            gold_player_season_stats[games_played] >= 20
        ),
        gold_player_season_stats[points],
        DESC
    )
)
-- Format: #,##0
```

```dax
-- Returns the full_name for the top center (use in a Card visual)
Dream Center =
VAR TopPlayer =
    TOPN(
        1,
        CALCULATETABLE(
            gold_player_season_stats,
            gold_player_season_stats[position] = "C",
            gold_player_season_stats[games_played] >= 20
        ),
        gold_player_season_stats[points],
        DESC
    )
RETURN
    MAXX(TopPlayer, gold_player_season_stats[full_name])
```

```dax
-- Repeat pattern for LW, RW, D (use similar for points & name of other positions)
Dream Left Wing Points =
CALCULATE(
    SUM(gold_player_season_stats[points]),
    gold_player_season_stats[position] = "LW",
    TOPN(1,
        CALCULATETABLE(gold_player_season_stats, gold_player_season_stats[position]="LW", gold_player_season_stats[games_played]>=20),
        gold_player_season_stats[points], DESC)
)

Dream LW =
VAR T = TOPN(1, CALCULATETABLE(gold_player_season_stats, gold_player_season_stats[position]="LW", gold_player_season_stats[games_played]>=20), gold_player_season_stats[points], DESC)
RETURN MAXX(T, gold_player_season_stats[full_name])
```

```dax
Dream Right Wing Points =
CALCULATE(
    SUM(gold_player_season_stats[points]),
    gold_player_season_stats[position] = "RW",
    TOPN(1,
        CALCULATETABLE(gold_player_season_stats, gold_player_season_stats[position]="RW", gold_player_season_stats[games_played]>=20),
        gold_player_season_stats[points], DESC)
)

Dream RW =
VAR T = TOPN(1, CALCULATETABLE(gold_player_season_stats, gold_player_season_stats[position]="RW", gold_player_season_stats[games_played]>=20), gold_player_season_stats[points], DESC)
RETURN MAXX(T, gold_player_season_stats[full_name])
```

Same structure can be copied and adjusted for "D" (recommend making 2 separate top D for pairings using RANKX or second TOPN with offset but use visual topN for pair tables for simplicity).

```dax
-- Sum of points from Top 4 qualified Defensemen (for the blue line total contribution)
Dream Top 4 Defense Points =
SUMX(
    TOPN(
        4,
        CALCULATETABLE(
            gold_player_season_stats,
            gold_player_season_stats[position] = "D",
            gold_player_season_stats[games_played] >= 20
        ),
        gold_player_season_stats[points], DESC
    ),
    gold_player_season_stats[points]
)
-- Format: #,##0
```

(For visual Top 4 table use the visual filter + a simple SUM measure or just the table's implicit total. For the card "total roster power", use this.)

```dax
-- For goalie use save_pct or lowest GAA (higher save better). Need to handle nulls.
Dream Goalie Save Pct =
CALCULATE(
    AVERAGE(gold_player_season_stats[avg_save_pct]),
    gold_player_season_stats[player_type] = "goalie",
    TOPN(
        1,
        CALCULATETABLE(
            gold_player_season_stats,
            gold_player_season_stats[player_type] = "goalie",
            gold_player_season_stats[games_played] >= 30,
            NOT ISBLANK(gold_player_season_stats[avg_save_pct])
        ),
        gold_player_season_stats[avg_save_pct],
        DESC
    )
)
-- Format: 0.0%
```

```dax
Dream Goalie =
VAR TopG =
    TOPN(
        1,
        CALCULATETABLE(
            gold_player_season_stats,
            gold_player_season_stats[player_type] = "goalie",
            gold_player_season_stats[games_played] >= 30
        ),
        gold_player_season_stats[avg_save_pct],
        DESC
    )
RETURN
    MAXX(TopG, gold_player_season_stats[full_name])
```

```dax
-- (Optional helper measures... the Top 4 D is now a dedicated measure for the roster total)

-- Dream Team Total Star Points — sums key roster contributors (3F + top-4 D skater points). Goalies shown separately via save% cards or visual totals since their "points" metric is different.
Dream Team Total Points =
[Dream Center Points] +
[Dream Left Wing Points] +
[Dream Right Wing Points] +
[Dream Top 4 Defense Points]
-- Format: #,##0

-- Add a separate card for the elite goalie attribute (e.g. the Dream Goalie Save Pct or the name + GP + save% in a card group).
```

#### Team Measures

```dax
Shot % =
DIVIDE(SUM(fact_game_performance[goals]), SUM(fact_game_performance[shots]), 0)
-- Format: 0.0%

Power Play % =
DIVIDE(
    SUM(fact_game_performance[powerPlayGoals]),
    SUM(fact_game_performance[powerPlayOpportunities]),
    0
)
-- Format: 0.0%

Faceoff Win % =
AVERAGE(fact_game_performance[faceoff_win_pct])
-- Format: 0.0%
-- Note: Dataset provides faceoff win % per team per game (pre-computed by source; no raw counts of wins/taken were available).
-- (If you loaded the optional `silver_team_game_stats_valid`, you could use `AVERAGE(silver_team_game_stats_valid[faceOffWinPercentage])` as alternative.)
```

---

## PAGE 1 — Executive Summary

**Purpose:** High-level league overview for a selected season.

**Page background color:** Suggested dark navy or white — your choice.

---

### Slicers (add these first — they filter all visuals on the page)

#### Slicer 1 — Season
- Visual: **Slicer**
- Field: `dim_date[year]`
- Format → Slicer settings → Style: **Dropdown** (saves space)

#### Slicer 2 — Game Type
- Visual: **Slicer**
- Field: `fact_game_performance[type]`
  - Values will show: `R` (Regular Season) and `P` (Playoffs)
- Format → Style: **Tile**

---

### KPI Cards (top row)

#### Card 1 — Total Games
- Visual: **Card** (use the classic Card, not new Card visual)
- Fields well: `[Games Played]` (your DAX measure)
- Format → Display units: **None**, Decimal places: **0**
- Label: "Games Played"

#### Card 2 — Total Goals
- Visual: **Card**
- Fields well: `[Total Goals]`
- Label: "Total Goals"

#### Card 3 — Goals Per Game
- Visual: **Card**
- Fields well: `[Goals Per Game]`
- Format → Decimal places: **2**
- Label: "Goals / Game"

#### Card 4 — Home Win %
- Visual: **Card**
- Fields well: `[Home Win %]`
- Format → Display units: **None**, format as **percentage**
- Label: "Home Win %"

---

### Main Visuals

#### Visual 1 — Goals Trend by Month (Line Chart)
- Visual: **Line Chart**
- X-axis: `dim_date[month_name]`
  - Sort by `dim_date[month]` (a numeric column) so Jan→Dec not alphabetical
  - To do this: right-click `month_name` column in data pane → **Sort by column** → select `month`
- Y-axis: `[Total Goals]`
- Legend: *(leave empty for single line, or add `fact_game_performance[type]` for Regular vs Playoff lines)*
- Tooltips: add `[Games Played]`, `[Goals Per Game]`
- Title: "Goals Scored by Month"

#### Visual 2 — Wins by Team (Bar Chart)
- Visual: **Clustered Bar Chart**
- Y-axis: `dim_team[abbreviation]`
- X-axis: `[Total Wins]`
- Sort: descending by Total Wins
  - Click the `...` menu on the visual → Sort axis → Total Wins → Descending
- Data labels: On
- Title: "Total Wins by Team"

#### Visual 3 — Game Outcomes (Donut Chart)
- Visual: **Donut Chart**
- Legend: `fact_game_performance[settled_in]`
  - Values will be: `REG`, `OT`, `SO`
- Values: `[Games Played]`
- Title: "Game Outcomes (REG / OT / SO)"

---

## PAGE 2 — Team Performance

**Purpose:** Compare teams on efficiency metrics.

---

### Slicers

#### Slicer 1 — Team
- Visual: **Slicer**
- Field: `dim_team[team_name]`
- Style: **Dropdown** (multi-select enabled)

#### Slicer 2 — Season
- Visual: **Slicer**
- Field: `dim_date[year]`
- Style: **Dropdown**

---

### Visuals

#### Visual 1 — Team Standings Table
- Visual: **Table**
- Columns (drag into Values well in this order):
  1. `dim_team[team_name]` — rename to "Team"
  2. `[Total Wins]` — rename to "Wins"
  3. `[Games Played]` — rename to "GP"
  4. `[Win %]` — rename to "Win%"
  5. `[Total Goals]` — rename to "Goals"
  6. `[Goals Per Game]` — rename to "G/GP"
  7. `[Shot %]` — rename to "Shot%"
  8. `[Power Play %]` — rename to "PP%"
  9. `[Faceoff Win %]` — rename to "FO%"
- Sort: by `[Win %]` descending
- Format → Conditional formatting on Win%:
  - Background color scale: lowest = red, highest = green

#### Visual 2 — Win % by Team (Bar Chart)
- Visual: **Clustered Bar Chart**
- Y-axis: `dim_team[abbreviation]`
- X-axis: `[Win %]`
- Sort: descending
- Title: "Win % by Team"

#### Visual 3 — Shot% vs Win% (Scatter Plot)
- Visual: **Scatter Chart**
- X-axis: `[Shot %]` *(shot conversion rate — goals ÷ shots)*
- Y-axis: `[Win %]`
- Values (the dots): `dim_team[abbreviation]`
- Legend: *(optional)* `dim_team[team_name]`
- Tooltips: add `[Total Goals]`, `[Games Played]`
- Title: "Shot% vs Win% by Team"
- **What to look for:** Teams in the top-right are most efficient

#### Visual 4 — Power Play % Ranking (Bar Chart)
- Visual: **Clustered Bar Chart**
- Y-axis: `dim_team[abbreviation]`
- X-axis: `[Power Play %]`
- Sort: descending
- Title: "Power Play % by Team"

#### Visual 5 — Faceoff Win % (Bar Chart)
- Visual: **Clustered Bar Chart**
- Y-axis: `dim_team[abbreviation]`
- X-axis: `[Faceoff Win %]`
- Sort: descending
- Title: "Faceoff Win % by Team"

---

## PAGE 3 — Player Analytics

**Purpose:** Individual player performance.

---

### Slicers

#### Slicer 1 — Position
- Visual: **Slicer**
- Field: `dim_player[position]`
- Style: **Tile** (so you can see: C, LW, RW, D, G)

#### Slicer 2 — Season
- Visual: **Slicer**
- Field: `dim_date[year]` (connects via `fact_player_stats.date_key`)
- Style: **Dropdown**

#### Slicer 3 — Team
- Visual: **Slicer**
- Field: `dim_team[team_name]` (connects via `fact_player_stats.team_id`)
- Style: **Dropdown**

---

### Visuals

#### Visual 1 — Top Scorers (Bar Chart)
- Visual: **Clustered Bar Chart**
- Y-axis: `dim_player[full_name]`
- X-axis: `[Player Points]`
- Filter this visual (Filters pane → Visual level filter):
  - Add `dim_player[position]` → filter to **exclude** goalies (is not G)
  - Add TopN filter: show top **20** by `[Player Points]`
- Sort: descending by Player Points
- Data labels: On
- Title: "Top 20 Scorers by Points"

#### Visual 2 — Goals vs Assists Scatter
- Visual: **Scatter Chart**
- X-axis: `[Player Goals]`
- Y-axis: `[Player Assists]`
- Values (dots): `dim_player[full_name]`
- Legend: `dim_player[position]`
- Apply TopN filter on this visual: top 50 by `[Player Points]` (to avoid 7,000 dots)
- Tooltips: `[Player Points]`, `dim_team[team_name]`
- Title: "Goals vs Assists — Top 50 Skaters"

#### Visual 3 — Points Trend by Season (Line Chart)
- Visual: **Line Chart**
- X-axis: `fact_player_stats[season]`
- Y-axis: `[Player Points]`
- Legend: `dim_player[position]`
  - This shows how each position's points output changed season over season
- Title: "Points by Position Over Seasons"

#### Visual 4 — Shooting % Leaderboard (Bar Chart)
- Visual: **Clustered Bar Chart**
- Y-axis: `dim_player[full_name]`
- X-axis: `[Shooting %]`
- Apply TopN filter: top 15 by `[Shooting %]`
- Also add filter: `fact_player_stats[goals]` is greater than **10**
  (prevents players with 1 shot 1 goal from dominating)
- Sort: descending
- Title: "Shooting % — Top 15 (min. 10 goals)"

#### Visual 5 — Top Goalies Table
- Visual: **Table**
- Filters pane → add `fact_player_stats[player_type]` = `goalie`
  (or `dim_player[position]` = `G`)
- Columns:
  1. `dim_player[full_name]` — "Goalie"
  2. `dim_team[team_name]` — "Team"
  3. `DISTINCTCOUNT(fact_player_stats[game_id])` — "GP" (or create measure)
  4. `[Shooting %]` renamed to "Save%" *(Note: save_pct is stored on fact_player_stats[save_pct] — you can use `AVERAGE(fact_player_stats[save_pct])` or add a Save % measure)*
- Sort: by Save% descending
- Title: "Goalie Leaderboard"

> **Simpler Save % measure for goalies:**
> ```dax
> Save % (Goalies) =
> CALCULATE(
>     AVERAGE(fact_player_stats[save_pct]),
>     fact_player_stats[player_type] = "goalie"
> )
> ```

---

## PAGE 4 — Play-by-Play Analysis

**Purpose:** Tactical event analysis and shot location.

> ⚠️ `fact_play_events` has 2M+ rows. To keep performance fast:
> - Always use **slicers** to narrow the data before the visual renders
> - Use **aggregated measures** (COUNT, SUM) not raw row-level fields
> - For the scatter/shot map: filter to **Goal** and **Shot** events only

---

### Slicers

#### Slicer 1 — Event Type
- Visual: **Slicer**
- Field: `fact_play_events[event]`
- Style: **Tile** (values: Goal, Shot, Penalty, Hit, Blocked Shot, etc.)
- Set default selection: **Goal** and **Shot**

#### Slicer 2 — Period
- Visual: **Slicer**
- Field: `fact_play_events[period]`
- Style: **Tile** (values: 1, 2, 3, 4 for OT)

#### Slicer 3 — Season
- Visual: **Slicer**
- Field: `dim_date[year]`
- Style: **Dropdown**

---

### Visuals

#### Visual 1 — Event Count by Type (Bar Chart)
- Visual: **Clustered Bar Chart**
- Y-axis: `fact_play_events[event]`
- X-axis: `COUNTROWS(fact_play_events)` — drag the table itself and Power BI will offer Count of rows, or create:
  ```dax
  Event Count = COUNTROWS(fact_play_events)
  ```
- Sort: descending
- Title: "Events by Type"

#### Visual 2 — Goals by Period (Column Chart)
- Visual: **Clustered Column Chart**
- X-axis: `fact_play_events[period]`
- Y-axis: `[Event Count]` (from above)
- Filters pane → Visual level filter: `fact_play_events[event]` = `Goal`
- Title: "Goals Scored by Period"

#### Visual 3 — Goals by Shot Type (Bar Chart)
- Visual: **Clustered Bar Chart**
- Y-axis: `fact_play_events[secondary_type]`
  - Values: Slap Shot, Wrist Shot, Snap Shot, Backhand, Tip-In, etc.
- X-axis: `[Event Count]`
- Filters pane: `fact_play_events[event]` = `Goal`
- Sort: descending
- Title: "Goals by Shot Type"

#### Visual 4 — Shot Distribution by Period (Stacked Bar)
- Visual: **Stacked Bar Chart**
- Y-axis: `fact_play_events[period]`
- X-axis: `[Event Count]`
- Legend: `fact_play_events[event]`
  - Filter legend to: `Shot`, `Goal`, `Missed Shot`, `Blocked Shot`
- Title: "Shot Attempts by Period"

#### Visual 5 — Shot Location Map (Scatter Plot)
- Visual: **Scatter Chart**
- X-axis: `fact_play_events[x]`
  - Under X-axis: set "Summarization" to **Average** or **Don't summarize** (use individual points)
- Y-axis: `fact_play_events[y]`
- Values (dots): `fact_play_events[play_id]` (use as identifier)
  - Set summarization to **Count** (this becomes the bubble size = event density)
- Legend: `fact_play_events[event]`
- Filters: event = `Goal` or `Shot`
- Title: "Shot Locations on Rink"

> **Tip for a proper rink background:**
> 1. Save an NHL rink image (top-down view) as a PNG
> 2. In the Scatter chart → Format → Plot area → Image → upload the rink PNG
> 3. Set image transparency to ~50% so the dots are visible
> x range is roughly -100 to 100, y range is roughly -42.5 to 42.5 in NHL coordinates

#### Visual 6 — OT/SO Goals Card
- Visual: **Card**
- Create this measure first:
  ```dax
  OT Goals =
  CALCULATE(
      COUNTROWS(fact_play_events),
      fact_play_events[event] = "Goal",
      fact_play_events[period_type] = "OVERTIME"
  )
  ```
- Fields well: `[OT Goals]`
- Title: "Overtime Goals"

---

## PAGE 5 — Home vs Away Analysis

**Purpose:** Quantify home ice advantage across seasons.

---

### Slicers

#### Slicer 1 — Season
- Visual: **Slicer**
- Field: `dim_date[year]`
- Style: **Dropdown**

#### Slicer 2 — Game Type
- Visual: **Slicer**
- Field: `fact_game_performance[type]`
- Style: **Tile**

---

### Visuals

#### Visual 1 — Home vs Away Win % Over Seasons (Line Chart)
- Visual: **Line Chart**
- X-axis: `fact_game_performance[season]`
- Y-axis: `[Home Win %]` as Line 1
  - Click the paint roller → Add another Y series → `[Away Win %]`
  - Or use: **Line Chart with two measures** — add both to the Y-axis well
- Legend: *(auto-populated with measure names)*
- Add a reference line at 50%:
  - Format → Reference lines → Add line → Value: 0.5
- Title: "Home Win% vs Away Win% by Season"

#### Visual 2 — Goals For vs Against by Home/Away (Clustered Bar)
- Visual: **Clustered Bar Chart**
- Y-axis: `fact_game_performance[home_or_away]`
- X-axis: `[Goals Per Game]`
  - Add a second series: create this measure:
    ```dax
    Avg Goals Per Game =
    DIVIDE(SUM(fact_game_performance[goals]), [Games Played], 0)
    ```
- Title: "Average Goals — Home vs Away"

#### Visual 3 — Avg Shots Home vs Away (Bar Chart)
- Visual: **Clustered Bar Chart**
- Y-axis: `fact_game_performance[home_or_away]`
- X-axis:
  ```dax
  Avg Shots =
  DIVIDE(SUM(fact_game_performance[shots]), [Games Played], 0)
  ```
- Title: "Average Shots — Home vs Away"

#### Visual 4 — Home Win % Gauge
- Visual: **Gauge**
- Value: `[Home Win %]`
- Minimum: `0`
- Maximum: `1`
- Target: `0.5` (50% baseline — anything above = home advantage confirmed)
- Format: percentage
- Title: "Home Win% vs 50% Baseline"

#### Visual 5 — Home vs Away by Team (Matrix)
- Visual: **Matrix**
- Rows: `dim_team[team_name]`
- Columns: `fact_game_performance[home_or_away]`
- Values: `[Win %]`
- Format → Conditional formatting on values → Background color (green = high, red = low)
- Title: "Win% by Team — Home vs Away"

---

## PAGE 6 — Dream Team

**Purpose:** Build and showcase your ultimate "Dream Team" roster. Change the season slicer and instantly get a fresh roster of the highest-performing players at each position (and top goalies). Perfect finale/visual centerpiece for presentations or fantasy discussions.

**Pro tip:** This page shines with the `gold_player_season_stats` table pre-aggregated by player + season. Add a dark / dramatic page background color to make the roster "pop."

---

### Slicers (add these first, they control the whole dream roster)

#### Slicer 1 — Season (Most Important)
- Visual: **Slicer**
- Field: `gold_player_season_stats[season]`
- Style: **Dropdown**
- Recommendation: Single-select (turn off multi-select in Format → Slicer settings → Selection)
- Optional enhancement:
  1. In Data view, select the `gold_player_season_stats` table
  2. New column → `Season Display = LEFT([season], 4) & "–" & RIGHT([season], 4)`
  3. Use *this* column in the slicer instead (more human readable e.g. "2016–2017")
  4. To keep sort order correct: right-click Season Display column → Sort by column → `season`

#### Slicer 2 — Min Games Played (optional but powerful)
- Create a **What if parameter** (Modeling → New parameter) named "GP Threshold", Integer, min 1, max 82, default 20, increment 1.
- This generates a "GP Threshold Value" measure you can use.
- Or for simpler: page-level filter on `gold_player_season_stats[games_played] >= 20` (recommended baseline).

---

### Recommended Page-Level Filters
In the Filters pane (right side), drag to **Filters on this page**:
- `gold_player_season_stats[season]` is not blank (or leave via slicer)
- `gold_player_season_stats[games_played] >= 20`
- (Goalie visuals will use higher threshold)

---

### Visual 1 — Dream Roster Header
- Insert a blank **Text box** at top center or left:
  - Text: **DREAM TEAM — SEASON ROSTER**
  - (use large bold font, ~28–32 pt, white or gold color)
- Optionally place `[Selected Season]` by using a Card tied to a simple measure `Selected Season = SELECTEDVALUE(gold_player_season_stats[season])` underneath or on title area.

---

### Core Roster Visuals — The Heart of the Page (Layout: 2–3 rows of position blocks)

Use a mix of **Table** visuals + **Card** visuals built from the Dream Team DAX measures or direct Top N filtering on the visual. Here's the easiest reproducible approach:

#### The Forward Unit (3 tables horizontally aligned)

**CENTER**
- Visual: **Table**
- Drag from gold_player_season_stats: `full_name`, `team`, `games_played`, `points`, `goals`, `assists`, `avg_toi_minutes`
- Visual level filters (Filters on this visual):
  - `position` = `C`
  - Add Top N filter: Show **Top 1** items by `points` (desc)
- Title: **CENTER**  (set title text color / background to stand out)
- Turn data bars on for the `points` column for flair
- **Dot styling:** Format → Values → make font large if desired for "star" appeal

**LEFT WING**
- Clone the CENTER table visual
- Change visual filter: `position` = `LW`
- Top 1 by `points`
- Rename visual title to **LEFT WING**

**RIGHT WING**
- Same, filter: `position` = `RW`

Place the three table visuals side-by-side in a row. Resize each to ~3–4 fields visible, compact row height.

#### The Blue Line (Defensemen)

**TOP DEFENSE (Top 4)**
- Visual: **Table**
- Fields: `full_name`, `team`, `games_played`, `points`, `plus_minus`, `avg_toi_minutes`
- Filters (visual):
  - `position` = `D`
  - Top N = **4** by `points`
- Title: **TOP 4 DEFENSEMEN**
- Optionally add small multiple if using 2 pairs layout (or make two separate Top2 tables labeled "PAIR 1", "PAIR 2")
- Conditional format plus_minus (green/red diverging)

#### Between The Pipes (Goalies)

**DREAM GOALIES (Top 2 by Save%)**
- Visual: **Table**
- Fields: `full_name`, `team`, `games_played`, `avg_save_pct`, `avg_gaa`, `points` (goalies will have 0 points)
- Filters (visual):
  - `player_type` = `goalie`
  - `games_played` is greater than or equal to **25** (stricter for goalies – avoid small samples)
  - Top N = **2** items by `avg_save_pct` (descending)
- Title: **DREAM GOALIES**
- Format `avg_save_pct` as percentage with 1 decimal
- Bonus: Make a second table/visual "BEST GAA" going Top 2 LOWEST `avg_gaa` (may surface different goalie)

---

### Summary "Star Power" Cards (place prominently, maybe right sidebar or top right)

Create using the helper measures added earlier (full roster forwarding + blue line):

1. Card visual → Field: `[Dream Team Total Points]`
   - Large number formatting (this now = top C + top LW + top RW + sum of top-4 D skater points)
   - Title: **DREAM TEAM SKATER POINTS**

2. Separate group of cards or multi-row for the goalies:
   - Card: `[Dream Goalie]` (name)
   - Card or table visual for Top 2 Goalies with `avg_save_pct` and `games_played`
   - Title area: **ELITE GOALIES**

3. Text box: "Roster: 3F + Top 4 D (by points) + Top 2 Goalies (by Save% min 25 GP)"

The visual table for TOP 4 DEFENSEMEN and DREAM GOALIES visuals will show the actual selected players and their individual stats (use the table totals if desired for quick sums).

If you want more roster slots (e.g. extra D or extra forward depth):
- Duplicate your Top 1 D tables and change Top N offset or use RANKX advanced for #2, #3, #4 separately, or simply set 2nd table to TopN 2–4 with "is not" tricks but easiest is one table for all top4.

---

### Supporting Analytical Visuals (context why this roster)

#### Visual A — Top 10 Centers This Season (Bar Chart)
- Visual: **Clustered Bar Chart**
- Y-axis: `gold_player_season_stats[full_name]`
- X-axis: `gold_player_season_stats[points]`
- Visual filters: `position` = `C` + Top N 10 by points (you can keep page season filter)
- Title: "Top Centers — This Season"
- Data labels on
- This gives context: the chosen Center should usually be #1 on this chart

Do analogous small charts for:
- Top 8 LW
- Goalie Save% distribution (perhaps scatter GP vs Save% with goalies highlighted or Top N filter to exclude 1 game wonders)

#### Visual B — Dream Team Position Breakdown (Donut or Stacked)
- Maybe a simple Card group showing the 4 "segments" (F/D/G numbers) or skip if overkill.

---

### Layout suggestions & polish
- Group visuals with rectangles or just consistent spacing/gutters.
- Add a footer text box "Data source: NHL Game Data via Kaggle • Gold Layer (Regular Season) • Microsoft Fabric"
- Consider adding bookmarks: "2010s Dream", "2018 Dream", etc for demo (advanced).
- Make the dream roster tables use "Focus mode" friendly colors or icon indicators (stars for high plus_minus).

---

**How it feels in demo:**
User changes the Season dropdown → every table and card instantly refreshes with that season's new stars. "For 2016-17 the Dream Team was Crosby centering a line..." etc. Magical and talks itself.

---

## TIPS & BEST PRACTICES

### Performance
- Keep `fact_play_events` visuals filtered — unfiltered it scans 2M+ rows
- Use `DISTINCTCOUNT(game_id)` for game counts — never `COUNTROWS` on the fact table (which returns 2 rows per game)
- Avoid calculated columns in large fact tables; use measures instead

### Filters to Set as Page Defaults
- Set `fact_game_performance[type]` = `R` (Regular Season) as a **page-level filter** so all visuals default to regular season; let users toggle to Playoffs

### won column
- `won` is stored as **boolean** (`true` / `false`)
- In DAX always use: `fact_game_performance[won] = TRUE()`
- Never use `= 1` — it will throw a data type error

### Relationships reminder
- `dim_team` connects to `fact_game_performance` on `team_id` (active) and `opponent_team_id` (inactive)
- To use the inactive relationship in DAX:
  ```dax
  Opponent Goals Allowed =
  CALCULATE(
      SUM(fact_game_performance[goals]),
      USERELATIONSHIP(fact_game_performance[opponent_team_id], dim_team[team_id])
  )
  ```

### Visual Display Units
- For Cards showing counts like 23,730: use the **classic Card visual** (not the new Card)
  - Classic Card respects the measure's format string (`#,##0`)
  - New Card auto-abbreviates (shows "24K") regardless of format

### Conditional Formatting on Tables
1. Click the table visual → Format → Cell elements
2. Select the column (e.g., Win%)
3. Turn on Background color → Format style: Color scale
4. Min: red (`#FF4444`), Mid: white, Max: green (`#00AA44`)
