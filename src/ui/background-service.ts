import type { BackgroundLayerDef } from '../engine/types/theme';
import type { ThemeTokens } from '../engine/core/theme-runtime';
import type { PicQueryPort } from '../arona-clicker/contracts/pic-query';
import { isDirectUrl } from '../data-services/contracts/pic';

export interface BackgroundViewLayer {
  kind: BackgroundLayerDef['kind'];
  value: string;
  opacity: number;
  position: string;
  size: string;
  repeat: string;
  blendMode: string;
  attachment: string;
}

export interface BackgroundView {
  layers: readonly BackgroundViewLayer[];
}

const SAFE_VALUE = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient)\([^;<>]+\)|var\(--[a-z0-9-]+\))$/i;
const SAFE_POSITION = /^[a-z0-9% .-]+$/i;
const SAFE_SIZE = /^[a-z0-9% .-]+$/i;
const SAFE_REPEAT = /^(?:repeat|repeat-x|repeat-y|no-repeat|space|round)$/;
const SAFE_BLEND = /^(?:normal|multiply|screen|overlay|soft-light|hard-light|color-dodge|color-burn|darken|lighten)$/;

function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>\"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[character] ?? character));
}

function safeCss(value: string | undefined, pattern: RegExp, fallback: string): string {
  return value && pattern.test(value.trim()) ? value.trim() : fallback;
}

function resolveValue(layer: BackgroundLayerDef, pics: PicQueryPort): string | undefined {
  if (layer.kind === 'image') {
    const def = pics.defOf(layer.value);
    const url = pics.urlOf(layer.value) ?? (def && isDirectUrl(def.src) ? def.src : undefined);
    if (url) return 'url(\"' + url.replace(/\"/g, '%22') + '\")';
    return undefined;
  }
  return SAFE_VALUE.test(layer.value.trim()) ? layer.value.trim() : undefined;
}

export function buildBackgroundView(
  layers: readonly BackgroundLayerDef[] | undefined,
  pics: PicQueryPort,
  tokens: ThemeTokens = {},
): BackgroundView {
  const fallback = 'linear-gradient(135deg, ' + (tokens['bg'] ?? 'var(--canvas)') + ' 0%, ' + (tokens['bgAlt'] ?? 'var(--panel-light)') + ' 100%)';
  const resolved = (layers ?? []).flatMap(layer => {
    const value = resolveValue(layer, pics);
    if (!value) return [];
    return [{
      kind: layer.kind,
      value,
      opacity: Math.max(0, Math.min(1, layer.opacity ?? 1)),
      position: safeCss(layer.position, SAFE_POSITION, 'center'),
      size: safeCss(layer.size, SAFE_SIZE, 'cover'),
      repeat: safeCss(layer.repeat, SAFE_REPEAT, 'no-repeat'),
      blendMode: safeCss(layer.blendMode, SAFE_BLEND, 'normal'),
      attachment: layer.attachment ?? 'fixed',
    }];
  });
  return { layers: resolved.length > 0 ? resolved : [{
    kind: 'gradient', value: fallback, opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed',
  }] };
}

export function renderBackground(view: BackgroundView, className = 'console-background'): string {
  return '<div class=\"' + className + '\" aria-hidden=\"true\">' + view.layers.map((layer, index) =>
    '<div class=\"console-background-layer\" data-background-layer=\"' + index + '\" style=\"' + escapeHtmlAttribute('background:' + layer.value + ';opacity:' + layer.opacity + ';background-position:' + layer.position + ';background-size:' + layer.size + ';background-repeat:' + layer.repeat + ';background-blend-mode:' + layer.blendMode + ';background-attachment:' + layer.attachment) + '\"></div>',
  ).join('') + '</div>';
}
