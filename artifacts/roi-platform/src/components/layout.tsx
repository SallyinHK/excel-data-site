import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  BarChart3, 
  FolderOpen, 
  Globe, 
  Calculator,
  Briefcase,
  Zap,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: BarChart3 },
    { href: "/projects", label: "Projects", icon: Briefcase },
    { href: "/simulator", label: "Simulator", icon: Zap },
    { href: "/user-guide", label: "User Guide", icon: FileText },
  ];

  const adminItems = [
    { href: "/admin/formulas", label: "Formulas", icon: Calculator },
    { href: "/admin/regions", label: "Regions", icon: Globe },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background font-sans">
      <aside className="w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col hidden md:flex">
        <div className="p-4 border-b border-sidebar-border flex items-center gap-2">
          <div className="bg-primary text-primary-foreground p-1 rounded">
            <FolderOpen className="w-5 h-5" />
          </div>
          <span className="font-semibold text-sm tracking-tight uppercase">ROI PLATFORM</span>
        </div>
        
        <div className="flex-1 overflow-auto py-4">
          <div className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 tracking-wider">OVERVIEW</div>
          <nav className="space-y-1 px-2">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 mt-8 mb-2 text-xs font-semibold text-sidebar-foreground/50 tracking-wider">GOVERNANCE</div>
          <nav className="space-y-1 px-2">
            {adminItems.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-foreground/40">
          Enterprise ROI v1.0
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center px-6 bg-card text-sm">
          <div className="flex-1"></div>
          <div className="flex items-center gap-4">
            <div className="text-muted-foreground flex items-center gap-2 border-r pr-4">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              System Normal
            </div>
            <div className="font-medium text-foreground flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                JD
              </div>
              John Doe
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-muted/20">
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
