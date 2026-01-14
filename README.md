# DankeZ Downloader (Freemap Tile Downloader)

Webová aplikácia na sťahovanie a spájanie mapových dlaždíc z rôznych zdrojov (Freemap.sk, ZBGIS, atď.) na základe GPS súradníc. Výsledkom je jeden obrázok vo formáte JPG, ktorý je presne geograficky skalibrovaný pre použitie v jaskyniarskom softvéri **Therion**, alebo ako podkladová mapa v mobilných aplikáciách **Locus Map** a **OruxMaps**.

---

## 🇸🇰 Slovenská verzia

### Kľúčové Vlastnosti

- **Výber Oblasti**: Definujte stredový bod (GPS súradnice) a rozsah oblasti v metroch (sever, juh, východ, západ).
- **Viacero Mapových Vrstiev**: Kombinujte rôzne mapové podklady ako tieňovaný reliéf, ortofoto mapy, geologické mapy alebo historické mapy.
- **Prelínanie Vrstiev**: Možnosť nastaviť priehľadnosť vrchnej vrstvy pre lepšiu vizualizáciu.
- **Kalibrácia pre Therion**: Automaticky generuje kalibračný reťazec pre jednoduchú integráciu do Therionu.
- **Export pre Mobilné Aplikácie**: Vytvára kalibrované mapové balíčky pre Locus Map (.kmz) a OruxMaps (.zip).
- **Vizualizácia KML/KMZ**: Nahrajte trasu alebo polygón jaskyne a zobrazte ho priamo na vygenerovanej mape.
- **Pokročilé Nastavenia**: Možnosť nastaviť počet súbežných sťahovaní a automatických opakovaní pri zlyhaní.
- **Cache dlaždíc**: Stiahnuté dlaždice sa ukladajú lokálne, čo zrýchľuje opakované generovanie mapy pre rovnakú oblasť.

### ✨ Novinky vo verzii 0.1

Táto verzia prináša zásadné vylepšenia v použiteľnosti a architektúre kódu.

#### Nové Funkcie
1.  **Export pre Locus Map a OruxMaps**: Aplikácia teraz dokáže vygenerovať plne kalibrované mapové balíčky, ktoré je možné priamo importovať do populárnych Android aplikácií Locus Map a OruxMaps. To umožňuje použitie vytvorených máp priamo v teréne.
2.  **Modulárne Mapové Zdroje**: Konfigurácia jednotlivých mapových vrstiev bola presunutá do samostatného adresára `sources/`. Každý zdroj je teraz definovaný v samostatnom súbore, čo výrazne zjednodušuje pridávanie nových mapových zdrojov alebo úpravu existujúcich.

#### Postrehy a Vylepšenia
- **Lepší používateľský zážitok (UX)**: Pridaním exportov pre mobilné aplikácie sa nástroj stáva užitočným nielen pre jaskyniarov používajúcich Therion, ale pre kohokoľvek, kto potrebuje kvalitné offline mapy v teréne. Používateľské rozhranie je teraz lepšie štruktúrované vďaka zbaliteľným sekciám, čo sprehľadňuje konfiguráciu.
- **Zlepšená architektúra a udržiavateľnosť kódu**: Oddelenie mapových zdrojov od hlavnej aplikačnej logiky je kľúčové vylepšenie. Umožňuje jednoduchú rozšíriteľnosť bez nutnosti zasahovať do hlavného komponentu `App.tsx`. Kód je čistejší a pripravený na budúci rozvoj.
- **Robustnosť a spoľahlivosť**: Mechanizmus sťahovania dlaždíc bol vylepšený o automatické opakovanie v prípade zlyhania a využíva viacero CORS proxy serverov. Aplikácia poskytuje jasnú spätnú väzbu o priebehu sťahovania a umožňuje manuálne opakovanie neúspešných pokusov.

---

## 🇬🇧 English version

### Freemap Tile Downloader

A web application to download and stitch map tiles from various sources (Freemap.sk, ZBGIS, etc.) based on GPS coordinates. The result is a single JPG image, precisely georeferenced for use in the caving software **Therion**, or as a basemap in mobile apps like **Locus Map** and **OruxMaps**.

### Key Features

- **Area Selection**: Define a center point (GPS coordinates) and the area extent in meters (north, south, east, west).
- **Multiple Map Layers**: Combine different map sources like shaded relief, orthophotos, geological maps, or historical maps.
- **Layer Blending**: Set the opacity of the top layer for better visualization.
- **Therion Calibration**: Automatically generates a calibration string for easy integration into Therion.
- **Mobile App Export**: Creates calibrated map packages for Locus Map (.kmz) and OruxMaps (.zip).
- **KML/KMZ Visualization**: Upload a cave trace or polygon and display it directly on the generated map.
- **Advanced Settings**: Configure the number of concurrent downloads and automatic retries on failure.
- **Tile Caching**: Downloaded tiles are stored locally, speeding up subsequent map generation for the same area.

### ✨ What's New in Version 0.1

This version introduces significant improvements in usability and code architecture.

#### New Features
1.  **Export for Locus Map and OruxMaps**: The application can now generate fully calibrated map packages that can be directly imported into the popular Android apps, Locus Map and OruxMaps. This allows the generated maps to be used directly in the field.
2.  **Modular Map Sources**: The configuration for individual map layers has been moved to a dedicated `sources/` directory. Each source is now defined in its own file, making it much easier to add new map sources or modify existing ones.

#### Insights and Improvements
- **Better User Experience (UX)**: Adding exports for mobile apps makes the tool useful not only for cavers using Therion but for anyone needing high-quality offline maps in the field. The UI is now better structured with collapsible sections, making the configuration process clearer.
- **Improved Architecture and Maintainability**: Separating map sources from the main application logic is a key architectural improvement. It allows for easy extensibility without touching the core `App.tsx` component. The code is cleaner and ready for future development.
- **Robustness and Reliability**: The tile downloading mechanism has been enhanced with an automatic retry feature and utilizes multiple CORS proxies. The application provides clear feedback on download progress and allows for manual retries of failed downloads.
