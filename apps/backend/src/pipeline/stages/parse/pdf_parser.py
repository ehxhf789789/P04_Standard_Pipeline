"""
PDF Document Parser

Extracts text, tables, images, and metadata from PDF files.
Supports OCR for scanned documents.
"""

import io
import time
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime
import uuid

try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

try:
    from pdf2image import convert_from_path
    import pytesseract
    HAS_OCR = True
except ImportError:
    HAS_OCR = False

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

from .base import (
    DocumentParser,
    DocumentType,
    DocumentMetadata,
    ParseResult,
    Section,
    TableData,
)

logger = logging.getLogger(__name__)


class PDFParser(DocumentParser):
    """
    PDF Document Parser

    Features:
    - Text extraction with layout preservation
    - Table detection and extraction
    - Image extraction
    - Metadata extraction
    - OCR for scanned documents
    - Hyperlink extraction
    """

    document_type = DocumentType.PDF
    supported_extensions = ['.pdf']

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.ocr_enabled = self.config.get('ocr_enabled', True)
        self.ocr_language = self.config.get('ocr_language', 'eng+kor')
        self.extract_images = self.config.get('extract_images', True)
        self.min_text_length_for_ocr = self.config.get('min_text_length_for_ocr', 100)

    async def parse(self, file_path: Path) -> ParseResult:
        """Parse PDF and extract all content"""
        start_time = time.time()

        result = ParseResult(
            success=False,
            document_type=self.document_type,
            file_path=str(file_path),
            file_hash=self.compute_file_hash(file_path),
        )

        if not HAS_PYMUPDF:
            result.errors.append("PyMuPDF not installed. Run: pip install pymupdf")
            return result

        try:
            doc = fitz.open(file_path)

            # Extract metadata
            result.metadata = await self.extract_metadata(file_path)
            result.metadata.page_count = len(doc)

            # Extract content page by page
            all_text = []
            all_tables = []
            sections = []

            for page_num in range(len(doc)):
                page = doc[page_num]

                # Extract text
                page_text = page.get_text("text")
                all_text.append(page_text)

                # Extract tables using pdfplumber for better accuracy
                if HAS_PDFPLUMBER:
                    page_tables = await self._extract_tables_pdfplumber(
                        file_path, page_num
                    )
                else:
                    page_tables = self._extract_tables_pymupdf(page, page_num)

                all_tables.extend(page_tables)

                # Create page section
                section = Section(
                    id=f"page_{page_num + 1}",
                    heading=f"Page {page_num + 1}",
                    level=1,
                    content=page_text,
                    tables=[t for t in page_tables],
                )
                sections.append(section)

            # Combine all text
            result.full_text = "\n\n".join(all_text)
            result.sections = sections
            result.tables = all_tables

            # Check if OCR is needed (scanned PDF)
            if (
                self.ocr_enabled
                and HAS_OCR
                and len(result.full_text.strip()) < self.min_text_length_for_ocr
                and len(doc) > 0
            ):
                logger.info(f"PDF appears to be scanned. Running OCR...")
                result = await self._run_ocr(file_path, result)

            # Calculate statistics
            result.statistics = {
                'page_count': len(doc),
                'table_count': len(all_tables),
                'character_count': len(result.full_text),
                'word_count': len(result.full_text.split()),
            }
            result.metadata.word_count = result.statistics['word_count']

            doc.close()
            result.success = True

        except Exception as e:
            logger.error(f"Error parsing PDF: {e}")
            result.errors.append(str(e))

        result.processing_time_ms = int((time.time() - start_time) * 1000)
        return result

    async def extract_metadata(self, file_path: Path) -> DocumentMetadata:
        """Extract PDF metadata"""
        metadata = DocumentMetadata()

        if not HAS_PYMUPDF:
            return metadata

        try:
            doc = fitz.open(file_path)
            pdf_metadata = doc.metadata

            metadata.title = pdf_metadata.get('title')
            metadata.author = pdf_metadata.get('author')
            metadata.creator = pdf_metadata.get('creator')
            metadata.subject = pdf_metadata.get('subject')

            # Parse keywords
            keywords = pdf_metadata.get('keywords', '')
            if keywords:
                metadata.keywords = [k.strip() for k in keywords.split(',')]

            # Parse dates
            if pdf_metadata.get('creationDate'):
                metadata.created = self._parse_pdf_date(pdf_metadata['creationDate'])
            if pdf_metadata.get('modDate'):
                metadata.modified = self._parse_pdf_date(pdf_metadata['modDate'])

            metadata.page_count = len(doc)

            # Custom metadata
            metadata.custom = {
                'format': pdf_metadata.get('format'),
                'producer': pdf_metadata.get('producer'),
                'encryption': pdf_metadata.get('encryption'),
            }

            doc.close()

        except Exception as e:
            logger.error(f"Error extracting PDF metadata: {e}")

        return metadata

    async def extract_text(self, file_path: Path) -> str:
        """Extract full text from PDF"""
        if not HAS_PYMUPDF:
            return ""

        try:
            doc = fitz.open(file_path)
            text_parts = []

            for page in doc:
                text_parts.append(page.get_text("text"))

            doc.close()
            return "\n\n".join(text_parts)

        except Exception as e:
            logger.error(f"Error extracting PDF text: {e}")
            return ""

    def _extract_tables_pymupdf(
        self, page: 'fitz.Page', page_num: int
    ) -> List[TableData]:
        """Extract tables from page using PyMuPDF"""
        tables = []

        try:
            # Find tables using PyMuPDF's table detection
            tabs = page.find_tables()

            for i, tab in enumerate(tabs):
                table_data = TableData(
                    id=str(uuid.uuid4()),
                    name=f"Table_{page_num + 1}_{i + 1}",
                    source_page=page_num + 1,
                )

                # Extract table content
                extracted = tab.extract()
                if extracted and len(extracted) > 0:
                    # First row as headers
                    table_data.headers = [str(cell) if cell else '' for cell in extracted[0]]
                    # Rest as data rows
                    table_data.rows = [
                        [str(cell) if cell else '' for cell in row]
                        for row in extracted[1:]
                    ]

                tables.append(table_data)

        except Exception as e:
            logger.warning(f"Error extracting tables from page {page_num}: {e}")

        return tables

    async def _extract_tables_pdfplumber(
        self, file_path: Path, page_num: int
    ) -> List[TableData]:
        """Extract tables using pdfplumber for better accuracy"""
        tables = []

        try:
            import pdfplumber

            with pdfplumber.open(file_path) as pdf:
                if page_num < len(pdf.pages):
                    page = pdf.pages[page_num]
                    page_tables = page.extract_tables()

                    for i, tab in enumerate(page_tables):
                        if tab and len(tab) > 0:
                            table_data = TableData(
                                id=str(uuid.uuid4()),
                                name=f"Table_{page_num + 1}_{i + 1}",
                                source_page=page_num + 1,
                            )

                            # First row as headers
                            table_data.headers = [str(cell) if cell else '' for cell in tab[0]]
                            # Rest as data rows
                            table_data.rows = [
                                [str(cell) if cell else '' for cell in row]
                                for row in tab[1:]
                            ]

                            tables.append(table_data)

        except Exception as e:
            logger.warning(f"Error with pdfplumber on page {page_num}: {e}")

        return tables

    async def _run_ocr(self, file_path: Path, result: ParseResult) -> ParseResult:
        """Run OCR on scanned PDF"""
        if not HAS_OCR:
            result.warnings.append("OCR libraries not available")
            return result

        try:
            # Convert PDF pages to images
            images = convert_from_path(file_path, dpi=300)

            ocr_text_parts = []
            new_sections = []

            for i, image in enumerate(images):
                # Run OCR
                page_text = pytesseract.image_to_string(
                    image,
                    lang=self.ocr_language
                )
                ocr_text_parts.append(page_text)

                # Create section
                section = Section(
                    id=f"page_{i + 1}",
                    heading=f"Page {i + 1} (OCR)",
                    level=1,
                    content=page_text,
                )
                new_sections.append(section)

            result.full_text = "\n\n".join(ocr_text_parts)
            result.sections = new_sections
            result.statistics['ocr_applied'] = True
            result.statistics['word_count'] = len(result.full_text.split())
            result.metadata.word_count = result.statistics['word_count']

        except Exception as e:
            logger.error(f"OCR failed: {e}")
            result.warnings.append(f"OCR failed: {str(e)}")

        return result

    def _parse_pdf_date(self, date_str: str) -> Optional[datetime]:
        """Parse PDF date format (D:YYYYMMDDHHmmss)"""
        try:
            if date_str.startswith('D:'):
                date_str = date_str[2:]

            # Remove timezone info for simplicity
            date_str = date_str[:14]

            return datetime.strptime(date_str, '%Y%m%d%H%M%S')
        except Exception:
            return None

    async def extract_images(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract images from PDF"""
        images = []

        if not HAS_PYMUPDF:
            return images

        try:
            doc = fitz.open(file_path)

            for page_num in range(len(doc)):
                page = doc[page_num]
                image_list = page.get_images(full=True)

                for img_idx, img in enumerate(image_list):
                    xref = img[0]
                    base_image = doc.extract_image(xref)

                    images.append({
                        'page': page_num + 1,
                        'index': img_idx,
                        'xref': xref,
                        'width': img[2],
                        'height': img[3],
                        'ext': base_image['ext'],
                        'size': len(base_image['image']),
                    })

            doc.close()

        except Exception as e:
            logger.error(f"Error extracting images: {e}")

        return images

    async def extract_links(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract hyperlinks from PDF"""
        links = []

        if not HAS_PYMUPDF:
            return links

        try:
            doc = fitz.open(file_path)

            for page_num in range(len(doc)):
                page = doc[page_num]
                page_links = page.get_links()

                for link in page_links:
                    link_data = {
                        'page': page_num + 1,
                        'kind': link.get('kind'),
                        'uri': link.get('uri'),
                        'rect': link.get('from'),
                    }

                    # Internal link
                    if link.get('kind') == fitz.LINK_GOTO:
                        link_data['target_page'] = link.get('page', 0) + 1

                    links.append(link_data)

            doc.close()

        except Exception as e:
            logger.error(f"Error extracting links: {e}")

        return links
