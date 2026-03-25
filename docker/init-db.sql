-- =====================================================
-- BIM-to-AI Pipeline Database Initialization
-- PostgreSQL 16+ Schema
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS documents;
CREATE SCHEMA IF NOT EXISTS pipeline;
CREATE SCHEMA IF NOT EXISTS standards;
CREATE SCHEMA IF NOT EXISTS ai_outputs;
CREATE SCHEMA IF NOT EXISTS audit;

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- CDE Workflow States (ISO 19650)
CREATE TYPE documents.cde_state AS ENUM (
    'wip',       -- Work in Progress
    'shared',    -- Under Review
    'published', -- Approved (triggers AI pipeline)
    'archived'   -- Superseded
);

-- File Types
CREATE TYPE documents.file_type AS ENUM (
    'ifc', 'ifcxml', 'ifcjson',           -- BIM
    'pdf', 'docx', 'xlsx', 'pptx',        -- Office
    'hwpx', 'hwp',                         -- Korean
    'dwg', 'dxf', 'rvt',                  -- CAD
    'jpg', 'png', 'tiff',                 -- Images
    'csv', 'json', 'xml', 'ids',          -- Data
    'bcf', 'bcfzip'                        -- BCF
);

-- Lifecycle Phases
CREATE TYPE core.lifecycle_phase AS ENUM (
    'planning',
    'design',
    'procurement',
    'construction',
    'handover',
    'operation',
    'decommission'
);

-- Organization Roles (ISO 19650)
CREATE TYPE core.org_role AS ENUM (
    'appointing_party',
    'lead_appointed_party',
    'appointed_party',
    'task_team'
);

-- User Roles
CREATE TYPE core.user_role AS ENUM (
    'admin',
    'project_manager',
    'bim_manager',
    'engineer',
    'reviewer',
    'viewer'
);

-- Pipeline Stage Names
CREATE TYPE pipeline.stage_name AS ENUM (
    'ingest', 'parse', 'validate', 'enrich', 'transform', 'package'
);

-- Pipeline Run Status
CREATE TYPE pipeline.run_status AS ENUM (
    'pending', 'queued', 'running', 'completed', 'failed', 'cancelled'
);

-- Validation Facets (IDS 1.0)
CREATE TYPE standards.ids_facet AS ENUM (
    'entity', 'attribute', 'property', 'material', 'classification', 'part_of'
);

-- =====================================================
-- CORE SCHEMA - Organizations, Users, Projects
-- =====================================================

CREATE TABLE core.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    role core.org_role NOT NULL DEFAULT 'appointed_party',
    parent_org_id UUID REFERENCES core.organizations(id),

    -- Contact
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- Profile
    full_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),

    -- Organization & Role
    organization_id UUID REFERENCES core.organizations(id),
    role core.user_role NOT NULL DEFAULT 'viewer',

    -- Authentication
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE core.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic Info
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,

    -- Location
    country VARCHAR(100),
    city VARCHAR(100),
    address TEXT,

    -- Lifecycle
    lifecycle_phase core.lifecycle_phase NOT NULL DEFAULT 'design',

    -- Organization
    owner_org_id UUID REFERENCES core.organizations(id),
    lead_org_id UUID REFERENCES core.organizations(id),
    created_by UUID REFERENCES core.users(id),

    -- ISO 19650 Information Requirements
    oir_id UUID,  -- Organization Information Requirements
    pir_id UUID,  -- Project Information Requirements
    air_id UUID,  -- Asset Information Requirements

    -- Configuration
    settings JSONB DEFAULT '{}',

    -- Dates
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE
);

-- Project Members
CREATE TABLE core.project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES core.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES core.organizations(id),

    role core.user_role NOT NULL DEFAULT 'viewer',
    permissions JSONB DEFAULT '{}',

    joined_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, user_id)
);

-- =====================================================
-- DOCUMENTS SCHEMA - Files, Versions, CDE
-- =====================================================

CREATE TABLE documents.files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,

    -- File Info
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    file_type documents.file_type NOT NULL,
    mime_type VARCHAR(100),
    file_size BIGINT NOT NULL,

    -- Storage
    storage_path VARCHAR(1000) NOT NULL,
    storage_bucket VARCHAR(100) DEFAULT 'files',
    checksum VARCHAR(64) NOT NULL,  -- SHA-256

    -- CDE Workflow (ISO 19650)
    cde_state documents.cde_state DEFAULT 'wip',
    revision VARCHAR(10) DEFAULT 'P01',
    version INTEGER DEFAULT 1,

    -- ISO 19650 Naming Convention
    -- Project-Originator-Volume-Level-Type-Role-Number
    naming_project VARCHAR(50),
    naming_originator VARCHAR(10),
    naming_volume VARCHAR(10),
    naming_level VARCHAR(10),
    naming_type VARCHAR(10),
    naming_role VARCHAR(10),
    naming_number VARCHAR(20),

    -- Suitability (ISO 19650)
    suitability_code VARCHAR(10),  -- S0, S1, S2, S3, S4
    suitability_description TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    extracted_text TEXT,

    -- User tracking
    uploaded_by UUID REFERENCES core.users(id),
    approved_by UUID REFERENCES core.users(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ
);

-- File Versions
CREATE TABLE documents.file_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES documents.files(id) ON DELETE CASCADE,

    version INTEGER NOT NULL,
    revision VARCHAR(10),

    storage_path VARCHAR(1000) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    file_size BIGINT NOT NULL,

    change_description TEXT,
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(file_id, version)
);

-- CDE Workflow History
CREATE TABLE documents.cde_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES documents.files(id) ON DELETE CASCADE,

    from_state documents.cde_state,
    to_state documents.cde_state NOT NULL,

    comment TEXT,
    transitioned_by UUID REFERENCES core.users(id),
    transitioned_at TIMESTAMPTZ DEFAULT NOW()
);

-- File Links (relationships between files)
CREATE TABLE documents.file_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_file_id UUID REFERENCES documents.files(id) ON DELETE CASCADE,
    target_file_id UUID REFERENCES documents.files(id) ON DELETE CASCADE,

    link_type VARCHAR(50) NOT NULL,  -- 'references', 'supersedes', 'derived_from'
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source_file_id, target_file_id, link_type)
);

-- =====================================================
-- STANDARDS SCHEMA - LOIN, IDS, bSDD
-- =====================================================

-- Exchange Information Requirements (EIR)
CREATE TABLE standards.eir (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(20),

    -- Purpose & Milestones
    purposes JSONB,  -- Array of purpose codes
    milestones JSONB,  -- Array of milestone definitions

    -- Content
    content JSONB NOT NULL,

    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LOIN Requirements (ISO 7817)
CREATE TABLE standards.loin_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    eir_id UUID REFERENCES standards.eir(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Applicability
    lifecycle_phase core.lifecycle_phase,
    purpose_code VARCHAR(50),
    milestone VARCHAR(100),

    -- Applicable IFC Classes
    ifc_classes TEXT[],  -- Array of IFC class names

    -- Level of Geometry (LoG)
    geometry_detail VARCHAR(50),  -- None, Low, Medium, High
    geometry_dimensionality VARCHAR(20),  -- 2D, 3D
    geometry_location BOOLEAN DEFAULT FALSE,
    geometry_appearance BOOLEAN DEFAULT FALSE,
    geometry_parametric BOOLEAN DEFAULT FALSE,

    -- Level of Information (LoI)
    information_requirements JSONB,  -- Property requirements

    -- Documentation Requirements
    documentation_requirements JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- IDS Rulesets
CREATE TABLE standards.ids_rulesets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loin_requirement_id UUID REFERENCES standards.loin_requirements(id),
    project_id UUID REFERENCES core.projects(id),

    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(20),

    -- IDS XML Content
    ids_xml TEXT NOT NULL,

    -- Parsed rules for quick access
    specifications JSONB NOT NULL,

    -- Validation settings
    is_active BOOLEAN DEFAULT TRUE,
    fail_on_warning BOOLEAN DEFAULT FALSE,

    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- bSDD Mappings Cache
CREATE TABLE standards.bsdd_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Source (IFC)
    ifc_class VARCHAR(100) NOT NULL,
    ifc_property_set VARCHAR(255),
    ifc_property_name VARCHAR(255),

    -- bSDD Target
    bsdd_domain_uri VARCHAR(500),
    bsdd_domain_name VARCHAR(255),
    bsdd_class_uri VARCHAR(500),
    bsdd_class_name VARCHAR(255),
    bsdd_property_uri VARCHAR(500),
    bsdd_property_name VARCHAR(255),

    -- Cross-classification
    uniclass_code VARCHAR(50),
    uniclass_name VARCHAR(255),
    omniclass_code VARCHAR(50),
    omniclass_name VARCHAR(255),

    -- Metadata
    confidence_score DECIMAL(3,2),  -- 0.00 to 1.00
    is_verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(ifc_class, ifc_property_set, ifc_property_name)
);

-- =====================================================
-- PIPELINE SCHEMA - Execution & Results
-- =====================================================

CREATE TABLE pipeline.runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
    file_id UUID REFERENCES documents.files(id) ON DELETE SET NULL,

    -- Status
    status pipeline.run_status DEFAULT 'pending',
    current_stage pipeline.stage_name,
    progress INTEGER DEFAULT 0,  -- 0-100

    -- Timing
    queued_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Configuration
    config JSONB DEFAULT '{}',
    ids_ruleset_id UUID REFERENCES standards.ids_rulesets(id),

    -- Trigger info
    triggered_by VARCHAR(50),  -- 'manual', 'cde_publish', 'schedule', 'api'
    triggered_by_user UUID REFERENCES core.users(id),

    -- Results summary
    total_elements INTEGER,
    processed_elements INTEGER,
    passed_elements INTEGER,
    failed_elements INTEGER,
    warnings_count INTEGER,

    -- Error handling
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pipeline.stage_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES pipeline.runs(id) ON DELETE CASCADE,
    stage pipeline.stage_name NOT NULL,

    status pipeline.run_status NOT NULL,
    progress INTEGER DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Input/Output
    input_summary JSONB,
    output_summary JSONB,
    output_location VARCHAR(1000),  -- Storage path for full output

    -- Metrics
    metrics JSONB DEFAULT '{}',

    -- Errors
    error_message TEXT,
    error_details JSONB,
    warnings JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Validation Results (detailed)
CREATE TABLE pipeline.validation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_result_id UUID REFERENCES pipeline.stage_results(id) ON DELETE CASCADE,
    ids_ruleset_id UUID REFERENCES standards.ids_rulesets(id),

    -- Summary
    total_specifications INTEGER,
    passed_specifications INTEGER,
    failed_specifications INTEGER,

    total_elements INTEGER,
    passed_elements INTEGER,
    failed_elements INTEGER,

    pass_rate DECIMAL(5,2),

    -- Detailed results (stored separately for large files)
    results_location VARCHAR(1000),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Element-level validation results
CREATE TABLE pipeline.element_validations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    validation_result_id UUID REFERENCES pipeline.validation_results(id) ON DELETE CASCADE,

    -- Element identification
    element_guid VARCHAR(36) NOT NULL,
    element_name VARCHAR(255),
    ifc_class VARCHAR(100) NOT NULL,

    -- Overall result
    passed BOOLEAN NOT NULL,

    -- Facet results
    facet_results JSONB NOT NULL,
    /*
    {
        "entity": {"passed": true},
        "property": {"passed": false, "missing": ["Pset_WallCommon.LoadBearing"]},
        "classification": {"passed": true},
        "material": {"passed": true},
        "attribute": {"passed": true},
        "part_of": {"passed": true}
    }
    */

    -- For BCF issue generation
    needs_bcf_issue BOOLEAN DEFAULT FALSE,
    bcf_issue_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AI_OUTPUTS SCHEMA - Generated AI-Ready Data
-- =====================================================

CREATE TABLE ai_outputs.knowledge_graphs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES pipeline.runs(id) ON DELETE CASCADE,

    -- Graph info
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Statistics
    node_count INTEGER,
    edge_count INTEGER,
    node_types JSONB,  -- {"IfcWall": 150, "IfcSlab": 45, ...}
    edge_types JSONB,  -- {"CONTAINS": 500, "CONNECTED_TO": 200, ...}

    -- Storage
    neo4j_database VARCHAR(100),
    rdf_file_path VARCHAR(1000),
    json_file_path VARCHAR(1000),

    -- Metadata
    ontologies_used TEXT[],  -- ['ifcOWL', 'BOT', 'bSDD']

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_outputs.embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES pipeline.runs(id) ON DELETE CASCADE,

    -- Model info
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    embedding_dimension INTEGER NOT NULL,

    -- Data info
    total_vectors INTEGER,
    source_type VARCHAR(50),  -- 'element', 'property', 'document'

    -- Storage
    qdrant_collection VARCHAR(255),
    numpy_file_path VARCHAR(1000),

    -- 2D Projection for visualization
    projection_method VARCHAR(50),  -- 'pca', 'tsne', 'umap'
    projections_file_path VARCHAR(1000),

    -- Statistics
    statistics JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_outputs.tabular_datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES pipeline.runs(id) ON DELETE CASCADE,

    -- Dataset info
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Schema
    row_count INTEGER,
    column_count INTEGER,
    columns JSONB,  -- [{name, dtype, nullable, description}, ...]

    -- Storage
    parquet_file_path VARCHAR(1000),
    csv_file_path VARCHAR(1000),

    -- Statistics
    statistics JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_outputs.gnn_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES pipeline.runs(id) ON DELETE CASCADE,

    -- Graph info
    name VARCHAR(255) NOT NULL,
    graph_type VARCHAR(50),  -- 'homogeneous', 'heterogeneous'

    -- Structure
    node_count INTEGER,
    edge_count INTEGER,
    node_feature_dim INTEGER,
    edge_feature_dim INTEGER,

    node_types JSONB,
    edge_types JSONB,

    -- Storage
    pytorch_file_path VARCHAR(1000),  -- .pt
    dgl_file_path VARCHAR(1000),

    -- Training-ready splits
    has_train_val_test_split BOOLEAN DEFAULT FALSE,
    split_ratios JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AUDIT SCHEMA - Logging & History
-- =====================================================

CREATE TABLE audit.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Actor
    user_id UUID REFERENCES core.users(id),
    user_email VARCHAR(255),
    ip_address INET,
    user_agent TEXT,

    -- Action
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,

    -- Details
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit.api_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Request info
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    query_params JSONB,

    -- Actor
    user_id UUID,
    api_key_id UUID,
    ip_address INET,
    user_agent TEXT,

    -- Response
    status_code INTEGER,
    response_time_ms INTEGER,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Core indexes
CREATE INDEX idx_users_email ON core.users(email);
CREATE INDEX idx_users_org ON core.users(organization_id);
CREATE INDEX idx_projects_owner ON core.projects(owner_org_id);
CREATE INDEX idx_projects_phase ON core.projects(lifecycle_phase);
CREATE INDEX idx_project_members_project ON core.project_members(project_id);
CREATE INDEX idx_project_members_user ON core.project_members(user_id);

-- Documents indexes
CREATE INDEX idx_files_project ON documents.files(project_id);
CREATE INDEX idx_files_cde_state ON documents.files(cde_state);
CREATE INDEX idx_files_type ON documents.files(file_type);
CREATE INDEX idx_files_uploaded_by ON documents.files(uploaded_by);
CREATE INDEX idx_files_created_at ON documents.files(created_at DESC);
CREATE INDEX idx_file_versions_file ON documents.file_versions(file_id);
CREATE INDEX idx_cde_transitions_file ON documents.cde_transitions(file_id);

-- Pipeline indexes
CREATE INDEX idx_pipeline_runs_project ON pipeline.runs(project_id);
CREATE INDEX idx_pipeline_runs_file ON pipeline.runs(file_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline.runs(status);
CREATE INDEX idx_pipeline_runs_created ON pipeline.runs(created_at DESC);
CREATE INDEX idx_stage_results_run ON pipeline.stage_results(run_id);
CREATE INDEX idx_element_validations_result ON pipeline.element_validations(validation_result_id);
CREATE INDEX idx_element_validations_guid ON pipeline.element_validations(element_guid);

-- Standards indexes
CREATE INDEX idx_loin_requirements_eir ON standards.loin_requirements(eir_id);
CREATE INDEX idx_ids_rulesets_project ON standards.ids_rulesets(project_id);
CREATE INDEX idx_bsdd_mappings_class ON standards.bsdd_mappings(ifc_class);

-- AI outputs indexes
CREATE INDEX idx_knowledge_graphs_run ON ai_outputs.knowledge_graphs(run_id);
CREATE INDEX idx_embeddings_run ON ai_outputs.embeddings(run_id);
CREATE INDEX idx_tabular_datasets_run ON ai_outputs.tabular_datasets(run_id);
CREATE INDEX idx_gnn_structures_run ON ai_outputs.gnn_structures(run_id);

-- Audit indexes
CREATE INDEX idx_activity_log_user ON audit.activity_log(user_id);
CREATE INDEX idx_activity_log_resource ON audit.activity_log(resource_type, resource_id);
CREATE INDEX idx_activity_log_created ON audit.activity_log(created_at DESC);
CREATE INDEX idx_api_requests_created ON audit.api_requests(created_at DESC);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-trigger pipeline on CDE publish
CREATE OR REPLACE FUNCTION documents.trigger_pipeline_on_publish()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cde_state = 'published' AND (OLD.cde_state IS NULL OR OLD.cde_state != 'published') THEN
        -- Create pipeline run
        INSERT INTO pipeline.runs (project_id, file_id, triggered_by, status, queued_at)
        VALUES (NEW.project_id, NEW.id, 'cde_publish', 'queued', NOW());

        -- Update published timestamp
        NEW.published_at = NOW();

        -- Log the transition
        INSERT INTO documents.cde_transitions (file_id, from_state, to_state)
        VALUES (NEW.id, OLD.cde_state, NEW.cde_state);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Updated_at triggers
CREATE TRIGGER update_organizations_timestamp
    BEFORE UPDATE ON core.organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON core.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_projects_timestamp
    BEFORE UPDATE ON core.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_files_timestamp
    BEFORE UPDATE ON documents.files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_loin_requirements_timestamp
    BEFORE UPDATE ON standards.loin_requirements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ids_rulesets_timestamp
    BEFORE UPDATE ON standards.ids_rulesets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bsdd_mappings_timestamp
    BEFORE UPDATE ON standards.bsdd_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- CDE publish trigger
CREATE TRIGGER on_file_cde_publish
    BEFORE UPDATE ON documents.files
    FOR EACH ROW
    EXECUTE FUNCTION documents.trigger_pipeline_on_publish();

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Default organization
INSERT INTO core.organizations (id, name, code, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Organization',
    'DEFAULT',
    'lead_appointed_party'
);

-- Admin user (password: admin123 - change in production!)
INSERT INTO core.users (id, email, password_hash, full_name, organization_id, role, is_verified)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@example.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYGrTFhFx/Oe', -- bcrypt hash of 'admin123'
    'System Administrator',
    '00000000-0000-0000-0000-000000000001',
    'admin',
    TRUE
);

-- =====================================================
-- GRANTS (for application user)
-- =====================================================

-- Create application role if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH LOGIN PASSWORD 'change_me_in_production';
    END IF;
END $$;

-- Grant permissions
GRANT USAGE ON SCHEMA core, documents, pipeline, standards, ai_outputs, audit TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core, documents, pipeline, standards, ai_outputs, audit TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA core, documents, pipeline, standards, ai_outputs, audit TO app_user;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA core, documents, pipeline, standards, ai_outputs, audit
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, documents, pipeline, standards, ai_outputs, audit
    GRANT USAGE ON SEQUENCES TO app_user;
