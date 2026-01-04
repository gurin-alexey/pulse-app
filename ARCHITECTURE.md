# Architecture Documentation

## 1. Technology Stack
- **Frontend Framework**: React 18 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/postcss`)
- **State Management**: Zustand
- **Data Fetching**: React Query (TanStack Query v5)
- **Routing**: React Router 7
- **Backend / Auth**: Supabase

## 2. Database Schema
### `projects`
- `id` (uuid, PK)
- `created_at` (timestamptz)
- `name` (text)
- `description` (text, nullable)
- `user_id` (uuid, FK to auth.users)

### `tasks`
- `id` (uuid, PK)
- `title` (text)
- `project_id` (uuid, FK to projects)
- `user_id` (uuid, FK to auth.users)
- `status` (text: 'todo' | 'in_progress' | 'done')
- `priority` (text: 'low' | 'medium' | 'high')
- `parent_id` (uuid, self-reference, nullable) - for subtasks

### Security (RLS)
- **Row Level Security** is enabled on all tables.
- Policies ensure users can only Select, Insert, Update, and Delete rows where `user_id` matches their authenticated ID.

## 3. UI Architecture
The application uses a **Fluid Grid Layout** with 4 distinct columns (panes):

1.  **Sidebar (Column A)**: Navigation and Project list.
2.  **Task List (Column B)**: Lists tasks for the selected project.
3.  **Detail View (Column C)**: Shows details of the selected task (comments, subtasks).
4.  **Calendar (Column D)**: Shows schedule/timeline.

Container:
```css
grid-cols-[260px_minmax(350px,1fr)_minmax(450px,1fr)_350px]
```

## 4. Workflows

### Authentication
- Uses Supabase Auth UI.
- Protected routes warn/redirect if session is missing.
- `useNavigate` used for redirects.

### Data Fetching
- **Read**: `useQuery` hooks (`useProjects`, `useTasks`) fetch data from Supabase.
- **Write**: `useMutation` hooks (`useCreateTask`) handle inserts/updates.
- **Optimistic Updates**: React Query cache invalidation is used after mutations to instantly refresh the UI.
