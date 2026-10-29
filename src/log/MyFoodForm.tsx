import { ChevronLeft, Lock, TriangleAlert } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { Chip } from '../components/Chip.tsx'
import { formatNumber } from '../lib/foodDisplay.ts'
import {
  MAX_BRAND,
  MAX_MY_FOOD_NAME,
  caloriesMismatch,
  readDraft,
  type DraftProblem,
  type LabelBasis,
  type MyFoodDraft,
  type MyFoodInput,
} from '../lib/myFoods.ts'
import { useSheetFill } from './fill.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

/** The order problems are reached in, top to bottom, so the first one gets focus. */
const ORDER: DraftProblem[] = [
  'name',
  'brand',
  'servingGrams',
  'kcal',
  'protein',
  'carbs',
  'fat',
  'sodiumMg',
  'macros',
]

const MACROS = [
  { key: 'protein', label: 'Protein', dot: 'bg-macro-protein' },
  { key: 'carbs', label: 'Carbs', dot: 'bg-macro-carb' },
  { key: 'fat', label: 'Fat', dot: 'bg-macro-fat' },
] as const

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  problem?: string
  /** The unit after the number, such as "kcal". None for text. */
  suffix?: string
  placeholder?: string
  maxLength?: number
  /** The macro's color, as a small dot before its name. */
  dot?: string
}

function Field({ id, label, value, onChange, problem, suffix, placeholder, maxLength, dot }: FieldProps) {
  const fill = useSheetFill()
  const problemId = `${id}-problem`
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-2 text-body-sm text-koshur-muted">
        {dot && <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />}
        {label}
      </label>
      <div
        className={`flex h-13 items-center gap-2.5 rounded-xl border ${fill} px-4 has-focus-visible:ring-2 has-focus-visible:ring-deficit-ring ${
          problem ? 'border-alert-surplus' : 'border-koshur-border'
        }`}
      >
        <input
          id={id}
          type="text"
          inputMode={suffix ? 'decimal' : undefined}
          autoComplete="off"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          className="min-w-0 flex-1 bg-transparent text-body text-koshur-silk placeholder:text-koshur-muted outline-none"
        />
        {suffix && <span className="text-body-sm text-koshur-muted">{suffix}</span>}
      </div>
      {problem && (
        <div id={problemId}>
          <Alert>{problem}</Alert>
        </div>
      )}
    </div>
  )
}

interface MyFoodFormProps {
  /** 1 on a screen of its own, 2 inside another screen. */
  headingLevel?: 1 | 2
  /** A new food, or a change to one already saved. */
  mode: 'new' | 'edit'
  initial: MyFoodDraft
  saving: boolean
  /** Why the last save failed, such as a name already taken. */
  error: string | null
  onBack: () => void
  onSave: (food: MyFoodInput) => void
}

/**
 * A food from its pack: the name, the brand and the values its label prints, per 100 g or per
 * serving. Nothing is filled in for the person. Before saving, the calories are checked against the
 * protein, carbs and fat, so a typo is caught; the person can still save a label as it is.
 */
export function MyFoodForm({
  headingLevel = 1,
  mode,
  initial,
  saving,
  error,
  onBack,
  onSave,
}: MyFoodFormProps) {
  const [draft, setDraft] = useState(initial)
  const [problems, setProblems] = useState<Partial<Record<DraftProblem, string>>>({})
  /** The food waiting for "Save anyway" while its calories don't add up. */
  const [unsure, setUnsure] = useState<MyFoodInput | null>(null)
  const Heading = headingLevel === 2 ? 'h2' : 'h1'
  const SubHeading = headingLevel === 2 ? 'h3' : 'h2'
  const fill = useSheetFill()
  const formId = useId()
  const macrosRef = useRef<HTMLDivElement>(null)
  const ids = Object.fromEntries(ORDER.map((field) => [field, `${formId}-${field}`])) as Record<
    DraftProblem,
    string
  >
  const mismatch = unsure && caloriesMismatch(unsure)

  function change(field: Exclude<keyof MyFoodDraft, 'basis'>, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setUnsure(null)
  }

  function chooseBasis(basis: LabelBasis) {
    setDraft((current) => ({ ...current, basis }))
    setUnsure(null)
  }

  function save() {
    const check = readDraft(draft)
    if (check.problems) {
      setProblems(check.problems)
      const first = ORDER.find((field) => check.problems[field])
      if (first === 'macros') macrosRef.current?.querySelector('input')?.focus()
      else if (first) document.getElementById(ids[first])?.focus()
      return
    }
    setProblems({})
    if (caloriesMismatch(check.food)) {
      setUnsure(check.food)
      return
    }
    onSave(check.food)
  }

  return (
    <>
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to search"
          className={`-mt-2 -ml-2.5 flex size-11 shrink-0 items-center justify-center rounded-xl text-koshur-silk sm:-mt-1.5 ${FOCUS_RING}`}
        >
          <ChevronLeft aria-hidden="true" size={24} strokeWidth={2} className="size-5 sm:size-6" />
        </button>
        <Heading
          tabIndex={-1}
          className="m-0 min-w-0 flex-1 text-title font-semibold focus:outline-none sm:text-heading"
        >
          {mode === 'new' ? 'Add a food from its pack' : 'Change your food'}
        </Heading>
      </div>

      <Field
        id={ids.name}
        label="Name"
        value={draft.name}
        onChange={(value) => change('name', value)}
        problem={problems.name}
        maxLength={MAX_MY_FOOD_NAME}
      />
      <Field
        id={ids.brand}
        label="Brand"
        value={draft.brand}
        onChange={(value) => change('brand', value)}
        problem={problems.brand}
        placeholder="If the pack has one"
        maxLength={MAX_BRAND}
      />

      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="p-0 pb-2 text-body-sm text-koshur-muted">The label gives its values</legend>
        <div className="flex flex-wrap gap-2">
          <Chip pressed={draft.basis === '100g'} onClick={() => chooseBasis('100g')}>
            Per 100 g
          </Chip>
          <Chip pressed={draft.basis === 'serving'} onClick={() => chooseBasis('serving')}>
            Per serving
          </Chip>
        </div>
      </fieldset>

      {draft.basis === 'serving' && (
        <div className="flex flex-col gap-1.5">
          <Field
            id={ids.servingGrams}
            label="One serving is"
            value={draft.servingGrams}
            onChange={(value) => change('servingGrams', value)}
            problem={problems.servingGrams}
            suffix="g"
          />
          <p className="m-0 text-caption text-koshur-muted">
            Shumār works the values out per 100 g and keeps your serving as a unit.
          </p>
        </div>
      )}

      <Field
        id={ids.kcal}
        label="Calories"
        value={draft.kcal}
        onChange={(value) => change('kcal', value)}
        problem={problems.kcal}
        suffix="kcal"
      />
      <div ref={macrosRef} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
          {MACROS.map((macro) => (
            <Field
              key={macro.key}
              id={ids[macro.key]}
              label={macro.label}
              value={draft[macro.key]}
              onChange={(value) => change(macro.key, value)}
              problem={problems[macro.key]}
              suffix="g"
              dot={macro.dot}
            />
          ))}
          <Field
            id={ids.sodiumMg}
            label="Sodium"
            value={draft.sodiumMg}
            onChange={(value) => change('sodiumMg', value)}
            problem={problems.sodiumMg}
            suffix="mg"
          />
        </div>
        {problems.macros && <Alert>{problems.macros}</Alert>}
      </div>

      <p className="m-0 flex items-center gap-1.5 text-caption text-koshur-muted">
        <Lock aria-hidden="true" size={12} strokeWidth={2} className="size-3 shrink-0" />
        Only you can see the foods you add.
      </p>

      {unsure && mismatch ? (
        <>
          <section
            role="alert"
            aria-labelledby={`${formId}-check`}
            className={`flex flex-col gap-2.5 rounded-2xl border border-koshur-border ${fill} p-4`}
          >
            <div className="flex items-center gap-2.5">
              <TriangleAlert
                aria-hidden="true"
                size={20}
                strokeWidth={2}
                className="size-4 shrink-0 text-alert-surplus sm:size-5"
              />
              <SubHeading id={`${formId}-check`} className="m-0 text-body font-semibold">
                Check these numbers
              </SubHeading>
            </div>
            <p className="m-0 text-body-sm text-koshur-muted">
              Protein, carbs and fat add up to about {formatNumber(Math.round(mismatch.fromMacros))} kcal, but
              you entered {formatNumber(mismatch.entered)} kcal. A typo is the usual reason.
            </p>
          </section>
          {error && <Alert>{error}</Alert>}
          {/* Side by side once both fit on one line each; stacked on the narrowest phones. */}
          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="secondary"
              className="flex-1 basis-40"
              onClick={() => document.getElementById(ids.kcal)?.focus()}
            >
              Fix the numbers
            </Button>
            <Button disabled={saving} className="flex-1 basis-40" onClick={() => onSave(unsure)}>
              {saving ? 'Saving' : 'Save anyway'}
            </Button>
          </div>
        </>
      ) : (
        <>
          {error && <Alert>{error}</Alert>}
          <Button disabled={saving} onClick={save} className="w-full">
            {saving ? 'Saving' : mode === 'new' ? 'Save food' : 'Save changes'}
          </Button>
        </>
      )}
    </>
  )
}
