import hoshinoPicUrl from '../../data/Hoshino.png';
import type { PicDef } from '../../data-services/contracts/pic';

export { hoshinoPicUrl as hoshinoPic };

export const basePics: PicDef[] = [
  { id: 'base:avatar(pic):hoshino', src: hoshinoPicUrl, label: '星野头像' },
  { id: 'base:sticker(pic):hoshino_selfie', src: hoshinoPicUrl, label: '星野自拍' },
];
