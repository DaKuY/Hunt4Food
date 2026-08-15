type Props = {
  className?: string
  size?: 'nav' | 'sm'
}

const LOGO_VERSION = '5'
const logoSrc = `${import.meta.env.BASE_URL}9AD535AB-88A7-4292-B8D4-C508F0D7853C.png?v=${LOGO_VERSION}`

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
