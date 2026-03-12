"""WebSocket event handlers."""

from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.api.websocket.manager import ConnectionManager, PipelineEvent, create_event

router = APIRouter()

# Global connection manager instance
manager = ConnectionManager()


@router.websocket("/ws/pipeline/{project_id}")
async def pipeline_websocket(websocket: WebSocket, project_id: UUID):
    """
    WebSocket endpoint for real-time pipeline updates.

    Events sent from server to client:
    - connected: Initial connection confirmation
    - pipeline:started: Pipeline execution started
    - stage:started: A stage has started
    - stage:progress: Progress update within a stage
    - stage:completed: A stage has completed
    - pipeline:completed: All stages completed successfully
    - pipeline:failed: Pipeline failed with error

    Events received from client:
    - cancel: Cancel the current pipeline run
    """
    await manager.connect(websocket, project_id)

    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_json()

            event = data.get("event")

            if event == "cancel":
                # Handle cancel request
                await manager.send_personal_message(
                    websocket,
                    create_event(
                        PipelineEvent.PIPELINE_CANCELLED,
                        {"message": "Pipeline cancellation requested"},
                    ),
                )
            elif event == "ping":
                # Health check
                await manager.send_personal_message(
                    websocket, {"event": "pong", "data": {}}
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)


async def notify_pipeline_started(project_id: UUID, run_id: UUID):
    """Notify all connected clients that pipeline has started."""
    await manager.broadcast_to_project(
        project_id,
        create_event(
            PipelineEvent.PIPELINE_STARTED,
            {"run_id": str(run_id), "message": "Pipeline execution started"},
        ),
    )


async def notify_stage_started(project_id: UUID, stage: str, total_steps: int):
    """Notify all connected clients that a stage has started."""
    await manager.broadcast_to_project(
        project_id,
        create_event(
            PipelineEvent.STAGE_STARTED,
            {"stage": stage, "total_steps": total_steps, "status": "running"},
        ),
    )


async def notify_stage_progress(
    project_id: UUID, stage: str, step: int, total_steps: int, message: str
):
    """Notify all connected clients of stage progress."""
    progress_percent = int((step / total_steps) * 100) if total_steps > 0 else 0

    await manager.broadcast_to_project(
        project_id,
        create_event(
            PipelineEvent.STAGE_PROGRESS,
            {
                "stage": stage,
                "step": step,
                "total_steps": total_steps,
                "progress_percent": progress_percent,
                "message": message,
            },
        ),
    )


async def notify_stage_completed(
    project_id: UUID, stage: str, duration_ms: int, summary: dict
):
    """Notify all connected clients that a stage has completed."""
    await manager.broadcast_to_project(
        project_id,
        create_event(
            PipelineEvent.STAGE_COMPLETED,
            {
                "stage": stage,
                "status": "completed",
                "duration_ms": duration_ms,
                "summary": summary,
            },
        ),
    )


async def notify_pipeline_completed(project_id: UUID, run_id: UUID, summary: dict):
    """Notify all connected clients that pipeline has completed."""
    await manager.broadcast_to_project(
        project_id,
        create_event(
            PipelineEvent.PIPELINE_COMPLETED,
            {
                "run_id": str(run_id),
                "status": "completed",
                "summary": summary,
            },
        ),
    )


async def notify_pipeline_failed(project_id: UUID, run_id: UUID, error: str):
    """Notify all connected clients that pipeline has failed."""
    await manager.broadcast_to_project(
        project_id,
        create_event(
            PipelineEvent.PIPELINE_FAILED,
            {
                "run_id": str(run_id),
                "status": "failed",
                "error": error,
            },
        ),
    )
