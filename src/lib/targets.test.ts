import { describe, expect, it } from 'vitest'
import { KCAL_PER_GRAM } from './nutrition.ts'
import {
  ACTIVITY_PAL,
  MIN_KCAL,
  dailyTargets,
  restingKcal,
  type ActivityLevel,
  type Goal,
  type Profile,
  type Sex,
} from './targets.ts'

// Test profiles only, not real people.
const man: Profile = {
  sex: 'male',
  ageYears: 30,
  heightCm: 175,
  weightKg: 80,
  activity: 'light',
  goal: { kind: 'maintain' },
}
const woman: Profile = { ...man, sex: 'female', heightCm: 160, weightKg: 60 }

const withGoal = (profile: Profile, goal: Goal): Profile => ({ ...profile, goal })
const lose = (kgPerWeek: 0.25 | 0.5 | 0.75): Goal => ({ kind: 'lose', kgPerWeek })

/** The energy in a day's macros, to check the targets add up. */
function energyFromMacros(t: { protein: number; carbs: number; fat: number }): number {
  return KCAL_PER_GRAM.protein * t.protein + KCAL_PER_GRAM.carbs * t.carbs + KCAL_PER_GRAM.fat * t.fat
}

describe('restingKcal', () => {
  // Mifflin-St Jeor by hand: 10 x kg + 6.25 x cm - 5 x age, + 5 for men, - 161 for women.
  it('follows Mifflin-St Jeor for men', () => {
    expect(restingKcal(man)).toBeCloseTo(800 + 1093.75 - 150 + 5)
  })

  it('follows Mifflin-St Jeor for women', () => {
    expect(restingKcal(woman)).toBeCloseTo(600 + 1000 - 150 - 161)
  })
})

describe('dailyTargets: energy', () => {
  it.each([
    ['sedentary', 2448],
    ['light', 2676],
    ['moderate', 3078],
    ['very', 3935],
  ] as const)('multiplies resting energy by the %s level', (activity, kcal) => {
    const targets = dailyTargets({ ...man, activity })
    expect(targets.restingKcal).toBe(1749)
    expect(targets.maintenanceKcal).toBe(kcal)
    expect(targets.kcal).toBe(kcal)
  })

  it.each([
    [0.25, 2376],
    [0.5, 2176],
    [0.75, 1926],
  ] as const)('takes the gap for losing %s kg a week off maintenance', (rate, kcal) => {
    const targets = dailyTargets(withGoal(man, lose(rate)))
    expect(targets.kcal).toBe(kcal)
    expect(targets.atFloor).toBe(false)
  })

  it('adds 10% to maintenance to gain', () => {
    expect(dailyTargets(withGoal(man, { kind: 'gain' })).kcal).toBe(2943)
  })

  it('keeps maintenance for body recomposition', () => {
    expect(dailyTargets(withGoal(man, { kind: 'recomp' })).kcal).toBe(2676)
  })

  it('stops a woman at 1,200 kcal and says the loss will be slower', () => {
    // Maintenance 1,805 kcal, so 0.75 kg a week would mean 1,055.
    const targets = dailyTargets({ ...woman, activity: 'sedentary', goal: lose(0.75) })
    expect(targets.kcal).toBe(1200)
    expect(targets.atFloor).toBe(true)
  })

  it('stops a man at 1,500 kcal', () => {
    const small: Profile = { ...man, ageYears: 60, heightCm: 165, weightKg: 60, activity: 'sedentary' }
    const targets = dailyTargets(withGoal(small, lose(0.75)))
    expect(targets.maintenanceKcal).toBe(1871)
    expect(targets.kcal).toBe(1500)
    expect(targets.atFloor).toBe(true)
  })

  it('keeps a target just above the floor', () => {
    // Maintenance 1,805 kcal, so 0.5 kg a week means 1,305.
    const targets = dailyTargets({ ...woman, activity: 'sedentary', goal: lose(0.5) })
    expect(targets.kcal).toBe(1305)
    expect(targets.atFloor).toBe(false)
  })

  it('never sets a weight-loss target above maintenance', () => {
    // Maintenance below the floor: 745.25 x 1.4 = 1,043 kcal.
    const tiny: Profile = {
      sex: 'female',
      ageYears: 80,
      heightCm: 145,
      weightKg: 40,
      activity: 'sedentary',
      goal: lose(0.25),
    }
    const targets = dailyTargets(tiny)
    expect(targets.maintenanceKcal).toBe(1043)
    expect(targets.kcal).toBe(1043)
    expect(targets.atFloor).toBe(true)
  })
})

describe('dailyTargets: macros', () => {
  it('works out the example from the decisions', () => {
    expect(dailyTargets(withGoal(man, lose(0.5)))).toEqual({
      kcal: 2176,
      protein: 128,
      carbs: 280,
      fat: 60,
      restingKcal: 1749,
      maintenanceKcal: 2676,
      atFloor: false,
    })
  })

  it('gives 1.6 g of protein per kg for every goal but recomposition', () => {
    for (const goal of [lose(0.5), { kind: 'maintain' }, { kind: 'gain' }] as Goal[]) {
      expect(dailyTargets(withGoal(man, goal)).protein).toBe(128)
    }
  })

  it('gives 2.2 g of protein per kg for body recomposition', () => {
    expect(dailyTargets(withGoal(man, { kind: 'recomp' })).protein).toBe(176)
  })

  it('caps protein at 35% of calories for a heavy body', () => {
    // 1.6 x 150 kg = 240 g, but 35% of 2,652 kcal is 232 g.
    const heavy: Profile = {
      sex: 'male',
      ageYears: 40,
      heightCm: 180,
      weightKg: 150,
      activity: 'sedentary',
      goal: lose(0.75),
    }
    const targets = dailyTargets(heavy)
    expect(targets.kcal).toBe(2652)
    expect(targets.protein).toBe(232)
  })

  const sexes: Sex[] = ['female', 'male']
  const levels = Object.keys(ACTIVITY_PAL) as ActivityLevel[]
  const goals: Goal[] = [
    lose(0.25),
    lose(0.5),
    lose(0.75),
    { kind: 'maintain' },
    { kind: 'recomp' },
    { kind: 'gain' },
  ]
  const bodies = [
    { ageYears: 18, heightCm: 150, weightKg: 45 },
    { ageYears: 35, heightCm: 170, weightKg: 70 },
    { ageYears: 60, heightCm: 185, weightKg: 120 },
    { ageYears: 100, heightCm: 250, weightKg: 300 },
  ]
  const everyProfile = sexes.flatMap((sex) =>
    levels.flatMap((activity) =>
      goals.flatMap((goal) => bodies.map((body): Profile => ({ sex, activity, goal, ...body }))),
    ),
  )

  function insideRanges(profile: Profile): boolean {
    const t = dailyTargets(profile)
    const losing = profile.goal.kind === 'lose'
    return (
      // Rounding each macro to whole grams moves the total by a few kcal at most.
      Math.abs(energyFromMacros(t) - t.kcal) <= 10 &&
      (t.protein * 4) / t.kcal <= 0.35 + 0.005 &&
      Math.abs((t.fat * 9) / t.kcal - 0.25) < 0.005 &&
      t.carbs > 0 &&
      (!losing || t.kcal >= Math.min(MIN_KCAL[profile.sex], t.maintenanceKcal)) &&
      (!losing || t.kcal <= t.maintenanceKcal)
    )
  }

  it('keeps every profile inside the guideline ranges', () => {
    expect(everyProfile).toHaveLength(192)
    expect(everyProfile.filter((profile) => !insideRanges(profile))).toEqual([])
  })
})

describe('dailyTargets: checks the answers', () => {
  it.each([
    ['ageYears', 17, /Age must be between 18 and 100, got 17/],
    ['ageYears', 101, /Age/],
    ['heightCm', 99, /Height must be between 100 and 250/],
    ['heightCm', 251, /Height/],
    ['weightKg', 29, /Weight must be between 30 and 300/],
    ['weightKg', 301, /Weight/],
    ['weightKg', Number.NaN, /Weight/],
    ['ageYears', Number.POSITIVE_INFINITY, /Age/],
  ] as const)('rejects %s of %s', (key, value, message) => {
    expect(() => dailyTargets({ ...man, [key]: value })).toThrow(message)
  })

  it('accepts the limits themselves', () => {
    expect(() => dailyTargets({ ...man, ageYears: 18, heightCm: 100, weightKg: 30 })).not.toThrow()
    expect(() => dailyTargets({ ...man, ageYears: 100, heightCm: 250, weightKg: 300 })).not.toThrow()
  })

  // Answers read back from storage may not match the types.
  const bad = (patch: object) => ({ ...man, ...patch }) as Profile

  it.each([
    [{ sex: 'other' }, /Sex is not a known option, got other/],
    [{ sex: undefined }, /Sex/],
    [{ activity: 'extreme' }, /Activity level is not a known option/],
    [{ activity: 'toString' }, /Activity level/],
    [{ goal: { kind: 'lose', kgPerWeek: 1 } }, /Weight-loss speed is not a known option, got 1/],
    [{ goal: { kind: 'lose' } }, /Weight-loss speed/],
    [{ goal: { kind: 'bulk' } }, /Goal is not a known option, got bulk/],
    [{ goal: undefined }, /Goal/],
  ])('rejects %o', (patch, message) => {
    expect(() => dailyTargets(bad(patch))).toThrow(message)
  })
})
