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

export interface Layer {
  id: string;
  type: 'freemap' | 'terrain2' | 'geology' | 'ortofoto';
}

export interface DownloadProgress {
  current: number;
  total: number;
  message: string;
}

export type AppStatus = 'idle' | 'detecting_altitude' | 'downloading' | 'preview' | 'stitching' | 'success' | 'error' | 'generating3d' | '3dview' | 'exporting_video';