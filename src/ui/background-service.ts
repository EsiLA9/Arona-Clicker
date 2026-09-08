import type { BackgroundLayerDef, PresentationDecorationDef, PresentationDecorationStyle, PresentationShape } from '../engine/types/theme';
import type { ThemeTokens } from '../engine/core/theme-runtime';
import type { PicQueryPort } from '../arona-clicker/contracts/pic-query';
import { isDirectUrl } from '../data-services/contracts/pic';

export interface BackgroundViewLayer {
  id?: string;
  kind: BackgroundLayerDef['kind'];
  value: string;
  opacity: number;
  position: string;
  size: string;
  repeat: string;
  blendMode: string;
  attachment: string;
  scale?: number;
  rotation?: number;
}

export interface BackgroundDecorationView {
  color?: string;
  width?: number;
  inset?: number;
  opacity?: number;
  style?: PresentationDecorationStyle;
}

export interface BackgroundView {
  layers: readonly BackgroundViewLayer[];
  shape?: PresentationShape;
  cornerRadius?: number;
  skewXDeg?: number;
  decoration?: BackgroundDecorationView;
}

const SAFE_VALUE = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient)\([^;<>]+\)|var\(--[a-z0-9-]+\))$/i;
const SAFE_POSITION = /^[a-z0-9% .-]+$/i;
const SAFE_SIZE = /^[a-z0-9% .-]+$/i;
const SAFE_REPEAT = /^(?:repeat|repeat-x|repeat-y|no-repeat|space|round)$/;
const SAFE_BLEND = /^(?:normal|multiply|screen|overlay|soft-light|hard-light|color-dodge|color-burn|darken|lighten)$/;
const SAFE_DECORATION_COLOR = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([^;<>]+\)|var\(--[a-z0-9-]+\))$/i;

function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>\"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[character] ?? character));
}

function safeCss(value: string | undefined, pattern: RegExp, fallback: string): string {
  return value && pattern.test(value.trim()) ? value.trim() : fallback;
}

function resolveValue(layer: BackgroundLayerDef, pics: PicQueryPort): string | undefined {
  if (layer.kind === 'empty') return 'transparent';
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
      id: layer.id,
      kind: layer.kind,
      value,
      opacity: Math.max(0, Math.min(1, layer.opacity ?? 1)),
      position: safeCss(layer.position, SAFE_POSITION, 'center'),
      size: safeCss(layer.size, SAFE_SIZE, 'cover'),
      repeat: safeCss(layer.repeat, SAFE_REPEAT, 'no-repeat'),
      blendMode: safeCss(layer.blendMode, SAFE_BLEND, 'normal'),
      attachment: layer.attachment ?? 'fixed',
      scale: Math.max(0.05, Math.min(8, typeof layer.scale === 'number' && Number.isFinite(layer.scale) ? layer.scale : 1)),
      rotation: typeof layer.rotation === 'number' && Number.isFinite(layer.rotation) ? ((layer.rotation % 360) + 360) % 360 : 0,
    }];
  });
  return { layers: resolved.length > 0 ? resolved : [{
    kind: 'gradient', value: fallback, opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed', scale: 1, rotation: 0,
  }] };
}

export function buildBackgroundDecorationView(decoration: PresentationDecorationDef | undefined): BackgroundDecorationView | undefined {
  if (!decoration) return undefined;
  const view: BackgroundDecorationView = {};
  if (decoration.color && SAFE_DECORATION_COLOR.test(decoration.color.trim())) view.color = decoration.color.trim();
  if (typeof decoration.width === 'number' && Number.isFinite(decoration.width)) view.width = Math.max(0, Math.min(12, decoration.width));
  if (typeof decoration.inset === 'number' && Number.isFinite(decoration.inset)) view.inset = Math.max(0, Math.min(24, decoration.inset));
  if (typeof decoration.opacity === 'number' && Number.isFinite(decoration.opacity)) view.opacity = Math.max(0, Math.min(1, decoration.opacity));
  if (decoration.style === 'dashed' || decoration.style === 'dotted' || decoration.style === 'solid') view.style = decoration.style;
  return view;
}

export function renderBackground(view: BackgroundView, className = 'console-background', hoverView?: BackgroundView, id?: string): string {
  const idAttribute = id ? ' id="' + escapeHtmlAttribute(id) + '"' : '';
  const shape = view.shape ? ' data-presentation-shape=\"' + escapeHtmlAttribute(view.shape) + '\"' : '';
  const geometry = view.cornerRadius !== undefined || view.skewXDeg !== undefined
    ? ' data-presentation-geometry=\"custom\" style=\"' + escapeHtmlAttribute([
      view.cornerRadius !== undefined ? `--presentation-corner-radius:${view.cornerRadius}px` : '',
      view.skewXDeg !== undefined ? `--presentation-skew-x:${view.skewXDeg}deg` : '',
    ].filter(Boolean).join(';')) + '\"'
    : '';
  const renderLayers = (layers: readonly BackgroundViewLayer[], kind: 'base' | 'hover', zOffset = 0) => layers.map((layer, index) =>
    '<div class=\"console-background-layer' + (kind === 'hover' ? ' presentation-host-hover-layer' : '') + '\" data-background-layer=\"' + index + '\" data-presentation-layer-kind=\"' + kind + '\" style=\"' + escapeHtmlAttribute('z-index:' + (zOffset + index + 1) + ';background:' + layer.value + ';opacity:' + layer.opacity + ';background-position:' + layer.position + ';background-size:' + layer.size + ';background-repeat:' + layer.repeat + ';background-blend-mode:' + layer.blendMode + ';background-attachment:' + layer.attachment + ';transform:scale(' + (layer.scale ?? 1) + ') rotate(' + (layer.rotation ?? 0) + 'deg)') + '\"></div>',
  ).join('');
  const renderDecoration = (decoration: BackgroundDecorationView | undefined, kind: 'base' | 'hover') => decoration && className !== 'console-background'
    ? `<div class=\"presentation-host-decoration${kind === 'hover' ? ' presentation-host-hover-layer' : ''}\" data-presentation-layer-kind=\"${kind}\" style=\"${escapeHtmlAttribute(`--presentation-decoration-color:${decoration.color ?? 'var(--theme-node-line)'};--presentation-decoration-width:${decoration.width ?? 1}px;--presentation-decoration-inset:${decoration.inset ?? 0}px;--presentation-decoration-opacity:${decoration.opacity ?? 1};--presentation-decoration-style:${decoration.style ?? 'solid'}`)}\"></div>`
    : '';
  return '<div' + idAttribute + ' class=\"' + className + '\"' + shape + geometry + ' aria-hidden=\"true\">'
    + renderLayers(view.layers, 'base')
    + renderDecoration(view.decoration, 'base')
    + (hoverView ? renderLayers(hoverView.layers, 'hover', view.layers.length) + renderDecoration(hoverView.decoration, 'hover') : '')
    + '</div>';
}
