// Logo Aube (DESIGN.md, « Identité ») : même dessin que assets/brand/aube-logo.svg.
// En petit (≤ 48 px), version simplifiée de aube-logo-petit.svg : sans soleil, traits plus épais.

import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from './theme';

const SMALL_MAX = 48;

export function Logo({ size }: { size: number }) {
  const small = size <= SMALL_MAX;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="Aube">
      <Path
        d="M24 98L60 18L96 98"
        fill="none"
        stroke={colors.text}
        strokeWidth={small ? 14 : 12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {small ? (
        <Rect x={34} y={70} width={52} height={8} rx={4} fill={colors.mid} />
      ) : (
        <>
          <Path d="M48 70a12 12 0 0 1 24 0" fill={colors.mid} />
          <Rect x={36} y={72} width={48} height={6} rx={3} fill={colors.mid} />
        </>
      )}
    </Svg>
  );
}
