import { describe, expect, it } from 'vitest'
import { describeRelease } from './sources.ts'

describe('describeRelease', () => {
  it('names the dataset and the month of the release', () => {
    expect(describeRelease('foundation_food', 'FoodData_Central_foundation_food_csv_2026-04-30.zip')).toBe(
      'Foundation Foods, April 2026',
    )
    expect(describeRelease('sr_legacy_food', 'FoodData_Central_sr_legacy_food_csv_2018-04.zip')).toBe(
      'SR Legacy, April 2018',
    )
  })

  it('falls back to the dataset name when the file name has no usable date', () => {
    expect(describeRelease('sr_legacy_food', 'release.zip')).toBe('SR Legacy')
    expect(describeRelease('sr_legacy_food', 'x_2018-13.zip')).toBe('SR Legacy')
    expect(describeRelease('new_dataset', 'release.zip')).toBe('new_dataset')
  })
})
