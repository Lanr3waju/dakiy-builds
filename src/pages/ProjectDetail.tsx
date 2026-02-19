import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, Building, DollarSign, Brain, AlertTriangle, CheckCircle2, TrendingUp, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Logo from "@/components/Logo";
import { mockProjects, generateForecast } from "@/lib/mock-data";
import { Project, Forecast } from "@/lib/types";

const severityColors = { low: "bg-chart-2/10 text-chart-2", medium: "bg-chart-3/10 text-chart-3", high: "bg-chart-5/10 text-chart-5" };

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);

  useEffect(() => {
    const found = mockProjects.find(p => p.id === id);
    if (found) setProject(found);
  }, [id]);

  const runForecast = () => {
    if (!project) return;
    setLoadingForecast(true);
    setTimeout(() => {
      setForecast(generateForecast(project));
      setLoadingForecast(false);
    }, 1500);
  };

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const formatCurrency = (n: number) => "₦" + n.toLocaleString();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <Logo linkTo="/dashboard" />
        </div>
      </header>

      <main className="container py-10 max-w-4xl">
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-2">{project.name}</h1>
          <p className="text-muted-foreground">{project.description}</p>
        </div>

        {/* Info Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: MapPin, label: "Location", value: project.location },
            { icon: Building, label: "Type", value: project.buildingType },
            { icon: DollarSign, label: "Contract Sum", value: formatCurrency(project.contractSum) },
            { icon: Calendar, label: "Timeline", value: `${project.startDate} → ${project.estimatedEndDate}` },
          ].map(i => (
            <div key={i.label} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide mb-1">
                <i.icon className="w-3.5 h-3.5" /> {i.label}
              </div>
              <p className="font-semibold text-sm">{i.value}</p>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-accent" /> Project Progress</h2>
            <span className="text-2xl font-bold">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-3" />
        </div>

        {/* AI Forecast */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <Brain className="w-5 h-5 text-accent" /> AI Forecast
            </h2>
            <Button variant="accent" size="sm" onClick={runForecast} disabled={loadingForecast}>
              {loadingForecast ? "Analysing..." : forecast ? "Re-run Forecast" : "Generate Forecast"}
            </Button>
          </div>

          {!forecast && !loadingForecast && (
            <p className="text-muted-foreground text-sm">Click "Generate Forecast" to get AI-driven predictions for this project.</p>
          )}

          {loadingForecast && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-muted-foreground">Analysing project data, weather patterns, and historical trends...</span>
            </div>
          )}

          {forecast && !loadingForecast && (
            <div className="space-y-6 animate-fade-in">
              {/* Prediction */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-accent/10 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Predicted Completion</p>
                  <p className="text-lg font-bold text-accent">{forecast.predictedEndDate}</p>
                  <p className="text-xs text-muted-foreground mt-1">vs. estimated: {project.estimatedEndDate}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Confidence Level</p>
                  <p className="text-lg font-bold text-primary">{forecast.confidence}%</p>
                  <Progress value={forecast.confidence} className="h-1.5 mt-2" />
                </div>
              </div>

              {/* Risks */}
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
                  <AlertTriangle className="w-4 h-4 text-chart-3" /> Identified Risks
                </h3>
                <div className="space-y-2">
                  {forecast.risks.map((r, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <Badge variant="outline" className={`${severityColors[r.severity]} text-xs shrink-0 mt-0.5`}>{r.severity}</Badge>
                      <div>
                        <p className="font-medium text-sm">{r.label}</p>
                        <p className="text-muted-foreground text-xs">{r.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
                  <Lightbulb className="w-4 h-4 text-chart-3" /> Recommendations
                </h3>
                <ul className="space-y-2">
                  {forecast.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProjectDetail;
