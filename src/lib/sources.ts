const DATASET_NAMES: Record<string, string> = {
  foundation_food: 'Foundation Foods',
  sr_legacy_food: 'SR Legacy',
}

const MONTH_YEAR = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** A USDA release as people read it, for example "Foundation Foods, April 2026". */
export function describeRelease(dataset: string, fileName: string): string {
  const name = DATASET_NAMES[dataset] ?? dataset
  const match = /_(\d{4})-(\d{2})(?:-\d{2})?\.zip$/.exec(fileName)
  if (!match) return name
  const month = Number(match[2])
  if (month < 1 || month > 12) return name
  return `${name}, ${MONTH_YEAR.format(new Date(Date.UTC(Number(match[1]), month - 1, 1)))}`
}
