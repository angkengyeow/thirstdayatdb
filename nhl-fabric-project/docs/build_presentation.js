const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "NHL Game Data Analytics — Microsoft Fabric";
pres.author = "Junior Data Engineer Programme";

// ── Palette ──
const C = {
  navy:    "0D1B2A",
  navyMid: "1A2E45",
  iceBlue: "C8E0F4",
  gold:    "F4A723",
  white:   "FFFFFF",
  muted:   "8FA8C0",
  teal:    "0F8B8D",
};

const TITLE_FONT = "Trebuchet MS";
const BODY_FONT  = "Calibri";

function mkShadow() {
  return { type: "outer", color: "000000", opacity: 0.18, blur: 8, offset: 3, angle: 135 };
}
function bgSlide(s) { s.background = { color: C.navy }; }

// Chip width auto-fit — wider chips for longer labels
function sectionChip(s, text, x = 0.5, y = 0.28) {
  const w = Math.max(1.4, text.length * 0.092 + 0.3);
  s.addShape("rect", { x, y, w, h: 0.26, fill: { color: C.gold }, line: { color: C.gold }, shadow: mkShadow() });
  s.addText(text, { x, y, w, h: 0.26, fontFace: BODY_FONT, fontSize: 9, bold: true, color: C.navy, align: "center", valign: "middle", margin: 0 });
  return w;
}

function addTitle(s, text, y = 0.68) {
  s.addShape("rect", { x: 0.5, y, w: 0.055, h: 0.52, fill: { color: C.gold }, line: { color: C.gold } });
  s.addText(text, { x: 0.68, y, w: 9.0, h: 0.52, fontFace: TITLE_FONT, fontSize: 28, bold: true, color: C.white, align: "left", margin: 0 });
}

function card(s, x, y, w, h, fill = C.navyMid) {
  s.addShape("rect", { x, y, w, h, fill: { color: fill }, line: { color: "1E3D5A", width: 0.5 }, shadow: mkShadow() });
}

function statBox(s, number, label, x, y) {
  card(s, x, y, 1.85, 1.0);
  s.addText(number, { x, y: y + 0.04, w: 1.85, h: 0.55, fontFace: TITLE_FONT, fontSize: 28, bold: true, color: C.gold, align: "center", margin: 0 });
  s.addText(label, { x, y: y + 0.6, w: 1.85, h: 0.32, fontFace: BODY_FONT, fontSize: 10, color: C.iceBlue, align: "center", margin: 0 });
}

// ─────────────────────────────────────
// SLIDE 01 — TITLE
// ─────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.1, fill: { color: C.gold }, line: { color: C.gold } });
  s.addShape("rect", { x: 0, y: 5.52, w: 10, h: 0.1, fill: { color: C.gold }, line: { color: C.gold } });

  // Right decorative panel
  card(s, 6.55, 0.35, 3.1, 5.0, C.navyMid);
  s.addShape("rect", { x: 6.55, y: 0.35, w: 3.1, h: 0.08, fill: { color: C.gold }, line: { color: C.gold } });

  s.addText("🏒", { x: 7.55, y: 0.7, w: 1.2, h: 1.0, fontSize: 40, align: "center", margin: 0 });
  s.addText("JUNIOR DATA ENGINEER\nPROGRAMME", {
    x: 6.75, y: 1.8, w: 2.7, h: 0.7,
    fontFace: BODY_FONT, fontSize: 9, bold: true, charSpacing: 2,
    color: C.gold, align: "center", margin: 0,
  });
  s.addText("Final Project", {
    x: 6.75, y: 2.55, w: 2.7, h: 0.28,
    fontFace: BODY_FONT, fontSize: 12, italic: true,
    color: C.muted, align: "center", margin: 0,
  });

  // Main titles
  s.addText("NHL GAME DATA", {
    x: 0.5, y: 0.95, w: 5.8, h: 0.75,
    fontFace: TITLE_FONT, fontSize: 44, bold: true, charSpacing: 2,
    color: C.white, align: "left", margin: 0,
  });
  s.addText("ANALYTICS", {
    x: 0.5, y: 1.68, w: 5.8, h: 0.7,
    fontFace: TITLE_FONT, fontSize: 44, bold: true, charSpacing: 2,
    color: C.gold, align: "left", margin: 0,
  });
  s.addText("Microsoft Fabric · End-to-End Data Engineering", {
    x: 0.5, y: 2.55, w: 5.8, h: 0.35,
    fontFace: BODY_FONT, fontSize: 14, italic: true,
    color: C.iceBlue, align: "left", margin: 0,
  });

  // 5 stat boxes — evenly spread full width
  const stats5 = [["6","NHL Seasons"],["~240MB","Raw Data"],["9","CSV Files"],["~4M+","Play Events"],["5","Dashboard Pages"]];
  stats5.forEach(([n, l], i) => statBox(s, n, l, 0.28 + i * 1.9, 3.5));

  s.addNotes(`SPEAKER SCRIPT — SLIDE 1: TITLE

Good [morning / afternoon], everyone. My name is [Your Name], and today I'm presenting my final project for the Junior Data Engineer Programme.

The project is called "NHL Game Data Analytics" — a fully end-to-end data engineering solution built entirely on Microsoft Fabric.

Over the next 20 minutes I'll walk you through how I took 240 megabytes of raw NHL game data spanning 6 seasons, built a complete medallion pipeline, modelled it into a star schema, and delivered a five-page interactive Power BI dashboard.

Let's get started.`);
}

// ─────────────────────────────────────
// SLIDE 02 — AGENDA
// ─────────────────────────────────────
{
  const s = pres.addSlide();
  bgSlide(s);
  sectionChip(s, "AGENDA");
  addTitle(s, "What We'll Cover Today");

  const items = [
    ["01","Project Overview & Objectives"],
    ["02","Dataset & Architecture"],
    ["03","Schema Design (Star Schema)"],
    ["04","Data Pipeline (ETL/ELT)"],
    ["05","EDA & Key Findings"],
    ["06","Power BI Dashboard"],
    ["07","Testing & Validation"],
    ["08","Business Recommendations"],
    ["09","Challenges & Learnings"],
    ["10","Q & A"],
  ];

  const colW = 4.45;
  const rowH = 0.62;
  items.forEach(([num, topic], i) => {
    const col = i < 5 ? 0 : 1;
    const row = i % 5;
    const x = 0.4 + col * (colW + 0.5);
    const y = 1.35 + row * (rowH + 0.09);
    card(s, x, y, colW, rowH, C.navyMid);
    s.addShape("rect", { x, y, w: 0.5, h: rowH, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText(num, { x, y, w: 0.5, h: rowH, fontFace: TITLE_FONT, fontSize: 14, bold: true, color: C.navy, align: "center", valign: "middle", margin: 0 });
    s.addText(topic, { x: x + 0.62, y, w: colW - 0.72, h: rowH, fontFace: BODY_FONT, fontSize: 12, color: C.white, align: "left", valign: "middle", margin: 4 });
  });

  s.addNotes(`SPEAKER SCRIPT — SLIDE 2: AGENDA

Here's what I'll cover today.

I'll start with the project overview, then walk through the dataset and architecture, the star schema design, and the data pipeline.

After that I'll share the EDA findings, walk through the dashboard, and cover testing and validation.

I'll close with business recommendations, challenges I faced, and then open it up for questions.`);
}

// ─────────────────────────────────────
// SLIDE 03 — PROJECT OVERVIEW
// ─────────────────────────────────────
{
  const s = pres.addSlide();
  bgSlide(s);
  sectionChip(s, "01 — OVERVIEW");
  addTitle(s, "Project Overview & Objectives");

  const cols = [
    { icon: "⚙️", title: "Data Pipeline", bullets: ["Bronze → Silver → Gold medallion", "Delta Lake tables in OneLake", "PySpark: RL_Notebook_Fixed"] },
    { icon: "📊", title: "Analytics", bullets: ["EDA with PySpark & Matplotlib", "Star schema: 3 dims, 3 facts", "Power BI DirectLake mode"] },
    { icon: "💡", title: "Business Value", bullets: ["Team strategy insights", "Player performance benchmarking", "Home ice advantage analysis"] },
  ];

  cols.forEach(({ icon, title, bullets }, i) => {
    const x = 0.4 + i * 3.1;
    const y = 1.38;
    const h = 3.7;
    card(s, x, y, 2.9, h, C.navyMid);
    s.addShape("rect", { x, y, w: 2.9, h: 0.07, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText(icon, { x, y: y + 0.15, w: 2.9, h: 0.55, fontSize: 26, align: "center", margin: 0 });
    s.addText(title, { x, y: y + 0.76, w: 2.9, h: 0.38, fontFace: TITLE_FONT, fontSize: 14, bold: true, color: C.gold, align: "center", margin: 0 });
    s.addShape("rect", { x: x + 0.3, y: y + 1.18, w: 2.3, h: 0.04, fill: { color: C.navyMid }, line: { color: "2A4A6A", width: 0.5 } });
    s.addText(bullets.map((b, idx) => ({ text: b, options: { bullet: true, breakLine: idx < bullets.length - 1, paraSpaceAfter: 6 } })), {
      x: x + 0.2, y: y + 1.3, w: 2.55, h: 2.2,
      fontFace: BODY_FONT, fontSize: 12, color: C.iceBlue, align: "left", valign: "top", margin: 0,
    });
  });

  s.addShape("rect", { x: 0.4, y: 5.2, w: 9.2, h: 0.35, fill: { color: C.navyMid }, line: { color: "1E3D5A", width: 0.5 } });
  s.addText("One notebook. One Lakehouse. One dashboard. End-to-end on Microsoft Fabric.", {
    x: 0.4, y: 5.2, w: 9.2, h: 0.35, fontFace: BODY_FONT, fontSize: 12, italic: true, bold: true,
    color: C.gold, align: "center", valign: "middle", margin: 0,
  });

  s.addNotes(`SPEAKER SCRIPT — SLIDE 3: PROJECT OVERVIEW

The goal of this project was to demonstrate a complete data engineering workflow — not just processing data, but delivering actual business value at the end.

Three pillars: the pipeline, the analytics layer, and the business value.

For the pipeline: Medallion architecture — Bronze for raw ingestion, Silver for cleaning, Gold for the star schema. All in a single PySpark notebook called RL_Notebook_Fixed.

Analytics: EDA with PySpark and Matplotlib, a star schema with 3 dimension tables and 3 fact tables, connected to Power BI via DirectLake — no data import needed.

Business value: We can answer real questions. Which teams are most efficient? Who are the top players? Does home ice advantage matter?

One notebook. One Lakehouse. One dashboard — end-to-end on Microsoft Fabric.`);
}

// ─────────────────────────────────────
// SLIDE 04 — DATASET & ARCHITECTURE
// ─────────────────────────────────────
{
  const s = pres.addSlide();
  bgSlide(s);
  sectionChip(s, "02 — DATASET");
  addTitle(s, "Dataset & Architecture");

  // 5 stat boxes evenly spread
  const stats = [["Kaggle","Data Source"],["~240 MB","Raw Size"],["9","CSV Files"],["6","NHL Seasons"],["~4M+","Play Events"]];
  stats.forEach(([n, l], i) => statBox(s, n, l, 0.28 + i * 1.9, 1.35));

  // Section label
  s.addText("Medallion Architecture on Microsoft Fabric", {
    x: 0.5, y: 2.55, w: 9, h: 0.3,
    fontFace: TITLE_FONT, fontSize: 13, bold: true, charSpacing: 1,
    color: C.gold, align: "center", margin: 0,
  });

  // Medallion flow — 4 boxes with arrows
  const layers = [
    { label: "BRONZE", color: "9B5523", desc: "9 raw CSV tables\nOneLake Files/nhl_raw/" },
    { label: "SILVER", color: "6B8599", desc: "7 cleaned &\nvalidated Delta tables" },
    { label: "GOLD",   color: "C49B1A", desc: "3 dims + 3 facts\n+ 4 KPI views" },
    { label: "POWER BI", color: C.teal, desc: "5-page DirectLake\ndashboard" },
  ];
  layers.forEach(({ label, color, desc }, i) => {
    const x = 0.45 + i * 2.35;
    card(s, x, 2.95, 2.1, 1.85, C.navyMid);
    s.addShape("rect", { x, y: 2.95, w: 2.1, h: 0.08, fill: { color }, line: { color } });
    s.addText(label, { x, y: 3.08, w: 2.1, h: 0.38, fontFace: TITLE_FONT, fontSize: 13, bold: true, charSpacing: 1, color, align: "center", margin: 0 });
    s.addText(desc, { x, y: 3.52, w: 2.1, h: 1.15, fontFace: BODY_FONT, fontSize: 11, color: C.iceBlue, align: "center", valign: "middle", margin: 4 });
    if (i < 3) {
      s.addText("→", { x: x + 2.12, y: 3.6, w: 0.22, h: 0.45, fontFace: TITLE_FONT, fontSize: 20, bold: true, color: C.gold, align: "center", margin: 0 });
    }
  });

  s.addText("RL_Notebook_Fixed.ipynb handles all three transformation layers in a single notebook run", {
    x: 0.5, y: 4.96, w: 9, h: 0.28, fontFace: BODY_FONT, fontSize: 11, italic: true,
    color: C.muted, align: "center", margin: 0,
  });

  s.addNotes(`SPEAKER SCRIPT — SLIDE 4: DATASET & ARCHITECTURE

The data comes from Kaggle — the NHL Game Data dataset. About 240 megabytes across 9 CSV files, covering 6 NHL seasons. The largest table is the play-by-play events with over 4 million rows.

I used the Medallion architecture on Microsoft Fabric's Lakehouse.

Bronze: raw ingestion — all 9 CSVs loaded as Delta tables with no transformation.

Silver: the cleaning layer — nulls handled, tables deduplicated, types cast, derived columns created.

Gold: the star schema — 3 dimension tables, 3 fact tables, and 4 pre-aggregated KPI views optimised for Power BI.

Critically, all three layers run inside one notebook — RL_Notebook_Fixed — which makes the pipeline simple to run and debug.

Power BI connects via DirectLake mode — reading directly from OneLake, no import needed.`);
}

// ─────────────────────────────────────
// SLIDE 05 — STAR SCHEMA
// ─────────────────────────────────────
{
  const s = pres.addSlide();
  bgSlide(s);
  sectionChip(s, "03 — SCHEMA");
  addTitle(s, "Star Schema Design");

  // Dim tables top row
  const dims = [
    { name: "dim_team", pk: "team_id", rows: "~32", cols: "team_name, abbreviation" },
    { name: "dim_player", pk: "player_id", rows: "~7,000", cols: "name, position, nationality" },
    { name: "dim_date", pk: "date_key", rows: "~2,500", cols: "season, month, day_of_week" },
  ];
  dims.forEach(({ name, pk, rows, cols }, i) => {
    const x = 0.4 + i * 3.15;
    card(s, x, 1.3, 2.9, 1.35, C.navyMid);
    s.addShape("rect", { x, y: 1.3, w: 2.9, h: 0.07, fill: { color: C.teal }, line: { color: C.teal } });
    s.addText("DIM  " + name, { x: x + 0.1, y: 1.38, w: 2.7, h: 0.32, fontFace: TITLE_FONT, fontSize: 12, bold: true, color: C.white, align: "left", margin: 0 });
    s.addText(`PK: ${pk}  |  Rows: ${rows}`, { x: x + 0.1, y: 1.72, w: 2.7, h: 0.26, fontFace: BODY_FONT, fontSize: 10, color: C.gold, align: "left", margin: 0 });
    s.addText(cols, { x: x + 0.1, y: 2.0, w: 2.7, h: 0.55, fontFace: BODY_FONT, fontSize: 10, color: C.muted, align: "left", margin: 0 });
  });

  // Three connection lines dim → fact
  [0, 1, 2].forEach(i => {
    const cx = 0.4 + i * 3.15 + 1.45;
    s.addShape("rect", { x: cx - 0.01, y: 2.65, w: 0.02, h: 0.45, fill: { color: C.gold }, line: { color: C.gold } });
    s.addShape("ellipse", { x: cx - 0.07, y: 3.06, w: 0.14, h: 0.14, fill: { color: C.gold }, line: { color: C.gold } });
  });

  // Fact tables bottom row
  const facts = [
    { name: "fact_game_performance", grain: "Team × Game", rows: "~47K", note: "Goals, shots, won (bool), home/away" },
    { name: "fact_player_stats", grain: "Player × Game", rows: "~600K", note: "Goals, assists, shots, TOI" },
    { name: "fact_play_events", grain: "One per play", rows: "~2M+", note: "Event type, x/y coords, period" },
  ];
  facts.forEach(({ name, grain, rows, note }, i) => {
    const x = 0.4 + i * 3.15;
    card(s, x, 3.22, 2.9, 1.88, C.navyMid);
    s.addShape("rect", { x, y: 3.22, w: 2.9, h: 0.07, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText("FACT  " + name, { x: x + 0.1, y: 3.3, w: 2.7, h: 0.32, fontFace: TITLE_FONT, fontSize: 11, bold: true, color: C.white, align: "left", margin: 0 });
    s.addText(`Grain: ${grain}  |  Rows: ${rows}`, { x: x + 0.1, y: 3.65, w: 2.7, h: 0.26, fontFace: BODY_FONT, fontSize: 10, color: C.iceBlue, align: "left", margin: 0 });
    s.addText(note, { x: x + 0.1, y: 3.95, w: 2.7, h: 1.0, fontFace: BODY_FONT, fontSize: 10, color: C.muted, align: "left", margin: 0 });
  });

  s.addNotes(`SPEAKER SCRIPT — SLIDE 5: STAR SCHEMA

The star schema is at the heart of the project.

Three dimension tables: dim_team with 32 rows, dim_player covering 7,000 players, and dim_date for calendar attributes.

Three fact tables: fact_game_performance has one row per team per game — about 47,000 rows for 23,700 unique games. This stores goals, shots, whether the team won, and home vs away.

fact_player_stats has about 600,000 rows — one per player per game — with goals, assists, shots, and time on ice.

fact_play_events is the most granular — over 2 million rows, capturing every play event with x/y coordinates and period. This powers the shot heatmap.

All fact tables connect to the dimension tables via foreign keys — standard star schema in Power BI.`);
}

// ─────────────────────────────────────
// SLIDE 06 — DATA PIPELINE
// ─────────────────────────────────────
{
  const s = pres.addSlide();
  bgSlide(s);
  sectionChip(s, "04 — PIPELINE");
  addTitle(s, "Data Pipeline — ETL/ELT on Microsoft Fabric");

  // Use a uniform gold circle for all step numbers
  const steps = [
    { n: "1", action: "Upload Raw CSVs", tool: "Lakehouse File Upload", output: "Bronze: Files/nhl_raw/ (9 CSVs)" },
    { n: "2", action: "Bronze → Silver", tool: "RL_Notebook_Fixed (PySpark)", output: "7 Silver Delta tables" },
    { n: "3", action: "Silver → Gold", tool: "RL_Notebook_Fixed (PySpark)", output: "11 Gold Delta tables (dims + facts + KPIs)" },
    { n: "4", action: "Validate", tool: "Notebook 03 (PySpark)", output: "25+ automated test results" },
    { n: "5", action: "Visualise", tool: "Power BI DirectLake", output: "5-page interactive dashboard" },
  ];

  steps.forEach(({ n, action, tool, output }, i) => {
    const y = 1.38 + i * 0.77;
    s.addShape("ellipse", { x: 0.42, y: y + 0.09, w: 0.42, h: 0.42, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText(n, { x: 0.42, y: y + 0.09, w: 0.42, h: 0.42, fontFace: TITLE_FONT, fontSize: 14, bold: true, color: C.navy, align: "center", valign: "middle", margin: 0 });
    card(s, 1.0, y, 8.6, 0.58, C.navyMid);
    s.addShape("rect", { x: 1.0, y, w: 0.05, h: 0.58, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText(action, { x: 1.15, y: y + 0.1, w: 2.1, h: 0.36, fontFace: TITLE_FONT, fontSize: 13, bold: true, color: C.white, align: "left", margin: 0 });
    s.addText(tool, { x: 3.4, y: y + 0.1, w: 3.3, h: 0.36, fontFace: BODY_FONT, fontSize: 11, color: C.iceBlue, align: "left", margin: 0 });
    s.addText("→ " + output, { x: 6.8, y: y + 0.1, w: 2.7, h: 0.36, fontFace: BODY_FONT, fontSize: 11, color: C.gold, align: "right", margin: 0 });
  });

  s.addText("Silver transformations: null handling · deduplication · type casting · derived columns (shot_pct, faceoff_win_pct, save_pct)", {
    x: 0.5, y: 5.28, w: 9, h: 0.26, fontFace: BODY_FONT, fontSize: 10, italic: true,
    color: C.muted, align: "center", margin: 0,
  });

  s.addNotes(`SPEAKER SCRIPT — SLIDE 6: DATA PIPELINE

Step 1: Upload. The 9 CSVs go into the Lakehouse Files section under nhl_raw. This is the Bronze landing zone.

Step 2: Bronze to Silver. RL_Notebook_Fixed creates 7 Silver Delta tables. Nulls are filled — numeric columns with zero, categorical with "unknown". Every table is deduplicated by primary key.

Step 3: Silver to Gold. Same notebook, the Silver tables are aggregated and modelled into the star schema — 11 Gold Delta tables including dimension tables, fact tables, and KPI views.

Step 4: Validate. Notebook 03 runs 25 automated tests — row counts, null checks, referential integrity, business logic.

Step 5: Visualise. Power BI connects using DirectLake — reads directly from OneLake, no import or refresh needed.

The entire transformation pipeline runs in one notebook — simple to run, simple to debug, simple to hand off.`);
}

// ─────────────────────────────────────
// SLIDE 07 — EDA & KEY FINDINGS
// ─────────────────────────────────────
{
  const s = pres.addSlide();
  bgSlide(s);
  sectionChip(s, "05 — EDA");
  addTitle(s, "EDA & Key Findings");

  const findings = [
    { icon: "🏠", q: "Home Ice Advantage?", a: "Home teams win 54–57% of regular season games" },
    { icon: "📈", q: "What Drives Wins?", a: "Shot volume, faceoff win% & power play efficiency" },
    { icon: "🥅", q: "Top Scoring Teams?", a: "Best teams: 3.0+ goals/game, >10% shot conversion" },
    { icon: "⏱️", q: "Best Period for Goals?", a: "2nd period produces the most goals across all seasons" },
    { icon: "🧤", q: "Elite Goalies?", a: "Elite save% above 0.920; league median is ~0.910" },
    { icon: "🎯", q: "Where Are Goals Scored?", a: "70%+ of goals from within 30ft of net (slot area)" },
  ];

  const cardW = 4.45;
  const cardH = 1.08;
  findings.forEach(({ icon, q, a }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.4 + col * (cardW + 0.5);
    const y = 1.35 + row * (cardH + 0.18);
    card(s, x, y, cardW, cardH, C.navyMid);
    s.addShape("rect", { x, y, w: 0.07, h: cardH, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText(icon, { x: x + 0.12, y, w: 0.72, h: cardH, fontSize: 22, align: "center", valign: "middle", margin: 0 });
    s.addShape("rect", { x: x + 0.85, y: y + 0.15, w: 0.04, h: cardH - 0.3, fill: { color: C.navyMid }, line: { color: "2A4A6A", width: 0.5 } });
    s.addText(q, { x: x + 1.02, y: y + 0.1, w: cardW - 1.12, h: 0.32, fontFace: TITLE_FONT, fontSize: 12, bold: true, color: C.gold, align: "left", margin: 0 });
    s.addText(a, { x: x + 1.02, y: y + 0.46, w: cardW - 1.12, h: 0.52, fontFace: BODY_FONT, fontSize: 11, color: C.iceBlue, align: "left", margin: 0 });
  });

  s.addNotes(`SPEAKER SCRIPT — SLIDE 7: EDA & KEY FINDINGS

What did the data tell us?

Home ice advantage is real — home teams win 54 to 57% of regular season games.

Shot volume predicts wins more reliably than shot quality. Teams with 35 or more shots per game win significantly more.

The 2nd period produces the most goals — consistent across all 6 seasons.

The top three predictors of winning are shot volume, faceoff win percentage, and power play efficiency.

Elite goalies maintain a save percentage above 0.920. The league median is around 0.910.

Over 70% of goals come from within 30 feet of the net — the slot zone. This has direct implications for defensive coverage.

These aren't just interesting stats — they're actionable, and I'll come back to them in the recommendations.`);
}

// ─────────────────────────────────────
// SLIDE 08 — POWER BI DASHBOARD
// ─────────────────────────────────────
{
  const s = pres.addSlide();
  bgSlide(s);
  sectionChip(s, "06 — DASHBOARD");
  addTitle(s, "Power BI Dashboard — 6 Pages");

  const pages = [
    { pg: "P1", title: "Executive Summary",  desc: "KPI cards, goals trend, win rate by team",       q: "How is the league performing?" },
    { pg: "P2", title: "Team Performance",   desc: "Standings, shot% vs win%, PP% ranking",           q: "Which teams are most efficient?" },
    { pg: "P3", title: "Player Analytics",   desc: "Top scorers, shooting%, goalie save%",             q: "Who are the top performers?" },
    { pg: "P4", title: "Play-by-Play",       desc: "Shot heatmap, goals by period, event distribution",q: "Where & when do goals happen?" },
    { pg: "P5", title: "Home vs Away",       desc: "Win% trend, goals comparison across 6 seasons",   q: "How big is home ice advantage?" },
    { pg: "P6", title: "Dream Team",         desc: "Fantasy roster: Top 1 C/LW/RW + Top-4 D + elite Goalies (season slicer)", q: "Who makes your ultimate lineup?" },
  ];

  pages.forEach(({ pg, title, desc, q }, i) => {
    const y = 1.28 + i * 0.62;
    card(s, 0.4, y, 9.2, 0.55, C.navyMid);
    s.addShape("rect", { x: 0.4, y, w: 0.55, h: 0.55, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText(pg, { x: 0.4, y, w: 0.55, h: 0.55, fontFace: TITLE_FONT, fontSize: 13, bold: true, color: C.navy, align: "center", valign: "middle", margin: 0 });
    s.addText(title, { x: 1.1, y: y + 0.08, w: 2.3, h: 0.38, fontFace: TITLE_FONT, fontSize: 12, bold: true, color: C.white, align: "left", margin: 0 });
    s.addShape("rect", { x: 3.5, y: y + 0.08, w: 0.04, h: 0.38, fill: { color: "2A4A6A" }, line: { color: "2A4A6A" } });
    s.addText(desc, { x: 3.65, y: y + 0.08, w: 3.45, h: 0.38, fontFace: BODY_FONT, fontSize: 10, color: C.iceBlue, align: "left", valign: "middle", margin: 0 });
    s.addShape("rect", { x: 7.2, y: y + 0.08, w: 0.04, h: 0.38, fill: { color: "2A4A6A" }, line: { color: "2A4A6A" } });
    s.addText(`"${q}"`, { x: 7.32, y: y + 0.08, w: 2.2, h: 0.38, fontFace: BODY_FONT, fontSize: 9, italic: true, color: C.muted, align: "left", valign: "middle", margin: 0 });
  });

  s.addText("DirectLake + Gold Star Schema  ·  Focused DAX + measures  ·  Slicers: Season / Team / Game Type / Position", {
    x: 0.4, y: 5.28, w: 9.2, h: 0.26,
    fontFace: BODY_FONT, fontSize: 11, italic: true, color: C.muted, align: "center", margin: 0,
  });

  s.addNotes(`SPEAKER SCRIPT — SLIDE 8: POWER BI DASHBOARD

The analytics deliverable is a **six-page** Power BI dashboard connected via DirectLake to the Gold Star Schema.

Page 1 — Executive Summary: high-level KPI cards, goals trend over months, win rate by team, game outcomes (REG/OT/SO donut).

Page 2 — Team Performance: standings table with conditional format on Win%, shot% vs win% scatter, power play efficiency rankings, faceoff win %.

Page 3 — Player Analytics: top scorers bar, goals vs assists scatter, season-over-season points by position, shooting% leaderboard, goalie save % table.

Page 4 — Play-by-Play: interactive shot location heatmap (x/y on rink background), goals by period, event counts and goal distributions by secondary type (wrist, slap, etc.).

Page 5 — Home vs Away: home ice advantage quantified – home win % over seasons (dual line), gauge vs 50% baseline, matrix by team, avg goals/shots split.

**Page 6 — Dream Team formation (the standout deliverable):** A fully dynamic fantasy roster builder. A single season slicer (or What-If GP threshold) against the pre-aggregated 'gold_player_season_stats' table instantly surfaces:

- Top 1 Center, Left Wing, Right Wing (by points, filtered to >=20 GP)
- Top 4 Defensemen (or two pairing tables)
- Top Goaltenders (by Save% or lowest GAA, higher GP threshold ~25-30 for goalies)

Supporting cards calculate "Dream Team Total Star Points" (3F + top-4D) and individual name + stat callouts via TOPN DAX or visual Top-N. Context charts (top-10 centers leaderboard, position breakdown) sit alongside the roster tables.

Changing the Season dropdown completely refreshes the entire roster — perfect for "what-if" storytelling ("In 2016-17 Crosby-centered the first line...").

A focused but powerful set of DAX measures (Win%, Goals/Game, PP%, Save%, Points/Game, plus Dream Team-specific measures) plus the gold aggregates drive responsiveness. Slicers for Season, Team, Game Type (R/P), and Position allow deep filtering. DirectLake mode: the dashboard is always live against OneLake — zero scheduled refresh, zero import.
`);
}

// ─────────────────────────────────────
// SLIDE 09 — TESTING & VALIDATION
// ─────────────────────────────────────
{
  const s = pres.addSlide();
  bgSlide(s);
  sectionChip(s, "07 — TESTING");
  addTitle(s, "Testing & Validation");

  // 3 stat boxes — evenly spread
  statBox(s, "25+",  "Automated Tests", 1.2,  1.3);
  statBox(s, "100%", "Pass Rate",       4.08, 1.3);
  statBox(s, "5",    "Test Categories", 6.95, 1.3);

  const cats = [
    { cat: "Row Count",            desc: "fact_game rows ≈ 2× silver_game; counts within 5% tolerance" },
    { cat: "Null Checks",          desc: "Zero nulls on all primary keys and critical metric columns" },
    { cat: "Referential Integrity",desc: "Zero orphan rows — every FK maps to a valid dimension row" },
    { cat: "Business Logic",       desc: "won is boolean, goals ≥ 0, exactly 2 team rows per game" },
    { cat: "Range Checks",         desc: "Period 1–5, shot coordinates within NHL rink bounds, valid seasons" },
  ];

  cats.forEach(({ cat, desc }, i) => {
    const y = 2.62 + i * 0.55;
    card(s, 0.4, y, 9.2, 0.47, C.navyMid);
    s.addShape("ellipse", { x: 0.55, y: y + 0.1, w: 0.27, h: 0.27, fill: { color: "2E7D52" }, line: { color: "2E7D52" } });
    s.addText("✓", { x: 0.55, y: y + 0.1, w: 0.27, h: 0.27, fontFace: BODY_FONT, fontSize: 10, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
    s.addText(cat, { x: 0.95, y: y + 0.07, w: 2.1, h: 0.32, fontFace: TITLE_FONT, fontSize: 12, bold: true, color: C.gold, align: "left", margin: 0 });
    s.addShape("rect", { x: 3.1, y: y + 0.1, w: 0.04, h: 0.27, fill: { color: "2A4A6A" }, line: { color: "2A4A6A" } });
    s.addText(desc, { x: 3.22, y: y + 0.07, w: 6.2, h: 0.32, fontFace: BODY_FONT, fontSize: 11, color: C.iceBlue, align: "left", margin: 0 });
  });

  s.addNotes(`SPEAKER SCRIPT — SLIDE 9: TESTING & VALIDATION

Data engineering without testing isn't data engineering — it's hope-driven development.

I built a 25-test automated suite in Notebook 03. All tests pass.

Row count tests check that fact_game_performance has roughly twice as many rows as silver_game — because each game has two team entries.

Null checks confirm no primary key or critical metric is null.

Referential integrity checks that every foreign key in the fact tables maps to a valid dimension row. Zero orphan rows.

Business logic tests: is won boolean? Are goals non-negative? Are there exactly two team rows per game?

Range checks: periods between 1 and 5, shot coordinates within valid NHL rink bounds, seasons in the expected range.

This gives me confidence that everything in the Gold layer is clean and trustworthy.`);
}

// ─────────────────────────────────────
// SLIDE 10 — BUSINESS RECOMMENDATIONS
// ─────────────────────────────────────
{
  const s = pres.addSlide();
  bgSlide(s);
  sectionChip(s, "08 — RECOMMENDATIONS");
  addTitle(s, "Business Recommendations");

  const recs = [
    { n: "1", title: "Prioritise Power Play Efficiency", body: "Top-quartile PP% teams win 8–12% more games — invest in special teams training" },
    { n: "2", title: "Shot Volume is a Leading Indicator", body: "Teams with 35+ shots/game win significantly more; build shot-generating systems" },
    { n: "3", title: "Home Ice Scheduling Matters", body: "~55% home win rate makes playoff seeding — and home ice — a critical strategic goal" },
    { n: "4", title: "Win Faceoffs, Win Possession", body: "Teams at 52%+ faceoff win% control puck time and generate high-danger chances" },
    { n: "5", title: "Defend the Slot Zone", body: "70%+ of goals scored within 30ft of net — prioritise defensive coverage of the slot" },
  ];

  recs.forEach(({ n, title, body }, i) => {
    const y = 1.38 + i * 0.78;
    card(s, 0.4, y, 9.2, 0.65, C.navyMid);
    s.addShape("rect", { x: 0.4, y, w: 0.52, h: 0.65, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText(n, { x: 0.4, y, w: 0.52, h: 0.65, fontFace: TITLE_FONT, fontSize: 18, bold: true, color: C.navy, align: "center", valign: "middle", margin: 0 });
    s.addText(title, { x: 1.08, y: y + 0.07, w: 3.85, h: 0.36, fontFace: TITLE_FONT, fontSize: 13, bold: true, color: C.white, align: "left", margin: 0 });
    s.addShape("rect", { x: 5.05, y: y + 0.1, w: 0.04, h: 0.45, fill: { color: "2A4A6A" }, line: { color: "2A4A6A" } });
    s.addText(body, { x: 5.18, y: y + 0.08, w: 4.3, h: 0.48, fontFace: BODY_FONT, fontSize: 11, color: C.iceBlue, align: "left", valign: "middle", margin: 0 });
  });

  s.addNotes(`SPEAKER SCRIPT — SLIDE 10: BUSINESS RECOMMENDATIONS

Five data-driven recommendations.

One: Power play efficiency. Top-quartile PP% teams win 8 to 12% more games. Special teams training has measurable ROI.

Two: Shot volume. Teams generating 35 or more shots per game win more. Build systems that create shot opportunities.

Three: Home ice through seeding. A 55% home win rate means playoff seeding has real consequences — every regular season point matters.

Four: Faceoffs. Teams winning 52% or more of faceoffs control possession and generate more dangerous chances.

Five: Defend the slot. 70% of goals come from within 30 feet of the net. Defensive zone coverage must prioritise this area.

All five come directly from the data — turning raw CSVs into actionable insights is the whole point of this project.`);
}

// ─────────────────────────────────────
// SLIDE 11 — CHALLENGES & LEARNINGS
// ─────────────────────────────────────
{
  const s = pres.addSlide();
  bgSlide(s);
  sectionChip(s, "09 — LEARNINGS");
  addTitle(s, "Challenges & Learnings");

  const items = [
    { ch: "4M+ row play-by-play table", fix: "Filtered to key events in Gold layer; pre-aggregate before Power BI", learn: "Pre-aggregation is critical for Power BI performance at scale" },
    { ch: "Skater vs goalie stats: different schemas", fix: "Separate fact tables; null-align columns before union", learn: "Never assume two tables with similar names have compatible schemas" },
    { ch: "Missing x/y coordinates in older seasons", fix: "Filled with 0.0; filtered in shot heatmap visual layer", learn: "Data completeness varies across time — always document gaps explicitly" },
    { ch: "team_id FK ambiguity in fact table", fix: "Inactive relationships + USERELATIONSHIP() in DAX", learn: "Multi-role FK patterns need careful schema design and DAX awareness" },
  ];

  items.forEach(({ ch, fix, learn }, i) => {
    const y = 1.38 + i * 0.99;
    card(s, 0.4, y, 9.2, 0.85, C.navyMid);
    s.addShape("rect", { x: 0.4, y, w: 0.07, h: 0.85, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText("⚠️", { x: 0.5, y, w: 0.7, h: 0.85, fontSize: 18, align: "center", valign: "middle", margin: 0 });
    s.addText(ch, { x: 1.25, y: y + 0.07, w: 3.5, h: 0.3, fontFace: TITLE_FONT, fontSize: 12, bold: true, color: C.gold, align: "left", margin: 0 });
    s.addText("Fix: " + fix, { x: 1.25, y: y + 0.44, w: 3.5, h: 0.34, fontFace: BODY_FONT, fontSize: 10, color: C.iceBlue, align: "left", margin: 0 });
    s.addShape("rect", { x: 4.9, y: y + 0.12, w: 0.04, h: 0.6, fill: { color: C.teal }, line: { color: C.teal } });
    s.addText("💡 " + learn, { x: 5.05, y: y + 0.1, w: 4.45, h: 0.65, fontFace: BODY_FONT, fontSize: 11, italic: true, color: C.muted, align: "left", valign: "middle", margin: 0 });
  });

  s.addNotes(`SPEAKER SCRIPT — SLIDE 11: CHALLENGES & LEARNINGS

No project goes perfectly — here's what I ran into and what I learned.

Challenge one: the play-by-play table has over 4 million rows. Loading it directly into Power BI was too slow. Fix: pre-aggregate in Gold and filter to key events. Learning: always pre-aggregate before connecting Power BI to large event tables.

Challenge two: skater and goalie stats have incompatible schemas. Fix: separate fact tables, null-aligned before union. Learning: never assume two tables with similar names have compatible columns.

Challenge three: older seasons have missing x/y coordinates. Fix: filled with zero, filtered in the visual layer. Learning: data completeness varies — document it.

Challenge four: team_id appears twice in fact_game_performance — once for the team, once for the opponent. This creates relationship ambiguity in Power BI. Fix: inactive relationships with USERELATIONSHIP() in DAX. Learning: multi-role foreign keys need careful design upfront.

These weren't blockers. They were learning opportunities — and having automated tests meant I caught most of them before they reached the dashboard.`);
}

// ─────────────────────────────────────
// SLIDE 12 — CLOSING
// ─────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.1, fill: { color: C.gold }, line: { color: C.gold } });
  s.addShape("rect", { x: 0, y: 5.52, w: 10, h: 0.1, fill: { color: C.gold }, line: { color: C.gold } });

  // Left summary panel
  card(s, 0.4, 0.3, 4.5, 5.05, C.navyMid);
  s.addShape("rect", { x: 0.4, y: 0.3, w: 4.5, h: 0.07, fill: { color: C.gold }, line: { color: C.gold } });
  s.addText("Project Summary", {
    x: 0.55, y: 0.45, w: 4.2, h: 0.48,
    fontFace: TITLE_FONT, fontSize: 20, bold: true, color: C.gold, align: "left", margin: 0,
  });
  s.addShape("rect", { x: 0.55, y: 0.97, w: 4.1, h: 0.04, fill: { color: "2A4A6A" }, line: { color: "2A4A6A" } });

  const pts = [
    "Medallion pipeline: Bronze → Silver → Gold",
    "Single notebook: RL_Notebook_Fixed",
    "Star schema: 3 dims, 3 facts, 5 gold aggregates (KPI views)",
    "25+ automated data quality tests",
    "6-page Power BI DirectLake dashboard (5 analytics + Dream Team Page 6)",
    "5 data-driven business recommendations",
  ];
  pts.forEach((pt, i) => {
    const y = 1.12 + i * 0.63;
    s.addShape("ellipse", { x: 0.6, y: y + 0.08, w: 0.22, h: 0.22, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText("✓", { x: 0.6, y: y + 0.08, w: 0.22, h: 0.22, fontFace: BODY_FONT, fontSize: 9, bold: true, color: C.navy, align: "center", valign: "middle", margin: 0 });
    s.addText(pt, { x: 0.95, y, w: 3.8, h: 0.42, fontFace: BODY_FONT, fontSize: 12, color: C.iceBlue, align: "left", valign: "middle", margin: 0 });
  });

  // Right thank you panel — content vertically centred in right half
  s.addText("Thank You", {
    x: 5.2, y: 1.0, w: 4.5, h: 0.75,
    fontFace: TITLE_FONT, fontSize: 38, bold: true, color: C.gold, align: "center", margin: 0,
  });
  s.addText("🏒", { x: 6.55, y: 1.85, w: 1.7, h: 0.9, fontSize: 48, align: "center", margin: 0 });
  s.addShape("rect", { x: 5.4, y: 2.88, w: 4.1, h: 0.04, fill: { color: "2A4A6A" }, line: { color: "2A4A6A" } });
  s.addText("Questions & Discussion", {
    x: 5.2, y: 2.98, w: 4.5, h: 0.45,
    fontFace: TITLE_FONT, fontSize: 20, bold: true, color: C.white, align: "center", margin: 0,
  });
  s.addText("NHL Game Data · Microsoft Fabric · Power BI", {
    x: 5.2, y: 3.52, w: 4.5, h: 0.32,
    fontFace: BODY_FONT, fontSize: 12, italic: true, color: C.muted, align: "center", margin: 0,
  });
  s.addShape("rect", { x: 5.4, y: 4.02, w: 4.1, h: 0.04, fill: { color: "2A4A6A" }, line: { color: "2A4A6A" } });
  s.addText("Dataset: Kaggle — martinellis/nhl-game-data", {
    x: 5.2, y: 4.15, w: 4.5, h: 0.28,
    fontFace: BODY_FONT, fontSize: 10, color: C.muted, align: "center", margin: 0,
  });

  s.addNotes(`SPEAKER SCRIPT — SLIDE 12: CLOSING / Q&A

To close — here's what this project delivers.

A complete end-to-end data pipeline on Microsoft Fabric, Bronze to Silver to Gold in a single notebook. A star schema with 3 dimension tables, 3 fact tables, and 4 KPI views. 25 automated tests confirming data quality. A five-page Power BI dashboard answering real business questions using DirectLake mode. And five data-driven business recommendations.

Most importantly — this demonstrates the full role of a junior data engineer: understand the data, design the schema, build the pipeline, validate the output, and communicate the insights.

Thank you. I'm happy to take questions on the architecture, the pipeline, the DAX measures, or any of the findings.`);
}

// ─────────────────────────────────────
// WRITE FILE
// ─────────────────────────────────────
pres.writeFile({ fileName: "/home/user/computer/nhl-fabric-project/docs/NHL_Analytics_Presentation.pptx" })
  .then(() => console.log("✅ Saved: NHL_Analytics_Presentation.pptx"))
  .catch(e => { console.error("ERROR:", e); process.exit(1); });
