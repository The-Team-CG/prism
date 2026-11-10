/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SpotifyMusic } from "@prism/ui/spotify-music";

const playlist = "https://open.spotify.com/playlist/7w8goVzwvr1smmS5zMf4HI?si=example";
afterEach(cleanup);

describe("SpotifyMusic", () => {
  it("loads only when opened, survives dashboard content changes, and stops on close", () => {
    const { rerender, unmount } = render(<SpotifyMusic playlistUrl={playlist}><p>Dashboard one</p></SpotifyMusic>);
    expect(screen.queryByTitle("Spotify playlist")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Music" }));
    const iframe = screen.getByTitle("Spotify playlist");
    expect(iframe.getAttribute("src")).toBe("https://open.spotify.com/embed/playlist/7w8goVzwvr1smmS5zMf4HI");
    rerender(<SpotifyMusic playlistUrl={playlist}><p>Dashboard two</p></SpotifyMusic>);
    expect(screen.getByTitle("Spotify playlist")).toBe(iframe);
    screen.getByRole("button", { name: "Stop and close" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "Stop and close" }));
    expect(screen.queryByTitle("Spotify playlist")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Music" }));
    fireEvent.click(screen.getByRole("button", { name: "Music" }));
    expect(screen.getByTitle("Spotify playlist")).not.toBe(iframe);
    unmount();
    expect(screen.queryByTitle("Spotify playlist")).toBeNull();
  });

  it("does not load a player for missing or untrusted configuration", () => {
    const { rerender } = render(<SpotifyMusic><p>Dashboard</p></SpotifyMusic>);
    expect(screen.queryByRole("button", { name: "Music" })).toBeNull();
    rerender(<SpotifyMusic playlistUrl="https://example.com/playlist/7w8goVzwvr1smmS5zMf4HI"><p>Dashboard</p></SpotifyMusic>);
    expect(screen.queryByRole("button", { name: "Music" })).toBeNull();
    expect(screen.getByText("Dashboard")).toBeTruthy();
  });
});
