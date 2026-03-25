"""
HWPX Document Parser

Extracts text, tables, and metadata from Korean Hangul Word Processor documents.
Supports both HWPX (XML-based) and HWP (binary) formats.
"""

import time
import logging
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime
import uuid
import struct
import zlib
import io

from .base import (
    DocumentParser,
    DocumentType,
    DocumentMetadata,
    ParseResult,
    Section,
    TableData,
)

logger = logging.getLogger(__name__)

# Try to import olefile for HWP binary format
try:
    import olefile
    HAS_OLEFILE = True
except ImportError:
    HAS_OLEFILE = False


class HWPXParser(DocumentParser):
    """
    Korean Hangul Word Processor Document Parser

    Supports:
    - HWPX (XML-based, newer format)
    - HWP (OLE-based, legacy format)

    Features:
    - Text extraction with structure
    - Table extraction
    - Metadata extraction
    - Section/paragraph structure
    """

    document_type = DocumentType.HWPX
    supported_extensions = ['.hwpx', '.hwp']

    # HWPX XML namespaces
    NAMESPACES = {
        'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
        'hc': 'http://www.hancom.co.kr/hwpml/2011/core',
        'hs': 'http://www.hancom.co.kr/hwpml/2011/section',
        'ha': 'http://www.hancom.co.kr/hwpml/2011/app',
        'config': 'urn:oasis:names:tc:opendocument:xmlns:config:1.0',
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)

    async def parse(self, file_path: Path) -> ParseResult:
        """Parse HWPX/HWP and extract all content"""
        start_time = time.time()

        result = ParseResult(
            success=False,
            document_type=self.document_type,
            file_path=str(file_path),
            file_hash=self.compute_file_hash(file_path),
        )

        try:
            extension = file_path.suffix.lower()

            if extension == '.hwpx':
                result = await self._parse_hwpx(file_path, result)
            elif extension == '.hwp':
                result = await self._parse_hwp(file_path, result)
            else:
                result.errors.append(f"Unsupported extension: {extension}")
                return result

            # Calculate statistics
            if result.success:
                word_count = len(result.full_text.split())
                result.statistics['word_count'] = word_count
                result.metadata.word_count = word_count

        except Exception as e:
            logger.error(f"Error parsing HWP/HWPX: {e}")
            result.errors.append(str(e))

        result.processing_time_ms = int((time.time() - start_time) * 1000)
        return result

    async def _parse_hwpx(self, file_path: Path, result: ParseResult) -> ParseResult:
        """Parse HWPX (XML-based) format"""
        try:
            with zipfile.ZipFile(file_path, 'r') as zf:
                # List all files in archive
                file_list = zf.namelist()

                # Extract metadata
                result.metadata = await self._extract_hwpx_metadata(zf)

                # Find and parse content files
                sections = []
                all_tables = []
                text_parts = []

                # HWPX structure: Contents/section*.xml
                section_files = sorted([
                    f for f in file_list
                    if f.startswith('Contents/section') and f.endswith('.xml')
                ])

                for section_idx, section_file in enumerate(section_files):
                    with zf.open(section_file) as sf:
                        section_content = sf.read()
                        section_result = await self._parse_hwpx_section(
                            section_content, section_idx
                        )

                        section = Section(
                            id=str(uuid.uuid4()),
                            heading=section_result.get('title') or f"Section {section_idx + 1}",
                            level=1,
                            content=section_result['content'],
                            paragraphs=section_result['paragraphs'],
                            tables=section_result['tables'],
                        )

                        sections.append(section)
                        all_tables.extend(section_result['tables'])
                        text_parts.append(section_result['content'])

                result.sections = sections
                result.tables = all_tables
                result.full_text = '\n\n'.join(text_parts)

                # Statistics
                result.statistics = {
                    'section_count': len(sections),
                    'table_count': len(all_tables),
                    'character_count': len(result.full_text),
                }

                result.success = True

        except zipfile.BadZipFile:
            result.errors.append("Invalid HWPX file (not a valid ZIP archive)")
        except Exception as e:
            result.errors.append(f"HWPX parsing error: {str(e)}")

        return result

    async def _extract_hwpx_metadata(self, zf: zipfile.ZipFile) -> DocumentMetadata:
        """Extract metadata from HWPX"""
        metadata = DocumentMetadata()

        try:
            # Try to read meta.xml or similar
            meta_files = [f for f in zf.namelist() if 'meta' in f.lower()]

            for meta_file in meta_files:
                with zf.open(meta_file) as mf:
                    tree = ET.parse(mf)
                    root = tree.getroot()

                    # Try to find common metadata elements
                    for elem in root.iter():
                        tag = elem.tag.split('}')[-1].lower()

                        if tag == 'title' and elem.text:
                            metadata.title = elem.text
                        elif tag == 'creator' and elem.text:
                            metadata.creator = elem.text
                            metadata.author = elem.text
                        elif tag == 'date' and elem.text:
                            try:
                                metadata.created = datetime.fromisoformat(elem.text.replace('Z', '+00:00'))
                            except:
                                pass

        except Exception as e:
            logger.warning(f"Error extracting HWPX metadata: {e}")

        return metadata

    async def _parse_hwpx_section(
        self, content: bytes, section_idx: int
    ) -> Dict[str, Any]:
        """Parse a single HWPX section XML"""
        result = {
            'title': None,
            'content': '',
            'paragraphs': [],
            'tables': [],
        }

        try:
            root = ET.fromstring(content)
            text_parts = []
            table_idx = 0

            # Find all paragraphs
            for elem in root.iter():
                tag = elem.tag.split('}')[-1]

                if tag == 'p':  # Paragraph
                    para_text = self._extract_text_from_element(elem)
                    if para_text:
                        text_parts.append(para_text)
                        result['paragraphs'].append(para_text)

                elif tag == 'tbl':  # Table
                    table_data = self._parse_hwpx_table(elem, section_idx, table_idx)
                    if table_data:
                        result['tables'].append(table_data)
                        table_idx += 1

            result['content'] = '\n'.join(text_parts)

            # Try to detect title (first paragraph if it looks like a heading)
            if result['paragraphs']:
                first_para = result['paragraphs'][0]
                if len(first_para) < 100:  # Short enough to be a title
                    result['title'] = first_para

        except ET.ParseError as e:
            logger.warning(f"XML parse error in section {section_idx}: {e}")

        return result

    def _extract_text_from_element(self, elem: ET.Element) -> str:
        """Extract all text from an XML element"""
        texts = []

        # Direct text
        if elem.text:
            texts.append(elem.text)

        # Child elements
        for child in elem:
            child_text = self._extract_text_from_element(child)
            if child_text:
                texts.append(child_text)

            # Tail text
            if child.tail:
                texts.append(child.tail)

        return ''.join(texts).strip()

    def _parse_hwpx_table(
        self, elem: ET.Element, section_idx: int, table_idx: int
    ) -> Optional[TableData]:
        """Parse a table element"""
        table_data = TableData(
            id=str(uuid.uuid4()),
            name=f"Section{section_idx + 1}_Table{table_idx + 1}",
            source_section=f"Section {section_idx + 1}",
        )

        rows = []
        for row_elem in elem.iter():
            tag = row_elem.tag.split('}')[-1]
            if tag == 'tr':
                row_data = []
                for cell_elem in row_elem.iter():
                    cell_tag = cell_elem.tag.split('}')[-1]
                    if cell_tag == 'tc':
                        cell_text = self._extract_text_from_element(cell_elem)
                        row_data.append(cell_text)
                if row_data:
                    rows.append(row_data)

        if rows:
            table_data.headers = rows[0] if rows else []
            table_data.rows = rows[1:] if len(rows) > 1 else []
            return table_data

        return None

    async def _parse_hwp(self, file_path: Path, result: ParseResult) -> ParseResult:
        """Parse HWP (OLE binary) format"""
        if not HAS_OLEFILE:
            result.errors.append(
                "olefile not installed for HWP support. Run: pip install olefile"
            )
            return result

        try:
            ole = olefile.OleFileIO(file_path)

            # Extract metadata
            result.metadata = await self._extract_hwp_metadata(ole)

            # Extract text from BodyText streams
            text_parts = []
            sections = []
            section_idx = 0

            # HWP structure: BodyText/Section0, Section1, ...
            for entry in ole.listdir():
                if entry[0] == 'BodyText' and entry[1].startswith('Section'):
                    stream = ole.openstream(entry)
                    data = stream.read()

                    # Decompress if needed
                    try:
                        decompressed = zlib.decompress(data, -15)
                        section_text = await self._parse_hwp_section_data(decompressed)
                    except zlib.error:
                        section_text = await self._parse_hwp_section_data(data)

                    if section_text:
                        section = Section(
                            id=str(uuid.uuid4()),
                            heading=f"Section {section_idx + 1}",
                            level=1,
                            content=section_text,
                        )
                        sections.append(section)
                        text_parts.append(section_text)
                        section_idx += 1

            result.sections = sections
            result.full_text = '\n\n'.join(text_parts)
            result.statistics = {
                'section_count': len(sections),
                'character_count': len(result.full_text),
            }

            ole.close()
            result.success = True

        except Exception as e:
            result.errors.append(f"HWP parsing error: {str(e)}")

        return result

    async def _extract_hwp_metadata(self, ole: 'olefile.OleFileIO') -> DocumentMetadata:
        """Extract metadata from HWP OLE file"""
        metadata = DocumentMetadata()

        try:
            # Try to read summary info
            if ole.exists('\x05HwpSummaryInformation'):
                # Parse document summary
                pass

            # Try to read document properties
            if ole.exists('DocInfo'):
                stream = ole.openstream('DocInfo')
                data = stream.read()
                # Parse DocInfo structure
                # This is complex binary format

        except Exception as e:
            logger.warning(f"Error extracting HWP metadata: {e}")

        return metadata

    async def _parse_hwp_section_data(self, data: bytes) -> str:
        """Parse HWP section binary data to extract text"""
        text_parts = []

        try:
            # HWP text is stored as UTF-16LE with control characters
            # This is a simplified extraction
            i = 0
            while i < len(data) - 1:
                # Check for text record
                char = struct.unpack('<H', data[i:i+2])[0]

                # Skip control characters (char < 32 except common ones)
                if char >= 32 and char < 0xFFFF:
                    try:
                        text_parts.append(chr(char))
                    except:
                        pass

                i += 2

            text = ''.join(text_parts)

            # Clean up common HWP control sequences
            text = text.replace('\x00', '')
            text = text.replace('\x0d', '\n')

            return text.strip()

        except Exception as e:
            logger.warning(f"Error parsing HWP section data: {e}")
            return ""

    async def extract_metadata(self, file_path: Path) -> DocumentMetadata:
        """Extract metadata from HWPX/HWP"""
        extension = file_path.suffix.lower()

        if extension == '.hwpx':
            try:
                with zipfile.ZipFile(file_path, 'r') as zf:
                    return await self._extract_hwpx_metadata(zf)
            except:
                pass
        elif extension == '.hwp' and HAS_OLEFILE:
            try:
                ole = olefile.OleFileIO(file_path)
                metadata = await self._extract_hwp_metadata(ole)
                ole.close()
                return metadata
            except:
                pass

        return DocumentMetadata()

    async def extract_text(self, file_path: Path) -> str:
        """Extract full text from HWPX/HWP"""
        result = await self.parse(file_path)
        return result.full_text if result.success else ""
