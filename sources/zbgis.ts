import type { LayerConfig } from '../types';

export const zbgis: LayerConfig = {
  id: 'zbgis',
  nameKey: 'layerZbgis',
  type: 'xyz',
  urlPattern: 'https://zbgis.skgeodesy.sk/zbgis/rest/services/ZBGIS/MapServer/tile/{z}/{y}/{x}?blankTile=false',
};
