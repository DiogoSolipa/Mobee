import type { Place } from './types';

/**
 * Starter catalogue of Lisbon places with the nearest Metro lines.
 * MVP place search picks from this list or accepts free text (FR-01).
 * Replace with a geocoder (e.g. Nominatim or Google Places) when accounts and a backend DB land.
 * Coordinates are approximate (station / neighbourhood centres).
 */
export const PLACES: Place[] = [
  { id: 'home-alvalade', name: 'Home', area: 'Alvalade', lat: 38.7508, lon: -9.1462, metro: ['green'] },
  { id: 'saldanha', name: 'Office', area: 'Saldanha', lat: 38.7351, lon: -9.1453, metro: ['yellow', 'red'] },
  { id: 'av-roma', name: 'Pharmacy', area: 'Av. de Roma', lat: 38.7462, lon: -9.1387, metro: ['green'] },
  { id: 'mercado-alvalade', name: 'Mercado de Alvalade', area: 'Alvalade', lat: 38.7537, lon: -9.1437, metro: ['green'] },
  { id: 'school-alvalade', name: 'School', area: 'Alvalade', lat: 38.7561, lon: -9.1404, metro: ['green'] },
  { id: 'campo-ourique', name: 'Campo de Ourique', area: 'Campo de Ourique', lat: 38.7175, lon: -9.1665, hilly: true },
  { id: 'cais-sodre', name: 'Cais do Sodré', area: 'Cais do Sodré', lat: 38.706, lon: -9.1446, metro: ['green'] },
  { id: 'baixa-chiado', name: 'Baixa-Chiado', area: 'Chiado', lat: 38.7105, lon: -9.1405, metro: ['green', 'blue'], hilly: true },
  { id: 'rossio', name: 'Rossio', area: 'Baixa', lat: 38.714, lon: -9.139, metro: ['green'] },
  { id: 'martim-moniz', name: 'Martim Moniz', area: 'Mouraria', lat: 38.717, lon: -9.136, metro: ['green'], hilly: true },
  { id: 'marques', name: 'Marquês de Pombal', area: 'Marquês', lat: 38.7253, lon: -9.15, metro: ['blue', 'yellow'] },
  { id: 'alameda', name: 'Alameda', area: 'Arroios', lat: 38.737, lon: -9.1335, metro: ['green', 'red'] },
  { id: 'areeiro', name: 'Areeiro', area: 'Areeiro', lat: 38.7425, lon: -9.134, metro: ['green'] },
  { id: 'entrecampos', name: 'Entrecampos', area: 'Entrecampos', lat: 38.748, lon: -9.1485, metro: ['yellow'] },
  { id: 'campo-grande', name: 'Campo Grande', area: 'Campo Grande', lat: 38.7598, lon: -9.158, metro: ['yellow', 'green'] },
  { id: 'telheiras', name: 'Telheiras', area: 'Telheiras', lat: 38.7605, lon: -9.166, metro: ['green'] },
  { id: 'parque-nacoes', name: 'Parque das Nações', area: 'Oriente', lat: 38.768, lon: -9.099, metro: ['red'] },
  { id: 'santa-apolonia', name: 'Santa Apolónia', area: 'Santa Apolónia', lat: 38.7136, lon: -9.1225, metro: ['blue'] },
  { id: 'gym-campo-grande', name: 'Gym', area: 'Campo Grande', lat: 38.7585, lon: -9.1555, metro: ['yellow', 'green'] },
];

export const PLACE_BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map((p) => [p.id, p]));

export const METRO_LINE_LABEL = {
  yellow: { en: 'Yellow line', pt: 'Linha Amarela' },
  green: { en: 'Green line', pt: 'Linha Verde' },
  blue: { en: 'Blue line', pt: 'Linha Azul' },
  red: { en: 'Red line', pt: 'Linha Vermelha' },
} as const;
