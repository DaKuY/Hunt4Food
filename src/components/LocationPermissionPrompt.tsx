import type { LocationPermissionMode } from '../lib/locationPref'

type Props = {
  open: boolean
  onChoose: (mode: LocationPermissionMode) => void
  onDismiss: () => void
}

export function LocationPermissionPrompt({ open, onChoose, onDismiss }: Props) {
  if (!open) return null

  return (
    <div className="perm-overlay" role="presentation" onClick={onDismiss}>
      <div
        className="perm-dialog"
        role="dialog"
        aria-labelledby="location-perm-title"
        aria-describedby="location-perm-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow">Location access</p>
        <h3 id="location-perm-title">Use your location?</h3>
        <p id="location-perm-desc" className="lede">
          OpenPlate centers the map on where you are to find nearby restaurants. Your coordinates stay in
          your browser — we do not store them on a server.
        </p>
        <div className="perm-actions">
          <button type="button" className="btn primary" onClick={() => onChoose('once')}>
            Allow once
          </button>
          <button type="button" className="btn ghost" onClick={() => onChoose('ask')}>
            Ask every time
          </button>
          <button type="button" className="btn ghost" onClick={() => onChoose('always')}>
            Always allow
          </button>
        </div>
        <button type="button" className="perm-dismiss muted" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  )
}
