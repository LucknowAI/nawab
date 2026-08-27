from dataclasses import dataclass

from src.handlers.stream_events import (
    URL_RE,
    collect_image_lookup,
    drop_imageless_entries,
    map_pydantic_event,
    resolve_image_refs,
    strip_unverified_image_urls,
)


@dataclass
class _Part:
    content: str
    part_kind: str


@dataclass
class _PartStart:
    part: _Part
    event_kind: str = "part_start"


@dataclass
class _TextDelta:
    content_delta: str
    part_delta_kind: str = "text"


@dataclass
class _PartDelta:
    delta: _TextDelta
    event_kind: str = "part_delta"


@dataclass
class _ToolReturnPart:
    tool_name: str
    content: object
    tool_call_id: str = "call_1"


@dataclass
class _FunctionToolResultEvent:
    """Matches pydantic-ai 2.x's real shape: the return data lives on `.part`,
    not `.result` — an older/assumed attribute name that silently dropped
    every tool_result event (see map_pydantic_event)."""
    part: _ToolReturnPart
    event_kind: str = "function_tool_result"


def _stream(events):
    """Replay events through the mapper the way the websocket handler does."""
    collected: list[str] = []
    sent = []
    for event in events:
        mapped = map_pydantic_event(event, collected)
        if mapped is not None:
            sent.append(mapped)
    return sent, "".join(collected)


def test_part_start_content_is_not_dropped():
    """The model's first token arrives on the part, not as a delta — dropping it
    used to eat the opening character of every response."""
    sent, text = _stream([
        _PartStart(_Part("A", "text")),
        _PartDelta(_TextDelta("ashreef")),
        _PartDelta(_TextDelta(" rakhiye")),
    ])
    assert text == "Aashreef rakhiye"
    assert [e["delta"] for e in sent] == ["A", "ashreef", " rakhiye"]


def test_empty_part_start_emits_nothing():
    sent, text = _stream([_PartStart(_Part("", "text"))])
    assert sent == []
    assert text == ""


def test_thinking_part_start_is_not_counted_as_assistant_text():
    sent, text = _stream([_PartStart(_Part("hmm", "thinking"))])
    assert sent == [{"type": "thinking_delta", "delta": "hmm"}]
    assert text == ""


def test_non_string_part_start_content_is_ignored():
    """Tool-call parts reach part_start too, and their content isn't text."""
    sent, text = _stream([_PartStart(_Part({"args": 1}, "tool-call"))])  # type: ignore[arg-type]
    assert sent == []
    assert text == ""


def test_url_re_extracts_urls_from_a_python_repr_dict():
    """tool_result content is str(dict), not json.dumps — commas/quotes/braces
    from the repr must not leak into the extracted URL."""
    content = "{'thumbnailUrl': 'https://encrypted-tbn0.gstatic.com/images?q=1', 'title': 'x'}"
    assert URL_RE.findall(content) == ["https://encrypted-tbn0.gstatic.com/images?q=1"]


def teststrip_unverified_image_urls_drops_hallucinated_url():
    """A URL the model recalled from memory (never seen in a tool_result) gets
    nulled out; a URL that really came back from search survives."""
    known = {"https://encrypted-tbn0.gstatic.com/real.jpg"}
    args = {
        "places": [
            {
                "name": "Bara Imambara",
                "thumbnailUrl": None,
                "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/hallucinated.jpg",
            },
            {
                "name": "Rumi Darwaza",
                "thumbnailUrl": "https://encrypted-tbn0.gstatic.com/real.jpg",
            },
        ]
    }
    strip_unverified_image_urls(args, known)
    assert args["places"][0]["imageUrl"] is None
    assert args["places"][1]["thumbnailUrl"] == "https://encrypted-tbn0.gstatic.com/real.jpg"


def testdrop_imageless_entries_removes_dead_gallery_items():
    """After the whitelist strip nulls every URL, a showImages item carries
    nothing worth rendering — it should be dropped, not sent as a blank box."""
    args = {
        "images": [
            {"title": "Rumi Darwaza", "imageUrl": None},
            {"title": "Chikankari", "imageUrl": "https://real.cdn/kept.jpg"},
        ]
    }
    drop_imageless_entries(args)
    assert args["images"] == [{"title": "Chikankari", "imageUrl": "https://real.cdn/kept.jpg"}]


def testdrop_imageless_entries_empties_list_when_all_dead():
    args = {"images": [{"title": "a", "imageUrl": None}, {"title": "b", "imageUrl": None}]}
    drop_imageless_entries(args)
    assert args["images"] == []


def testcollect_image_lookup_parses_ids_from_tool_result_repr():
    """content is str(dict) from the actual google_images return value, as
    tagged by the google_images tool in src/agent/tools/search.py."""
    content = str({
        "status": 1,
        "data": {"images": [
            {"id": "abc123", "imageUrl": "https://real.cdn/1.jpg", "thumbnailUrl": "https://gstatic/1.jpg"},
            {"id": "def456", "imageUrl": "https://real.cdn/2.jpg", "thumbnailUrl": None},
        ]},
    })
    lookup: dict[str, dict] = {}
    collect_image_lookup(content, lookup)
    assert lookup["abc123"] == {"imageUrl": "https://real.cdn/1.jpg", "thumbnailUrl": "https://gstatic/1.jpg"}
    assert lookup["def456"] == {"imageUrl": "https://real.cdn/2.jpg", "thumbnailUrl": None}


def testcollect_image_lookup_ignores_garbage_content():
    lookup: dict[str, dict] = {}
    collect_image_lookup("not a python literal {", lookup)
    assert lookup == {}


def testresolve_image_refs_substitutes_real_url_for_known_id():
    lookup = {"abc123": {"imageUrl": "https://real.cdn/1.jpg", "thumbnailUrl": "https://gstatic/1.jpg"}}
    args = {"images": [{"title": "Bara Imambara", "id": "abc123"}]}
    resolve_image_refs(args, lookup)
    assert args["images"] == [{
        "title": "Bara Imambara",
        "imageUrl": "https://real.cdn/1.jpg",
        "thumbnailUrl": "https://gstatic/1.jpg",
    }]


def test_function_tool_result_maps_via_part_not_result_attribute():
    """Regression: pydantic-ai's FunctionToolResultEvent exposes the return
    data as `.part`, never `.result`. Reading only `.result` made every
    tool_result event map to None — no frame reached the frontend, and the
    image-url whitelist/lookup never got populated."""
    event = _FunctionToolResultEvent(
        part=_ToolReturnPart(tool_name="google_images", content={"data": {"images": []}})
    )
    mapped = map_pydantic_event(event, [])
    assert mapped == {
        "type": "tool_result",
        "tool_call_id": "call_1",
        "tool_name": "google_images",
        "content": "{'data': {'images': []}}",
    }


def testresolve_image_refs_nulls_out_unknown_or_invented_id():
    """The model naming an id it never actually saw (typo, or recalled from a
    prior turn) must resolve to nothing, not a stale or guessed URL."""
    args = {"images": [{"title": "Made Up Place", "id": "totally-invented"}]}
    resolve_image_refs(args, {})
    assert args["images"][0]["imageUrl"] is None
    assert args["images"][0]["thumbnailUrl"] is None
