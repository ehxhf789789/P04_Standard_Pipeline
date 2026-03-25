"""API v1 Router - Aggregates all endpoint routers."""

from fastapi import APIRouter

from src.api.v1.endpoints import projects, pipeline, validation, enrichment, outputs, files, auth, query

api_router = APIRouter()

# Auth endpoints (no prefix)
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Include all endpoint routers
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(files.router, prefix="/projects/{project_id}/files", tags=["Files"])
api_router.include_router(pipeline.router, prefix="/projects/{project_id}/pipeline", tags=["Pipeline"])
api_router.include_router(validation.router, prefix="/projects/{project_id}/validation", tags=["Validation"])
api_router.include_router(enrichment.router, prefix="/projects/{project_id}/enrichment", tags=["Enrichment"])
api_router.include_router(outputs.router, prefix="/projects/{project_id}/outputs", tags=["Outputs"])
api_router.include_router(query.router, prefix="/query", tags=["Query & Search"])
