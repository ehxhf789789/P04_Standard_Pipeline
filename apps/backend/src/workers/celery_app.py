"""Celery application configuration."""

from celery import Celery

from src.config import get_settings

settings = get_settings()

celery_app = Celery(
    "bim_pipeline",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["src.workers.tasks.pipeline_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
    worker_prefetch_multiplier=1,  # One task at a time for long-running tasks
    result_expires=86400,  # Results expire after 24 hours
)

# Task routing
celery_app.conf.task_routes = {
    "src.workers.tasks.pipeline_tasks.*": {"queue": "pipeline"},
}
