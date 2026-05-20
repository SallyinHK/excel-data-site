import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import NewProject from "@/pages/projects/new";
import ProjectDetail from "@/pages/projects/detail";
import Formulas from "@/pages/admin/formulas";
import Regions from "@/pages/admin/regions";
import Simulator from "@/pages/simulator";
import UserGuide from "@/pages/user-guide";
import OnboardingGuide from "@/components/onboarding-guide";
import ReportPage from "@/pages/reports/project";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/new" component={NewProject} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/simulator" component={Simulator} />
        <Route path="/user-guide" component={UserGuide} />
        <Route path="/reports/:id" component={ReportPage} />
        <Route path="/admin/formulas" component={Formulas} />
        <Route path="/admin/regions" component={Regions} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
              <OnboardingGuide />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
