type Props = {
  className?: string
  /** Smaller variant for footer / inline use */
  size?: 'nav' | 'sm'
}

function BowArrow() {
  return (
    <svg className="brand-bow-arrow" viewBox="0 0 52 22" aria-hidden>
      <path
        d="M4 14 C10 4, 22 2, 34 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M34 8 L48 6 M48 6 L44 4 M48 6 L44 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="4" y1="14" x2="4" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function ForkFour() {
  return (
    <svg className="brand-fork-four" viewBox="0 0 22 30" aria-hidden>
      {/* Fork tines */}
      <path d="M5 11 L7 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 11 L11 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 11 L15 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* "4" crossbar + diagonal leg */}
      <path d="M3 13 H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 13 L17 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* "4" right stem / fork handle */}
      <path d="M17 13 V28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function BrandMark({ className = '', size = 'nav' }: Props) {
  return (
    <span className={`brand-mark brand-mark--${size} ${className}`.trim()} aria-hidden>
      <span className="brand-hunt">
        <BowArrow />
        <span className="brand-hunt-text">Hunt</span>
      </span>
      <ForkFour />
      <span className="brand-food">
        <span className="brand-food-f">F</span>
        <span className="brand-eyes" role="img" aria-label="oo">
          👀
        </span>
        <span className="brand-food-d">d</span>
      </span>
    </span>
  )
}

export function brandAriaLabel() {
  return 'Hunt4Food'
}
