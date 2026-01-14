import type { LayerConfig } from '../types';

// This configuration uses the S-JTSK coordinate system (EPSG:5514).
// The tile grid parameters (origin, resolutions) are specific to this projection.
export const gnOrtofoto: LayerConfig = {
  id: 'gn_ortofoto',
  nameKey: 'layerGnOrtofoto',
  type: 'xyz', // Treated as XYZ-like, but the placeholders are for WMTS TileMatrix/Col/Row
  urlPattern: 'https://mpt.svp.sk/server/rest/services/podkladove_mapy/orto_2023/MapServer/WMTS/?layer=podkladove_mapy_orto_2023&style=default&tilematrixset=default028mm&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fjpeg&TileMatrix={z}&TileCol={x}&TileRow={y}',
  crs: 'EPSG:5514',
  origin: [-904992, -1007504], // Top-left corner of the S-JTSK tile grid
  resolutions: [
    132291.84, 66145.92, 33072.96, 16536.48, 8268.24, 4134.12, 2067.06, 1033.53, 516.765, 258.3825, 129.19125, 64.595625, 32.2978125, 16.14890625, 8.074453125, 4.0372265625, 2.01861328125, 1.009306640625, 0.5046533203125, 0.25232666015625
  ],
  maxZoom: 19,
};