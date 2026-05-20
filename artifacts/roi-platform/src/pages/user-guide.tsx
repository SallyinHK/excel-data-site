import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, BarChart3, Globe2, ShieldCheck, LineChart, ClipboardCheck } from "lucide-react";

const scenarios = [
  {
    title: "1. New Business Case Validation",
    users: "Product Manager, Finance BP, BU Leadership",
    objective: "Validate whether a new product initiative is financially viable before approval.",
    example: "A new headphone project with MAP $99, expected volume of 5,000,000 units, and FOB cost of $20.",
    focus: "CM% vs target, positive NPV, PI above 1, and assumption realism.",
    output: "Approve, conditional approval, or reject.",
    icon: ClipboardCheck,
  },
  {
    title: "2. Scenario & Sensitivity Analysis",
    users: "Finance BP, Product Manager",
    objective: "Evaluate how sensitive ROI results are to price, volume, and cost assumptions.",
    example: "Compare Base, Upside, and Downside scenarios to assess NPV stability.",
    focus: "NPV sensitivity, PI variation, and payback changes.",
    output: "Identify risk exposure and robustness of the business case.",
    icon: LineChart,
  },
  {
    title: "3. Cross-Region Profitability Comparison",
    users: "Sales, Finance BP, BU Management",
    objective: "Compare profitability across regions and identify weak markets.",
    example: "US CM% at 50%, EMEA 20%, APAC 40% due to lower pricing.",
    focus: "CM% differences, pricing gaps, and cost structure differences.",
    output: "Adjust regional pricing, volume, or strategy.",
    icon: Globe2,
  },
  {
    title: "4. Investment Prioritization",
    users: "BU Head, Finance Director, VP/CFO",
    objective: "Prioritize projects when investment resources are limited.",
    example: "Compare projects A, B, and C using NPV, PI, and payback period.",
    focus: "Value creation, capital efficiency, and payback risk.",
    output: "Portfolio selection and capital allocation.",
    icon: BarChart3,
  },
  {
    title: "5. Business Case Challenge",
    users: "Finance BP, GPLM, Sales",
    objective: "Validate and challenge overly optimistic assumptions.",
    example: "Sales assumes high volume and pricing, while the downside scenario shows NPV turning negative.",
    focus: "Break-even point, margin sustainability, and downside risk.",
    output: "Revise assumptions or escalate risks.",
    icon: ShieldCheck,
  },
  {
    title: "6. Post-Launch Performance Tracking",
    users: "Finance BP, Product Manager",
    objective: "Compare actual performance with the original business case after launch.",
    example: "Actual volume is lower and cost is higher than planned, reducing NPV.",
    focus: "Forecast deviation and updated ROI metrics.",
    output: "Adjust pricing, cost, or lifecycle strategy.",
    icon: CheckCircle2,
  },
];

const metrics = ["CM%", "Contribution Margin", "NPV", "PI", "Payback Period", "Price vs Cost", "Volume Assumptions", "Regional Variance"];

export default function UserGuide() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge variant="outline" className="w-fit">Full Version User Guide</Badge>
        <h1 className="text-2xl font-bold tracking-tight">ROI Analysis Tool</h1>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          This tool supports data-driven investment decisions for new product initiatives. It standardizes financial evaluation across regions and helps teams discuss profitability, value creation, and risk using CM%, NPV, PI, and payback period.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">When to Use the Tool</CardTitle>
          <CardDescription>Six practical use cases are covered in the platform workflow.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon;
            return (
              <div key={scenario.title} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold leading-snug">{scenario.title}</h2>
                    <p className="text-[11px] text-muted-foreground mt-1">Primary users: {scenario.users}</p>
                  </div>
                </div>
                <div className="space-y-2 text-xs leading-relaxed">
                  <p><span className="font-semibold">Objective:</span> {scenario.objective}</p>
                  <p><span className="font-semibold">Example:</span> {scenario.example}</p>
                  <p><span className="font-semibold">Focus areas:</span> {scenario.focus}</p>
                  <p><span className="font-semibold">Decision output:</span> {scenario.output}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key Decision Metrics</CardTitle>
            <CardDescription>Metrics used in project validation, comparison, and post-launch review.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {metrics.map((metric) => (
              <Badge key={metric} variant="secondary" className="px-2 py-1">{metric}</Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Best Practices</CardTitle>
            <CardDescription>Use the tool as a decision discussion platform across teams.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Always validate key assumptions including price, volume, and cost.</p>
            <p>Use Base, Upside, and Downside scenarios rather than relying on one forecast.</p>
            <p>Focus on margin quality and value creation instead of volume scale alone.</p>
            <p>Track actual performance after launch and update pricing, cost, or lifecycle strategy when deviations appear.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
