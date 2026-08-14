import { useRef, useState } from 'react'
import {
  exportTaste,
  importTaste,
  lovePlace,
  removeLoved,
  type ShortlistItem,
} from '../lib/taste'
import type { TasteProfile } from '../lib/types'

type Props = {
  taste: TasteProfile
  onTasteChange: (t: TasteProfile) => void
  shortlist: ShortlistItem[]
  onClearShortlist: () => void
  shareUrl: string
}

export function TastePage({ taste, onTasteChange, shortlist, onClearShortlist, shareUrl }: Props) {
  const [name, setName] = useState('')
  const [cuisines, setCuisines] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function addManual() {
    if (!name.trim()) return
    const next = lovePlace(taste, {
      id: `manual-${Date.now()}`,
      name: name.trim(),
      cuisines: cuisines
        .split(',')
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean),
      rating: 5,
      vibeTags: [],
    })
    onTasteChange(next)
    setName('')
    setCuisines('')
    setMessage('Saved to your taste profile.')
  }

  function doExport() {
    const blob = new Blob([exportTaste(taste)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openplate-taste.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport(file: File) {
    try {
      const text = await file.text()
      const next = importTaste(text)
      onTasteChange(next)
      setMessage('Taste profile imported.')
    } catch {
      setMessage('Could not import that file.')
    }
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setMessage('Shortlist link copied.')
    } catch {
      setMessage(shareUrl)
    }
  }

  return (
    <section className="step taste-page">
      <header className="step-header">
        <p className="eyebrow">My Taste</p>
        <h2>Teach OpenPlate what you like</h2>
        <p className="lede">
          Everything stays in this browser. Export the JSON to move phones — or paste it into Cursor later
          so recommendations can be tuned from your real history.
        </p>
      </header>

      {message && <p className="banner">{message}</p>}

      <h3 className="subhead">Places you love ({taste.loved.length})</h3>
      {taste.loved.length === 0 ? (
        <p className="muted">Mark “Loved it” on results, or add a place below.</p>
      ) : (
        <ul className="taste-list">
          {taste.loved.map((p) => (
            <li key={p.id}>
              <div>
                <strong>{p.name}</strong>
                <span className="muted"> {p.cuisines.join(', ')}</span>
              </div>
              <button type="button" className="btn tiny ghost" onClick={() => onTasteChange(removeLoved(taste, p.id))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="manual-add">
        <h3 className="subhead">Add a place you like</h3>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Restaurant name" />
        </label>
        <label className="field">
          <span>Cuisines (comma-separated)</span>
          <input
            value={cuisines}
            onChange={(e) => setCuisines(e.target.value)}
            placeholder="japanese, ramen"
          />
        </label>
        <button type="button" className="btn primary" onClick={addManual}>
          Save to taste
        </button>
      </div>

      <h3 className="subhead">Shortlist ({shortlist.length})</h3>
      {shortlist.length === 0 ? (
        <p className="muted">Shortlist places from results to share with friends.</p>
      ) : (
        <>
          <ul className="taste-list">
            {shortlist.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong>
              </li>
            ))}
          </ul>
          <div className="chip-row">
            <button type="button" className="btn primary" onClick={() => void copyShare()}>
              Copy shortlist link
            </button>
            <button type="button" className="btn ghost" onClick={onClearShortlist}>
              Clear
            </button>
          </div>
        </>
      )}

      <h3 className="subhead">Backup</h3>
      <div className="chip-row">
        <button type="button" className="btn ghost" onClick={doExport}>
          Export JSON
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void doImport(f)
          }}
        />
      </div>
    </section>
  )
}
