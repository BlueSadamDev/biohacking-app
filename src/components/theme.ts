// Thème de l'app : valeurs reprises de DESIGN.md (qui fait foi).

import type { Zone } from '@/domain/recommendation';

export const colors = {
  bg: '#0B0F14',
  surface: '#151B23',
  surfaceAlt: '#1C2430',
  track: '#232C38',
  border: '#2B3644',
  text: '#F2F5F8',
  textMuted: '#9AA6B4',
  textSoft: '#C9D2DC',
  good: '#3DDC97',
  mid: '#F5B83D',
  low: '#FF7A6B',
  info: '#4DA3FF',
  infoText: '#7DB8FF',
  bar: '#5C6B7E',
  tabInactive: '#8B97A6',
} as const;

/** Couleur à 14 % d'opacité (fonds de pastilles et de la carte recommandation). */
export function tint(hex: string, opacity = 0.14): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

/** Couleur d'une zone de récupération ; « neutral » = sans jugement. */
export function zoneColor(zone: Zone): string {
  if (zone === 'good') return colors.good;
  if (zone === 'mid') return colors.mid;
  if (zone === 'low') return colors.low;
  return colors.textMuted;
}

/** Noms des polices chargées depuis assets/fonts (voir src/app/_layout.tsx). */
export const fonts = {
  display500: 'SpaceGrotesk_500Medium',
  display600: 'SpaceGrotesk_600SemiBold',
  display700: 'SpaceGrotesk_700Bold',
  body400: 'Inter_400Regular',
  body500: 'Inter_500Medium',
  body600: 'Inter_600SemiBold',
} as const;

export const fontFiles = {
  [fonts.display500]: require('../../assets/fonts/SpaceGrotesk_500Medium.ttf'),
  [fonts.display600]: require('../../assets/fonts/SpaceGrotesk_600SemiBold.ttf'),
  [fonts.display700]: require('../../assets/fonts/SpaceGrotesk_700Bold.ttf'),
  [fonts.body400]: require('../../assets/fonts/Inter_400Regular.ttf'),
  [fonts.body500]: require('../../assets/fonts/Inter_500Medium.ttf'),
  [fonts.body600]: require('../../assets/fonts/Inter_600SemiBold.ttf'),
};

export const space = {
  screen: 20,
  block: 16,
  grid: 10,
} as const;

export const radius = {
  card: 16,
  tile: 14,
  control: 12,
  pill: 999,
  round: 22,
} as const;

/** Cible tactile minimale (DESIGN.md). */
export const TOUCH = 44;
