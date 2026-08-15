type Props = {
  className?: string
  size?: 'nav' | 'sm'
}

export function BrandMark({ className = '', size = 'nav' }: Props) {
  return (
    <svg
      className={`brand-mark brand-mark--${size} ${className}`.trim()}
      viewBox="0 0 420 96"
      fill="none"
      role="img"
      aria-hidden
    >
      <title>Hunt 4 Food</title>

      {/* Bow */}
      <path
        d="M8 58 C8 34, 24 18, 46 18 C58 18, 66 24, 70 34"
        stroke="#1f4d2b"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path d="M8 58 V68" stroke="#1f4d2b" strokeWidth="3" strokeLinecap="round" />

      {/* Arrow through Hunt */}
      <path d="M18 52 H118" stroke="#1f4d2b" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M118 52 L108 47 L108 57 Z" fill="#1f4d2b" />
      <path d="M22 52 L16 46 M22 52 L16 58" stroke="#1f4d2b" strokeWidth="2" strokeLinecap="round" />

      <text
        x="34"
        y="68"
        fill="#1f4d2b"
        fontFamily="'DM Sans', system-ui, sans-serif"
        fontWeight="800"
        fontSize="52"
        letterSpacing="-1"
      >
        Hunt
      </text>

      {/* 4 = fork + knife */}
      <g transform="translate(152 14)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 38 L12 8" stroke="#8dc63f" strokeWidth="3.2" />
        <path d="M22 38 L22 4" stroke="#8dc63f" strokeWidth="3.2" />
        <path d="M30 38 L28 8" stroke="#8dc63f" strokeWidth="3.2" />
        <path d="M8 40 H34" stroke="#8dc63f" strokeWidth="3.6" />
        <path d="M10 40 L30 68" stroke="#8dc63f" strokeWidth="3.4" />
        <path d="M30 40 V68" stroke="#8dc63f" strokeWidth="3.6" />
        <path d="M10 40 L4 34" stroke="#8dc63f" strokeWidth="3" />
      </g>

      <text
        x="214"
        y="68"
        fill="#5a9a4a"
        fontFamily="'DM Sans', system-ui, sans-serif"
        fontWeight="700"
        fontSize="52"
        letterSpacing="-0.5"
      >
        Food
      </text>

      {/* Leaves on d */}
      <g fill="#5a9a4a">
        <path d="M392 28 C398 22, 406 22, 410 28 C406 30, 400 31, 392 28 Z" />
        <path d="M402 24 C408 16, 418 18, 416 26 C412 27, 406 26, 402 24 Z" />
      </g>
      <g stroke="#5a9a4a" strokeWidth="1.4" fill="none" strokeLinecap="round">
        <path d="M392 28 C392 34, 396 38, 400 36" />
        <path d="M402 24 C404 30, 410 32, 414 28" />
      </g>
    </svg>
  )
}

export function brandAriaLabel() {
  return 'Hunt4Food'
}
