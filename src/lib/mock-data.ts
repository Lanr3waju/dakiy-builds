import { Project, Forecast } from "./types";

export const mockProjects: Project[] = [
  {
    id: "1",
    name: "Lekki Pearl Towers",
    location: "Lekki Phase 1, Lagos",
    buildingType: "Residential",
    contractSum: 450000000,
    startDate: "2025-09-01",
    estimatedEndDate: "2027-03-01",
    status: "in-progress",
    progress: 35,
    description: "18-storey luxury residential tower with 120 units, rooftop amenities, and underground parking.",
    createdAt: "2025-08-15",
  },
  {
    id: "2",
    name: "Abuja Tech Hub",
    location: "Wuse II, Abuja",
    buildingType: "Commercial",
    contractSum: 280000000,
    startDate: "2025-11-15",
    estimatedEndDate: "2026-12-30",
    status: "planning",
    progress: 8,
    description: "Modern co-working and tech incubation centre with 5 floors and conference facilities.",
    createdAt: "2025-10-01",
  },
  {
    id: "3",
    name: "Ikoyi Bridge Clinic",
    location: "Ikoyi, Lagos",
    buildingType: "Healthcare",
    contractSum: 120000000,
    startDate: "2025-06-01",
    estimatedEndDate: "2026-02-28",
    status: "in-progress",
    progress: 68,
    description: "Specialist outpatient clinic with imaging suite and pharmacy wing.",
    createdAt: "2025-05-20",
  },
];

export function generateForecast(project: Project): Forecast {
  const daysRemaining = Math.max(30, Math.round((new Date(project.estimatedEndDate).getTime() - Date.now()) / 86400000));
  const delayDays = Math.round(daysRemaining * (Math.random() * 0.25));
  const predicted = new Date(project.estimatedEndDate);
  predicted.setDate(predicted.getDate() + delayDays);

  const risks = [
    { label: "Weather Delays", severity: "medium" as const, description: "Heavy rainfall expected during Q2 may slow foundation & roofing works." },
    { label: "Material Supply Chain", severity: "high" as const, description: "Steel reinforcement delivery timelines have been inconsistent." },
    { label: "Labour Shortage", severity: "low" as const, description: "Minor risk of skilled labour shortage during holiday periods." },
    { label: "Public Holiday Impact", severity: "low" as const, description: "Multiple public holidays in Dec-Jan may reduce effective working days." },
  ];

  return {
    predictedEndDate: predicted.toISOString().split("T")[0],
    confidence: 65 + Math.round(Math.random() * 25),
    risks: risks.slice(0, 2 + Math.floor(Math.random() * 2)),
    recommendations: [
      "Pre-order critical materials 8 weeks ahead of schedule.",
      "Establish weather contingency buffer of 15 working days.",
      "Schedule critical-path tasks outside rainy season where possible.",
    ],
  };
}
