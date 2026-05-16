import { useState } from "react";
import { useListRegionalParameters, useUpdateRegionalParameter, useCreateRegionalParameter } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Globe, Plus, Pencil, Check, X } from "lucide-react";

const REGION_FLAGS: Record<string, string> = {
  NA: "🇺🇸",
  EU: "🇪🇺",
  APAC: "🌏",
  LATAM: "🌎",
  MEA: "🌍",
};

type RegionRow = {
  id: number;
  region: string;
  taxRate: number;
  currency: string;
  exchangeRateToUsd: number;
  effectiveDate: string;
};

export default function Regions() {
  const { data: params, isLoading, refetch } = useListRegionalParameters();
  const updateParam = useUpdateRegionalParameter();
  const createParam = useCreateRegionalParameter();
  const { toast } = useToast();

  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<RegionRow>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newData, setNewData] = useState({ region: "", taxRate: "", currency: "", exchangeRateToUsd: "", effectiveDate: "2026-01-01" });

  const handleEdit = (p: RegionRow) => {
    setEditId(p.id);
    setEditData({ taxRate: p.taxRate, currency: p.currency, exchangeRateToUsd: p.exchangeRateToUsd, effectiveDate: p.effectiveDate });
  };

  const handleSave = (id: number) => {
    updateParam.mutate(
      {
        id,
        data: {
          taxRate: typeof editData.taxRate === "string" ? parseFloat(editData.taxRate as unknown as string) / 100 : (editData.taxRate ?? 0) / 100,
          currency: editData.currency,
          exchangeRateToUsd: typeof editData.exchangeRateToUsd === "string" ? parseFloat(editData.exchangeRateToUsd as unknown as string) : editData.exchangeRateToUsd,
          effectiveDate: editData.effectiveDate,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Region updated", description: "Tax rate and FX parameters saved." });
          setEditId(null);
          refetch();
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update region", variant: "destructive" });
        },
      }
    );
  };

  const handleAdd = () => {
    createParam.mutate(
      {
        data: {
          region: newData.region,
          taxRate: parseFloat(newData.taxRate) / 100,
          currency: newData.currency,
          exchangeRateToUsd: parseFloat(newData.exchangeRateToUsd),
          effectiveDate: newData.effectiveDate,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Region added", description: `${newData.region} parameters created.` });
          setShowAdd(false);
          setNewData({ region: "", taxRate: "", currency: "", exchangeRateToUsd: "", effectiveDate: "2026-01-01" });
          refetch();
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create region", variant: "destructive" });
        },
      }
    );
  };

  const formatPct = (val: number) => `${(val * 100).toFixed(2)}%`;
  const formatFx = (val: number) => val === 1 ? "1.0000 (base)" : val.toFixed(4);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Regional Parameters</h1>
          <p className="text-muted-foreground mt-1">
            Configure tax rates, currencies, and FX rates for each geography.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Region
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))
          : params?.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="text-2xl">{REGION_FLAGS[p.region] ?? "🌐"}</div>
                  <div className="font-semibold text-sm mt-1">{p.region}</div>
                  <div className="text-xl font-bold font-mono mt-1 text-primary">{formatPct(p.taxRate)}</div>
                  <div className="text-xs text-muted-foreground">Corporate Tax Rate</div>
                  <Badge variant="outline" className="mt-2 text-[10px] font-mono">{p.currency}</Badge>
                </CardContent>
              </Card>
            ))}
      </div>

      {showAdd && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Add New Region</CardTitle>
            <CardDescription>Enter tax and FX parameters for the new region.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <Label>Region Code</Label>
                <Input placeholder="e.g. SA" value={newData.region} onChange={(e) => setNewData({ ...newData, region: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1">
                <Label>Tax Rate (%)</Label>
                <Input type="number" placeholder="25.00" value={newData.taxRate} onChange={(e) => setNewData({ ...newData, taxRate: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Input placeholder="USD" value={newData.currency} onChange={(e) => setNewData({ ...newData, currency: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1">
                <Label>FX Rate to USD</Label>
                <Input type="number" step="0.0001" placeholder="1.0000" value={newData.exchangeRateToUsd} onChange={(e) => setNewData({ ...newData, exchangeRateToUsd: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Effective Date</Label>
                <Input type="date" value={newData.effectiveDate} onChange={(e) => setNewData({ ...newData, effectiveDate: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={handleAdd} disabled={createParam.isPending}>
                {createParam.isPending ? "Adding..." : "Add Region"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <CardTitle>Parameter Table</CardTitle>
          </div>
          <CardDescription>Effective date governs when rates apply to new scenarios</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Region</TableHead>
                <TableHead>Tax Rate</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>FX to USD</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : params?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No regions configured.</TableCell>
                </TableRow>
              ) : params?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{REGION_FLAGS[p.region] ?? "🌐"}</span>
                      <span className="font-semibold">{p.region}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {editId === p.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24 h-8 text-sm"
                        value={typeof editData.taxRate === "number" ? (editData.taxRate * 100).toFixed(2) : editData.taxRate as unknown as string}
                        onChange={(e) => setEditData({ ...editData, taxRate: parseFloat(e.target.value) / 100 })}
                      />
                    ) : (
                      <span className="font-mono text-sm">{formatPct(p.taxRate)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editId === p.id ? (
                      <Input className="w-20 h-8 text-sm" value={editData.currency ?? ""} onChange={(e) => setEditData({ ...editData, currency: e.target.value.toUpperCase() })} />
                    ) : (
                      <Badge variant="outline" className="font-mono text-[10px]">{p.currency}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editId === p.id ? (
                      <Input type="number" step="0.0001" className="w-28 h-8 text-sm" value={editData.exchangeRateToUsd ?? ""} onChange={(e) => setEditData({ ...editData, exchangeRateToUsd: parseFloat(e.target.value) })} />
                    ) : (
                      <span className="font-mono text-sm">{formatFx(p.exchangeRateToUsd)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editId === p.id ? (
                      <Input type="date" className="w-36 h-8 text-sm" value={editData.effectiveDate ?? ""} onChange={(e) => setEditData({ ...editData, effectiveDate: e.target.value })} />
                    ) : (
                      <span className="text-sm text-muted-foreground">{p.effectiveDate}</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    {editId === p.id ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSave(p.id)} disabled={updateParam.isPending}>
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                          <X className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(p as RegionRow)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
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
