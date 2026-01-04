export type Project = {
    id: string
    created_at: string
    name: string
    description: string | null
    user_id: string
}

export type Task = {
    id: string
    created_at: string
    title: string
    description: string | null
    status: 'todo' | 'in_progress' | 'done'
    priority: 'low' | 'medium' | 'high'
    due_date: string | null
    project_id: string
    user_id: string
    parent_id: string | null
    start_time: string | null
    end_time: string | null
}
