import { describe, expect, test } from 'vitest';
import { buildBackgroundView, renderBackground } from '../../src/ui/background-service';

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

  test('背景层输出安全的缩放与旋转变换', () => {
    const view = buildBackgroundView([
      { kind: 'solid', value: '#fff', scale: 99, rotation: -30 },
    ], pics);
    expect(view.layers[0].scale).toBe(8);
    expect(view.layers[0].rotation).toBe(330);
    expect(renderBackground(view)).toContain('transform:scale(8) rotate(330deg)');
  });
});
