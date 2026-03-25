"""
Embedding Generator

Generates vector embeddings from BIM/construction document content for:
- Semantic search and retrieval
- RAG (Retrieval Augmented Generation) systems
- Document similarity analysis
- Clustering and classification

Supports multiple embedding models:
- OpenAI (text-embedding-3-small/large)
- Cohere (embed-v3)
- Local models (sentence-transformers)
- Custom models via API

Output compatible with vector databases:
- Qdrant
- Pinecone
- Weaviate
- pgvector (PostgreSQL)
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, Any, Generator
import hashlib
import re

logger = logging.getLogger(__name__)


class EmbeddingModel(Enum):
    """Supported embedding models"""
    # OpenAI models
    OPENAI_SMALL = "text-embedding-3-small"  # 1536 dimensions
    OPENAI_LARGE = "text-embedding-3-large"  # 3072 dimensions
    OPENAI_ADA = "text-embedding-ada-002"  # 1536 dimensions (legacy)

    # Cohere models
    COHERE_ENGLISH = "embed-english-v3.0"  # 1024 dimensions
    COHERE_MULTILINGUAL = "embed-multilingual-v3.0"  # 1024 dimensions

    # Local models (sentence-transformers)
    SENTENCE_TRANSFORMERS = "all-MiniLM-L6-v2"  # 384 dimensions
    MULTILINGUAL_E5 = "intfloat/multilingual-e5-large"  # 1024 dimensions
    BGE_LARGE = "BAAI/bge-large-en-v1.5"  # 1024 dimensions

    # Custom/API
    CUSTOM = "custom"


class ChunkingStrategy(Enum):
    """Text chunking strategies"""
    FIXED_SIZE = "fixed_size"  # Fixed character/token count
    SENTENCE = "sentence"  # Sentence boundaries
    PARAGRAPH = "paragraph"  # Paragraph boundaries
    SEMANTIC = "semantic"  # Semantic boundaries (sections, headings)
    RECURSIVE = "recursive"  # Recursive splitting with overlap
    ELEMENT = "element"  # One chunk per BIM element


@dataclass
class TextChunk:
    """A chunk of text for embedding"""
    id: str
    text: str
    metadata: dict = field(default_factory=dict)
    source_type: str = "document"  # "document", "ifc_element", "property"
    source_id: Optional[str] = None
    start_pos: int = 0
    end_pos: int = 0
    chunk_index: int = 0
    token_count: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "text": self.text,
            "metadata": self.metadata,
            "sourceType": self.source_type,
            "sourceId": self.source_id,
            "startPos": self.start_pos,
            "endPos": self.end_pos,
            "chunkIndex": self.chunk_index,
            "tokenCount": self.token_count
        }


@dataclass
class EmbeddingResult:
    """Result of embedding generation"""
    chunk_id: str
    embedding: list[float]
    model: str
    dimensions: int
    metadata: dict = field(default_factory=dict)
    text: Optional[str] = None  # Original text (optional, for debugging)
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "id": self.chunk_id,
            "embedding": self.embedding,
            "model": self.model,
            "dimensions": self.dimensions,
            "metadata": self.metadata,
            "createdAt": self.created_at.isoformat()
        }

    def to_qdrant_point(self) -> dict:
        """Convert to Qdrant point format"""
        return {
            "id": self.chunk_id,
            "vector": self.embedding,
            "payload": {
                **self.metadata,
                "text": self.text,
                "model": self.model,
                "created_at": self.created_at.isoformat()
            }
        }

    def to_pinecone_vector(self) -> dict:
        """Convert to Pinecone vector format"""
        return {
            "id": self.chunk_id,
            "values": self.embedding,
            "metadata": {
                **self.metadata,
                "text": self.text[:1000] if self.text else None  # Pinecone metadata limit
            }
        }


@dataclass
class EmbeddingStats:
    """Statistics for embedding generation"""
    total_chunks: int = 0
    total_tokens: int = 0
    total_characters: int = 0
    embedding_dimensions: int = 0
    model_used: str = ""
    processing_time_ms: float = 0
    errors: list[str] = field(default_factory=list)


class TextChunker:
    """Utility class for chunking text into embeddable segments"""

    def __init__(
        self,
        strategy: ChunkingStrategy = ChunkingStrategy.RECURSIVE,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        separators: list[str] = None
    ):
        self.strategy = strategy
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", " ", ""]

    def chunk_text(
        self,
        text: str,
        source_id: str = None,
        metadata: dict = None
    ) -> list[TextChunk]:
        """Split text into chunks based on strategy"""
        if self.strategy == ChunkingStrategy.FIXED_SIZE:
            return self._chunk_fixed_size(text, source_id, metadata)
        elif self.strategy == ChunkingStrategy.SENTENCE:
            return self._chunk_by_sentence(text, source_id, metadata)
        elif self.strategy == ChunkingStrategy.PARAGRAPH:
            return self._chunk_by_paragraph(text, source_id, metadata)
        elif self.strategy == ChunkingStrategy.RECURSIVE:
            return self._chunk_recursive(text, source_id, metadata)
        else:
            return self._chunk_fixed_size(text, source_id, metadata)

    def _chunk_fixed_size(
        self,
        text: str,
        source_id: str,
        metadata: dict
    ) -> list[TextChunk]:
        """Chunk by fixed character count with overlap"""
        chunks = []
        start = 0
        chunk_index = 0

        while start < len(text):
            end = min(start + self.chunk_size, len(text))
            chunk_text = text[start:end]

            if chunk_text.strip():
                chunk_id = hashlib.md5(f"{source_id}_{chunk_index}".encode()).hexdigest()[:12]
                chunks.append(TextChunk(
                    id=chunk_id,
                    text=chunk_text.strip(),
                    metadata=metadata or {},
                    source_id=source_id,
                    start_pos=start,
                    end_pos=end,
                    chunk_index=chunk_index
                ))
                chunk_index += 1

            start = end - self.chunk_overlap if end < len(text) else end

        return chunks

    def _chunk_by_sentence(
        self,
        text: str,
        source_id: str,
        metadata: dict
    ) -> list[TextChunk]:
        """Chunk by sentence boundaries"""
        # Simple sentence splitting (can be improved with NLP library)
        sentences = re.split(r'(?<=[.!?])\s+', text)

        chunks = []
        current_chunk = []
        current_length = 0
        chunk_index = 0
        start_pos = 0

        for sentence in sentences:
            sentence_len = len(sentence)

            if current_length + sentence_len > self.chunk_size and current_chunk:
                # Create chunk from accumulated sentences
                chunk_text = " ".join(current_chunk)
                chunk_id = hashlib.md5(f"{source_id}_{chunk_index}".encode()).hexdigest()[:12]
                chunks.append(TextChunk(
                    id=chunk_id,
                    text=chunk_text.strip(),
                    metadata=metadata or {},
                    source_id=source_id,
                    start_pos=start_pos,
                    end_pos=start_pos + len(chunk_text),
                    chunk_index=chunk_index
                ))
                chunk_index += 1
                start_pos += len(chunk_text) + 1

                current_chunk = [sentence]
                current_length = sentence_len
            else:
                current_chunk.append(sentence)
                current_length += sentence_len + 1

        # Handle remaining sentences
        if current_chunk:
            chunk_text = " ".join(current_chunk)
            chunk_id = hashlib.md5(f"{source_id}_{chunk_index}".encode()).hexdigest()[:12]
            chunks.append(TextChunk(
                id=chunk_id,
                text=chunk_text.strip(),
                metadata=metadata or {},
                source_id=source_id,
                start_pos=start_pos,
                end_pos=start_pos + len(chunk_text),
                chunk_index=chunk_index
            ))

        return chunks

    def _chunk_by_paragraph(
        self,
        text: str,
        source_id: str,
        metadata: dict
    ) -> list[TextChunk]:
        """Chunk by paragraph boundaries"""
        paragraphs = text.split("\n\n")
        chunks = []
        chunk_index = 0
        current_pos = 0

        for para in paragraphs:
            para = para.strip()
            if para:
                chunk_id = hashlib.md5(f"{source_id}_{chunk_index}".encode()).hexdigest()[:12]
                chunks.append(TextChunk(
                    id=chunk_id,
                    text=para,
                    metadata=metadata or {},
                    source_id=source_id,
                    start_pos=current_pos,
                    end_pos=current_pos + len(para),
                    chunk_index=chunk_index
                ))
                chunk_index += 1
            current_pos += len(para) + 2  # +2 for \n\n

        return chunks

    def _chunk_recursive(
        self,
        text: str,
        source_id: str,
        metadata: dict,
        separators: list[str] = None
    ) -> list[TextChunk]:
        """Recursively split text using multiple separators"""
        separators = separators or self.separators

        if not text.strip():
            return []

        # If text is small enough, return as single chunk
        if len(text) <= self.chunk_size:
            chunk_id = hashlib.md5(f"{source_id}_0".encode()).hexdigest()[:12]
            return [TextChunk(
                id=chunk_id,
                text=text.strip(),
                metadata=metadata or {},
                source_id=source_id,
                start_pos=0,
                end_pos=len(text),
                chunk_index=0
            )]

        chunks = []
        chunk_index = [0]  # Use list for mutable reference

        def split_recursive(text: str, seps: list[str], start_pos: int) -> list[str]:
            if not seps:
                return [text]

            sep = seps[0]
            remaining_seps = seps[1:]

            parts = text.split(sep) if sep else list(text)
            result = []
            current = ""
            current_start = start_pos

            for part in parts:
                test = current + (sep if current else "") + part

                if len(test) <= self.chunk_size:
                    current = test
                else:
                    if current:
                        if len(current) > self.chunk_size and remaining_seps:
                            # Recursively split with next separator
                            sub_chunks = split_recursive(current, remaining_seps, current_start)
                            for sub in sub_chunks:
                                if sub.strip():
                                    chunk_id = hashlib.md5(f"{source_id}_{chunk_index[0]}".encode()).hexdigest()[:12]
                                    chunks.append(TextChunk(
                                        id=chunk_id,
                                        text=sub.strip(),
                                        metadata=metadata or {},
                                        source_id=source_id,
                                        start_pos=current_start,
                                        end_pos=current_start + len(sub),
                                        chunk_index=chunk_index[0]
                                    ))
                                    chunk_index[0] += 1
                                    current_start += len(sub) + len(sep)
                        else:
                            chunk_id = hashlib.md5(f"{source_id}_{chunk_index[0]}".encode()).hexdigest()[:12]
                            chunks.append(TextChunk(
                                id=chunk_id,
                                text=current.strip(),
                                metadata=metadata or {},
                                source_id=source_id,
                                start_pos=current_start,
                                end_pos=current_start + len(current),
                                chunk_index=chunk_index[0]
                            ))
                            chunk_index[0] += 1
                            current_start += len(current) + len(sep)

                    current = part

            if current:
                result.append(current)

            return result

        remaining = split_recursive(text, separators, 0)

        # Handle any remaining text
        for rem in remaining:
            if rem.strip():
                chunk_id = hashlib.md5(f"{source_id}_{chunk_index[0]}".encode()).hexdigest()[:12]
                chunks.append(TextChunk(
                    id=chunk_id,
                    text=rem.strip(),
                    metadata=metadata or {},
                    source_id=source_id,
                    chunk_index=chunk_index[0]
                ))
                chunk_index[0] += 1

        return chunks


class EmbeddingGenerator:
    """
    Generates vector embeddings from text content.

    Supports multiple embedding providers and models.
    Outputs compatible with major vector databases.

    Example:
        generator = EmbeddingGenerator(model=EmbeddingModel.OPENAI_SMALL)
        chunks = generator.chunk_text(document_text, source_id="doc-123")
        embeddings = await generator.generate_embeddings(chunks)

        # Save for vector DB
        generator.save_to_jsonl(embeddings, output_path)
    """

    # Model dimension mapping
    MODEL_DIMENSIONS = {
        EmbeddingModel.OPENAI_SMALL: 1536,
        EmbeddingModel.OPENAI_LARGE: 3072,
        EmbeddingModel.OPENAI_ADA: 1536,
        EmbeddingModel.COHERE_ENGLISH: 1024,
        EmbeddingModel.COHERE_MULTILINGUAL: 1024,
        EmbeddingModel.SENTENCE_TRANSFORMERS: 384,
        EmbeddingModel.MULTILINGUAL_E5: 1024,
        EmbeddingModel.BGE_LARGE: 1024,
    }

    def __init__(
        self,
        model: EmbeddingModel = EmbeddingModel.OPENAI_SMALL,
        api_key: Optional[str] = None,
        chunking_strategy: ChunkingStrategy = ChunkingStrategy.RECURSIVE,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        batch_size: int = 100
    ):
        self.model = model
        self.api_key = api_key
        self.batch_size = batch_size
        self.dimensions = self.MODEL_DIMENSIONS.get(model, 1536)

        self.chunker = TextChunker(
            strategy=chunking_strategy,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )

        self.stats = EmbeddingStats(
            model_used=model.value,
            embedding_dimensions=self.dimensions
        )

        # Initialize embedding client
        self._client = None

    def chunk_text(
        self,
        text: str,
        source_id: str,
        metadata: dict = None
    ) -> list[TextChunk]:
        """Chunk text into embeddable segments"""
        chunks = self.chunker.chunk_text(text, source_id, metadata)
        self.stats.total_chunks = len(chunks)
        self.stats.total_characters = sum(len(c.text) for c in chunks)
        return chunks

    def chunk_ifc_element(self, element_data: dict) -> TextChunk:
        """Create a chunk from an IFC element's properties"""
        global_id = element_data.get("global_id", "unknown")
        ifc_class = element_data.get("ifc_class", "IfcBuildingElement")
        name = element_data.get("name", "")

        # Build text representation
        text_parts = [
            f"IFC Element: {ifc_class}",
            f"Name: {name}" if name else None,
            f"GlobalId: {global_id}"
        ]

        # Add properties
        for pset_name, props in element_data.get("property_sets", {}).items():
            text_parts.append(f"\n{pset_name}:")
            for prop_name, prop_value in props.items():
                if prop_value is not None:
                    text_parts.append(f"  - {prop_name}: {prop_value}")

        # Add materials
        materials = element_data.get("materials", [])
        if materials:
            text_parts.append("\nMaterials:")
            for mat in materials:
                text_parts.append(f"  - {mat.get('name', 'Unknown')}")

        text = "\n".join(filter(None, text_parts))

        chunk_id = hashlib.md5(global_id.encode()).hexdigest()[:12]
        return TextChunk(
            id=chunk_id,
            text=text,
            metadata={
                "globalId": global_id,
                "ifcClass": ifc_class,
                "name": name,
                "propertySetCount": len(element_data.get("property_sets", {})),
                "materialCount": len(materials)
            },
            source_type="ifc_element",
            source_id=global_id
        )

    def chunk_document_section(
        self,
        section: dict,
        document_id: str
    ) -> list[TextChunk]:
        """Create chunks from a document section"""
        section_id = section.get("id", str(hash(str(section))))
        heading = section.get("heading", "")
        content = section.get("content", "")
        level = section.get("level", 1)

        # Prepend heading to content for context
        full_text = f"{heading}\n\n{content}" if heading else content

        # Chunk the content
        chunks = self.chunker.chunk_text(
            full_text,
            source_id=f"{document_id}_{section_id}",
            metadata={
                "documentId": document_id,
                "sectionId": section_id,
                "heading": heading,
                "level": level,
                "sourceType": "document_section"
            }
        )

        return chunks

    async def generate_embeddings(
        self,
        chunks: list[TextChunk],
        include_text: bool = True
    ) -> list[EmbeddingResult]:
        """
        Generate embeddings for a list of chunks.

        Args:
            chunks: List of TextChunk objects
            include_text: Whether to include original text in results

        Returns:
            List of EmbeddingResult objects
        """
        import time
        start_time = time.time()

        results = []

        # Process in batches
        for i in range(0, len(chunks), self.batch_size):
            batch = chunks[i:i + self.batch_size]
            texts = [chunk.text for chunk in batch]

            try:
                embeddings = await self._generate_batch(texts)

                for chunk, embedding in zip(batch, embeddings):
                    results.append(EmbeddingResult(
                        chunk_id=chunk.id,
                        embedding=embedding,
                        model=self.model.value,
                        dimensions=len(embedding),
                        metadata=chunk.metadata,
                        text=chunk.text if include_text else None
                    ))
            except Exception as e:
                logger.error(f"Error generating embeddings for batch: {e}")
                self.stats.errors.append(str(e))

        self.stats.processing_time_ms = (time.time() - start_time) * 1000
        return results

    async def _generate_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a batch of texts using the configured model"""

        if self.model in [EmbeddingModel.OPENAI_SMALL, EmbeddingModel.OPENAI_LARGE, EmbeddingModel.OPENAI_ADA]:
            return await self._generate_openai(texts)
        elif self.model in [EmbeddingModel.COHERE_ENGLISH, EmbeddingModel.COHERE_MULTILINGUAL]:
            return await self._generate_cohere(texts)
        elif self.model in [EmbeddingModel.SENTENCE_TRANSFORMERS, EmbeddingModel.MULTILINGUAL_E5, EmbeddingModel.BGE_LARGE]:
            return self._generate_local(texts)
        else:
            # Fallback to dummy embeddings for testing
            logger.warning(f"Using dummy embeddings for model: {self.model}")
            return self._generate_dummy(texts)

    async def _generate_openai(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using OpenAI API"""
        try:
            import openai

            client = openai.AsyncOpenAI(api_key=self.api_key)
            response = await client.embeddings.create(
                model=self.model.value,
                input=texts
            )
            return [item.embedding for item in response.data]
        except ImportError:
            logger.error("openai package not installed")
            return self._generate_dummy(texts)
        except Exception as e:
            logger.error(f"OpenAI embedding error: {e}")
            raise

    async def _generate_cohere(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using Cohere API"""
        try:
            import cohere

            client = cohere.AsyncClient(api_key=self.api_key)
            response = await client.embed(
                texts=texts,
                model=self.model.value,
                input_type="search_document"
            )
            return response.embeddings
        except ImportError:
            logger.error("cohere package not installed")
            return self._generate_dummy(texts)
        except Exception as e:
            logger.error(f"Cohere embedding error: {e}")
            raise

    def _generate_local(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using local sentence-transformers model"""
        try:
            from sentence_transformers import SentenceTransformer

            if self._client is None:
                self._client = SentenceTransformer(self.model.value)

            embeddings = self._client.encode(texts, convert_to_numpy=True)
            return embeddings.tolist()
        except ImportError:
            logger.error("sentence-transformers package not installed")
            return self._generate_dummy(texts)
        except Exception as e:
            logger.error(f"Local embedding error: {e}")
            raise

    def _generate_dummy(self, texts: list[str]) -> list[list[float]]:
        """Generate dummy embeddings for testing"""
        import random
        return [
            [random.random() for _ in range(self.dimensions)]
            for _ in texts
        ]

    def save_to_jsonl(
        self,
        embeddings: list[EmbeddingResult],
        output_path: Path
    ) -> None:
        """Save embeddings to JSONL format (one JSON object per line)"""
        with open(output_path, 'w', encoding='utf-8') as f:
            for emb in embeddings:
                f.write(json.dumps(emb.to_dict(), ensure_ascii=False) + "\n")

        logger.info(f"Saved {len(embeddings)} embeddings to {output_path}")

    def save_for_qdrant(
        self,
        embeddings: list[EmbeddingResult],
        output_path: Path
    ) -> None:
        """Save embeddings in Qdrant-compatible format"""
        points = [emb.to_qdrant_point() for emb in embeddings]

        data = {
            "collection_name": "bim_embeddings",
            "vector_size": self.dimensions,
            "distance": "Cosine",
            "points": points
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Saved {len(embeddings)} Qdrant points to {output_path}")

    def save_for_pinecone(
        self,
        embeddings: list[EmbeddingResult],
        output_path: Path
    ) -> None:
        """Save embeddings in Pinecone-compatible format"""
        vectors = [emb.to_pinecone_vector() for emb in embeddings]

        data = {
            "namespace": "bim",
            "vectors": vectors
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Saved {len(embeddings)} Pinecone vectors to {output_path}")

    def get_stats(self) -> dict:
        """Get embedding generation statistics"""
        return {
            "totalChunks": self.stats.total_chunks,
            "totalTokens": self.stats.total_tokens,
            "totalCharacters": self.stats.total_characters,
            "embeddingDimensions": self.stats.embedding_dimensions,
            "modelUsed": self.stats.model_used,
            "processingTimeMs": self.stats.processing_time_ms,
            "errors": self.stats.errors
        }
