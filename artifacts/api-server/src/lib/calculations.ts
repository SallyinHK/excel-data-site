/**
 * Financial calculation engine: NPV, IRR, Payback Period, ROI
 */

export interface YearlyInputs {
  year: number;
  salesVolume: number;
  netPrice: number;
  cogs: number;
  opex: number;
  capex: number;
}

export interface CashFlow {
  year: number;
  revenue: number;
  grossProfit: number;
  ebitda: number;
  nopat: number;
  freeCashFlow: number;
  cumulativeCashFlow: number;
}

export interface CalculationResult {
  npv: number;
  irr: number | null;
  paybackPeriod: number | null;
  roiPercent: number | null;
  totalRevenue: number;
  totalCost: number;
  totalCogs: number;
  totalCapex: number;
  cashFlows: CashFlow[];
}

/**
 * Calculate NPV using standard DCF formula
 * NPV = sum(cashFlow_t / (1 + r)^t) - initialInvestment
 */
function calculateNPV(cashFlows: number[], discountRate: number): number {
  return cashFlows.reduce((npv, cf, t) => {
    return npv + cf / Math.pow(1 + discountRate, t);
  }, 0);
}

/**
 * Calculate IRR using bisection/Newton's method
 * IRR is the discount rate at which NPV = 0
 */
function calculateIRR(cashFlows: number[]): number | null {
  // Need at least one negative cash flow (investment) and one positive
  const hasNegative = cashFlows.some((cf) => cf < 0);
  const hasPositive = cashFlows.some((cf) => cf > 0);
  if (!hasNegative || !hasPositive) return null;

  // Newton-Raphson method
  let rate = 0.1;
  const maxIterations = 100;
  const tolerance = 1e-7;

  for (let i = 0; i < maxIterations; i++) {
    const npv = cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
    const dnpv = cashFlows.reduce(
      (sum, cf, t) => sum - (t * cf) / Math.pow(1 + rate, t + 1),
      0
    );

    if (Math.abs(dnpv) < tolerance) break;

    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }
    rate = newRate;

    // Keep rate in reasonable bounds
    if (rate < -0.99) rate = -0.99;
    if (rate > 10) rate = 10;
  }

  // Fallback: bisection
  let lo = -0.99;
  let hi = 10.0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + mid, t), 0);
    const npvLo = cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + lo, t), 0);
    if (Math.abs(npvMid) < tolerance) return mid;
    if (npvMid * npvLo < 0) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return (lo + hi) / 2;
}

/**
 * Calculate payback period (years to recover initial investment)
 */
function calculatePaybackPeriod(cashFlows: CashFlow[]): number | null {
  for (let i = 0; i < cashFlows.length; i++) {
    if (cashFlows[i].cumulativeCashFlow >= 0) {
      if (i === 0) return 0;
      const prev = cashFlows[i - 1].cumulativeCashFlow;
      const curr = cashFlows[i].cumulativeCashFlow;
      // Interpolate
      return (i - 1) + (-prev) / (curr - prev);
    }
  }
  return null; // Never pays back within project lifecycle
}

/**
 * Main calculation function
 */
export function calculateROI(
  inputs: YearlyInputs[],
  wacc: number,
  taxRate: number
): CalculationResult {
  if (!inputs.length) {
    return {
      npv: 0,
      irr: null,
      paybackPeriod: null,
      roiPercent: null,
      totalRevenue: 0,
      totalCost: 0,
      totalCogs: 0,
      totalCapex: 0,
      cashFlows: [],
    };
  }

  // Sort inputs by year
  const sorted = [...inputs].sort((a, b) => a.year - b.year);

  let totalCapex = 0;
  let cumulativeCashFlow = 0;
  const cashFlows: CashFlow[] = [];

  for (const input of sorted) {
    const revenue = input.salesVolume * input.netPrice;
    const grossProfit = revenue - input.cogs;
    const ebitda = grossProfit - input.opex;
    // Tax on positive EBITDA
    const tax = ebitda > 0 ? ebitda * taxRate : 0;
    const nopat = ebitda - tax;
    // Free Cash Flow = NOPAT - CAPEX
    const freeCashFlow = nopat - input.capex;
    totalCapex += input.capex;
    cumulativeCashFlow += freeCashFlow;

    cashFlows.push({
      year: input.year,
      revenue,
      grossProfit,
      ebitda,
      nopat,
      freeCashFlow,
      cumulativeCashFlow,
    });
  }

  const totalRevenue = cashFlows.reduce((s, cf) => s + cf.revenue, 0);
  const totalCogs = sorted.reduce((s, i) => s + i.cogs, 0);
  const totalCost = sorted.reduce((s, i) => s + i.cogs + i.opex, 0);

  // DCF cash flows array (t=0 is year 0 if first year is 0, otherwise treat first year as t=1)
  const dcfCashFlows = cashFlows.map((cf) => cf.freeCashFlow);

  const npv = calculateNPV(dcfCashFlows, wacc);
  const irr = calculateIRR(dcfCashFlows);
  const paybackPeriod = calculatePaybackPeriod(cashFlows);

  // ROI % = (Total FCF / Total CAPEX) * 100
  const totalFCF = dcfCashFlows.reduce((s, cf) => s + cf, 0);
  const roiPercent = totalCapex > 0 ? (totalFCF / totalCapex) * 100 : null;

  return {
    npv,
    irr,
    paybackPeriod,
    roiPercent,
    totalRevenue,
    totalCost,
    totalCogs,
    totalCapex,
    cashFlows,
  };
}
