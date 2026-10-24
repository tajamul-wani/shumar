/**
 * The worked example on the home page. The person is made up; every number comes from the same
 * code the app runs on real answers, and the food is a real USDA entry, so nothing is invented.
 */
import { scaleNutrients, type FoodUnit, type Nutrients } from './nutrition.ts'
import {
  ACTIVITY_PAL,
  FAT_SHARE,
  LOSS_DEFICIT_KCAL,
  PROTEIN_G_PER_KG,
  dailyTargets,
  restingKcal,
  type DailyTargets,
  type Profile,
} from './targets.ts'

export const EXAMPLE_PROFILE: Profile = {
  sex: 'male',
  ageYears: 30,
  heightCm: 175,
  weightKg: 80,
  activity: 'light',
  goal: { kind: 'lose', kgPerWeek: 0.5 },
}

/** USDA FoodData Central, SR Legacy, food 171287, as imported into the database. */
export const EXAMPLE_FOOD = {
  name: 'Egg, whole, raw, fresh',
  source: 'USDA FoodData Central, SR Legacy, food 171287',
  per100g: { kcal: 143, protein: 12.56, carbs: 0.72, fat: 9.51, sodiumMg: 142 } satisfies Nutrients,
  unit: { name: 'large', grams: 50 } satisfies FoodUnit,
}

export interface ExampleStep {
  /** The working, in words. */
  working: string
  /** The result, with its unit. */
  result: string
  /** Which color the result takes: the calorie saffron, a macro, or none. */
  tone: 'kcal' | 'protein' | 'carbs' | 'fat' | null
}

const whole = (n: number) => Math.round(n).toLocaleString('en-US')

/** The target formula for the example person, one line per step, ending in the targets. */
export function exampleSteps(profile = EXAMPLE_PROFILE): { steps: ExampleStep[]; targets: DailyTargets } {
  const resting = restingKcal(profile)
  const maintenance = resting * ACTIVITY_PAL[profile.activity]
  const targets = dailyTargets(profile)
  const deficit = profile.goal.kind === 'lose' ? LOSS_DEFICIT_KCAL[profile.goal.kgPerWeek] : 0
  const steps: ExampleStep[] = [
    {
      working: `10 × ${profile.weightKg} kg + 6.25 × ${profile.heightCm} cm − 5 × ${profile.ageYears} years + 5`,
      result: `${whole(resting)} kcal at rest`,
      tone: null,
    },
    {
      working: `× ${ACTIVITY_PAL[profile.activity]} for light activity`,
      result: `${whole(maintenance)} kcal to stay the same`,
      tone: null,
    },
    {
      working: `− ${deficit} kcal a day to lose ${profile.goal.kind === 'lose' ? profile.goal.kgPerWeek : 0} kg a week`,
      result: `${whole(targets.kcal)} kcal a day`,
      tone: 'kcal',
    },
    {
      working: `Protein: ${PROTEIN_G_PER_KG} g for every kg you weigh`,
      result: `${whole(targets.protein)} g`,
      tone: 'protein',
    },
    {
      working: `Fat: ${FAT_SHARE * 100}% of the calories, at 9 kcal a gram`,
      result: `${whole(targets.fat)} g`,
      tone: 'fat',
    },
    {
      working: 'Carbs: the calories left, at 4 kcal a gram',
      result: `${whole(targets.carbs)} g`,
      tone: 'carbs',
    },
  ]
  return { steps, targets }
}

/** What `count` of the example food comes to, from its per-100 g values. */
export function exampleServing(count: number): { grams: number; nutrients: Nutrients } {
  const grams = count * EXAMPLE_FOOD.unit.grams
  return { grams, nutrients: scaleNutrients(EXAMPLE_FOOD.per100g, grams) }
}
