export enum UserRole {
  ADMIN = 'Admin',
  PROJECT_MANAGER = 'Project_Manager',
  TEAM_MEMBER = 'Team_Member',
}

export enum ProjectRole {
  ADMIN = 'Admin',
  PROJECT_MANAGER = 'Project_Manager',
  TEAM_MEMBER = 'Team_Member',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  location: string;
  budget: number;
  startDate: Date;
  plannedEndDate: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  phase: string;
  durationEstimate: number;
  progress: number;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
  createdAt: Date;
}

export interface Forecast {
  projectId: string;
  estimatedCompletionDate: Date;
  riskLevel: RiskLevel;
  explanation: string;
  confidence: number;
  generatedAt: Date;
}
