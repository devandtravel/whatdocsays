import { MMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import dayjs from 'dayjs';
import { MedicationPlan, ScheduleEvent } from './types';

const fallbackMemory = new Map<string, string>();

let storage: MMKV | null = null;

try {
  storage = new MMKV({ id: 'whatdocsays-store' });
  console.log('[store] MMKV initialized successfully');
} catch (error) {
  storage = null;
  console.warn('[store] MMKV unavailable, using in-memory fallback:', error);
}

const zustandStorage = {
  getItem: (name: string): string | null =>
    storage ? storage.getString(name) ?? null : fallbackMemory.get(name) ?? null,
  setItem: (name: string, value: string) => {
    if (storage) {
      storage.set(name, value);
      return;
    }
    fallbackMemory.set(name, value);
  },
  removeItem: (name: string) => {
    if (storage) {
      storage.delete(name);
      return;
    }
    fallbackMemory.delete(name);
  },
};

type SettingsState = {
  horizonDays: number;
  windowMins: number;
  defaultTimes: Record<string, string[]>;
};

type DraftState = {
  rawText: string;
  parsed: MedicationPlan[];
};

type NotificationRefs = Record<string, string | undefined>;

type StoreState = {
  medPlans: MedicationPlan[];
  events: ScheduleEvent[];
  notificationRefs: NotificationRefs;
  draft: DraftState;
  settings: SettingsState;
  setDraftText: (text: string) => void;
  setDraftPlans: (plans: MedicationPlan[]) => void;
  clearDraft: () => void;
  upsertPlans: (plans: MedicationPlan[]) => void;
  removePlan: (planId: string) => void;
  setEventsForPlan: (planId: string, events: ScheduleEvent[]) => void;
  overwriteEvents: (events: ScheduleEvent[]) => void;
  updateEventStatus: (eventId: string, status: ScheduleEvent['status']) => void;
  shiftEvent: (eventId: string, newIso: string) => void;
  setNotificationRef: (eventId: string, notificationId?: string) => void;
  clearNotificationsForPlan: (planId: string) => void;
};

const sortEvents = (events: ScheduleEvent[]) =>
  [...events].sort((a, b) => dayjs(a.at).valueOf() - dayjs(b.at).valueOf());

export const useAppStore = create<StoreState>()(
  persist(
    (set, get) => ({
      medPlans: [],
      events: [],
      notificationRefs: {},
      draft: { rawText: '', parsed: [] },
      settings: {
        horizonDays: 7,
        windowMins: 30,
        defaultTimes: {
          QD: ['09:00'],
          BID: ['08:00', '20:00'],
          TID: ['08:00', '14:00', '20:00'],
          QID: ['06:00', '12:00', '18:00', '22:00'],
          QHS: ['22:30'],
          QAM: ['08:00'],
          QPM: ['20:00'],
          QOD: ['09:00'],
        },
      },
      setDraftText: (text) =>
        set((state) => ({
          draft: { ...state.draft, rawText: text },
        })),
      setDraftPlans: (plans) =>
        set((state) => ({
          draft: { ...state.draft, parsed: plans },
        })),
      clearDraft: () =>
        set(() => ({
          draft: { rawText: '', parsed: [] },
        })),
      upsertPlans: (plans) =>
        set((state) => {
          const map = new Map(state.medPlans.map((plan) => [plan.id, plan] as const));
          plans.forEach((plan) => {
            map.set(plan.id, plan);
          });
          return {
            medPlans: Array.from(map.values()),
          };
        }),
      removePlan: (planId) =>
        set((state) => ({
          medPlans: state.medPlans.filter((plan) => plan.id !== planId),
          events: state.events.filter((event) => event.medPlanId !== planId),
          notificationRefs: Object.fromEntries(
            Object.entries(state.notificationRefs).filter(([eventId]) => !eventId.startsWith(`${planId}-`)),
          ),
        })),
      setEventsForPlan: (planId, eventsForPlan) =>
        set((state) => {
          const retained = state.events.filter((event) => event.medPlanId !== planId);
          const merged = sortEvents([...retained, ...eventsForPlan]);
          return { events: merged };
        }),
      overwriteEvents: (events) =>
        set(() => ({
          events: sortEvents(events),
        })),
      updateEventStatus: (eventId, status) =>
        set((state) => ({
          events: state.events.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  status,
                }
              : event,
          ),
        })),
      shiftEvent: (eventId, newIso) =>
        set((state) => ({
          events: sortEvents(
            state.events.map((event) =>
              event.id === eventId
                ? {
                    ...event,
                    at: newIso,
                  }
                : event,
            ),
          ),
        })),
      setNotificationRef: (eventId, notificationId) =>
        set((state) => {
          const next = { ...state.notificationRefs };
          if (notificationId) {
            next[eventId] = notificationId;
          } else {
            delete next[eventId];
          }
          return { notificationRefs: next };
        }),
      clearNotificationsForPlan: (planId) =>
        set((state) => ({
          notificationRefs: Object.fromEntries(
            Object.entries(state.notificationRefs).filter(
              ([eventId]) => !eventId.startsWith(`${planId}-`),
            ),
          ),
        })),
    }),
    {
      name: 'whatdocsays-store-v2',
      storage: createJSONStorage(() => zustandStorage),
      version: 2,
      partialize: (state) => ({
        medPlans: state.medPlans,
        events: state.events,
        settings: state.settings,
        notificationRefs: state.notificationRefs,
      }),
      skipHydration: true,
    },
  ),
);
