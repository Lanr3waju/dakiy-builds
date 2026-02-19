import { Link } from "react-router-dom";
import { ArrowRight, Clock, Globe, Shield, Brain, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import heroImage from "@/assets/hero-construction.jpg";

const features = [
  { icon: Clock, title: "Real-time Updates", desc: "Changes are instantly reflected for everyone, ensuring the latest information at all times." },
  { icon: Globe, title: "Remote Access", desc: "Access your project from anywhere. No need to carry bulky files and documents." },
  { icon: Brain, title: "AI Forecasting", desc: "Predict completion dates, identify risks, and get smart recommendations powered by AI." },
  { icon: Shield, title: "Document Management", desc: "Upload, organise, and securely store all project documents in one place." },
  { icon: BarChart3, title: "Progress Tracking", desc: "Visualise project progress with intuitive charts and milestone tracking." },
  { icon: FileText, title: "Project Data", desc: "Capture contract sums, timelines, building types, and all critical project metadata." },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <Logo />
          <Link to="/dashboard">
            <Button variant="accent" size="sm">Go to Dashboard</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Construction site at golden hour" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "var(--hero-overlay)" }} />
        </div>
        <div className="relative container py-24 md:py-36 lg:py-44">
          <div className="max-w-2xl animate-fade-in-up">
            <p className="text-accent font-semibold text-sm uppercase tracking-widest mb-4">Construction Management Made Easy</p>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground leading-tight mb-6">
              Ditch the paperwork,<br />build smarter with<br />
              <span className="text-accent">dakiyBuilds</span>
            </h1>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-lg">
              Join the revolution in construction management. Experience the future of building projects with AI-powered forecasting and real-time collaboration.
            </p>
            <Link to="/dashboard">
              <Button variant="hero">
                Get Started <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28">
        <div className="container">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-4">
            Why use a web-based management system?
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
            Everything you need to manage construction projects efficiently, all in one platform.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div key={f.title} className="group p-6 rounded-xl bg-card border border-border hover:shadow-[var(--shadow-elevated)] transition-shadow duration-300">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <f.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-display text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary">
        <div className="container text-center">
          <h2 className="font-display text-3xl font-bold text-primary-foreground mb-4">Ready to build smarter?</h2>
          <p className="text-primary-foreground/70 mb-8 max-w-md mx-auto">Start managing your construction projects with AI-powered insights today.</p>
          <Link to="/dashboard">
            <Button variant="hero" className="bg-accent hover:bg-accent/90">
              Get Started Free <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container flex items-center justify-between">
          <Logo />
          <p className="text-muted-foreground text-sm">© 2026 DakiyBuilds. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
