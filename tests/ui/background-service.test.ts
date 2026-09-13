// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { buildBackgroundView, renderBackground } from '../../src/ui/background-service';
import { OUTER_BACKGROUND_ID, renderOuterBackground, syncOuterBackground } from '../../src/ui/outer-background';

const pics = {
  urlOf: (ref?: string) => ref === 'base:overlay(pic):triangles' ? 'data:image/svg+xml;base64,triangles' : undefined,
  defOf: () => undefined,
};

const directPicFallback = {
  urlOf: () => undefined,
  defOf: (ref: string) => ref === 'base:background(pic):hoshino'
    ? { id: ref, src: '/assets/Hoshino.png' }
    : undefined,
};

describe('BackgroundService', () => {
  test('按声明顺序解析渐变、图片并夹紧透明度', () => {
    const view = buildBackgroundView([
      { kind: 'gradient', value: 'linear-gradient(135deg, #fff, #def)', opacity: 1.2 },
      { kind: 'image', value: 'base:overlay(pic):triangles', opacity: -1, blendMode: 'screen' },
    ], pics);
    expect(view.layers).toHaveLength(2);
    expect(view.layers[0].value).toContain('linear-gradient');
    expect(view.layers[1].value).toContain('data:image/svg+xml');
    expect(view.layers[1].opacity).toBe(0);
    expect(view.layers[1].blendMode).toBe('screen');
  });

  test('失效图片与非法 CSS 值回退，不生成危险样式', () => {
    const view = buildBackgroundView([
      { kind: 'image', value: 'missing' },
      { kind: 'gradient', value: 'url(javascript:alert(1))', position: 'center; color:red' },
    ], pics, { bg: '#eef5ff', bgAlt: '#fff' });
    expect(view.layers).toHaveLength(1);
    expect(view.layers[0].value).toContain('linear-gradient');
    expect(view.layers[0].position).toBe('center');
  });

  test('PicService 解析失败时保留直接 PicDef 资源', () => {
    const view = buildBackgroundView([
      { kind: 'image', value: 'base:background(pic):hoshino' },
    ], directPicFallback);
    expect(view.layers).toHaveLength(1);
    expect(view.layers[0].value).toBe('url(\"/assets/Hoshino.png\")');
  });

  test('渲染层默认不参与交互', () => {
    const html = renderBackground({ layers: [{
      kind: 'image', value: 'url(\"x\")', opacity: 0.4, position: 'center', size: 'cover',
      repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed',
    }] });
    expect(html).toContain('console-background-layer');
    expect(html).toContain('background:url(&quot;x&quot;)');
  });

  test('按低到高声明顺序绘制背景层，后层覆盖前层', () => {
    const html = renderBackground({ layers: [
      { kind: 'solid', value: '#123', opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' },
      { kind: 'solid', value: '#456', opacity: .8, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'screen', attachment: 'fixed' },
    ] });

    expect(html).toContain('z-index:1;background:#123');
    expect(html).toContain('z-index:2;background:#456');
  });

  test('背景层输出安全的缩放与旋转变换', () => {
    const view = buildBackgroundView([
      { kind: 'solid', value: '#fff', scale: 99, rotation: -30 },
    ], pics);
    expect(view.layers[0].scale).toBe(8);
    expect(view.layers[0].rotation).toBe(330);
    expect(renderBackground(view)).toContain('transform:scale(8) rotate(330deg)');
  });

  test('忽略系统颜色层时只过滤该层，保留其他背景层与顺序', () => {
    const view = buildBackgroundView([
      { id: 'system-color-background', kind: 'gradient', value: 'linear-gradient(#111,#222)' },
      { id: 'user', kind: 'solid', value: '#456' },
    ], pics, {}, true);
    const html = renderBackground(view);
    expect(html).not.toContain('#111');
    expect(html).toContain('background:#456');
  });

  test('enabled=false 保留在定义中但不生成绘制节点', () => {
    const view = buildBackgroundView([
      { id: 'hidden', kind: 'solid', value: '#111', enabled: false },
      { id: 'visible', kind: 'solid', value: '#456' },
    ], pics);
    expect(view.layers.map(layer => layer.id)).toEqual(['visible']);
    expect(renderBackground(view)).not.toContain('#111');
  });

  test('最外层背景宿主挂在 body 直系，不随 #app 页面重建', () => {
    document.body.innerHTML = '<div id="app"><div class="console-background"></div></div>';
    const view = buildBackgroundView([{ kind: 'solid', value: '#123' }], pics);

    syncOuterBackground(view);

    const outer = document.body.firstElementChild as HTMLElement;
    expect(outer.id).toBe(OUTER_BACKGROUND_ID);
    expect(outer.classList.contains('console-background')).toBe(true);
    expect(outer.parentElement).toBe(document.body);
    expect(document.querySelector('#app > .console-background')).toBeNull();
    expect(renderOuterBackground(view)).toContain('id="' + OUTER_BACKGROUND_ID + '"');

    syncOuterBackground(buildBackgroundView([{ kind: 'solid', value: '#456' }], pics));
    expect(document.querySelectorAll('body > #' + OUTER_BACKGROUND_ID)).toHaveLength(1);
    expect(document.querySelector<HTMLElement>('body > #' + OUTER_BACKGROUND_ID + ' [data-background-layer="0"]')?.getAttribute('style')).toContain('background:#456');
  });
});
