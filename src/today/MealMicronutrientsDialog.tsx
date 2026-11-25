import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Button } from '../components/Button.tsx'
import { formatNumber } from '../lib/foodDisplay.ts'
import { mealLabel, type Meal } from '../lib/meals.ts'
import type { Minerals } from '../lib/nutrition.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

interface NutrientItem {
  name: string
  value: number | null | undefined
  unit: string
}

export function MealMicronutrientsDialog({
  meal,
  minerals,
  count,
  onClose,
}: {
  meal: Meal
  minerals: Minerals
  count: number
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

  const items: NutrientItem[] = [
    { name: 'Calcium', value: minerals.calciumMg, unit: 'mg' },
    { name: 'Iron', value: minerals.ironMg, unit: 'mg' },
    { name: 'Potassium', value: minerals.potassiumMg, unit: 'mg' },
    { name: 'Magnesium', value: minerals.magnesiumMg, unit: 'mg' },
    { name: 'Zinc', value: minerals.zincMg, unit: 'mg' },
    { name: 'Vitamin A', value: minerals.vitaminAMcg, unit: 'mcg' },
    { name: 'Vitamin B12', value: minerals.vitaminB12Mcg, unit: 'mcg' },
    { name: 'Vitamin C', value: minerals.vitaminCMg, unit: 'mg' },
    { name: 'Vitamin D', value: minerals.vitaminDMcg, unit: 'mcg' },
    { name: 'Folate', value: minerals.folateMcg, unit: 'mcg' },
  ]

  return (
    <dialog
      ref={dialogRef}
      onClose={onDialogClose}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 m-auto flex h-fit max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-koshur-border bg-koshur-surface p-5 text-koshur-silk shadow-2xl backdrop:bg-koshur-base/80 open:flex"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h4 id={titleId} className="m-0 text-title font-semibold text-koshur-silk">
              {name} vitamins & minerals
            </h4>
            <p id={descId} className="m-0 text-caption text-koshur-muted">
              Total micronutrients consumed from {count} {count === 1 ? 'food' : 'foods'} in this meal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-koshur-muted transition hover:text-koshur-silk ${FOCUS_RING}`}
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 overflow-y-auto py-1">
          {items.map(({ name: nutrientName, value, unit }) => {
            const hasValue = value !== null && value !== undefined
            const displayVal = hasValue
              ? `${formatNumber(Math.round(value * 10) / 10)} ${unit}`
              : 'Not listed'
            return (
              <div
                key={nutrientName}
                className="flex flex-col justify-between rounded-xl border border-koshur-border bg-koshur-base p-2.5"
              >
                <span className="text-caption font-medium text-koshur-muted">{nutrientName}</span>
                <span
                  className={`text-body-sm font-semibold ${hasValue ? 'text-koshur-silk' : 'font-normal text-koshur-muted italic'}`}
                >
                  {displayVal}
                </span>
              </div>
            )
          })}
        </div>

        <p className="m-0 text-caption text-koshur-muted">
          Values come from USDA FoodData Central and cited recipes. Unlisted values reflect foods whose source
          lists no measurement.
        </p>

        <div className="mt-1 flex items-center justify-end">
          <Button variant="secondary" size="small" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </dialog>
  )
}
