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
