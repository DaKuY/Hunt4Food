import { CUISINES, CUISINE_GROUPS, DIETARY_OPTIONS } from '../data/cuisines'
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
        <p className="eyebrow">Hunt4Food · Step 2 · {cityLabel}</p>
        <h2>What are you craving?</h2>
        <p className="lede">
          Pick up to three food types — healthy picks that still taste great, or whatever you&apos;re in the
          mood for. Dietary boosts are optional soft signals, not hard filters.
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

      <h3 className="subhead">Dietary boosts</h3>
      <div className="chip-row wrap">
        {DIETARY_OPTIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`chip ghost ${dietary.includes(d.id) ? 'on' : ''}`}
            onClick={() => toggleDiet(d.id)}
            title={d.hint}
          >
            {d.label}
          </button>
        ))}
      </div>
      {dietary.includes('no_seed_oils') && (
        <p className="muted small">
          Seed-oil grades from{' '}
          <a href="https://seedoiltracker.com" target="_blank" rel="noreferrer">
            Seed Oil Tracker
          </a>{' '}
          when the place matches a known chain. Seed Oil Scout has no public API — we use Seed Oil Tracker
          instead.
        </p>
      )}

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
