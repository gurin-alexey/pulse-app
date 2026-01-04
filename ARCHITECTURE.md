# Pulse 2.0 - Architecture & Technical Context

This document outlines the current state of the Pulse application, documenting key technical decisions, database structure, and the technology stack to ensure consistent development across environments.

## 1. Technology Stack
Current core technologies used in the project:

- **Framework:** React + Vite (TypeScript)
- **Styling:** Tailwind CSS (Vanilla CSS for custom components where needed)
- **Database & Auth:** Supabase (PostgreSQL + RLS)
- **State Management & Data Fetching:** TanStack Query (React Query)
- **Navigation:** React Router 6 (URL-driven UI state)
- **Calendar Engine:** **FullCalendar** (`@fullcalendar/react`, `daygrid`, `timegrid`, `interaction`, `multimonth`)
- **Drag-and-Drop:** **dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`) - used for categorizing tasks into sections and organizing projects.
- **Icons:** Lucide React

## 2. Database Schema (Supabase)
All tables have **Row Level Security (RLS)** enabled, ensuring users only access their own data.

### `projects` & `project_groups`
- **`project_groups`**: Folders for grouping projects in the sidebar.
- **`projects`**: Belong to a group or remain ungrouped.

### `tasks` & `sections`
- **`sections`**: Columns or buckets within a project (e.g., "Backlog", "Ideas").
- **`tasks`**: 
    - `section_id`: Links task to a project section.
    - `parent_id`: Enables hierarchical subtasks (Drill-down model).
    - `project_id`: Project link (can be `null` for Inbox tasks).
    - `start_time` / `end_time`: ISO timestamps for timed events.
    - `due_date`: Date-only (`YYYY-MM-DD`) for scheduling.

### `tags` & `task_tags`
- Implement a Many-to-Many relationship between tasks and tags.

## 3. Key Architectural Decisions

### Date & Time Handling (Critical)
To prevent timezone-related display shifts:
- **All Day Events**: Stored in `due_date` as a plain string (`YYYY-MM-DD`). `start_time` is set to `null`.
- **Timed Events**: Stored as ISO 8601 strings in `start_time` and `end_time`.
- **Formatting**: Local date components are extracted manually (YYYY, MM, DD) during save rather than using `toISOString()` to avoid UTC conversion shifts.

### Adaptive Layout
The application uses a dynamic grid layout based on the current route:
- **Project/Task Views**: 4-column layout (Sidebar | Task List | Task Detail | Daily Planner).
- **Calendar View (`/calendar`)**: Full-width mode (Sidebar | Calendar). 
- **Modals**: Task editing on the calendar page uses `TaskDetailModal` to maintain context without disrupting the schedule view.

### Subtasks (Drill-Down Model)
Subtasks are not just visual nested items; they are first-class tasks. Clicking a subtask updates the URL (`?task=ID`), which drives the `TaskDetail` component to "dive into" that task, showing its own subtasks.

### Optimistic UI
Every critical interaction (toggling completion, drag-and-drop, deleting) uses TanStack Query's `onMutate` to update the UI instantly, with rollback logic on failure.

## 4. Navigation & Task Organization

### Smart Lists
Virtual filters based on task properties:
- **Inbox**: Tasks where `project_id` is `null`.
- **Today**: Tasks where `due_date` matches the current local date.

### Project Sections
Tasks inside projects can be organized into named sections (rendered as Accordions). Tasks without a `section_id` appear in the "Uncategorized" top-level list.
