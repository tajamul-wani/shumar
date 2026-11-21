import { Bookmark, ChevronRight, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState, type Ref } from 'react'
import { Link } from 'wouter'
import { Button } from '../components/Button.tsx'
import { formatMealTime } from '../lib/dates.ts'
import { amountWithGrams } from '../lib/foodDisplay.ts'
import { LogError, type FoodAmount } from '../lib/logs.ts'
import { mealLabel, mealPhrase, type Meal } from '../lib/meals.ts'
import { MAX_SAVED_MEAL_NAME, type SavedMeal } from '../lib/savedMeals.ts'
import { biggestMeal, groupMealFoods, type FoodEntry, type MealGroup } from '../lib/today.ts'
import { FoodValues } from '../log/FoodValues.tsx'
import { editLogPath } from '../shell/nav.ts'
import { Amounts, Kcal, MacroBar } from './amounts.tsx'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

/**
 * One food in a meal: its name (with a count when the same food in the same amount was logged more
 * than once), then its protein, calories and amount. On Today the whole row opens the food to
 * change it or remove it (option A, approved by Tajamul Wani on 29 October 2026); on a past day it
 * is read only.
 */
function EntryItem({ entry, editable }: { entry: FoodEntry; editable: boolean }) {
  const count = entry.logs.length
  // The latest one, so a tap changes the one most likely added by mistake.
  const food = entry.logs[count - 1]
  const amount = amountWithGrams(food.quantity, { name: food.unitName, grams: food.grams / food.quantity })
  const content = (
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm text-koshur-silk">
        <span>{food.foodName}</span>
        {count > 1 && (
          <>
            <span
              aria-hidden="true"
              className="inline-flex items-center rounded-full bg-koshur-border px-2 py-0.5 text-caption font-semibold text-koshur-silk"
            >
              ×{count}
            </span>
            <span className="sr-only">, {count} times</span>
          </>
        )}
      </span>
      <span className="text-caption text-koshur-muted">
        <span className="sr-only">,</span>{' '}
        <FoodValues nutrients={entry.totals} amount={count > 1 ? `${amount} each` : amount} />
      </span>
    </span>
  )
  return (
    <li className="border-t border-koshur-border">
      {editable ? (
        <Link
          href={editLogPath(food.id)}
          className={`flex min-h-11 items-start gap-3 rounded-xl py-3.5 ${FOCUS_RING}`}
        >
          {content}
          <span className="sr-only">, change or remove{count > 1 ? ' one' : ''}</span>
          <ChevronRight
            aria-hidden="true"
            size={20}
            strokeWidth={2}
            className="mt-0.5 size-4 shrink-0 text-koshur-muted"
          />
        </Link>
      ) : (
        <div className="flex py-3.5">{content}</div>
      )}
    </li>
  )
}

interface MealCardProps {
  group: MealGroup
  /** The whole day's calories, for the meal's share of it. */
  dayKcal: number
  biggest: boolean
  showTime: boolean
  editable: boolean
  onAdd?: (meal: Meal) => void
  onSaveCombo?: (name: string, foods: readonly FoodAmount[]) => Promise<SavedMeal>
  onDeleteMeal?: (group: MealGroup) => Promise<void>
}

/** Warning popup when deleting an entire meal card. */
function DeleteMealDialog({
  meal,
  count,
  deleting,
  onConfirm,
  onClose,
}: {
  meal: Meal
  count: number
  deleting: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closingOurselves = useRef(false)
  const titleId = useId()
  const descId = useId()
  const name = mealLabel(meal)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
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

  function onDialogCancel(e: React.SyntheticEvent<HTMLDialogElement, Event>) {
    if (deleting) {
      e.preventDefault()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onDialogClose}
      onCancel={onDialogCancel}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 m-auto flex h-fit max-h-none w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-koshur-border bg-koshur-surface p-5 text-koshur-silk shadow-2xl backdrop:bg-koshur-base/80 open:flex"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5 text-alert-surplus">
          <TriangleAlert aria-hidden="true" size={20} strokeWidth={2} className="size-5 shrink-0" />
          <h4 id={titleId} className="m-0 text-title font-semibold text-koshur-silk">
            Delete {name}?
          </h4>
        </div>
        <p id={descId} className="m-0 text-body-sm text-koshur-muted">
          This will delete the entire {name} meal and all {count} {count === 1 ? 'food' : 'foods'} in it, not
          just a single food item. This cannot be undone.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2.5">
          <Button variant="secondary" size="small" disabled={deleting} onClick={onClose}>
            Cancel
          </Button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-alert-surplus px-3.5 text-body-sm font-semibold text-koshur-surface dark:text-koshur-base hover:brightness-110 disabled:opacity-60 transition ${FOCUS_RING}`}
          >
            {deleting ? 'Deleting' : 'Delete entire meal'}
          </button>
        </div>
      </div>
    </dialog>
  )
}

/**
 * A meal as a card: its name as a bordered tag, the time of its first food, its calories and share
 * of the day, a bar of its macros, every food listed, a way to add to it, a way to save it as a combo,
 * and a way to delete the entire meal.
 */
function MealCard({
  group,
  dayKcal,
  biggest,
  showTime,
  editable,
  onAdd,
  onSaveCombo,
  onDeleteMeal,
}: MealCardProps) {
  const headingId = useId()
  const nameId = useId()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string | null>(null)
  const share = dayKcal > 0 ? Math.round((group.totals.kcal / dayKcal) * 100) : 0

  async function handleDeleteMeal() {
    if (deleting || !onDeleteMeal) return
    setDeleting(true)
    try {
      await onDeleteMeal(group)
    } catch (failure) {
      setError(
        failure instanceof LogError
          ? failure.message
          : "We couldn't remove this meal. Check your connection and try again.",
      )
    } finally {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  async function handleSaveCombo() {
    if (saving || !onSaveCombo) return
    const trimmed = name.trim().replace(/\s+/g, ' ')
    if (!trimmed) {
      setError('Give the combo a name of up to 40 characters.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const saved = await onSaveCombo(name, group.foods)
      setName('')
      setNaming(false)
      setSavedName(saved.name)
    } catch (failure) {
      setError(
        failure instanceof LogError
          ? failure.message
          : "We couldn't save this combo. Check your connection and try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <article
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-koshur-border bg-koshur-surface p-4 lg:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h3
            id={headingId}
            className="m-0 inline-flex min-h-8 items-center rounded-full border border-koshur-border px-3 text-body-sm font-semibold text-koshur-silk"
          >
            {mealLabel(group.meal)}
          </h3>
          {showTime && (
            <span className="text-caption text-koshur-muted">
              {formatMealTime(new Date(group.firstLoggedAt))}
            </span>
          )}
          {biggest && (
            <span className="inline-flex items-center rounded-md border border-deficit-ring px-1.5 text-caption font-semibold tracking-wide text-deficit-ring uppercase">
              Biggest meal
            </span>
          )}
        </div>
        <p className="m-0 flex items-baseline gap-2">
          <Kcal value={group.totals.kcal} size="large" />
          <span className="text-caption whitespace-nowrap text-koshur-muted">{share}% of today</span>
        </p>
      </div>
      <MacroBar nutrients={group.totals} />
      <Amounts nutrients={group.totals} />
      <ul className="m-0 flex list-none flex-col pt-1 p-0">
        {groupMealFoods(group.foods).map((entry) => (
          <EntryItem key={entry.logs[0].id} entry={entry} editable={editable} />
        ))}
      </ul>
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {onAdd && (
            <button
              type="button"
              onClick={() => onAdd(group.meal)}
              className={`inline-flex min-h-11 items-center gap-2 self-start rounded-xl text-body-sm font-semibold text-deficit-ring transition-opacity hover:opacity-80 ${FOCUS_RING}`}
            >
              <Plus aria-hidden="true" size={20} strokeWidth={2.5} className="size-4" />
              Add to {mealPhrase(group.meal)}
            </button>
          )}
          <div className="flex w-full items-center justify-between sm:w-auto sm:justify-end sm:gap-6">
            {editable && group.foods.length > 0 && onSaveCombo && !naming && (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setSavedName(null)
                  setNaming(true)
                }}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl text-body-sm font-medium text-koshur-muted transition-colors hover:text-koshur-silk ${FOCUS_RING}`}
              >
                <Bookmark aria-hidden="true" size={16} strokeWidth={2} className="size-3.5" />
                Save as combo
              </button>
            )}
            {editable && group.foods.length > 0 && onDeleteMeal && (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setConfirmingDelete(true)
                }}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl text-body-sm font-medium text-alert-surplus/80 transition-colors hover:text-alert-surplus ${FOCUS_RING} ml-auto sm:ml-0`}
              >
                <Trash2 aria-hidden="true" size={16} strokeWidth={2} className="size-3.5" />
                Delete meal
              </button>
            )}
          </div>
        </div>

        {confirmingDelete && (
          <DeleteMealDialog
            meal={group.meal}
            count={group.foods.length}
            deleting={deleting}
            onConfirm={() => void handleDeleteMeal()}
            onClose={() => setConfirmingDelete(false)}
          />
        )}

        {naming && (
          <div className="flex flex-col gap-2 rounded-xl border border-koshur-border p-3">
            <label htmlFor={nameId} className="text-body-sm font-semibold text-koshur-silk">
              Name this combo
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={nameId}
                type="text"
                value={name}
                onChange={(e) => {
                  setError(null)
                  setName(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleSaveCombo()
                  } else if (e.key === 'Escape') {
                    setNaming(false)
                    setError(null)
                  }
                }}
                placeholder="For example Daily breakfast"
                maxLength={MAX_SAVED_MEAL_NAME}
                autoComplete="off"
                className="min-h-11 min-w-0 flex-1 basis-48 rounded-lg border border-koshur-border bg-transparent px-3 text-body-sm text-koshur-silk placeholder:text-koshur-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring"
              />
              <Button size="small" disabled={saving} onClick={() => void handleSaveCombo()}>
                {saving ? 'Saving' : 'Save combo'}
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => {
                  setNaming(false)
                  setError(null)
                }}
              >
                Cancel
              </Button>
            </div>
            {error && (
              <p role="alert" className="m-0 text-body-sm text-alert-surplus">
                {error}
              </p>
            )}
          </div>
        )}

        {savedName && !naming && (
          <p className="m-0 text-caption text-koshur-muted">Saved {savedName} to your saved meals.</p>
        )}
      </div>
    </article>
  )
}

interface MealCardsProps {
  groups: MealGroup[]
  /** The whole day's calories, for each meal's share of it. */
  dayKcal: number
  /** The time of each meal's first food. */
  showTimes?: boolean
  /** Each food opens to be changed or removed. Without it the cards are read only, as on a past day. */
  editable?: boolean
  /** Opens the Add food popup on that meal. Without it, as on a past day, cards have no add line. */
  onAdd?: (meal: Meal) => void
  onSaveCombo?: (name: string, foods: readonly FoodAmount[]) => Promise<SavedMeal>
  onDeleteMeal?: (group: MealGroup) => Promise<void>
  headingRef?: Ref<HTMLHeadingElement>
}

/** The day's meals as cards, two across on wide screens, each with its foods listed. */
export function MealCards({
  groups,
  dayKcal,
  showTimes = false,
  editable = false,
  onAdd,
  onSaveCombo,
  onDeleteMeal,
  headingRef,
}: MealCardsProps) {
  const headingId = useId()
  const biggest = biggestMeal(groups)
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 lg:gap-4">
      <h2
        ref={headingRef}
        id={headingId}
        tabIndex={-1}
        className="m-0 text-title font-semibold focus:outline-none"
      >
        Meals
      </h2>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-6 lg:items-start">
        {groups.map((group) => (
          <MealCard
            key={group.meal}
            group={group}
            dayKcal={dayKcal}
            biggest={group.meal === biggest}
            showTime={showTimes}
            editable={editable}
            onAdd={onAdd}
            onSaveCombo={onSaveCombo}
            onDeleteMeal={onDeleteMeal}
          />
        ))}
      </div>
      {editable && (
        <p className="m-0 text-caption text-koshur-muted">
          Tap a food to see all its values, change it or remove it.
        </p>
      )}
    </section>
  )
}
