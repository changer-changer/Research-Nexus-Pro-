/**
 * Generate a consistent, visually distinct color for any category string.
 * Uses HSL with golden-ratio offset to spread hues evenly.
 */
export function getCategoryColor(category: string): string {
  const str = category || 'Other'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const goldenRatio = 0.618033988749895
  const hue = (Math.abs(hash) * goldenRatio) % 1
  // Convert to 0-360, keep saturation and lightness in a pleasant range
  const h = Math.round(hue * 360)
  const s = 65 + (Math.abs(hash) % 20) // 65-85%
  const l = 50 + (Math.abs(hash >> 3) % 10) // 50-60%
  return `hsl(${h}, ${s}%, ${l}%)`
}

export function getCategoryBg(category: string): string {
  const str = category || 'Other'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const goldenRatio = 0.618033988749895
  const hue = (Math.abs(hash) * goldenRatio) % 1
  const h = Math.round(hue * 360)
  return `hsla(${h}, 70%, 55%, 0.12)`
}
