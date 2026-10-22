import { Check, Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'wouter'
import { useAuth } from '../auth/context.ts'
import { Alert } from '../components/Alert.tsx'
import { Chip } from '../components/Chip.tsx'
import { amountLabel, defaultQuantity, defaultUnit } from '../lib/foodDisplay.ts'
import { MAX_QUERY_LENGTH, type FoodResult, type FoodUnit } from '../lib/foodSearch.ts'
import { LogError, logFood } from '../lib/logs.ts'
import { MEALS, MEAL_LABELS, defaultMeal, type Meal } from '../lib/meals.ts'
import { readRecentFoods, rememberFood, type RecentFood } from '../lib/recentFoods.ts'
import { FoodDetail } from './FoodDetail.tsx'
import { FoodRow } from './FoodRow.tsx'
import { SheetFillContext, useSheetFill } from './fill.ts'
import { useFoodSearch, type FoodSearchState } from './useFoodSearch.ts'

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
  return `No foods match "${query}". Try another word or a shorter search.`
}

interface SearchResultsProps {
  search: Exclude<FoodSearchState, { status: 'idle' }>
  onOpen: (chosen: Chosen) => void
}

function SearchResults({ search, onOpen }: SearchResultsProps) {
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
  if (results.length === 0) return <p className="m-0 text-body text-koshur-muted">{noMatch(search.query)}</p>
  return (
    <ul aria-label="Search results" className={LIST}>
      {results.map((food) => {
        const chosen = chooseDefaults(food)
        return (
          <FoodRow
            key={`${food.source}:${food.sourceId}`}
            food={food}
            unit={chosen.unit}
            quantity={chosen.quantity}
            onOpen={() => onOpen(chosen)}
          />
        )
      })}
    </ul>
  )
}

interface LogSheetProps {
  /**
   * Inside another screen, as on the desktop Today screen: titled "Add food" as a section (h2),
   * with the meal on its button and no close button.
   */
  embedded?: boolean
  /** Called after a food is added, so the screen around the sheet can show it. */
  onAdded?: () => void
}

/**
 * The log sheet from the V2 design: search or pick a recent food, choose how much, and add it
 * to a meal. The meal starts from the time of day and can be changed.
 */
export function LogSheet({ embedded = false, onAdded }: LogSheetProps) {
  const { client } = useAuth()
  const [meal, setMeal] = useState<Meal>(() => defaultMeal(new Date()))
  const [pickingMeal, setPickingMeal] = useState(false)
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [recent, setRecent] = useState(() => readRecentFoods())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)
  const savingRef = useRef(false)
  const changeMealRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pickerId = useId()
  const searchId = useId()
  const recentId = useId()
  const Heading = embedded ? 'h2' : 'h1'
  const SubHeading = embedded ? 'h3' : 'h2'
  const fill = embedded ? 'bg-koshur-base' : 'bg-koshur-surface'
  const search = useFoodSearch(query)
  const mealName = MEAL_LABELS[meal].toLowerCase()

  // Moving between the search and a food works like moving between screens: focus the sheet's new heading.
  const view = chosen ? `${chosen.food.source}:${chosen.food.sourceId}` : 'search'
  const previousView = useRef(view)
  useEffect(() => {
    if (previousView.current === view) return
    previousView.current = view
    containerRef.current?.querySelector<HTMLElement>('h1, h2')?.focus()
  }, [view])

  function open(next: Chosen) {
    setError(null)
    setAdded(null)
    setChosen(next)
  }

  function chooseMeal(next: Meal) {
    setMeal(next)
    setPickingMeal(false)
    changeMealRef.current?.focus()
  }

  async function add(food: FoodResult, unit: FoodUnit, quantity: number) {
    if (savingRef.current) return
    setError(null)
    setAdded(null)
    savingRef.current = true
    setSaving(true)
    try {
      const row = await logFood(client, { meal, food, quantity, unit })
      setRecent(rememberFood({ food, unitName: unit.name, quantity: row.quantity }))
      setAdded(`Added ${amountLabel(row.quantity, unit)} of ${food.name} to ${mealName}.`)
      setChosen(null)
      setQuery('')
      onAdded?.()
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  if (chosen) {
    return (
      <SheetFillContext.Provider value={fill}>
        <div ref={containerRef} className="flex min-w-0 flex-col gap-5">
          <FoodDetail
            key={view}
            headingLevel={embedded ? 2 : 1}
            food={chosen.food}
            initialUnit={chosen.unit}
            initialQuantity={chosen.quantity}
            actionLabel={`Add to ${mealName}`}
            busyLabel="Adding"
            backLabel="Back to search"
            saving={saving}
            error={error}
            onBack={() => {
              setError(null)
              setChosen(null)
            }}
            onSubmit={(unit, quantity) => add(chosen.food, unit, quantity)}
          />
        </div>
      </SheetFillContext.Provider>
    )
  }

  return (
    <SheetFillContext.Provider value={fill}>
      <div ref={containerRef} className="flex min-w-0 flex-col gap-5">
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
              <X aria-hidden="true" size={24} strokeWidth={2} />
            </Link>
          )}
        </div>

        {pickingMeal && <MealPicker id={pickerId} meal={meal} onChoose={chooseMeal} />}

        <div
          className={`flex h-13 items-center gap-2.5 rounded-xl border border-koshur-border ${fill} px-4 focus-within:ring-2 focus-within:ring-deficit-ring`}
        >
          <Search aria-hidden="true" size={20} strokeWidth={2} className="shrink-0 text-koshur-muted" />
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
              <X aria-hidden="true" size={20} strokeWidth={2} />
            </button>
          )}
        </div>

        <output className={added ? 'flex items-start gap-2 text-body-sm text-koshur-silk' : 'sr-only'}>
          {added && (
            <Check aria-hidden="true" size={20} strokeWidth={2} className="shrink-0 text-deficit-ring" />
          )}
          {added}
        </output>
        {error && <Alert>{error}</Alert>}
        <output className="sr-only">{searchAnnouncement(search)}</output>

        {search.status === 'idle' ? (
          recent.length > 0 ? (
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
                      onQuickAdd={() => add(next.food, next.unit, next.quantity)}
                    />
                  )
                })}
              </ul>
            </section>
          ) : (
            <p className="m-0 text-body text-koshur-muted">Search for a food to add it to {mealName}.</p>
          )
        ) : (
          <SearchResults search={search} onOpen={open} />
        )}
      </div>
    </SheetFillContext.Provider>
  )
}
