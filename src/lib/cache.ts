import { createClient } from '@/lib/supabase/server'

export async function fetchWithCache<T>(
  cacheKey: string,
  ttlDays: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const supabase = await createClient()

  // 1. Check cache
  const { data: cached } = await supabase
    .from('data_cache')
    .select('payload')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single() as { data: { payload: unknown } | null, error: unknown }

  if (cached) return cached.payload as T

  // 2. Fetch from external API
  const payload = await fetcher()

  // 3. Store in cache
  await supabase.from('data_cache').upsert({
    cache_key: cacheKey,
    source: cacheKey.split(':')[0],
    payload,
    fetched_at: new Date().toISOString(),
    ttl_days: ttlDays,
  })

  return payload
}
