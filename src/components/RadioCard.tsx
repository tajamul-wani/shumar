interface RadioCardProps {
  name: string
  value: string
  label: string
  detail?: string
  checked: boolean
  onChange: () => void
}

/**
 * One choice in a group, as a card. A real radio button sits inside, hidden from sight but not
 * from keyboards or screen readers, so arrow keys move between the cards. The circle beside the
 * text is drawn to match it, at the top so it lines up with the first line when the text wraps.
 */
export function RadioCard({ name, value, label, detail, checked, onChange }: RadioCardProps) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-koshur-surface p-4 has-focus-visible:ring-2 has-focus-visible:ring-deficit-ring ${
        checked ? 'border-deficit-ring' : 'border-koshur-border'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? 'border-deficit-ring' : 'border-koshur-muted'
        }`}
      >
        {checked && <span className="size-2.5 rounded-full bg-deficit-ring" />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body font-semibold text-koshur-silk">{label}</span>
        {detail && <span className="text-body-sm text-koshur-muted">{detail}</span>}
      </span>
    </label>
  )
}
