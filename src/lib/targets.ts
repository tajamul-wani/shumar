/**
 * Daily calorie and macro targets from the first-run answers. Every number
 * below comes from the guideline or paper cited next to it. Change one only
 * with a new source.
 */

import { KCAL_PER_GRAM } from './nutrition.ts'

export type Sex = 'female' | 'male'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very'
/** Weight-loss speed in kg a week. */
export type LossRate = 0.25 | 0.5 | 0.75

export type Goal =
  { kind: 'lose'; kgPerWeek: LossRate } | { kind: 'maintain' } | { kind: 'recomp' } | { kind: 'gain' }

export interface Profile {
  sex: Sex
  ageYears: number
  heightCm: number
  weightKg: number
  activity: ActivityLevel
  goal: Goal
}

export interface DailyTargets {
  /** Whole kcal to eat in a day. */
  kcal: number
  /** Whole grams in a day. */
  protein: number
  carbs: number
  fat: number
  /** Resting energy, whole kcal. */
  restingKcal: number
  /** Energy that keeps the current weight, whole kcal. */
  maintenanceKcal: number
  /** The safety floor raised a weight-loss target, so the loss will be slower than chosen. */
  atFloor: boolean
}

/**
 * Physical activity level: daily energy as a multiple of resting energy.
 * - sedentary: ICMR-NIN 2020, "Nutrient Requirements for Indians" (brief note).
 *   The sedentary level for Indians was lowered from 1.53 to 1.40.
 * - light, moderate, very: FAO/WHO/UNU 2004, "Human energy requirements",
 *   Table 5.1, the worked example for each lifestyle.
 */
export const ACTIVITY_PAL: Record<ActivityLevel, number> = {
  sedentary: 1.4,
  light: 1.53,
  moderate: 1.76,
  very: 2.25,
}

/**
 * Daily calorie gap for each weight-loss speed.
 * - NIH NHLBI 1998, "Clinical Guidelines on the Identification, Evaluation, and
 *   Treatment of Overweight and Obesity in Adults", pp. 73-74: a gap of 300 to
 *   500 kcal a day loses 280 to 490 g a week, 500 to 1,000 kcal loses 490 to 980 g.
 * - AHA/ACC/TOS 2013 obesity guideline (Circulation 2014;129 suppl 2:S102-38),
 *   recommendation 3a: a gap of 500 or 750 kcal a day.
 */
export const LOSS_DEFICIT_KCAL: Record<LossRate, number> = {
  0.25: 300,
  0.5: 500,
  0.75: 750,
}

/**
 * The lowest weight-loss target. AHA/ACC/TOS 2013, recommendation 3a, prescribes
 * 1,200 to 1,500 kcal a day for women and 1,500 to 1,800 for men.
 */
export const MIN_KCAL: Record<Sex, number> = { female: 1200, male: 1500 }

/**
 * Share over maintenance when gaining. Iraki et al. 2019, "Nutrition
 * Recommendations for Bodybuilders in the Off-Season", Sports 7(7):154: 10 to
 * 20% over maintenance for about 0.25 to 0.5% of body weight a week. Shumār
 * uses the low end.
 */
const GAIN_SURPLUS = 0.1

/**
 * Protein in g per kg of body weight.
 * - Morton et al. 2018, Br J Sports Med 52(6):376-84: no further muscle gain past
 *   about 1.6 g/kg. Inside the 1.4 to 2.0 of the ISSN 2017 position stand
 *   (Jäger et al., J Int Soc Sports Nutr 14:20).
 * - Body recomposition: 2.2, the top of the 1.6 to 2.2 in Iraki et al. 2019.
 */
const PROTEIN_G_PER_KG = 1.6
const RECOMP_PROTEIN_G_PER_KG = 2.2

/**
 * Shares of daily energy. IOM 2005, "Dietary Reference Intakes for Energy,
 * Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids":
 * protein 10 to 35% and fat 20 to 35% for adults. WHO healthy diet fact sheet:
 * total fat 30% or less. Carbs get the rest.
 */
const PROTEIN_MAX_SHARE = 0.35
const FAT_SHARE = 0.25

/**
 * Accepted answers. Every source above is for adults, and Mifflin-St Jeor was
 * built on people aged 19 to 78. The upper limits only catch typos.
 */
export const PROFILE_LIMITS = {
  ageYears: { min: 18, max: 100 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
} as const

const LABELS = { ageYears: 'Age', heightCm: 'Height', weightKg: 'Weight' } as const

function assertOneOf(value: unknown, options: object, label: string): void {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new RangeError(`${label} is not a known option, got ${String(value)}`)
  }
  if (!Object.hasOwn(options, value)) {
    throw new RangeError(`${label} is not a known option, got ${value}`)
  }
}

/** Answers can come from device storage or the database, so check them at run time too. */
function checkProfile(profile: Profile): void {
  for (const key of ['ageYears', 'heightCm', 'weightKg'] as const) {
    const value = profile[key]
    const { min, max } = PROFILE_LIMITS[key]
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`${LABELS[key]} must be between ${min} and ${max}, got ${value}`)
    }
  }
  assertOneOf(profile.sex, MIN_KCAL, 'Sex')
  assertOneOf(profile.activity, ACTIVITY_PAL, 'Activity level')
  if (profile.goal?.kind === 'lose') {
    assertOneOf(profile.goal.kgPerWeek, LOSS_DEFICIT_KCAL, 'Weight-loss speed')
  } else if (!['maintain', 'recomp', 'gain'].includes(profile.goal?.kind)) {
    throw new RangeError(`Goal is not a known option, got ${String(profile.goal?.kind)}`)
  }
}

/** Resting energy in kcal a day: Mifflin et al. 1990, Am J Clin Nutr 51(2):241-7. */
export function restingKcal({ sex, ageYears, heightCm, weightKg }: Profile): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === 'male' ? 5 : -161)
}

function goalKcal(maintenance: number, { goal, sex }: Profile): { kcal: number; atFloor: boolean } {
  switch (goal.kind) {
    case 'lose': {
      const wanted = maintenance - LOSS_DEFICIT_KCAL[goal.kgPerWeek]
      // A floor above maintenance would make a weight-loss target gain weight.
      const floor = Math.min(MIN_KCAL[sex], maintenance)
      return wanted < floor ? { kcal: floor, atFloor: true } : { kcal: wanted, atFloor: false }
    }
    case 'gain':
      return { kcal: maintenance * (1 + GAIN_SURPLUS), atFloor: false }
    case 'maintain':
    case 'recomp':
      return { kcal: maintenance, atFloor: false }
  }
}

/** Daily targets for a profile. Full precision inside, whole numbers out. */
export function dailyTargets(profile: Profile): DailyTargets {
  checkProfile(profile)
  const resting = restingKcal(profile)
  const maintenance = resting * ACTIVITY_PAL[profile.activity]
  const { kcal, atFloor } = goalKcal(maintenance, profile)

  const perKg = profile.goal.kind === 'recomp' ? RECOMP_PROTEIN_G_PER_KG : PROTEIN_G_PER_KG
  const protein = Math.min(perKg * profile.weightKg, (kcal * PROTEIN_MAX_SHARE) / KCAL_PER_GRAM.protein)
  const fat = (kcal * FAT_SHARE) / KCAL_PER_GRAM.fat
  const carbs = (kcal - protein * KCAL_PER_GRAM.protein - fat * KCAL_PER_GRAM.fat) / KCAL_PER_GRAM.carbs

  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    restingKcal: Math.round(resting),
    maintenanceKcal: Math.round(maintenance),
    atFloor,
  }
}
