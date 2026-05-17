import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDashboardSummary,
  useGetDashboardProjects,
  useSheetsExport,
  useSheetsImport,
} from "@workspace/api-client-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  Upload,
  Download,
  ExternalLink,
  Loader2,

} from "lucide-react";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1kysyHbkIsz_G5GbJEnbiuF6Qb4n2VduqsicjIsFP3gs";

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt$ = (v: number | null | undefined, decimals = 0) => {
  if (v == null) return <span className="text-slate-400">—</span>;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
    notation: Math.abs(v) >= 1_000_000 ? "compact" : "standard",
    compactDisplay: "short",
  }).format(v);
};

const fmtPct = (v: number | null | undefined, decimals = 1) => {
  if (v == null) return <span className="text-slate-400">—</span>;
  return `${v.toFixed(decimals)}%`;
};

const fmtDec = (v: number | null | undefined, decimals = 2) => {
  if (v == null) return <span className="text-slate-400">—</span>;
  return v.toFixed(decimals);
};

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  review:   "bg-amber-100  text-amber-700  border-amber-200",
  draft:    "bg-slate-100  text-slate-600  border-slate-200",
  archived: "bg-rose-50    text-rose-500   border-rose-200",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  isLoading,
}: {
  title: string;
  value: React.ReactNode;
  isLoading: boolean;
}) {
  return (
    <Card className="min-w-0 shadow-sm border-slate-200/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-4 pt-4">
        <CardTitle className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <Skeleton className="h-5 w-20" />
        ) : (
          <div className="text-sm sm:text-base lg:text-lg font-bold tracking-tighter break-all leading-tight text-slate-900">
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SheetsSyncCard() {
  const [loadingAction, setLoadingAction] = useState<"import" | "export" | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function runSync(action: "import" | "export") {
    setLoadingAction(action);
    setMessage(null);

    try {
      const response = await fetch(`/api/sheets/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const text = await response.text();
      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        throw new Error(data?.message || data?.error || `${action} failed`);
      }

      if (action === "import") {
        setMessage({
          type: "success",
          text: `Import completed. Updated ${data?.updated ?? data?.count ?? "data"} item(s).`,
        });

        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        setMessage({
          type: "success",
          text: "Export completed. Google Sheet output has been refreshed.",
        });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : `${action} failed`,
      });
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <Card className="border-dashed border-emerald-500/50 bg-emerald-50/50 flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png"
              className="h-4 w-4 shrink-0"
              alt="Google Drive"
            />
            <CardTitle className="text-xs font-bold truncate text-slate-900">
              Sheets Sync
            </CardTitle>
          </div>
          <a
            href={SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-primary transition-colors"
            aria-label="Open Google Sheet"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4 flex-1 flex flex-col justify-between">
        <div className="space-y-1 mt-1">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-700">Input:</span> Import financial data from Google Sheet.
          </p>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-700">Output:</span> Export latest NPV / IRR results.
          </p>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full h-8 text-xs gap-2 bg-white"
            disabled={loadingAction !== null}
            onClick={() => runSync("export")}
          >
            {loadingAction === "export" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Export
          </Button>

          <Button
            className="w-full h-8 text-xs gap-2"
            disabled={loadingAction !== null}
            onClick={() => runSync("import")}
          >
            {loadingAction === "import" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Import
          </Button>
        </div>

        {message && (
          <div
            className={
              message.type === "success"
                ? "rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] text-emerald-700"
                : "rounded border border-red-200 bg-red-50 px-2 py-1 text-[9px] text-red-600"
            }
          >
            {message.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: projects, isLoading: isProjectsLoading } = useGetDashboardProjects({
    sortBy: "npv",
    sortOrder: "desc",
  });

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-full overflow-hidden bg-slate-50/20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Executive Dashboard</h1>
        <p className="text-slate-500 text-xs font-medium">
          Portfolio overview — capital allocation, returns and regional footprint.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard title="Total Projects"   value={summary?.totalProjects ?? 0}  isLoading={isSummaryLoading} />
        <KpiCard title="Approved"         value={summary?.totalApproved  ?? 0}  isLoading={isSummaryLoading} />
        <KpiCard title="In Review"        value={summary?.totalInReview  ?? 0}  isLoading={isSummaryLoading} />
        <KpiCard title="Draft"            value={summary?.totalDraft     ?? 0}  isLoading={isSummaryLoading} />
        <KpiCard
          title="Avg NPV"
          value={fmt$(summary?.avgNpv)}
          isLoading={isSummaryLoading}
        />
        <KpiCard
          title="Total Investment"
          value={fmt$(summary?.totalInvestment)}
          isLoading={isSummaryLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Card className="h-full border-slate-200/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-700">Projects by Region</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] pt-0">
            {isSummaryLoading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary?.byRegion ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="region" fontSize={10} tickLine={false} axisLine={false} stroke="#94a3b8" />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="#94a3b8" />
                  <RechartsTooltip cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="h-full border-slate-200/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-700">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] pt-0">
            {isSummaryLoading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary?.byStatus ?? []}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="count"
                    nameKey="status"
                  >
                    {(summary?.byStatus ?? []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <SheetsSyncCard />
      </div>

      {/* Project KPI Table */}
      <Card className="border-slate-200/60 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-xs font-bold text-slate-700">
            Project Portfolio — Key Output Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[1100px]">
            <Table>
              <TableHeader className="bg-slate-50/70">
                <TableRow>
                  <TableHead className="py-2 px-5 text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Project</TableHead>
                  <TableHead className="py-2 text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Status</TableHead>
                  <TableHead className="py-2 text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Sales Regions</TableHead>
                  <TableHead className="py-2 text-right text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Investment</TableHead>
                  <TableHead className="py-2 text-right text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Sales</TableHead>
                  <TableHead className="py-2 text-right text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">CM</TableHead>
                  <TableHead className="py-2 text-right text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">CM%</TableHead>
                  <TableHead className="py-2 text-right text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">NPV</TableHead>
                  <TableHead className="py-2 text-right text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">IRR</TableHead>
                  <TableHead className="py-2 text-right text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">PI</TableHead>
                  <TableHead className="py-2 pr-5 text-right text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Payback (y)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isProjectsLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={11} className="p-4">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : projects?.map((p) => {
                      const npvPos = (p.npv ?? 0) >= 0;
                      const cmPos  = (p.cm  ?? 0) >= 0;
                      return (
                        <TableRow key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Project name */}
                          <TableCell className="py-2.5 px-5 font-medium text-xs min-w-[140px]">
                            <div className="flex flex-col gap-0.5">
                              <Link
                                href={`/projects/${p.id}`}
                                className="text-primary hover:underline underline-offset-4 font-semibold"
                              >
                                {p.name}
                              </Link>
                              {p.productCategory && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {p.productCategory}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="py-2.5">
                            <span
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold border capitalize ${
                                STATUS_STYLES[p.status] ?? STATUS_STYLES.draft
                              }`}
                            >
                              {p.status}
                            </span>
                          </TableCell>

                          {/* Sales regions */}
                          <TableCell className="py-2.5 min-w-[120px]">
                            <div className="flex flex-wrap gap-1">
                              {/* Primary manufacturing/booking region */}
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {p.region}
                              </span>
                              {/* Additional sales regions */}
                              {(p.salesRegions ?? []).map((r) => (
                                <span
                                  key={r}
                                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono bg-slate-100 text-slate-600 border border-slate-200"
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          </TableCell>

                          {/* Investment */}
                          <TableCell className="py-2.5 text-right font-mono text-xs text-slate-600">
                            {fmt$(p.investmentSize)}
                          </TableCell>

                          {/* Sales (totalRevenue) */}
                          <TableCell className="py-2.5 text-right font-mono text-xs text-slate-700">
                            {fmt$(p.totalRevenue)}
                          </TableCell>

                          {/* CM */}
                          <TableCell
                            className={`py-2.5 text-right font-mono text-xs font-semibold ${
                              cmPos ? "text-emerald-600" : "text-rose-500"
                            }`}
                          >
                            {fmt$(p.cm)}
                          </TableCell>

                          {/* CM% */}
                          <TableCell
                            className={`py-2.5 text-right font-mono text-xs font-semibold ${
                              (p.cmPct ?? 0) >= 0 ? "text-emerald-600" : "text-rose-500"
                            }`}
                          >
                            {fmtPct(p.cmPct)}
                          </TableCell>

                          {/* NPV */}
                          <TableCell
                            className={`py-2.5 text-right font-mono text-xs font-bold ${
                              npvPos ? "text-emerald-600" : "text-rose-500"
                            }`}
                          >
                            {fmt$(p.npv)}
                          </TableCell>

                          {/* IRR */}
                          <TableCell className="py-2.5 text-right font-mono text-xs text-slate-700">
                            {fmtPct(p.irr != null ? p.irr * 100 : null)}
                          </TableCell>

                          {/* PI */}
                          <TableCell
                            className={`py-2.5 text-right font-mono text-xs font-semibold ${
                              (p.pi ?? 0) >= 1 ? "text-emerald-600" : "text-rose-500"
                            }`}
                          >
                            {fmtDec(p.pi)}
                          </TableCell>

                          {/* Payback */}
                          <TableCell className="py-2.5 pr-5 text-right font-mono text-xs text-slate-700">
                            {p.paybackPeriod != null
                              ? `${p.paybackPeriod.toFixed(1)}y`
                              : <span className="text-slate-400">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
