import type { LayerConfig } from '../types';

export const freemap: LayerConfig = {
  id: 'freemap',
  nameKey: 'layerFreemap',
  type: 'xyz',
  urlPattern: 'https://sk-hires-shading.tiles.freemap.sk/{z}/{x}/{y}.jpg',
};
