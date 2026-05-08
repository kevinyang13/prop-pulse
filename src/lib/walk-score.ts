// Walk Score API — https://www.walkscore.com/professional/api.php
// Terms: must display "Walk Score" attribution + powered-by logo in UI

export interface WalkScoreData {
  walk_score: number | null
  walk_score_label: string | null
  transit_score: number | null
  transit_score_label: string | null
  bike_score: number | null
}

export async function fetchWalkScore(
  address: string,
  lat: number,
  lng: number
): Promise<WalkScoreData> {
  const key = process.env.WALKSCORE_API_KEY
  if (!key) return nullWalkScore()

  const url = `https://api.walkscore.com/score?format=json&address=${encodeURIComponent(address)}&lat=${lat}&lon=${lng}&transit=1&bike=1&wsapikey=${key}`

  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) return nullWalkScore()

  const data = await res.json()
  if (data.status !== 1) return nullWalkScore()

  return {
    walk_score: data.walkscore ?? null,
    walk_score_label: data.description ?? null,
    transit_score: data.transit?.score ?? null,
    transit_score_label: data.transit?.description ?? null,
    bike_score: data.bike?.score ?? null,
  }
}

function nullWalkScore(): WalkScoreData {
  return { walk_score: null, walk_score_label: null, transit_score: null, transit_score_label: null, bike_score: null }
}
