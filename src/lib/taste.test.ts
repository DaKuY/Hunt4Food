import { describe, expect, it } from 'vitest'
import { emptyTaste, lovePlace, rebuildTasteWeights, removeLoved, skipPlace } from './taste'

const sushi = {
  id: 'sushi-1',
  name: 'Sushi One',
  city: 'Test City',
  cuisines: ['sushi'],
  rating: 5,
  vibeTags: ['quiet'],
}

describe('taste learning', () => {
  it('does not keep adding weight when the same place is loved repeatedly', () => {
    const first = lovePlace(emptyTaste(), sushi)
    const second = lovePlace(first, sushi)

    expect(second.loved).toHaveLength(1)
    expect(second.cuisineWeights.sushi).toBe(2)
    expect(second.vibeWeights.quiet).toBe(1)
  })

  it('reverses derived preferences when a loved place becomes skipped', () => {
    const loved = lovePlace(emptyTaste(), sushi)
    const skipped = skipPlace(loved, { ...sushi, rating: 1 })

    expect(skipped.loved).toHaveLength(0)
    expect(skipped.skipped).toHaveLength(1)
    expect(skipped.cuisineWeights.sushi).toBe(-1)
    expect(skipped.vibeWeights.quiet).toBeUndefined()
  })

  it('rebuilds weights after removing a loved place', () => {
    const loved = lovePlace(emptyTaste(), sushi)
    const removed = removeLoved(loved, sushi.id)

    expect(removed.cuisineWeights.sushi).toBeUndefined()
  })

  it('repairs stale stored weights from the source lists', () => {
    const rebuilt = rebuildTasteWeights({
      ...emptyTaste(),
      loved: [{ ...sushi, savedAt: new Date(0).toISOString() }],
      cuisineWeights: { sushi: 99 },
      vibeWeights: { quiet: 50 },
    })

    expect(rebuilt.cuisineWeights.sushi).toBe(2)
    expect(rebuilt.vibeWeights.quiet).toBe(1)
  })
})
