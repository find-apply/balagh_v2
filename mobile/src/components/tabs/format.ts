/** A video's length: 42 ث under a minute, 1:24 above. */
export function duration(seconds: number): string {
  const s = Math.round(seconds)
  return s < 60 ? `${s} ث` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
