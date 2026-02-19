import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, MapPin, Calendar, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Logo from "@/components/Logo";
import { mockProjects } from "@/lib/mock-data";
import { Project } from "@/lib/types";

const statusColors: Record<Project["status"], string> = {
  "planning": "bg-chart-4/10 text-chart-4 border-chart-4/20",
  "in-progress": "bg-accent/10 text-accent border-accent/20",
  "completed": "bg-primary/10 text-primary border-primary/20",
  "on-hold": "bg-chart-3/10 text-chart-3 border-chart-3/20",
};

const Dashboard = () => {
  const [projects] = useState<Project[]>(mockProjects);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <Logo linkTo="/dashboard" />
          <Link to="/projects/new">
            <Button variant="accent" size="sm">
              <Plus className="w-4 h-4 mr-1" /> New Project
            </Button>
          </Link>
        </div>
      </header>

      <main className="container py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-1">Your Projects</h1>
          <p className="text-muted-foreground">Manage and track all your construction projects.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Total Projects", value: projects.length },
            { label: "In Progress", value: projects.filter(p => p.status === "in-progress").length },
            { label: "Planning", value: projects.filter(p => p.status === "planning").length },
            { label: "Avg. Progress", value: `${Math.round(projects.reduce((a, b) => a + b.progress, 0) / projects.length)}%` },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Project Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="group">
              <div className="rounded-xl border border-border bg-card p-6 hover:shadow-[var(--shadow-elevated)] transition-all duration-300 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-display text-lg font-bold group-hover:text-primary transition-colors">{p.name}</h3>
                  <Badge variant="outline" className={statusColors[p.status]}>
                    {p.status.replace("-", " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground text-sm mb-1">
                  <MapPin className="w-3.5 h-3.5" /> {p.location}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground text-sm mb-4">
                  <Calendar className="w-3.5 h-3.5" /> {p.startDate} → {p.estimatedEndDate}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{p.description}</p>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Progress</span>
                    <span className="font-semibold">{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-2" />
                </div>
              </div>
            </Link>
          ))}

          {/* New Project Card */}
          <Link to="/projects/new" className="group">
            <div className="rounded-xl border-2 border-dashed border-border bg-card/50 p-6 hover:border-accent hover:bg-accent/5 transition-all duration-300 h-full flex flex-col items-center justify-center min-h-[240px]">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                <Plus className="w-7 h-7 text-accent" />
              </div>
              <p className="font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Create New Project</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
