import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { expandPlan } from '../lib/schedule';
import { ensurePermissions, scheduleLocal, cancelForPlan } from '../lib/notify';
import { useAppStore } from '../store';
import { theme } from '../theme';
import { ScheduleEvent } from '../types';

const horizonOptions = [7, 14];

const groupByDay = (events: ScheduleEvent[]) => {
  const grouped = new Map<string, ScheduleEvent[]>();
  events.forEach((event) => {
    const key = dayjs(event.at).format('YYYY-MM-DD');
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(event);
  });
  return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
};

export default function ScheduleScreen() {
  const router = useRouter();
  const draftPlans = useAppStore((state) => state.draft.parsed);
  const settings = useAppStore((state) => state.settings);
  const upsertPlans = useAppStore((state) => state.upsertPlans);
  const setEventsForPlan = useAppStore((state) => state.setEventsForPlan);
  const setNotificationRef = useAppStore((state) => state.setNotificationRef);
  const clearNotificationsForPlan = useAppStore((state) => state.clearNotificationsForPlan);

  const [horizon, setHorizon] = useState(() => settings.horizonDays);
  const [previewEvents, setPreviewEvents] = useState<Record<string, ScheduleEvent[]>>({});
  const [isScheduling, setScheduling] = useState(false);

  useEffect(() => {
    setHorizon(settings.horizonDays);
  }, [settings.horizonDays]);

  useEffect(() => {
    const next: Record<string, ScheduleEvent[]> = {};
    draftPlans.forEach((plan) => {
      next[plan.id] = expandPlan(plan, dayjs(), horizon);
    });
    setPreviewEvents(next);
  }, [draftPlans, horizon]);

  const orderedPlans = useMemo(() => draftPlans, [draftPlans]);

  const flattenedEvents = useMemo(
    () => orderedPlans.flatMap((plan) => previewEvents[plan.id] ?? []),
    [orderedPlans, previewEvents],
  );

  useEffect(() => {
    if (!orderedPlans.length) {
      Alert.alert('Nothing to schedule', 'Parse or add medications first.');
      router.back();
    }
  }, [orderedPlans.length, router]);

  const handleSchedule = async () => {
    if (isScheduling) {
      return;
    }

    setScheduling(true);

    try {
      const permissionGranted = await ensurePermissions();
      if (!permissionGranted) {
        Alert.alert('Permission needed', 'Enable notifications to finish scheduling.');
        setScheduling(false);
        return;
      }

      for (const plan of orderedPlans) {
        await cancelForPlan(plan.id);
        clearNotificationsForPlan(plan.id);
        const eventsForPlan = previewEvents[plan.id] ?? [];
        setEventsForPlan(plan.id, eventsForPlan);
        for (const event of eventsForPlan) {
          if (event.windowMins === undefined) {
            continue; // PRN: do not schedule automatically.
          }
          const identifier = await scheduleLocal(event, {
            planName: plan.name,
            body: `Dose ${event.dose} for ${plan.name}`,
          });
          if (identifier) {
            setNotificationRef(event.id, identifier);
          }
        }
      }

      upsertPlans(orderedPlans);
      Alert.alert('Scheduled', 'Notifications ready. View them from Today.');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[schedule] scheduling failed', error);
      Alert.alert('Scheduling failed', 'Please try again.');
    } finally {
      setScheduling(false);
    }
  };

  const grouped = useMemo(() => groupByDay(flattenedEvents), [flattenedEvents]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen options={{ title: 'Schedule Plan' }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.subtitle, { color: theme.colors.text }]}>Preview horizon</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {horizonOptions.map((option) => {
              const selected = option === horizon;
              return (
                <Pressable
                  key={option}
                  onPress={() => setHorizon(option)}
                  style={{
                    flex: 1,
                    paddingVertical: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                    borderWidth: 1,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: selected ? '#fff' : theme.colors.text }}>{option} days</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {orderedPlans.map((plan) => (
          <View
            key={plan.id}
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              gap: theme.spacing.xs,
            }}
          >
            <Text style={{ fontWeight: '600', color: theme.colors.text }}>{plan.name}</Text>
            <Text style={{ color: theme.colors.textMuted }}>
              {(plan.instructions[0]?.frequency ?? 'QD')} · {plan.instructions[0]?.dose.amount}{' '}
              {plan.instructions[0]?.dose.unit}
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>
              {previewEvents[plan.id]?.length ?? 0} reminders over {horizon} days.
            </Text>
          </View>
        ))}

        <View style={{ gap: theme.spacing.md }}>
          {grouped.map(([day, events]) => (
            <View
              key={day}
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface,
                gap: theme.spacing.sm,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Text style={{ fontWeight: '600', color: theme.colors.text }}>
                {dayjs(day).format('dddd, MMM D')}
              </Text>
              {events
                .slice()
                .sort((a, b) => dayjs(a.at).valueOf() - dayjs(b.at).valueOf())
                .map((event) => (
                  <View
                    key={event.id}
                    style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                  >
                    <Text style={{ color: theme.colors.text }}>{dayjs(event.at).format('HH:mm')}</Text>
                    <Text style={{ color: theme.colors.textMuted }}>{event.dose}</Text>
                  </View>
                ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <View
        style={{
          padding: theme.spacing.lg,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={handleSchedule}
          disabled={isScheduling}
          style={{
            paddingVertical: theme.spacing.md,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            opacity: isScheduling ? 0.6 : 1,
          }}
        >
          {isScheduling ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
              <ActivityIndicator color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600' }}>Scheduling…</Text>
            </View>
          ) : (
            <Text style={{ color: '#fff', fontWeight: '600' }}>Schedule notifications</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
