import pytest

from app.chunker import chunk_text


def test_empty_text_returns_no_chunks():
    assert chunk_text("", chunk_size=100, overlap=10) == []


def test_text_shorter_than_window_returns_single_chunk():
    chunks = chunk_text("hello", chunk_size=100, overlap=10)
    assert len(chunks) == 1
    assert chunks[0].text == "hello"
    assert (chunks[0].start, chunks[0].end) == (0, 5)


def test_exact_window_size_returns_single_chunk():
    text = "a" * 100
    chunks = chunk_text(text, chunk_size=100, overlap=10)
    assert len(chunks) == 1
    assert chunks[0].chars == 100


def test_no_overlap_partitions_text_exactly():
    text = "abcdefghij"  # 10 chars
    chunks = chunk_text(text, chunk_size=4, overlap=0)
    assert [c.text for c in chunks] == ["abcd", "efgh", "ij"]
    assert [(c.start, c.end) for c in chunks] == [(0, 4), (4, 8), (8, 10)]


def test_overlap_shares_characters_between_consecutive_chunks():
    text = "abcdefghij"  # 10 chars
    chunks = chunk_text(text, chunk_size=5, overlap=2)
    # step = 3; loop terminates once a window reaches the end (no tiny tail)
    assert [(c.start, c.end) for c in chunks] == [(0, 5), (3, 8), (6, 10)]
    # consecutive full-width windows share `overlap` chars
    assert chunks[0].text[-2:] == chunks[1].text[:2]
    assert chunks[1].text[-2:] == chunks[2].text[:2]


def test_no_tiny_tail_when_window_reaches_end():
    # Without the early-break, step=3 from start=9 would emit a 1-char chunk.
    text = "abcdefghij"
    chunks = chunk_text(text, chunk_size=5, overlap=2)
    assert chunks[-1].end == len(text)
    assert chunks[-1].chars > 1


def test_chunk_ids_are_sequential():
    chunks = chunk_text("a" * 50, chunk_size=10, overlap=2)
    assert [c.id for c in chunks] == list(range(len(chunks)))


def test_overlap_equal_to_chunk_size_raises():
    with pytest.raises(ValueError, match="overlap must be < chunk_size"):
        chunk_text("hello world", chunk_size=5, overlap=5)


def test_overlap_greater_than_chunk_size_raises():
    with pytest.raises(ValueError):
        chunk_text("hello world", chunk_size=5, overlap=10)


def test_negative_overlap_raises():
    with pytest.raises(ValueError, match="overlap must be >= 0"):
        chunk_text("hello", chunk_size=5, overlap=-1)


def test_zero_chunk_size_raises():
    with pytest.raises(ValueError, match="chunk_size must be >= 1"):
        chunk_text("hello", chunk_size=0, overlap=0)


def test_to_dict_shape():
    chunk = chunk_text("hello", chunk_size=10, overlap=0)[0]
    d = chunk.to_dict()
    assert d == {"id": 0, "text": "hello", "start": 0, "end": 5, "chars": 5}
