import type { LayerConfig } from '../types';

export const ortofoto: LayerConfig = {
  id: 'ortofoto',
  nameKey: 'layerOrtofoto',
  type: 'xyz',
  urlPattern: 'https://ortofoto.tiles.freemap.sk/{z}/{x}/{y}.jpg',
};
