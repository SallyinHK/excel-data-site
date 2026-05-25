import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateProject,
  useAddProjectSalesRegion,
  useListRegionalParameters,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Globe, Check } from "lucide-react";
import { Link } from "wouter";

const formSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  productCategory: z.string().optional(),
  investmentSize: z.coerce.number().min(0).optional(),
});

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createProject = useCreateProject();
  const addSalesRegion = useAddProjectSalesRegion();
  const { data: regionalParams, isLoading: regionsLoading } = useListRegionalParameters();

  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [regionError, setRegionError] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      productCategory: "",
      investmentSize: 0,
    },
  });

  const toggleRegion = (region: string) => {
    setRegionError("");
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (selectedRegions.length === 0) {
      setRegionError("Please select at least one region.");
      return;
    }

    const primaryRegion = selectedRegions[0];
    const additionalRegions = selectedRegions.slice(1);

    createProject.mutate(
      {
        data: {
          ...values,
          region: primaryRegion,
          createdBy: "System User",
        },
      },
      {
        onSuccess: async (data) => {
          if (additionalRegions.length > 0) {
            await Promise.allSettled(
              additionalRegions.map((r) =>
                addSalesRegion.mutateAsync({
                  id: data.id,
                  data: { region: r, fxMultiplier: 1 },
                })
              )
            );
          }
          toast({
            title: "Project created",
            description: `Initialized with ${selectedRegions.length} region${selectedRegions.length > 1 ? "s" : ""}.`,
          });
          setLocation(`/projects/${data.id}`);
        },
        onError: (error: any) => {
          const message =
            error?.response?.data?.error ||
            error?.data?.error ||
            error?.message ||
            "Failed to create project";

          toast({
            title: "Error",
            description: message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const availableRegions = (regionalParams ?? []).map((r) => r.region);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/projects" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 w-10">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Initialize Project</h1>
          <p className="text-muted-foreground mt-1">Create a new capital allocation request.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>Basic information to establish the investment thesis.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. EU Manufacturing Facility Expansion" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Multi-select Regions */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">Sales Regions</span>
                  <span className="text-[11px] text-muted-foreground">— select one or more; first selected = primary region</span>
                </div>

                {regionsLoading ? (
                  <div className="flex gap-2 flex-wrap">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 p-3 rounded-md border border-input bg-background">
                    {availableRegions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-1">
                        No regions configured. Add regions in <Link href="/admin/regions" className="text-primary underline">Governance → Regions</Link> first.
                      </p>
                    ) : (
                      availableRegions.map((region, idx) => {
                        const selIdx = selectedRegions.indexOf(region);
                        const isSelected = selIdx !== -1;
                        const isPrimary = selIdx === 0;
                        return (
                          <button
                            key={region}
                            type="button"
                            onClick={() => toggleRegion(region)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              isPrimary
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : isSelected
                                ? "bg-primary/15 text-primary border-primary/40"
                                : "bg-muted/40 text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            {region}
                            {isPrimary && <span className="text-[9px] opacity-75 font-bold ml-0.5">PRIMARY</span>}
                            {isSelected && !isPrimary && (
                              <span className="text-[9px] opacity-75 font-bold ml-0.5">+SALES</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {selectedRegions.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{selectedRegions[0]}</span> is the primary region
                    {selectedRegions.length > 1 && (
                      <>; {selectedRegions.slice(1).join(", ")} will be added as additional sales regions</>
                    )}.
                  </p>
                )}

                {regionError && (
                  <p className="text-[12px] font-medium text-destructive">{regionError}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="investmentSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Investment (USD)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="productCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Category</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Hardware, Software, Services" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strategic Rationale</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Briefly describe the business case and expected outcomes..."
                        className="resize-none h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={createProject.isPending || addSalesRegion.isPending}>
                  {createProject.isPending || addSalesRegion.isPending ? "Creating..." : "Initialize Project"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
