export interface Project {
  id: string;
  name: string;
  location: string;
  buildingType: string;
  contractSum: number;
  startDate: string;
  estimatedEndDate: string;
  status: "planning" | "in-progress" | "completed" | "on-hold";
  progress: number;
  description: string;
  createdAt: string;
}

export interface Forecast {
  predictedEndDate: string;
  confidence: number;
  risks: { label: string; severity: "low" | "medium" | "high"; description: string }[];
  recommendations: string[];
}
