import { CUISINES, CUISINE_GROUPS } from '../data/cuisines'
import type { CuisineId } from '../lib/types'

type Props = {
  selected: CuisineId[]
  keyword: string
  onChange: (cuisines: CuisineId[]) => void
  onKeywordChange: (keyword: string) => void
  onBack: () => void
  onNext: () => void
  cityLabel: string
}

export function CuisineStep({
  selected,
  keyword,
  onChange,
  onKeywordChange,
  onBack,
  onNext,
  cityLabel,
}: Props) {
  function toggle(id: CuisineId) {
    if (selected.includes(id)) {
      onChange(selected.filter((c) => c !== id))
      return
    }
    if (selected.length >= 3) return
    onChange([...selected, id])
  }

  return (
    <section className="step cuisine-step">
      <header className="step-header">
        <p className="eyebrow">Hunt4Food · Step 2 · {cityLabel}</p>
        <h2>What are you craving?</h2>
        <p className="lede">
          Pick up to three food types — healthy picks that still taste great, or whatever you&apos;re in the
          mood for.
        </p>
      </header>

      {CUISINE_GROUPS.map((group) => (
        <div key={group.id} className="cuisine-group">
          <h3 className="subhead">{group.label}</h3>
          <div className="chip-row wrap">
            {CUISINES.filter((c) => c.group === group.id).map((c) => {
              const on = selected.includes(c.id)
              const disabled = !on && selected.length >= 3
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${on ? 'on' : ''}`}
                  disabled={disabled}
                  onClick={() => toggle(c.id)}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <p className="muted">{selected.length}/3 selected</p>

      <label className="field keyword-field">
        <span>Keyword search (optional)</span>
        <input
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder='e.g. "wild caught fish", "grass fed steak", "organic salad"'
          autoComplete="off"
        />
      </label>
      <p className="muted small">
        Boosts places whose name or listing mentions your phrase. Soft signal, not a hard filter.
      </p>

      <div className="step-actions row">
        <button type="button" className="btn ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn primary" disabled={selected.length === 0} onClick={onNext}>
          Find 10 places
        </button>
      </div>
    </section>
  )
}
