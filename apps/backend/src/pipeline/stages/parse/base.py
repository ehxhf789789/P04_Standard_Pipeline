"""
Base Document Parser

Abstract base class for all document parsers.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime
from enum import Enum
import hashlib


class DocumentType(Enum):
    """Supported document types"""
    IFC = "ifc"
    PDF = "pdf"
    DOCX = "docx"
    XLSX = "xlsx"
    PPTX = "pptx"
    HWPX = "hwpx"
    DWG = "dwg"
    DXF = "dxf"
    IMAGE = "image"
    CSV = "csv"
    JSON = "json"
    XML = "xml"


@dataclass
class DocumentMetadata:
    """Standard document metadata"""
    title: Optional[str] = None
    author: Optional[str] = None
    creator: Optional[str] = None
    subject: Optional[str] = None
    keywords: List[str] = field(default_factory=list)
    created: Optional[datetime] = None
    modified: Optional[datetime] = None
    language: Optional[str] = None
    page_count: Optional[int] = None
    word_count: Optional[int] = None

    # ISO 19650 naming convention fields
    naming_project: Optional[str] = None
    naming_originator: Optional[str] = None
    naming_volume: Optional[str] = None
    naming_level: Optional[str] = None
    naming_type: Optional[str] = None
    naming_role: Optional[str] = None
    naming_number: Optional[str] = None

    # Custom metadata
    custom: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TableData:
    """Extracted table data"""
    id: str
    name: Optional[str] = None
    headers: List[str] = field(default_factory=list)
    rows: List[List[Any]] = field(default_factory=list)
    source_page: Optional[int] = None
    source_section: Optional[str] = None


@dataclass
class Section:
    """Document section"""
    id: str
    heading: Optional[str] = None
    level: int = 1
    content: str = ""
    paragraphs: List[str] = field(default_factory=list)
    tables: List[TableData] = field(default_factory=list)
    children: List['Section'] = field(default_factory=list)


@dataclass
class ParseResult:
    """Result of document parsing"""
    success: bool
    document_type: DocumentType
    file_path: str
    file_hash: str

    # Core content
    metadata: DocumentMetadata = field(default_factory=DocumentMetadata)
    full_text: str = ""
    sections: List[Section] = field(default_factory=list)
    tables: List[TableData] = field(default_factory=list)

    # For BIM files
    elements: List[Dict[str, Any]] = field(default_factory=list)
    spatial_structure: Dict[str, Any] = field(default_factory=dict)
    relationships: List[Dict[str, Any]] = field(default_factory=list)

    # Processing info
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    processing_time_ms: int = 0

    # Statistics
    statistics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'success': self.success,
            'document_type': self.document_type.value,
            'file_path': self.file_path,
            'file_hash': self.file_hash,
            'metadata': {
                'title': self.metadata.title,
                'author': self.metadata.author,
                'created': self.metadata.created.isoformat() if self.metadata.created else None,
                'modified': self.metadata.modified.isoformat() if self.metadata.modified else None,
                'page_count': self.metadata.page_count,
                'word_count': self.metadata.word_count,
                'custom': self.metadata.custom,
            },
            'full_text_length': len(self.full_text),
            'section_count': len(self.sections),
            'table_count': len(self.tables),
            'element_count': len(self.elements),
            'errors': self.errors,
            'warnings': self.warnings,
            'processing_time_ms': self.processing_time_ms,
            'statistics': self.statistics,
        }


class DocumentParser(ABC):
    """
    Abstract base class for document parsers.

    All parsers must implement:
    - parse(): Main parsing method
    - extract_metadata(): Extract document metadata
    - extract_text(): Extract full text content
    """

    document_type: DocumentType
    supported_extensions: List[str] = []

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    @abstractmethod
    async def parse(self, file_path: Path) -> ParseResult:
        """
        Parse document and extract all structured data.

        Args:
            file_path: Path to the document file

        Returns:
            ParseResult containing extracted data
        """
        pass

    @abstractmethod
    async def extract_metadata(self, file_path: Path) -> DocumentMetadata:
        """
        Extract document metadata.

        Args:
            file_path: Path to the document file

        Returns:
            DocumentMetadata object
        """
        pass

    @abstractmethod
    async def extract_text(self, file_path: Path) -> str:
        """
        Extract full text content from document.

        Args:
            file_path: Path to the document file

        Returns:
            Full text content as string
        """
        pass

    def compute_file_hash(self, file_path: Path) -> str:
        """Compute SHA-256 hash of file"""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()

    def parse_iso19650_filename(self, filename: str) -> Dict[str, str]:
        """
        Parse ISO 19650 compliant filename.

        Format: Project-Originator-Volume-Level-Type-Role-Number

        Args:
            filename: Filename to parse

        Returns:
            Dictionary with naming components
        """
        parts = filename.split('.')[0].split('-')

        result = {
            'project': None,
            'originator': None,
            'volume': None,
            'level': None,
            'type': None,
            'role': None,
            'number': None,
            'compliant': False,
        }

        if len(parts) >= 7:
            result.update({
                'project': parts[0],
                'originator': parts[1],
                'volume': parts[2],
                'level': parts[3],
                'type': parts[4],
                'role': parts[5],
                'number': parts[6],
                'compliant': True,
            })

        return result

    def validate_for_standards(
        self,
        result: ParseResult,
        lifecycle_phase: str
    ) -> List[str]:
        """
        Validate parsed document against construction standards.

        Args:
            result: Parse result to validate
            lifecycle_phase: Current lifecycle phase

        Returns:
            List of validation warnings
        """
        warnings = []

        # Check ISO 19650 naming convention
        naming = self.parse_iso19650_filename(Path(result.file_path).name)
        if not naming['compliant']:
            warnings.append(
                "Filename does not follow ISO 19650 naming convention "
                "(Project-Originator-Volume-Level-Type-Role-Number)"
            )

        # Check required metadata
        if not result.metadata.author:
            warnings.append("Document author is not specified")

        if not result.metadata.created:
            warnings.append("Document creation date is not specified")

        # Phase-specific checks
        if lifecycle_phase == 'design':
            if not result.metadata.title:
                warnings.append("Design document should have a title")

        elif lifecycle_phase == 'construction':
            # Check for required sections in construction documents
            section_headings = [s.heading.lower() if s.heading else '' for s in result.sections]
            if 'scope' not in ' '.join(section_headings):
                warnings.append("Construction document should include a Scope section")

        return warnings
