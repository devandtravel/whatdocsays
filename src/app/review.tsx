import { useCallback, useMemo, useState, useEffect } from 'react';
import { ScrollView, Text, TextInput, View, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { z } from 'zod';
import { MedicationPlan, DosageInstruction, Frequency, TimingWhen } from '../types';
import { parsePrescriptionText } from '../lib/parse';
import { useAppStore } from '../store';
import { theme } from '../theme';

const SAMPLE_TEXT = `Amoxicillin 500 mg
1 tab 3 times a day 7 days after meals
At night: Melatonin 3 mg — 1 tab`;

const frequencyOptions: { value: Frequency; label: string }[] = [
  { value: 'QD', label: 'QD' },
  { value: 'BID', label: 'BID' },
  { value: 'TID', label: 'TID' },
  { value: 'QID', label: 'QID' },
  { value: 'QAM', label: 'QAM' },
  { value: 'QPM', label: 'QPM' },
  { value: 'QHS', label: 'QHS' },
  { value: 'QOD', label: 'QOD' },
  { value: 'PRN', label: 'PRN' },
];

const timingOptions: { value: TimingWhen; label: string }[] = [
  { value: 'MORN', label: 'Morning' },
  { value: 'NOON', label: 'Midday' },
  { value: 'EVE', label: 'Evening' },
  { value: 'NIGHT', label: 'Night' },
  { value: 'BEFORE_MEAL', label: 'Before meal' },
  { value: 'AFTER_MEAL', label: 'After meal' },
];

const dosageSchema = z.object({
  amount: z.number().positive(),
  unit: z.enum(['mg', 'ml', 'tab', 'caps', 'drops', 'sprays']),
});

const dosageInstructionSchema = z.object({
  dose: dosageSchema,
  frequency: z.enum(['QD', 'BID', 'TID', 'QID', 'QHS', 'QAM', 'QPM', 'QOD', 'PRN']),
  timesOfDay: z.array(z.string()).optional(),
  when: z.array(z.enum(['MORN', 'NOON', 'EVE', 'NIGHT', 'BEFORE_MEAL', 'AFTER_MEAL'])).optional(),
  durationDays: z.number().positive().optional(),
  prn: z.boolean().optional(),
});

const medicationPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  strength: z.string().optional(),
  route: z
    .enum(['po', 'im', 'iv', 'inh', 'sl', 'topical', 'nasal', 'oph'])
    .optional(),
  notes: z.string().optional(),
  instructions: z.array(dosageInstructionSchema).min(1),
});

export default function ReviewScreen() {
  const router = useRouter();
  const draft = useAppStore((state) => state.draft);
  const setDraftText = useAppStore((state) => state.setDraftText);
  const setDraftPlans = useAppStore((state) => state.setDraftPlans);

  const [text, setText] = useState(() => draft.rawText);
  const [plans, setPlans] = useState<MedicationPlan[]>(() => draft.parsed);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setText(draft.rawText);
  }, [draft.rawText]);

  useEffect(() => {
    setPlans(draft.parsed);
  }, [draft.parsed]);

  const parseText = useCallback(
    (sourceText: string) => {
      const result = parsePrescriptionText(sourceText);
      setPlans(result);
      setDraftPlans(result);
      setErrorMessage(result.length ? null : 'Parser did not find any medications.');
    },
    [setDraftPlans],
  );

  const handleParse = () => {
    if (!text.trim()) {
      setErrorMessage('Paste or capture your prescription first.');
      return;
    }
    parseText(text);
  };

  const handleSample = () => {
    setText(SAMPLE_TEXT);
    parseText(SAMPLE_TEXT);
  };

  const updatePlan = useCallback((updated: MedicationPlan) => {
    setPlans((current) => current.map((plan) => (plan.id === updated.id ? updated : plan)));
  }, []);

  const validatePlans = useCallback(() => {
    try {
      medicationPlanSchema.array().min(1).parse(plans);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrorMessage(error.issues[0]?.message ?? 'Validation failed.');
      } else {
        setErrorMessage('Unable to validate entries.');
      }
      return false;
    }
  }, [plans]);

  const goToSchedule = () => {
    if (!plans.length) {
      setErrorMessage('Add at least one medication to continue.');
      return;
    }

    if (!validatePlans()) {
      return;
    }

    setDraftText(text);
    setDraftPlans(plans);
    router.push('/schedule');
  };

  const parsedCountLabel = useMemo(() => {
    if (!plans.length) {
      return 'No medications parsed yet.';
    }
    return `${plans.length} medication${plans.length > 1 ? 's' : ''} ready.`;
  }, [plans.length]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen options={{ title: 'Review & Edit' }} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.subtitle, { color: theme.colors.text }]}>Raw OCR text</Text>
          <TextInput
            accessibilityLabel="Prescription text"
            multiline
            value={text}
            onChangeText={(value) => {
              setText(value);
              setDraftText(value);
            }}
            placeholder="Paste or capture prescription text"
            style={{
              minHeight: 160,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              textAlignVertical: 'top',
            }}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <SecondaryButton label="Insert sample" onPress={handleSample} />
            <PrimaryButton label="Run parser" onPress={handleParse} />
          </View>
          <Text style={{ color: theme.colors.textMuted }}>{parsedCountLabel}</Text>
          {errorMessage ? <Text style={{ color: theme.colors.warning }}>{errorMessage}</Text> : null}
        </View>

        {plans.map((plan) => (
          <MedicationCard key={plan.id} plan={plan} onChange={updatePlan} />
        ))}
      </ScrollView>
      <View style={{ padding: theme.spacing.lg, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
        <PrimaryButton label="Next: Schedule" onPress={goToSchedule} />
      </View>
    </View>
  );
}

type MedicationCardProps = {
  plan: MedicationPlan;
  onChange: (plan: MedicationPlan) => void;
};

const MedicationCard = ({ plan, onChange }: MedicationCardProps) => {
  const instruction = plan.instructions[0];

  const updateInstruction = (changes: Partial<DosageInstruction>) => {
    const nextInstruction = { ...instruction, ...changes };
    if (nextInstruction.frequency !== 'PRN') {
      nextInstruction.prn = undefined;
    } else {
      nextInstruction.prn = true;
    }
    onChange({ ...plan, instructions: [nextInstruction] });
  };

  const toggleTiming = (value: TimingWhen) => {
    const existing = instruction.when ?? [];
    const hasValue = existing.includes(value);
    const next = hasValue ? existing.filter((item) => item !== value) : [...existing, value];
    updateInstruction({ when: next.length ? next : undefined });
  };

  return (
    <View
      style={{
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface,
        gap: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <TextInput
        value={plan.name}
        onChangeText={(name) => onChange({ ...plan, name })}
        placeholder="Medication name"
        style={inputStyle}
      />
      <TextInput
        value={plan.strength ?? ''}
        onChangeText={(strength) => onChange({ ...plan, strength })}
        placeholder="Strength (e.g. 500 mg)"
        style={inputStyle}
      />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>Dose amount</Text>
          <TextInput
            value={instruction.dose.amount.toString()}
            keyboardType="decimal-pad"
            onChangeText={(value) => {
              const amount = Number.parseFloat(value) || instruction.dose.amount;
              updateInstruction({ dose: { ...instruction.dose, amount } });
            }}
            style={inputStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>Unit</Text>
          <TextInput
            value={instruction.dose.unit}
            onChangeText={(unit) =>
              updateInstruction({ dose: { ...instruction.dose, unit: unit as DosageInstruction['dose']['unit'] } })
            }
            style={inputStyle}
          />
        </View>
      </View>

      <View>
        <Text style={labelStyle}>Frequency</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {frequencyOptions.map((option) => {
            const selected = instruction.frequency === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => updateInstruction({ frequency: option.value })}
                style={{
                  paddingVertical: theme.spacing.xs,
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radius.sm,
                  backgroundColor: selected ? theme.colors.primary : theme.colors.background,
                  borderWidth: 1,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                }}
              >
                <Text style={{ color: selected ? '#fff' : theme.colors.text }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text style={labelStyle}>Duration (days)</Text>
        <TextInput
          value={instruction.durationDays?.toString() ?? ''}
          keyboardType="number-pad"
          onChangeText={(value) => {
            const duration = Number.parseInt(value, 10);
            updateInstruction({ durationDays: Number.isFinite(duration) ? duration : undefined });
          }}
          style={inputStyle}
        />
      </View>

      <View>
        <Text style={labelStyle}>Times of day (HH:MM, comma separated)</Text>
        <TextInput
          value={(instruction.timesOfDay ?? []).join(', ')}
          onChangeText={(value) => {
            const cleaned = value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean);
            updateInstruction({ timesOfDay: cleaned.length ? cleaned : undefined });
          }}
          placeholder="08:00, 20:00"
          style={inputStyle}
        />
      </View>

      <View>
        <Text style={labelStyle}>Timing hints</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {timingOptions.map((option) => {
            const selected = (instruction.when ?? []).includes(option.value);
            return (
              <Pressable
                key={option.value}
                onPress={() => toggleTiming(option.value)}
                style={{
                  paddingVertical: theme.spacing.xs,
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radius.sm,
                  backgroundColor: selected ? theme.colors.primaryMuted : theme.colors.background,
                  borderWidth: 1,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                }}
              >
                <Text style={{ color: selected ? theme.colors.primary : theme.colors.text }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextInput
        value={plan.notes ?? ''}
        onChangeText={(notes) => onChange({ ...plan, notes })}
        placeholder="Notes"
        style={inputStyle}
      />
    </View>
  );
};

const inputStyle = {
  borderRadius: theme.radius.sm,
  borderWidth: 1,
  borderColor: theme.colors.border,
  padding: theme.spacing.sm,
  backgroundColor: '#fff',
};

const labelStyle = {
  color: theme.colors.textMuted,
  marginBottom: theme.spacing.xs,
  fontSize: 12,
  textTransform: 'uppercase' as const,
};

type ButtonProps = {
  label: string;
  onPress: () => void;
};

function PrimaryButton({ label, onPress }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
    }}
  >
      <Text style={{ color: '#fff', fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      flex: 1,
    }}
  >
      <Text style={{ color: theme.colors.text }}>{label}</Text>
    </Pressable>
  );
}
