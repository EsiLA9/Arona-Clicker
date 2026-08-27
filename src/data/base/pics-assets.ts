// ============================================================
// data/base/pics-assets.ts — 默认数据包图片资产声明
// 本地图片经 Vite 资产导入为可访问 URL（dev / build 自动处理）。
// PicDef src 指向该 URL，getPicUrl 直接返回，无需 ImageStore。
// ============================================================

import hoshinoPicUrl from '../Hoshino.png';
import type { PicDef } from '../../engine/types';

export { hoshinoPicUrl as hoshinoPic };

export const basePics: PicDef[] = [
  { id: 'base:avatar(pic):hoshino', src: hoshinoPicUrl, label: '星野头像' },
  { id: 'base:sticker(pic):hoshino_selfie', src: hoshinoPicUrl, label: '星野自拍' },
];