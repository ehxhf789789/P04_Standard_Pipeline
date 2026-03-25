# BIM-Vortex | AI Standards Pipeline

건설 전생애주기 문서를 국제 표준에 기반하여 검증하고, AI-ready 데이터로 변환하여 AI Data Lake로 통합 관리하는 플랫폼입니다.

Transform construction lifecycle documents based on international standards and manage as AI-ready data in a unified AI Data Lake.

## Quick Start

### Requirements
- **Python 3.11+** ([download](https://www.python.org/downloads/))
- **Node.js 20+** ([download](https://nodejs.org/))
- **Git** ([download](https://git-scm.com/))

### Installation & Run

```bash
# 1. Clone
git clone https://github.com/ehxhf789789/P04_Standard_Pipeline.git
cd P04_Standard_Pipeline

# 2. Install (Windows)
install.bat

# 3. Run
start.bat
```

Browser opens automatically at **http://localhost:3000**

**Demo Login:** `demo@bim-vortex.com` / `demo1234`

## Features

### Construction Lifecycle Management
- **Design Phase** (ISO 19650-2) — BIM models, design drawings, specifications
- **Construction Phase** (ISO 19650-3) — As-built BIM, progress reports, checklists
- **O&M Phase** (ISO 55000) — Inspection reports, repair history, energy data

### Document Processing
- **Supported Formats:** IFC, PDF, DOCX, XLSX, PPTX, HWPX
- **Auto-parsing** on upload — text, tables, metadata, keywords extraction
- **Auto-classification** — 11 document types (design drawing, BIM model, BOQ, etc.)
- **Domain validation** — checks if document is construction/BIM related

### Standards-Based Validation
- **21 international standards** (ISO 19650, IFC, IDS, LOIN, bSDD, BCF, COBie, etc.)
- **NG/OK detection** with per-item compliance reporting
- **Auto-fix** for metadata-level issues
- **IDS 1.0 6-facet validation** (Entity, Attribute, Property, Material, Classification, PartOf)

### AI Data Lake
- **Vector Embeddings** — keyword-based semantic projection
- **Knowledge Graph** — interactive force-directed graph (document-keyword-bSDD)
- **Tabular Datasets** — extracted tables with filter/sort/export
- **GNN Structures** — adjacency matrix visualization

### Document Viewers
- **PDF** — native browser viewer
- **HWPX** — JSZip-based Korean document renderer
- **DOCX** — JSZip XML parser with heading/table/formatting
- **XLSX** — xlsx library with sheet tabs, cell selection, Ctrl+C
- **PPTX** — slide renderer with text positioning
- **IFC** — schema analysis + 3D visualization

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11, SQLite |
| Viewers | JSZip, xlsx, Three.js, web-ifc |
| Auth | JWT (python-jose) |
| Storage | Local filesystem (JSON persistence) |

## Standards Applied (21)

ISO 19650 · IFC 4.3 · IDS 1.0 · LOIN (ISO 7817) · bSDD (ISO 23386/23387) · BCF 3.0 · COBie · ISO 12006-2 · ISO 21597 (ICDD) · ISO 29481 (IDM) · ISO 19115/19139 · CityGML/CityJSON · ISO 19107/19111 · ISO 55000 · EN 15978/ISO 14040 · ISO 16757 · ISO 23247 · KS F Series · ISO 32000 (PDF) · ISO/IEC 29500 (OOXML)

## Project Structure

```
BIM-Vortex/
├── apps/
│   ├── backend/          # FastAPI backend
│   │   ├── src/
│   │   │   ├── api/      # REST API endpoints
│   │   │   ├── services/ # Document processing
│   │   │   └── pipeline/ # Standards validators
│   │   └── uploads/      # File storage
│   └── frontend/         # Next.js frontend
│       └── src/
│           ├── app/      # Pages
│           ├── components/# UI components + viewers
│           └── lib/      # API clients
├── install.bat           # One-click installer
├── start.bat             # One-click launcher
└── stop.bat              # Server stopper
```

## License

KICT (Korea Institute of Civil Engineering and Building Technology)

© 2026 KICT. BIM-Vortex AI Standards Pipeline Platform.
