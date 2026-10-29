import { Pencil, Search, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'wouter'
import { useAuth } from '../auth/context.ts'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { Toast, type ToastMessage } from '../components/Toast.tsx'
import { Chip } from '../components/Chip.tsx'
import { defaultQuantity, defaultUnit, foodsLine } from '../lib/foodDisplay.ts'
import { MAX_QUERY_LENGTH, type FoodResult, type FoodUnit } from '../lib/foodSearch.ts'
import type { LoggedFood } from '../lib/dayLogs.ts'
import { LogError, amountFor, copyFoods, logFood, type FoodAmount } from '../lib/logs.ts'
import { MEALS, MEAL_LABELS, defaultMeal, isFixedMeal, mealPhrase, type Meal } from '../lib/meals.ts'
import {
  EMPTY_DRAFT,
  displayName,
  toDraft,
  toFoodResult,
  type MyFood,
  type MyFoodDraft,
  type MyFoodInput,
} from '../lib/myFoods.ts'
import { readRecentFoods, rememberFood, type RecentFood } from '../lib/recentFoods.ts'
import type { SavedFood, SavedMeal } from '../lib/savedMeals.ts'
import { FoodDetail } from './FoodDetail.tsx'
import { FoodRow } from './FoodRow.tsx'
import { FromPackCard, FromPackLink } from './FromPack.tsx'
import { MyFoodForm } from './MyFoodForm.tsx'
import { QuickAdds } from './QuickAdds.tsx'
import { SavedMealView } from './SavedMealView.tsx'
import { SheetFillContext, useSheetFill } from './fill.ts'
import { useFoodSearch, type FoodSearchState } from './useFoodSearch.ts'
import { useMyFoods } from './useMyFoods.ts'
import type { SavedMealsState } from './useSavedMeals.ts'
import { useYesterday } from './useYesterday.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'
const LIST = 'm-0 flex list-none flex-col p-0'

interface Chosen {
  food: FoodResult
  unit: FoodUnit
  quantity: number
}

function chooseDefaults(food: FoodResult): Chosen {
  const unit = defaultUnit(food)
  return { food, unit, quantity: defaultQuantity(unit) }
}

function fromRecent({ food, unitName, quantity }: RecentFood): Chosen {
  return { food, unit: food.units.find((u) => u.name === unitName) ?? defaultUnit(food), quantity }
}

function errorMessage(error: unknown): string {
  return error instanceof LogError
    ? error.message
    : "We couldn't save this food. Check your connection and try again."
}

export function MealPicker({
  id,
  meal,
  onChoose,
}: {
  id: string
  meal: Meal
  onChoose: (meal: Meal) => void
}) {
  return (
    <fieldset id={id} className="m-0 min-w-0 border-0 p-0">
      <legend className="p-0 pb-2 text-caption text-koshur-muted">Meal</legend>
      <div className="flex flex-wrap gap-2">
        {MEALS.map((option) => (
          <Chip key={option} pressed={option === meal} onClick={() => onChoose(option)}>
            {MEAL_LABELS[option]}
          </Chip>
        ))}
        {/* A meal of the person's own, as on a logged food being changed, stays choosable. */}
        {!isFixedMeal(meal) && (
          <Chip pressed onClick={() => onChoose(meal)}>
            {meal}
          </Chip>
        )}
      </div>
    </fieldset>
  )
}

/** What screen readers hear as a search runs and finishes. */
function searchAnnouncement(search: FoodSearchState): string {
  if (search.status === 'loading') return 'Searching'
  if (search.status !== 'done') return ''
  const count = search.results.length
  if (count === 0) return noMatch(search.query)
  return count === 1 ? '1 food found' : `${count} foods found`
}

function noMatch(query: string): string {
  return `No foods match "${query}".`
}

interface SearchResultsProps {
  search: Exclude<FoodSearchState, { status: 'idle' }>
  onOpen: (chosen: Chosen) => void
  /** In the popup each result has a plus that opens it, so the amount is always chosen before it is added. */
  withPlus: boolean
  /** Opens the form for a food from its pack, when search can't find the one wanted. */
  onAddFromPack: () => void
}

function SearchResults({ search, onOpen, withPlus, onAddFromPack }: SearchResultsProps) {
  const fill = useSheetFill()
  if (search.status === 'error') {
    return <Alert>We couldn't search right now. Check your connection and try again.</Alert>
  }
  const results = search.status === 'done' ? search.results : search.previous
  if (!results) {
    return (
      <div aria-hidden="true" className="flex flex-col gap-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className={`h-14 rounded-xl border border-koshur-border ${fill}`} />
        ))}
      </div>
    )
  }
  if (results.length === 0) {
    return (
      <>
        <p className="m-0 text-body text-koshur-muted">{noMatch(search.query)}</p>
        <FromPackCard query={search.query} onAdd={onAddFromPack} />
      </>
    )
  }
  return (
    <>
      <ul aria-label="Search results" className={LIST}>
        {results.map((food) => {
          const chosen = chooseDefaults(food)
          return (
            <FoodRow
              key={`${food.source}:${food.sourceId}`}
              food={food}
              unit={chosen.unit}
              quantity={chosen.quantity}
              withPlus={withPlus}
              onOpen={() => onOpen(chosen)}
            />
          )
        })}
      </ul>
      <FromPackLink onClick={onAddFromPack}>Not the one? Add another from the pack</FromPackLink>
    </>
  )
}

/** A food of the person's own being added from its pack, or changed. */
type PackForm = { mode: 'new'; draft: MyFoodDraft } | { mode: 'edit'; food: MyFood }

interface LogSheetProps {
  /**
   * Inside another screen, as a card: titled "Add food" as a section (h2), with the meal on its
   * button and no close button.
   */
  embedded?: boolean
  /**
   * Inside the Add food popup: no heading or meal button of its own (the popup has them), the
   * search focused as soon as it opens and again after each food goes in, and no recent list.
   */
  dialog?: boolean
  /** The meal, when the screen around the sheet chooses it. */
  meal?: Meal
  onChooseMeal?: (meal: Meal) => void
  /** Called after a food is added, so the screen around the sheet can show it. */
  onAdded?: () => void
  /** The person's saved meals, owned by the screen so the popup's save form shares them. */
  savedMeals: SavedMealsState
}

/**
 * The log sheet from the V2 design: search or pick a recent food, choose how much, and add it
 * to a meal. The meal starts from the time of day and can be changed.
 */
export function LogSheet({
  embedded = false,
  dialog = false,
  meal: chosenMeal,
  onChooseMeal,
  onAdded,
  savedMeals,
}: LogSheetProps) {
  const { client } = useAuth()
  const [ownMeal, setOwnMeal] = useState<Meal>(() => defaultMeal(new Date()))
  const meal = chosenMeal ?? ownMeal
  const [pickingMeal, setPickingMeal] = useState(false)
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<Chosen | null>(null)
  /** A saved meal opened from its row. */
  const [opened, setOpened] = useState<SavedMeal | null>(null)
  /** While set, the search adds foods to this saved meal instead of the day. */
  const [addingTo, setAddingTo] = useState<SavedMeal | null>(null)
  /** The form for a food from its pack, when open. */
  const [pack, setPack] = useState<PackForm | null>(null)
  const yesterday = useYesterday()
  const myFoods = useMyFoods()
  const quickAdds =
    yesterday.some((log) => log.meal === meal) ||
    (savedMeals.meals?.length ?? 0) > 0 ||
    (myFoods.foods?.length ?? 0) > 0
  const [recent, setRecent] = useState(() => readRecentFoods())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<ToastMessage | null>(null)
  const toastId = useRef(0)
  const savingRef = useRef(false)
  const changeMealRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pickerId = useId()
  const searchId = useId()
  const recentId = useId()
  const Heading = embedded ? 'h2' : 'h1'
  const SubHeading = embedded ? 'h3' : 'h2'
  const innerLevel = embedded || dialog ? 2 : 1
  const fill = embedded || dialog ? 'bg-koshur-base' : 'bg-koshur-surface'
  /** Goes up when a food of the person's own changes, so the same search is asked again. */
  const [searchRound, setSearchRound] = useState(0)
  const search = useFoodSearch(query, 300, searchRound)
  const mealName = mealPhrase(meal)

  // Moving between the search, a food and a saved meal works like moving between screens: focus
  // the sheet's new heading. In the popup the search itself takes focus, ready for the next food.
  const view = pack
    ? `pack:${pack.mode === 'edit' ? pack.food.id : 'new'}`
    : chosen
      ? `food:${chosen.food.source}:${chosen.food.sourceId}`
      : opened
        ? `saved:${opened.id}`
        : 'search'
  const previousView = useRef(view)
  useEffect(() => {
    if (previousView.current === view) return
    previousView.current = view
    if (dialog && view === 'search') searchRef.current?.focus()
    else containerRef.current?.querySelector<HTMLElement>('h1, h2')?.focus()
  }, [view, dialog])

  function open(next: Chosen) {
    setError(null)
    setAdded(null)
    setChosen(next)
  }

  function chooseMeal(next: Meal) {
    if (onChooseMeal) onChooseMeal(next)
    else setOwnMeal(next)
    setPickingMeal(false)
    changeMealRef.current?.focus()
  }

  /** One change at a time: while one is on its way, the buttons wait, and a failure is explained. */
  async function run(task: () => Promise<void>) {
    if (savingRef.current) return
    setError(null)
    setAdded(null)
    savingRef.current = true
    setSaving(true)
    try {
      await task()
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  function notice(text: string, detail?: string, tone: ToastMessage['tone'] = 'added') {
    toastId.current += 1
    setAdded({ id: toastId.current, text, detail, tone })
  }

  function add(food: FoodResult, unit: FoodUnit, quantity: number) {
    return run(async () => {
      const row = await logFood(client, { meal, food, quantity, unit })
      setRecent(rememberFood({ food, unitName: unit.name, quantity: row.quantity }))
      notice(`Added to ${mealName}`, food.name)
      setChosen(null)
      // The search clears for the next food (Tajamul Wani, 26 October 2026).
      setQuery('')
      onAdded?.()
    })
  }

  function addToSaved(target: SavedMeal, food: FoodResult, unit: FoodUnit, quantity: number) {
    return run(async () => {
      const next = await savedMeals.addFood(target, amountFor({ food, quantity, unit }))
      notice(`Added to ${next.name}`, food.name)
      setChosen(null)
      setQuery('')
      setAddingTo(null)
      setOpened(next)
    })
  }

  /** Where a chosen food goes: the saved meal being filled, or the day's meal. */
  function submit(food: FoodResult, unit: FoodUnit, quantity: number) {
    return addingTo ? addToSaved(addingTo, food, unit, quantity) : add(food, unit, quantity)
  }

  /** Yesterday's meal or a saved meal, into today's meal in one go. */
  function addMany(foods: readonly FoodAmount[], text: string, detail: string) {
    return run(async () => {
      await copyFoods(client, foods, meal)
      notice(text, detail)
      setQuery('')
      onAdded?.()
    })
  }

  /** The form for a food from its pack, its name started from what was searched. */
  function openPack(name: string) {
    setError(null)
    setAdded(null)
    setPack({ mode: 'new', draft: { ...EMPTY_DRAFT, name: name.trim() } })
  }

  /**
   * A new food goes into the search, which finds it first; a changed one opens again with its new
   * values. Either way the same search is asked again, now that the food has changed.
   */
  function savePack(food: MyFoodInput) {
    const form = pack
    return run(async () => {
      if (form?.mode === 'edit') {
        const saved = await myFoods.change(form.food.id, food)
        setPack(null)
        setSearchRound((round) => round + 1)
        setChosen(chooseDefaults(toFoodResult(saved)))
      } else {
        const saved = await myFoods.add(food)
        setPack(null)
        setSearchRound((round) => round + 1)
        setQuery(saved.name)
        notice('Saved to your foods', displayName(saved))
      }
    })
  }

  function removeOwn(own: MyFood) {
    return run(async () => {
      await myFoods.remove(own)
      setChosen(null)
      setSearchRound((round) => round + 1)
      notice('Removed from your foods', displayName(own), 'removed')
    })
  }

  function openSaved(saved: SavedMeal) {
    setError(null)
    setAdded(null)
    setOpened(saved)
  }

  function removeSavedFood(saved: SavedMeal, food: SavedFood) {
    return run(async () => {
      const left = await savedMeals.removeFood(saved, food.id)
      if (left) {
        setOpened(left)
        notice(`Removed from ${saved.name}`, food.foodName, 'removed')
      } else {
        setOpened(null)
        notice(`Removed ${saved.name}`, undefined, 'removed')
      }
    })
  }

  function removeSaved(saved: SavedMeal) {
    return run(async () => {
      await savedMeals.remove(saved)
      setOpened(null)
      notice(`Removed ${saved.name}`, undefined, 'removed')
    })
  }

  if (opened) {
    const saved = opened
    return (
      <SheetFillContext.Provider value={fill}>
        <div ref={containerRef} className="flex min-w-0 flex-col gap-5">
          <SavedMealView
            key={saved.id}
            saved={saved}
            mealName={mealName}
            headingLevel={innerLevel}
            busy={saving}
            error={error}
            onBack={() => {
              setError(null)
              setOpened(null)
            }}
            onAddToMeal={() => addMany(saved.foods, `Added ${saved.name}`, `to ${mealName}`)}
            onAddFood={() => {
              setError(null)
              setAddingTo(saved)
              setOpened(null)
            }}
            onRemoveFood={(food) => removeSavedFood(saved, food)}
            onRemove={() => removeSaved(saved)}
          />
          <Toast message={added} duration={5000} onDismiss={() => setAdded(null)} inline={dialog} />
        </div>
      </SheetFillContext.Provider>
    )
  }

  if (pack) {
    return (
      <SheetFillContext.Provider value={fill}>
        <div ref={containerRef} className="flex min-w-0 flex-col gap-5">
          <MyFoodForm
            key={view}
            headingLevel={innerLevel}
            mode={pack.mode}
            initial={pack.mode === 'edit' ? toDraft(pack.food) : pack.draft}
            saving={saving}
            error={error}
            onBack={() => {
              setError(null)
              setPack(null)
            }}
            onSave={savePack}
          />
        </div>
      </SheetFillContext.Provider>
    )
  }

  if (chosen) {
    // A food of the person's own can be changed or removed from here, once their foods have loaded.
    const own =
      chosen.food.source === 'mine'
        ? (myFoods.foods?.find((food) => food.id === chosen.food.sourceId) ?? null)
        : null
    return (
      <SheetFillContext.Provider value={fill}>
        <div ref={containerRef} className="flex min-w-0 flex-col gap-5">
          <FoodDetail
            key={view}
            headingLevel={innerLevel}
            food={chosen.food}
            initialUnit={chosen.unit}
            initialQuantity={chosen.quantity}
            actionLabel={`Add to ${addingTo ? addingTo.name : mealName}`}
            busyLabel="Adding"
            backLabel="Back to search"
            saving={saving}
            error={error}
            onBack={() => {
              setError(null)
              setChosen(null)
            }}
            onSubmit={(unit, quantity) => submit(chosen.food, unit, quantity)}
          >
            {chosen.food.source === 'mine' && (
              <div className="flex flex-col gap-3">
                <p className="m-0 text-body-sm text-koshur-muted">Your food, from its pack</p>
                {own && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => {
                        setError(null)
                        setPack({ mode: 'edit', food: own })
                      }}
                    >
                      <Pencil aria-hidden="true" size={20} strokeWidth={2} className="size-4" />
                      Edit
                    </Button>
                    <Button variant="secondary" size="small" disabled={saving} onClick={() => removeOwn(own)}>
                      <Trash2 aria-hidden="true" size={20} strokeWidth={2} className="size-4" />
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            )}
          </FoodDetail>
        </div>
      </SheetFillContext.Provider>
    )
  }

  return (
    <SheetFillContext.Provider value={fill}>
      <div ref={containerRef} className="flex min-w-0 flex-col gap-5">
        {!dialog && (
          <div className="flex items-center gap-2">
            <Heading tabIndex={-1} className="m-0 min-w-0 flex-1 text-title font-semibold focus:outline-none">
              Add food
            </Heading>
            <button
              ref={changeMealRef}
              type="button"
              onClick={() => setPickingMeal((shown) => !shown)}
              aria-expanded={pickingMeal}
              aria-controls={pickingMeal ? pickerId : undefined}
              aria-label={`To ${mealName}, change meal`}
              className={`min-h-11 shrink-0 rounded-full border border-koshur-border ${fill} px-3.5 text-body-sm font-medium text-koshur-silk ${FOCUS_RING}`}
            >
              To {mealName}
            </button>
            {!embedded && (
              <Link
                href="/"
                aria-label="Close"
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-koshur-muted ${FOCUS_RING}`}
              >
                <X aria-hidden="true" size={24} strokeWidth={2} className="size-5 sm:size-6" />
              </Link>
            )}
          </div>
        )}

        {pickingMeal && <MealPicker id={pickerId} meal={meal} onChoose={chooseMeal} />}

        {addingTo && (
          <div
            className={`flex items-center gap-3 rounded-xl border border-koshur-border ${fill} py-2.5 pr-2.5 pl-3.5`}
          >
            <p className="m-0 min-w-0 flex-1 text-body-sm text-koshur-silk">
              Adding a food to <span className="font-semibold">{addingTo.name}</span>
            </p>
            <Button
              variant="secondary"
              size="small"
              className="shrink-0"
              onClick={() => {
                setOpened(addingTo)
                setAddingTo(null)
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        <div
          className={`flex h-13 items-center gap-2.5 rounded-xl border border-koshur-border ${fill} px-4 focus-within:ring-2 focus-within:ring-deficit-ring`}
        >
          <Search
            aria-hidden="true"
            size={20}
            strokeWidth={2}
            className="size-4 sm:size-5 shrink-0 text-koshur-muted"
          />
          <label htmlFor={searchId} className="sr-only">
            Search foods
          </label>
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => {
              setAdded(null)
              setQuery(event.target.value)
            }}
            placeholder="Search Girda, Haakh, eggs..."
            maxLength={MAX_QUERY_LENGTH}
            autoComplete="off"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-body text-koshur-silk placeholder:text-koshur-muted focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                searchRef.current?.focus()
              }}
              aria-label="Clear search"
              className={`-mr-3 flex size-11 shrink-0 items-center justify-center rounded-xl text-koshur-muted ${FOCUS_RING}`}
            >
              <X aria-hidden="true" size={20} strokeWidth={2} className="size-4 sm:size-5" />
            </button>
          )}
        </div>

        {/* In the popup, what was just added shows here, under the search box (Tajamul Wani, 28 October 2026). */}
        {dialog && <Toast message={added} duration={5000} onDismiss={() => setAdded(null)} inline />}
        {error && <Alert>{error}</Alert>}
        <output className="sr-only">{searchAnnouncement(search)}</output>

        {search.status === 'idle' ? (
          <>
            {recent.length > 0 && !dialog && (
              <section aria-labelledby={recentId} className="flex flex-col gap-1.5">
                <SubHeading
                  id={recentId}
                  className="m-0 text-caption font-semibold tracking-wide text-koshur-muted uppercase"
                >
                  Recent
                </SubHeading>
                <ul className={LIST}>
                  {recent.map((entry) => {
                    const next = fromRecent(entry)
                    return (
                      <FoodRow
                        key={`${entry.food.source}:${entry.food.sourceId}`}
                        food={next.food}
                        unit={next.unit}
                        quantity={next.quantity}
                        busy={saving}
                        onOpen={() => open(next)}
                        onQuickAdd={() => submit(next.food, next.unit, next.quantity)}
                      />
                    )
                  })}
                </ul>
              </section>
            )}
            {!addingTo && (
              <QuickAdds
                meal={meal}
                yesterday={yesterday}
                saved={savedMeals.meals}
                busy={saving}
                onAddYesterday={(foods: LoggedFood[]) =>
                  addMany(foods, `Added yesterday's ${mealName}`, foodsLine(foods))
                }
                onAddSaved={(saved) => addMany(saved.foods, `Added ${saved.name}`, `to ${mealName}`)}
                onOpenSaved={openSaved}
                mine={myFoods.foods}
                onOpenMine={(food, unit, quantity) => open({ food, unit, quantity })}
                onAddMine={(food, unit, quantity) => submit(food, unit, quantity)}
                onAddFromPack={() => openPack('')}
              />
            )}
            {(recent.length === 0 || dialog) && (addingTo || !quickAdds) && (
              <p className="m-0 text-body text-koshur-muted">
                Search for a food to add it to {addingTo ? addingTo.name : mealName}.
              </p>
            )}
          </>
        ) : (
          <SearchResults
            search={search}
            onOpen={open}
            withPlus={dialog}
            onAddFromPack={() => openPack(query)}
          />
        )}
        {!dialog && <Toast message={added} duration={5000} onDismiss={() => setAdded(null)} />}
      </div>
    </SheetFillContext.Provider>
  )
}
