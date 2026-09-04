import { describe, expect, test } from 'vitest';
import { buildPresentationView, renderPresentationRegion } from '../../src/ui/presentation-service';

const pics = {
  urlOf: (ref: string) => ref === 'hoshino' ? '/assets/hoshino.png' : ref === 'triangle' ? 'data:image/svg+xml;base64,triangle' : undefined,
  defOf: (ref: string) => ref === 'hoshino'
    ? { id: ref, src: '/assets/hoshino.png', alt: '星野' }
    : ref === 'triangle' ? { id: ref, src: 'data:image/svg+xml;base64,triangle', alt: '三角形' } : undefined,
};

describe('PresentationService', () => {
  test('按区域解析图片层，并支持组件/子组件相对定位', () => {
    const view = buildPresentationView({
      layers: [{ id: 'wash', region: 'centerPanel', kind: 'gradient', value: 'linear-gradient(#fff, #def)' }],
      components: [
        { id: 'parent', parent: 'centerPanel', asset: 'hoshino', anchor: 'bottom-right', size: { width: 80, unit: 'percent' } },
        { id: 'child', parent: 'parent', asset: 'triangle', anchor: 'top-left', offset: { x: 5, y: 6, unit: 'percent' } },
      ],
    }, pics);
    expect(view.region('centerPanel').layers).toHaveLength(1);
    expect(view.region('centerPanel').components.map(component => component.id)).toEqual(['parent', 'child']);
    const html = renderPresentationRegion(view, 'centerPanel');
    expect(html).toContain('data-presentation-component="parent"');
    expect(html).toContain('data-presentation-component="child"');
    expect(html.indexOf('child')).toBeGreaterThan(html.indexOf('parent'));
  });

  test('丢弃缺失资源、循环父级和不安全资源地址', () => {
    const unsafePics = {
      urlOf: (ref: string) => ref === 'bad' ? 'javascript:alert(1)' : undefined,
      defOf: (ref: string) => ({ id: ref, src: 'javascript:alert(1)' }),
    };
    const view = buildPresentationView({ components: [
      { id: 'a', parent: 'b', asset: 'bad', anchor: 'top-left' },
      { id: 'b', parent: 'a', asset: 'bad', anchor: 'top-left' },
    ] }, unsafePics);
    expect(view.region('centerPanel').components).toHaveLength(0);
    expect(view.asset('bad')).toBeUndefined();
  });

  test('属性值统一转义，表现层不把内容直接注入 HTML', () => {
    const view = buildPresentationView({ components: [
      { id: 'a&"', parent: 'centerPanel', asset: 'hoshino', anchor: 'center' },
    ] }, pics);
    const html = renderPresentationRegion(view, 'centerPanel');
    expect(html).toContain('data-presentation-component="a&amp;&quot;"');
    expect(html).not.toContain('<script');
  });

  test('控件宿主按宿主 ID解析背景层并遵守显式顺序', () => {
    const view = buildPresentationView({
      hosts: [{
        id: 'toolbar.button',
        parent: 'header',
        layers: [
          { id: 'base', kind: 'solid', value: '#ffffff' },
          { id: 'accent', kind: 'gradient', value: 'linear-gradient(#fff, #def)' },
        ],
        layerOrder: ['accent', 'base'],
        opacity: 0.65,
      }],
    }, pics);
    expect(view.host('toolbar.button').layers.map(layer => layer.id)).toEqual(['accent', 'base']);
    expect(view.host('toolbar.button').opacity).toBe(0.65);
    expect(view.host('missing').layers).toHaveLength(0);
  });

  test('表现层限制并输出缩放与旋转变换', () => {
    const view = buildPresentationView({
      layers: [{ id: 'transform', region: 'centerPanel', kind: 'solid', value: '#fff', scale: 99, rotation: -30 }],
    }, pics);
    const layer = view.region('centerPanel').layers[0];
    expect(layer.scale).toBe(8);
    expect(layer.rotation).toBe(330);
    expect(renderPresentationRegion(view, 'centerPanel')).toContain('transform:scale(8) rotate(330deg)');
  });
});
