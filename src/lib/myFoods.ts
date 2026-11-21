import type { SupabaseClient } from '@supabase/supabase-js'
import { parseDecimal } from './foodDisplay.ts'
import type { FoodResult, FoodUnit } from './foodSearch.ts'
import { LogError, limitMessage, numberIn, textUpTo } from './logs.ts'
import type { Minerals, Nutrients } from './nutrition.ts'

/**
 * A person's own foods, added from the label on a pack when search can't find them. Row-level
 * security keeps each person's foods to themselves (supabase/migrations/20261029100000_my_foods.sql).
 * The values stay as the label prints them, per 100 g or per serving, so the person can check them
 * against the pack later; everything the app works out uses the values per 100 g.
 */

export const MAX_MY_FOODS = 500
export const MAX_MY_FOOD_NAME = 80
export const MAX_BRAND = 60
const MAX_SERVING_GRAMS = 5000
/** The name of the unit a food with a serving size gets, as search_foods names it. */
export const SERVING_UNIT = '1 serving'

/** What the label's values are for: 100 g, or one serving. */
export type LabelBasis = '100g' | 'serving'

/**
 * What a label prints. Calories, protein, carbs and fat are always there; sodium, calcium,
 * magnesium and vitamin D are optional, and null when the pack lists none (never a zero).
 */
export interface LabelValues {
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** In mg. */
  sodiumMg: number | null
  /** In mg. */
  calciumMg: number | null
  /** In mg. */
  magnesiumMg: number | null
  /** In micrograms. */
  vitaminDMcg: number | null
}

/** A food as its label gives it. */
export interface MyFoodInput {
  name: string
  brand: string | null
  basis: LabelBasis
  /** Grams in one serving, when the label's values are per serving. */
  servingGrams: number | null
  /** As the label prints them, for 100 g or for one serving. */
  label: LabelValues
}

export interface MyFood extends MyFoodInput {
  id: string
}

/** What the person typed in the form, as text. */
export interface MyFoodDraft {
  name: string
  brand: string
  basis: LabelBasis
  servingGrams: string
  kcal: string
  protein: string
  carbs: string
  fat: string
  sodiumMg: string
  calciumMg: string
  magnesiumMg: string
  vitaminDMcg: string
}

/** Where a problem in the form shows: beside a field, or under the protein, carbs and fat together. */
export type DraftProblem = Exclude<keyof MyFoodDraft, 'basis'> | 'macros'

export type DraftCheck =
  { food: MyFoodInput; problems: null } | { food: null; problems: Partial<Record<DraftProblem, string>> }

export const EMPTY_DRAFT: MyFoodDraft = {
  name: '',
  brand: '',
  basis: '100g',
  servingGrams: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  sodiumMg: '',
  calciumMg: '',
  magnesiumMg: '',
  vitaminDMcg: '',
}

/** Always on a label. */
const VALUE_FIELDS = [
  ['kcal', 'calories'],
  ['protein', 'protein'],
  ['carbs', 'carbs'],
  ['fat', 'fat'],
] as const

/**
 * Optional: left empty when the pack lists nothing. The most a food can hold per 100 g, as the
 * database holds to it, and the unit to check when a value looks too big.
 */
const OPTIONAL_FIELDS = [
  { field: 'sodiumMg', word: 'sodium', unit: 'mg', max: 40000 },
  { field: 'calciumMg', word: 'calcium', unit: 'mg', max: 10000 },
  { field: 'magnesiumMg', word: 'magnesium', unit: 'mg', max: 5000 },
  { field: 'vitaminDMcg', word: 'vitamin D', unit: 'mcg', max: 5000 },
] as const

/** One line, single spaces, no spaces around it: how names and brands are kept. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** The text a number is shown with in the form: up to two decimal places, no trailing zeros. */
function draftNumber(value: number | null): string {
  return value === null ? '' : String(Math.round(value * 100) / 100)
}

/** A saved food as the form shows it again, for a change. */
export function toDraft(food: MyFoodInput): MyFoodDraft {
  return {
    name: food.name,
    brand: food.brand ?? '',
    basis: food.basis,
    servingGrams: draftNumber(food.servingGrams),
    kcal: draftNumber(food.label.kcal),
    protein: draftNumber(food.label.protein),
    carbs: draftNumber(food.label.carbs),
    fat: draftNumber(food.label.fat),
    sodiumMg: draftNumber(food.label.sodiumMg),
    calciumMg: draftNumber(food.label.calciumMg),
    magnesiumMg: draftNumber(food.label.magnesiumMg),
    vitaminDMcg: draftNumber(food.label.vitaminDMcg),
  }
}

/** The grams the label's values are for. */
function basisGrams(food: Pick<MyFoodInput, 'basis' | 'servingGrams'>): number {
  return food.basis === 'serving' && food.servingGrams ? food.servingGrams : 100
}

/** The label's values worked out per 100 g, at full precision. Sodium the pack did not list counts as 0. */
export function per100g(food: MyFoodInput): Nutrients {
  const scale = 100 / basisGrams(food)
  const { kcal, protein, carbs, fat, sodiumMg } = food.label
  return {
    kcal: kcal * scale,
    protein: protein * scale,
    carbs: carbs * scale,
    fat: fat * scale,
    sodiumMg: (sodiumMg ?? 0) * scale,
  }
}

/** Calcium, magnesium and vitamin D per 100 g, null where the pack lists none. */
export function mineralsPer100g(food: MyFoodInput): Minerals {
  const scale = 100 / basisGrams(food)
  const per100 = (value: number | null) => (value === null ? null : value * scale)
  return {
    calciumMg: per100(food.label.calciumMg),
    magnesiumMg: per100(food.label.magnesiumMg),
    vitaminDMcg: per100(food.label.vitaminDMcg),
  }
}

/**
 * Reads the form. Every value must come from the label, so none is filled in for the person: a
 * missing one is a problem to fix, as is any value no food can have per 100 g, the same limits the
 * database holds to.
 */
export function readDraft(draft: MyFoodDraft): DraftCheck {
  const problems: Partial<Record<DraftProblem, string>> = {}
  const name = oneLine(draft.name)
  const brand = oneLine(draft.brand)
  if (!name) problems.name = 'Give the food a name.'
  else if (name.length > MAX_MY_FOOD_NAME) problems.name = `Keep the name to ${MAX_MY_FOOD_NAME} characters.`
  if (brand.length > MAX_BRAND) problems.brand = `Keep the brand to ${MAX_BRAND} characters.`

  let servingGrams: number | null = null
  if (draft.basis === 'serving') {
    servingGrams = parseDecimal(draft.servingGrams)
    if (servingGrams === null || servingGrams <= 0 || servingGrams > MAX_SERVING_GRAMS) {
      problems.servingGrams = 'Enter the grams or ml in one serving, as the label gives them.'
      servingGrams = null
    }
  }

  const label: Partial<LabelValues> = {}
  for (const [field, word] of VALUE_FIELDS) {
    const text = draft[field].trim()
    const value = parseDecimal(text)
    if (!text) problems[field] = `Enter the ${word} from the label.`
    else if (value === null) problems[field] = 'Use a number, such as 12.5.'
    else label[field] = value
  }
  // Optional: empty means the pack lists none, which is kept as not listed and never as 0.
  for (const { field } of OPTIONAL_FIELDS) {
    const text = draft[field].trim()
    const value = parseDecimal(text)
    if (!text) label[field] = null
    else if (value === null) problems[field] = 'Use a number, such as 12.5.'
    else label[field] = value
  }

  const grams = draft.basis === 'serving' ? servingGrams : 100
  if (grams !== null) {
    const scale = 100 / grams
    if (label.kcal !== undefined && label.kcal * scale > 1000) {
      problems.kcal = 'That is over 1,000 kcal per 100 g, more than any food has. Check the label.'
    }
    if (
      label.protein !== undefined &&
      label.carbs !== undefined &&
      label.fat !== undefined &&
      label.protein + label.carbs + label.fat > grams
    ) {
      problems.macros = 'Protein, carbs and fat weigh more than the food itself. Check the label.'
    }
    for (const { field, word, unit, max } of OPTIONAL_FIELDS) {
      const value = label[field]
      if (value != null && value * scale > max) {
        problems[field] =
          `That is over ${max.toLocaleString('en-US')} ${unit} of ${word} per 100 g. Check that it is in ${unit}.`
      }
    }
  }

  if (Object.keys(problems).length > 0) return { food: null, problems }
  return {
    food: { name, brand: brand || null, basis: draft.basis, servingGrams, label: label as LabelValues },
    problems: null,
  }
}

/**
 * When the calories are more than 20% off what the protein, carbs and fat give at 4, 4 and 9 kcal a
 * gram (the check every food in Shumār meets), the two numbers to show, as the label states them.
 */
export function caloriesMismatch(food: MyFoodInput): { fromMacros: number; entered: number } | null {
  const values = per100g(food)
  const fromMacros = 4 * values.protein + 4 * values.carbs + 9 * values.fat
  if (Math.abs(fromMacros - values.kcal) <= Math.max(0.2 * values.kcal, 4)) return null
  const { protein, carbs, fat, kcal } = food.label
  return { fromMacros: 4 * protein + 4 * carbs + 9 * fat, entered: kcal }
}

/** How the food reads in search and in a log: "Paneer, full fat (Amul)". */
export function displayName(food: Pick<MyFoodInput, 'name' | 'brand'>): string {
  return food.brand ? `${food.name} (${food.brand})` : food.name
}

/** The food in the shape search gives every food, so it is chosen and added like any other. */
export function toFoodResult(food: MyFood): FoodResult {
  const units: FoodUnit[] = [{ name: 'g', grams: 1 }]
  if (food.servingGrams) units.push({ name: SERVING_UNIT, grams: food.servingGrams })
  return {
    source: 'mine',
    sourceId: food.id,
    name: displayName(food),
    per100g: per100g(food),
    minerals: mineralsPer100g(food),
    ...(food.label.sodiumMg === null ? { sodiumListed: false } : {}),
    units,
    flagged: caloriesMismatch(food) !== null,
    verified: true,
  }
}

/** Checks one my_foods row, or returns null if anything in it doesn't make sense. */
export function parseMyFood(value: unknown): MyFood | null {
  const row = (value ?? {}) as Record<string, unknown>
  const id = textUpTo(row.id, 64)
  const name = textUpTo(row.name, MAX_MY_FOOD_NAME)
  const brand = row.brand == null ? null : textUpTo(row.brand, MAX_BRAND)
  const basis = row.label_basis === '100g' || row.label_basis === 'serving' ? row.label_basis : null
  const servingGrams = row.serving_grams == null ? null : numberIn(row.serving_grams, Number.MIN_VALUE, 5000)
  const kcal = numberIn(row.kcal, 0, 1e6)
  const protein = numberIn(row.protein, 0, 1e5)
  const carbs = numberIn(row.carbs, 0, 1e5)
  const fat = numberIn(row.fat, 0, 1e5)
  // The four optional values: null when the pack listed none, and a bad one rejects the row.
  const optional = (raw: unknown) => (raw == null ? null : numberIn(raw, 0, 1e7))
  const sodiumMg = optional(row.sodium_mg)
  const calciumMg = optional(row.calcium_mg)
  const magnesiumMg = optional(row.magnesium_mg)
  const vitaminDMcg = optional(row.vitamin_d_mcg)
  const badOptional = [
    [row.sodium_mg, sodiumMg],
    [row.calcium_mg, calciumMg],
    [row.magnesium_mg, magnesiumMg],
    [row.vitamin_d_mcg, vitaminDMcg],
  ].some(([raw, parsed]) => raw != null && parsed === null)
  if (
    !id ||
    !name ||
    (row.brand != null && !brand) ||
    !basis ||
    (basis === 'serving') !== (servingGrams !== null) ||
    kcal === null ||
    protein === null ||
    carbs === null ||
    fat === null ||
    badOptional
  ) {
    return null
  }
  return {
    id,
    name,
    brand,
    basis,
    servingGrams,
    label: { kcal, protein, carbs, fat, sodiumMg, calciumMg, magnesiumMg, vitaminDMcg },
  }
}

type MyFoodsClient = Pick<SupabaseClient, 'from'>

const COLUMNS =
  'id, name, brand, label_basis, serving_grams, kcal, protein, carbs, fat, sodium_mg, calcium_mg, magnesium_mg, vitamin_d_mcg'

/** Stored to two decimal places, as the table's columns hold them. */
const twoPlaces = (value: number) => Math.round(value * 100) / 100

const optionalTwoPlaces = (value: number | null) => (value === null ? null : twoPlaces(value))

function columns(food: MyFoodInput) {
  return {
    name: food.name,
    brand: food.brand,
    label_basis: food.basis,
    serving_grams: food.servingGrams === null ? null : twoPlaces(food.servingGrams),
    kcal: twoPlaces(food.label.kcal),
    protein: twoPlaces(food.label.protein),
    carbs: twoPlaces(food.label.carbs),
    fat: twoPlaces(food.label.fat),
    sodium_mg: optionalTwoPlaces(food.label.sodiumMg),
    calcium_mg: optionalTwoPlaces(food.label.calciumMg),
    magnesium_mg: optionalTwoPlaces(food.label.magnesiumMg),
    vitamin_d_mcg: optionalTwoPlaces(food.label.vitaminDMcg),
  }
}

/** The plain message for a save the database refused, with a fallback for anything else. */
function saveProblem(error: { code?: string } | null, food: MyFoodInput, fallback: string): LogError {
  const limit = limitMessage(error)
  if (limit) return new LogError(limit)
  if (error?.code === '23505') return new LogError(`You already have ${displayName(food)}.`)
  return new LogError(fallback)
}

/** Every food of this person's own, by name. */
export async function fetchMyFoods(client: MyFoodsClient): Promise<MyFood[]> {
  const { data, error } = await client.from('my_foods').select(COLUMNS).order('name')
  if (error) throw new LogError("We couldn't load your foods. Check your connection and try again.")
  if (!Array.isArray(data)) return []
  return data.map(parseMyFood).filter((food): food is MyFood => food !== null)
}

/** Saves a food from its label as one of the person's own. */
export async function createMyFood(client: MyFoodsClient, food: MyFoodInput): Promise<MyFood> {
  const { data, error } = await client.from('my_foods').insert(columns(food)).select(COLUMNS).single()
  const saved = error ? null : parseMyFood(data)
  if (!saved)
    throw saveProblem(error, food, "We couldn't save this food. Check your connection and try again.")
  return saved
}

/** Changes one of the person's own foods. What they logged of it before keeps its old values. */
export async function updateMyFood(client: MyFoodsClient, id: string, food: MyFoodInput): Promise<MyFood> {
  const { data, error } = await client
    .from('my_foods')
    .update(columns(food))
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle()
  const saved = error ? null : parseMyFood(data)
  if (!saved)
    throw saveProblem(error, food, "We couldn't save your changes. Check your connection and try again.")
  return saved
}

/** Removes one of the person's own foods. What they logged of it stays. */
export async function removeMyFood(client: MyFoodsClient, id: string): Promise<void> {
  const { error } = await client.from('my_foods').delete().eq('id', id)
  if (error) throw new LogError("We couldn't remove this food. Check your connection and try again.")
}
