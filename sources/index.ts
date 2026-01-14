import { freemap } from './freemap';
import { terrain2 } from './terrain2';
import { geology } from './geology';
import { ortofoto } from './ortofoto';
import { zbgis } from './zbgis';
import { zbgisTeren } from './zbgis_teren';
import { zbgisOrto } from './zbgis_orto';
import { historical } from './historical';
import { gnOrtofoto } from './gn_ortofoto';
import type { LayerConfig } from '../types';

export const layerSources: LayerConfig[] = [
  freemap,
  terrain2,
  geology,
  ortofoto,
  zbgis,
  zbgisTeren,
  zbgisOrto,
  historical,
  gnOrtofoto,
];
