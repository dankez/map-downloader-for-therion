export interface MapSettings {
  lat: number;
  lon: number;
  altitude?: number;
  zoom: number;
  north: number;
  south: number;
  east: number;
  west: number;
  autoRetries: number;
  maxConcurrency: number;
}

export interface LayerConfig {
  id: string;
  nameKey: string; // Using string to avoid circular dependencies with translations.ts
  type: 'xyz' | 'wms';
  urlPattern: string;
  maxZoom?: number;
}

export interface Layer {
  id: string; // Unique ID for React key, e.g., 'l123'
  sourceId: string; // ID of the layer config, e.g., 'freemap'
}

export interface DownloadProgress {
  current: number;
  total: number;
  message: string;
}

export type AppStatus = 'idle' | 'detecting_altitude' | 'downloading' | 'preview' | 'stitching' | 'success' | 'error' | 'generating3d' | '3dview' | 'exporting_video';