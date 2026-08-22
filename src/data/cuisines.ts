import type { CuisineId, DietaryId } from '../lib/types'

export type CuisineGroup = 'healthy' | 'food'

export type CuisineOption = {
  id: CuisineId
  label: string
  group: CuisineGroup
  /** OSM cuisine=* values (and related amenity hints) */
  osmTags: string[]
  keywords: string[]
  /** Typical popular dishes shown when live menu data is unavailable */
  signatureDishes: string[]
}

export const CUISINE_GROUPS: { id: CuisineGroup; label: string }[] = [
  { id: 'food', label: 'Food types' },
]

export const CUISINES: CuisineOption[] = [
  {
    id: 'salmon',
    label: 'Salmon',
    group: 'food',
    osmTags: ['seafood', 'fish', 'sushi', 'japanese'],
    keywords: ['salmon', 'smoked salmon', 'gravlax', 'poke'],
    signatureDishes: ['Grilled salmon', 'Salmon poke bowl', 'Teriyaki salmon'],
  },
  {
    id: 'steak',
    label: 'Steak',
    group: 'food',
    osmTags: ['steak', 'steak_house', 'grill', 'american', 'bbq'],
    keywords: ['steak', 'steakhouse', 'ribeye', 'filet', 'chophouse', 'prime rib'],
    signatureDishes: ['Ribeye', 'Filet mignon', 'NY strip'],
  },
  {
    id: 'salad',
    label: 'Salad',
    group: 'food',
    osmTags: ['salad', 'healthy', 'vegetarian', 'vegan', 'bowl'],
    keywords: ['salad', 'greens', 'caesar', 'kale', 'grain bowl'],
    signatureDishes: ['Caesar salad', 'Kale salad', 'Cobb salad'],
  },
  {
    id: 'smoothie',
    label: 'Smoothie',
    group: 'food',
    osmTags: ['juice', 'smoothie', 'bubble_tea'],
    keywords: ['smoothie', 'juice', 'acai', 'bowl', 'shake'],
    signatureDishes: ['Açaí bowl', 'Green smoothie', 'Protein shake'],
  },
  {
    id: 'pizza',
    label: 'Pizza',
    group: 'food',
    osmTags: ['pizza'],
    keywords: ['pizza', 'pizzeria'],
    signatureDishes: ['Margherita', 'Pepperoni', 'White pizza'],
  },
  {
    id: 'sushi',
    label: 'Sushi',
    group: 'food',
    osmTags: ['sushi', 'japanese'],
    keywords: ['sushi', 'sashimi', 'omakase', 'nigiri'],
    signatureDishes: ['Salmon roll', 'Spicy tuna roll', 'Sashimi platter'],
  },
  {
    id: 'burger',
    label: 'Burger',
    group: 'food',
    osmTags: ['burger', 'american', 'fast_food'],
    keywords: ['burger', 'cheeseburger', 'smash burger', 'hamburger'],
    signatureDishes: ['Cheeseburger', 'Bacon burger', 'Veggie burger'],
  },
  {
    id: 'tacos',
    label: 'Tacos',
    group: 'food',
    osmTags: ['mexican', 'tacos', 'tex-mex', 'burrito'],
    keywords: ['taco', 'tacos', 'taqueria', 'burrito'],
    signatureDishes: ['Carne asada tacos', 'Fish tacos', 'Al pastor'],
  },
  {
    id: 'ramen',
    label: 'Ramen',
    group: 'food',
    osmTags: ['ramen', 'japanese', 'noodle'],
    keywords: ['ramen', 'noodle soup', 'tonkotsu', 'miso ramen'],
    signatureDishes: ['Tonkotsu ramen', 'Miso ramen', 'Shoyu ramen'],
  },
  {
    id: 'bowl',
    label: 'Bowl',
    group: 'food',
    osmTags: ['bowl', 'healthy', 'poke', 'salad'],
    keywords: ['bowl', 'grain bowl', 'poke bowl', 'buddha bowl', 'acai'],
    signatureDishes: ['Poke bowl', 'Grain bowl', 'Burrito bowl'],
  },
  {
    id: 'coffee',
    label: 'Coffee',
    group: 'food',
    osmTags: ['coffee_shop', 'cafe', 'coffee'],
    keywords: ['coffee', 'espresso', 'latte', 'cafe', 'café'],
    signatureDishes: ['Latte', 'Cappuccino', 'Pour-over'],
  },
  {
    id: 'seafood',
    label: 'Seafood',
    group: 'food',
    osmTags: ['seafood', 'fish', 'fish_and_chips'],
    keywords: ['seafood', 'fish', 'oyster', 'crab', 'lobster', 'shrimp'],
    signatureDishes: ['Fish & chips', 'Shrimp cocktail', 'Oysters'],
  },
  {
    id: 'indian',
    label: 'Indian',
    group: 'food',
    osmTags: ['indian', 'curry', 'pakistani', 'nepalese', 'bangladeshi'],
    keywords: ['indian', 'curry', 'tandoori', 'biryani'],
    signatureDishes: ['Butter chicken', 'Biryani', 'Garlic naan'],
  },
  {
    id: 'chinese',
    label: 'Chinese',
    group: 'food',
    osmTags: ['chinese', 'dim_sum', 'noodle', 'dumpling'],
    keywords: ['chinese', 'dim sum', 'szechuan', 'cantonese'],
    signatureDishes: ['Kung pao chicken', 'Dim sum', 'Fried rice'],
  },
  {
    id: 'japanese',
    label: 'Japanese',
    group: 'food',
    osmTags: ['japanese', 'ramen', 'sushi', 'udon', 'izakaya'],
    keywords: ['japanese', 'ramen', 'sushi', 'izakaya'],
    signatureDishes: ['Ramen', 'Gyoza', 'Chicken katsu'],
  },
  {
    id: 'italian',
    label: 'Italian',
    group: 'food',
    osmTags: ['italian', 'pasta', 'pizza'],
    keywords: ['italian', 'pasta', 'trattoria', 'osteria'],
    signatureDishes: ['Margherita pizza', 'Carbonara', 'Tiramisu'],
  },
  {
    id: 'healthy',
    label: 'Healthy',
    group: 'healthy',
    osmTags: ['healthy', 'salad', 'bowl', 'juice', 'vegetarian', 'vegan'],
    keywords: [
      'healthy',
      'salad',
      'bowl',
      'grain',
      'poke',
      'organic',
      'grass-fed',
      'grass fed',
      'pasture',
      'avocado oil',
      'smoothie',
      'juice',
      'true food',
    ],
    signatureDishes: ['Grain bowl', 'Grilled salmon', 'Chicken breast'],
  },
  {
    id: 'mexican',
    label: 'Mexican',
    group: 'food',
    osmTags: ['mexican', 'tex-mex', 'tacos', 'burrito'],
    keywords: ['mexican', 'taco', 'burrito', 'cantina'],
    signatureDishes: ['Carne asada tacos', 'Guacamole', 'Burrito bowl'],
  },
  {
    id: 'thai',
    label: 'Thai',
    group: 'food',
    osmTags: ['thai'],
    keywords: ['thai', 'pad thai', 'curry'],
    signatureDishes: ['Pad thai', 'Green curry', 'Tom yum soup'],
  },
  {
    id: 'korean',
    label: 'Korean',
    group: 'food',
    osmTags: ['korean', 'barbecue'],
    keywords: ['korean', 'bbq', 'kimchi', 'bibimbap'],
    signatureDishes: ['Bulgogi', 'Bibimbap', 'Korean fried chicken'],
  },
  {
    id: 'mediterranean',
    label: 'Mediterranean',
    group: 'food',
    osmTags: ['mediterranean', 'greek', 'lebanese', 'turkish', 'middle_eastern'],
    keywords: ['mediterranean', 'greek', 'falafel', 'mezze'],
    signatureDishes: ['Falafel plate', 'Hummus', 'Shawarma'],
  },
  {
    id: 'american',
    label: 'American',
    group: 'food',
    osmTags: ['american', 'burger', 'diner'],
    keywords: ['american', 'burger', 'diner', 'comfort food'],
    signatureDishes: ['Cheeseburger', 'Mac & cheese', 'Buffalo wings'],
  },
  {
    id: 'vegan',
    label: 'Vegan',
    group: 'food',
    osmTags: ['vegan', 'vegetarian'],
    keywords: ['vegan', 'plant-based'],
    signatureDishes: ['Buddha bowl', 'Vegan burger', 'Cauliflower tacos'],
  },
  {
    id: 'bbq',
    label: 'BBQ',
    group: 'food',
    osmTags: ['bbq', 'barbecue', 'grill'],
    keywords: ['bbq', 'barbecue', 'smokehouse'],
    signatureDishes: ['Brisket', 'Pulled pork', 'Burnt ends'],
  },
]

export type DietaryOption = {
  id: DietaryId
  label: string
  hint?: string
}

export const DIETARY_OPTIONS: DietaryOption[] = [
  { id: 'vegetarian', label: 'Vegetarian-friendly' },
  { id: 'vegan', label: 'Vegan-friendly' },
  { id: 'gluten_free', label: 'Gluten-free options' },
  { id: 'halal', label: 'Halal' },
  {
    id: 'grass_fed',
    label: 'Grass-fed / pasture-raised',
    hint: 'Boosts spots mentioning grass-fed, pasture, or regenerative sourcing',
  },
  {
    id: 'no_seed_oils',
    label: 'Avoid seed oils',
    hint: 'Uses Seed Oil Tracker grades when the place matches a known chain',
  },
]

export function cuisineById(id: CuisineId): CuisineOption {
  const found = CUISINES.find((c) => c.id === id)
  if (!found) throw new Error(`Unknown cuisine: ${id}`)
  return found
}

export function isKnownCuisineId(id: string): id is CuisineId {
  return CUISINES.some((c) => c.id === id)
}

export function isKnownDietaryId(id: string): id is DietaryId {
  return DIETARY_OPTIONS.some((d) => d.id === id)
}

/** Healthy is its own toggle and does not count toward the 3 food-type cap. */
export function normalizeCuisineSelection(ids: CuisineId[]): CuisineId[] {
  const healthy = ids.includes('healthy')
  const food = ids.filter((id) => id !== 'healthy').slice(0, 3)
  return healthy ? (['healthy', ...food] as CuisineId[]) : food
}
