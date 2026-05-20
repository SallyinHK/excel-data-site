import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  FileText,
  HelpCircle,
  LineChart,
  Sparkles,
  X,
} from "lucide-react";

const STORAGE_KEY = "roi-platform-onboarding-dismissed-v5";

const tourSteps = [
  {
    title: "Review the portfolio",
    subtitle: "Dashboard",
    description:
      "Start here to see total projects, investment size, average NPV, status mix and regional exposure.",
    path: "/",
    icon: BarChart3,
  },
  {
    title: "Open a sample project",
    subtitle: "Project Detail",
    description:
      "Review NPV, IRR, Payback, ROI and PI. Click the small info icon beside a metric to check the calculation logic.",
    path: "/projects/6",
    icon: Briefcase,
  },
  {
    title: "View the ROI report",
    subtitle: "Report View",
    description:
      "Use this page as a meeting-friendly summary with key metrics, cash flow charts and yearly cash flow details.",
    path: "/reports/6",
    icon: FileText,
  },
  {
    title: "Run a what-if test",
    subtitle: "Simulator",
    description:
      "Load a baseline project, then adjust sales, price, COGS or OpEx to see how ROI changes.",
    path: "/simulator",
    icon: LineChart,
  },
];

export default function OnboardingGuide() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = tourSteps[stepIndex];
  const Icon = currentStep.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tourSteps.length - 1;

  useEffect(() => {
    const dismissed = window.localStorage.getItem(STORAGE_KEY);

    if (!dismissed) {
      const timer = window.setTimeout(() => {
        setStepIndex(0);
        setLocation(tourSteps[0].path);
        setOpen(true);
      }, 450);

      setReady(true);
      return () => window.clearTimeout(timer);
    }

    setReady(true);
  }, [setLocation]);

  const closeTour = () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  const restartTour = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setStepIndex(0);
    setLocation(tourSteps[0].path);
    setOpen(true);
  };

  const goNext = () => {
    if (isLast) {
      closeTour();
      return;
    }

    const next = stepIndex + 1;
    setStepIndex(next);
    setLocation(tourSteps[next].path);
  };

  const goBack = () => {
    if (isFirst) return;

    const previous = stepIndex - 1;
    setStepIndex(previous);
    setLocation(tourSteps[previous].path);
  };

  if (!ready) return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border bg-background/98 p-4 shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold">
                <Sparkles className="h-4 w-4 text-primary" />
                Guided Demo
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Follow the steps one by one. The page will switch automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={closeTour}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close guide"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-xl border bg-primary/5 p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Step {stepIndex + 1} / {tourSteps.length}
                </div>

                <div className="mt-1 text-sm font-semibold">
                  {currentStep.title}
                </div>

                <div className="mt-0.5 text-[11px] font-medium text-primary">
                  {currentStep.subtitle}
                </div>

                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {currentStep.description}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={
                  index === stepIndex
                    ? "h-1.5 flex-1 rounded-full bg-primary"
                    : "h-1.5 flex-1 rounded-full bg-muted"
                }
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={closeTour}>
              Skip
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goBack}
                disabled={isFirst}
                className="h-8 gap-1.5 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>

              <Button size="sm" onClick={goNext} className="h-8 gap-1.5 text-xs">
                {isLast ? "Finish" : "Next"}
                {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!open && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={restartTour}
          className="fixed bottom-5 right-5 z-50 h-8 gap-1.5 rounded-full bg-background/95 px-3 text-xs shadow-lg backdrop-blur"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Guide
        </Button>
      )}
    </>
  );
}
