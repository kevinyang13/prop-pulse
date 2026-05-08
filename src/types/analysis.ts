export interface Assumptions {
  purchase_price: number
  down_payment_pct: number
  interest_rate: number
  loan_term_years: number
  monthly_rent: number
  vacancy_pct: number
  property_tax_monthly: number
  insurance_monthly: number
  hoa_monthly: number
  maintenance_pct_annual: number
  property_mgmt_pct: number
  closing_cost_pct: number
  house_hack: boolean
  house_hack_owner_pct: number | null
  unit_rents: UnitRent[] | null
}

export interface UnitRent {
  unit: string
  monthly_rent: number
  status: 'occupied' | 'vacant'
}

export interface StressScenario {
  label: string
  cashflow: number
  coc: number
  outcome: 'positive' | 'marginal' | 'negative' | 'base'
}

export interface Results {
  monthly_cashflow: number
  annual_cashflow: number
  cash_on_cash_return: number
  cap_rate: number
  grm: number
  noi: number
  break_even_occupancy: number
  total_cash_invested: number
  annual_depreciation: number
  tax_savings_annual: number
  tax_adjusted_coc: number
  passive_loss_status: 'full' | 'phase_out' | 'suspended'
  stress_scenarios: StressScenario[]
  verdict: 'GO' | 'CAUTION' | 'PASS'
  // MFU only
  price_per_unit: number | null
  expense_ratio: number | null
  blended_vacancy: number | null
}

export interface SavedAnalysis {
  id: string
  user_id: string
  property_id: string
  scenario_name: string
  verdict: 'GO' | 'CAUTION' | 'PASS'
  verdict_reason: string | null
  assumptions: Assumptions
  results: Results
  notes: string | null
  is_starred: boolean
  created_at: string
  updated_at: string
}
