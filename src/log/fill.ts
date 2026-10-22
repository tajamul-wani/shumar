import { createContext, useContext } from 'react'

/**
 * The fill for the log sheet's inputs, buttons and notes, so they always stand out from what
 * they sit on: the surface color on a page of their own, the base color inside a card.
 */
export const SheetFillContext = createContext<'bg-koshur-surface' | 'bg-koshur-base'>('bg-koshur-surface')

export function useSheetFill() {
  return useContext(SheetFillContext)
}
