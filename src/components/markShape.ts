/**
 * The Shumār mark's shape in its 512 grid, copied from scripts/brand/brand.ts so the app can draw
 * it without the brand script. A test in scripts/brand/brand.test.ts keeps the two the same.
 */
export const MARK_HEXAGON =
  'M256 75.57A36 36 0 0 1 274 80.39L399.08 152.61A36 36 0 0 1 417.08 183.78L417.08 328.22A36 36 0 0 1 399.08 359.39L274 431.61A36 36 0 0 1 238 431.61L112.92 359.39A36 36 0 0 1 94.92 328.22L94.92 183.78A36 36 0 0 1 112.92 152.61L238 80.39A36 36 0 0 1 256 75.57Z'

/** The protein, carbs and fat drops. */
export const MARK_DROPS = [
  'M254.58 154.46C267.45 171 291.33 193.05 291.33 216.94A36.75 36.75 0 0 1 217.83 216.94C217.83 193.05 241.72 171 254.58 154.46Z',
  'M214.42 248.02C227.28 264.56 251.17 286.61 251.17 310.49A36.75 36.75 0 0 1 177.67 310.49C177.67 286.61 201.56 264.56 214.42 248.02Z',
  'M299 238.1C311.86 254.63 335.75 276.68 335.75 300.57A36.75 36.75 0 0 1 262.25 300.57C262.25 276.68 286.14 254.63 299 238.1Z',
] as const

/** The length of the hexagon's track, and the share of it the logo draws in saffron. */
export const MARK_TRACK_LENGTH = 1092.78
export const MARK_FILLED = 0.72
/** The track's width. */
export const MARK_TRACK_WIDTH = 44

/** A square around the whole mark, track included, centred on the hexagon. */
export const MARK_VIEWBOX = '53.57 53.57 404.86 404.86'
