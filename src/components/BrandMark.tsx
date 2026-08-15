type Props = {
  className?: string
  size?: 'nav' | 'sm'
}

const LOGO_VERSION = '4'
const logoSrc = `${import.meta.env.BASE_URL}hunt4food_green_adventure_logo.png?v=${LOGO_VERSION}`

export function BrandMark({ className = '', size = 'nav' }: Props) {
  return (
    <img
      src={logoSrc}
      alt=""
      className={`brand-mark brand-mark--${size} ${className}`.trim()}
      draggable={false}
      decoding="async"
    />
  )
}

export function brandAriaLabel() {
  return 'Hunt4Food'
}
