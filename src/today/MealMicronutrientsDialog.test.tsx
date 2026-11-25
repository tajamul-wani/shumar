import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Minerals } from '../lib/nutrition.ts'
import { MealMicronutrientsDialog } from './MealMicronutrientsDialog.tsx'

describe('MealMicronutrientsDialog', () => {
  const minerals: Minerals = {
    calciumMg: 120.4,
    ironMg: 2.5,
    potassiumMg: 350,
    magnesiumMg: 45,
    zincMg: 1.8,
    vitaminAMcg: 80,
    vitaminB12Mcg: 1.2,
    vitaminCMg: 15.6,
    vitaminDMcg: null,
    folateMcg: 65,
  }

  it('renders all 10 micronutrients with values and units', () => {
    render(
      <MealMicronutrientsDialog
        meal="breakfast"
        minerals={minerals}
        count={2}
        onClose={vi.fn<() => void>()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Breakfast vitamins & minerals' })).toBeInTheDocument()
    expect(screen.getByText('Total micronutrients consumed from 2 foods in this meal.')).toBeInTheDocument()
    expect(screen.getByText('120.4 mg')).toBeInTheDocument()
    expect(screen.getByText('2.5 mg')).toBeInTheDocument()
    expect(screen.getByText('350 mg')).toBeInTheDocument()
    expect(screen.getByText('1.2 mcg')).toBeInTheDocument()
    expect(screen.getByText('Not listed')).toBeInTheDocument()
  })

  it('calls onClose when clicking the close button', async () => {
    const onClose = vi.fn<() => void>()
    render(<MealMicronutrientsDialog meal="lunch" minerals={minerals} count={1} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking the secondary Close button', async () => {
    const onClose = vi.fn<() => void>()
    render(<MealMicronutrientsDialog meal="dinner" minerals={minerals} count={3} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
