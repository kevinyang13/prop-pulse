import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Called weekly by Vercel cron (vercel.json) or manually.
// No FRED API key needed — public CSV endpoint.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const res = await fetch(
    'https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US',
    { next: { revalidate: 0 } }
  )
  if (!res.ok) {
    return NextResponse.json({ error: 'fred_fetch_failed' }, { status: 502 })
  }

  const text = await res.text()
  const lines = text.trim().split('\n').filter(l => !l.startsWith('DATE'))
  const last = lines[lines.length - 1]?.split(',')
  if (!last || last.length < 2) {
    return NextResponse.json({ error: 'parse_failed' }, { status: 500 })
  }

  const effective_date = last[0].trim()
  const rate = parseFloat(last[1].trim())
  if (isNaN(rate)) {
    return NextResponse.json({ error: 'invalid_rate' }, { status: 500 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('mortgage_rates')
    .upsert({ rate_30yr_fixed: rate, effective_date }, { onConflict: 'effective_date' })

  if (error) {
    console.error('mortgage_rates upsert failed:', error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ effective_date, rate_30yr_fixed: rate })
}
