import { Link } from 'wouter'
import { exampleServing, exampleSteps, EXAMPLE_FOOD, type ExampleStep } from '../lib/homeExample.ts'
import { formatNumber } from '../lib/foodDisplay.ts'
import { roundForDisplay } from '../lib/nutrition.ts'
import { CaloriesCard } from '../today/CaloriesCard.tsx'

const CARD =
  'flex min-w-0 flex-1 basis-110 flex-col gap-4 rounded-2xl border border-koshur-border bg-koshur-surface p-5 lg:p-6'
// Each row stacks on a phone, so the working never has to share a line with its result.
const ROW =
  'flex flex-col gap-0.5 border-b border-koshur-border pb-2.5 text-body-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4'
const LAST_ROW = 'flex flex-col gap-0.5 text-body-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4'

const TONE: Record<NonNullable<ExampleStep['tone']>, string> = {
  kcal: 'text-deficit-ring',
  protein: 'text-macro-protein',
  carbs: 'text-macro-carb',
  fat: 'text-macro-fat',
}

const SOURCES = [
  [
    'Kashmiri dishes',
    'Real recipes: every ingredient weighed, the cooked dish weighed, then scaled to 100 g',
  ],
  ['Bakery pieces', 'Weighed, with the number of pieces on the record'],
  ['Everyday ingredients', 'USDA FoodData Central, in the public domain'],
  ['Packaged food', 'The label on the pack'],
] as const

const BREAKFAST_EGGS = 5

/** The worked example: the formula, the day it makes, the per-100 g maths, and where values come from. */
export function HomeNumbers() {
  const { steps, targets } = exampleSteps()
  const one = exampleServing(1)
  const breakfast = exampleServing(BREAKFAST_EGGS)
  const shownOne = roundForDisplay(one.nutrients)

  return (
    <section
      aria-labelledby="numbers-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12"
    >
      <div className="flex flex-col gap-3">
        <h2 id="numbers-heading" className="m-0 text-heading font-semibold">
          How the numbers are worked out
        </h2>
        <p className="m-0 max-w-3xl text-body text-koshur-muted">
          One example: a 30-year-old man, 80 kg and 175 cm, lightly active, losing half a kilo a week. Every
          line is what the app does with your own answers.
        </p>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className={CARD}>
          <h3 className="m-0 text-title font-semibold">Six answers become a daily target</h3>
          <dl className="m-0 flex flex-col gap-2.5">
            {steps.map((step, i) => (
              <div key={step.working} className={i === steps.length - 1 ? LAST_ROW : ROW}>
                <dt className="text-koshur-muted">{step.working}</dt>
                <dd className={`m-0 shrink-0 font-semibold ${step.tone ? TONE[step.tone] : ''}`}>
                  {step.result}
                </dd>
              </div>
            ))}
          </dl>
          <p className="m-0 text-caption text-koshur-muted">
            Mifflin-St Jeor for resting energy, FAO/WHO/UNU and ICMR-NIN activity levels, and the AHA/ACC/TOS
            guideline for a safe deficit.
          </p>
        </div>

        <div className={CARD}>
          <h3 className="m-0 text-title font-semibold">The day at a glance</h3>
          <CaloriesCard totals={breakfast.nutrients} target={targets.kcal} macroTargets={targets} />
          <p className="m-0 text-caption text-koshur-muted">
            After a breakfast of {BREAKFAST_EGGS} large eggs. In the evening a short review says what is
            furthest behind.
          </p>
        </div>

        <div className={CARD}>
          <h3 className="m-0 text-title font-semibold">Any unit, one basis: per 100 g</h3>
          <p className="m-0 text-body-sm text-koshur-muted">
            Every food is stored per 100 g as eaten. A piece, cup or katori is only a weight in grams, so the
            maths is the same for a Girda and for an egg.
          </p>
          <dl className="m-0 flex flex-col gap-2.5">
            <div className={ROW}>
              <dt>{EXAMPLE_FOOD.name}</dt>
              <dd className="m-0 shrink-0 text-koshur-muted">{EXAMPLE_FOOD.per100g.kcal} kcal per 100 g</dd>
            </div>
            <div className={ROW}>
              <dt className="text-koshur-muted">1 {EXAMPLE_FOOD.unit.name} egg</dt>
              <dd className="m-0 shrink-0">{EXAMPLE_FOOD.unit.grams} g</dd>
            </div>
            <div className={ROW}>
              <dt className="text-koshur-muted">
                {EXAMPLE_FOOD.per100g.kcal} × {one.grams} ÷ 100
              </dt>
              <dd className="m-0 shrink-0 font-semibold">{formatNumber(shownOne.kcal)} kcal</dd>
            </div>
            <div className={LAST_ROW}>
              <dt className="text-koshur-muted">
                {EXAMPLE_FOOD.per100g.protein} × {one.grams} ÷ 100
              </dt>
              <dd className="m-0 shrink-0 font-semibold text-macro-protein">
                {formatNumber(shownOne.protein)} g protein
              </dd>
            </div>
          </dl>
          <p className="m-0 text-caption text-koshur-muted">{EXAMPLE_FOOD.source}.</p>
        </div>

        <div className={CARD}>
          <h3 className="m-0 text-title font-semibold">Every value from a named source</h3>
          <dl className="m-0 flex flex-col">
            {SOURCES.map(([food, from], i) => (
              <div
                key={food}
                className={`flex flex-col gap-0.5 py-2.5 ${i === 0 ? '' : 'border-t border-koshur-border'}`}
              >
                <dt className="text-body-sm font-semibold">{food}</dt>
                <dd className="m-0 text-body-sm text-koshur-muted">{from}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/sources"
            className="self-start text-body-sm font-semibold text-deficit-ring hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring"
          >
            See every source
          </Link>
        </div>
      </div>
    </section>
  )
}
