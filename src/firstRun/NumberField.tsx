import type { ReactNode } from 'react'
import { Alert } from '../components/Alert.tsx'

interface NumberFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** The unit shown after the number, such as "years". */
  suffix: string
  hint: string
  error: string | null
  inputMode: 'numeric' | 'decimal'
  /** Something beside the label, such as the kg and lb choice. */
  aside?: ReactNode
}

/** A large number field with its unit after it, the accepted range under it, and any error. */
export function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  hint,
  error,
  inputMode,
  aside,
}: NumberFieldProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-2">
      <div className={`flex items-center justify-between gap-3 ${aside ? 'min-h-11' : ''}`}>
        <label htmlFor={id} className="text-body-sm text-koshur-muted">
          {label}
        </label>
        {aside}
      </div>
      <div
        className={`flex h-13 items-center gap-3 rounded-xl border bg-koshur-surface px-4 has-focus-visible:ring-2 has-focus-visible:ring-deficit-ring ${
          error ? 'border-alert-surplus' : 'border-koshur-border'
        }`}
      >
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
          className="min-w-0 flex-1 bg-transparent text-heading font-semibold text-koshur-silk outline-none"
        />
        <span className="text-body text-koshur-muted">{suffix}</span>
      </div>
      {error && (
        <div id={errorId}>
          <Alert>{error}</Alert>
        </div>
      )}
      <p id={hintId} className="m-0 text-body-sm text-koshur-muted">
        {hint}
      </p>
    </div>
  )
}
