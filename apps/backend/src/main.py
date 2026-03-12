"""
BIM-to-AI Pipeline Backend
FastAPI Application Entry Point
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.api.v1.router import api_router
from src.api.websocket.events import router as ws_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print(f"Starting {settings.app_name} v{settings.app_version}")
    yield
    # Shutdown
    print("Shutting down...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="""
    BIM-to-AI Pipeline API

    A production-grade API for converting BIM (IFC) files into AI-ready formats:
    - Knowledge Graphs
    - Vector Embeddings
    - Tabular Datasets
    - GNN Graph Structures

    Standards: ISO 16739-1 (IFC), ISO 7817-1 (LOIN), ISO 23386/23387 (bSDD), IDS 1.0
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.api_prefix)

# Include WebSocket router
app.include_router(ws_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version,
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "BIM-to-AI Pipeline API",
        "docs": "/docs",
        "health": "/health",
    }
