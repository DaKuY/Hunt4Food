import { cuisineById } from '../data/cuisines'
import type { CuisineId, Restaurant } from './types'

/** Best-effort signature dishes from OSM cuisine tags + selected cuisines. */
export function signatureDishes(place: Restaurant, selectedCuisines: CuisineId[]): string[] {
  const out: string[] = []
  const blob = `${place.cuisines.join(' ')} ${place.cuisineRaw ?? ''} ${place.name}`.toLowerCase()

  for (const id of selectedCuisines) {
    for (const dish of cuisineById(id).signatureDishes) {
      if (!out.includes(dish)) out.push(dish)
    }
  }

  for (const c of place.cuisines) {
    const match = selectedCuisines.find((id) => {
      const opt = cuisineById(id)
      return opt.osmTags.some((t) => t === c || c.includes(t))
    })
    if (match) {
      for (const dish of cuisineById(match).signatureDishes) {
        if (!out.includes(dish)) out.push(dish)
      }
    }
  }

  if (out.length < 3) {
    for (const id of selectedCuisines) {
      if (out.length >= 3) break
      for (const dish of cuisineById(id).signatureDishes) {
        if (!out.includes(dish)) out.push(dish)
      }
    }
  }

  if (out.length === 0 && /pizza/i.test(blob)) out.push('Margherita pizza', 'Pepperoni pizza', 'Garlic knots')
  if (out.length === 0 && /sushi|japanese/i.test(blob)) out.push('Salmon roll', 'Spicy tuna roll', 'Miso soup')
  if (out.length === 0 && /burger|american/i.test(blob)) out.push('Cheeseburger', 'Fries', 'Milkshake')

  return out.slice(0, 3)
}
