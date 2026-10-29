import { ChevronLeft, Info, Minus, Plus } from 'lucide-react'
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'wouter'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { Chip } from '../components/Chip.tsx'
import {
  amountLabel,
  defaultQuantity,
  formatNumber,
  isEstimate,
  nutrientsFor,
  parseQuantity,
  quantityStep,
  unitHint,
} from '../lib/foodDisplay.ts'
import type { FoodResult, FoodUnit } from '../lib/foodSearch.ts'
import { MAX_QUANTITY } from '../lib/logs.ts'
import { useSheetFill } from './fill.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'
/** Up to this many units show as chips; more (USDA portions can run to ten) fit better in a list. */
const MAX_UNIT_CHIPS = 4

const unitLabel = (unit: FoodUnit) => (unit.name === 'g' ? 'Grams' : unit.name)

const STEP_BUTTON = `flex size-13 shrink-0 items-center justify-center rounded-xl border border-koshur-border text-koshur-silk disabled:opacity-60 ${FOCUS_RING}`

function twoPlaces(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Why the values are an estimate, and where to read how they were worked out. A food of the
 * person's own comes from their pack, so the note sends them back to its label instead.
 */
function EstimateNote({ food }: { food: FoodResult }) {
  const fill = useSheetFill()
  const own = food.source === 'mine'
  const [title, body] = own
    ? [
        "These numbers don't add up",
        "The calories don't match the protein, carbs and fat as closely as a label's should. Check them against the pack, and change them if one is off.",
      ]
    : food.flagged
      ? [
          'Estimate, these values may be off',
          "The calories for this food don't match its protein, carbs and fat as closely as we expect, so treat them as a guide.",
        ]
      : [
          'Estimate, home recipes vary',
          'Worked out from a weighed recipe and not yet confirmed by a second weighing. Oil and meat cuts change the numbers most.',
        ]
  return (
    <div className={`flex gap-3 rounded-2xl border border-koshur-border ${fill} px-4 py-3.5`}>
      <Info
        aria-hidden="true"
        size={20}
        strokeWidth={2}
        className="mt-0.5 size-4 sm:size-5 shrink-0 text-koshur-muted"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="m-0 text-body-sm font-semibold text-koshur-silk">{title}</p>
        <p className="m-0 text-body-sm text-koshur-muted">{body}</p>
        {!own && (
          <Link
            href="/sources"
            className={`flex min-h-8 items-center self-start rounded-sm text-body-sm font-semibold text-koshur-silk underline ${FOCUS_RING}`}
          >
            How this is calculated
          </Link>
        )}
      </div>
    </div>
  )
}

const MACROS = [
  { key: 'protein', label: 'Protein', bar: 'bg-macro-protein' },
  { key: 'carbs', label: 'Carbs', bar: 'bg-macro-carb' },
  { key: 'fat', label: 'Fat', bar: 'bg-macro-fat' },
] as const

interface FoodDetailProps {
  /** 1 on a screen of its own, 2 inside another screen. */
  headingLevel?: 1 | 2
  food: FoodResult
  initialUnit: FoodUnit
  initialQuantity: number
  /** The main button, such as "Add to dinner" or "Save changes". */
  actionLabel: string
  /** The main button while it works, such as "Adding" or "Saving". */
  busyLabel: string
  backLabel: string
  saving: boolean
  error: string | null
  /** Shown above the unit, such as the meal when changing a logged food. */
  children?: ReactNode
  onBack: () => void
  /** quantity is NaN when the amount typed isn't a number, so the log check explains it. */
  onSubmit: (unit: FoodUnit, quantity: number) => void
}

/** A food: pick a unit and an amount, see the values, then add it or save the change. */
export function FoodDetail({
  headingLevel = 1,
  food,
  initialUnit,
  initialQuantity,
  actionLabel,
  busyLabel,
  backLabel,
  saving,
  error,
  children,
  onBack,
  onSubmit,
}: FoodDetailProps) {
  const [unit, setUnit] = useState(initialUnit)
  const [text, setText] = useState(() => String(initialQuantity))
  const Heading = headingLevel === 2 ? 'h2' : 'h1'
  const fill = useSheetFill()
  const quantityId = useId()
  const hintId = useId()
  const quantity = parseQuantity(text)
  const step = quantityStep(unit)
  const values = quantity === null ? null : nutrientsFor(food, quantity, unit)
  const estimate = isEstimate(food)
  const hint = unitHint(unit)
  // Household units first (katori, cup, piece), then grams, as the design orders them.
  const units = [...food.units.filter((u) => u.name !== 'g'), ...food.units.filter((u) => u.name === 'g')]
  const [allUnits, setAllUnits] = useState(false)
  // The first few units and grams, plus whichever is chosen; the rest after "more units".
  const shownUnits =
    units.length > MAX_UNIT_CHIPS && !allUnits
      ? units.filter((option, i) => i < MAX_UNIT_CHIPS || option.name === 'g' || option.name === unit.name)
      : units
  const hiddenUnits = units.length - shownUnits.length

  function chooseUnit(next: FoodUnit) {
    if (next.name === unit.name) return
    setUnit(next)
    setText(String(defaultQuantity(next)))
  }

  function stepBy(direction: 1 | -1) {
    const next = twoPlaces((quantity ?? 0) + direction * step)
    if (next > 0 && next <= MAX_QUANTITY) setText(String(next))
  }

  function submit() {
    onSubmit(unit, quantity ?? Number.NaN)
  }

  function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') submit()
  }

  return (
    <>
      {/* The name can wrap, so the back button aligns with its first line rather than the middle. */}
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className={`-mt-2 -ml-2.5 flex size-11 shrink-0 items-center justify-center rounded-xl text-koshur-silk sm:-mt-1.5 ${FOCUS_RING}`}
        >
          <ChevronLeft aria-hidden="true" size={24} strokeWidth={2} className="size-5 sm:size-6" />
        </button>
        <Heading
          tabIndex={-1}
          className="m-0 min-w-0 flex-1 text-title font-semibold focus:outline-none sm:text-heading"
        >
          {food.name}
        </Heading>
      </div>

      {estimate && <EstimateNote food={food} />}

      {children}

      {/* Every unit is a chip. A food with many shows the first few and grams, with the rest on request:
          a native dropdown would be shorter, but WebKit styles its menu with an inline style that our
          security policy blocks, so on an iPhone it could not be trusted to draw. */}
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="p-0 pb-2 text-caption text-koshur-muted">Unit</legend>
        <div className="flex flex-wrap gap-2">
          {shownUnits.map((option) => (
            <Chip key={option.name} pressed={option.name === unit.name} onClick={() => chooseUnit(option)}>
              {unitLabel(option)}
            </Chip>
          ))}
          {hiddenUnits > 0 && (
            <button
              type="button"
              onClick={() => setAllUnits(true)}
              className={`min-h-11 rounded-full border border-dashed border-koshur-border px-4.5 text-body-sm font-medium text-koshur-muted ${FOCUS_RING}`}
            >
              {hiddenUnits} more units
            </button>
          )}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={quantityId} className="text-caption text-koshur-muted">
          Quantity
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => stepBy(-1)}
            disabled={quantity === null || quantity <= step}
            aria-label="Decrease quantity"
            className={`${STEP_BUTTON} ${fill}`}
          >
            <Minus aria-hidden="true" size={20} strokeWidth={2} className="size-4 sm:size-5" />
          </button>
          <input
            id={quantityId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={submitOnEnter}
            aria-describedby={hint ? hintId : undefined}
            className={`h-13 min-w-0 flex-1 rounded-xl border border-koshur-border ${fill} text-center text-heading font-semibold text-koshur-silk ${FOCUS_RING}`}
          />
          <button
            type="button"
            onClick={() => stepBy(1)}
            disabled={quantity !== null && quantity + step > MAX_QUANTITY}
            aria-label="Increase quantity"
            className={`${STEP_BUTTON} ${fill}`}
          >
            <Plus aria-hidden="true" size={20} strokeWidth={2} className="size-4 sm:size-5" />
          </button>
        </div>
        {hint && (
          <p id={hintId} className="m-0 text-caption text-koshur-muted">
            {hint}
          </p>
        )}
      </div>

      <div aria-live="polite" className="flex flex-col gap-4 border-t border-koshur-border pt-4.5">
        {values && quantity !== null ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="text-body-sm text-koshur-muted">{amountLabel(quantity, unit)}</span>
              <span className="text-display font-semibold text-deficit-ring">
                {estimate && <span className="text-body font-medium text-koshur-muted">about </span>}
                {formatNumber(values.kcal)}{' '}
                <span className="text-body font-medium text-koshur-muted">kcal</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MACROS.map((macro) => (
                <p key={macro.key} className="m-0 flex flex-col gap-1.5">
                  <span aria-hidden="true" className={`h-1 rounded-full ${macro.bar}`} />
                  <span className="text-caption text-koshur-muted">{macro.label}</span>
                  <span className="text-body font-semibold text-koshur-silk">
                    {formatNumber(values[macro.key])} g
                  </span>
                </p>
              ))}
            </div>
          </>
        ) : (
          <p className="m-0 text-body-sm text-koshur-muted">Enter an amount to see the values.</p>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      <Button onClick={submit} disabled={saving} className="w-full">
        {saving ? busyLabel : actionLabel}
      </Button>
    </>
  )
}
