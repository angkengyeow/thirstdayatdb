# 🏒 NHL Game Data — Microsoft Fabric Final Project

## Quick Start

### Step 1: Download dataset
Go to https://www.kaggle.com/martinellis/nhl-game-data and download the ZIP file.
Extract all 9 CSV files.

### Step 2: Upload to Fabric Lakehouse
1. Create a new Lakehouse in your Fabric workspace (e.g. `nhl_lakehouse`)
2. Upload all 9 CSVs to `Files/nhl_raw/`

### Step 3: Run Notebooks (in order) to produce the Semantic Model
To realize the star schema shown in the attached semantic model diagram (`image-resized-1780472656393.webp`) and documented in `schema/star_schema.md`:

| Notebook | Purpose | Output |
|----------|---------|--------|
| `notebooks/RL_Notebook_Fixed.ipynb` | Primary full pipeline: Bronze (raw) → Silver (cleaned) + basic early gold rollups (not the star schema) | Bronze, Silver (incl. `silver_*`), some legacy `gold_*_performance` tables |
| `notebooks/04_Gap_Fill_StarSchema_and_Testing.ipynb` | **Adds the Semantic Star Schema (Gold layer).** Creates dimensions, fact tables, and the business gold aggregates matching the provided model diagram. Runs comprehensive tests. | Full semantic model: `dim_*`, `fact_*`, `gold_team_standings`, `gold_player_season_stats`, `gold_home_away_summary`, `gold_goals_by_period`, `gold_powerplay_efficiency` (+ tests) |
| `notebooks/03_Testing_and_Validation.ipynb` (optional alternative) | Standalone tests for star schema tables | Test report |
| `notebooks/01_EDA_and_Data_Preparation.ipynb` / `02_Gold_Layer_and_Schema.ipynb` | Alternative exploratory path to similar silver + star schema (use if preferred; 04 is the gap-filler companion to the consolidated RL notebook) | Similar star schema / gold outputs |

**Run sequence (recommended):** RL_Notebook_Fixed → 04_Gap_Fill_StarSchema_and_Testing. Then connect Power BI to the resulting Gold tables per `dashboard/power_bi_guide.md`.

### Step 4: Build Power BI Dashboard
Follow `dashboard/power_bi_guide.md` step by step.
The guide describes **one Power BI report with 6 pages total** (the original analytics pages + a prominent **Page 6 Dream Team dashboard** — a dynamic fantasy roster builder using season slicers, Top-N visuals per position (C / LW / RW / Top-4 D / Goalies), supporting cards and bars for context). Use it as either the integrated 6-page report or extract Page 6 visuals into a dedicated .pbix for focused "Dream Team" presentations.

### Step 5: Present
- Primary: Run `cd docs && node build_presentation.js` (after npm install in docs/) to generate `docs/NHL_Analytics_Presentation.pptx`.
- The README references a corresponding `docs/NHL_Project_Presentation.docx` (older export/outline or Save-As from PowerPoint). Rebuild the .pptx then optionally export or copy/paste slide content to keep the .docx in sync if your submission requires .docx.

The deck includes the updated slide describing the **6 dashboard pages**, with Page 6 as the Dream Team formation roster builder.

---

## Project Structure
```
nhl-fabric-project/
├── notebooks/
│   ├── RL_Notebook_Fixed.ipynb                           ← Bronze/Silver + legacy gold (run first)
│   ├── 01_EDA_and_Data_Preparation.ipynb                 ← EDA + bronze/silver prep (alt to RL)
│   ├── 02_Gold_Layer_and_Schema.ipynb                    ← Older star schema builder (alt to 04)
│   ├── 03_Testing_and_Validation.ipynb                   ← Standalone data quality tests
│   └── 04_Gap_Fill_StarSchema_and_Testing.ipynb          ← ★ Produces the semantic model star schema + golds (run gap fill after RL)
├── docs/
│   ├── architecture.md                      ← Architecture & decisions
│   ├── build_presentation.js                ← Source that generates the presentation (6 pages + Dream Team slide)
│   ├── NHL_Analytics_Presentation.pptx      ← Current generated deck (run the js to update)
│   └── NHL_Project_Presentation.docx        ← Alt export/outline version of the deck (update manually or re-export after regenerating pptx)
├── schema/
│   └── star_schema.md                       ← Full ER, columns, FKs, DAX for the semantic model (matches diagram)
├── dashboard/
│   └── power_bi_guide.md                    ← Step-by-step Power BI (6 pages) build guide
├── image-resized-1780472656393.webp         ← Latest visual of the semantic star schema model
└── README.md
```

## Architecture
Medallion Architecture (Bronze → Silver → Gold) on Microsoft Fabric OneLake.
See `docs/architecture.md` for full diagram.

## Dataset
- **Source:** Kaggle — [martinellis/nhl-game-data](https://www.kaggle.com/martinellis/nhl-game-data)
- **Coverage:** 6 NHL seasons
- **Tables:** 9 CSV files (~240 MB)
