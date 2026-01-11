# Plan: Recurrence Refactoring (Separation of Concerns)

## 1. Objective
Move the tracking of recurring task statuses (completed, skipped) from the `recurrence_rule` (EXDATE) string to a separate relational table `task_occurrences`. This ensures the `recurrence_rule` remains pure and immutable, acting solely as a generator, while the status of specific instances is managed via a lightweight lookup table.

## 2. Database Schema

We need to create a new table `task_occurrences` to track the state of specific instances of a recurring task.

```sql
create table public.task_occurrences (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  original_date date not null, -- The date this instance was generated for (from RRule)
  status text check (status in ('completed', 'skipped', 'archived')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure one status record per instance per task
  unique(task_id, original_date) 
);

-- Enable RLS
alter table public.task_occurrences enable row level security;

-- Policies (assuming standard authenticated user access)
create policy "Users can view their own task occurrences"
  on public.task_occurrences for select
  using (auth.uid() = (select user_id from public.tasks where id = task_occurrences.task_id));

create policy "Users can insert their own task occurrences"
  on public.task_occurrences for insert
  with check (auth.uid() = (select user_id from public.tasks where id = task_occurrences.task_id));

create policy "Users can update their own task occurrences"
  on public.task_occurrences for update
  using (auth.uid() = (select user_id from public.tasks where id = task_occurrences.task_id));

create policy "Users can delete their own task occurrences"
  on public.task_occurrences for delete
  using (auth.uid() = (select user_id from public.tasks where id = task_occurrences.task_id));
```

## 3. Frontend Architecture

### A. Data Fetching (`useAllTasks` or new hook)
Currently, `useAllTasks` fetches the `tasks` table. We need to modify it or create a wrapper to:
1. Fetch all `tasks`.
2. Fetch all `task_occurrences` for the current user (or filtered by range).
3. **Merge Strategy:**
   - Client-side, when generating instances from RRule (`generateRecurringInstances`), for each generated date:
     - Check if a record exists in `task_occurrences` with matching `task_id` and `original_date`.
     - **If Match Found:**
       - If `status === 'completed'`: Mark instance as completed (green check).
       - If `status === 'skipped'`: Do not render the instance (it was deleted/skipped).
     - **If No Match:** Render as a standard pending instance.

### B. User Actions (Logic Change)

| Action | Current Logic (Old) | New Logic (Proposed) |
|--------|---------------------|----------------------|
| **Complete Instance** | Splits RRule or adds `EXDATE` + creates new completed task. | `INSERT INTO task_occurrences (task_id, original_date, status) VALUES (..., 'completed')` |
| **Un-complete Instance** | Merging tasks back (complex/impossible). | `DELETE FROM task_occurrences WHERE task_id = ... AND original_date = ...` |
| **Delete Instance** | Adds date to `EXDATE` in `recurrence_rule`. | `INSERT INTO task_occurrences (task_id, original_date, status) VALUES (..., 'skipped')` |
| **Reschedule Instance** | Creates exception task + `EXDATE`. | *Option 1 (Simple):* Treat as "Skip" + Create new standalone task. <br> *Option 2 (Advanced):* Expand table columns to support overrides (start_time, etc.). **Recommendation: Start with Option 1.** |

## 4. Implementation Steps

1.  **Migration:** Run the SQL to create the `task_occurrences` table.
2.  **API Layer:** Update `useAllTasks` hook to fetch the `task_occurrences` data.
3.  **Generator Utility:** Update `src/utils/recurrence.ts` -> `generateRecurringInstances`.
    - It should accept the `occurrences` map/array as an argument.
    - Inside the loop, check the map before outputting an instance.
4.  **UI Handlers:**
    - Update `TaskItem`, `CalendarPage`, `DailyPlanner`.
    - `onToggle` (check) should no longer call `updateTask` (patching the rule). Instead, it should call a new function `toggleOccurrenceStatus(taskId, date, status)`.

## 5. Benefits
- **Zero Data Duplication:** We stop spamming the tasks table with "completed copies".
- **Stable RRules:** Rules like "Every Day" don't turn into distinct strings "Every Day except ...".
- **Performance:** Checking a Set/Map of strings `"${taskId}_${date}"` is extremely fast O(1).
