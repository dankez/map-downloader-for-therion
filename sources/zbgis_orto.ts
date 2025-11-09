import type { LayerConfig } from '../types';

export const zbgisOrto: LayerConfig = {
  id: 'zbgis_orto',
  nameKey: 'layerZbgisOrto',
  type: 'xyz',
  urlPattern: 'https://zbgis.skgeodesy.sk/zbgis/rest/services/Ortofoto/MapServer/tile/{z}/{y}/{x}?blankTile=false',
  maxZoom: 19,
};
