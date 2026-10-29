import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_DRAFT, type MyFoodDraft, type MyFoodInput } from '../lib/myFoods.ts'
import { MyFoodForm } from './MyFoodForm.tsx'

// Made-up values with easy numbers for checking the form, not nutrition data.
function renderForm(
  initial: Partial<MyFoodDraft> = {},
  props: Partial<Parameters<typeof MyFoodForm>[0]> = {},
) {
  const onSave = vi.fn<(food: MyFoodInput) => void>()
  const onBack = vi.fn<() => void>()
  render(
    <MyFoodForm
      mode="new"
      initial={{ ...EMPTY_DRAFT, ...initial }}
      saving={false}
      error={null}
      onBack={onBack}
      onSave={onSave}
      {...props}
    />,
  )
  return { onSave, onBack }
}

async function fill(values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    const field = screen.getByLabelText(label)
    await userEvent.clear(field)
    await userEvent.type(field, value)
  }
}

const values = { Calories: '300', Protein: '20', Carbs: '2', Fat: '24', Sodium: '20' }

describe('adding a food from its pack', () => {
  it('starts from the search and saves the label as typed', async () => {
    const { onSave } = renderForm({ name: 'paneer' })
    expect(screen.getByRole('heading', { level: 1, name: 'Add a food from its pack' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('paneer')
    expect(screen.getByText('Only you can see the foods you add.')).toBeInTheDocument()
    await fill({ Brand: 'Test brand', ...values })
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }))
    expect(onSave).toHaveBeenCalledWith({
      name: 'paneer',
      brand: 'Test brand',
      basis: '100g',
      servingGrams: null,
      label: { kcal: 300, protein: 20, carbs: 2, fat: 24, sodiumMg: 20 },
    })
  })

  it('asks for what is missing and goes to the first of it', async () => {
    const { onSave } = renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Name')).toHaveFocus()
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Give the food a name.')
    expect(screen.getByLabelText('Sodium')).toHaveAccessibleDescription('Enter the sodium from the label.')
  })

  it('asks for the serving size when the label gives values per serving', async () => {
    const { onSave } = renderForm({ name: 'Test crackers' })
    expect(screen.queryByLabelText('One serving is')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Per serving' }))
    expect(screen.getByRole('button', { name: 'Per serving' })).toHaveAttribute('aria-pressed', 'true')
    await fill({
      'One serving is': '25',
      Calories: '120',
      Protein: '2',
      Carbs: '16',
      Fat: '5',
      Sodium: '200',
    })
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ basis: 'serving', servingGrams: 25 }))
  })

  it('says when protein, carbs and fat weigh more than the food', async () => {
    renderForm({ name: 'Test' })
    await fill({ ...values, Protein: '60', Carbs: '30', Fat: '11' })
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Protein, carbs and fat weigh more than the food itself.',
    )
  })

  it('checks the calories before saving, and saves anyway when asked', async () => {
    const { onSave } = renderForm({ name: 'Test' })
    await fill({ ...values, Calories: '100' })
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Check these numbers' })).toBeInTheDocument()
    // 4 x 20 + 4 x 2 + 9 x 24 = 304.
    expect(screen.getByText(/add up to about 304 kcal, but you entered 100 kcal/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Fix the numbers' }))
    expect(screen.getByLabelText('Calories')).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Save anyway' }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ label: expect.objectContaining({ kcal: 100 }) }),
    )
  })

  it('drops the check once a number changes, and checks again on the next save', async () => {
    const { onSave } = renderForm({ name: 'Test' })
    await fill({ ...values, Calories: '100' })
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }))
    await fill({ Calories: '300' })
    expect(screen.queryByRole('heading', { name: 'Check these numbers' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('shows why a save failed, and waits while one is on its way', () => {
    renderForm({ name: 'Test' }, { error: 'You already have Test.', saving: true })
    expect(screen.getByRole('alert')).toHaveTextContent('You already have Test.')
    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled()
  })

  it('goes back to the search', async () => {
    const { onBack } = renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Back to search' }))
    expect(onBack).toHaveBeenCalled()
  })
})

describe('changing a food of their own', () => {
  it('opens with its values and saves the changes', async () => {
    const { onSave } = renderForm(
      { name: 'Test cheese', kcal: '300', protein: '20', carbs: '2', fat: '24', sodiumMg: '20' },
      { mode: 'edit', headingLevel: 2 },
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Change your food' })).toBeInTheDocument()
    expect(screen.getByLabelText('Calories')).toHaveValue('300')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test cheese' }))
  })
})
