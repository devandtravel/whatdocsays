import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from "react-native";
import { cancelEvent, snooze } from "../../lib/notify";
import { useAppStore } from "../../store";
import { theme } from "../../theme";
import { ScheduleEvent } from "../../types";

const groupEventsByTime = (events: ScheduleEvent[]) => {
	const grouped = new Map<string, ScheduleEvent[]>();
	events.forEach((event) => {
		const timeKey = dayjs(event.at).format("HH:mm");
		if (!grouped.has(timeKey)) {
			grouped.set(timeKey, []);
		}
		grouped.get(timeKey)?.push(event);
	});
	return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
};

const statusLabel: Record<ScheduleEvent["status"], string> = {
	scheduled: "Scheduled",
	snoozed: "Snoozed",
	taken: "Taken",
	missed: "Missed",
};

export default function TodayScreen() {
	const router = useRouter();
	const events = useAppStore((state) => state.events);
	const medPlans = useAppStore((state) => state.medPlans);
	const updateEventStatus = useAppStore((state) => state.updateEventStatus);
	const shiftEvent = useAppStore((state) => state.shiftEvent);
	const setNotificationRef = useAppStore((state) => state.setNotificationRef);
	const [refreshing, setRefreshing] = useState(false);

	// Debug logging
	console.log(
		"[TodayScreen] Component rendered, events:",
		events.length,
		"medPlans:",
		medPlans.length,
	);

	const planLookup = useMemo(
		() => new Map(medPlans.map((plan) => [plan.id, plan.name])),
		[medPlans],
	);

	const todayEvents = useMemo(
		() => events.filter((event) => dayjs(event.at).isSame(dayjs(), "day")),
		[events],
	);

	const grouped = useMemo(() => groupEventsByTime(todayEvents), [todayEvents]);

	const handleTaken = useCallback(
		async (event: ScheduleEvent) => {
			console.log("[TodayScreen] handleTaken called for event:", event.id);
			try {
				updateEventStatus(event.id, "taken");
				try {
					await cancelEvent(event.id);
				} catch (notifyError) {
					console.warn(
						"[TodayScreen] Notification cancel failed:",
						notifyError,
					);
				}
				setNotificationRef(event.id, undefined);
			} catch (error) {
				console.error("[TodayScreen] Error in handleTaken:", error);
			}
		},
		[updateEventStatus, setNotificationRef],
	);

	const handleSkip = useCallback(
		async (event: ScheduleEvent) => {
			console.log("[TodayScreen] handleSkip called for event:", event.id);
			try {
				updateEventStatus(event.id, "missed");
				try {
					await cancelEvent(event.id);
				} catch (notifyError) {
					console.warn(
						"[TodayScreen] Notification cancel failed:",
						notifyError,
					);
				}
				setNotificationRef(event.id, undefined);
			} catch (error) {
				console.error("[TodayScreen] Error in handleSkip:", error);
			}
		},
		[updateEventStatus, setNotificationRef],
	);

	const handleSnooze = useCallback(
		async (event: ScheduleEvent) => {
			console.log("[TodayScreen] handleSnooze called for event:", event.id);
			try {
				const newFireDate = dayjs().add(15, "minute").toISOString();
				updateEventStatus(event.id, "snoozed");
				shiftEvent(event.id, newFireDate);
				try {
					await cancelEvent(event.id);
					const identifier = await snooze(event.id, 15);
					if (identifier) {
						setNotificationRef(event.id, identifier);
					}
				} catch (notifyError) {
					console.warn(
						"[TodayScreen] Notification operations failed:",
						notifyError,
					);
				}
			} catch (error) {
				console.error("[TodayScreen] Error in handleSnooze:", error);
			}
		},
		[updateEventStatus, shiftEvent, setNotificationRef],
	);

	const onRefresh = () => {
		setRefreshing(true);
		setTimeout(() => setRefreshing(false), 350);
	};

	return (
		<View style={{ flex: 1, backgroundColor: theme.colors.background }}>
			<View
				style={{
					paddingHorizontal: theme.spacing.lg,
					paddingTop: theme.spacing.lg,
				}}
			>
				<Text style={[theme.typography.title, { color: theme.colors.text }]}>
					Today
				</Text>
				<Text
					style={{ color: theme.colors.textMuted, marginTop: theme.spacing.xs }}
				>
					{dayjs().format("dddd, MMM D")}
				</Text>
				<Pressable
					accessibilityRole="button"
					onPress={() => {
						console.log("Capture button pressed");
						try {
							router.push("/capture");
						} catch (error) {
							console.error("Navigation error:", error);
						}
					}}
					style={{
						marginTop: theme.spacing.md,
						alignSelf: "flex-start",
						flexDirection: "row",
						alignItems: "center",
						gap: theme.spacing.xs,
						paddingVertical: theme.spacing.sm,
						paddingHorizontal: theme.spacing.md,
						backgroundColor: theme.colors.primary,
						borderRadius: theme.radius.md,
					}}
				>
					<Ionicons name="camera" size={18} color="#fff" />
					<Text style={{ color: "#fff", fontWeight: "500" }}>
						Capture new plan
					</Text>
				</Pressable>
			</View>
			<ScrollView
				contentContainerStyle={{
					paddingHorizontal: theme.spacing.lg,
					paddingBottom: theme.spacing.xl,
				}}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
				}
			>
				{grouped.length === 0 ? (
					<View
						style={{
							marginTop: theme.spacing.xl,
							padding: theme.spacing.lg,
							borderRadius: theme.radius.md,
							backgroundColor: theme.colors.surface,
						}}
					>
						<Text style={{ color: theme.colors.textMuted }}>
							No reminders scheduled for today yet. Capture a prescription to
							get started.
						</Text>
					</View>
				) : (
					grouped.map(([time, eventItems]) => (
						<View
							key={time}
							style={{
								marginTop: theme.spacing.lg,
								padding: theme.spacing.md,
								borderRadius: theme.radius.md,
								backgroundColor: theme.colors.surface,
								gap: theme.spacing.md,
								...theme.shadow.card,
							}}
						>
							<View
								style={{
									flexDirection: "row",
									justifyContent: "space-between",
									alignItems: "center",
								}}
							>
								<Text
									style={[
										theme.typography.subtitle,
										{ color: theme.colors.text },
									]}
								>
									{time}
								</Text>
								<Text style={{ color: theme.colors.textMuted }}>
									{dayjs(eventItems[0].at).format("MMM D")}
								</Text>
							</View>
							{eventItems.map((event) => (
								<View
									key={event.id}
									style={{
										borderWidth: 1,
										borderColor: theme.colors.border,
										borderRadius: theme.radius.md,
										padding: theme.spacing.md,
										gap: theme.spacing.sm,
										backgroundColor:
											event.status === "taken"
												? "#ECFDF5"
												: event.status === "missed"
													? "#FEF3C7"
													: theme.colors.background,
									}}
								>
									<Text style={{ fontWeight: "600", color: theme.colors.text }}>
										{planLookup.get(event.medPlanId) ?? "Medication"}
									</Text>
									<Text style={{ color: theme.colors.textMuted }}>
										{event.dose}
									</Text>
									<Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
										Status: {statusLabel[event.status]}
									</Text>
									<View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
										<ActionButton
											label="Taken"
											color={theme.colors.accent}
											onPress={() => handleTaken(event)}
											disabled={event.status === "taken"}
										/>
										<ActionButton
											label="Snooze"
											color={theme.colors.primary}
											onPress={() => handleSnooze(event)}
										/>
										<ActionButton
											label="Skip"
											color={theme.colors.danger}
											onPress={() => handleSkip(event)}
											disabled={event.status === "missed"}
										/>
									</View>
								</View>
							))}
						</View>
					))
				)}
			</ScrollView>
		</View>
	);
}
type ActionButtonProps = {
	label: string;
	onPress: () => void;
	color: string;
	disabled?: boolean;
};

const ActionButton = ({
	label,
	onPress,
	color,
	disabled,
}: ActionButtonProps) => (
	<Pressable
		accessibilityRole="button"
		onPress={onPress}
		disabled={disabled}
		style={{
			flex: 1,
			opacity: disabled ? 0.5 : 1,
			paddingVertical: theme.spacing.sm,
			borderRadius: theme.radius.sm,
			backgroundColor: color,
			alignItems: "center",
		}}
	>
		<Text style={{ color: "#fff", fontWeight: "600" }}>{label}</Text>
	</Pressable>
);
