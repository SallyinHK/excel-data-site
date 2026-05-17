import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { useGetProject, useListScenarios } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, FileText, DollarSign, TrendingUp, Clock, Activity } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";

const fmt = (val: number | null | undefined) => {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
};

const fmtM = (val: number | null | undefined) => {
  if (val == null) return "—";
  const m = val / 1_000_000;
  return `${m >= 0 ? "" : "-"}$${Math.abs(m).toFixed(2)}M`;
};

const fmtPct = (val: number | null | undefined) => val == null ? "—" : `${(val * 100).toFixed(2)}%`;

const fmtPeriod = (val: number | null | undefined) => {
  if (val == null) return "—";
  const yrs = Math.floor(val);
  const months = Math.round((val - yrs) * 12);
  return months > 0 ? `${yrs}y ${months}m` : `${yrs}y`;
};

const fmtK = (val: number | null | undefined) => {
  if (val == null) return "—";
  if (Math.abs(val) >= 1_000_000) return fmtM(val);
  return fmt(val);
};

function parseCashFlows(calc: any) {
  try {
    if (!calc?.cashFlows) return [];
    return typeof calc.cashFlows === "string" ? JSON.parse(calc.cashFlows) : calc.cashFlows;
  } catch {
    return [];
  }
}

export default function ProjectReport() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id?.replace(/\D/g, "") ?? "0");

  const { data: project, isLoading: projectLoading } = useGetProject(projectId);
  const { data: scenarios, isLoading: scenariosLoading } = useListScenarios(projectId);

  const selectedScenario = useMemo(() => {
    const withCalc = (scenarios ?? []).filter((s: any) => s.calculation);
    if (withCalc.length === 0) return scenarios?.[0] ?? null;

    const baseline = withCalc.find((s: any) => s.isBaseline);
    if (baseline) return baseline;

    return [...withCalc].sort(
      (a: any, b: any) => (b.calculation?.npv ?? -Infinity) - (a.calculation?.npv ?? -Infinity)
    )[0];
  }, [scenarios]);

  const calc: any = selectedScenario?.calculation ?? null;
  const cashFlows = parseCashFlows(calc);
  const totalFCF = cashFlows.reduce((sum: number, cf: any) => sum + (cf.freeCashFlow ?? 0), 0);
  const pi = calc?.totalCapex > 0 ? (calc.npv + calc.totalCapex) / calc.totalCapex : null;

  if (projectLoading || scenariosLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Project not found.</p>
        <Link href="/projects" className="text-primary underline mt-2 inline-block">Back to Projects</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6 print:p-0 print:space-y-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 print:hidden">
        <div className="flex items-start gap-3">
          <Link href={`/projects/${project.id}`} className="inline-flex items-center justify-center rounded-md h-9 w-9 hover:bg-accent transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              ROI Report
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Printable decision summary for project review.</p>
          </div>
        </div>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" />
          Print / Save as PDF
        </Button>
      </div>

      <Card className="print:shadow-none print:border-slate-200">
        <CardHeader className="border-b">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl tracking-tight">{project.name}</CardTitle>
              <CardDescription className="mt-1">Project ROI decision report</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="uppercase text-[10px]">{project.status}</Badge>
              {selectedScenario?.name && <Badge className="uppercase text-[10px]">{selectedScenario.name}</Badge>}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Project ID", value: `PRJ-${project.id}` },
              { label: "Region", value: project.region },
              { label: "Category", value: project.productCategory || "—" },
              { label: "Investment Size", value: fmt(project.investmentSize as any) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
                <div className="text-sm font-semibold font-mono">{value}</div>
              </div>
            ))}
          </div>

          {calc ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "NPV", value: fmtM(calc.npv), icon: DollarSign, ok: calc.npv >= 0 },
                  { label: "IRR", value: fmtPct(calc.irr), icon: TrendingUp, ok: (calc.irr ?? 0) >= 0 },
                  { label: "Payback", value: fmtPeriod(calc.paybackPeriod), icon: Clock, ok: true },
                  { label: "ROI", value: calc.roiPercent != null ? `${calc.roiPercent.toFixed(1)}%` : "—", icon: Activity, ok: (calc.roiPercent ?? 0) >= 0 },
                  { label: "PI", value: pi != null ? pi.toFixed(2) : "—", icon: Activity, ok: (pi ?? 0) >= 1 },
                ].map(({ label, value, icon: Icon, ok }) => (
                  <div key={label} className="rounded-md border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className={`text-xl font-bold font-mono ${value === "—" ? "text-muted-foreground" : ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
                <Card className="shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">Annual Free Cash Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cashFlows}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="year" fontSize={11} tickFormatter={(v) => `Y${v}`} />
                          <YAxis fontSize={11} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                          <RechartsTooltip formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Year ${l}`} />
                          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                          <Bar dataKey="freeCashFlow" name="Free Cash Flow" radius={[3, 3, 0, 0]} fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">Cumulative Cash Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cashFlows}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="year" fontSize={11} tickFormatter={(v) => `Y${v}`} />
                          <YAxis fontSize={11} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                          <RechartsTooltip formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Year ${l}`} />
                          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                          <Area type="monotone" dataKey="cumulativeCashFlow" name="Cumulative FCF" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-[11px]">Year</TableHead>
                      <TableHead className="text-right text-[11px]">Revenue</TableHead>
                      <TableHead className="text-right text-[11px]">Gross Profit</TableHead>
                      <TableHead className="text-right text-[11px]">EBITDA</TableHead>
                      <TableHead className="text-right text-[11px]">NOPAT</TableHead>
                      <TableHead className="text-right text-[11px]">Free Cash Flow</TableHead>
                      <TableHead className="text-right text-[11px]">Cumulative FCF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashFlows.map((cf: any) => (
                      <TableRow key={cf.year}>
                        <TableCell className="text-xs font-semibold">Year {cf.year}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmtK(cf.revenue)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmtK(cf.grossProfit)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmtK(cf.ebitda)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmtK(cf.nopat)}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold">{fmtK(cf.freeCashFlow)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmtK(cf.cumulativeCashFlow)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Revenue", value: fmt(calc.totalRevenue) },
                  { label: "Total Cost", value: fmt(calc.totalCost) },
                  { label: "Total FCF", value: fmtK(totalFCF) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-md border bg-muted/30 px-3 py-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
                    <div className="text-sm font-bold font-mono">{value}</div>
                  </div>
                ))}
              </div>

            </>
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No calculated scenario is available yet. Run calculation from the project detail page first.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
