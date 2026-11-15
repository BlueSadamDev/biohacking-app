// Enregistrements Health Connect fictifs (forme renvoyée par react-native-health-connect),
// pour simuler une synchro dans les tests. Aucune vraie donnée de santé.

const ZEPP = { dataOrigin: 'com.huami.watch.hmwatchmanager' };

export const FAKE_HC_RECORDS: Record<string, object[]> = {
  SleepSession: [
    {
      startTime: '2026-01-10T22:30:00.000Z',
      endTime: '2026-01-11T06:30:00.000Z',
      stages: [],
      metadata: { id: 'sleep-1', ...ZEPP },
    },
  ],
  HeartRateVariabilityRmssd: [
    { time: '2026-01-11T03:00:00.000Z', heartRateVariabilityMillis: 50, metadata: { id: 'hrv-1', ...ZEPP } },
    { time: '2026-01-11T04:00:00.000Z', heartRateVariabilityMillis: 55, metadata: { id: 'hrv-2', ...ZEPP } },
  ],
  RestingHeartRate: [{ time: '2026-01-11T06:00:00.000Z', beatsPerMinute: 52, metadata: { id: 'rhr-1', ...ZEPP } }],
  Steps: [
    {
      startTime: '2026-01-11T08:00:00.000Z',
      endTime: '2026-01-11T09:00:00.000Z',
      count: 1000,
      metadata: { id: 'steps-1', ...ZEPP },
    },
  ],
};
