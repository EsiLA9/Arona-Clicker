import { baseDatapack } from '../data/index';
import { GameInstance } from '../engine/game-instance';
import { UIController } from './controller';
import './styles.css';

const game = new GameInstance();
game.init([baseDatapack]);

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('UI root is missing');

const controller = new UIController(game, root);
controller.mount();

if (typeof window !== 'undefined') {
  (window as Window & { __game?: GameInstance; __ui?: UIController }).__game = game;
  (window as Window & { __game?: GameInstance; __ui?: UIController }).__ui = controller;
}
