"""
Document and BIM Parsing Modules

Supports:
- IFC (STEP/JSON/XML formats)
- PDF (including OCR for scanned documents)
- DOCX (Microsoft Word)
- XLSX (Microsoft Excel)
- PPTX (Microsoft PowerPoint)
- HWPX (Korean Hangul Word Processor)
- DWG/DXF (AutoCAD)
"""

from .base import DocumentParser, ParseResult
from .ifc_parser import IFCParser
from .pdf_parser import PDFParser
from .docx_parser import DOCXParser
from .xlsx_parser import XLSXParser
from .pptx_parser import PPTXParser
from .hwpx_parser import HWPXParser

# Parser registry
PARSERS = {
    '.ifc': IFCParser,
    '.ifcxml': IFCParser,
    '.ifcjson': IFCParser,
    '.pdf': PDFParser,
    '.docx': DOCXParser,
    '.doc': DOCXParser,
    '.xlsx': XLSXParser,
    '.xls': XLSXParser,
    '.pptx': PPTXParser,
    '.ppt': PPTXParser,
    '.hwpx': HWPXParser,
    '.hwp': HWPXParser,
}

def get_parser(file_extension: str) -> type[DocumentParser]:
    """Get appropriate parser for file extension"""
    parser_class = PARSERS.get(file_extension.lower())
    if not parser_class:
        raise ValueError(f"Unsupported file type: {file_extension}")
    return parser_class

__all__ = [
    'DocumentParser',
    'ParseResult',
    'IFCParser',
    'PDFParser',
    'DOCXParser',
    'XLSXParser',
    'PPTXParser',
    'HWPXParser',
    'get_parser',
    'PARSERS',
]
