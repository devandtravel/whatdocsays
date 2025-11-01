import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import dayjs from 'dayjs';
import { ScheduleEvent } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldShowAlert: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const CHANNEL_ID = 'medication-reminders';

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Medication reminders',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableLights: true,
  });
};

export const ensurePermissions = async (): Promise<boolean> => {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    await ensureAndroidChannel();
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  if (!requested.granted) {
    return false;
  }

  await ensureAndroidChannel();
  return true;
};

type ScheduleOptions = {
  title?: string;
  body?: string;
};

export const scheduleLocal = async (
  event: ScheduleEvent,
  options: ScheduleOptions & { planName?: string } = {},
): Promise<string | undefined> => {
  const triggerDate = dayjs(event.at);
  if (!triggerDate.isValid()) {
    console.warn('[notify] Invalid trigger date for event', event);
    return undefined;
  }

  if (event.status !== 'scheduled') {
    return undefined;
  }

  const hasPermission = await ensurePermissions();
  if (!hasPermission) {
    return undefined;
  }

  const title = options.title ?? 'What Doc Says';
  const body =
    options.body ??
    `Time to take ${options.planName ?? 'your medication'} (${event.dose}).`;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        eventId: event.id,
        planId: event.medPlanId,
      },
    },
    trigger: triggerDate.isBefore(dayjs())
      ? {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate.toDate(),
        },
  });

  return identifier;
};

export const cancelForPlan = async (planId: string): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.planId === planId)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
};

export const cancelEvent = async (eventId: string): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const target = scheduled.find((item) => item.content.data?.eventId === eventId);
  if (target) {
    await Notifications.cancelScheduledNotificationAsync(target.identifier);
  }
};

export const snooze = async (eventId: string, minutes = 15): Promise<string | undefined> => {
  const hasPermission = await ensurePermissions();
  if (!hasPermission) {
    return undefined;
  }

  const trigger = dayjs().add(minutes, 'minute');

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Snoozed reminder',
      body: 'Reminder rescheduled.',
      data: { eventId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger.toDate(),
    },
  });
};
