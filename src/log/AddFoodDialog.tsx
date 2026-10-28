import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { AmountChip } from '../components/AmountChip.tsx'
import { Button } from '../components/Button.tsx'
import { Chip } from '../components/Chip.tsx'
import { Toast, type ToastMessage } from '../components/Toast.tsx'
import type { LoggedFood } from '../lib/dayLogs.ts'
import { amountLabel, formatNumber } from '../lib/foodDisplay.ts'
import { LogError } from '../lib/logs.ts'
import { MAX_SAVED_MEAL_NAME } from '../lib/savedMeals.ts'
import {
  MAX_MEAL_NAME,
  MEALS,
  MEAL_LABELS,
  isFixedMeal,
  mealLabel,
  mealPhrase,
  normalizeMealName,
  type Meal,
} from '../lib/meals.ts'
import { groupMealFoods } from '../lib/today.ts'
import { LogSheet } from './LogSheet.tsx'
import { useSavedMeals, type SavedMealsState } from './useSavedMeals.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'
const STEP = 'm-0 text-caption font-semibold tracking-wide text-koshur-muted uppercase'
const NAME_INPUT = `min-h-11 min-w-0 flex-1 basis-56 rounded-full border border-dashed border-koshur-border bg-transparent px-4 text-body-sm text-koshur-silk placeholder:text-koshur-muted ${FOCUS_RING}`

interface AddFoodDialogProps {
  /** The meal to open on, or null while the popup is closed. */
  meal: Meal | null
  /** Today's logs, for the list of what is in the meal so far. */
  logs: readonly LoggedFood[]
  onChangeMeal: (meal: Meal) => void
  onAdded: () => void
  onClose: () => void
}

interface SaveMealFormProps {
  foods: readonly LoggedFood[]
  savedMeals: SavedMealsState
  onSaved: (name: string) => void
}

/** Saves what is in the meal right now under a name, so it can be added in one tap another day. */
function SaveMealForm({ foods, savedMeals, onSaved }: SaveMealFormProps) {
  const nameId = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const saved = await savedMeals.save(name, foods)
      setName('')
      onSaved(saved.name)
    } catch (failure) {
      setError(
        failure instanceof LogError
          ? failure.message
          : "We couldn't save this meal. Check your connection and try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={nameId} className="sr-only">
          Name this meal
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          onChange={(event) => {
            setError(null)
            setName(event.target.value)
          }}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void save()
            }
          }}
          placeholder="Name this meal, such as Morning chai"
          maxLength={MAX_SAVED_MEAL_NAME}
          autoComplete="off"
          className={NAME_INPUT}
        />
        <Button variant="secondary" size="small" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving' : 'Save as a meal'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="m-0 text-body-sm text-koshur-silk">
          {error}
        </p>
      )}
    </div>
  )
}

interface InMealProps {
  meal: Meal
  foods: readonly LoggedFood[]
  savedMeals: SavedMealsState
  onSaved: (name: string) => void
}

/** What has gone into the meal so far, at the foot of the popup: never under the search box. */
function InMeal({ meal, foods, savedMeals, onSaved }: InMealProps) {
  const headingId = useId()
  if (foods.length === 0) return null
  const kcal = foods.reduce((sum, log) => sum + log.nutrients.kcal, 0)
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 border-t border-koshur-border pt-4">
      <h3 id={headingId} className={`${STEP} flex justify-between gap-3`}>
        <span>In {mealPhrase(meal)} now</span>
        <span className="tracking-normal text-koshur-silk normal-case">
          {formatNumber(Math.round(kcal))} kcal
        </span>
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {groupMealFoods(foods).map((entry) => {
          const food = entry.logs[entry.logs.length - 1]
          const amount = amountLabel(food.quantity, {
            name: food.unitName,
            grams: food.grams / food.quantity,
          })
          return (
            <li key={entry.logs[0].id} className="flex items-center gap-3 text-body-sm">
              <span className="min-w-0 flex-1 text-koshur-silk">
                {food.foodName}
                {entry.logs.length > 1 && <span className="text-koshur-muted"> ×{entry.logs.length}</span>}
              </span>{' '}
              <AmountChip>{amount}</AmountChip>{' '}
              <span className="whitespace-nowrap text-koshur-muted">
                {formatNumber(Math.round(entry.totals.kcal))} kcal
              </span>
            </li>
          )
        })}
      </ul>
      <SaveMealForm foods={foods} savedMeals={savedMeals} onSaved={onSaved} />
    </section>
  )
}

/**
 * The Add food popup: a dialog in the middle of a wide screen, a sheet from the bottom on a phone.
 * Step 1 picks the meal as a tag or names a new one, step 2 is the search. It stays open for the
 * next food and closes with Done, Escape or the cross.
 */
export function AddFoodDialog({ meal, logs, onChangeMeal, onAdded, onClose }: AddFoodDialogProps) {
  if (meal === null) return null
  return (
    <OpenDialog meal={meal} logs={logs} onChangeMeal={onChangeMeal} onAdded={onAdded} onClose={onClose} />
  )
}

type OpenDialogProps = Omit<AddFoodDialogProps, 'meal'> & { meal: Meal }

/** The popup while it is open. It is taken down entirely when closed, so nothing lingers behind the page. */
function OpenDialog({ meal, logs, onChangeMeal, onAdded, onClose }: OpenDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const headingId = useId()
  const nameId = useId()
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const savedMeals = useSavedMeals()
  const [notice, setNotice] = useState<ToastMessage | null>(null)
  const noticeId = useRef(0)

  // Closing the dialog ourselves (when it is taken down, or when React re-runs the effect in
  // development) fires a close event too; that one must not count as the person closing it.
  const closingOurselves = useRef(false)

  // The browser's own modal when it has one (focus trapped, Escape closes); plain open where it hasn't, as in tests.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    // The browser puts focus on the first control; the search is where typing should land.
    dialog.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    return () => {
      if (dialog.open && typeof dialog.close === 'function') {
        closingOurselves.current = true
        dialog.close()
      }
    }
  }, [])

  function onDialogClose() {
    if (closingOurselves.current) {
      closingOurselves.current = false
      return
    }
    onClose()
  }

  // The meals of the person's own already in today's logs, so they can be picked again.
  const ownMeals: Meal[] = []
  for (const log of logs) if (!isFixedMeal(log.meal) && !ownMeals.includes(log.meal)) ownMeals.push(log.meal)
  if (!isFixedMeal(meal) && !ownMeals.includes(meal)) ownMeals.push(meal)

  function nameMeal() {
    const next = normalizeMealName(name)
    if (!next) {
      setNameError(`Give the meal a name of up to ${MAX_MEAL_NAME} characters.`)
      return
    }
    setNameError(null)
    setName('')
    onChangeMeal(next)
  }

  function onNameKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      nameMeal()
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      onClose={onDialogClose}
      className="fixed inset-0 m-0 flex h-auto max-h-none w-full max-w-none flex-col overflow-hidden border-0 bg-koshur-surface p-0 text-koshur-silk shadow-none backdrop:bg-koshur-base/70 open:flex lg:inset-auto lg:top-1/2 lg:left-1/2 lg:max-h-dvh lg:w-full lg:max-w-3xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border lg:border-koshur-border"
    >
      {
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-sheet pb-sheet sm:px-6 lg:pt-6 lg:pb-6">
          <div className="flex items-center gap-3">
            <h2 id={headingId} className="m-0 min-w-0 flex-1 text-title font-semibold">
              Add food
            </h2>
            {/* A clear way out: a bordered button with its name, not a faint cross (Tajamul Wani, 28 October 2026). */}
            <Button variant="secondary" size="small" onClick={onClose} className="shrink-0">
              <X aria-hidden="true" size={20} strokeWidth={2.5} className="size-4" />
              Close
            </Button>
          </div>

          <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
            <legend className={`${STEP} p-0 pb-2.5`}>1. Which meal</legend>
            <div className="flex flex-wrap items-center gap-2">
              {MEALS.map((option) => (
                <Chip key={option} pressed={option === meal} onClick={() => onChangeMeal(option)}>
                  {MEAL_LABELS[option]}
                </Chip>
              ))}
              {ownMeals.map((own) => (
                <Chip key={own} pressed={own === meal} onClick={() => onChangeMeal(own)}>
                  {own}
                </Chip>
              ))}
              <label htmlFor={nameId} className="sr-only">
                Or name a meal
              </label>
              <input
                ref={nameRef}
                id={nameId}
                type="text"
                value={name}
                onChange={(event) => {
                  setNameError(null)
                  setName(event.target.value)
                }}
                onKeyDown={onNameKey}
                onBlur={() => name.trim() && nameMeal()}
                placeholder="or name a meal, such as Chai"
                maxLength={MAX_MEAL_NAME}
                autoComplete="off"
                className={NAME_INPUT}
              />
            </div>
            {nameError && (
              <p role="alert" className="m-0 text-body-sm text-koshur-silk">
                {nameError}
              </p>
            )}
          </fieldset>

          <div className="flex min-w-0 flex-col gap-2.5">
            <h3 className={STEP}>2. What you ate, for {mealLabel(meal).toLowerCase()}</h3>
            <LogSheet
              dialog
              meal={meal}
              onChooseMeal={onChangeMeal}
              onAdded={onAdded}
              savedMeals={savedMeals}
            />
          </div>

          <InMeal
            meal={meal}
            foods={logs.filter((log) => log.meal === meal)}
            savedMeals={savedMeals}
            onSaved={(savedName) => {
              noticeId.current += 1
              setNotice({ id: noticeId.current, text: `Saved ${savedName}`, tone: 'added' })
            }}
          />
          <Toast message={notice} duration={5000} onDismiss={() => setNotice(null)} inline />

          <div className="flex justify-end">
            <Button size="small" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      }
    </dialog>
  )
}
