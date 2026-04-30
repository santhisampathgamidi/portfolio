"""Manual character-window chunker.

Mirrors the textbook example from the Project #07 spec — fixed-size windows
with overlap. No tokenizer, no semantic splitting; the educational point is
that the user *sees* exactly how chunks are formed and how `overlap` changes
the boundaries.
"""
from dataclasses import dataclass
from typing import List


@dataclass
class Chunk:
    id: int
    text: str
    start: int
    end: int

    @property
    def chars(self) -> int:
        return self.end - self.start

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "text": self.text,
            "start": self.start,
            "end": self.end,
            "chars": self.chars,
        }


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> List[Chunk]:
    """Split `text` into overlapping character windows.

    Args:
        text: source text.
        chunk_size: window length in characters. Must be >= 1.
        overlap: characters shared between consecutive chunks. Must satisfy
            0 <= overlap < chunk_size, otherwise the loop cannot advance.

    Returns:
        Ordered list of Chunk records with absolute (start, end) offsets so
        the frontend can highlight chunk boundaries on the source text.
    """
    if chunk_size < 1:
        raise ValueError("chunk_size must be >= 1")
    if overlap < 0:
        raise ValueError("overlap must be >= 0")
    if overlap >= chunk_size:
        raise ValueError("overlap must be < chunk_size")

    if not text:
        return []

    chunks: List[Chunk] = []
    step = chunk_size - overlap
    start = 0
    idx = 0
    n = len(text)

    while start < n:
        end = min(start + chunk_size, n)
        chunks.append(Chunk(id=idx, text=text[start:end], start=start, end=end))
        idx += 1
        if end == n:
            break
        start += step

    return chunks
