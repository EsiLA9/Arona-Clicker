import type { ChatTextEffectValue } from './chat-presentation';

export interface ChatFlowPort {
  clearAll(): void;
  clearAllTexts(): void;
  showText(id: string, options: ChatTextEffectValue): void;
  clearId(id: string): void;
  showOpeningTitle(title?: string): void;
}
