#!/bin/bash
# Fetch all Thirstday@DB match data from DartsLive API via Vite proxy
# This script extracts per-game results (which G1-G9 games were won/lost)
# and which players played each game.

BASE="http://localhost:5175/api/dartslive"
LI="c3cb721a68a2d84e"
DI="c764de3490fc6ea0"

echo '[' > /tmp/thirstday_matches.json
first=true

# Get schedule
curl -sL "$BASE/sg/allSchedule?li=$LI&di=$DI" -H "Accept: application/json" -H "X-Requested-With: XMLHttpRequest" 2>/dev/null | \
python3 -c "
import json, sys
data = json.load(sys.stdin)
matches = []
for week in data.get('scheduleList', []):
    for m in week.get('matchList', []):
        if m.get('status') == '2':  # completed
            matches.append({'date': week['matchDate'], 'matchNo': m['matchNo']})
print(json.dumps(matches))
" > /tmp/all_matches.json

# For each match, check if it's Thirstday's and get game details
python3 << 'PYEOF'
import json, subprocess, sys

with open('/tmp/all_matches.json') as f:
    all_matches = json.load(f)

BASE = "http://localhost:5175/api/dartslive"
LI = "c3cb721a68a2d84e"
DI = "c764de3490fc6ea0"
results = []

for m in all_matches:
    url = f"{BASE}/game/api?mn={m['matchNo']}&li={LI}&di={DI}"
    try:
        raw = subprocess.check_output(['curl', '-sL', url,
            '-H', 'Accept: application/json',
            '-H', 'X-Requested-With: XMLHttpRequest'], timeout=15)
        data = json.loads(raw)

        ht = data.get('homeTeamInfo', {}).get('teamName', '')
        at = data.get('awayTeamInfo', {}).get('teamName', '')

        # Check if Thirstday is involved
        is_thirstday = 'Thirstday' in ht or 'BEATTY' in ht or 'Thirstday' in at or 'BEATTY' in at
        if not is_thirstday:
            continue

        is_home = 'Thirstday' in ht or 'BEATTY' in ht

        # Extract per-game results
        game_results = []
        for g in data.get('gameResultInfoList', []):
            game_name = g.get('gameName', '')
            game_details = g.get('gameResultDetailInfoList', [])

            home_legs_won = 0
            away_legs_won = 0
            home_players = []
            away_players = []

            for d in game_details:
                hi = d.get('homeTeamLegInfo', {})
                ai = d.get('awayTeamLegInfo', {})

                hp = [p.get('playerName','') for p in hi.get('legInfoList',[]) if p.get('playerName')]
                ap = [p.get('playerName','') for p in ai.get('legInfoList',[]) if p.get('playerName')]
                if hp: home_players = hp
                if ap: away_players = ap

                if hi.get('legResult') == 'WIN': home_legs_won += 1
                if ai.get('legResult') == 'WIN': away_legs_won += 1

            # Determine winner
            home_won = home_legs_won > away_legs_won
            thirstday_won = home_won if is_home else not home_won

            game_results.append({
                'gameId': len(game_results) + 1,
                'gameName': game_name,
                'homeLegs': home_legs_won,
                'awayLegs': away_legs_won,
                'homePlayers': home_players,
                'awayPlayers': away_players,
                'thirstdayWon': thirstday_won,
            })

        results.append({
            'matchNo': m['matchNo'],
            'date': m['date'],
            'homeTeam': ht,
            'awayTeam': at,
            'isThirstdayHome': is_home,
            'homeScore': data.get('homeTeamInfo', {}).get('point', 0),
            'awayScore': data.get('awayTeamInfo', {}).get('point', 0),
            'homeBonus': data.get('homeTeamInfo', {}).get('bonusPoint', 0),
            'awayBonus': data.get('awayTeamInfo', {}).get('bonusPoint', 0),
            'games': game_results,
        })
        print(f"Fetched: {m['date']} {ht} vs {at}", file=sys.stderr)
    except Exception as e:
        print(f"Failed {m['matchNo']}: {e}", file=sys.stderr)

with open('/tmp/thirstday_matches.json', 'w') as f:
    json.dump(results, f, indent=2)

print(f"\nSaved {len(results)} matches", file=sys.stderr)
PYEOF

# Copy to project
cp /tmp/thirstday_matches.json /home/user/computer/thirstdayatdb/src/data/dartslive-matches.json 2>/dev/null || \
  mkdir -p /home/user/computer/thirstdayatdb/src/data && \
  cp /tmp/thirstday_matches.json /home/user/computer/thirstdayatdb/src/data/dartslive-matches.json

echo "Done"