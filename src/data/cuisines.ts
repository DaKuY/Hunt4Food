import type { CuisineId, DietaryId } from '../lib/types'

export type CuisineOption = {
  id: CuisineId
  label: string
  /** OSM cuisine=* values (and related amenity hints) */
  osmTags: string[]
  keywords: string[]
}

export const CUISINES: CuisineOption[] = [
  {
    id: 'seafood',
    label: 'Seafood',
    osmTags: ['seafood', 'fish', 'fish_and_chips'],
    keywords: ['seafood', 'fish', 'oyster', 'crab', 'lobster'],
  },
  {
    id: 'indian',
    label: 'Indian',
    osmTags: ['indian', 'curry', 'pakistani', 'nepalese', 'bangladeshi'],
    keywords: ['indian', 'curry', 'tandoori', 'biryani'],
  },
  {
    id: 'chinese',
    label: 'Chinese',
    osmTags: ['chinese', 'dim_sum', 'noodle', 'dumpling'],
    keywords: ['chinese', 'dim sum', 'szechuan', 'cantonese'],
  },
  {
    id: 'japanese',
    label: 'Japanese',
    osmTags: ['japanese', 'ramen', 'sushi', 'udon', 'izakaya'],
    keywords: ['japanese', 'ramen', 'sushi', 'izakaya'],
  },
  {
    id: 'italian',
    label: 'Italian',
    osmTags: ['italian', 'pasta', 'pizza'],
    keywords: ['italian', 'pasta', 'trattoria', 'osteria'],
  },
  {
    id: 'smoothie',
    label: 'Smoothie',
    osmTags: ['juice', 'smoothie', 'bubble_tea'],
    keywords: ['smoothie', 'juice', 'acai', 'bowl'],
  },
  {
    id: 'healthy',
    label: 'Healthy',
    osmTags: ['healthy', 'salad', 'bowl', 'juice', 'vegetarian', 'vegan'],
    keywords: ['healthy', 'salad', 'bowl', 'grain', 'poke'],
  },
  {
    id: 'mexican',
    label: 'Mexican',
    osmTags: ['mexican', 'tex-mex', 'tacos', 'burrito'],
    keywords: ['mexican', 'taco', 'burrito', 'cantina'],
  },
  {
    id: 'thai',
    label: 'Thai',
    osmTags: ['thai'],
    keywords: ['thai', 'pad thai', 'curry'],
  },
  {
    id: 'korean',
    label: 'Korean',
    osmTags: ['korean', 'barbecue'],
    keywords: ['korean', 'bbq', 'kimchi', 'bibimbap'],
  },
  {
    id: 'mediterranean',
    label: 'Mediterranean',
    osmTags: ['mediterranean', 'greek', 'lebanese', 'turkish', 'middle_eastern'],
    keywords: ['mediterranean', 'greek', 'falafel', 'mezze'],
  },
  {
    id: 'american',
    label: 'American',
    osmTags: ['american', 'burger', 'steak', 'diner'],
    keywords: ['american', 'burger', 'diner', 'steak'],
  },
  {
    id: 'pizza',
    label: 'Pizza',
    osmTags: ['pizza'],
    keywords: ['pizza', 'pizzeria'],
  },
  {
    id: 'sushi',
    label: 'Sushi',
    osmTags: ['sushi', 'japanese'],
    keywords: ['sushi', 'sashimi', 'omakase'],
  },
  {
    id: 'vegan',
    label: 'Vegan',
    osmTags: ['vegan', 'vegetarian'],
    keywords: ['vegan', 'plant-based'],
  },
  {
    id: 'bbq',
    label: 'BBQ',
    osmTags: ['bbq', 'barbecue', 'grill'],
    keywords: ['bbq', 'barbecue', 'smokehouse'],
  },
]

export const DIETARY_OPTIONS: { id: DietaryId; label: string }[] = [
  { id: 'vegetarian', label: 'Vegetarian-friendly' },
  { id: 'vegan', label: 'Vegan-friendly' },
  { id: 'gluten_free', label: 'Gluten-free options' },
  { id: 'halal', label: 'Halal' },
]

export function cuisineById(id: CuisineId): CuisineOption {
  const found = CUISINES.find((c) => c.id === id)
  if (!found) throw new Error(`Unknown cuisine: ${id}`)
  return found
}
