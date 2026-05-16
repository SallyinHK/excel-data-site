import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  DollarSign, TrendingUp, Clock, Activity, CheckCircle, XCircle,
  AlertTriangle, Zap, Building2, Layers, ShieldCheck, BarChart2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface YearRow { year: number; salesVolume: number; netPrice: number; cogs: number; opex: number; capex: number }

interface Setup {
  projectName: string;
  projectType: string;
  region: string;
  lifecycleYears: number;
}

interface Assumptions {
  discountRate: number;
  taxRate: number;
  targetCmPct: number;
}

// ─── Client-side Calculation Engine ──────────────────────────────────────────

function calcNPV(cashFlows: number[], rate: number): number {
  return cashFlows.reduce((npv, cf, t) => npv + cf / Math.pow(1 + rate, t + 1), 0);
}

function calcIRR(cashFlows: number[]): number | null {
  const allCF = cashFlows;
  if (!allCF.some((cf) => cf < 0) || !allCF.some((cf) => cf > 0)) return null;

  let rate = 0.1;
  for (let i = 0; i < 150; i++) {
    const npv = allCF.reduce((s, cf, t) => s + cf / Math.pow(1 + rate, t + 1), 0);
    const dnpv = allCF.reduce((s, cf, t) => s - ((t + 1) * cf) / Math.pow(1 + rate, t + 2), 0);
    if (Math.abs(dnpv) < 1e-10) break;
    const nr = rate - npv / dnpv;
    if (Math.abs(nr - rate) < 1e-8) return nr;
    rate = Math.max(-0.99, Math.min(10, nr));
  }

  let lo = -0.99, hi = 10;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = allCF.reduce((s, cf, t) => s + cf / Math.pow(1 + mid, t + 1), 0);
    const npvLo = allCF.reduce((s, cf, t) => s + cf / Math.pow(1 + lo, t + 1), 0);
    if (Math.abs(npvMid) < 1e-8) return mid;
    if (npvMid * npvLo < 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

function runCalc(rows: YearRow[], a: Assumptions) {
  const { discountRate, taxRate } = a;
  let cumulative = 0;
  const pl = rows.map((r) => {
    const revenue = r.salesVolume * r.netPrice;
    const grossProfit = revenue - r.cogs;
    const cmPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const ebitda = grossProfit - r.opex;
    const tax = ebitda > 0 ? ebitda * (taxRate / 100) : 0;
    const nopat = ebitda - tax;
    const fcf = nopat - r.capex;
    cumulative += fcf;
    return { year: r.year, revenue, grossProfit, cmPct, ebitda, nopat, fcf, cumulative };
  });

  const fcfArr = pl.map((r) => r.fcf);
  const npv = calcNPV(fcfArr, discountRate / 100);
  const irr = calcIRR(fcfArr);

  let payback: number | null = null;
  for (let i = 0; i < pl.length; i++) {
    if (pl[i].cumulative >= 0) {
      if (i === 0) { payback = 0; break; }
      const prev = pl[i - 1].cumulative;
      const curr = pl[i].cumulative;
      payback = (i - 1) + (-prev) / (curr - prev);
      break;
    }
  }

  const totalRevenue = pl.reduce((s, r) => s + r.revenue, 0);
  const totalCapex = rows.reduce((s, r) => s + r.capex, 0);
  const totalFCF = fcfArr.reduce((s, v) => s + v, 0);
  const roiPercent = totalCapex > 0 ? (totalFCF / totalCapex) * 100 : null;
  const pi = totalCapex > 0 ? (npv + totalCapex) / totalCapex : null;

  return { pl, npv, irr, payback, totalRevenue, totalCapex, roiPercent, pi };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (v: number | null | undefined) => v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const fmtM = (v: number | null | undefined) => { if (v == null) return "—"; const m = v / 1e6; return `${m >= 0 ? "" : "-"}$${Math.abs(m).toFixed(2)}M`; };
const fmtPct = (v: number | null | undefined, dec = 2) => v == null ? "—" : `${(v * 100).toFixed(dec)}%`;
const fmtK = (v: number | null | undefined) => { if (v == null) return "—"; if (Math.abs(v) >= 1e6) return fmtM(v); return fmt(v); };
const fmtPeriod = (v: number | null | undefined) => { if (v == null) return "—"; const y = Math.floor(v); const m = Math.round((v - y) * 12); return m > 0 ? `${y}y ${m}m` : `${y}y`; };

// ─── KPI Bar ─────────────────────────────────────────────────────────────────

function KpiBar({ calc }: { calc: ReturnType<typeof runCalc> }) {
  const kpis = [
    { label: "NPV", value: fmtM(calc.npv), pos: calc.npv >= 0, sub: "Net Present Value" },
    { label: "IRR", value: fmtPct(calc.irr), pos: (calc.irr ?? 0) >= 0, sub: "Internal Rate of Return" },
    { label: "Payback", value: fmtPeriod(calc.payback), pos: true, sub: "Recovery Period" },
    { label: "ROI", value: calc.roiPercent != null ? `${calc.roiPercent.toFixed(1)}%` : "—", pos: (calc.roiPercent ?? 0) >= 0, sub: "Return on Investment" },
    { label: "PI", value: calc.pi != null ? calc.pi.toFixed(2) : "—", pos: (calc.pi ?? 0) >= 1, sub: "Profitability Index" },
  ];

  return (
    <div className="grid grid-cols-5 gap-0 rounded-xl border overflow-hidden bg-card shadow-sm">
      {kpis.map(({ label, value, pos, sub }, i) => (
        <div
          key={label}
          className={`px-4 py-3 flex flex-col gap-0.5 ${i < kpis.length - 1 ? "border-r" : ""}`}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
          <span className={`text-xl font-bold font-mono leading-tight ${value === "—" ? "text-muted-foreground" : pos ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
            {value}
          </span>
          <span className="text-[10px] text-muted-foreground">{sub}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Numeric Input Cell ───────────────────────────────────────────────────────

function NumCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      type="number"
      className="h-7 text-xs font-mono text-right border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-primary/50 px-1"
      value={value === 0 ? "" : value}
      placeholder="0"
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SLabel({ num, label, icon: Icon }: { num: string; label: string; icon?: any }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">{num}</span>
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Default state ────────────────────────────────────────────────────────────

const DEFAULT_SETUP: Setup = { projectName: "New Simulation", projectType: "New", region: "APAC", lifecycleYears: 5 };
const DEFAULT_ASSUMPTIONS: Assumptions = { discountRate: 8.5, taxRate: 25, targetCmPct: 30 };

function makeRows(n: number): YearRow[] {
  return Array.from({ length: n }, (_, i) => ({ year: i + 1, salesVolume: 0, netPrice: 0, cogs: 0, opex: 0, capex: 0 }));
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Simulator() {
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [rows, setRows] = useState<YearRow[]>(makeRows(5));
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [outputTab, setOutputTab] = useState<"pl" | "cashflow" | "risk">("pl");

  const calc = useMemo(() => runCalc(rows, assumptions), [rows, assumptions]);

  const setRow = (year: number, field: keyof YearRow, value: number) => {
    setRows((prev) => prev.map((r) => r.year === year ? { ...r, [field]: value } : r));
  };

  const setLifecycle = (n: number) => {
    setSetup((s) => ({ ...s, lifecycleYears: n }));
    setRows((prev) => {
      if (n > prev.length) {
        const extra = Array.from({ length: n - prev.length }, (_, i) => ({ year: prev.length + i + 1, salesVolume: 0, netPrice: 0, cogs: 0, opex: 0, capex: 0 }));
        return [...prev, ...extra];
      }
      return prev.slice(0, n);
    });
  };

  const years = rows.map((r) => r.year);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            ROI Simulator
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time calculation — results update as you type</p>
        </div>
        <Badge variant="outline" className="text-[10px] px-2 py-1 font-mono uppercase tracking-widest">Live</Badge>
      </div>

      {/* Live KPI Bar */}
      <KpiBar calc={calc} />

      {/* Input + Output grid */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* Inputs (3/5 wide) */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-0 px-4 pt-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Inputs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="setup">
              <div className="px-4 pt-3 border-b">
                <TabsList className="h-8">
                  <TabsTrigger value="setup" className="text-xs gap-1"><Building2 className="w-3 h-3" /> ① Setup</TabsTrigger>
                  <TabsTrigger value="revenue" className="text-xs gap-1"><TrendingUp className="w-3 h-3" /> ② Revenue</TabsTrigger>
                  <TabsTrigger value="costs" className="text-xs gap-1"><Layers className="w-3 h-3" /> ③ Costs</TabsTrigger>
                  <TabsTrigger value="assumptions" className="text-xs gap-1"><ShieldCheck className="w-3 h-3" /> ④ Assumptions</TabsTrigger>
                </TabsList>
              </div>

              {/* ① Setup */}
              <TabsContent value="setup" className="p-4 m-0 space-y-4">
                <SLabel num="1" label="Project Setup" icon={Building2} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-muted-foreground">Project Name</Label>
                    <Input className="h-8 text-sm" value={setup.projectName} onChange={(e) => setSetup((s) => ({ ...s, projectName: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Project Type</Label>
                    <Select value={setup.projectType} onValueChange={(v) => setSetup((s) => ({ ...s, projectType: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Replacement">Replacement</SelectItem>
                        <SelectItem value="CR">CR / Enhancement</SelectItem>
                        <SelectItem value="Expansion">Expansion</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Region</Label>
                    <Select value={setup.region} onValueChange={(v) => setSetup((s) => ({ ...s, region: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["US", "EMEA", "APAC", "China", "Japan", "Brazil", "India", "Russia", "Central America", "RoSA"].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Product Lifecycle</Label>
                      <span className="text-sm font-bold font-mono text-primary">{setup.lifecycleYears} Years</span>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          onClick={() => setLifecycle(n)}
                          className={`flex-1 h-7 rounded text-xs font-bold transition-colors border ${
                            setup.lifecycleYears === n
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-accent text-muted-foreground"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Controls the number of forecast years in revenue, cost and cash flow models.</p>
                  </div>
                </div>
              </TabsContent>

              {/* ② Revenue */}
              <TabsContent value="revenue" className="p-4 m-0">
                <SLabel num="2" label="Revenue Inputs" icon={TrendingUp} />
                <p className="text-[10px] text-muted-foreground mb-3">Enter unit sales volume and net selling price per year. Revenue = Volume × Price.</p>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-36 text-[11px]">Field</TableHead>
                        {years.map((y) => <TableHead key={y} className="text-center text-[11px] w-24">Year {y}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-xs font-medium text-muted-foreground py-1">Unit Sales (qty)</TableCell>
                        {rows.map((r) => <TableCell key={r.year} className="p-0.5"><NumCell value={r.salesVolume} onChange={(v) => setRow(r.year, "salesVolume", v)} /></TableCell>)}
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs font-medium text-muted-foreground py-1">Net Price ($/unit)</TableCell>
                        {rows.map((r) => <TableCell key={r.year} className="p-0.5"><NumCell value={r.netPrice} onChange={(v) => setRow(r.year, "netPrice", v)} /></TableCell>)}
                      </TableRow>
                      <TableRow className="bg-primary/5">
                        <TableCell className="text-xs font-semibold text-primary py-1.5">→ Revenue</TableCell>
                        {rows.map((r) => (
                          <TableCell key={r.year} className="text-center text-xs font-mono font-semibold text-primary py-1.5">
                            {fmtK(r.salesVolume * r.netPrice)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* ③ Costs */}
              <TabsContent value="costs" className="p-4 m-0">
                <SLabel num="3" label="Cost Inputs" icon={Layers} />
                <p className="text-[10px] text-muted-foreground mb-3">Variable costs and capital investment per year. COGS drives Gross Profit; CapEx drives FCF.</p>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-36 text-[11px]">Field</TableHead>
                        {years.map((y) => <TableHead key={y} className="text-center text-[11px] w-24">Year {y}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={years.length + 1} className="py-1 px-3 bg-muted/20">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Variable Costs</span>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs font-medium text-muted-foreground py-1">COGS ($)</TableCell>
                        {rows.map((r) => <TableCell key={r.year} className="p-0.5"><NumCell value={r.cogs} onChange={(v) => setRow(r.year, "cogs", v)} /></TableCell>)}
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs font-medium text-muted-foreground py-1">OpEx ($)</TableCell>
                        {rows.map((r) => <TableCell key={r.year} className="p-0.5"><NumCell value={r.opex} onChange={(v) => setRow(r.year, "opex", v)} /></TableCell>)}
                      </TableRow>
                      <TableRow className="bg-muted/10">
                        <TableCell className="text-xs font-semibold py-1.5">→ Gross Profit</TableCell>
                        {rows.map((r) => {
                          const gp = r.salesVolume * r.netPrice - r.cogs;
                          return (
                            <TableCell key={r.year} className={`text-center text-xs font-mono font-semibold py-1.5 ${gp < 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                              {fmtK(gp)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={years.length + 1} className="py-1 px-3 bg-muted/20">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Capital Investment</span>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs font-medium text-muted-foreground py-1">CapEx ($)</TableCell>
                        {rows.map((r) => <TableCell key={r.year} className="p-0.5"><NumCell value={r.capex} onChange={(v) => setRow(r.year, "capex", v)} /></TableCell>)}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* ④ Assumptions */}
              <TabsContent value="assumptions" className="p-4 m-0 space-y-5">
                <SLabel num="4" label="Financial Assumptions" icon={ShieldCheck} />
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      label: "Discount Rate (WACC)",
                      key: "discountRate" as keyof Assumptions,
                      suffix: "%",
                      desc: "Used for NPV discounting. Reflects your cost of capital.",
                    },
                    {
                      label: "Income Tax Rate",
                      key: "taxRate" as keyof Assumptions,
                      suffix: "%",
                      desc: "Applied on positive EBITDA to compute NOPAT.",
                    },
                    {
                      label: "CM% Target",
                      key: "targetCmPct" as keyof Assumptions,
                      suffix: "%",
                      desc: "Minimum acceptable contribution margin. Triggers risk flag when breached.",
                    },
                  ].map(({ label, key, suffix, desc }) => (
                    <div key={key} className="col-span-2 sm:col-span-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          className="h-8 text-sm font-mono pr-7"
                          value={assumptions[key]}
                          onChange={(e) => setAssumptions((a) => ({ ...a, [key]: parseFloat(e.target.value) || 0 }))}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                  ))}
                </div>

                {/* FX / Working Capital placeholders */}
                <div className="rounded-md border border-dashed p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Coming soon</p>
                  <div className="grid grid-cols-3 gap-2">
                    {["FX Rate (vs USD)", "AR Days", "Inventory Turns"].map((l) => (
                      <div key={l} className="rounded bg-muted/40 p-2">
                        <div className="text-[10px] text-muted-foreground mb-1">{l}</div>
                        <Input className="h-6 text-xs font-mono" disabled placeholder="—" />
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Output Panel (2/5 wide) */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="pb-0 px-4 pt-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live Output</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <Tabs value={outputTab} onValueChange={(v) => setOutputTab(v as any)}>
              <div className="px-4 pt-3 border-b">
                <TabsList className="h-8">
                  <TabsTrigger value="pl" className="text-xs gap-1"><BarChart2 className="w-3 h-3" /> P&amp;L</TabsTrigger>
                  <TabsTrigger value="cashflow" className="text-xs gap-1"><Activity className="w-3 h-3" /> Cash Flow</TabsTrigger>
                  <TabsTrigger value="risk" className="text-xs gap-1"><ShieldCheck className="w-3 h-3" /> Risk</TabsTrigger>
                </TabsList>
              </div>

              {/* P&L */}
              <TabsContent value="pl" className="m-0 p-3">
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] w-28">Line Item</TableHead>
                        {years.map((y) => <TableHead key={y} className="text-right text-[10px]">Y{y}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: "Revenue", key: "revenue" as const, highlight: false, bold: false },
                        { label: "Gross Profit", key: "grossProfit" as const, highlight: false, bold: true },
                        { label: "EBITDA", key: "ebitda" as const, highlight: false, bold: true },
                        { label: "NOPAT", key: "nopat" as const, highlight: false, bold: true },
                        { label: "FCF", key: "fcf" as const, highlight: true, bold: true },
                      ].map(({ label, key, highlight, bold }) => (
                        <TableRow key={label} className={highlight ? "bg-primary/5" : ""}>
                          <TableCell className={`text-[11px] py-1.5 ${bold ? "font-semibold" : "text-muted-foreground"} ${highlight ? "text-primary" : ""}`}>
                            {label}
                          </TableCell>
                          {calc.pl.map((r) => {
                            const v = r[key];
                            return (
                              <TableCell key={r.year} className={`text-right text-[11px] font-mono py-1.5 ${v < 0 ? "text-red-500" : ""} ${highlight ? "text-primary font-semibold" : ""}`}>
                                {fmtK(v)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                      {/* CM% row with flag */}
                      <TableRow>
                        <TableCell className="text-[11px] py-1.5 text-muted-foreground">CM%</TableCell>
                        {calc.pl.map((r) => {
                          const below = r.cmPct < assumptions.targetCmPct && r.revenue > 0;
                          return (
                            <TableCell key={r.year} className={`text-right text-[11px] font-mono py-1.5 ${below ? "text-amber-600 font-semibold" : ""}`}>
                              {r.revenue > 0 ? `${r.cmPct.toFixed(1)}%` : "—"}
                              {below && <span className="ml-1 text-[9px] text-amber-500">⚠</span>}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">⚠ flag = CM% below {assumptions.targetCmPct}% target</p>
              </TabsContent>

              {/* Cash Flow */}
              <TabsContent value="cashflow" className="m-0 p-3 space-y-3">
                <div className="h-[160px]">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Annual Free Cash Flow</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={calc.pl} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" fontSize={10} tickFormatter={(v) => `Y${v}`} stroke="hsl(var(--muted-foreground))" />
                      <YAxis fontSize={10} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} stroke="hsl(var(--muted-foreground))" />
                      <RechartsTooltip formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Year ${l}`} />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      <Bar dataKey="fcf" name="FCF" radius={[3, 3, 0, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-[160px]">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Cumulative Cash Flow</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={calc.pl} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" fontSize={10} tickFormatter={(v) => `Y${v}`} stroke="hsl(var(--muted-foreground))" />
                      <YAxis fontSize={10} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} stroke="hsl(var(--muted-foreground))" />
                      <RechartsTooltip formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Year ${l}`} />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="cumulative" name="Cumulative FCF" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* Risk */}
              <TabsContent value="risk" className="m-0 p-3 space-y-2">
                {[
                  {
                    label: "NPV Positive",
                    ok: calc.npv >= 0,
                    desc: `NPV = ${fmtM(calc.npv)}`,
                    detail: calc.npv >= 0 ? "Project adds economic value at current WACC." : "Negative NPV. Consider raising prices or cutting CapEx.",
                  },
                  {
                    label: "IRR > Hurdle (8%)",
                    ok: calc.irr != null && calc.irr > 0.08,
                    warn: calc.irr != null && calc.irr > 0 && calc.irr <= 0.08,
                    desc: calc.irr != null ? `IRR = ${fmtPct(calc.irr)}` : "IRR = N/A",
                    detail: calc.irr == null
                      ? "IRR cannot be computed — check for sign changes in FCF."
                      : calc.irr > 0.08
                      ? "IRR exceeds 8% hurdle rate. Approve."
                      : "IRR is below 8% hurdle. Senior approval required.",
                  },
                  {
                    label: "Payback Achieved",
                    ok: calc.payback != null,
                    desc: calc.payback != null ? `Payback = ${fmtPeriod(calc.payback)}` : "Not reached",
                    detail: calc.payback != null
                      ? `Investment recovered in ${fmtPeriod(calc.payback)}.`
                      : "Project does not recoup investment within the lifecycle.",
                  },
                  {
                    label: "PI ≥ 1.0",
                    ok: calc.pi != null && calc.pi >= 1,
                    desc: calc.pi != null ? `PI = ${calc.pi.toFixed(2)}` : "N/A",
                    detail: calc.pi == null
                      ? "PI unavailable (CapEx = 0)."
                      : calc.pi >= 1
                      ? `PI ${calc.pi.toFixed(2)} — each $ of CapEx creates ${(calc.pi - 1).toFixed(2)}x value.`
                      : `PI ${calc.pi.toFixed(2)} is below 1.0. Capital efficiency is insufficient.`,
                  },
                  {
                    label: `CM% ≥ ${assumptions.targetCmPct}% (all years)`,
                    ok: calc.pl.every((r) => r.revenue === 0 || r.cmPct >= assumptions.targetCmPct),
                    warn: calc.pl.some((r) => r.revenue > 0 && r.cmPct < assumptions.targetCmPct),
                    desc: (() => {
                      const bad = calc.pl.filter((r) => r.revenue > 0 && r.cmPct < assumptions.targetCmPct);
                      return bad.length === 0 ? "All years within target" : `Years ${bad.map((r) => r.year).join(", ")} below target`;
                    })(),
                    detail: (() => {
                      const bad = calc.pl.filter((r) => r.revenue > 0 && r.cmPct < assumptions.targetCmPct);
                      return bad.length === 0
                        ? `Contribution margin meets ${assumptions.targetCmPct}% minimum in all years.`
                        : `CM% dips below ${assumptions.targetCmPct}% in Year${bad.length > 1 ? "s" : ""} ${bad.map((r) => r.year).join(", ")}. Review pricing or COGS.`;
                    })(),
                  },
                ].map(({ label, ok, warn, desc, detail }) => {
                  const Icon = ok ? CheckCircle : warn ? AlertTriangle : XCircle;
                  const color = ok ? "text-green-600 dark:text-green-400" : warn ? "text-amber-500" : "text-red-500";
                  const bg = ok ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : warn ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
                  return (
                    <div key={label} className={`rounded border px-3 py-2 ${bg}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
                        <span className={`text-[11px] font-semibold ${color}`}>{label}</span>
                        <span className="ml-auto text-[10px] font-mono text-muted-foreground">{desc}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground pl-5 leading-snug">{detail}</p>
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Revenue", value: fmt(calc.totalRevenue) },
          { label: "Total CapEx", value: fmt(calc.totalCapex) },
          { label: "Total FCF", value: fmtK(calc.pl.reduce((s, r) => s + r.fcf, 0)) },
          { label: "Lifecycle", value: `${setup.lifecycleYears} years` },
          { label: "Region", value: setup.region },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-md border bg-card px-3 py-2">
            <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
            <div className="text-sm font-bold font-mono">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
