import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { MapSettings, DownloadProgress, AppStatus, Layer } from './types';
import { translations, TranslationKey } from './translations';
import { layerSources } from './sources';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import JSZip from 'jszip';


const TILE_SIZE = 256;

// --- Caching Logic ---
const TileCache = {
    db: null as IDBDatabase | null,
    init(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve();
                return;
            }
            const request = indexedDB.open('TileCacheDB', 1);
            request.onerror = () => reject("Error opening IndexedDB.");
            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                db.createObjectStore('tiles');
            };
        });
    },
    get(key: string): Promise<Blob | null> {
        return new Promise((resolve, reject) => {
            if (!this.db) { reject("DB not initialized"); return; }
            const transaction = this.db.transaction('tiles', 'readonly');
            const store = transaction.objectStore('tiles');
            const request = store.get(key);
            request.onerror = () => reject("Error reading from cache");
            request.onsuccess = () => resolve(request.result || null);
        });
    },
    set(key: string, value: Blob): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) { reject("DB not initialized"); return; }
            const transaction = this.db.transaction('tiles', 'readwrite');
            const store = transaction.objectStore('tiles');
            const request = store.put(value, key);
            request.onerror = () => reject("Error writing to cache");
            request.onsuccess = () => resolve();
        });
    },
    clear(): Promise<void> {
         return new Promise((resolve, reject) => {
            if (!this.db) { reject("DB not initialized"); return; }
            const transaction = this.db.transaction('tiles', 'readwrite');
            const store = transaction.objectStore('tiles');
            const request = store.clear();
            request.onerror = () => reject("Error clearing cache");
            request.onsuccess = () => resolve();
        });
    }
};


// --- Coordinate & Tile URL Logic ---

const lonLatToMercator = (lon: number, lat: number): { x: number, y: number } => {
    const x = lon * 20037508.34 / 180;
    let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    y = y * 20037508.34 / 180;
    return { x, y };
};

const tileToBbox = (x: number, y: number, zoom: number): string => {
    const n = Math.pow(2, zoom);
    const lon_min = (x / n) * 360 - 180;
    const lat_rad_max = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
    const lat_max = lat_rad_max * 180 / Math.PI;

    const lon_max = ((x + 1) / n) * 360 - 180;
    const lat_rad_min = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
    const lat_min = lat_rad_min * 180 / Math.PI;

    const mercator_min = lonLatToMercator(lon_min, lat_min);
    const mercator_max = lonLatToMercator(lon_max, lat_max);

    return `${mercator_min.x},${mercator_min.y},${mercator_max.x},${mercator_max.y}`;
};

const getTileUrl = (sourceId: string, zoom: number, x: number, y: number): string => {
    const source = layerSources.find(s => s.id === sourceId);
    if (!source) {
        console.error(`Source config not found for id: ${sourceId}`);
        return '';
    }

    // Handle max zoom by clamping to the source's maxZoom if it exists
    const effectiveZoom = source.maxZoom ? Math.min(zoom, source.maxZoom) : zoom;

    let url = source.urlPattern
        .replace('{z}', String(effectiveZoom))
        .replace('{x}', String(x))
        .replace('{y}', String(y));

    if (source.type === 'wms') {
        const bbox = tileToBbox(x, y, effectiveZoom);
        url = url.replace('{bbox}', bbox);
    }
    return url;
};


const PROXIES = [
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy/?quest=${url}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

const gpsToTile = (lat: number, lon: number, zoom: number): { x: number; y: number } => {
  const n = Math.pow(2, zoom);
  const xtile = Math.floor((lon + 180.0) / 360.0 * n);
  const ytile = Math.floor((1.0 - Math.log(Math.tan(lat * Math.PI / 180.0) + 1 / Math.cos(lat * Math.PI / 180.0)) / Math.PI) / 2.0 * n);
  return { x: xtile, y: ytile };
};

const gpsToFractionalTile = (lat: number, lon: number, zoom: number): { x: number; y: number } => {
  const n = Math.pow(2, zoom);
  const x = (lon + 180.0) / 360.0 * n;
  const y = (1.0 - Math.log(Math.tan(lat * Math.PI / 180.0) + 1 / Math.cos(lat * Math.PI / 180.0)) / Math.PI) / 2.0 * n;
  return { x, y };
};

const tileToGps = (x: number, y: number, zoom: number): { lat: number; lon: number } => {
    const n = Math.pow(2, zoom);
    const lon = (x / n) * 360.0 - 180.0;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const lat = latRad * 180.0 / Math.PI;
    return { lat, lon };
};

const metersPerPixel = (lat: number, zoom: number): number => {
    return (2 * Math.PI * 6378137 / TILE_SIZE) * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
};

// Fix: Define a specific type for individual tile data to avoid using `unknown` type with Object.entries.
interface TileInfo {
    blobUrl: string | null;
    blob: Blob | null;
    status: 'pending' | 'loading' | 'success' | 'failed';
    layerId: string;
    attempt: number;
}
interface TileData {
    [key: string]: TileInfo;
}

const stitchTilesToDataURL = async (
  allTileData: TileData,
  tileGrid: { x: number; y: number; key: string }[][],
  layers: Layer[],
  layerBlend: number,
  kmlData?: { paths: {lat: number, lon: number}[][], settings: { color: string, width: number, opacity: number }, cornerCoords: { bl: { lat: number, lon: number }, tr: { lat: number, lon: number } }, mapSettings: MapSettings }
): Promise<string> => {
    if (!tileGrid.length || !tileGrid[0].length) return '';

    const numX = tileGrid[0].length;
    const numY = tileGrid.length;
    const canvas = document.createElement('canvas');
    canvas.width = numX * TILE_SIZE;
    canvas.height = numY * TILE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const allBitmaps: { [key: string]: ImageBitmap } = {};
    for (const key in allTileData) {
        const data = allTileData[key];
        if (data.status === 'success' && data.blob) {
            allBitmaps[key] = await createImageBitmap(data.blob);
        }
    }

    for (const [index, layer] of layers.entries()) {
        const isTopLayer = index === layers.length - 1 && layers.length > 1;
        ctx.globalAlpha = isTopLayer ? layerBlend / 100 : 1.0;

        for (let y = 0; y < numY; y++) {
            for (let x = 0; x < numX; x++) {
                const tileInfo = tileGrid[y][x];
                const tileKey = `${tileInfo.key}-${layer.id}`;
                const bitmap = allBitmaps[tileKey];
                if (bitmap) {
                    ctx.drawImage(bitmap, x * TILE_SIZE, y * TILE_SIZE);
                }
            }
        }
    }
    
    Object.values(allBitmaps).forEach(bitmap => bitmap.close());

    ctx.globalAlpha = 1;

    if (kmlData && kmlData.paths) {
        const { paths, settings, cornerCoords, mapSettings } = kmlData;
        const { x: xMin, y: yMin } = gpsToFractionalTile(cornerCoords.tr.lat, cornerCoords.bl.lon, mapSettings.zoom);

        ctx.globalAlpha = settings.opacity;
        ctx.strokeStyle = settings.color;
        ctx.lineWidth = settings.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        paths.forEach(path => {
            ctx.beginPath();
            path.forEach((point, index) => {
                const fractional = gpsToFractionalTile(point.lat, point.lon, mapSettings.zoom);
                const px = (fractional.x - xMin) * TILE_SIZE;
                const py = (fractional.y - yMin) * TILE_SIZE;
                if (index === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            });
            ctx.stroke();
        });
        ctx.globalAlpha = 1.0;
    }
    
    return canvas.toDataURL('image/jpeg', 0.95);
};

const App: React.FC = () => {
    const [lang, setLang] = useState<'sk' | 'en'>('sk');
    const [mapSettings, setMapSettings] = useState<MapSettings>({
        lat: 48.62664,
        lon: 20.95258,
        zoom: 15,
        north: 501,
        south: 501,
        east: 501,
        west: 501,
        autoRetries: 3,
        maxConcurrency: 5,
    });
    const [layers, setLayers] = useState<Layer[]>([
        { id: 'l1', sourceId: 'zbgis_teren' },
    ]);
    const [layerBlend, setLayerBlend] = useState(100);
    const [status, setStatus] = useState<AppStatus>('idle');
    const [progress, setProgress] = useState<DownloadProgress>({ current: 0, total: 0, message: '' });
    const [tileData, setTileData] = useState<TileData>({});
    const [stitchedImageURL, setStitchedImageURL] = useState<string>('');
    const [debugLog, setDebugLog] = useState<string>('');
    const [kmlPaths, setKmlPaths] = useState<{lat: number, lon: number}[][] | null>(null);
    const [kmlFileName, setKmlFileName] = useState<string>('');
    const [kmlSettings, setKmlSettings] = useState({ color: '#ff0000', width: 2, opacity: 1 });
    const [isReStitching, setIsReStitching] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(450);
    const isResizing = useRef(false);

    const imageRef = useRef<HTMLImageElement>(null);
    const isInitialSuccessRender = useRef(true);
    
    useEffect(() => {
        TileCache.init().catch(console.error);
    }, []);

    const t = useCallback((key: TranslationKey, vars?: { [key: string]: string | number }) => {
        let text = translations[lang][key] || translations['en'][key];
        if (vars) {
            Object.entries(vars).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, String(v));
            });
        }
        return text;
    }, [lang]);

    const { tileGrid, totalTiles, calibrationString, finalWidth, finalHeight, cornerCoords, memoizedLog } = useMemo(() => {
        let log = `--- Calculation Start ---\n`;
        log += `Timestamp: ${new Date().toISOString()}\n\n`;
        log += `[Input Parameters]\n`;
        log += `Latitude: ${mapSettings.lat}\n`;
        log += `Longitude: ${mapSettings.lon}\n`;
        log += `Zoom: ${mapSettings.zoom}\n`;
        log += `North (m): ${mapSettings.north}\n`;
        log += `South (m): ${mapSettings.south}\n`;
        log += `East (m): ${mapSettings.east}\n`;
        log += `West (m): ${mapSettings.west}\n\n`;

        const fractionalTile = gpsToFractionalTile(mapSettings.lat, mapSettings.lon, mapSettings.zoom);
        log += `[Center Coordinate Conversion]\n`;
        log += `Fractional Tile (X, Y): ${fractionalTile.x.toFixed(6)}, ${fractionalTile.y.toFixed(6)}\n`;

        const mpp = metersPerPixel(mapSettings.lat, mapSettings.zoom);
        log += `Meters per Pixel at Latitude: ${mpp.toFixed(6)}\n`;
        
        const metersPerTile = mpp * TILE_SIZE;
        log += `Meters per Tile: ${metersPerTile.toFixed(2)}\n\n`;
        
        log += `[Tile Boundary Calculation]\n`;
        const tileE = Math.ceil(mapSettings.east / metersPerTile);
        const tileW = Math.ceil(mapSettings.west / metersPerTile);
        const tileN = Math.ceil(mapSettings.north / metersPerTile);
        const tileS = Math.ceil(mapSettings.south / metersPerTile);
        log += `Tiles East: ${tileE} (ceil(${mapSettings.east} / ${metersPerTile.toFixed(2)}))\n`;
        log += `Tiles West: ${tileW} (ceil(${mapSettings.west} / ${metersPerTile.toFixed(2)}))\n`;
        log += `Tiles North: ${tileN} (ceil(${mapSettings.north} / ${metersPerTile.toFixed(2)}))\n`;
        log += `Tiles South: ${tileS} (ceil(${mapSettings.south} / ${metersPerTile.toFixed(2)}))\n\n`;
        
        const centerTile = gpsToTile(mapSettings.lat, mapSettings.lon, mapSettings.zoom);
        
        const xMin = centerTile.x - tileW;
        const xMax = centerTile.x + tileE;
        const yMin = centerTile.y - tileN;
        const yMax = centerTile.y + tileS;

        log += `[Final Tile Range]\n`;
        log += `X Range: ${xMin} to ${xMax}\n`;
        log += `Y Range: ${yMin} to ${yMax}\n\n`;

        const grid: { x: number; y: number; key: string }[][] = [];
        for (let y = yMin; y <= yMax; y++) {
            const row: { x: number; y: number; key: string }[] = [];
            for (let x = xMin; x <= xMax; x++) {
                row.push({ x, y, key: `${x}-${y}` });
            }
            grid.push(row);
        }

        const numX = xMax - xMin + 1;
        const numY = yMax - yMin + 1;
        const width = numX * TILE_SIZE;
        const height = numY * TILE_SIZE;
        log += `[Output Dimensions]\n`;
        log += `Grid Size (WxH): ${numX} x ${numY} tiles\n`;
        log += `Pixel Dimensions (WxH): ${width} x ${height} px\n\n`;

        const bl = tileToGps(xMin, yMax + 1, mapSettings.zoom);
        const tr = tileToGps(xMax + 1, yMin, mapSettings.zoom);
        
        log += `[Calibration Coordinates]\n`;
        log += `Bottom-Left (Lat, Lon): ${bl.lat.toFixed(8)}, ${bl.lon.toFixed(8)} (from tile x:${xMin}, y:${yMax + 1})\n`;
        log += `Top-Right (Lat, Lon): ${tr.lat.toFixed(8)}, ${tr.lon.toFixed(8)} (from tile x:${xMax + 1}, y:${yMin})\n\n`;

        const calString = `[0 0 ${bl.lat.toFixed(8)} ${bl.lon.toFixed(8)} ${width} ${height} ${tr.lat.toFixed(8)} ${tr.lon.toFixed(8)}]`;
        log += `[Therion Calibration String]\n${calString}\n\n--- Calculation End ---`;
        
        return { tileGrid: grid, totalTiles: numX * numY, calibrationString: calString, finalWidth: width, finalHeight: height, cornerCoords: {bl, tr}, memoizedLog: log };
    }, [mapSettings]);

    useEffect(() => {
        if (status === 'downloading' || status === 'preview') {
            setDebugLog(memoizedLog);
        }
    }, [status, memoizedLog]);
    
    // Effect to flag when we first enter the success state
    useEffect(() => {
        if (status === 'success') {
            isInitialSuccessRender.current = true;
        }
    }, [status]);
    
    const triggerReStitch = useCallback(async (
        paths: {lat: number, lon: number}[][] | null,
        settings: { color: string, width: number, opacity: number }
    ) => {
        if (status !== 'success') return;

        setIsReStitching(true);
        try {
            const kmlData = (paths && cornerCoords) ? { paths, settings, cornerCoords, mapSettings } : undefined;
            const url = await stitchTilesToDataURL(tileData, tileGrid, layers, layerBlend, kmlData);
            setStitchedImageURL(url);
        } catch (error) {
            console.error("Failed to re-stitch with KML:", error);
        } finally {
            setIsReStitching(false);
        }
    }, [status, cornerCoords, mapSettings, tileData, tileGrid, layers, layerBlend]);
    
    // Effect to re-stitch when KML settings change
    useEffect(() => {
        const reStitchOnSettingsChange = async () => {
            if (status !== 'success' || isInitialSuccessRender.current) {
                isInitialSuccessRender.current = false;
                return;
            }
            await triggerReStitch(kmlPaths, kmlSettings);
        };
        reStitchOnSettingsChange();
    }, [kmlSettings, triggerReStitch]);


    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setMapSettings(prev => ({
            ...prev,
            [name]: name === 'zoom' ? parseInt(value, 10) : parseFloat(value) || 0,
        }));
    };
    
    const downloadTile = useCallback(async (x: number, y: number, layer: Layer, attempt = 1, proxyIndex = -1): Promise<Blob> => {
        const cacheKey = `${layer.sourceId}_${mapSettings.zoom}_${x}_${y}`;
        const cached = await TileCache.get(cacheKey);
        if (cached) return cached;

        const originalUrl = getTileUrl(layer.sourceId, mapSettings.zoom, x, y);
        let url = originalUrl;
        
        if (proxyIndex > -1) {
            url = PROXIES[proxyIndex](originalUrl);
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const blob = await response.blob();
            if (blob.type.startsWith('image/')) {
                await TileCache.set(cacheKey, blob);
                return blob;
            }
            throw new Error('Invalid image content type');
        } catch (error) {
            const nextProxyIndex = proxyIndex + 1;
            if (nextProxyIndex < PROXIES.length) {
                return downloadTile(x, y, layer, attempt, nextProxyIndex);
            }
            if (attempt < mapSettings.autoRetries) {
                return downloadTile(x, y, layer, attempt + 1, -1);
            }
            throw error;
        }
    }, [mapSettings.zoom, mapSettings.autoRetries]);

    const handleGenerateMap = useCallback(async () => {
        setStatus('downloading');
        setProgress({ current: 0, total: totalTiles * layers.length, message: t('downloadingInitial') });
        
        const initialTileData: TileData = {};
        for (const layer of layers) {
             tileGrid.flat().forEach(tile => {
                const key = `${tile.key}-${layer.id}`;
                initialTileData[key] = { blobUrl: null, blob: null, status: 'pending', layerId: layer.id, attempt: 1 };
             });
        }
        setTileData(initialTileData);

        const downloadQueue = layers.flatMap(layer => tileGrid.flat().map(tile => ({ ...tile, layer })));
        
        let completed = 0;
        const totalToDownload = downloadQueue.length;

        const worker = async () => {
            while (downloadQueue.length > 0) {
                const tileJob = downloadQueue.shift();
                if (!tileJob) continue;
                
                const { x, y, key, layer } = tileJob;
                const tileKey = `${key}-${layer.id}`;
                
                setTileData(prev => ({ ...prev, [tileKey]: { ...prev[tileKey], status: 'loading' } }));
                try {
                    const blob = await downloadTile(x, y, layer);
                    const blobUrl = URL.createObjectURL(blob);
                    setTileData(prev => ({ ...prev, [tileKey]: { ...prev[tileKey], status: 'success', blob, blobUrl } }));
                } catch (e) {
                    console.error(`Failed to download tile ${x}, ${y} for layer ${layer.sourceId}:`, e);
                    setTileData(prev => ({ ...prev, [tileKey]: { ...prev[tileKey], status: 'failed' } }));
                } finally {
                    completed++;
                    setProgress({ current: completed, total: totalToDownload, message: t('downloadingInitial') });
                }
            }
        };

        const workers = Array(mapSettings.maxConcurrency).fill(null).map(worker);
        await Promise.all(workers);

        setStatus('preview');
    }, [totalTiles, tileGrid, layers, downloadTile, mapSettings.maxConcurrency, t]);

    const handleStitchAndDownload = useCallback(async () => {
        setStatus('stitching');
        setProgress({ current: 0, total: 1, message: t('stitching') });
        
        const kmlData = (kmlPaths && cornerCoords) ? { paths: kmlPaths, settings: kmlSettings, cornerCoords, mapSettings } : undefined;

        const url = await stitchTilesToDataURL(tileData, tileGrid, layers, layerBlend, kmlData);
        setStitchedImageURL(url);
        setStatus('success');
    }, [tileData, tileGrid, layers, t, layerBlend, kmlPaths, kmlSettings, cornerCoords, mapSettings]);
    
    const handleDownloadLog = () => {
        const blob = new Blob([debugLog], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'debug_log.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const addLayer = () => {
        const newLayer: Layer = { id: `l${Date.now()}`, sourceId: 'zbgis_teren' };
        setLayers(prev => {
            if (prev.length >= 1) {
                setLayerBlend(50);
            }
            return [...prev, newLayer];
        });
    };
    
    const handleClearCache = async () => {
        await TileCache.clear();
        alert(t('clearCacheSuccess'));
    };

    const handleStartOver = () => {
        setStatus('idle');
        setTileData({});
        setStitchedImageURL('');
        setKmlPaths(null);
        setKmlFileName('');
    };
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            let kmlText = '';
            if (file.name.endsWith('.kmz')) {
                const zip = await JSZip.loadAsync(file);
                const kmlFile: any = Object.values(zip.files).find((f: any) => f.name.endsWith('.kml'));
                if (!kmlFile) {
                    alert(t('kmzErrorNoKml'));
                    return;
                }
                kmlText = await kmlFile.async('string');
            } else if (file.name.endsWith('.kml')) {
                kmlText = await file.text();
            } else {
                return;
            }

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(kmlText, 'application/xml');
            const coordinatesNodes = xmlDoc.querySelectorAll('LineString coordinates');
            if (coordinatesNodes.length === 0) {
                alert(t('kmlError'));
                return;
            }

            const allPaths = Array.from(coordinatesNodes).map(node => {
                const coordsText = node.textContent?.trim() || '';
                const points = coordsText.split(/\s+/);
                return points.map(p => {
                    const [lon, lat] = p.split(',').map(parseFloat);
                    return { lat, lon };
                }).filter(p => !isNaN(p.lat) && !isNaN(p.lon));
            }).filter(path => path.length > 1);

            setKmlPaths(allPaths);
            setKmlFileName(file.name);

            if (status === 'success') {
                triggerReStitch(allPaths, kmlSettings);
            }

        } catch (error) {
            console.error(error);
            alert(t('kmzError'));
        }
    };
    
    const handleRemoveKml = () => {
        const newPaths = null;
        setKmlPaths(newPaths);
        setKmlFileName('');
        const input = document.getElementById('kml-upload') as HTMLInputElement;
        if (input) input.value = '';

        if (status === 'success') {
            triggerReStitch(newPaths, kmlSettings);
        }
    };


    const failedTiles = useMemo(() => (Object.entries(tileData) as [string, TileInfo][]).filter(([, data]) => data.status === 'failed'), [tileData]);
    const successfulTiles = useMemo(() => (Object.entries(tileData) as [string, TileInfo][]).filter(([, data]) => data.status === 'success').length, [tileData]);
    
    const kmlPreviewOverlay = useMemo(() => {
        if (!kmlPaths || !tileGrid.length || !tileGrid[0].length || !cornerCoords) return null;
        
        const { x: xMin, y: yMin } = gpsToFractionalTile(cornerCoords.tr.lat, cornerCoords.bl.lon, mapSettings.zoom);
        
        return (
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: layers.length + 1}}>
                {kmlPaths.map((path, i) => (
                    <polyline
                        key={i}
                        points={path.map(p => {
                             const fractional = gpsToFractionalTile(p.lat, p.lon, mapSettings.zoom);
                             const px = ((fractional.x - xMin) * TILE_SIZE / finalWidth) * 100;
                             const py = ((fractional.y - yMin) * TILE_SIZE / finalHeight) * 100;
                             return `${px}%,${py}%`;
                        }).join(' ')}
                        fill="none"
                        stroke={kmlSettings.color}
                        strokeWidth={kmlSettings.width}
                        strokeOpacity={kmlSettings.opacity}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                ))}
            </svg>
        );
    }, [kmlPaths, tileGrid, cornerCoords, mapSettings.zoom, finalWidth, finalHeight, kmlSettings, layers.length]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing.current) return;
        setSidebarWidth(prevWidth => {
            const newWidth = e.clientX;
            if (newWidth >= 350 && newWidth <= 800) {
                return newWidth;
            }
            return prevWidth;
        });
    }, []);

    const handleMouseUp = useCallback(() => {
        isResizing.current = false;
        document.body.style.cursor = 'default';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);


    const renderSettings = () => (
        <div className="w-full bg-gray-950 p-4 space-y-6 overflow-y-auto h-full flex flex-col">
            <div>
                <h1 className="text-2xl font-bold">{t('title')}</h1>
                <p className="text-sm text-gray-400">{t('subtitle')}</p>
            </div>

            <div className="flex-grow space-y-6">
                {/* Language Selector */}
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">{t('language')}</label>
                    <select value={lang} onChange={e => setLang(e.target.value as 'sk' | 'en')} className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm">
                        <option value="sk">Slovenčina</option>
                        <option value="en">English</option>
                    </select>
                </div>
                
                {/* Config Section */}
                <div className="bg-gray-850 p-4 rounded-lg space-y-4">
                    <h2 className="text-lg font-semibold">{t('configTitle')}</h2>
                    
                    {/* Base Params */}
                    <details open>
                        <summary className="font-semibold cursor-pointer">{t('baseParams')}</summary>
                        <div className="space-y-2 mt-2">
                            <div>
                                <label className="text-sm block">{t('caveEntranceLat')}</label>
                                <input type="number" name="lat" value={mapSettings.lat} onChange={handleSettingsChange} className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm"/>
                            </div>
                            <div>
                                <label className="text-sm block">{t('caveEntranceLon')}</label>
                                <input type="number" name="lon" value={mapSettings.lon} onChange={handleSettingsChange} className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm"/>
                            </div>
                            <div>
                                <label className="text-sm block">{t('zoomLevel')}</label>
                                <input type="range" name="zoom" min="1" max="19" value={mapSettings.zoom} onChange={handleSettingsChange} className="w-full"/>
                                <span className="text-center block text-sm">{mapSettings.zoom}</span>
                            </div>
                        </div>
                    </details>
                    
                    {/* Area Definition */}
                    <details open>
                        <summary className="font-semibold cursor-pointer">{t('defineArea')}</summary>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                             {['north', 'south', 'east', 'west'].map(dir => (
                                <div key={dir}>
                                    <label className="text-sm block">{t(dir as TranslationKey)}</label>
                                    <input type="number" name={dir} value={mapSettings[dir as keyof MapSettings]} onChange={handleSettingsChange} className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm"/>
                                </div>
                            ))}
                        </div>
                    </details>
                    
                     {/* Layers */}
                    <details open>
                        <summary className="font-semibold cursor-pointer">{t('layersTitle')}</summary>
                         <div className="space-y-3 mt-2">
                           {layers.map((layer, index) => (
                               <div key={layer.id} className="bg-gray-900 p-2 rounded-md">
                                  <div className="flex items-center justify-between">
                                      <select
                                        value={layer.sourceId}
                                        onChange={(e) => {
                                            const newLayers = [...layers];
                                            newLayers[index].sourceId = e.target.value;
                                            setLayers(newLayers);
                                        }}
                                        className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm"
                                       >
                                         {layerSources.map(source => (
                                             <option key={source.id} value={source.id}>{t(source.nameKey as TranslationKey)}</option>
                                         ))}
                                      </select>
                                      {layers.length > 1 && (
                                        <button onClick={() => setLayers(layers.filter(l => l.id !== layer.id))} className="text-red-500 hover:text-red-400 text-xl font-bold">&times;</button>
                                      )}
                                  </div>
                               </div>
                           ))}
                            {layers.length > 1 && (
                                <div className="pt-2">
                                    <label className="text-xs">{t('layerBlend')}: {layerBlend}%</label>
                                    <input type="range" min="0" max="100" value={layerBlend} onChange={(e) => setLayerBlend(parseInt(e.target.value, 10))} className="w-full" />
                                </div>
                            )}
                            <button onClick={addLayer} className="w-full text-sm py-1 bg-blue-600 hover:bg-blue-500 rounded-md">{t('addLayer')}</button>
                         </div>
                    </details>

                    {/* KML/KMZ Upload */}
                    {status === 'success' && (
                        <details>
                            <summary className="font-semibold cursor-pointer">{t('kmlSettings')}</summary>
                            <div className="space-y-2 mt-2">
                               <input type="file" id="kml-upload" accept=".kml,.kmz" onChange={handleFileChange} className="hidden" />
                               <label htmlFor="kml-upload" className="w-full text-center block text-sm py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer">{t('uploadModel')}</label>
                               {kmlFileName && (
                                   <div className="text-xs text-gray-300">
                                       <div className="text-center py-1">
                                        <span>{kmlFileName}</span>
                                        <button onClick={handleRemoveKml} className="ml-2 text-red-500 hover:text-red-400">[ {t('removeKml')} ]</button>
                                       </div>
                                       <div className="space-y-2 mt-2 pt-2 border-t border-gray-700">
                                            <div className="flex items-center justify-between">
                                                <label htmlFor="kml-color" className="text-sm">{t('kmlColor')}</label>
                                                <input 
                                                    id="kml-color" 
                                                    type="color" 
                                                    value={kmlSettings.color} 
                                                    onChange={(e) => setKmlSettings(p => ({ ...p, color: e.target.value }))}
                                                    className="w-10 h-6 p-0 border-none rounded bg-gray-800 cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm block">{t('kmlOpacity')}: {Math.round(kmlSettings.opacity * 100)}%</label>
                                                <input 
                                                    type="range" 
                                                    min="0" 
                                                    max="1" 
                                                    step="0.01" 
                                                    value={kmlSettings.opacity}
                                                    onChange={(e) => setKmlSettings(p => ({ ...p, opacity: parseFloat(e.target.value) }))}
                                                    className="w-full"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm block">{t('kmlWidth')}: {kmlSettings.width}px</label>
                                                <input 
                                                    type="range" 
                                                    min="0.5" 
                                                    max="10" 
                                                    step="0.5" 
                                                    value={kmlSettings.width}
                                                    onChange={(e) => setKmlSettings(p => ({ ...p, width: parseFloat(e.target.value) }))}
                                                    className="w-full"
                                                />
                                            </div>
                                        </div>
                                   </div>
                               )}
                            </div>
                        </details>
                    )}
                    
                    {/* Advanced Params */}
                    <details>
                        <summary className="font-semibold cursor-pointer">{t('advancedParams')}</summary>
                        <div className="space-y-2 mt-2">
                            <div>
                                <label className="text-sm block">{t('autoRetries')}</label>
                                <input type="number" name="autoRetries" value={mapSettings.autoRetries} onChange={handleSettingsChange} className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm"/>
                            </div>
                            <div>
                                <label className="text-sm block">{t('maxConcurrency')}</label>
                                <input type="number" name="maxConcurrency" value={mapSettings.maxConcurrency} onChange={handleSettingsChange} className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm"/>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2">
                                <button onClick={handleClearCache} className="w-full text-sm py-1 bg-yellow-600 hover:bg-yellow-500 rounded-md">{t('clearCache')}</button>
                                <button onClick={handleDownloadLog} className="w-full text-sm py-1 bg-gray-600 hover:bg-gray-500 rounded-md">{t('downloadLog')}</button>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
            
            <div className="space-y-2 text-sm bg-gray-850 p-4 rounded-lg">
                <div className="flex justify-between"><span>{t('totalTiles')}</span> <span>{totalTiles} ({t('grid')} {tileGrid[0]?.length || 0}x{tileGrid.length || 0})</span></div>
            </div>
            
            <button onClick={handleGenerateMap} disabled={status !== 'idle' && status !== 'preview' && status !== 'success'} className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold disabled:bg-gray-600 disabled:cursor-not-allowed">
                {status === 'downloading' ? t('processing') : t('generateMap')}
            </button>
        </div>
    );
    
    const renderContent = () => {
        switch(status) {
            case 'idle':
                return <div className="text-center"><h2 className="text-2xl font-bold">{t('idleTitle')}</h2><p className="text-gray-400">{t('idleSubtitle')}</p></div>;
            case 'downloading':
            case 'preview':
                 return (
                    <div className="w-full h-full flex flex-col p-4">
                        <div className="text-center mb-4">
                            <h2 className="text-xl font-bold">{t('tilePreviewTitle')}</h2>
                            <p className="text-sm text-gray-400">{t('tilePreviewSubtitle', { successful: successfulTiles, total: totalTiles * layers.length, failed: failedTiles.length })}</p>
                            {status === 'downloading' && (
                               <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                               </div>
                            )}
                        </div>
                        <div className="flex-grow overflow-auto bg-gray-950 p-2 rounded-lg">
                           <div className="relative w-full" style={{ aspectRatio: `${tileGrid[0]?.length || 1} / ${tileGrid.length || 1}` }}>
                                {layers.map((layer, index) => {
                                    const isTopLayer = index === layers.length - 1 && layers.length > 1;
                                    return (
                                        <div
                                            key={layer.id}
                                            className="grid absolute inset-0"
                                            style={{
                                                gridTemplateColumns: `repeat(${tileGrid[0]?.length || 1}, 1fr)`,
                                                opacity: isTopLayer ? layerBlend / 100 : 1,
                                                zIndex: index
                                            }}
                                        >
                                            {tileGrid.flat().map(({ x, y, key }) => {
                                                const data = tileData[`${key}-${layer.id}`];
                                                const baseLayerData = tileData[`${key}-${layers[0].id}`];
                                                return (
                                                    <div key={key} className="relative aspect-square bg-gray-800">
                                                        {data?.status === 'success' && data.blobUrl && (
                                                            <img 
                                                                src={data.blobUrl} 
                                                                className="w-full h-full object-cover" 
                                                                alt={`Tile ${x}, ${y} Layer ${layer.sourceId}`} 
                                                            />
                                                        )}
                                                        {index === 0 && baseLayerData?.status === 'loading' && <div className="animate-pulse bg-gray-700/50 w-full h-full absolute inset-0"></div>}
                                                        {index === 0 && baseLayerData?.status === 'failed' && <div className="absolute inset-0 flex items-center justify-center text-white text-xs text-center p-1 bg-red-900/75">Failed</div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                                {kmlPreviewOverlay}
                            </div>
                        </div>
                        <div className="flex gap-4 mt-4">
                          <button onClick={handleStartOver} className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold">{t('startOver')}</button>
                          <button onClick={handleStitchAndDownload} disabled={status === 'downloading'} className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold disabled:bg-gray-600">{t('stitchAndDownload')}</button>
                        </div>
                    </div>
                );
            case 'stitching':
                return <div className="text-center"><h2 className="text-2xl font-bold">{t('stitching')}</h2></div>;
            case 'success':
                 return (
                    <div className="w-full h-full flex flex-col p-4 space-y-4">
                        <h2 className="text-xl font-bold text-center">{t('generatedMapTitle')}</h2>
                        <div className="flex-grow bg-gray-950 p-2 rounded-lg overflow-auto relative flex justify-center items-center">
                            {isReStitching && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                    <div className="text-white animate-pulse">{t('stitching')}</div>
                                </div>
                            )}
                            <img ref={imageRef} src={stitchedImageURL} alt="Stitched Map" className="max-w-full max-h-full block" />
                        </div>
                        <div className="bg-gray-850 p-3 rounded-lg text-sm space-y-2">
                             <h3 className="font-semibold">{t('coordsTitle')}</h3>
                             <p className="font-mono bg-gray-900 p-2 rounded-md break-all">{calibrationString}</p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={handleStartOver} className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold">{t('startOver')}</button>
                            <a href={stitchedImageURL} download="map.jpg" className="flex-1 text-center py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold">{t('downloadMap')}</a>
                        </div>
                    </div>
                 );
            default:
                return <div></div>;
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-screen bg-gray-900 text-white font-sans">
            <aside style={{ width: `${sidebarWidth}px` }} className="flex-shrink-0 h-full">
                {renderSettings()}
            </aside>
            <div
                onMouseDown={handleMouseDown}
                className="w-2 h-full cursor-col-resize bg-gray-800 hover:bg-blue-600 transition-colors duration-200 flex-shrink-0"
                aria-label="Resize sidebar"
                role="separator"
            />
            <main className="flex-grow flex items-center justify-center bg-gray-850/50 overflow-hidden">
                {renderContent()}
            </main>
        </div>
    );
};

export default App;