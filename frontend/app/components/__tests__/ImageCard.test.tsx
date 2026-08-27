import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ImageCard } from "../NawabActionsProvider";

// jsdom ships <dialog> without its modal behaviour, so showModal/close are
// stubbed to just flip the `open` attribute — enough to assert mount/unmount.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

const image = {
  title: "Hazratganj in the rain",
  imageUrl: "https://origin.example/full.jpg",
  thumbnailUrl: "https://cdn.example/thumb.jpg",
  link: "https://source.example/page",
};

describe("ImageCard", () => {
  afterEach(cleanup);

  it("opens the full-size view on click and closes it again", () => {
    render(<ImageCard image={image} cityColor="#b8864e" />);

    expect(document.querySelector("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /hazratganj/i }));

    const dialog = document.querySelector("dialog");
    expect(dialog).not.toBeNull();
    // The large view shows the image, its caption, and a way out to the source.
    expect(screen.getByRole("link", { name: /source/i })).toHaveAttribute("href", image.link);

    fireEvent.click(screen.getByRole("button", { name: /close image/i }));
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("does not navigate away — the card is no longer a link", () => {
    render(<ImageCard image={image} cityColor="#b8864e" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
