"""Turn pydantic-ai stream events into the frontend's WebSocket events.

Also holds the image-URL guard: the model sometimes fills imageUrl/thumbnailUrl
on a display card from memory (a plausible-looking Wikimedia link, say) instead
of copying it from a real search result, and those URLs are frequently dead or
hotlink-blocked. Rather than trust the model, we whitelist every URL that
actually appeared in a tool_result this run and drop anything else.
"""

import ast
import re

URL_RE = re.compile(r"https?://[^\s'\"()\[\]{},]+")
IMAGE_URL_KEYS = ("imageUrl", "thumbnailUrl")

# Agent-status labels shown to the frontend while a tool runs
TOOL_LABELS = {
    "google_search": "Searching the web",
    "google_maps":   "Searching Google Maps",
    "google_news":   "Fetching latest news",
    "google_videos": "Finding videos",
    "google_images": "Searching for images",
}


def strip_unverified_image_urls(value, known_urls) -> None:
    """Drop imageUrl/thumbnailUrl fields whose value never showed up in a real
    tool_result this run. Mutates dicts/lists in place."""
    if isinstance(value, dict):
        for key, val in value.items():
            if key in IMAGE_URL_KEYS and isinstance(val, str) and val not in known_urls:
                value[key] = None
            else:
                strip_unverified_image_urls(val, known_urls)
    elif isinstance(value, list):
        for item in value:
            strip_unverified_image_urls(item, known_urls)


def collect_image_lookup(tool_result_content: str, lookup: dict) -> None:
    """Record id -> {imageUrl, thumbnailUrl} from a google_images result.

    google_images tags each result with a short `id` (see src/agent/tools/search.py).
    The tool_result content is str(dict), not JSON, hence literal_eval — safe here
    since it only ever accepts Python literals.
    """
    try:
        parsed = ast.literal_eval(tool_result_content)
    except (ValueError, SyntaxError):
        return
    images = ((parsed or {}).get("data") or {}).get("images")
    if not isinstance(images, list):
        return
    for img in images:
        if isinstance(img, dict) and img.get("id"):
            lookup[img["id"]] = {
                "imageUrl": img.get("imageUrl"),
                "thumbnailUrl": img.get("thumbnailUrl"),
            }


def resolve_image_refs(args: dict, lookup: dict) -> None:
    """Swap each showImages item's `id` for the real URLs it refers to.

    An id the model invented or misremembered resolves to nothing (both fields
    become None) rather than a plausible-but-dead URL.
    """
    images = args.get("images")
    if not isinstance(images, list):
        return
    for img in images:
        if not isinstance(img, dict):
            continue
        ref = img.pop("id", None) or img.pop("ref", None)
        resolved = lookup.get(ref) if ref else None
        img["imageUrl"] = resolved.get("imageUrl") if resolved else None
        img["thumbnailUrl"] = resolved.get("thumbnailUrl") if resolved else None


def drop_imageless_entries(args: dict) -> None:
    """Drop showImages items left with no URL after the whitelist strip.

    showImages exists only to show pictures; if none survive, the caller skips
    the whole card.
    """
    images = args.get("images")
    if isinstance(images, list):
        args["images"] = [
            img for img in images
            if isinstance(img, dict) and (img.get("imageUrl") or img.get("thumbnailUrl"))
        ]


def tool_status_event(tool_name: str, args: dict) -> dict | None:
    """Return a human-readable agent_status event for a tool call, or None."""
    label = TOOL_LABELS.get(tool_name)
    if not label:
        return None
    kws = args.get("keywords") or ([args.get("query")] if args.get("query") else [])
    detail = ", ".join(str(k) for k in kws) if kws else ""
    message = f"{label}: {detail}" if detail else label
    return {"type": "agent_status", "message": message}


def map_pydantic_event(event, assistant_text_parts: list) -> dict | None:
    """Map a pydantic-ai AgentStreamEvent to a frontend WebSocket event dict."""
    ek = event.event_kind

    if ek == "part_start":
        # The first chunk of a text/thinking part arrives on the part itself, not
        # as a delta — without this the response loses its opening characters.
        part = event.part
        pk = getattr(part, "part_kind", None)
        content = getattr(part, "content", "") or ""
        if not isinstance(content, str) or not content:
            return None
        if pk == "text":
            assistant_text_parts.append(content)
            return {"type": "text_delta", "delta": content}
        elif pk == "thinking":
            return {"type": "thinking_delta", "delta": content}

    elif ek == "part_delta":
        delta = event.delta
        pdk = getattr(delta, "part_delta_kind", None)
        cd = getattr(delta, "content_delta", None) or ""
        if pdk == "text" and cd:
            assistant_text_parts.append(cd)
            return {"type": "text_delta", "delta": cd}
        elif pdk == "thinking" and cd:
            return {"type": "thinking_delta", "delta": cd}

    elif ek == "part_end":
        part = event.part
        pk = getattr(part, "part_kind", None)
        if pk == "text":
            return {"type": "text_done", "content": getattr(part, "content", "") or ""}
        elif pk == "thinking":
            return {"type": "thinking_done", "content": getattr(part, "content", "") or ""}

    elif ek == "function_tool_call":
        part = getattr(event, "part", None) or getattr(event, "call", None)
        if part is None:
            return None
        args = {}
        if hasattr(part, "args_as_dict"):
            try:
                args = part.args_as_dict() or {}
            except Exception:
                args = {}
        elif hasattr(part, "args") and isinstance(part.args, dict):
            args = part.args
        return {
            "type": "tool_call",
            "tool_call_id": getattr(part, "tool_call_id", "") or "",
            "tool_name": getattr(part, "tool_name", "") or "",
            "args": args,
        }

    elif ek == "function_tool_result":
        # The return part lives on `.part` (pydantic-ai 2.x); older versions
        # exposed it as `.result`. Reading only `.result` silently dropped
        # every tool_result event — no frames to the frontend, and the image
        # whitelist/lookup never got populated.
        result = getattr(event, "part", None) or getattr(event, "result", None)
        if result is None:
            return None
        raw = getattr(result, "content", "") if hasattr(result, "content") else ""
        return {
            "type": "tool_result",
            "tool_call_id": getattr(result, "tool_call_id", "") or "",
            "tool_name": getattr(result, "tool_name", "") or "",
            "content": raw if isinstance(raw, str) else str(raw),
        }

    return None


def sanitize_tool_event(ws_event: dict, known_urls: set, image_lookup: dict) -> bool:
    """Apply the image guard to one mapped event. False means skip the event.

    tool_result events feed the whitelist and the id lookup; tool_call events
    are cleaned against them.
    """
    kind = ws_event["type"]
    if kind == "tool_result":
        known_urls.update(URL_RE.findall(ws_event["content"]))
        if ws_event["tool_name"] == "google_images":
            collect_image_lookup(ws_event["content"], image_lookup)
    elif kind == "tool_call":
        args = ws_event.get("args", {})
        if ws_event["tool_name"] == "showImages":
            resolve_image_refs(args, image_lookup)
            drop_imageless_entries(args)
            return bool(args.get("images"))  # nothing left worth showing
        strip_unverified_image_urls(args, known_urls)
    return True


if __name__ == "__main__":
    from dataclasses import dataclass

    @dataclass
    class _Part:
        content: str
        part_kind: str

    @dataclass
    class _PartStart:
        part: _Part
        event_kind: str = "part_start"

    parts = []
    assert map_pydantic_event(_PartStart(_Part("Aadaab", "text")), parts) == {
        "type": "text_delta", "delta": "Aadaab",
    }
    assert parts == ["Aadaab"]

    args = {"images": [{"id": "abc123"}, {"id": "nope"}]}
    resolve_image_refs(args, {"abc123": {"imageUrl": "https://x/1.jpg", "thumbnailUrl": None}})
    drop_imageless_entries(args)
    assert args["images"] == [{"imageUrl": "https://x/1.jpg", "thumbnailUrl": None}]
    print("ok — event mapping and image guard (full coverage in tests/test_ws_event_mapping.py)")
