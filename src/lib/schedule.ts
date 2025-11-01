import { Dayjs } from "dayjs";
import { Frequency, MedicationPlan, ScheduleEvent } from "../types";

const DEFAULT_WINDOW_MINS = 30;

const DEFAULT_TIMES: Record<Frequency, string[]> = {
	QD: ["09:00"],
	BID: ["08:00", "20:00"],
	TID: ["08:00", "14:00", "20:00"],
	QID: ["06:00", "12:00", "18:00", "22:00"],
	QHS: ["22:30"],
	QAM: ["08:00"],
	QPM: ["20:00"],
	QOD: ["09:00"],
	PRN: [],
};

const makeDoseLabel = (
	plan: MedicationPlan,
	instructionIndex: number,
): string => {
	const instruction = plan.instructions[instructionIndex];
	const amount = instruction.dose.amount;
	const unit = instruction.dose.unit;
	const formattedUnit = (() => {
		switch (unit) {
			case "tab":
				return amount === 1 ? "tab" : "tabs";
			case "caps":
				return amount === 1 ? "cap" : "caps";
			case "ml":
			case "mg":
				return unit;
			case "drops":
				return amount === 1 ? "drop" : "drops";
			case "sprays":
				return amount === 1 ? "spray" : "sprays";
			default:
				return unit;
		}
	})();
	return `${amount} ${formattedUnit}`;
};

const timesForInstruction = (
	frequency: Frequency,
	times?: string[],
): string[] => {
	if (times && times.length) {
		return Array.from(new Set(times)).sort();
	}
	return DEFAULT_TIMES[frequency] ?? DEFAULT_TIMES.QD;
};

const shouldIncludeDay = (frequency: Frequency, dayOffset: number): boolean => {
	if (frequency === "QOD") {
		return dayOffset % 2 === 0;
	}
	return true;
};

const createEventId = (
	planId: string,
	instructionIndex: number,
	dayOffset: number,
	time: string,
): string => {
	const sanitized = time.replace(":", "");
	return `${planId}-${instructionIndex}-${dayOffset}-${sanitized}`;
};

export const expandPlan = (
	plan: MedicationPlan,
	start: Dayjs,
	horizonDays: number,
): ScheduleEvent[] => {
	const startOfDay = start.startOf("day");
	const events: ScheduleEvent[] = [];

	plan.instructions.forEach((instruction, instructionIndex) => {
		const times = timesForInstruction(
			instruction.frequency,
			instruction.timesOfDay,
		);
		if (instruction.frequency === "PRN" && times.length === 0) {
			// As-needed medications without defined times are surfaced without scheduling.
			return;
		}

		const durationLimit = instruction.durationDays ?? horizonDays;

		for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
			if (dayOffset >= durationLimit) {
				break;
			}

			if (!shouldIncludeDay(instruction.frequency, dayOffset)) {
				continue;
			}

			times.forEach((time) => {
				const [hourString, minuteString] = time.split(":");
				const hour = Number.parseInt(hourString, 10);
				const minute = Number.parseInt(minuteString, 10);
				const occurrence = startOfDay
					.add(dayOffset, "day")
					.hour(hour)
					.minute(minute)
					.second(0);

				events.push({
					id: createEventId(plan.id, instructionIndex, dayOffset, time),
					medPlanId: plan.id,
					at: occurrence.toISOString(),
					windowMins:
						instruction.frequency === "PRN" ? undefined : DEFAULT_WINDOW_MINS,
					dose: makeDoseLabel(plan, instructionIndex),
					status: "scheduled",
				});
			});
		}
	});

	return events;
};
