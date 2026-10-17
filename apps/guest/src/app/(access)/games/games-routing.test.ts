import { describe, expect, it } from "vitest";
import JoinGamePage from "./join/page";
import EventGameLobbyPage from "./events/[eventSlug]/page";
import EventGameSessionPage from "./session/[sessionId]/page";
import { EventGamePinJoinView } from "@/features/event-games/join/views/event-game-pin-join-view";
import { EventGameLobbyView } from "@/features/event-games/lobby/views/event-game-lobby-view";
import { EventGamePlayView } from "@/features/event-games/play/views/event-game-play-view";

describe("guest event-game routes", () => {
  it("routes PIN entry to the Active (Multiplayer) join view", async () => {
    const page = await JoinGamePage({ searchParams: Promise.resolve({ eventSlug: "summer-party" }) });

    expect(page.type).toBe(EventGamePinJoinView);
    expect(page.props.expectedEventSlug).toBe("summer-party");
  });

  it("passes the shareable lobby slug to its guest view", async () => {
    const page = await EventGameLobbyPage({ params: Promise.resolve({ eventSlug: "summer-party" }) });

    expect(page.type).toBe(EventGameLobbyView);
    expect(page.props.eventSlug).toBe("summer-party");
  });

  it("passes the current session ID to the anonymous play view", async () => {
    const page = await EventGameSessionPage({ params: Promise.resolve({ sessionId: "session-a1" }) });

    expect(page.type).toBe(EventGamePlayView);
    expect(page.props.sessionId).toBe("session-a1");
  });
});
