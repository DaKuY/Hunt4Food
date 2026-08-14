import type { CuisineId, DietaryId } from '../lib/types'

export type CuisineOption = {
  id: CuisineId
  label: string
  /** OSM cuisine=* values (and related amenity hints) */
  osmTags: string[]
  keywords: string[]
  /** Typical popular dishes shown when live menu data is unavailable */
  signatureDishes: string[]
}

export const CUISINES: CuisineOption[] = [
  {
    id: 'seafood',
    label: 'Seafood',
    osmTags: ['seafood', 'fish', 'fish_and_chips'],
    keywords: ['seafood', 'fish', 'oyster', 'crab', 'lobster'],
    signatureDishes: ['Grilled salmon', 'Fish & chips', 'Shrimp cocktail'],
  },
  {
    id: 'indian',
    label: 'Indian',
    osmTags: ['indian', 'curry', 'pakistani', 'nepalese', 'bangladeshi'],
    keywords: ['indian', 'curry', 'tandoori', 'biryani'],
    signatureDishes: ['Butter chicken', 'Biryani', 'Garlic naan'],
  },
  {
    id: 'chinese',
    label: 'Chinese',
    osmTags: ['chinese', 'dim_sum', 'noodle', 'dumpling'],
    keywords: ['chinese', 'dim sum', 'szechuan', 'cantonese'],
    signatureDishes: ['Kung pao chicken', 'Dim sum', 'Fried rice'],
  },
  {
    id: 'japanese',
    label: 'Japanese',
    osmTags: ['japanese', 'ramen', 'sushi', 'udon', 'izakaya'],
    keywords: ['japanese', 'ramen', 'sushi', 'izakaya'],
    signatureDishes: ['Ramen', 'Gyoza', 'Chicken katsu'],
  },
  {
    id: 'italian',
    label: 'Italian',
    osmTags: ['italian', 'pasta', 'pizza'],
    keywords: ['italian', 'pasta', 'trattoria', 'osteria'],
    signatureDishes: ['Margherita pizza', 'Carbonara', 'Tiramisu'],
  },
  {
    id: 'smoothie',
    label: 'Smoothie',
    osmTags: ['juice', 'smoothie', 'bubble_tea'],
    keywords: ['smoothie', 'juice', 'acai', 'bowl'],
    signatureDishes: ['Açaí bowl', 'Green smoothie', 'Protein shake'],
  },
  {
    id: 'healthy',
    label: 'Healthy',
    osmTags: ['healthy', 'salad', 'bowl', 'juice', 'vegetarian', 'vegan'],
    keywords: ['healthy', 'salad', 'bowl', 'grain', 'poke'],
    signatureDishes: ['Grain bowl', 'Kale salad', 'Poke bowl'],
  },
  {
    id: 'mexican',
    label: 'Mexican',
    osmTags: ['mexican', 'tex-mex', 'tacos', 'burrito'],
    keywords: ['mexican', 'taco', 'burrito', 'cantina'],
    signatureDishes: ['Carne asada tacos', 'Guacamole', 'Burrito bowl'],
  },
  {
    id: 'thai',
    label: 'Thai',
    osmTags: ['thai'],
    keywords: ['thai', 'pad thai', 'curry'],
    signatureDishes: ['Pad thai', 'Green curry', 'Tom yum soup'],
  },
  {
    id: 'korean',
    label: 'Korean',
    osmTags: ['korean', 'barbecue'],
    keywords: ['korean', 'bbq', 'kimchi', 'bibimbap'],
    signatureDishes: ['Bulgogi', 'Bibimbap', 'Korean fried chicken'],
  },
  {
    id: 'mediterranean',
    label: 'Mediterranean',
    osmTags: ['mediterranean', 'greek', 'lebanese', 'turkish', 'middle_eastern'],
    keywords: ['mediterranean', 'greek', 'falafel', 'mezze'],
    signatureDishes: ['Falafel plate', 'Hummus', 'Shawarma'],
  },
  {
    id: 'american',
    label: 'American',
    osmTags: ['american', 'burger', 'steak', 'diner'],
    keywords: ['american', 'burger', 'diner', 'steak'],
    signatureDishes: ['Cheeseburger', 'Mac & cheese', 'Buffalo wings'],
  },
  {
    id: 'pizza',
    label: 'Pizza',
    osmTags: ['pizza'],
    keywords: ['pizza', 'pizzeria'],
    signatureDishes: ['Margherita', 'Pepperoni', 'White pizza'],
  },
  {
    id: 'sushi',
    label: 'Sushi',
    osmTags: ['sushi', 'japanese'],
    keywords: ['sushi', 'sashimi', 'omakase'],
    signatureDishes: ['Salmon roll', 'Spicy tuna roll', 'Sashimi platter'],
  },
  {
    id: 'vegan',
    label: 'Vegan',
    osmTags: ['vegan', 'vegetarian'],
    keywords: ['vegan', 'plant-based'],
    signatureDishes: ['Buddha bowl', 'Vegan burger', 'Cauliflower tacos'],
  },
  {
    id: 'bbq',
    label: 'BBQ',
    osmTags: ['bbq', 'barbecue', 'grill'],
    keywords: ['bbq', 'barbecue', 'smokehouse'],
    signatureDishes: ['Brisket', 'Pulled pork', 'Burnt ends'],
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
