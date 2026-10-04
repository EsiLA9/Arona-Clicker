import { describe, expect, it } from "vitest";
import { GameplayBRouteRuntime } from "../src/runtime.js";
import { parkGraphRouteInput, parkGraphRouteNodes, parkGraphRouteViewContent } from "../src/content/park-graph-route.js";

describe("amusement-park graph route content", () => {
  it("defines a finite multi-area graph with loops, fallback exits, and item-gated shortcuts", () => {
    const runtime = new GameplayBRouteRuntime(parkGraphRouteInput);
    const view = runtime.getView();
    const areaNodeIds = parkGraphRouteViewContent.areas.flatMap((area) => area.nodeIds);

    expect(parkGraphRouteNodes).toHaveLength(13);
    expect(new Set(areaNodeIds).size).toBe(13);
    expect(view).toMatchObject({ currentNode: { id: "node-1", area: "地面园区" }, playerCost: 2,
      playerDeck: { hand: expect.arrayContaining([expect.objectContaining({ id: expect.any(String) })]) } });
    expect(parkGraphRouteNodes.find((node) => node.id === "node-4")?.exits?.map((exit) => exit.targetNodeId))
      .toContain("node-3");
    expect(parkGraphRouteNodes.find((node) => node.id === "node-7")?.exits?.map((exit) => exit.targetNodeId))
      .toContain("node-4");
    expect(parkGraphRouteNodes.find((node) => node.id === "node-8")?.exits?.find((exit) => exit.targetNodeId === "node-13")?.condition)
      .toMatchObject({ kind: "any" });
    expect(parkGraphRouteNodes.find((node) => node.id === "node-13")?.exits?.some((exit) => (exit.consumeItems?.length ?? 0) > 0))
      .toBe(true);
  });

  it("replays deterministically and exposes the route choice after scene completion", () => {
    const play = () => {
      const runtime = new GameplayBRouteRuntime(parkGraphRouteInput);
      expect(runtime.selectGlobalBehavior("briefing")).toEqual({ ok: true });
      runtime.click();
      expect(runtime.getView().availableExits.map((exit) => exit.id)).toEqual(["gate-to-corridor"]);
      runtime.chooseExit("gate-to-corridor");

      for (let batch = 0; batch < 2; batch += 1) {
        expect(runtime.selectGlobalBehavior("follow-tracks")).toEqual({ ok: true });
        runtime.click();
      }
      expect(runtime.getView()).toMatchObject({ awaitingExitChoice: true, currentNode: { id: "node-2" },
        availableExits: [{ id: "corridor-to-kiosk", targetNodeId: "node-3" }] });
      runtime.chooseExit("corridor-to-kiosk");

      expect(runtime.selectGlobalBehavior("check-broadcast")).toEqual({ ok: true });
      runtime.click();
      expect(runtime.getView().heldItems).toContain("staff-radio");
      runtime.chooseExit("kiosk-to-arcade");

      for (const actorId of runtime.getView().party.filter((member) => member.hp > 0).map((member) => member.id)) {
        expect(runtime.selectIndividualBehavior(actorId, "search-drawer")).toEqual({ ok: true });
      }
      const arcade = runtime.click();
      expect(arcade).toMatchObject({ awaitingExitChoice: true, currentNode: { id: "node-4" } });
      expect(arcade.availableExits.map((exit) => exit.targetNodeId)).toEqual(["node-7", "node-3"]);
      return arcade;
    };

    expect(play()).toEqual(play());
  });
});
