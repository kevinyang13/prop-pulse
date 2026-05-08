import type { Assumptions, Results, StressScenario } from '@/types/analysis'

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
    house_hack,
    house_hack_owner_pct,
    unit_rents,
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

  // Exact year 1 mortgage interest via amortization
  let annual_mortgage_interest = 0
  if (monthly_rate > 0) {
    let balance = loan_amount
    for (let m = 0; m < 12; m++) {
      const month_interest = balance * monthly_rate
      annual_mortgage_interest += month_interest
      balance -= (monthly_mortgage - month_interest)
    }
  }
  annual_mortgage_interest = Math.round(annual_mortgage_interest)

  // --- House hack: scale deductible portion ---
  const rental_pct =
    house_hack && house_hack_owner_pct != null
      ? (100 - house_hack_owner_pct) / 100
      : 1.0

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
  const cap_rate = purchase_price > 0 ? (noi / purchase_price) * 100 : 0
  const grm = monthly_rent > 0 ? purchase_price / (monthly_rent * 12) : 0

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

  // --- Schedule E tax (with house hack scaling) ---
  // Depreciation: rental portion only (27.5-yr straight-line, 80% building value)
  const annual_depreciation = Math.round(((purchase_price * 0.8) / 27.5) * rental_pct)

  // Schedule E deductions: all rental-use expenses
  // Property-level expenses (tax, insurance, HOA, maintenance, interest) scaled by rental_pct
  // PM is inherently rental-only (no scaling needed)
  const schedule_e_deductions_annual = Math.round(
    annual_mortgage_interest * rental_pct +
      (property_tax_monthly + insurance_monthly + hoa_monthly + maintenance_monthly) *
        12 *
        rental_pct +
      pm_monthly * 12
  )

  // Schedule E net: rental income − deductions − depreciation (negative = paper loss)
  const rental_income_annual = effective_gross_income * 12
  const schedule_e_net_income = Math.round(
    rental_income_annual - schedule_e_deductions_annual - annual_depreciation
  )

  // --- PAL rules ---
  const bracket = tax.tax_bracket ?? 0.22
  const agi = tax.w2_income ?? 0
  const pal_status: 'full' | 'phase_out' | 'suspended' =
    agi < 100000 ? 'full' : agi <= 150000 ? 'phase_out' : 'suspended'

  let tax_savings_annual: number
  if (schedule_e_net_income < 0) {
    const paper_loss = -schedule_e_net_income
    // $25k active-participation exception, phases out $1 per $2 of AGI over $100k
    const pal_allowance =
      pal_status === 'full'
        ? 25000
        : pal_status === 'phase_out'
        ? Math.max(0, 25000 - 0.5 * (agi - 100000))
        : 0
    const deductible_loss = Math.min(paper_loss, pal_allowance)
    tax_savings_annual = Math.round(deductible_loss * bracket)
  } else {
    // Rental profit → extra tax owed (show as negative savings)
    tax_savings_annual = -Math.round(schedule_e_net_income * bracket)
  }

  const tax_adjusted_coc =
    total_cash_invested > 0
      ? ((annual_cashflow + tax_savings_annual) / total_cash_invested) * 100
      : 0

  const verdict = deriveVerdict(cash_on_cash_return, monthly_cashflow, pal_status)

  // --- Multi-unit fields ---
  const unit_count = unit_rents?.length ?? 1
  const price_per_unit = unit_count > 1 ? Math.round(purchase_price / unit_count) : null
  // Expense ratio = total monthly expenses ÷ gross monthly rent
  const expense_ratio =
    unit_count > 1 && monthly_rent > 0
      ? Math.round((total_expenses_monthly / monthly_rent) * 1000) / 10
      : null
  let blended_vacancy: number | null = null
  if (unit_rents && unit_rents.length > 0) {
    const total_max = unit_rents.reduce((s, u) => s + u.monthly_rent, 0)
    const vacant_rent = unit_rents
      .filter(u => u.status === 'vacant')
      .reduce((s, u) => s + u.monthly_rent, 0)
    blended_vacancy = total_max > 0 ? Math.round((vacant_rent / total_max) * 1000) / 10 : 0
  }

  return {
    monthly_cashflow: Math.round(monthly_cashflow),
    annual_cashflow: Math.round(annual_cashflow),
    cash_on_cash_return: Math.round(cash_on_cash_return * 10) / 10,
    cap_rate: Math.round(cap_rate * 10) / 10,
    grm: Math.round(grm * 10) / 10,
    noi: Math.round(noi),
    break_even_occupancy: Math.round(break_even_occupancy * 10) / 10,
    total_cash_invested: Math.round(total_cash_invested),
    annual_depreciation,
    mortgage_interest_annual: annual_mortgage_interest,
    schedule_e_deductions_annual,
    schedule_e_net_income,
    tax_bracket_used: bracket,
    tax_savings_annual,
    tax_adjusted_coc: Math.round(tax_adjusted_coc * 10) / 10,
    passive_loss_status: pal_status,
    verdict,
    price_per_unit,
    expense_ratio,
    blended_vacancy,
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
  const unitCount = assumptions.unit_rents?.length ?? 1

  if (unitCount >= 2) {
    return computeMultiUnitStress(assumptions, tax, base, unitCount)
  }

  return [
    { label: 'Rent +10%', ...stress(assumptions, tax, { rent_mult: 1.1 }), outcome: 'positive' as const },
    { label: 'Base Case', cashflow: base.cashflow, coc: base.coc, outcome: 'base' as const },
    {
      label: 'Rent −10%',
      ...stress(assumptions, tax, { rent_mult: 0.9 }),
      outcome: stressOutcome(stress(assumptions, tax, { rent_mult: 0.9 }).cashflow),
    },
    {
      label: 'Vacancy 15%',
      ...stress(assumptions, tax, { vacancy: 15 }),
      outcome: stressOutcome(stress(assumptions, tax, { vacancy: 15 }).cashflow),
    },
    {
      label: 'Rate 8.0%',
      ...stress(assumptions, tax, { rate: 8.0 }),
      outcome: stressOutcome(stress(assumptions, tax, { rate: 8.0 }).cashflow),
    },
    {
      label: 'Rate 8% + Vacancy 15%',
      ...stress(assumptions, tax, { rate: 8.0, vacancy: 15 }),
      outcome: stressOutcome(stress(assumptions, tax, { rate: 8.0, vacancy: 15 }).cashflow),
    },
  ]
}

function computeMultiUnitStress(
  assumptions: Assumptions,
  tax: TaxProfile,
  base: { cashflow: number; coc: number },
  unitCount: number
): StressScenario[] {
  const oneUnitVacancy = 100 / unitCount
  const twoUnitVacancy = 200 / unitCount

  const fullyLeased = stress(assumptions, tax, { vacancy: 0 })
  const oneVacant = stress(assumptions, tax, { vacancy: oneUnitVacancy })
  const rate8 = stress(assumptions, tax, { rate: 8.0 })
  const twoVacant = stress(assumptions, tax, { vacancy: twoUnitVacancy })
  const rate8OneVacant = stress(assumptions, tax, { rate: 8.0, vacancy: oneUnitVacancy })

  return [
    { label: 'All Units at Market Rent', ...fullyLeased, outcome: stressOutcome(fullyLeased.cashflow) },
    { label: 'Base Case', cashflow: base.cashflow, coc: base.coc, outcome: 'base' as const },
    { label: '1 Unit Vacant', ...oneVacant, outcome: stressOutcome(oneVacant.cashflow) },
    { label: 'Rate 8.0%', ...rate8, outcome: stressOutcome(rate8.cashflow) },
    { label: '2 Units Vacant', ...twoVacant, outcome: stressOutcome(twoVacant.cashflow) },
    { label: 'Rate 8% + 1 Unit Vacant', ...rate8OneVacant, outcome: stressOutcome(rate8OneVacant.cashflow) },
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
