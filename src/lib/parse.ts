import { MedicationPlan, DosageInstruction, Frequency, TimingWhen } from '../types';

const STRENGTH_REGEX = /(\d+(?:[.,]\d+)?)\s?(mg|мг|ml|мл)/i;
const DURATION_REGEX = /(\d+)\s?(?:days?|сут|дн(?:ей|я)?)/i;
const DOSE_REGEX = /(\d+(?:[.,]\d+)?)\s*(таб(?:летка|летки|леток)?|табл\.?|tab(?:let)?s?|капс(?:ула|улы)?|caps?(?:ule)?s?|drops?|капли|sprays?|спрей(?:ы|)|ml|мл|mg|мг)/i;
const TIME_REGEX = /(\d{1,2})[:.](\d{2})/g;

const FREQUENCY_PATTERNS: { regex: RegExp; value: Frequency }[] = [
  { regex: /\b(qd|once daily|1\s*(?:time a day|раз(?:а)? в день)|ежедневно)\b/i, value: 'QD' },
  { regex: /\b(bid|2x\/?day|2\s*(?:times a day|раз(?:а)? в день|р\/?д))\b/i, value: 'BID' },
  { regex: /\b(tid|3x\/?day|3\s*(?:times a day|р\/?д))\b/i, value: 'TID' },
  { regex: /\b(qid|4x\/?day|4\s*(?:times a day|р\/?д))\b/i, value: 'QID' },
  { regex: /\b(qhs|at\s+night|на\s+ночь)\b/i, value: 'QHS' },
  { regex: /\b(qam|in\s+the\s+morning|утром)\b/i, value: 'QAM' },
  { regex: /\b(qpm|in\s+the\s+evening|вечером)\b/i, value: 'QPM' },
  { regex: /\b(every other day|через день)\b/i, value: 'QOD' },
  { regex: /\b(as needed|по\s+(?:требованию|необходимости))\b/i, value: 'PRN' },
];

const WHEN_PATTERNS: { regex: RegExp; value: TimingWhen }[] = [
  { regex: /before meals?|до\s+еды/i, value: 'BEFORE_MEAL' },
  { regex: /after meals?|после\s+еды/i, value: 'AFTER_MEAL' },
  { regex: /\bmorning|утром\b/i, value: 'MORN' },
  { regex: /\bnoon|дн[её]м\b/i, value: 'NOON' },
  { regex: /\bevening|вечером\b/i, value: 'EVE' },
  { regex: /\bnight|ночью\b/i, value: 'NIGHT' },
];

const ROUTE_PATTERNS: { regex: RegExp; value: NonNullable<MedicationPlan['route']> }[] = [
  { regex: /\b(po|per os|by mouth)\b/i, value: 'po' },
  { regex: /\bim\b/i, value: 'im' },
  { regex: /\biv\b/i, value: 'iv' },
  { regex: /\binhal(e|ation)|inh\b/i, value: 'inh' },
  { regex: /sublingual|под язык|sl\b/i, value: 'sl' },
  { regex: /topical|наружно/i, value: 'topical' },
  { regex: /nasal|intranasal|спрей/i, value: 'nasal' },
  { regex: /ophthalmic|глазные/i, value: 'oph' },
];

const DOSE_UNIT_MAP: Record<string, DosageInstruction['dose']['unit']> = {
  таб: 'tab',
  таблетки: 'tab',
  таблетка: 'tab',
  табл: 'tab',
  tab: 'tab',
  tabs: 'tab',
  tablet: 'tab',
  tablets: 'tab',
  капсула: 'caps',
  капс: 'caps',
  капсулы: 'caps',
  cap: 'caps',
  caps: 'caps',
  capsule: 'caps',
  capsules: 'caps',
  drop: 'drops',
  drops: 'drops',
  капли: 'drops',
  spray: 'sprays',
  sprays: 'sprays',
  спрей: 'sprays',
  ml: 'ml',
  мл: 'ml',
  mg: 'mg',
  мг: 'mg',
};

const stripBullet = (line: string) => line.replace(/^[-•–—\d.\)\s]+/, '').trim();

const normalizeNumber = (value: string): number => {
  const normalized = value.replace(',', '.');
  return Number.parseFloat(normalized);
};

const collectBlocks = (raw: string): string[][] => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, array) => (line.length === 0 && array[index - 1]?.length === 0 ? false : true));

  const blocks: string[][] = [];
  let current: string[] = [];

  const isNewMedicationLine = (line: string) => {
    if (!line) {
      return false;
    }
    const trimmed = stripBullet(line);
    const hasStrength = STRENGTH_REGEX.test(line);
    const hasKeywords = /(mg|мг|ml|мл)/i.test(line);
    const looksLikeHeader = /^[A-Za-zА-ЯЁ]/.test(trimmed);
    return (hasStrength || hasKeywords) && looksLikeHeader;
  };

  lines.forEach((line) => {
    if (line.length === 0) {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
      return;
    }

    if (current.length && isNewMedicationLine(line)) {
      blocks.push(current);
      current = [line];
      return;
    }

    current.push(line);
  });

  if (current.length) {
    blocks.push(current);
  }

  return blocks;
};

const detectFrequency = (text: string): Frequency | undefined => {
  for (const pattern of FREQUENCY_PATTERNS) {
    if (pattern.regex.test(text)) {
      return pattern.value;
    }
  }
  if (/\b(?:three times|три раза)\b/i.test(text)) {
    return 'TID';
  }
  if (/\b(?:twice|два раза)\b/i.test(text)) {
    return 'BID';
  }
  if (/\b(?:once|один раз)\b/i.test(text)) {
    return 'QD';
  }
  return undefined;
};

const detectWhen = (text: string): TimingWhen[] | undefined => {
  const matches = WHEN_PATTERNS.filter((pattern) => pattern.regex.test(text)).map((pattern) => pattern.value);
  return matches.length ? Array.from(new Set(matches)) : undefined;
};

const detectRoute = (text: string): MedicationPlan['route'] | undefined => {
  for (const pattern of ROUTE_PATTERNS) {
    if (pattern.regex.test(text)) {
      return pattern.value;
    }
  }
  return undefined;
};

const parseDose = (text: string): DosageInstruction['dose'] | undefined => {
  const match = text.match(DOSE_REGEX);
  if (!match) {
    return undefined;
  }
  const amount = normalizeNumber(match[1]);
  const unitCandidate = match[2].toLowerCase();
  const unit =
    DOSE_UNIT_MAP[unitCandidate] ||
    (unitCandidate.includes('mg') ? 'mg' : unitCandidate.includes('ml') ? 'ml' : undefined);

  if (!unit || Number.isNaN(amount)) {
    return undefined;
  }

  return { amount, unit } as DosageInstruction['dose'];
};

const parseDuration = (text: string): number | undefined => {
  const match = text.match(DURATION_REGEX);
  if (!match) {
    return undefined;
  }
  return Number.parseInt(match[1], 10) || undefined;
};

const extractTimes = (text: string): string[] | undefined => {
  const matches = [...text.matchAll(TIME_REGEX)].map((match) => {
    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return undefined;
    }
    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    return `${hh}:${mm}`;
  });
  const filtered = matches.filter((value): value is string => Boolean(value));
  return filtered.length ? Array.from(new Set(filtered)) : undefined;
};

const extractStrength = (text: string): string | undefined => {
  const match = text.match(STRENGTH_REGEX);
  if (!match) {
    return undefined;
  }
  const amount = normalizeNumber(match[1]);
  const unit = match[2];
  return Number.isNaN(amount) ? undefined : `${amount} ${unit}`;
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\d]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const makePlanId = (name: string, ordinal: number) => {
  const base = slug(name) || `med-${ordinal + 1}`;
  return `plan-${base}-${hashString(`${base}-${ordinal}`)}`;
};

const buildInstruction = (text: string): DosageInstruction => {
  const dose = parseDose(text) ?? { amount: 1, unit: 'tab' };
  const explicitPrn = /\b(as needed|по\s+(?:требованию|необходимости))\b/i.test(text);
  const detectedFrequency = detectFrequency(text);
  const frequency: Frequency = explicitPrn ? 'PRN' : detectedFrequency ?? 'QD';
  const times = extractTimes(text);
  const when = detectWhen(text);
  const duration = parseDuration(text);

  return {
    dose,
    frequency,
    timesOfDay: times?.sort(),
    when,
    durationDays: duration,
    prn: frequency === 'PRN' ? true : undefined,
  };
};

const sanitizeName = (header: string): string => {
  if (!header) {
    return '';
  }

  const withoutContext = (() => {
    const colonIndex = header.indexOf(':');
    if (colonIndex >= 0) {
      const candidate = header.slice(colonIndex + 1).trim();
      if (STRENGTH_REGEX.test(candidate) || /\p{L}+\s+\d+/u.test(candidate)) {
        return candidate;
      }
    }
    return header;
  })();

  const cleaned = stripBullet(withoutContext)
    .replace(STRENGTH_REGEX, '')
    .replace(/[–—-].*/, '')
    .replace(/\b(?:take|принимать|at night|утром|вечером|ночью)\b/gi, '')
    .trim();

  return cleaned.replace(/\s{2,}/g, ' ').trim();
};

const buildPlanFromBlock = (lines: string[], ordinal: number): MedicationPlan | null => {
  const normalizedLines = lines.map(stripBullet).filter(Boolean);
  if (!normalizedLines.length) {
    return null;
  }

  const header = sanitizeName(normalizedLines[0]);
  const name = header.length ? header : `Medication ${ordinal + 1}`;
  const plainText = normalizedLines.join(' ');
  const strength = extractStrength(plainText);
  const route = detectRoute(plainText);
  const instruction = buildInstruction(plainText);

  return {
    id: makePlanId(name, ordinal),
    name,
    strength,
    route,
    instructions: [instruction],
  };
};

export const parsePrescriptionText = (raw: string): MedicationPlan[] => {
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  const blocks = collectBlocks(raw);
  const plans: MedicationPlan[] = [];

  blocks.forEach((block, index) => {
    const plan = buildPlanFromBlock(block, index);
    if (plan) {
      plans.push(plan);
    }
  });

  return plans;
};
