# Design Document: DakiyBuilds - AI-Powered Construction Project Management Platform

## Overview

DakiyBuilds is a full-stack web application designed for small to medium construction firms to manage projects, track progress, and leverage AI-driven forecasting for project completion predictions. The platform integrates task dependencies, historical progress data, weather conditions, and public holidays to provide accurate schedule forecasts with risk indicators. The system features a modern React-based frontend, a scalable REST API backend, relational database storage, cloud-based document management, and a modular AI forecasting engine. The architecture prioritizes modularity, extensibility, and realistic construction workflow modeling.

The platform supports role-based access control (admin, project manager, team member) and provides comprehensive project management capabilities including phase/task management, document organization with versioning, visual timeline views, and an analytics dashboard with KPIs and risk alerts.

## Architecture

```mermaid
graph TD
    subgraph "Client Layer"
        A[React Web App]
        A1[Dashboard]
        A2[Project Management]
        A3[Document Manager]
        A4[Forecast Viewer]
    end
    
    subgraph "API Gateway Layer"
        B[REST API Gateway]
        B1[Authentication Middleware]
        B2[Rate Limiting]
        B3[Request Validation]
    end
    
    subgraph "Application Layer"
        C[Project Service]
        D[Task Service]
        E[Document Service]
        F[User Service]
        G[AI Forecasting Service]
        H[Weather Service]
        I[Calendar Service]
    end
    
    subgraph "Data Layer"
        J[(PostgreSQL Database)]
        K[Cloud Storage - S3]
        L[Redis Cache]
    end
    
    subgraph "External Services"
        M[Weather API]
        N[Holiday Calendar API]
    end
    
    A --> B
    B --> B1
    B --> B2
    B --> B3
    B1 --> C
    B1 --> D
    B1 --> E
    B1 --> F
    B1 --> G
    C --> J
    D --> J
    E --> J
    E --> K
    F --> J
    G --> J
    G --> L
    H --> M
    I --> N
    G --> H
    G --> I


## Main Workflow: AI Forecast Generation

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant API as API Gateway
    participant PS as Project Service
    participant TS as Task Service
    participant AIF as AI Forecasting Service
    participant WS as Weather Service
    participant CS as Calendar Service
    participant DB as Database
    participant Cache as Redis Cache
    
    U->>F: Request forecast for project
    F->>API: GET /api/projects/{id}/forecast
    API->>PS: Fetch project details
    PS->>DB: Query project data
    DB-->>PS: Project data
    PS->>TS: Fetch all tasks with dependencies
    TS->>DB: Query tasks, dependencies, progress
    DB-->>TS: Task data
    TS-->>PS: Task tree with progress
    PS-->>AIF: Project + Tasks + Historical data
    
    AIF->>Cache: Check cached forecast
    Cache-->>AIF: Cache miss
    
    AIF->>WS: Get weather forecast for location
    WS-->>AIF: Weather data (rain days, delays)
    
    AIF->>CS: Get holidays for date range
    CS-->>AIF: Holiday list
    
    AIF->>AIF: Run forecasting algorithm
    AIF->>AIF: Calculate completion date
    AIF->>AIF: Assess risk level
    AIF->>AIF: Generate explanation
    
    AIF->>Cache: Store forecast result
    AIF-->>API: Forecast result with explanation
    API-->>F: JSON response
    F-->>U: Display forecast with risk indicators


## Components and Interfaces

### Component 1: Project Service

**Purpose**: Manages project lifecycle, metadata, and relationships with tasks and team members

**Interface**:
```typescript
interface ProjectService {
  createProject(data: CreateProjectDTO, userId: string): Promise<Project>
  updateProject(id: string, data: UpdateProjectDTO, userId: string): Promise<Project>
  deleteProject(id: string, userId: string): Promise<void>
  getProject(id: string, userId: string): Promise<Project>
  listProjects(userId: string, filters: ProjectFilters): Promise<Project[]>
  assignTeamMember(projectId: string, userId: string, role: ProjectRole): Promise<void>
  removeTeamMember(projectId: string, userId: string): Promise<void>
}
```

**Responsibilities**:
- CRUD operations for projects
- Team member assignment and role management
- Access control validation
- Project metadata management (budget, deadlines, location)


### Component 2: Task Service

**Purpose**: Manages tasks, phases, dependencies, and progress tracking

**Interface**:
```typescript
interface TaskService {
  createTask(projectId: string, data: CreateTaskDTO): Promise<Task>
  updateTask(taskId: string, data: UpdateTaskDTO): Promise<Task>
  deleteTask(taskId: string): Promise<void>
  getTask(taskId: string): Promise<Task>
  listTasksByProject(projectId: string): Promise<Task[]>
  addDependency(taskId: string, dependsOnTaskId: string): Promise<void>
  removeDependency(taskId: string, dependsOnTaskId: string): Promise<void>
  updateProgress(taskId: string, progress: number, notes: string): Promise<TaskProgress>
  getTaskDependencyTree(projectId: string): Promise<TaskTree>
}
```

**Responsibilities**:
- Task CRUD operations
- Dependency graph management
- Progress tracking and history
- Phase organization
- Validation of circular dependencies


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Authentication Correctness

*For any* user credentials, the authentication system should accept valid credentials and create a session, while rejecting invalid credentials with an appropriate error message.

**Validates: Requirements 1.1, 1.2**

### Property 2: Authorization Enforcement

*For any* authenticated user and any action, the system should verify the user has the required role permissions before allowing the action to proceed.

**Validates: Requirements 1.3**

### Property 3: Role-Based Access Control

*For any* user with a specific role (Admin, Project_Manager, or Team_Member), the system should grant exactly the permissions defined for that role and no others.

**Validates: Requirements 1.4, 1.5, 1.6**

### Property 4: Session Expiration Security

*For any* expired session, attempting to perform any action should require re-authentication before proceeding.

**Validates: Requirements 1.7**

### Property 5: Project Creation Completeness

*For any* valid project data submitted by a Project_Manager, the system should store all metadata fields including name, location, budget, and deadlines.

**Validates: Requirements 2.1**

### Property 6: Project Update Auditability

*For any* project update, the system should save the changes and create an audit trail entry with timestamp and user information.

**Validates: Requirements 2.2**

### Property 7: Cascading Project Deletion

*For any* project deletion, the system should remove the project and all associated tasks, documents, and relationships.

**Validates: Requirements 2.3**

### Property 8: Access-Filtered Data Retrieval

*For any* user requesting projects or project lists, the system should return only projects the user has permission to access.

**Validates: Requirements 2.4, 2.7**

### Property 9: Team Membership Management

*For any* team member assignment or removal, the system should correctly create or revoke the association and update access permissions accordingly.

**Validates: Requirements 2.5, 2.6**

### Property 10: Task Creation Completeness

*For any* valid task data, the system should store all fields including phase, duration estimate, and assigned team members.

**Validates: Requirements 3.1**

### Property 11: Circular Dependency Prevention

*For any* attempt to add a task dependency, the system should validate that the addition would not create a circular dependency and reject the operation if it would.

**Validates: Requirements 3.2, 3.3**

### Property 12: Dependency Tree Consistency

*For any* project, the returned task dependency tree should accurately reflect all tasks and their dependency relationships as stored in the system.

**Validates: Requirements 3.4**

### Property 13: Progress Tracking Completeness

*For any* task progress update, the system should record the progress percentage, timestamp, user, and optional notes.

**Validates: Requirements 3.5, 10.2**

### Property 14: Dependency Cleanup on Task Deletion

*For any* task deletion, the system should remove all dependency relationships referencing that task.

**Validates: Requirements 3.6**

### Property 15: Completion Status Propagation

*For any* task marked as complete, the system should update dependent tasks to reflect the completion status.

**Validates: Requirements 3.7**

### Property 16: Document Storage Completeness

*For any* document upload with valid metadata, the system should store the file in cloud storage and create a corresponding database record with all metadata.

**Validates: Requirements 4.1**

### Property 17: Document Version History

*For any* document, uploading a new version should maintain the complete version history with all previous versions accessible.

**Validates: Requirements 4.2**

### Property 18: Document Access Control

*For any* document download request, the system should verify the user has access permissions before returning the file.

**Validates: Requirements 4.3**

### Property 19: Document Search Accuracy

*For any* document search query, the system should return all documents matching the search criteria that the user has permission to access.

**Validates: Requirements 4.4, 14.3**

### Property 20: Document Tagging Persistence

*For any* document tagging operation, the system should associate the tags with the document and make them available for future searches.

**Validates: Requirements 4.5**

### Property 21: Document Linking Correctness

*For any* document linked to a task or project, the system should create and maintain the association.

**Validates: Requirements 4.6**

### Property 22: Document Deletion Completeness

*For any* document deletion, the system should remove both the file from cloud storage and the database record.

**Validates: Requirements 4.7**

### Property 23: Forecast Input Completeness

*For any* forecast request, the AI_Forecasting_Service should analyze all required inputs including task dependencies, progress history, weather data, and holidays.

**Validates: Requirements 5.1**

### Property 24: Forecast Output Completeness

*For any* generated forecast, the system should provide an estimated completion date, risk level, and human-readable explanation.

**Validates: Requirements 5.2, 5.3, 5.4**

### Property 25: Forecast Confidence Indication

*For any* project with insufficient historical data, the forecast should use default duration estimates and indicate lower confidence in the prediction.

**Validates: Requirements 5.5**

### Property 26: Forecast Caching and Invalidation

*For any* forecast generation, the system should cache the result for subsequent requests, and invalidate the cache when project data changes significantly.

**Validates: Requirements 5.6, 5.7, 12.1, 12.2**

### Property 27: Weather Data Integration

*For any* forecast request, the Weather_Service should return weather data for the project location and date range, and the forecasting service should adjust task durations when adverse weather is predicted.

**Validates: Requirements 6.1, 6.2**

### Property 28: Weather Service Resilience

*For any* weather service failure or unavailable data, the AI_Forecasting_Service should handle the failure gracefully using historical patterns or proceeding without weather adjustments.

**Validates: Requirements 6.3**

### Property 29: Weather Data Association

*For any* stored weather data, the system should correctly associate it with the project location and timestamp.

**Validates: Requirements 6.4**

### Property 30: Working Day Calculation

*For any* date range, the Calendar_Service should provide a list of non-working days including weekends and region-specific holidays, and the forecasting service should exclude these from task duration calculations.

**Validates: Requirements 7.1, 7.2, 7.4**

### Property 31: Holiday Configuration Persistence

*For any* holiday configuration by an Admin, the system should store the holiday calendar for the specified region.

**Validates: Requirements 7.3**

### Property 32: Dashboard Data Aggregation

*For any* user accessing the dashboard, the system should display KPIs aggregated from all projects the user can access, including active projects, tasks at risk, and overall progress.

**Validates: Requirements 8.1, 8.5**

### Property 33: Timeline Comparison Visualization

*For any* project with a forecast, the timeline display should show a visual comparison of forecasted vs. planned completion dates.

**Validates: Requirements 8.2**

### Property 34: Risk Alert Display

*For any* project with a high risk level, the dashboard should display an alert indicating the schedule risk.

**Validates: Requirements 8.3**

### Property 35: Analytics Chart Rendering

*For any* analytics view, the system should render charts showing progress trends and delay indicators based on project data.

**Validates: Requirements 8.4**

### Property 36: Timeline Task Rendering

*For any* project timeline view, the system should render all tasks on a time-based chart with their scheduled dates.

**Validates: Requirements 9.1**

### Property 37: Dependency Visualization

*For any* timeline view with task dependencies, the system should display connecting lines showing the dependency relationships.

**Validates: Requirements 9.2**

### Property 38: Delay Indication

*For any* delayed task in the timeline view, the system should provide a visual indicator of the delay.

**Validates: Requirements 9.3**

### Property 39: Timeline Interaction

*For any* timeline view, the system should support zooming and panning interactions to view different time scales.

**Validates: Requirements 9.4**

### Property 40: Progress Validation

*For any* task progress update, the system should validate that the progress percentage is between 0 and 100 inclusive.

**Validates: Requirements 10.1**

### Property 41: Progress History Ordering

*For any* task with multiple progress updates, the system should display the history in chronological order.

**Validates: Requirements 10.3**

### Property 42: Progress Trend Analysis

*For any* forecast using progress data, the AI_Forecasting_Service should analyze historical progress trends to predict future progress rates.

**Validates: Requirements 10.4**

### Property 43: Input Validation Completeness

*For any* API request, the system should validate that all required fields are present and have correct data types, rejecting invalid requests with descriptive error messages.

**Validates: Requirements 11.1, 11.2**

### Property 44: Transaction Rollback on Failure

*For any* database operation failure, the system should roll back the transaction and return an error to maintain data consistency.

**Validates: Requirements 11.3**

### Property 45: External Service Resilience

*For any* external service failure, the system should handle the failure gracefully and provide a fallback response or clear error message.

**Validates: Requirements 11.4**

### Property 46: File Size Validation

*For any* file upload, the system should validate the file size against configured limits and reject uploads that exceed the limit.

**Validates: Requirements 11.5**

### Property 47: Query Result Caching

*For any* frequently accessed data query, the system should use caching to reduce database load and improve response times.

**Validates: Requirements 12.3**

### Property 48: Responsive Interface Adaptation

*For any* device screen size, the system should render a responsive interface optimized for that screen size with appropriate layout adjustments.

**Validates: Requirements 13.1**

### Property 49: Mobile Touch Interaction

*For any* charts and timelines displayed on mobile devices, the system should adapt visualizations for touch interaction.

**Validates: Requirements 13.2**

### Property 50: Mobile Feature Parity

*For any* action available on desktop, the same functionality should be available and work correctly on mobile devices.

**Validates: Requirements 13.3**

### Property 51: Project Search and Filter Accuracy

*For any* project search or filter operation, the system should return only projects matching the criteria that the user has permission to access.

**Validates: Requirements 14.1, 14.2**

### Property 52: Search Result Ordering

*For any* search results, the system should order them by relevance or date as specified.

**Validates: Requirements 14.4**

### Property 53: Action Audit Logging

*For any* significant user action, the system should create an audit log entry with user ID, timestamp, and action details.

**Validates: Requirements 15.1**

### Property 54: Audit Log Retrieval

*For any* audit log query by an Admin, the system should return logs with filtering and search capabilities.

**Validates: Requirements 15.2**

### Property 55: Error Logging Completeness

*For any* system error or security event, the system should log sufficient details for debugging and security monitoring.

**Validates: Requirements 15.3, 15.4**
