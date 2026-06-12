# NHL Analytics — Star Schema Design

> This document is the single source of truth for the **semantic model** (dimensions, facts, gold aggregates) exposed to Power BI.
> The visual layout is shown in `image-resized-1780472656393.webp` (latest semantic model diagram).

## Entity Relationship Overview

This star schema is the **primary semantic model** for the NHL analytics project. It is implemented in the Gold layer using the notebooks (primarily `RL_Notebook_Fixed.ipynb` followed by `04_Gap_Fill_StarSchema_and_Testing.ipynb`).

```
                    ┌──────────────┐
                    │   dim_date   │
                    │──────────────│
                    │ date_key (PK)│
                    │ date         │
                    │ year         │
                    │ month        │
                    │ month_name   │
                    │ day          │
                    │ day_of_week  │
                    │ day_name     │
                    │ quarter      │
                    │ week_of_year │
                    │ is_weekend   │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────┴───────┐ ┌─────┴──────┐ ┌─────┴──────┐
    │  dim_team    │ │ dim_player │ │  dim_date  │
    │─────────────│ │────────────│ │  (shared)  │
    │ team_id (PK)│ │ player_id  │ └────────────┘
    │ franchise_id│ │   (PK)     │
    │ city        │ │ first_name │
    │ team_name   │ │ last_name  │
    │ abbreviation│ │ full_name  │
    │ nhl_api_link│ │ nationality│
    └──────┬───────┘ │ birth_city │
           │         │ position   │
           │         │ birth_date │
           │         │ weight_lbs │
           │         │ shoots_catches│
           │         └─────┬──────┘
           │               │
    ┌──────┴───────────────┴──────────────────────┐
    │              fact_game_performance           │
    │─────────────────────────────────────────────│
    │ game_id                                     │
    │ team_id (FK → dim_team)                     │
    │ opponent_team_id (FK → dim_team)            │
    │ date_key (FK → dim_date)                    │
    │ season                                      │
    │ type (R=Regular, P=Playoffs)                │
    │ home_or_away                                │
    │ won                                         │
    │ settled_in (REG/OT/SO)                      │
    │ goals                                       │
    │ shots                                       │
    │ hits                                        │
    │ pim                                         │
    │ powerPlayOpportunities                      │
    │ powerPlayGoals                              │
    │ giveaways                                   │
    │ takeaways                                   │
    │ blocked                                     │
    │ shot_pct (derived)                          │
    │ faceoff_win_pct (derived)                   │
    │ head_coach                                  │
    └─────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────┐
    │              fact_player_stats              │
    │─────────────────────────────────────────────│
    │ game_id                                     │
    │ player_id (FK → dim_player)                 │
    │ team_id (FK → dim_team)                     │
    │ date_key (FK → dim_date)                    │
    │ season                                      │
    │ type                                        │
    │ player_type (skater / goalie)               │
    │ goals                                       │
    │ assists                                     │
    │ points (derived)                            │
    │ shots                                       │
    │ hits                                        │
    │ blocked                                     │
    │ penalty_minutes                             │
    │ plus_minus                                  │
    │ giveaways                                   │
    │ takeaways                                   │
    │ toi_minutes (derived)                       │
    │ shooting_pct (derived, skaters)             │
    │ save_pct (goalies only)                     │
    │ goals_against_avg (goalies only)            │
    └─────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────┐
    │              fact_play_events               │
    │─────────────────────────────────────────────│
    │ play_id (PK)                                │
    │ game_id                                     │
    │ date_key (FK → dim_date)                    │
    │ team_id_for (FK → dim_team)                 │
    │ team_id_against (FK → dim_team)             │
    │ season                                      │
    │ type                                        │
    │ event                                       │
    │ secondary_type                              │
    │ period                                      │
    │ period_type                                 │
    │ period_time                                 │
    │ x                                           │
    │ y                                           │
    │ description                                 │
    └─────────────────────────────────────────────┘
```

Gold aggregate tables (pre-aggregated star schema helpers for Power BI analytics and the Dream Team dashboard):

```
  gold_team_standings          (season + team grain, regular season)
    season, abbreviation, team_name, city,
    games_played, wins, losses, win_pct,
    goals_for, total_shots, avg_shot_pct, avg_faceoff_win_pct,
    pp_goals, pp_opportunities, pp_efficiency_pct,
    total_hits, total_giveaways, total_takeaways

  gold_player_season_stats     (season + player grain, regular season)
    season, player_id, full_name, position, nationality, team, player_type,
    games_played, goals, assists, points, shots, hits, blocked_shots,
    penalty_minutes, plus_minus,
    avg_toi_minutes, avg_shooting_pct, avg_save_pct, avg_gaa

  gold_home_away_summary       (season + home/away)
    season, home_or_away, total_games, wins, win_pct,
    avg_goals, avg_shots, avg_hits, avg_faceoff_win_pct, avg_shot_pct

  gold_goals_by_period         (season + period + shot_type)
    season, period, period_type, shot_type, total_goals

  gold_powerplay_efficiency    (season + team)
    season, abbreviation, team_name, pp_opportunities, pp_goals, pp_efficiency_pct
```

**Note:** The primary semantic model exposed to Power BI via DirectLake is the **Gold Star Schema**:
- 3 dimensions: dim_team, dim_player, dim_date
- 3 facts: fact_game_performance (grain=team+game), fact_player_stats (grain=player+game), fact_play_events (grain=play event)
- 5 gold aggregates for efficient analytics (regular season only): listed above

`fact_game_performance` is derived from `silver_team_game_stats_valid`.
`silver_team_game_stats_valid` may be included optionally in the semantic model per specific project/mentor requirements only (e.g. to access certain raw columns not denormalized into facts or to visualize the medallion). When loaded, it should be related to `dim_team`. It is **not required** for the 6 documented dashboard pages.

Fact tables contain rows for both regular season (`type='R'`) and playoffs (`type='P'`); most gold aggregates filter to regular season for comparability.

## Power BI Relationships

| From | To | Cardinality | Direction / Active |
|------|----|-------------|--------------------|
| fact_game_performance.team_id | dim_team.team_id | Many:1 | Single (active) |
| fact_game_performance.opponent_team_id | dim_team.team_id | Many:1 | Single (INACTIVE — use USERELATIONSHIP in DAX) |
| fact_game_performance.date_key | dim_date.date_key | Many:1 | Single (active) |
| fact_player_stats.player_id | dim_player.player_id | Many:1 | Single (active) |
| fact_player_stats.team_id | dim_team.team_id | Many:1 | Single (active) |
| fact_player_stats.date_key | dim_date.date_key | Many:1 | Single (active) |
| fact_play_events.team_id_for | dim_team.team_id | Many:1 | Single (active) |
| fact_play_events.date_key | dim_date.date_key | Many:1 | Single (active) |

Optional (if silver table is loaded for project requirements):
| silver_team_game_stats_valid.team_id | dim_team.team_id | Many:1 | Single (active) |

## Key DAX Measures (Power BI)

Core measures are best maintained in a dedicated `_Measures` table in Power BI (recommended) or as model measures.

```dax
-- Games / Wins basics (note: fact_game_performance has 2 rows per game)
Games Played = DISTINCTCOUNT(fact_game_performance[game_id])
Total Wins = CALCULATE(COUNTROWS(fact_game_performance), fact_game_performance[won] = TRUE())
Win % = DIVIDE([Total Wins], [Games Played])

Goals Per Game =
DIVIDE(SUM(fact_game_performance[goals]), [Games Played])

-- Team skill metrics
Shot % = DIVIDE(SUM(fact_game_performance[goals]), SUM(fact_game_performance[shots]))
Power Play % =
DIVIDE(
    SUM(fact_game_performance[powerPlayGoals]),
    SUM(fact_game_performance[powerPlayOpportunities])
)
Faceoff Win % = AVERAGE(fact_game_performance[faceoff_win_pct])

-- Player scoring (fact grain = player + game)
Player Goals = SUM(fact_player_stats[goals])
Player Assists = SUM(fact_player_stats[assists])
Player Points = [Player Goals] + [Player Assists]
Points Per Game = DIVIDE([Player Points], DISTINCTCOUNT(fact_player_stats[game_id]))
Avg TOI = AVERAGE(fact_player_stats[toi_minutes])
Shooting % = DIVIDE(SUM(fact_player_stats[goals]), SUM(fact_player_stats[shots]))
Total Hits = SUM(fact_player_stats[hits])
Total Blocked = SUM(fact_player_stats[blocked])
Avg Plus/Minus = AVERAGE(fact_player_stats[plus_minus])

-- Goalie-only metrics (use player_type or position filter)
Save % =
CALCULATE(
    AVERAGE(fact_player_stats[save_pct]),
    fact_player_stats[player_type] = "goalie"
)

GAA =
CALCULATE(
    AVERAGE(fact_player_stats[goals_against_avg]),
    fact_player_stats[player_type] = "goalie"
)
```

Dream Team (Page 6) examples — optimized for gold_player_season_stats (pre-aggregated):

```dax
-- Min GP threshold helper (can be used as visual filter or via What If param)
Min GP Threshold = 20

-- Top performer names (use in Cards) and points (use in Cards or totals)
Dream Center =
VAR TopC = TOPN(1,
    CALCULATETABLE(gold_player_season_stats,
        gold_player_season_stats[position] = "C",
        gold_player_season_stats[games_played] >= [Min GP Threshold]),
    gold_player_season_stats[points], DESC)
RETURN MAXX(TopC, gold_player_season_stats[full_name])

Dream Center Points = CALCULATE(
    SUM(gold_player_season_stats[points]),
    gold_player_season_stats[position]="C",
    TOPN(1, CALCULATETABLE(gold_player_season_stats, gold_player_season_stats[position]="C", gold_player_season_stats[games_played]>=[Min GP Threshold]), gold_player_season_stats[points], DESC))

-- Similar patterns for LW, RW, and repeated Top 4 D and Goalie (filter player_type="goalie", sort on avg_save_pct or avg_gaa desc)

Dream Team Total Points =
[Dream Center Points]
+ CALCULATE(SUM(gold_player_season_stats[points]), gold_player_season_stats[position]="LW", TOPN(1, CALCULATETABLE(...), ... ))
+ CALCULATE(SUM(gold_player_season_stats[points]), gold_player_season_stats[position]="RW", TOPN(1, CALCULATETABLE(...), ... ))
+ SUMX(TOPN(4, CALCULATETABLE(gold_player_season_stats, gold_player_season_stats[position]="D", gold_player_season_stats[games_played]>=[Min GP Threshold]), gold_player_season_stats[points], DESC), gold_player_season_stats[points])
```

**Tip:** For most Dream Team visuals on Page 6, using the table visual with visual-level Top N filters + a page/slicer on `gold_player_season_stats[season]` achieves the UX with almost no custom DAX needed (the card "top player name / stat" DAX above only needed for summary callouts). Keep measures simple and rely on the gold pre-aggregates + slicers for performance.
See `dashboard/power_bi_guide.md` for the full recommended set of measures and page-by-page build instructions.

## Table Row Estimates (6 NHL seasons, Kaggle dataset)

| Table | Estimated Rows | Grain / Notes |
|-------|----------------|---------------|
| dim_team | ~32 | One per NHL franchise in period |
| dim_player | ~7,000–8,000 | Unique players appearing in games |
| dim_date | ~2,000–2,500 | Daily dates covering season games |
| fact_game_performance | ~30,000–35,000 | 2 rows per game (home + away team) |
| fact_player_stats | ~500,000–650,000 | 1 row per (player, game) — skaters + goalies |
| fact_play_events | ~1.5M–2.5M | Key events only (goals, shots, hits, penalties, etc.) |
| gold_team_standings | ~250 | Season × team (regular season) |
| gold_player_season_stats | ~15,000–25,000 | Regular season player aggregates by season+position |
| gold_home_away_summary | ~50–100 | Season × home/away |
| gold_goals_by_period | < 1,000 | Season + period + shot type buckets |
| gold_powerplay_efficiency | ~250 | Season × team |
