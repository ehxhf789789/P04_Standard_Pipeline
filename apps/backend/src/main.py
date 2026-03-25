"""
BIM-to-AI Pipeline Backend
FastAPI Application Entry Point

A production-grade API for:
- Processing BIM (IFC) files and construction documents
- Validating against IDS 1.0 and LOIN requirements
- Enriching with bSDD standardized properties
- Generating AI-ready outputs (KG, Embeddings, Tabular, GNN)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from src.config import get_settings
from src.api.v1.router import api_router
from src.api.websocket.events import router as ws_router
from src.db.session import init_db, close_db

settings = get_settings()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")

    # Initialize database
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.warning(f"Database initialization skipped: {e}")

    yield

    # Shutdown
    logger.info("Shutting down...")
    await close_db()


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

# GZip middleware for response compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
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
        "message": "BIM-Vortex API",
        "docs": "/docs",
        "health": "/health",
    }


@app.post("/admin/shutdown")
async def shutdown_server():
    """Shutdown the server (for demo use)."""
    import os
    import signal
    import threading

    def _shutdown():
        import time
        time.sleep(1)
        os.kill(os.getpid(), signal.SIGTERM)

    threading.Thread(target=_shutdown, daemon=True).start()
    return {"message": "Server shutting down in 1 second..."}
