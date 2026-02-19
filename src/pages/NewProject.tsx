import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Logo from "@/components/Logo";
import { toast } from "sonner";

const buildingTypes = ["Residential", "Commercial", "Industrial", "Healthcare", "Educational", "Mixed Use", "Infrastructure"];

const NewProject = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", location: "", buildingType: "", contractSum: "",
    startDate: "", estimatedEndDate: "", description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.location || !form.buildingType || !form.startDate) {
      toast.error("Please fill in all required fields.");
      return;
    }
    toast.success("Project created successfully!");
    navigate("/dashboard");
  };

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <Logo linkTo="/dashboard" />
        </div>
      </header>

      <main className="container py-10 max-w-2xl">
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <h1 className="font-display text-3xl font-bold mb-2">Create New Project</h1>
        <p className="text-muted-foreground mb-8">Enter the base details for your construction project.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input id="name" placeholder="e.g. Lekki Pearl Towers" value={form.name} onChange={e => update("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input id="location" placeholder="e.g. Lekki Phase 1, Lagos" value={form.location} onChange={e => update("location", e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Building Type *</Label>
              <Select value={form.buildingType} onValueChange={v => update("buildingType", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {buildingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractSum">Contract Sum (₦)</Label>
              <Input id="contractSum" type="number" placeholder="e.g. 450000000" value={form.contractSum} onChange={e => update("contractSum", e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input id="startDate" type="date" value={form.startDate} onChange={e => update("startDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Estimated End Date</Label>
              <Input id="endDate" type="date" value={form.estimatedEndDate} onChange={e => update("estimatedEndDate", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={4} placeholder="Brief description of the project..." value={form.description} onChange={e => update("description", e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="accent" className="px-8">Create Project</Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default NewProject;
