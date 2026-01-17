export type Project = {
    id: string
    created_at: string
    name: string
    description: string | null
    user_id: string
    group_id: string | null
    deleted_at: string | null
}

export type ProjectGroup = {
    id: string
    created_at: string
    name: string
    user_id: string
}

export type Section = {
    id: string
    project_id: string
    name: string
    order_index: number
    created_at: string
}

export type Task = {
    id: string
    created_at: string
    title: string
    description: string | null
    is_completed: boolean
    priority: 'low' | 'medium' | 'high' | null
    due_date: string | null
    project_id: string | null
    user_id: string
    parent_id: string | null
    start_time: string | null
    end_time: string | null
    section_id: string | null
    deleted_at: string | null
    completed_at: string | null
    sort_order: number
    is_project: boolean
    recurrence_rule: string | null
}

export type Tag = {
    id: string
    created_at: string
    name: string
    color: string
    user_id: string
    category?: 'place' | 'energy' | 'time' | 'people' | null
}

export type Habit = {
    id: string
    created_at: string
    name: string
    user_id: string
    emoji: string | null
    color: string | null
    is_archived: boolean
    order_index: number
}

export type HabitLog = {
    id: string
    habit_id: string
    user_id: string
    log_date: string
    status: 'done' | 'missed' | 'skipped'
    note: string | null
    created_at: string
}


export type TaskTag = {
    task_id: string
    tag_id: string
    created_at: string
}

export type UserSettings = {
    user_id: string
    theme: 'light' | 'dark' | 'system'
    dashboard_layout: Record<string, any>
    preferences: {
        openai_api_key?: string
        start_of_week?: 'monday' | 'sunday'
        language?: 'ru' | 'en'
        show_completed_tasks?: boolean
        show_toast_hints?: boolean
        hide_night_time?: boolean
        default_page?: 'dashboard' | 'today' | 'calendar'
        font_size?: 'small' | 'medium' | 'large'
        font_family?: 'sans' | 'mono'
        [key: string]: any
    }
    created_at: string
    updated_at: string
}

export type TaskHistory = {
    id: string
    task_id: string
    user_id: string
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
    old_record: Partial<Task> | null
    new_record: Partial<Task> | null
    changed_fields: string[] | null
    created_at: string
}
