"""WebSocket connection manager for real-time pipeline updates."""

from typing import Dict, Set
from uuid import UUID
import json

from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections for pipeline progress updates."""

    def __init__(self):
        # project_id -> set of connected websockets
        self.active_connections: Dict[UUID, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: UUID):
        """Accept a new WebSocket connection."""
        await websocket.accept()

        if project_id not in self.active_connections:
            self.active_connections[project_id] = set()

        self.active_connections[project_id].add(websocket)

        # Send initial connected event
        await self.send_personal_message(
            websocket,
            {"event": "connected", "data": {"project_id": str(project_id)}},
        )

    def disconnect(self, websocket: WebSocket, project_id: UUID):
        """Remove a WebSocket connection."""
        if project_id in self.active_connections:
            self.active_connections[project_id].discard(websocket)

            if not self.active_connections[project_id]:
                del self.active_connections[project_id]

    async def send_personal_message(self, websocket: WebSocket, message: dict):
        """Send a message to a specific connection."""
        await websocket.send_json(message)

    async def broadcast_to_project(self, project_id: UUID, message: dict):
        """Broadcast a message to all connections for a project."""
        if project_id not in self.active_connections:
            return

        disconnected = set()

        for connection in self.active_connections[project_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)

        # Clean up disconnected connections
        for conn in disconnected:
            self.active_connections[project_id].discard(conn)


class PipelineEvent:
    """Pipeline WebSocket event types."""

    # Connection
    CONNECTED = "connected"

    # Pipeline lifecycle
    PIPELINE_STARTED = "pipeline:started"
    PIPELINE_COMPLETED = "pipeline:completed"
    PIPELINE_FAILED = "pipeline:failed"
    PIPELINE_CANCELLED = "pipeline:cancelled"

    # Stage progress
    STAGE_STARTED = "stage:started"
    STAGE_PROGRESS = "stage:progress"
    STAGE_COMPLETED = "stage:completed"
    STAGE_FAILED = "stage:failed"

    # Detailed progress
    ELEMENT_PROCESSED = "element:processed"

    # Results streaming
    RESULT_CHUNK = "result:chunk"


def create_event(event_type: str, data: dict) -> dict:
    """Create a WebSocket event message."""
    from datetime import datetime

    return {
        "event": event_type,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "data": data,
    }
