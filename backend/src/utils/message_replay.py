from __future__ import annotations


def messages_snapshot_to_events(messages: list[dict]) -> list[dict]:
    """
    Convert a stored pydantic-ai messages_snapshot into an ordered list of
    frontend-renderable events (same schema as the WebSocket stream, but
    only *_done variants — no deltas).

    Message structure (pydantic-ai after dataclasses.asdict):
      ModelRequest  {"kind": "request",  "parts": [...]}
      ModelResponse {"kind": "response", "parts": [...]}

    Part kinds in request:  "user-prompt", "tool-return", "system-prompt"
    Part kinds in response: "text", "thinking", "tool-call"
    """
    events: list[dict] = []

    for msg in messages:
        kind = msg.get("kind")

        if kind == "request":
            for part in msg.get("parts", []):
                pk = part.get("part_kind")

                if pk == "user-prompt":
                    events.append({"type": "user_message", "content": part.get("content", "")})

                elif pk == "tool-return":
                    tool_name = part.get("tool_name", "")
                    if tool_name == "ask_user":
                        raw = part.get("content", "")
                        content = raw if isinstance(raw, str) else str(raw)
                        events.append({"type": "user_answer", "content": content})
                    else:
                        raw = part.get("content", "")
                        content = raw if isinstance(raw, str) else str(raw)
                        events.append({
                            "type": "tool_result",
                            "tool_call_id": part.get("tool_call_id", ""),
                            "tool_name": tool_name,
                            "content": content,
                        })

        elif kind == "response":
            for part in msg.get("parts", []):
                pk = part.get("part_kind")

                if pk == "thinking":
                    events.append({"type": "thinking_done", "content": part.get("content", "")})

                elif pk == "text":
                    events.append({"type": "text_done", "content": part.get("content", "")})

                elif pk == "tool-call":
                    tool_name = part.get("tool_name", "")
                    args = part.get("args") or {}
                    if isinstance(args, str):
                        import json
                        try:
                            args = json.loads(args)
                        except Exception:
                            args = {"raw": args}
                    if tool_name == "ask_user":
                        events.append({
                            "type": "question",
                            "question": args.get("question", ""),
                        })
                    else:
                        events.append({
                            "type": "tool_call",
                            "tool_call_id": part.get("tool_call_id", ""),
                            "tool_name": tool_name,
                            "args": args,
                        })

    return events
