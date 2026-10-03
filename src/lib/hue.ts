/**
 * Deterministic hue (0-359) derived from a string — used to give every
 * category its own stable neon colour (cards, 3D holograms, covers) without
 * storing any extra data or inventing imagery.
 */
export function hueFor(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}
