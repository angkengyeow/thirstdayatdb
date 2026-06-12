# NHL Project — Architecture

## Overview

Medallion Architecture (Bronze → Silver → Gold) implemented on **Microsoft Fabric** using OneLake, PySpark, and Power BI DirectLake.

---

## Pipeline

The project is split across two core notebooks for a clean reproducible build of the **semantic star schema model** shown in the attached diagram and `schema/star_schema.md`:

```
Raw CSVs (Kaggle, Files/nhl_raw/)
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  notebooks/RL_Notebook_Fixed.ipynb                  │
│  - Bronze: raw Delta tables from the 9 CSVs         │
│  - Silver: cleaning, deduping, derived columns      │
│  - Some Gold (legacy): gold_team_performance*,      │
│    gold_player_performance, gold_game_summary       │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  notebooks/04_Gap_Fill_StarSchema_and_Testing.ipynb         │
│  - Completes missing silvers (skater, goalie, plays)        │
│  - Builds full Gold Star Schema (the semantic model):       │
│      dim_team, dim_player, dim_date                         │
│      fact_game_performance, fact_player_stats, fact_play_events │
│      gold_team_standings, gold_player_season_stats,         │
│      gold_home_away_summary, gold_goals_by_period,          │
│      gold_powerplay_efficiency                              │
│  - Runs 25+ automated data quality / integrity tests        │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
  Power BI DirectLake Semantic Model  (use dims + facts + gold_*  — star schema per diagram)
       │
       ▼
  Power BI Dashboard (6 pages: 5 analytics + Page 6 Dream Team formation roster builder, built on gold_player_season_stats)
```

> 03_Testing_and_Validation.ipynb is an earlier/parallel version of tests. Prefer the tests embedded in 04 after running the gap fill.

---

## Layer Details

### Bronze Layer
Raw data ingested as Delta tables (table names directly from CSV filenames, all lowercase) with no transformation.

| Table | Source CSV |
|-------|-----------|
| `game` | game.csv |
| `team_info` | team_info.csv |
| `player_info` | player_info.csv |
| `game_teams_stats` | game_teams_stats.csv |
| `game_skater_stats` | game_skater_stats.csv |
| `game_plays` | game_plays.csv |
| `game_shifts` | game_shifts.csv |
| `game_goalie_stats` | game_goalie_stats.csv |
| `game_scratches` | game_scratches.csv |

### Silver Layer
Cleaned, validated, and joined tables.

| Table | Description |
|-------|-------------|
| `silver_game` | Cleaned game records |
| `silver_team` | Deduplicated team info |
| `silver_player` | Cleaned player roster |
| `silver_team_game_stats` | Per-game team stats |
| `silver_team_game_stats_valid` | Validated subset (inner join to teams) |
| `silver_game_skater_stats` | Per-game skater stats (enhanced with points, toi, shooting_pct) |
| `silver_game_goalie_stats` | Per-game goalie stats (computed save_pct + gaa) |
| `silver_game_plays` | Play-by-play with derived period_type + safe nulls |

**Note for Semantic Model:** Primary model for the documented 6-page Power BI dashboard is the Gold dimensional star schema (dims + facts + gold aggregates like gold_player_season_stats). Include `silver_team_game_stats_valid` in DirectLake model **only if** your mentor/project explicitly requires it (e.g. to show silver or use raw columns). The guide and visuals are built around the Gold layer.

### Gold Layer — Star Schema (the Semantic Model)
Dimensional model (dims + facts + gold aggregates) that is the **primary model used by the Power BI dashboard and semantic model diagram**.

**Dimension tables:**
| Table | Description |
|-------|-------------|
| `dim_team` | Teams (32 NHL) |
| `dim_player` | Player roster (~7k players) |
| `dim_date` | Game date attributes (calendar hierarchy for time intelligence) |

**Fact tables:**
| Table | Grain | Key Columns (see full in star_schema.md) |
|-------|-------|-----------------------------------------|
| `fact_game_performance` | 1 row per team per game (2 rows/game) | `game_id`, `team_id`, `opponent_team_id`, `date_key`, `season`, `type`, `home_or_away`, `won` (bool), `goals`, `shots`, `hits`, `powerPlay*`, `shot_pct`, `faceoff_win_pct`, `settled_in`, `head_coach`, ... |
| `fact_player_stats` | 1 row per player per game | `game_id`, `player_id`, `team_id`, `date_key`, `player_type`, `goals`, `assists`, `points`, `shots`, `toi_minutes`, `save_pct`/`goals_against_avg` (goalies), ... |
| `fact_play_events` | 1 row per key play event | `play_id`, `game_id`, `date_key`, `team_id_for`/`against`, `event`, `secondary_type`, `period`, `period_type`, `x`/`y`, ... |

**Gold aggregates (pre-computed for analytics + Dream Team dashboard; normally filtered to regular season type='R'):**
| Table | Description |
|-------|-------------|
| `gold_team_standings` | Regular season standings + efficiency by season+team (wins, shooting, pp, etc.) |
| `gold_player_season_stats` | Season-by-player aggregates (skater + goalie); main driver of Page 6 Dream Team roster builder |
| `gold_home_away_summary` | Home vs away metrics over seasons |
| `gold_goals_by_period` | Goal volume by period + shot type |
| `gold_powerplay_efficiency` | PP opportunities/goals/efficiency by team per season |

---

## Key Design Decisions

- **Two-notebook flow for the semantic model**:
  - `RL_Notebook_Fixed.ipynb` = bronze + silver + legacy gold performance rollups
  - `04_Gap_Fill_StarSchema_and_Testing.ipynb` = adds missing silvers + builds the full dim/fact star schema + the 5 gold aggregates + comprehensive tests (`this produces the model described by the provided semantic diagram`)
- **`won` column is boolean** (`true` / `false`) — DAX filters must use `= TRUE()` not `= 1`.
- **`fact_game_performance` has 2 rows per game** (home + away). Always use `DISTINCTCOUNT(game_id)` for game counts.
- **DirectLake mode** on the star schema Gold layer (dimensions + facts + gold aggregates). Load optional `silver_team_game_stats_valid` into the semantic model **only** when required by your specific project/mentor.
- The full recommended semantic model is described in `schema/star_schema.md` and visualized in the latest attached diagram (`image-resized-1780472656393.webp`).
- The Power BI guide (`dashboard/power_bi_guide.md`) documents **6 dashboard pages** built squarely on this semantic star schema: the five analytics pages + Page 6 Dream Team formation (a dynamic fantasy roster builder powered by `gold_player_season_stats` + a season slicer for instant position-based lineups).

---

## Fabric Resources

| Resource | Name |
|----------|------|
| Workspace | (your Fabric workspace) |
| Lakehouse | `nhl_lakehouse` |
| Semantic Model | DirectLake model binding the full Gold Star Schema (dim_team / dim_player / dim_date + fact_game_performance / fact_player_stats / fact_play_events + gold_team_standings / gold_player_season_stats / gold_home_away_summary / gold_goals_by_period / gold_powerplay_efficiency). Match the visual semantic model diagram. silver_team_game_stats_valid optional only if your mentor/project explicitly requires raw columns or medallion demo. |
| Raw files | `Files/nhl_raw/` in Lakehouse |
