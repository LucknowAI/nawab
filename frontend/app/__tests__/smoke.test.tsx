import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("test harness smoke test", () => {
  it("renders a basic component", () => {
    render(<div>hello</div>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
