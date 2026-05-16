import { useState, useEffect } from "react";
import { Link } from "wouter";
// Added useDeleteProject to imports
import { useListProjects, useDeleteProject } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // Import Button
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FolderOpen, Trash2, Loader2 } from "lucide-react"; // Import icons
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query"; // Import to refresh list

// --- Type Definitions ---
interface ProjectQueryParams {
  search?: string;
  status?: string;
  region?: string;
}

const formatCurrency = (val: number | null | undefined) => {
  if (val == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
};

const TableSkeleton = () => (
  <div className="p-0">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center space-x-4 p-4 border-b">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-[80px]" />
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-4 w-[120px] ml-auto" />
      </div>
    ))}
  </div>
);

export default function Projects() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("_all");
  const [regionFilter, setRegionFilter] = useState<string>("_all");

  // Hook for deletion
  const deleteProject = useDeleteProject();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams: ProjectQueryParams = {};
  if (debouncedSearch.trim()) queryParams.search = debouncedSearch.trim();
  if (statusFilter !== "_all") queryParams.status = statusFilter;
  if (regionFilter !== "_all") queryParams.region = regionFilter;

  const { data: projects, isLoading } = useListProjects(queryParams);

  // Handle Delete Function
  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      try {
        await deleteProject.mutateAsync({ id });
        // Refresh the list after successful deletion
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      } catch (error) {
        console.error("Failed to delete project", error);
        alert("Error deleting project. Please try again.");
      }
    }
  };

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects Registry</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Systematic management and evaluation of capital allocation requests.
          </p>
        </div>
        <Link 
          href="/projects/new" 
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2 shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      <Card className="overflow-hidden border-muted/40 shadow-sm">
        <div className="p-4 border-b flex flex-col md:flex-row gap-3 bg-muted/5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input 
              placeholder="Search project name or ID..." 
              className="pl-9 bg-background focus-visible:ring-primary/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="review">Reviewing</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Regions</SelectItem>
                <SelectItem value="NA">North America (NA)</SelectItem>
                <SelectItem value="EU">Europe (EU)</SelectItem>
                <SelectItem value="APAC">Asia-Pacific (APAC)</SelectItem>
                <SelectItem value="LATAM">Latin America (LATAM)</SelectItem>
                <SelectItem value="MEA">Middle East & Africa (MEA)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]"> {/* Increased min-width for extra column */}
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="pl-6 w-[120px]">Project ID</TableHead>
                    <TableHead className="min-w-[200px]">Project Name</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Investment</TableHead>
                    <TableHead className="text-right">Created Date</TableHead>
                    <TableHead className="text-center w-[80px]">Actions</TableHead> {/* New Header */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects && projects.length > 0 ? (
                    projects.map((project) => (
                      <TableRow key={project.id} className="group hover:bg-muted/30 transition-colors">
                        <TableCell className="pl-6 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          PRJ-{project.id}
                        </TableCell>
                        <TableCell className="font-medium max-w-[300px]">
                          <div className="truncate">
                            <Link href={`/projects/${project.id}`} className="hover:underline text-primary decoration-primary/30 underline-offset-4">
                              {project.name}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className="font-normal border-muted-foreground/20">
                            {project.region}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={project.status === 'approved' ? 'default' : 'secondary'} 
                            className={`uppercase text-[10px] px-1.5 py-0 whitespace-nowrap ${
                              project.status === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600' : ''
                            }`}
                          >
                            {project.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold text-slate-700 whitespace-nowrap">
                          {formatCurrency(project.investmentSize)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(project.createdAt).toLocaleDateString("en-HK", { timeZone: "Asia/Hong_Kong" })}
                        </TableCell>
                        <TableCell className="text-center pr-4"> {/* Delete Action Cell */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => handleDelete(project.id)}
                            disabled={deleteProject.isPending}
                          >
                            {deleteProject.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-20">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <FolderOpen className="h-10 w-10 mb-2 opacity-20" />
                          <p>No projects found matching the criteria.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}