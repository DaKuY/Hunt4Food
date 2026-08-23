const FIRST_RESULT_ID = 'first-result'

export function scrollToFirstResult(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById(FIRST_RESULT_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
}

export { FIRST_RESULT_ID }
