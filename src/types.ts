export type Frequency =
	| "QD"
	| "BID"
	| "TID"
	| "QID"
	| "QHS"
	| "QAM"
	| "QPM"
	| "QOD"
	| "PRN";
export type TimingWhen =
	| "MORN"
	| "NOON"
	| "EVE"
	| "NIGHT"
	| "BEFORE_MEAL"
	| "AFTER_MEAL";

export type DosageInstruction = {
	dose: {
		amount: number;
		unit: "mg" | "ml" | "tab" | "caps" | "drops" | "sprays";
	};
	frequency: Frequency;
	timesOfDay?: string[]; // e.g. ['08:00', '20:00']
	when?: TimingWhen[];
	durationDays?: number;
	prn?: boolean;
};

export type MedicationPlan = {
	id: string;
	name: string;
	strength?: string;
	route?: "po" | "im" | "iv" | "inh" | "sl" | "topical" | "nasal" | "oph";
	instructions: DosageInstruction[];
	notes?: string;
};

export type ScheduleEvent = {
	id: string;
	medPlanId: string;
	at: string;
	windowMins?: number;
	dose: string;
	status: "scheduled" | "taken" | "missed" | "snoozed";
};
