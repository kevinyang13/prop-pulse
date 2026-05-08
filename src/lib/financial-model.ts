import type { Assumptions, Results, StressScenario } from '@/types/analysis'

// Pure function — no I/O. Takes assumptions + user tax profile, returns results.

interface TaxProfile {
  w2_income: number | null
  tax_bracket: number | null        // e.g. 0.22
  filing_status: string | null
  state_tax_rate: number | null
}

function computeCore(
  assumptions: Assumptions,
  tax: TaxProfile
): Omit<Results, 'stress_scenarios'> {
  const {
    purchase_price,
    down_payment_pct,
    interest_rate,
    loan_term_years,
    monthly_rent,
    vacancy_pct,
    property_tax_monthly,
    insurance_monthly,
    hoa_monthly,
    maintenance_pct_annual,
    property_mgmt_pct,
    closing_cost_pct,
  } = assumptions

  // --- Loan ---
  const down_payment = purchase_price * (down_payment_pct / 100)
  const loan_amount = purchase_price - down_payment
  const monthly_rate = interest_rate / 100 / 12
  const n = loan_term_years * 12
  const monthly_mortgage =
    monthly_rate === 0
      ? loan_amount / n
      : (loan_amount * (monthly_rate * Math.pow(1 + monthly_rate, n))) /
        (Math.pow(1 + monthly_rate, n) - 1)

  // --- Income ---
  const effective_gross_income = monthly_rent * (1 - vacancy_pct / 100)

  // --- Expenses ---
  const maintenance_monthly = (purchase_price * (maintenance_pct_annual / 100)) / 12
  const pm_monthly = monthly_rent * (property_mgmt_pct / 100)
  const total_expenses_monthly =
    monthly_mortgage +
    property_tax_monthly +
    insurance_monthly +
    hoa_monthly +
    maintenance_monthly +
    pm_monthly

  // --- Cashflow ---
  const monthly_cashflow = effective_gross_income - total_expenses_monthly
  const annual_cashflow = monthly_cashflow * 12

  // --- Investment ---
  const closing_costs = purchase_price * (closing_cost_pct / 100)
  const total_cash_invested = down_payment + closing_costs

  // --- Returns ---
  const cash_on_cash_return =
    total_cash_invested > 0 ? (annual_cashflow / total_cash_invested) * 100 : 0

  // --- NOI (ex-mortgage) ---
  const annual_operating_expenses =
    (property_tax_monthly +
      insurance_monthly +
      hoa_monthly +
      maintenance_monthly +
      pm_monthly) *
    12
  const noi = effective_gross_income * 12 - annual_operating_expenses
  const cap_rate = (noi / purchase_price) * 100
  const grm = purchase_price / (monthly_rent * 12)

  // --- Break-even ---
  const fixed_monthly =
    monthly_mortgage +
    property_tax_monthly +
    insurance_monthly +
    hoa_monthly +
    maintenance_monthly +
    pm_monthly
  const break_even_occupancy =
    monthly_rent > 0 ? (fixed_monthly / monthly_rent) * 100 : 100

  // --- Tax (Sprint 2 — placeholder values for Sprint 1) ---
  const annual_depreciation = (purchase_price * 0.8) / 27.5
  const bracket = tax.tax_bracket ?? 0.22
  const agi = tax.w2_income ?? 0
  const pal_status: 'full' | 'phase_out' | 'suspended' =
    agi < 100000 ? 'full' : agi <= 150000 ? 'phase_out' : 'suspended'

  const deductible_depreciation =
    pal_status === 'full'
      ? annual_depreciation
      : pal_status === 'phase_out'
      ? annual_depreciation * ((150000 - agi) / 50000)
      : 0

  const tax_savings_annual = deductible_depreciation * bracket
  const tax_adjusted_coc =
    total_cash_invested > 0
      ? ((annual_cashflow + tax_savings_annual) / total_cash_invested) * 100
      : 0

  const verdict = deriveVerdict(cash_on_cash_return, monthly_cashflow, pal_status)

  return {
    monthly_cashflow: Math.round(monthly_cashflow),
    annual_cashflow: Math.round(annual_cashflow),
    cash_on_cash_return: Math.round(cash_on_cash_return * 10) / 10,
    cap_rate: Math.round(cap_rate * 10) / 10,
    grm: Math.round(grm * 10) / 10,
    noi: Math.round(noi),
    break_even_occupancy: Math.round(break_even_occupancy * 10) / 10,
    total_cash_invested: Math.round(total_cash_invested),
    annual_depreciation: Math.round(annual_depreciation),
    tax_savings_annual: Math.round(tax_savings_annual),
    tax_adjusted_coc: Math.round(tax_adjusted_coc * 10) / 10,
    passive_loss_status: pal_status,
    verdict,
    price_per_unit: null,
    expense_ratio: null,
    blended_vacancy: null,
  }
}

export function computeFinancials(
  assumptions: Assumptions,
  tax: TaxProfile
): Results {
  const core = computeCore(assumptions, tax)
  const stress_scenarios = computeStress(assumptions, tax)
  return { ...core, stress_scenarios }
}

function computeStress(assumptions: Assumptions, tax: TaxProfile): StressScenario[] {
  const base = computeBaseForStress(assumptions, tax)
  return [
    { label: 'Rent +10%', ...stress(assumptions, tax, { rent_mult: 1.1 }), outcome: 'positive' as const },
    { label: 'Base Case', cashflow: base.cashflow, coc: base.coc, outcome: 'base' as const },
    { label: 'Rent -10%', ...stress(assumptions, tax, { rent_mult: 0.9 }), outcome: stressOutcome(stress(assumptions, tax, { rent_mult: 0.9 }).cashflow) },
    { label: 'Vacancy 15%', ...stress(assumptions, tax, { vacancy: 15 }), outcome: stressOutcome(stress(assumptions, tax, { vacancy: 15 }).cashflow) },
    { label: 'Rate 8.0%', ...stress(assumptions, tax, { rate: 8.0 }), outcome: stressOutcome(stress(assumptions, tax, { rate: 8.0 }).cashflow) },
    { label: 'Rate 8% + Vacancy 15%', ...stress(assumptions, tax, { rate: 8.0, vacancy: 15 }), outcome: stressOutcome(stress(assumptions, tax, { rate: 8.0, vacancy: 15 }).cashflow) },
  ]
}

function stress(
  a: Assumptions,
  tax: TaxProfile,
  overrides: { rent_mult?: number; vacancy?: number; rate?: number }
) {
  const modified: Assumptions = {
    ...a,
    monthly_rent: Math.round(a.monthly_rent * (overrides.rent_mult ?? 1)),
    vacancy_pct: overrides.vacancy ?? a.vacancy_pct,
    interest_rate: overrides.rate ?? a.interest_rate,
  }
  const r = computeCore(modified, tax)
  return { cashflow: r.monthly_cashflow, coc: r.cash_on_cash_return }
}

function computeBaseForStress(a: Assumptions, tax: TaxProfile) {
  const r = computeCore(a, tax)
  return { cashflow: r.monthly_cashflow, coc: r.cash_on_cash_return }
}

function stressOutcome(cashflow: number): 'positive' | 'marginal' | 'negative' {
  if (cashflow > 100) return 'positive'
  if (cashflow >= 0) return 'marginal'
  return 'negative'
}

function deriveVerdict(
  coc: number,
  cashflow: number,
  pal: 'full' | 'phase_out' | 'suspended'
): 'GO' | 'CAUTION' | 'PASS' {
  if (cashflow < 0) return 'PASS'
  if (coc >= 6 || (pal !== 'suspended' && coc >= 4)) return 'GO'
  if (coc >= 3) return 'CAUTION'
  return 'PASS'
}
