// Anneau de récupération : 196 px, épaisseur 14, arc proportionnel au score.
// Pendant la calibration : arc « info » proportionnel à n / 28, sans score.

import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from './AppText';
import { colors } from './theme';

const SIZE = 196;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

type Props =
  | { kind: 'score'; score: number; color: string }
  | { kind: 'calibration'; nights: number; required: number }
  | { kind: 'empty' };

export function RecoveryRing(props: Props) {
  let fraction = 0;
  let color: string = colors.surfaceAlt;
  if (props.kind === 'score') {
    fraction = props.score / 100;
    color = props.color;
  } else if (props.kind === 'calibration') {
    fraction = Math.min(1, props.nights / props.required);
    color = colors.info;
  }

  return (
    <View style={styles.wrap} accessible accessibilityLabel={describe(props)}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.surfaceAlt} strokeWidth={STROKE} fill="none" />
        {fraction > 0 && (
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE * fraction} ${CIRCUMFERENCE}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </Svg>
      <View style={styles.center}>
        {props.kind === 'score' && (
          <AppText variant="score">
            {props.score}
            <AppText variant="unit" style={styles.percent}>
              {' %'}
            </AppText>
          </AppText>
        )}
        {props.kind === 'calibration' && (
          <AppText variant="score" style={styles.calibration}>
            {Math.min(props.nights, props.required)}
            <AppText variant="unit" style={styles.percent}>
              {` / ${props.required}`}
            </AppText>
          </AppText>
        )}
        {props.kind === 'empty' && <AppText variant="score" style={{ color: colors.textMuted }}>—</AppText>}
        <AppText variant="small">{props.kind === 'calibration' ? 'Calibration' : 'Récupération'}</AppText>
      </View>
    </View>
  );
}

function describe(props: Props): string {
  if (props.kind === 'score') return `Récupération ${props.score} %`;
  if (props.kind === 'calibration') return `Calibration ${props.nights} sur ${props.required} jours`;
  return 'Récupération non calculable';
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  percent: { fontSize: 24 },
  calibration: { fontSize: 44 },
});
