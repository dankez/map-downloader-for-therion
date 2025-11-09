<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Freemap Tile Downloader for Therion

### 🇸🇰 Slovenský Popis Nižšie

## Description

This web application is a specialized tool for cavers and cartographers who use the [Therion](http://therion.speleo.sk/) cave surveying software. It allows users to download high-resolution map tiles from various sources (including Freemap.sk's premium layers), stitch them into a single seamless image, and generate the necessary calibration data for use in Therion projects. This eliminates the manual and tedious process of downloading and georeferencing map underlays.

## Key Features

- **Precise Area Selection:** Define your map area by setting a central GPS coordinate and specifying the distance in meters to the north, south, east, and west.
- **Variable Zoom Level:** Choose a zoom level from 1 to 18 to control the resolution and detail of your final map.
- **Multi-Layer Maps:** Combine multiple map sources into a single image. Supported layers include:
  - Freemap Shaded Relief
  - Old Shaded Relief
  - Geological Map of Slovakia
  - Orthophoto Map
- **Layer Blending:** When using multiple layers, you can adjust the opacity of the top layer for a combined visual effect.
- **KML/KMZ Overlay:** Upload your cave survey lines or GPS tracks as a `.kml` or `.kmz` file to overlay them directly onto the map. Customize the line color, width, and opacity.
- **Efficient Downloader:** Features concurrent downloads, automatic retries for failed tiles, and a persistent cache (using IndexedDB) to save time and bandwidth.
- **Live Preview:** See a grid of the downloaded tiles before you commit to the final stitch. Failed tiles are clearly marked.
- **Bilingual Interface:** Switch between English and Slovak.

## How to Use

1.  **Configure Map:** Enter the latitude and longitude for the center of your map (e.g., a cave entrance).
2.  **Define Area:** Specify the distance in meters from the center point for the North, South, East, and West boundaries.
3.  **Set Zoom:** Select the desired zoom level. A higher number means more detail but more tiles to download.
4.  **Select Layers:** Add one or more map layers. If you add more than one, you can blend them.
5.  **Generate:** Click "Generate Map". The application will start downloading the required tiles.
6.  **Preview:** Monitor the download progress in the preview window.
7.  **Stitch & Download:** Once all tiles are downloaded, click "Stitch & Download".
8.  **(Optional) Add KML:** After the map is generated, you can upload a KML/KMZ file to overlay it. The map will be re-stitched automatically.
9.  **Save Your Files:** Download the final `map.jpg` image and copy the provided calibration string.

## Output

- **`map.jpg`:** A single, high-resolution JPEG image of the stitched map.
- **Therion Calibration String:** A string of coordinates formatted for Therion. You can paste this directly into your Therion configuration file (`therion.thconfig`) to perfectly align your map. Example:
  ```
  source my_map.th2 -calibrate map.jpg [0 0 48.123456 20.123456 4096 3584 48.234567 20.234567]
  ```

---

## Popis (SK)

Táto webová aplikácia je špecializovaný nástroj pre jaskyniarov a kartografov, ktorí používajú softvér na spracovanie jaskynných máp [Therion](http://therion.speleo.sk/). Umožňuje sťahovať mapové dlaždice s vysokým rozlíšením z rôznych zdrojov (vrátane platených vrstiev Freemap.sk), spojiť ich do jedného celistvého obrázku a vygenerovať potrebné kalibračné údaje pre použitie v projektoch Therion. Týmto sa eliminuje manuálny a zdĺhavý proces sťahovania a georeferencovania mapových podkladov.

## Kľúčové Funkcie

- **Presný Výber Oblasti:** Definujte oblasť mapy zadaním centrálnej GPS súradnice a vzdialenosti v metroch na sever, juh, východ a západ.
- **Variabilná Úroveň Priblíženia:** Zvoľte úroveň priblíženia od 1 do 18 pre kontrolu rozlíšenia a detailov výslednej mapy.
- **Viacvrstvové Mapy:** Kombinujte viacero mapových zdrojov do jedného obrázku. Podporované vrstvy zahŕňajú:
  - Freemap Tienený Reliéf
  - Starý Tienený Reliéf
  - Geologická Mapa SR
  - Ortofoto Mapa
- **Prelínanie Vrstiev:** Pri použití viacerých vrstiev môžete upraviť priehľadnosť vrchnej vrstvy pre dosiahnutie kombinovaného vizuálneho efektu.
- **KML/KMZ Prekrytie:** Nahrajte polygóny jaskyne alebo GPS trasy ako súbor `.kml` alebo `.kmz` a prekryte ich priamo na mape. Prispôsobte farbu, hrúbku a priehľadnosť čiar.
- **Efektívne Sťahovanie:** Využíva súbežné sťahovanie, automatické opakovanie neúspešných pokusov a perzistentnú cache (pomocou IndexedDB) na šetrenie času a dát.
- **Živý Náhľad:** Sledujte mriežku sťahovaných dlaždíc predtým, ako vytvoríte finálny obraz. Neúspešné dlaždice sú jasne označené.
- **Dvojjazyčné Rozhranie:** Prepínajte medzi angličtinou a slovenčinou.

---

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1-GCL-AAKtXllOl1_JQICdXj7waZ9KEGo

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
