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
- **Drag-and-Drop:** **dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`). Features a custom **Magnetic Sidebar** logic (exclusive collision zones) for intuitive project/smart-list organization.
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
- **Task Detail Interaction (Unified)**:
  - **Desktop**: 
    - **Lists**: Side column (4-pane layout).
    - **Calendar**: Centered Modal.
  - **Mobile**:
    - **Universal Drawer (Bottom Sheet)**: All task details (from Lists, Calendar, or Inbox) open in a native-style `vaul` Drawer.
    - **Smart Positioning**: The drawer is anchored to the *top* (e.g., `top-[10vh]`) rather than having fixed height. This ensures that when the mobile keyboard opens (pushing the bottom viewport edge up), the drawer content resizes naturally instead of the entire modal being pushed off-screen.

### Interaction & UX Refinements
- **Tag Management Flow**:
  - **No-Keyboard Default**: Adding a tag first opens a scrollable list of existing tags *without* focusing an input, preventing the virtual keyboard from obscuring the view.
  - **Explicit Creation**: A "New Tag" button is required to switch to creation mode and activate the keyboard.
- **Animation Philosophy**:
  - **"Confident" UI**: Removed jittery "exit" animations from lists. Transitions are instant-out, fade-in to feel snappier.
  - **Popover Hygiene**: FullCalendar "More tasks" popovers are programmatically closed by identifying and clicking their native close buttons when a task is selected, ensuring clean UI layering.

### Mobile Calendar Experience
- **Custom Mobile Header**: Replaces standard FullCalendar toolbar on `< 768px`.
  - Simplified navigation (1D / 3D / 7D view switcher).
  - "No Year" compact date format.
  - Click-on-date returns to "Today".
- **Adaptive Views**: 
  - Automatically switches to `timeGridDay` on mobile vs `dayGridMonth` on desktop.
  - Mobile custom `threeDay` view.
- **Event Interaction**: Long-press to drag events on touch devices.

### Mobile Gestures & Drag Interaction
- **Magnetic Sidebar Collision**: Implemented an exclusive collision zone (X < 270px) that prioritizes sidebar targets (Inbox, Today, Projects) and ignores the background task list during drag. This eliminates target conflict in multi-pane layouts.
- **Visual Feedback**: Used high-contrast highlights (Solid Blue / White Text) for active drop targets to provide clear state indication.
- **Drag Handle Design**: A dedicated drag handle (`GripVertical`) with `cursor: move` ensures cross-browser compatibility and respects system cursor color settings, avoiding the hardcoded white "grab" cursor issue.
- **Conflict Resolution**: Drag-and-Drop resorting using `dnd-kit` is scoped via collision detection strategies (closestCenter for sidebar, closestCorners for lists) to ensure deterministic behavior. Swipes were removed in favor of a cleaner DnD-first UX.

### 6. Task Detail UI & Interaction (Refined)
- **Headerless Design**: The Task Detail modal has been simplified by removing the dedicated header bar and close button. Closing is handled via backdrop click or breadcrumb navigation.
- **Top-Right Date Picker**: Date and time controls are positioned at the top-right for quick scheduling, mirroring the breadcrumb navigation on the top-left.
- **Footer Controls**: Contextual actions (Project selection, Tags, GTD "Project" toggle) are grouped in a dedicated footer bar.
- **Breadcrumb Navigation**: Displays hierarchy (Parent > Child) with an "Up" arrow (ArrowUp) to easily traverse up the task tree.
- **Soft Focus**: Input fields (Title, Description) use simplified, borderless styles that only reveal boundaries on interaction, reducing visual noise.

### 7. GTD Project Logic
- **Task-as-Project**: Any task can be promoted to a "Project" via the `is_project` flag. This allows for infinite nesting while distinguishing between actionable "tasks" and structural "projects" in the UI.
- **Visual Distinction**: "Project" tasks are rendered with uppercase, bold titles in lists to differentiate them from standard items.

## 6. Native Build Infrastructure
- **Platform**: Android (added via Capacitor).
- **Core Config**: `capacitor.config.ts` setup.
- **Assets**: Native splash screens and icons generated for Android res folders.

