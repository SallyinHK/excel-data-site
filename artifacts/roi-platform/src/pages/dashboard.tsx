import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDashboardSummary,
  useGetDashboardProjects,
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

const fmtMoney = (v: number | null | undefined, decimals = 0): ReactNode => {
  if (v == null || Number.isNaN(v)) return <span className="text-slate-400">—</span>;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
    notation: Math.abs(v) >= 1_000_000 ? "compact" : "standard",
    compactDisplay: "short",
  }).format(v);
};

const fmtMoneyText = (v: number | null | undefined) => {
  if (v == null || Number.isNaN(v)) return "—";

  return new Intl.NumberFormat("en-US", {
  style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: Math.abs(v) >= 1_000_000 ? "compact" : "standard",
    compactDisplay: "short",
  }).format(v);
};

const fmtPct = (v: number | null | undefined, decimals = 1): ReactNode => {
  if (v == null || Number.isNaN(v)) return <span className="text-slate-400">—</span>;
  return `${v.toFixed(decimals)}%`;
};

const fmtDec = (v: number | null | undefined, decimals = 2): ReactNode => {
  if (v == null || Number.isNaN(v)) return <span className="text-slate-400">—</span>;
  return v.toFixed(decimals);
};

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  conditional_approval: "bg-blue-50 text-blue-700 border-blue-200",
  review: "bg-amber-50 text-amber-700 border-amber-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  archived: "bg-rose-50 text-rose-600 border-rose-200",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  review: "Review",
  conditional_approval: "Conditional",
  approved: "Approved",
  rejected: "Rejected",
  archived: "Archived",
};

function KpiCard({
  title,
  value,
  hint,
  isLoading,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  isLoading: boolean;
}) {
  return (
    <Card className="border-slate-200/70 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {title}
        </div>

        {isLoading ? (
          <Skeleton className="mt-3 h-7 w-20" />
        ) : (
          <div className="mt-2 text-2xl font-bold leading-none tracking-tight text-slate-950">
            {value}
          </div>
        )}

        {hint && (
          <div className="mt-2 text-[11px] text-slate-500">
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SheetsSyncCard() {
  const queryClient = useQueryClient();
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

      const result = await response.json();

      if (!response.ok || result.ok === false) {
        throw new Error(result.error || `${action} failed.`);
      }

      setMessage({
        type: "success",
        text: result.message || `${action} completed.`,
      });

      await queryClient.invalidateQueries();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : `${action} failed.`,
      });
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm">
      <CardHeader className="px-4 pb-2 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src="https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png"
              className="h-4 w-4 shrink-0"
              alt="Google Drive"
            />
            <CardTitle className="truncate text-sm font-bold text-slate-950">
              Excel Record Sync
            </CardTitle>
          </div>

          <a
            href={SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 transition-colors hover:text-slate-700"
            aria-label="Open Google Sheet"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4">
        <p className="text-[11px] leading-relaxed text-slate-600">
          Sync the latest ROI records with the working Google Sheet.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-8 bg-white text-xs"
            disabled={loadingAction !== null}
            onClick={() => runSync("export")}
          >
            {loadingAction === "export" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            Export
          </Button>

          <Button
            className="h-8 text-xs"
            disabled={loadingAction !== null}
            onClick={() => runSync("import")}
          >
            {loadingAction === "import" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Import
          </Button>
        </div>

        {message && (
          <div
            className={
              message.type === "success"
                ? "rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-[10px] text-emerald-700"
                : "rounded-md border border-red-200 bg-white px-2 py-1.5 text-[10px] text-red-600"
            }
          >
            {message.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStatusCard({
  byStatus,
  isLoading,
}: {
  byStatus: Array<{ status: string; count: number }>;
  isLoading: boolean;
}) {
  const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#64748b"];

  return (
    <Card className="border-slate-200/70 bg-white shadow-sm">
      <CardHeader className="px-4 pb-1 pt-4">
        <CardTitle className="text-sm font-bold text-slate-950">
          Status Distribution
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={34}
                    outerRadius={52}
                    paddingAngle={3}
                  >
                    {byStatus.map((entry, index) => (
                      <Cell key={entry.status} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {byStatus.map((item, index) => (
                <div key={item.status} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="truncate text-slate-600">
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RegionCard({
  byRegion,
  isLoading,
}: {
  byRegion: Array<{ region: string; count: number }>;
  isLoading: boolean;
}) {
  return (
    <Card className="border-slate-200/70 bg-white shadow-sm">
      <CardHeader className="px-4 pb-1 pt-4">
        <CardTitle className="text-sm font-bold text-slate-950">
          Regional Footprint
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byRegion} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="region" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                <RechartsTooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: projects, isLoading: isProjectsLoading } = useGetDashboardProjects({
    sortBy: "npv",
    sortOrder: "desc",
  });

  const summaryAny = summary as any;
  const projectRows = useMemo(() => {
    const rows = Array.isArray(projects) ? projects : [];
    return rows.filter((project: any) => project.status !== "archived");
  }, [projects]);

  const byRegion = Array.isArray(summaryAny?.byRegion) ? summaryAny.byRegion : [];
  const byStatus = Array.isArray(summaryAny?.byStatus) ? summaryAny.byStatus : [];

  return (
    <div className="min-h-screen bg-slate-50/40 p-4 sm:p-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Executive Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Portfolio overview for capital allocation, financial returns, and regional exposure.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Active portfolio view
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <KpiCard
            title="Projects"
            value={summaryAny?.totalProjects ?? 0}
            hint="Active cases"
            isLoading={isSummaryLoading}
          />
          <KpiCard
            title="Approved"
            value={summaryAny?.totalApproved ?? 0}
            isLoading={isSummaryLoading}
          />
          <KpiCard
            title="In Review"
            value={summaryAny?.totalInReview ?? 0}
            isLoading={isSummaryLoading}
          />
          <KpiCard
            title="Draft"
            value={summaryAny?.totalDraft ?? 0}
            isLoading={isSummaryLoading}
          />
          <KpiCard
            title="Investment"
            value={fmtMoney(summaryAny?.totalInvestment)}
            isLoading={isSummaryLoading}
          />
          <KpiCard
            title="Avg NPV"
            value={fmtMoney(summaryAny?.avgNpv)}
            isLoading={isSummaryLoading}
          />
        </div>

        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr_.85fr]">
            <SheetsSyncCard />
            <MiniStatusCard byStatus={byStatus} isLoading={isSummaryLoading} />
            <RegionCard byRegion={byRegion} isLoading={isSummaryLoading} />

            <Card className="border-slate-200/70 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Portfolio Note
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Focus on NPV, PI, CM%, and payback together. A high sales case may still need review if
                  capital efficiency or downside risk is weak.
                </p>
              </CardContent>
            </Card>
          </div>
          <Card className="overflow-hidden border-slate-200/70 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-950">
                    Project Portfolio
                  </CardTitle>
                  <p className="mt-1 text-xs text-slate-500">
                    Key financial outputs by project. Archived projects are excluded.
                  </p>
                </div>

                <Link href="/projects">
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    Open Registry
                  </Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isProjectsLoading ? (
                <div className="space-y-3 p-5">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="max-h-[560px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-slate-50">
                      <TableRow>
                        <TableHead className="min-w-[260px] pl-5 text-[11px] uppercase tracking-wider text-slate-400">
                          Project
                        </TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-slate-400">
                          Status
                        </TableHead>
                        <TableHead className="text-right text-[11px] uppercase tracking-wider text-slate-400">
                          Sales
                        </TableHead>
                        <TableHead className="text-right text-[11px] uppercase tracking-wider text-slate-400">
                          CM%
                        </TableHead>
                        <TableHead className="text-right text-[11px] uppercase tracking-wider text-slate-400">
                          NPV
                        </TableHead>
                        <TableHead className="text-right text-[11px] uppercase tracking-wider text-slate-400">
                          IRR
                        </TableHead>
                        <TableHead className="pr-5 text-right text-[11px] uppercase tracking-wider text-slate-400">
                          PI
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {projectRows.map((project: any) => {
                        const statusClass =
                          STATUS_STYLES[project.status] ?? "bg-slate-100 text-slate-600 border-slate-200";

                        return (
                          <TableRow key={project.id} className="hover:bg-slate-50/80">
                            <TableCell className="pl-5">
                              <Link
                                href={`/projects/${project.id}`}
                                className="font-semibold text-blue-600 hover:underline"
                              >
                                {project.name}
                              </Link>
                              <div className="mt-0.5 text-[11px] text-slate-400">
                                {project.productCategory ?? "—"} · {project.region}
                              </div>
                            </TableCell>

                            <TableCell>
                           <Badge className={`${statusClass} border text-[10px] shadow-none`}>
                                {STATUS_LABELS[project.status] ?? project.status}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-right font-mono text-sm text-slate-700">
                              {fmtMoney(project.totalRevenue)}
                            </TableCell>

                            <TableCell className="text-right font-mono text-sm font-semibold text-emerald-600">
                              {fmtPct(project.cmPct)}
                            </TableCell>

                            <TableCell
                              className={`text-right font-mono text-sm font-semibold ${
                                project.npv == null
                                  ? "text-slate-400"
                                  : project.npv >= 0
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                              }`}
                            >
                              {fmtMoney(project.npv)}
                            </TableCell>

                            <TableCell className="text-right font-mono text-sm text-slate-700">
                              {fmtPct(project.irr)}
                            </TableCell>

                            <TableCell
                              className={`pr-5 text-right font-mono text-sm font-semibold ${
                                project.pi == null
                                  ? "text-slate-400"
                                  : project.pi >= 1
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                              }`}
                            >
                              {fmtDec(project.pi)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {projectRows.length === 0 && (
                    <div className="p-10 text-center text-sm text-slate-500">
                      No active projects to display.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
