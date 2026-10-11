import { CUISINES, cuisineById } from '../data/cuisines'
import { matchKnownChain } from './healthySignals'
import type { CuisineId, Restaurant } from './types'

/**
 * Best-effort signature dishes. The place's own category comes first (a
 * smoothie bar shows smoothies, a steakhouse shows steak); the selected
 * cuisines only fill in when the place matches them. "Healthy" is a mode, not
 * a cuisine, so its generic dishes are used only when nothing more specific fits.
 */
export function signatureDishes(place: Restaurant, selectedCuisines: CuisineId[]): string[] {
  const out: string[] = []
  const add = (id: CuisineId) => {
    for (const dish of cuisineById(id).signatureDishes) {
      if (!out.includes(dish)) out.push(dish)
    }
  }
  const blob = `${place.cuisines.join(' ')} ${place.cuisineRaw ?? ''} ${place.name}`.toLowerCase()
  const tags = [...place.cuisines, ...(place.cuisineRaw ?? '').split(/[;,]/)]
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean)

  // 0. Healthy brands and places tagged healthy: their dishes, not the generic "american" list.
  const chain = matchKnownChain(place)
  if (chain?.lane === 'smoothie') add('smoothie')
  else if (chain?.lane === 'clean_cooking' || tags.includes('healthy')) add('healthy')

  // 1. Exact category match, preferring cuisines the user picked.
  const exact = (id: CuisineId) => cuisineById(id).osmTags.some((tag) => tags.includes(tag))
  for (const id of selectedCuisines) if (id !== 'healthy' && exact(id)) add(id)
  for (const tag of tags) {
    const match = CUISINES.find((c) => c.id !== 'healthy' && c.osmTags[0] === tag)
      ?? CUISINES.find((c) => c.id !== 'healthy' && c.osmTags.includes(tag))
    if (match) add(match.id)
    if (out.length >= 3) break
  }

  // 2. Name hints when OSM has no cuisine tag (common for chains).
  if (out.length === 0) {
    if (/smoothie|juice|acai|açaí/.test(blob)) add('smoothie')
    else if (/steak|chophouse/.test(blob)) add('steak')
    else if (/poke/.test(blob)) add('bowl')
    else if (/sushi/.test(blob)) add('sushi')
    else if (/salad|greens/.test(blob)) add('salad')
    else if (/pizza/.test(blob)) add('pizza')
    else if (/burger/.test(blob)) add('burger')
  }

  // 3. Only now fall back to what the user picked.
  if (out.length === 0) for (const id of selectedCuisines) add(id)

  return out.slice(0, 3)
}
