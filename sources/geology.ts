import type { LayerConfig } from '../types';

export const geology: LayerConfig = {
  id: 'geology',
  nameKey: 'layerGeology',
  type: 'wms',
  urlPattern: 'https://ags.geology.sk/arcgis/services/WebServices/GM50/MapServer/WMSServer?service=WMS&request=GetMap&layers=0%2C1%2C2&styles=&format=image%2Fjpeg&transparent=false&version=1.3.0&width=256&height=256&crs=EPSG%3A3857&bbox={bbox}',
};
