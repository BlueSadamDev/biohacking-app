// Icônes en trait fin (2 px), dessinées à la main (pas de bibliothèque d'icônes).

import type { ColorValue } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { colors } from './theme';

type IconProps = { color?: ColorValue; size?: number };

function Icon({ color = colors.text, size = 24, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round">
      {children}
    </Svg>
  );
}

/** Onglet « Aujourd'hui » : soleil levant. */
export function TodayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M5 17a7 7 0 0 1 14 0" />
      <Line x1="3" y1="20" x2="21" y2="20" />
      <Line x1="12" y1="4" x2="12" y2="7" />
      <Line x1="4.9" y1="8.9" x2="7" y2="11" />
      <Line x1="19.1" y1="8.9" x2="17" y2="11" />
    </Icon>
  );
}

/** Onglet « Réglages » : curseurs. */
export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Line x1="4" y1="7" x2="20" y2="7" />
      <Line x1="4" y1="17" x2="20" y2="17" />
      <Circle cx="9" cy="7" r="2.5" fill={colors.bg} />
      <Circle cx="15" cy="17" r="2.5" fill={colors.bg} />
    </Icon>
  );
}

/** Onglet « Tendances » : courbe montante sur un axe. */
export function TrendsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M4 4v16h16" />
      <Path d="M7 15l4-4 3 3 5-6" />
    </Icon>
  );
}

/** Onglet « Sport » : haltère. */
export function SportIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Line x1="8" y1="12" x2="16" y2="12" />
      <Path d="M6 8v8M8 7v10M18 8v8M16 7v10" />
      <Line x1="3" y1="12" x2="6" y2="12" />
      <Line x1="18" y1="12" x2="21" y2="12" />
    </Icon>
  );
}

/** Retour. */
export function BackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M15 18l-6-6 6-6" />
    </Icon>
  );
}

/** Diagnostic : tracé d'activité. */
export function PulseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M3 12h4l3-7 4 14 3-7h4" />
    </Icon>
  );
}

/** Alertes : cloche. */
export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
      <Path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" />
    </Icon>
  );
}

/** Chevron vers la droite. */
export function ChevronIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M9 6l6 6-6 6" />
    </Icon>
  );
}
