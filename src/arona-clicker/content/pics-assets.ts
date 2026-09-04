import hoshinoPicUrl from '../../data/Hoshino.png';
import trianglesUrl from '../../data/background-triangles.svg';
import baTrianglesSvgUrl from '../../data/ba_triangles.svg';
import baTrianglesPngUrl from '../../data/ba_triangles.png';
import type { PicDef } from '../../data-services/contracts/pic';

export { hoshinoPicUrl as hoshinoPic };

export const basePics: PicDef[] = [
  { id: 'base:avatar(pic):hoshino', src: hoshinoPicUrl, label: '星野头像' },
  { id: 'base:sticker(pic):hoshino_selfie', src: hoshinoPicUrl, label: '星野自拍' },
  { id: 'base:background(pic):hoshino', src: hoshinoPicUrl, label: '场景背景示例' },
  { id: 'base:overlay(pic):triangles', src: trianglesUrl, label: '三角形装饰叠层' },
  { id: 'base:overlay(pic):ba_triangles_svg', src: baTrianglesSvgUrl, label: '蔚蓝档案白色三角形叠层（SVG）' },
  { id: 'base:overlay(pic):ba_triangles_png', src: baTrianglesPngUrl, label: '蔚蓝档案白色三角形叠层（PNG）' },
];
