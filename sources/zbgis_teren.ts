import type { LayerConfig } from '../types';

export const zbgisTeren: LayerConfig = {
  id: 'zbgis_teren',
  nameKey: 'layerZbgisTeren',
  type: 'xyz',
  urlPattern: 'https://zbgis.skgeodesy.sk/zbgis/rest/services/LLS_DMR5/MapServer/tile/{z}/{y}/{x}?blankTile=false',
  maxZoom: 18,
};
