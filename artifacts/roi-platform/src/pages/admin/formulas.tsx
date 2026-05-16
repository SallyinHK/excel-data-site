import { useState } from "react";
import { useListFormulaDefinitions, useUpdateFormulaDefinition } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Lock, Unlock, Calculator, Shield, History } from "lucide-react";

const formatPct = (val: number) => `${(val * 100).toFixed(2)}%`;

export default function Formulas() {
  const { data: formulas, isLoading, refetch } = useListFormulaDefinitions();
  const updateFormula = useUpdateFormulaDefinition();
  const { toast } = useToast();

  const [editId, setEditId] = useState<number | null>(null);
  const [editWacc, setEditWacc] = useState("");
  const [editDiscount, setEditDiscount] = useState("");

  const activeFormula = formulas?.[0];

  const handleEdit = (f: NonNullable<typeof activeFormula>) => {
    setEditId(f.id);
    setEditWacc(String((f.wacc * 100).toFixed(2)));
    setEditDiscount(String((f.discountRate * 100).toFixed(2)));
  };

  const handleSave = () => {
    if (editId == null) return;
    updateFormula.mutate(
      {
        id: editId,
        data: {
          wacc: parseFloat(editWacc) / 100,
          discountRate: parseFloat(editDiscount) / 100,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Formula updated", description: "WACC and discount rate saved. All future calculations will use the new rates." });
          setEditId(null);
          refetch();
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update formula", variant: "destructive" });
        },
      }
    );
  };

  const handleToggleLock = (f: NonNullable<typeof activeFormula>) => {
    updateFormula.mutate(
      { id: f.id, data: { locked: !f.locked } },
      {
        onSuccess: () => {
          toast({
            title: f.locked ? "Formula unlocked" : "Formula locked",
            description: f.locked
              ? "Formula parameters can now be edited."
              : "Formula is now governance-locked. Only admins can unlock.",
          });
          refetch();
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to toggle lock", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Formula Governance</h1>
        <p className="text-muted-foreground mt-1">
          Manage WACC, discount rates, and DCF parameters. Locked formulas require admin override.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Active WACC</CardTitle>
            <Calculator className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {isLoading ? <Skeleton className="h-7 w-16" /> : formatPct(activeFormula?.wacc ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Weighted Average Cost of Capital</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Discount Rate</CardTitle>
            <Calculator className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {isLoading ? <Skeleton className="h-7 w-16" /> : formatPct(activeFormula?.discountRate ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">NPV discount rate applied to cash flows</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Governance Status</CardTitle>
            <Shield className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mt-1">
              {isLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : activeFormula?.locked ? (
                <Badge variant="destructive" className="text-xs gap-1">
                  <Lock className="w-3 h-3" /> LOCKED
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Unlock className="w-3 h-3" /> UNLOCKED
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Admin-controlled formula lock</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : activeFormula && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{activeFormula.formulaType}</CardTitle>
                <CardDescription>Version {activeFormula.version} · Last updated by {activeFormula.updatedBy ?? "system"}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {editId !== activeFormula.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(activeFormula)}
                    disabled={activeFormula.locked}
                  >
                    Edit Parameters
                  </Button>
                )}
                <Button
                  variant={activeFormula.locked ? "destructive" : "secondary"}
                  size="sm"
                  onClick={() => handleToggleLock(activeFormula)}
                >
                  {activeFormula.locked ? (
                    <><Unlock className="w-3 h-3 mr-1" /> Unlock</>
                  ) : (
                    <><Lock className="w-3 h-3 mr-1" /> Lock</>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {editId === activeFormula.id ? (
              <div className="space-y-4 max-w-md">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>WACC (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editWacc}
                      onChange={(e) => setEditWacc(e.target.value)}
                      placeholder="8.50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Discount Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editDiscount}
                      onChange={(e) => setEditDiscount(e.target.value)}
                      placeholder="8.50"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={updateFormula.isPending}>
                    {updateFormula.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded p-2">
                  Warning: Changing these parameters will affect all future ROI calculations. Existing results are not retroactively updated.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted/40 rounded p-3">
                    <div className="text-xs text-muted-foreground">WACC</div>
                    <div className="text-xl font-bold font-mono">{formatPct(activeFormula.wacc)}</div>
                  </div>
                  <div className="bg-muted/40 rounded p-3">
                    <div className="text-xs text-muted-foreground">Discount Rate</div>
                    <div className="text-xl font-bold font-mono">{formatPct(activeFormula.discountRate)}</div>
                  </div>
                  {activeFormula.parametersJson && (
                    <>
                      {Object.entries(JSON.parse(activeFormula.parametersJson) as Record<string, unknown>).map(([k, v]) => (
                        <div key={k} className="bg-muted/40 rounded p-3">
                          <div className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</div>
                          <div className="text-sm font-mono font-medium">
                            {typeof v === "number" ? formatPct(v) : String(v)}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <CardTitle>Version History</CardTitle>
          </div>
          <CardDescription>All formula versions in this system</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Formula Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>WACC</TableHead>
                <TableHead>Discount Rate</TableHead>
                <TableHead>Updated By</TableHead>
                <TableHead className="pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Skeleton className="h-6 w-48 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : formulas?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No formula definitions found.
                  </TableCell>
                </TableRow>
              ) : formulas?.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="pl-6 font-medium">{f.formulaType}</TableCell>
                  <TableCell className="font-mono text-sm">v{f.version}</TableCell>
                  <TableCell className="font-mono text-sm">{formatPct(f.wacc)}</TableCell>
                  <TableCell className="font-mono text-sm">{formatPct(f.discountRate)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.updatedBy ?? "system"}</TableCell>
                  <TableCell className="pr-6">
                    {f.locked ? (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <Lock className="w-2.5 h-2.5" /> LOCKED
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">ACTIVE</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
