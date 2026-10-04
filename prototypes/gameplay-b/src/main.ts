import "./style.css";
import { parkGraphRouteInput, parkGraphRouteNodes, parkGraphRouteViewContent } from "./content/park-graph-route.js";
import { GameplayBRouteRuntime } from "./runtime.js";
import { mountRouteGameView } from "./view.js";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing prototype mount point.");

const runtime = new GameplayBRouteRuntime(parkGraphRouteInput);
let currentView = runtime.getView();
const page = mountRouteGameView(root, currentView, (command) => {
  const outcome = command.kind === "ordinary" ? runtime.editPlayerAction(command.actorId, command.cardId, command.targetIds)
    : command.kind === "free-skill" ? runtime.editFreeSkillTargets(command.actorId, command.skillId, command.targetIds)
      : command.kind === "individual-behavior" ? runtime.selectIndividualBehavior(command.actorId, command.behaviorId)
        : command.kind === "global-behavior" ? runtime.selectGlobalBehavior(command.behaviorId, command.targetIds)
          : command.kind === "player-card" ? runtime.selectPlayerCard(command.cardId, command.targetIds)
            : command.kind === "unselect-player-card" ? runtime.unselectPlayerCard(command.cardId)
              : runtime.chooseExit(command.exitId);
  currentView = runtime.getView();
  return { outcome, view: currentView };
}, { nodes: parkGraphRouteNodes, areas: parkGraphRouteViewContent.areas, descriptions: parkGraphRouteViewContent.descriptions,
  itemNames: parkGraphRouteViewContent.items, title: parkGraphRouteViewContent.title,
  subtitle: "游园会停电巡查 · 分区路线 / 场景选择 / 玩家 Cost 与主动卡" });

page.advanceButton.addEventListener("click", () => {
  if (currentView.terminal) return;
  currentView = runtime.click();
  page.update(currentView);
});
