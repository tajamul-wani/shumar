import { createContext } from 'react'

/**
 * True when the questions show on their own, before sign-in. Signed in, the app's own frame
 * already shows the wordmark, so the questions leave it out.
 */
export const StandaloneContext = createContext(false)
