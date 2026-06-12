# Scheduler & Automation

## Scheduled Jobs

| Job ID | Interval | Description |
|---|---|---|
| `portfolio_snapshot` | Every 5 min | Persists portfolio state to PostgreSQL |
| `metrics_sync` | Every 30 sec | Syncs Prometheus metrics from engine state |
| `health_check` | Every 1 min | Verifies DB/Redis connectivity, checks for stale data |
| `rebalance_check` | Configurable | Alerts when a single position exceeds 40% of equity |

## Enabling

The scheduler runs automatically when the API server starts. Rebalancing
requires `SCHEDULER_ENABLED=true` in `.env`.

## Adding a Job

```python
from apscheduler.triggers.cron import CronTrigger

def my_custom_job():
    pass

scheduler.add_job(
    my_custom_job,
    CronTrigger(hour="9-16", minute="*/30", day_of_week="mon-fri"),
    id="my_job",
    replace_existing=True,
)
```