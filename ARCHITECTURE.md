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
- **Native Runtime:** **Capacitor** (iOS/Android)
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

## 5. Mobile First Adaptation (Native Support)
The application has been extensively adapted for mobile devices, preparing for native builds via Capacitor.

### Mobile UI & Navigation
- **Responsive Sidebar (Drawer)**:
  - **Desktop**: Static sidebar (`min-w-64`).
  - **Mobile**: Fixed drawer with backdrop overlay, controlled by a "Hamburger" menu in a top header.
  - Sidebar automatically closes on navigation.
- **Task Detail as Bottom Sheet**:
  - On mobile, `TaskDetailModal` renders as a swipeable "Bottom Sheet" specific to touch usage (85% height, rounded top, drag handle).
  - Desktop retains the centered modal experience.

### Mobile Calendar Experience
- **Custom Mobile Header**: Replaces standard FullCalendar toolbar on `< 768px`.
  - Simplified navigation (1D / 3D / 7D view switcher).
  - "No Year" compact date format.
  - Click-on-date returns to "Today".
- **Adaptive Views**: 
  - Automatically switches to `timeGridDay` on mobile vs `dayGridMonth` on desktop.
  - Mobile custom `threeDay` view.
- **Event Interaction**: Long-press to drag events on touch devices.

### Mobile Gestures (Swipe Actions)
Powered by `react-swipeable-list`, tasks in lists support advanced gestures:
- **Swipe Right (Leading)**:
  - **Quick Tags**: Direct access to top 2 used tags.
  - **Tag Manager**: Opens full tag selection.
- **Swipe Left (Trailing)**:
  - **Planning**: Quick preset "Today" / "Tomorrow".
  - **Pick Date**: Opens native date picker via hidden input trigger.
- **Conflict Resolution**: A dedicated drag handle (6-dots icon) ensures swipe gestures don't conflict with Drag-and-Drop resorting using `dnd-kit`.

## 6. Native Build Infrastructure
- **Platform**: Android (added via Capacitor).
- **Core Config**: `capacitor.config.ts` setup.
- **Assets**: Native splash screens and icons generated for Android res folders.

