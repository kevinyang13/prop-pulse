import type { Assumptions } from '@/types/analysis'

export function autoScenarioName(a: Assumptions): string {
  const parts = [
    `${a.down_payment_pct}% down`,
    `${a.interest_rate}%`,
    `$${a.monthly_rent.toLocaleString()}/mo`,
  ]
  if (a.house_hack) parts.unshift('House Hack')
  return parts.join(' · ')
  // → "20% down · 6.87% · $2,100/mo"
  // → "House Hack · 20% down · 6.87% · $2,100/mo"
}
