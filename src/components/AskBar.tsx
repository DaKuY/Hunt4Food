import { useState } from 'react'

type Props = {
  onAsk: (text: string) => void
  busy: boolean
  /** What was understood ("Mexican · near Coppell TX · no seed oils") or a problem to fix. */
  message: { kind: 'understood' | 'problem'; text: string } | null
}

const EXAMPLES = [
  "Mexican near Coppell TX that doesn't use seed oils",
  'healthy steak or salmon near Frisco',
  'cheap gluten-free Italian within 5 miles',
]

/** One-box plain-language search: type what you want instead of stepping through the picker. */
export function AskBar({ onAsk, busy, message }: Props) {
  const [text, setText] = useState('')

  function submit(value: string) {
    const trimmed = value.trim()
    if (!trimmed || busy) return
    onAsk(trimmed)
  }

  return (
    <form
      className="ask-bar"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        submit(text)
      }}
    >
      <label className="ask-label" htmlFor="ask-input">
        Ask Hunt4Food
      </label>
      <div className="ask-row">
        <input
          id="ask-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`e.g. "${EXAMPLES[0]}"`}
          autoComplete="off"
          enterKeyHint="search"
        />
        <button type="submit" className="btn primary" disabled={busy || !text.trim()}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </div>
      {message ? (
        <p className={message.kind === 'problem' ? 'ask-message problem' : 'ask-message'} aria-live="polite">
          {message.kind === 'understood' ? <>Searching for: <strong>{message.text}</strong></> : message.text}
        </p>
      ) : (
        <div className="chip-row wrap ask-examples">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="chip ghost"
              onClick={() => {
                setText(example)
                submit(example)
              }}
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </form>
  )
}
