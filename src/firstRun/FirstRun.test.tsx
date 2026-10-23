import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AppClient } from '../auth/context.ts'
import { FIRST_RUN_KEY, KG_PER_LB, readAnswers, saveAnswers } from '../lib/firstRun.ts'
import { FirstRun } from './FirstRun.tsx'

function renderFirstRun(path = '/', options: { oauthError?: Error } = {}) {
  window.history.replaceState(null, '', path)
  const signInWithOAuth = vi
    .fn<() => Promise<unknown>>()
    .mockResolvedValue({ data: {}, error: options.oauthError ?? null })
  const client = { auth: { signInWithOAuth } } as unknown as AppClient
  render(
    <AuthContext.Provider value={{ client, session: null, loading: false }}>
      <FirstRun />
    </AuthContext.Provider>,
  )
  return { signInWithOAuth }
}

const user = () => userEvent.setup()

async function continueOn() {
  await user().click(screen.getByRole('button', { name: 'Continue' }))
}

async function answerNumber(label: string, value: string) {
  const field = screen.getByLabelText(label)
  await user().clear(field)
  await user().type(field, value)
  await continueOn()
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
  localStorage.clear()
})

describe('the welcome screen', () => {
  it('offers the questions or signing in to an account', () => {
    renderFirstRun()
    expect(screen.getByRole('heading', { level: 1, name: 'Shumār' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Find your daily target' })).toHaveTextContent(
      'Your answers stay on this device until you sign in.',
    )
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/start/age')
    expect(screen.getByRole('button', { name: 'I already have an account' })).toBeEnabled()
  })

  it('opens the first question and puts focus on it', async () => {
    renderFirstRun()
    await user().click(screen.getByRole('link', { name: 'Get started' }))
    expect(window.location.pathname).toBe('/start/age')
    expect(screen.getByRole('heading', { level: 1, name: 'How old are you?' })).toHaveFocus()
    // Read out as "Question 1 of 6"; the word is visually hidden.
    expect(
      screen.getByText(
        (_, element) => element?.tagName === 'SPAN' && element.textContent === 'Question 1 of 6',
      ),
    ).toBeInTheDocument()
    expect(document.title).toBe('Age · Shumār')
  })
})

describe('the questions', () => {
  it('asks all six in order, in pounds, then hands over to Google with the answers kept', async () => {
    const { signInWithOAuth } = renderFirstRun('/start/age')

    await answerNumber('Age', '30')
    expect(screen.getByRole('heading', { level: 1, name: 'What is your sex?' })).toHaveFocus()
    expect(screen.getByText(/Pregnant or breastfeeding\?/)).toBeInTheDocument()
    await user().click(screen.getByRole('radio', { name: 'Male' }))
    await continueOn()

    expect(screen.getByRole('heading', { level: 1, name: 'What do you weigh?' })).toBeInTheDocument()
    await user().type(screen.getByLabelText('Weight'), '80')
    await user().click(screen.getByRole('button', { name: 'lb' }))
    // A weight already typed carries over into the new unit.
    expect(screen.getByLabelText('Weight')).toHaveValue('176.4')
    expect(screen.getByText('From 67 to 661 lb.')).toBeInTheDocument()
    await answerNumber('Weight', '176')

    await answerNumber('Height', '175')

    await user().click(screen.getByRole('radio', { name: /Lightly active/ }))
    await continueOn()

    expect(screen.getByRole('heading', { level: 1, name: 'What is your goal?' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'How fast?' })).not.toBeInTheDocument()
    await user().click(screen.getByRole('radio', { name: /Lose weight/ }))
    // The middle speed is chosen at first, and speeds read in the unit the weight was given in.
    expect(screen.getByRole('button', { name: '1.1 lb a week' })).toHaveAttribute('aria-pressed', 'true')
    await user().click(screen.getByRole('button', { name: '0.6 lb a week' }))
    expect(screen.getByText('About 300 kcal a day less than you burn.')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Sign in with Google to save' }))

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    expect(readAnswers()).toEqual({
      ageYears: 30,
      sex: 'male',
      weightKg: 176 * KG_PER_LB,
      weightUnit: 'lb',
      heightCm: 175,
      activity: 'light',
      goal: { kind: 'lose', kgPerWeek: 0.25 },
    })
  })

  it.each([
    ['age', 'Age', '17', 'Enter your age in whole years, from 18 to 100.'],
    ['age', 'Age', '', 'Enter your age in whole years, from 18 to 100.'],
    ['height', 'Height', '99', 'Enter a height from 100 to 250 cm.'],
  ])('explains a wrong %s and keeps the person on the question', async (step, label, value, message) => {
    saveAnswers({ ageYears: 30, sex: 'female', weightKg: 60, weightUnit: 'kg' })
    renderFirstRun(`/start/${step}`)
    const field = screen.getByLabelText(label)
    await user().clear(field)
    if (value) await user().type(field, value)
    await continueOn()

    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(expect.stringContaining(message))
    expect(field).toHaveFocus()
    expect(window.location.pathname).toBe(`/start/${step}`)

    // Typing again clears the error.
    await user().type(field, '1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('explains a weight out of range in the unit being typed', async () => {
    saveAnswers({ ageYears: 30, sex: 'female', weightUnit: 'lb' })
    renderFirstRun('/start/weight')
    await answerNumber('Weight', '662')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a weight from 67 to 661 lb.')
  })

  it('asks for a choice before going on', async () => {
    saveAnswers({ ageYears: 30, sex: 'female', weightKg: 60, weightUnit: 'kg', heightCm: 160 })
    renderFirstRun('/start/activity')
    await continueOn()
    expect(screen.getByRole('alert')).toHaveTextContent('Choose one to go on.')
    await user().click(screen.getByRole('radio', { name: /Sedentary/ }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('goes back a question with the answer still filled in', async () => {
    saveAnswers({ ageYears: 42, weightUnit: 'kg' })
    renderFirstRun('/start/sex')
    await user().click(screen.getByRole('link', { name: 'Back' }))
    expect(window.location.pathname).toBe('/start/age')
    expect(screen.getByLabelText('Age')).toHaveValue('42')
    await user().click(screen.getByRole('link', { name: 'Back' }))
    expect(window.location.pathname).toBe('/')
  })

  it('keeps answers through a reload, in the unit chosen', () => {
    saveAnswers({ ageYears: 30, sex: 'male', weightKg: 80, weightUnit: 'lb' })
    renderFirstRun('/start/weight')
    expect(screen.getByLabelText('Weight')).toHaveValue('176.4')
    expect(screen.getByRole('button', { name: 'lb' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('remembers the chosen goal and speed', () => {
    saveAnswers({
      ageYears: 30,
      sex: 'male',
      weightKg: 80,
      weightUnit: 'kg',
      heightCm: 175,
      activity: 'very',
      goal: { kind: 'lose', kgPerWeek: 0.75 },
    })
    renderFirstRun('/start/goal')
    expect(screen.getByRole('radio', { name: /Lose weight/ })).toBeChecked()
    expect(screen.getByRole('button', { name: '0.75 kg a week' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sends an address further on back to the first question left', () => {
    saveAnswers({ ageYears: 30, weightUnit: 'kg' })
    renderFirstRun('/start/height')
    expect(window.location.pathname).toBe('/start/sex')
  })

  it.each(['/start/shoe-size', '/trends', '/log'])('sends %s to the welcome screen', (path) => {
    renderFirstRun(path)
    expect(window.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Shumār' })).toBeInTheDocument()
  })

  it('explains when Google sign-in cannot start after the last question', async () => {
    saveAnswers({
      ageYears: 30,
      sex: 'male',
      weightKg: 80,
      weightUnit: 'kg',
      heightCm: 175,
      activity: 'light',
      goal: { kind: 'maintain' },
    })
    renderFirstRun('/start/goal', { oauthError: new Error('offline') })
    await user().click(screen.getByRole('button', { name: 'Sign in with Google to save' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent("We couldn't start Google sign-in"),
    )
    expect(screen.getByRole('button', { name: 'Sign in with Google to save' })).toBeEnabled()
    expect(localStorage.getItem(FIRST_RUN_KEY)).not.toBeNull()
  })
})
