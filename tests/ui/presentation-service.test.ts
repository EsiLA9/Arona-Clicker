import { describe, expect, test } from 'vitest';
import { buildPresentationView, renderPresentationRegion } from '../../src/ui/presentation-service';
import { DEFAULT_PANEL_OPACITY } from '../../src/ui/presentation-config';

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

  test('区域表现层按低到高声明顺序绘制', () => {
    const view = buildPresentationView({ layers: [
      { id: 'base', region: 'centerPanel', kind: 'solid', value: '#123' },
      { id: 'overlay', region: 'centerPanel', kind: 'solid', value: '#456' },
    ] }, pics);
    const html = renderPresentationRegion(view, 'centerPanel');

    expect(html).toContain('z-index:1;background:#123');
    expect(html).toContain('z-index:2;background:#456');
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
    expect(view.hasHost('toolbar.button')).toBe(true);
    expect(view.host('missing').layers).toHaveLength(0);
    expect(view.hasHost('missing')).toBe(false);
  });

  test('控件宿主保留自己的系统颜色层开关状态', () => {
    const view = buildPresentationView({
      hosts: [{ id: 'leftPanel', systemColorLayerIgnored: true, layers: [{ id: 'panel', kind: 'solid', value: '#fff' }] }],
    }, pics);
    expect(view.host('leftPanel').systemColorLayerIgnored).toBe(true);
  });

  test('控件宿主解析状态图层并保留状态顺序', () => {
    const view = buildPresentationView({ hosts: [{
      id: 'header.button',
      states: { active: {
        layers: [
          { id: 'base', kind: 'solid', value: '#fff' },
          { id: 'accent', kind: 'solid', value: '#acf' },
        ],
        layerOrder: ['accent', 'base'],
        systemColorLayerIgnored: true,
      } },
    }] }, pics);
    const active = view.host('header.button').states?.get('active');
    expect(active?.layers.map(layer => layer.id)).toEqual(['accent', 'base']);
    expect(active?.systemColorLayerIgnored).toBe(true);
  });

  test('控件宿主解析内嵌装饰线字段并夹取数值', () => {
    const view = buildPresentationView({ hosts: [{
      id: 'header.button',
      decoration: { color: 'var(--theme-node-active)', width: 99, inset: -4, opacity: 2, style: 'dotted' },
      states: { active: { decoration: { color: '#abc', width: 2 } } },
    }] }, pics);
    expect(view.host('header.button').decoration).toMatchObject({ color: 'var(--theme-node-active)', width: 12, inset: 0, opacity: 1, style: 'dotted' });
    expect(view.host('header.button').states?.get('active')?.decoration).toMatchObject({ color: '#abc', width: 2 });
  });

  test('控件宿主解析并继承圆角半径与 X 轴倾斜角', () => {
    const view = buildPresentationView({ hosts: [
      { id: 'leftPanel', cornerRadius: 12, skewXDeg: 4 },
      { id: 'leftPanel.area', shape: 'rounded-parallelogram' },
      { id: 'leftPanel.contacts', cornerRadius: 99, skewXDeg: -99 },
    ] }, pics);

    expect(view.host('leftPanel').cornerRadius).toBe(12);
    expect(view.host('leftPanel').skewXDeg).toBe(4);
    expect(view.shapeParametersForHost('leftPanel.area')).toEqual({ shape: 'rounded-parallelogram', cornerRadius: 12, skewXDeg: 4 });
    expect(view.shapeParametersForHost('leftPanel.contacts')).toEqual({ shape: undefined, cornerRadius: 64, skewXDeg: -30 });
  });

  test('未填写几何参数时使用统一默认值', () => {
    const view = buildPresentationView({ hosts: [{ id: 'card' }] }, pics);
    expect(view.shapeParametersForHost('card')).toEqual({ shape: undefined, cornerRadius: 8, skewXDeg: 0 });
  });

  test('控件宿主保留默认与四态文字颜色模式', () => {
    const view = buildPresentationView({ hosts: [{
      id: 'header.button',
      textColorMode: 'dark',
      states: {
        default: { textColorMode: 'light' },
        active: { textColorMode: 'dark' },
        inactive: { textColorMode: 'auto' },
        disabled: { textColorMode: 'light' },
      },
    }] }, pics);
    const host = view.host('header.button');
    expect(host.textColorMode).toBe('dark');
    expect(host.states?.get('default')?.textColorMode).toBe('light');
    expect(host.states?.get('active')?.textColorMode).toBe('dark');
    expect(host.states?.get('inactive')?.textColorMode).toBe('auto');
    expect(host.states?.get('disabled')?.textColorMode).toBe('light');
  });

  test('未配置面板透明度时使用默认值', () => {
    const view = buildPresentationView({}, pics);
    expect(view.panelOpacity('leftPanel')).toBe(DEFAULT_PANEL_OPACITY);
    expect(view.panelOpacity('centerPanel')).toBe(DEFAULT_PANEL_OPACITY);
    expect(view.panelOpacity('rightPanel')).toBe(DEFAULT_PANEL_OPACITY);
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
