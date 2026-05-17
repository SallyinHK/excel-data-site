import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetProject,
  useUpdateProject,
  useListScenarios,
  useCreateScenario,
  useDuplicateScenario,
  useGetFinancialInputs,
  useSaveFinancialInputs,
  useCalculateScenario,
  useGetProjectAuditLog,
  useListProjectSalesRegions,
  useAddProjectSalesRegion,
  useUpdateProjectSalesRegion,
  useRemoveProjectSalesRegion,
  useListRegionalParameters,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Play,
  PlusCircle,
  Copy,
  TrendingUp,
  Clock,
  DollarSign,
  Activity,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart2,
  Layers,
  ShieldCheck,
  Building2,
  Globe,
  Plus,
  Trash2,
  Pencil,
  X,
  Info,
  FileText,
} from "lucide-react";
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
import { useQueryClient } from "@tanstack/react-query";

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (val: number | null | undefined) => {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
};
const fmtM = (val: number | null | undefined) => {
  if (val == null) return "—";
  const m = val / 1_000_000;
  return `$${m.toFixed(2)}M`;
};
const fmtPct = (val: number | null | undefined) => {
  if (val == null) return "—";
  return `${(val * 100).toFixed(2)}%`;
};
const fmtPeriod = (val: number | null | undefined) => {
  if (val == null) return "—";
  const yrs = Math.floor(val);
  const months = Math.round((val - yrs) * 12);
  return months > 0 ? `${yrs}y ${months}m` : `${yrs}y`;
};
const fmtK = (val: number | null | undefined) => {
  if (val == null) return "—";
  if (Math.abs(val) >= 1_000_000) return fmtM(val);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
};

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  review: "outline",
  approved: "default",
  archived: "destructive",
};

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ num, label, icon: Icon }: { num: string; label: string; icon?: any }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
        {num}
      </span>
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Sub-component: Sales Regions Manager ────────────────────────────────────

function SalesRegionsCard({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: regions, isLoading } = useListProjectSalesRegions(projectId);
  const { data: allRegionalParams } = useListRegionalParameters();
  const addRegion = useAddProjectSalesRegion();
  const updateRegion = useUpdateProjectSalesRegion();
  const removeRegion = useRemoveProjectSalesRegion();

  const [showAdd, setShowAdd] = useState(false);
  const [newRegion, setNewRegion] = useState("");
  const [newFx, setNewFx] = useState("1.00");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFx, setEditFx] = useState("1.00");

  const availableRegions = (allRegionalParams ?? [])
    .map((r) => r.region)
    .filter((r) => !(regions ?? []).some((sr) => sr.region === r));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["listProjectSalesRegions", projectId] });

  const handleAdd = () => {
    if (!newRegion) return;
    addRegion.mutate(
      { id: projectId, data: { region: newRegion, fxMultiplier: parseFloat(newFx) || 1 } },
      {
        onSuccess: () => {
          toast({ title: "Region added" });
          setShowAdd(false);
          setNewRegion("");
          setNewFx("1.00");
          invalidate();
        },
        onError: () => toast({ title: "Error", description: "Failed to add region", variant: "destructive" }),
      }
    );
  };

  const handleUpdate = (regionId: number) => {
    updateRegion.mutate(
      { id: projectId, regionId, data: { fxMultiplier: parseFloat(editFx) || 1 } },
      {
        onSuccess: () => {
          toast({ title: "FX multiplier updated" });
          setEditingId(null);
          invalidate();
        },
        onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
      }
    );
  };

  const handleRemove = (regionId: number, regionName: string) => {
    removeRegion.mutate(
      { id: projectId, regionId },
      {
        onSuccess: () => {
          toast({ title: `${regionName} removed` });
          invalidate();
        },
        onError: () => toast({ title: "Error", description: "Failed to remove region", variant: "destructive" }),
      }
    );
  };

  return (
    <Card className="border-slate-200/70 shadow-sm">
      <CardHeader className="pb-3 px-5 pt-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Sales Regions
            </CardTitle>
            <span className="text-[10px] text-muted-foreground font-normal normal-case tracking-normal">
              — markets where this product is sold; prices adjust by FX multiplier
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-primary"
            onClick={() => { setShowAdd(true); setNewRegion(""); setNewFx("1.00"); }}
          >
            <Plus className="w-3 h-3" /> Add Region
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-5 py-3">
        {isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <div className="space-y-2">
            {/* Add form */}
            {showAdd && (
              <div className="flex items-center gap-2 p-2 rounded-md border border-primary/30 bg-primary/5">
                <Select value={newRegion} onValueChange={setNewRegion}>
                  <SelectTrigger className="h-7 text-xs w-36">
                    <SelectValue placeholder="Select region…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRegions.length === 0 ? (
                      <SelectItem value="__none" disabled>All regions added</SelectItem>
                    ) : (
                      availableRegions.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">FX ×</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="h-7 w-20 text-xs font-mono"
                    value={newFx}
                    onChange={(e) => setNewFx(e.target.value)}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground flex-1">
                  {newFx && parseFloat(newFx) !== 1
                    ? `Price × ${parseFloat(newFx).toFixed(2)} vs base`
                    : "Same price as base"}
                </span>
                <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!newRegion || addRegion.isPending}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAdd(false)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}

            {/* Existing regions */}
            {(regions ?? []).length === 0 && !showAdd ? (
              <p className="text-[11px] text-muted-foreground py-2">
                No additional sales regions yet. Click <strong>Add Region</strong> to specify markets.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(regions ?? []).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                  >
                    {editingId === r.id ? (
                      <>
                        <span className="font-semibold font-mono text-slate-700 mr-1">{r.region}</span>
                        <span className="text-[10px] text-muted-foreground">FX ×</span>
                        <Input
                          autoFocus
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="h-5 w-16 text-[11px] font-mono px-1"
                          value={editFx}
                          onChange={(e) => setEditFx(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleUpdate(r.id)}
                        />
                        <button
                          className="text-primary hover:text-primary/70 text-[10px] font-semibold"
                          onClick={() => handleUpdate(r.id)}
                        >
                          Save
                        </button>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="font-semibold font-mono text-slate-700">{r.region}</span>
                        <span className="text-[10px] text-muted-foreground">
                          FX ×{Number(r.fxMultiplier).toFixed(2)}
                        </span>
                        {Number(r.fxMultiplier) !== 1 && (
                          <span className={`text-[9px] font-semibold px-1 rounded ${Number(r.fxMultiplier) > 1 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {Number(r.fxMultiplier) > 1 ? `+${((Number(r.fxMultiplier) - 1) * 100).toFixed(0)}%` : `${((Number(r.fxMultiplier) - 1) * 100).toFixed(0)}%`}
                          </span>
                        )}
                        <button
                          className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => { setEditingId(r.id); setEditFx(String(Number(r.fxMultiplier).toFixed(2))); }}
                          title="Edit FX multiplier"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          className="text-muted-foreground hover:text-rose-500 transition-colors"
                          onClick={() => handleRemove(r.id, r.region)}
                          title="Remove region"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sub-component: Financial Inputs Editor ──────────────────────────────────

type FinInput = { year: number; salesVolume: number; netPrice: number; unitCost: number | null; costQty: number | null; cogs: number; opex: number; capex: number };

function FinancialInputsEditor({ scenarioId, project, onCalcDone }: { scenarioId: number; project: any; onCalcDone: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: rawInputs, isLoading } = useGetFinancialInputs(scenarioId);
  const saveInputs = useSaveFinancialInputs();
  const calcScenario = useCalculateScenario();

  const empty5years: FinInput[] = Array.from({ length: 5 }, (_, i) => ({
    year: i + 1,
    salesVolume: 0,
    netPrice: 0,
    unitCost: null,
    costQty: null,
    cogs: 0,
    opex: 0,
    capex: 0,
  }));

  const [localInputs, setLocalInputs] = useState<FinInput[] | null>(null);
  const inputs = localInputs ?? (rawInputs?.length ? (rawInputs as FinInput[]) : empty5years);

  const setCell = (year: number, field: keyof FinInput, value: string) => {
    setLocalInputs((prev) => {
      const base = prev ?? (rawInputs?.length ? (rawInputs as FinInput[]) : empty5years);
      return base.map((r) => {
        if (r.year !== year) return r;
        const parsed = value === "" ? null : (parseFloat(value) || 0);
        const updated = { ...r, [field]: parsed };
        if (field === "unitCost" || field === "costQty") {
          const uc = field === "unitCost" ? (parsed ?? null) : r.unitCost;
          const cq = field === "costQty" ? (parsed ?? null) : r.costQty;
          if (uc != null && cq != null) {
            updated.cogs = uc * cq;
          }
        }
        return updated;
      });
    });
  };

  const handleSave = async () => {
    try {
      await saveInputs.mutateAsync({ id: scenarioId, data: { inputs } });
      await calcScenario.mutateAsync({ id: scenarioId });
      toast({ title: "Saved & recalculated", description: "Inputs saved. NPV/IRR/Payback updated." });
      onCalcDone();
    } catch {
      toast({ title: "Error", description: "Failed to save or calculate.", variant: "destructive" });
    }
  };

  if (isLoading)
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    );

  const years = inputs.map((r) => r.year);

  return (
    <div className="space-y-8 p-4">

      {/* ① Project Setup */}
      <div>
        <SectionLabel num="1" label="Project Setup" icon={Building2} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Project ID", value: `PRJ-${project.id}` },
            { label: "Region", value: project.region },
            { label: "Category", value: project.productCategory ?? "—" },
            { label: "Investment", value: project.investmentSize ? fmt(parseFloat(String(project.investmentSize))) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-md border bg-muted/30 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
              <div className="text-sm font-semibold font-mono truncate">{value}</div>
            </div>
          ))}
        </div>
        {project.description && (
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{project.description}</p>
        )}
      </div>

      {/* ② Revenue Inputs */}
      <div>
        <SectionLabel num="2" label="Revenue Inputs" icon={TrendingUp} />
        <p className="text-[10px] text-muted-foreground mb-2">Sales volume (units) and net selling price per unit for each year.</p>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-48 text-[11px]">Field</TableHead>
                {years.map((y) => <TableHead key={y} className="text-center w-28 text-[11px]">Year {y}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {([
                { key: "salesVolume" as keyof FinInput, label: "Unit Sales (qty)" },
                { key: "netPrice" as keyof FinInput, label: "Net Price ($/unit)" },
              ]).map(({ key, label }) => (
                <TableRow key={key}>
                  <TableCell className="text-xs font-medium text-muted-foreground py-1.5">{label}</TableCell>
                  {inputs.map((r) => (
                    <TableCell key={r.year} className="p-1">
                      <Input type="number" className="h-7 text-xs font-mono text-right" value={r[key] ?? ""} onChange={(e) => setCell(r.year, key, e.target.value)} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {/* Derived: Revenue */}
              <TableRow className="bg-primary/5">
                <TableCell className="text-xs font-semibold text-primary py-1.5">→ Revenue (derived)</TableCell>
                {inputs.map((r) => (
                  <TableCell key={r.year} className="text-center text-xs font-mono font-semibold text-primary py-1.5">
                    {fmt(r.salesVolume * r.netPrice)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ③ Cost Inputs */}
      <div>
        <SectionLabel num="3" label="Cost Inputs" icon={Layers} />
        <p className="text-[10px] text-muted-foreground mb-2">Variable costs (COGS, OpEx) and capital investment (CapEx) per year.</p>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-48 text-[11px]">Field</TableHead>
                {years.map((y) => <TableHead key={y} className="text-center w-28 text-[11px]">Year {y}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Variable costs */}
              <TableRow>
                <TableCell colSpan={years.length + 1} className="py-1 px-3 bg-muted/20">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Variable Costs</span>
                </TableCell>
              </TableRow>

              {/* Unit cost breakdown sub-header */}
              <TableRow>
                <TableCell colSpan={years.length + 1} className="py-0.5 px-3 bg-amber-50/60 border-l-2 border-amber-300">
                  <span className="text-[10px] font-semibold text-amber-700 tracking-wide">COGS Breakdown (optional) — fill unit cost × qty to auto-compute COGS</span>
                </TableCell>
              </TableRow>

              {/* Unit Cost ($/unit) */}
              <TableRow className="bg-amber-50/30">
                <TableCell className="text-xs font-medium text-amber-800 py-1.5 pl-5 border-l-2 border-amber-200">
                  Unit Cost ($/unit)
                </TableCell>
                {inputs.map((r) => (
                  <TableCell key={r.year} className="p-1">
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="0.0000"
                      className="h-7 text-xs font-mono text-right bg-amber-50/60 border-amber-200 focus:border-amber-400"
                      value={r.unitCost ?? ""}
                      onChange={(e) => setCell(r.year, "unitCost", e.target.value)}
                    />
                  </TableCell>
                ))}
              </TableRow>

              {/* Cost Qty */}
              <TableRow className="bg-amber-50/30">
                <TableCell className="text-xs font-medium text-amber-800 py-1.5 pl-5 border-l-2 border-amber-200">
                  Cost Qty (units)
                </TableCell>
                {inputs.map((r) => (
                  <TableCell key={r.year} className="p-1">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      className="h-7 text-xs font-mono text-right bg-amber-50/60 border-amber-200 focus:border-amber-400"
                      value={r.costQty ?? ""}
                      onChange={(e) => setCell(r.year, "costQty", e.target.value)}
                    />
                  </TableCell>
                ))}
              </TableRow>

              {/* Auto-computed COGS from unit cost × qty */}
              <TableRow className="bg-amber-50/50 border-l-2 border-amber-300">
                <TableCell className="text-xs font-semibold text-amber-700 py-1.5 pl-5 border-l-2 border-amber-200">
                  → COGS (unit cost × qty)
                </TableCell>
                {inputs.map((r) => {
                  const computed = (r.unitCost != null && r.costQty != null) ? r.unitCost * r.costQty : null;
                  return (
                    <TableCell key={r.year} className="text-center text-xs font-mono font-semibold py-1.5 text-amber-700">
                      {computed != null ? fmt(computed) : <span className="text-muted-foreground/50 font-normal">—</span>}
                    </TableCell>
                  );
                })}
              </TableRow>

              {/* COGS total (editable, auto-populated from breakdown) */}
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground py-1.5">
                  <span>COGS Total ($)</span>
                  <span className="ml-1 text-[10px] text-muted-foreground/60">(auto or manual)</span>
                </TableCell>
                {inputs.map((r) => (
                  <TableCell key={r.year} className="p-1">
                    <Input
                      type="number"
                      className="h-7 text-xs font-mono text-right"
                      value={r.cogs}
                      onChange={(e) => setCell(r.year, "cogs", e.target.value)}
                    />
                  </TableCell>
                ))}
              </TableRow>

              {/* OpEx */}
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground py-1.5">OpEx ($)</TableCell>
                {inputs.map((r) => (
                  <TableCell key={r.year} className="p-1">
                    <Input type="number" className="h-7 text-xs font-mono text-right" value={r.opex} onChange={(e) => setCell(r.year, "opex", e.target.value)} />
                  </TableCell>
                ))}
              </TableRow>

              {/* Capital Investment */}
              <TableRow>
                <TableCell colSpan={years.length + 1} className="py-1 px-3 bg-muted/20">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Capital Investment</span>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground py-1.5">CapEx ($)</TableCell>
                {inputs.map((r) => (
                  <TableCell key={r.year} className="p-1">
                    <Input type="number" className="h-7 text-xs font-mono text-right" value={r.capex} onChange={(e) => setCell(r.year, "capex", e.target.value)} />
                  </TableCell>
                ))}
              </TableRow>
              {/* Derived: Gross Profit */}
              <TableRow className="bg-primary/5">
                <TableCell className="text-xs font-semibold text-primary py-1.5">→ Gross Profit (derived)</TableCell>
                {inputs.map((r) => {
                  const gp = r.salesVolume * r.netPrice - r.cogs;
                  return (
                    <TableCell key={r.year} className={`text-center text-xs font-mono font-semibold py-1.5 ${gp >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                      {fmt(gp)}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ④ Financial Assumptions */}
      <div>
        <SectionLabel num="4" label="Financial Assumptions" icon={ShieldCheck} />
        <p className="text-[10px] text-muted-foreground mb-2">Governed parameters used by the calculation engine. Edit in Formula Governance.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Discount Rate (WACC)", value: "See Governance →", href: "/admin/formulas" },
            { label: "Tax Rate", value: "Per Region", href: "/admin/regions" },
            { label: "Lifecycle (Years)", value: `${inputs.length}y` },
          ].map(({ label, value, href }) => (
            <div key={label} className="rounded-md border px-3 py-2 flex flex-col gap-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
              {href ? (
                <Link href={href} className="text-xs font-mono text-primary hover:underline">{value}</Link>
              ) : (
                <div className="text-xs font-mono font-semibold">{value}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveInputs.isPending || calcScenario.isPending} className="gap-2">
          <Play className="w-4 h-4" />
          {saveInputs.isPending || calcScenario.isPending ? "Calculating…" : "Save & Run Calculation"}
        </Button>
      </div>
    </div>
  );
}

// ─── Sub-component: Calculation Results ─────────────────────────────────────

function CalcResults({ scenario }: { scenario: any }) {
  const [resultsTab, setResultsTab] = useState<"executive" | "pl" | "cashflow" | "risk">("executive");
  const calc = scenario.calculation;

  if (!calc) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Activity className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">No calculation yet. Enter financial inputs and run a calculation.</p>
      </div>
    );
  }

  let cashFlows: any[] = [];
  try {
    if (calc.cashFlows) cashFlows = typeof calc.cashFlows === "string" ? JSON.parse(calc.cashFlows) : calc.cashFlows;
  } catch { /* ignore */ }

  const totalRevenue = calc.totalRevenue ?? 0;
  const totalCogs = cashFlows.reduce((s: number, cf: any) => s + (cf.revenue - cf.grossProfit), 0);
  const totalGP = cashFlows.reduce((s: number, cf: any) => s + cf.grossProfit, 0);
  const totalEbitda = cashFlows.reduce((s: number, cf: any) => s + cf.ebitda, 0);
  const totalNopat = cashFlows.reduce((s: number, cf: any) => s + cf.nopat, 0);
  const totalFCF = cashFlows.reduce((s: number, cf: any) => s + cf.freeCashFlow, 0);
  const gpPct = totalRevenue > 0 ? (totalGP / totalRevenue) * 100 : null;
  const ebitdaPct = totalRevenue > 0 ? (totalEbitda / totalRevenue) * 100 : null;
  const nopatPct = totalRevenue > 0 ? (totalNopat / totalRevenue) * 100 : null;

  // Profitability Index = (NPV + totalCapex) / totalCapex
  const pi = calc.totalCapex > 0 ? (calc.npv + calc.totalCapex) / calc.totalCapex : null;

  const metricExplanations: Record<string, { title: string; formula: string; rows: { label: string; value: string }[]; note: string }> = {
    NPV: {
      title: "Net Present Value",
      formula: "NPV = Σ Free Cash Flow_t / (1 + WACC)^t",
      rows: [
        { label: "Current result", value: fmtM(calc.npv) },
        { label: "Total free cash flow", value: fmtK(totalFCF) },
        { label: "Governed rate", value: "WACC / discount rate from Formula Governance" },
      ],
      note: "A positive NPV means the project creates value after discounting future cash flows at the governed cost of capital.",
    },
    IRR: {
      title: "Internal Rate of Return",
      formula: "IRR is the discount rate that makes NPV equal to zero.",
      rows: [
        { label: "Current result", value: fmtPct(calc.irr) },
        { label: "Decision logic", value: "Compare with hurdle rate / WACC" },
        { label: "Data source", value: "Annual free cash flow series" },
      ],
      note: "IRR may be unavailable when the cash flow pattern does not contain both negative and positive values.",
    },
    Payback: {
      title: "Payback Period",
      formula: "Payback = the first point where cumulative free cash flow becomes positive.",
      rows: [
        { label: "Current result", value: fmtPeriod(calc.paybackPeriod) },
        { label: "Latest cumulative FCF", value: fmtK(cashFlows.at(-1)?.cumulativeCashFlow) },
        { label: "Lifecycle years", value: `${cashFlows.length}` },
      ],
      note: "A shorter payback period means the project recovers invested capital faster, but it should still be considered together with NPV and IRR.",
    },
    ROI: {
      title: "Return on Investment",
      formula: "ROI = Total Free Cash Flow / Total CapEx",
      rows: [
        { label: "Current result", value: calc.roiPercent != null ? `${calc.roiPercent.toFixed(1)}%` : "—" },
        { label: "Total free cash flow", value: fmtK(totalFCF) },
        { label: "Total CapEx", value: fmt(calc.totalCapex) },
      ],
      note: "ROI explains the overall return relative to capital invested. It is easy to read, but it does not reflect timing as clearly as NPV.",
    },
    PI: {
      title: "Profitability Index",
      formula: "PI = (NPV + Total CapEx) / Total CapEx",
      rows: [
        { label: "Current result", value: pi != null ? pi.toFixed(2) : "—" },
        { label: "NPV", value: fmtM(calc.npv) },
        { label: "Total CapEx", value: fmt(calc.totalCapex) },
      ],
      note: "A PI above 1.0 means the project creates value per dollar invested, which is useful for capital allocation comparison.",
    },
  };

  return (
    <div className="p-4">
      <Tabs value={resultsTab} onValueChange={(v) => setResultsTab(v as any)}>
        <TabsList className="h-8 mb-4">
          <TabsTrigger value="executive" className="text-xs gap-1.5">
            <DollarSign className="w-3 h-3" /> ① Executive
          </TabsTrigger>
          <TabsTrigger value="pl" className="text-xs gap-1.5">
            <BarChart2 className="w-3 h-3" /> ② P&amp;L
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="text-xs gap-1.5">
            <Activity className="w-3 h-3" /> ③ Cash Flow
          </TabsTrigger>
          <TabsTrigger value="risk" className="text-xs gap-1.5">
            <ShieldCheck className="w-3 h-3" /> ④ Risk
          </TabsTrigger>
        </TabsList>

        {/* ① Executive Outputs */}
        <TabsContent value="executive" className="m-0 space-y-5">
          <SectionLabel num="1" label="Core Decision Metrics" icon={DollarSign} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              {
                label: "NPV",
                value: fmtM(calc.npv),
                sub: "Net Present Value",
                positive: calc.npv >= 0,
                icon: DollarSign,
              },
              {
                label: "IRR",
                value: fmtPct(calc.irr),
                sub: "Internal Rate of Return",
                positive: (calc.irr ?? 0) >= 0,
                icon: TrendingUp,
              },
              {
                label: "Payback",
                value: fmtPeriod(calc.paybackPeriod),
                sub: "Recovery Period",
                positive: true,
                icon: Clock,
              },
              {
                label: "ROI",
                value: calc.roiPercent != null ? `${calc.roiPercent.toFixed(1)}%` : "—",
                sub: "Return on Investment",
                positive: (calc.roiPercent ?? 0) >= 0,
                icon: Activity,
              },
              {
                label: "PI",
                value: pi != null ? pi.toFixed(2) : "—",
                sub: "Profitability Index",
                positive: (pi ?? 0) >= 1,
                icon: Activity,
              },
            ].map(({ label, value, sub, positive, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className={`text-xl font-bold font-mono leading-tight ${value === "—" ? "text-muted-foreground" : positive ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    {value}
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-1 min-w-0">
                    <div className="text-[10px] text-muted-foreground min-w-0">{sub}</div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View calculation logic"
                          aria-label="View calculation logic"
                          className="h-6 w-6 shrink-0 rounded-full p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                          <DialogTitle>{metricExplanations[label]?.title ?? label}</DialogTitle>
                          <DialogDescription>
                            Transparent calculation logic used by the current scenario.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="rounded-md border bg-muted/30 p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Formula</div>
                            <div className="text-sm font-mono leading-relaxed">{metricExplanations[label]?.formula}</div>
                          </div>
                          <div className="grid gap-2">
                            {(metricExplanations[label]?.rows ?? []).map((row) => (
                              <div key={row.label} className="flex items-center justify-between rounded-md border px-3 py-2">
                                <span className="text-xs text-muted-foreground">{row.label}</span>
                                <span className="text-xs font-mono font-semibold text-right">{row.value}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{metricExplanations[label]?.note}</p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* P&L summary strip */}
          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { label: "Total Revenue", value: fmt(totalRevenue) },
              { label: "Total Cost (COGS+OpEx)", value: fmt(calc.totalCost) },
              { label: "Total CapEx", value: fmt(calc.totalCapex) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
                <div className="text-sm font-bold font-mono">{value}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ② P&L Outputs */}
        <TabsContent value="pl" className="m-0">
          <SectionLabel num="2" label="Profitability Analysis" icon={BarChart2} />
          <p className="text-[10px] text-muted-foreground mb-3">Year-by-year P&amp;L stack derived from scenario inputs.</p>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-52 text-[11px]">Line Item</TableHead>
                  {cashFlows.map((cf: any) => (
                    <TableHead key={cf.year} className="text-right text-[11px]">Year {cf.year}</TableHead>
                  ))}
                  <TableHead className="text-right text-[11px] font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  {
                    label: "Revenue",
                    values: cashFlows.map((cf: any) => cf.revenue),
                    total: totalRevenue,
                    bold: false,
                    pct: null,
                  },
                  {
                    label: "COGS",
                    values: cashFlows.map((cf: any) => cf.revenue - cf.grossProfit),
                    total: totalCogs,
                    bold: false,
                    pct: null,
                    dim: true,
                  },
                  {
                    label: "Gross Profit",
                    values: cashFlows.map((cf: any) => cf.grossProfit),
                    total: totalGP,
                    bold: true,
                    pct: gpPct,
                  },
                  {
                    label: "EBITDA",
                    values: cashFlows.map((cf: any) => cf.ebitda),
                    total: totalEbitda,
                    bold: true,
                    pct: ebitdaPct,
                  },
                  {
                    label: "NOPAT (After Tax)",
                    values: cashFlows.map((cf: any) => cf.nopat),
                    total: totalNopat,
                    bold: true,
                    pct: nopatPct,
                  },
                  {
                    label: "Free Cash Flow",
                    values: cashFlows.map((cf: any) => cf.freeCashFlow),
                    total: totalFCF,
                    bold: true,
                    pct: null,
                    highlight: true,
                  },
                ].map(({ label, values, total, bold, pct, dim, highlight }) => (
                  <TableRow key={label} className={highlight ? "bg-primary/5" : dim ? "opacity-70" : ""}>
                    <TableCell className={`text-xs py-2 ${bold ? "font-semibold" : "font-medium text-muted-foreground"} ${highlight ? "text-primary" : ""}`}>
                      {label}
                      {pct != null && (
                        <span className="ml-2 text-[10px] text-muted-foreground font-normal">({pct.toFixed(1)}%)</span>
                      )}
                    </TableCell>
                    {values.map((v: number, i: number) => (
                      <TableCell key={i} className={`text-right text-xs font-mono py-2 ${v < 0 ? "text-red-500" : ""} ${highlight ? "text-primary font-semibold" : ""}`}>
                        {fmtK(v)}
                      </TableCell>
                    ))}
                    <TableCell className={`text-right text-xs font-mono py-2 font-bold ${total < 0 ? "text-red-500" : ""} ${highlight ? "text-primary" : ""}`}>
                      {fmtK(total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ③ Cash Flow Outputs */}
        <TabsContent value="cashflow" className="m-0 space-y-5">
          <SectionLabel num="3" label="Cash Flow &amp; Capital Return" icon={Activity} />

          {cashFlows.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">Annual Free Cash Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cashFlows}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `Y${v}`} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                          <RechartsTooltip formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Year ${l}`} />
                          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                          <Bar dataKey="freeCashFlow" name="Free Cash Flow" radius={[3, 3, 0, 0]} fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">Cumulative Cash Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cashFlows}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `Y${v}`} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                          <RechartsTooltip formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Year ${l}`} />
                          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                          <Area type="monotone" dataKey="cumulativeCashFlow" name="Cumulative FCF" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Year-by-year table */}
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-40 text-[11px]">Year</TableHead>
                      <TableHead className="text-right text-[11px]">Revenue</TableHead>
                      <TableHead className="text-right text-[11px]">Gross Profit</TableHead>
                      <TableHead className="text-right text-[11px]">EBITDA</TableHead>
                      <TableHead className="text-right text-[11px]">NOPAT</TableHead>
                      <TableHead className="text-right text-[11px]">Net FCF</TableHead>
                      <TableHead className="text-right text-[11px] pr-4">Cumulative FCF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashFlows.map((cf: any) => (
                      <TableRow key={cf.year}>
                        <TableCell className="text-xs font-semibold py-2">Year {cf.year}</TableCell>
                        <TableCell className="text-right text-xs font-mono py-2">{fmtK(cf.revenue)}</TableCell>
                        <TableCell className={`text-right text-xs font-mono py-2 ${cf.grossProfit < 0 ? "text-red-500" : ""}`}>{fmtK(cf.grossProfit)}</TableCell>
                        <TableCell className={`text-right text-xs font-mono py-2 ${cf.ebitda < 0 ? "text-red-500" : ""}`}>{fmtK(cf.ebitda)}</TableCell>
                        <TableCell className={`text-right text-xs font-mono py-2 ${cf.nopat < 0 ? "text-red-500" : ""}`}>{fmtK(cf.nopat)}</TableCell>
                        <TableCell className={`text-right text-xs font-mono py-2 font-semibold ${cf.freeCashFlow < 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>{fmtK(cf.freeCashFlow)}</TableCell>
                        <TableCell className={`text-right text-xs font-mono py-2 pr-4 ${cf.cumulativeCashFlow < 0 ? "text-amber-600" : "text-green-600 dark:text-green-400"}`}>{fmtK(cf.cumulativeCashFlow)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">No cash flow data yet.</div>
          )}
        </TabsContent>

        {/* ④ Risk / Management */}
        <TabsContent value="risk" className="m-0 space-y-5">
          <SectionLabel num="4" label="Risk &amp; Management Signals" icon={ShieldCheck} />
          <p className="text-[10px] text-muted-foreground mb-3">Automated flags for gate decisions and compliance review.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "NPV Positive",
                desc: `NPV = ${fmtM(calc.npv)}`,
                ok: calc.npv >= 0,
                flag: calc.npv < 0 ? "Negative NPV — project destroys value at current discount rate." : "NPV is positive. Project adds economic value.",
              },
              {
                label: "IRR vs Hurdle Rate",
                desc: calc.irr != null ? `IRR = ${fmtPct(calc.irr)}` : "IRR unavailable",
                ok: calc.irr != null && calc.irr > 0.08,
                warn: calc.irr != null && calc.irr > 0 && calc.irr <= 0.08,
                flag: calc.irr == null
                  ? "IRR could not be computed (check cash flow sign changes)."
                  : calc.irr > 0.08
                  ? "IRR exceeds typical 8% hurdle rate."
                  : "IRR is below the 8% hurdle. Requires senior approval.",
              },
              {
                label: "Payback ≤ Lifecycle",
                desc: calc.paybackPeriod != null ? `Payback = ${fmtPeriod(calc.paybackPeriod)}` : "Payback not reached",
                ok: calc.paybackPeriod != null,
                flag: calc.paybackPeriod == null
                  ? "Project does not recover investment within the modeled lifecycle."
                  : `Investment recovered in ${fmtPeriod(calc.paybackPeriod)}.`,
              },
              {
                label: "Profitability Index ≥ 1",
                desc: pi != null ? `PI = ${pi.toFixed(2)}` : "PI unavailable",
                ok: pi != null && pi >= 1,
                flag: pi == null
                  ? "PI cannot be calculated (CapEx = 0)."
                  : pi >= 1
                  ? `PI of ${pi.toFixed(2)} indicates value creation per dollar invested.`
                  : `PI of ${pi.toFixed(2)} is below 1.0. Project may not meet capital efficiency threshold.`,
              },
              {
                label: "Gross Profit Positive",
                desc: `Total GP = ${fmtK(totalGP)}`,
                ok: totalGP >= 0,
                flag: totalGP < 0
                  ? "Total gross profit is negative. COGS exceeds revenue — review pricing or unit economics."
                  : "Gross profit is positive across the lifecycle.",
              },
              {
                label: "EBITDA Margin ≥ 10%",
                desc: ebitdaPct != null ? `EBITDA margin = ${ebitdaPct.toFixed(1)}%` : "—",
                ok: ebitdaPct != null && ebitdaPct >= 10,
                warn: ebitdaPct != null && ebitdaPct >= 0 && ebitdaPct < 10,
                flag: ebitdaPct == null
                  ? "Cannot calculate EBITDA margin."
                  : ebitdaPct >= 10
                  ? `EBITDA margin of ${ebitdaPct.toFixed(1)}% meets the 10% threshold.`
                  : ebitdaPct >= 0
                  ? `EBITDA margin of ${ebitdaPct.toFixed(1)}% is below the 10% target. Monitor closely.`
                  : "Negative EBITDA margin. OpEx and COGS exceed revenue.",
              },
            ].map(({ label, desc, ok, warn, flag }) => {
              const Icon = ok ? CheckCircle : warn ? AlertTriangle : XCircle;
              const color = ok ? "text-green-600 dark:text-green-400" : warn ? "text-amber-500" : "text-red-500";
              const bg = ok ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : warn ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
              return (
                <div key={label} className={`rounded-md border p-3 ${bg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                    <span className={`text-xs font-semibold ${color}`}>{label}</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">{desc}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug pl-6">{flag}</p>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id?.replace(/\D/g, "") ?? "0");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: project, isLoading: projLoading, refetch: refetchProject } = useGetProject(projectId);
  const { data: scenarios, isLoading: scenLoading, refetch: refetchScenarios } = useListScenarios(projectId);
  const { data: auditLog } = useGetProjectAuditLog(projectId);
  const updateProject = useUpdateProject();
  const createScenario = useCreateScenario();
  const duplicateScenario = useDuplicateScenario();

  const [activeScenarioId, setActiveScenarioId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"inputs" | "results">("results");
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [showNewScenario, setShowNewScenario] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState("");

  const activeScenario = scenarios?.find((s) => s.id === activeScenarioId) ?? scenarios?.[0] ?? null;
  const displayScenarioId = activeScenarioId ?? activeScenario?.id ?? null;

  const handleStatusChange = () => {
    if (!newStatus) return;
    updateProject.mutate(
      { id: projectId, data: { status: newStatus as any } },
      {
        onSuccess: () => {
          toast({ title: "Status updated" });
          setEditingStatus(false);
          refetchProject();
        },
        onError: () => toast({ title: "Error", description: "Failed to update status", variant: "destructive" }),
      }
    );
  };

  const handleAddScenario = () => {
    if (!newScenarioName.trim()) return;
    createScenario.mutate(
      { id: projectId, data: { name: newScenarioName, lifecycleYears: 5, isBaseline: false } },
      {
        onSuccess: (newScen) => {
          toast({ title: "Scenario created" });
          setNewScenarioName("");
          setShowNewScenario(false);
          if (newScen?.id) setActiveScenarioId(newScen.id);
          refetchScenarios();
          qc.invalidateQueries({ queryKey: ["scenarios", projectId] });
        },
        onError: () => toast({ title: "Error", description: "Failed to create scenario", variant: "destructive" }),
      }
    );
  };

  const handleDuplicate = (scenId: number, name: string) => {
    duplicateScenario.mutate(
      { id: scenId, data: { name: `${name} (copy)` } },
      {
        onSuccess: (s) => {
          toast({ title: "Scenario duplicated" });
          if (s?.id) setActiveScenarioId(s.id);
          refetchScenarios();
          qc.invalidateQueries({ queryKey: ["scenarios", projectId] });
        },
        onError: () => toast({ title: "Error", description: "Failed to duplicate", variant: "destructive" }),
      }
    );
  };

  if (projLoading) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Project not found (ID: {projectId}).</p>
        <Link href="/projects" className="text-primary underline mt-2 inline-block">Back to Projects</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <Link href="/projects" className="inline-flex items-center justify-center rounded-md h-9 w-9 hover:bg-accent transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight truncate">{project.name}</h1>
            <Badge variant={STATUS_COLORS[project.status] as any} className="uppercase text-[10px]">
              {project.status}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            <span className="font-mono">PRJ-{project.id}</span>
            <span>Region: <strong>{project.region}</strong></span>
            {project.productCategory && <span>Category: <strong>{project.productCategory}</strong></span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/reports/${project.id}`} className="inline-flex">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <FileText className="w-3.5 h-3.5" /> ROI Report
            </Button>
          </Link>
          {editingStatus ? (
            <>
              <Select onValueChange={(v) => setNewStatus(v)} defaultValue={project.status}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-xs" onClick={handleStatusChange} disabled={updateProject.isPending}>Save</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditingStatus(false)}>Cancel</Button>
            </>
          ) : (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setEditingStatus(true); setNewStatus(project.status); }}>
              Change Status
            </Button>
          )}
        </div>
      </div>

      {/* Sales Regions */}
      <SalesRegionsCard projectId={projectId} />

      {/* Scenario bar + main content */}
      <Card>
        {/* Scenario switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-1">Scenario</span>
            {scenLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              scenarios?.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveScenarioId(s.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors border ${
                    displayScenarioId === s.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {s.name}
                </button>
              ))
            )}
          </div>
          <div className="flex gap-2">
            {activeScenario && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleDuplicate(activeScenario.id, activeScenario.name)} disabled={duplicateScenario.isPending}>
                <Copy className="w-3 h-3" /> Duplicate
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowNewScenario(true)}>
              <PlusCircle className="w-3 h-3" /> New Scenario
            </Button>
          </div>
        </div>

        {showNewScenario && (
          <div className="px-4 py-2 border-b flex items-center gap-2 bg-muted/20">
            <Input
              autoFocus
              className="h-7 w-52 text-xs"
              placeholder="Scenario name…"
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddScenario()}
            />
            <Button size="sm" className="h-7 text-xs" onClick={handleAddScenario} disabled={createScenario.isPending}>
              {createScenario.isPending ? "Creating..." : "Create"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowNewScenario(false)}>Cancel</Button>
          </div>
        )}

        {displayScenarioId != null ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <div className="px-4 pt-3 border-b">
              <TabsList className="h-8">
                <TabsTrigger value="results" className="text-xs gap-1.5">
                  <BarChart2 className="w-3 h-3" /> Results
                </TabsTrigger>
                <TabsTrigger value="inputs" className="text-xs gap-1.5">
                  <Layers className="w-3 h-3" /> Inputs
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="results" className="m-0">
              {activeScenario ? <CalcResults scenario={activeScenario} /> : (
                <div className="py-10 text-center text-muted-foreground text-sm">Select a scenario to view results.</div>
              )}
            </TabsContent>

            <TabsContent value="inputs" className="m-0">
              <FinancialInputsEditor
                scenarioId={displayScenarioId}
                project={project}
                onCalcDone={() => {
                  setActiveTab("results");
                  refetchScenarios();
                  qc.invalidateQueries({ queryKey: ["scenarios", projectId] });
                }}
              />
            </TabsContent>
          </Tabs>
        ) : !scenLoading && (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-sm">No scenarios yet.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowNewScenario(true)}>
              <PlusCircle className="w-4 h-4 mr-1" /> Create First Scenario
            </Button>
          </div>
        )}
      </Card>

      {/* Scenario comparison */}
      {scenarios && scenarios.length > 1 && (
        <Card>
          <CardHeader className="pb-0 px-4 pt-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Scenario Comparison</CardTitle>
            <CardDescription className="text-[10px]">Side-by-side metrics across all scenarios</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 text-[11px]">Scenario</TableHead>
                  <TableHead className="text-right text-[11px]">NPV</TableHead>
                  <TableHead className="text-right text-[11px]">IRR</TableHead>
                  <TableHead className="text-right text-[11px]">Payback</TableHead>
                  <TableHead className="text-right text-[11px]">ROI</TableHead>
                  <TableHead className="text-right pr-6 text-[11px]">PI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.map((s) => {
                  const c = s.calculation;
                  let cfs: any[] = [];
                  try { if (c?.cashFlows) cfs = typeof c.cashFlows === "string" ? JSON.parse(c.cashFlows) : c.cashFlows; } catch { /* ignore */ }
                  const scenCapex = c?.totalCapex ?? 0;
                  const scenPi = c && scenCapex > 0 ? (c.npv + scenCapex) / scenCapex : null;
                  return (
                    <TableRow
                      key={s.id}
                      className={`cursor-pointer transition-colors ${s.id === displayScenarioId ? "bg-muted/40" : "hover:bg-muted/20"}`}
                      onClick={() => setActiveScenarioId(s.id)}
                    >
                      <TableCell className="pl-6 py-2">
                        <div className="text-xs font-medium">{s.name}</div>
                        {s.isBaseline && <span className="text-[9px] text-muted-foreground uppercase">Baseline</span>}
                      </TableCell>
                      <TableCell className={`text-right text-xs font-mono py-2 ${c && c.npv >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                        {c ? fmtM(c.npv) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono py-2">{c ? fmtPct(c.irr) : "—"}</TableCell>
                      <TableCell className="text-right text-xs font-mono py-2">{c ? fmtPeriod(c.paybackPeriod) : "—"}</TableCell>
                      <TableCell className="text-right text-xs font-mono py-2">
                        {c && c.roiPercent != null ? `${c.roiPercent.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className={`text-right pr-6 text-xs font-mono py-2 ${scenPi != null && scenPi < 1 ? "text-red-500" : ""}`}>
                        {scenPi != null ? scenPi.toFixed(2) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      {auditLog && auditLog.length > 0 && (
        <Card>
          <CardHeader className="pb-0 px-4 pt-4 flex flex-row items-center gap-2">
            <History className="w-3.5 h-3.5 text-muted-foreground" />
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Audit Trail</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 text-[11px]">Field</TableHead>
                  <TableHead className="text-[11px]">Changed By</TableHead>
                  <TableHead className="text-[11px]">Old Value</TableHead>
                  <TableHead className="text-[11px]">New Value</TableHead>
                  <TableHead className="pr-6 text-right text-[11px]">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.slice(0, 15).map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="pl-6 text-xs font-mono py-2">{log.fieldName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground py-2">{log.changedBy}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground max-w-[150px] truncate py-2">{log.oldValue ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono max-w-[150px] truncate py-2">{log.newValue ?? "—"}</TableCell>
                    <TableCell className="pr-6 text-right text-[10px] text-muted-foreground py-2">
                      {new Date(log.changedAt).toLocaleString("en-HK", { timeZone: "Asia/Hong_Kong" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
