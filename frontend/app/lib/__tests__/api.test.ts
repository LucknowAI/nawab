import { describe, expect, it } from "vitest";

import { errorMessage, unwrap } from "../api";

/**
 * The backend wraps every REST body in {success, status_code, message}.
 * Reading a response without unwrapping it is what broke loadHistory
 * ("events is not iterable"), so the contract is pinned here.
 */
function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

describe("unwrap", () => {
  it("returns the payload inside an envelope", async () => {
    const events = [{ type: "user_message" }, { type: "text_done" }];
    await expect(unwrap(jsonResponse({ success: true, status_code: 200, message: events })))
      .resolves.toEqual(events);
  });

  it("keeps an empty array iterable rather than returning the envelope", async () => {
    const out = await unwrap<unknown[]>(jsonResponse({ success: true, status_code: 200, message: [] }));
    expect(Array.isArray(out)).toBe(true);
  });

  it("passes through a body that is not an envelope", async () => {
    await expect(unwrap(jsonResponse({ token: "abc" }))).resolves.toEqual({ token: "abc" });
  });

  it("returns null when the body is not JSON", async () => {
    const broken = { json: async () => { throw new SyntaxError("not json"); } } as unknown as Response;
    await expect(unwrap(broken)).resolves.toBeNull();
  });
});

describe("errorMessage", () => {
  it("reads the message out of a StandardError", async () => {
    const res = jsonResponse({ success: false, status_code: 401, message: "Invalid or expired OTP" });
    await expect(errorMessage(res, "fallback")).resolves.toBe("Invalid or expired OTP");
  });

  it("falls back when the message is not a string", async () => {
    const res = jsonResponse({ success: false, status_code: 422, message: [{ loc: ["body"] }] });
    await expect(errorMessage(res, "Failed to submit")).resolves.toBe("Failed to submit");
  });
});
