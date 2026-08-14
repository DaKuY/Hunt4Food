import { CUISINES, DIETARY_OPTIONS } from '../data/cuisines'
import type { CuisineId, DietaryId } from '../lib/types'

type Props = {
  selected: CuisineId[]
  dietary: DietaryId[]
  onChange: (cuisines: CuisineId[]) => void
  onDietaryChange: (dietary: DietaryId[]) => void
  onBack: () => void
  onNext: () => void
  cityLabel: string
}

export function CuisineStep({
  selected,
  dietary,
  onChange,
  onDietaryChange,
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

  function toggleDiet(id: DietaryId) {
    if (dietary.includes(id)) onDietaryChange(dietary.filter((d) => d !== id))
    else onDietaryChange([...dietary, id])
  }

  return (
    <section className="step cuisine-step">
      <header className="step-header">
        <p className="eyebrow">Step 2 · {cityLabel}</p>
        <h2>What are you craving?</h2>
        <p className="lede">Pick up to three food types. Soft dietary boosts are optional — no hard filters.</p>
      </header>

      <div className="chip-row wrap">
        {CUISINES.map((c) => {
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
      <p className="muted">{selected.length}/3 selected</p>

      <h3 className="subhead">Dietary boosts</h3>
      <div className="chip-row wrap">
        {DIETARY_OPTIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`chip ghost ${dietary.includes(d.id) ? 'on' : ''}`}
            onClick={() => toggleDiet(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>

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
