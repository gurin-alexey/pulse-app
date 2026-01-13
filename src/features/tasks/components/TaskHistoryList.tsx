import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTaskHistory } from '@/hooks/useTaskHistory'
import { Loader2, Plus, Pencil, Trash2, History } from 'lucide-react'
import clsx from 'clsx'

type TaskHistoryListProps = {
    taskId: string
}

const FIELD_LABELS: Record<string, string> = {
    title: 'Название',
    description: 'Описание',
    is_completed: 'Статус выполнения',
    priority: 'Приоритет',
    due_date: 'Срок выполнения',
    project_id: 'Проект',
    section_id: 'Секция',
    start_time: 'Время начала',
    end_time: 'Время окончания',
    recurrence_rule: 'Правило повторения',
    is_project: 'Является проектом',
    parent_id: 'Родительская задача'
}

export function TaskHistoryList({ taskId }: TaskHistoryListProps) {
    const { data: history, isLoading } = useTaskHistory(taskId)

    if (isLoading) {
        return (
            <div className="flex justify-center p-8 text-gray-400">
                <Loader2 className="animate-spin" size={24} />
            </div>
        )
    }

    if (!history?.length) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-gray-400 text-center">
                <History className="mb-2 opacity-50" size={32} />
                <p>История изменений пуста</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {history.map((item) => {
                const date = new Date(item.created_at)
                let icon = <Pencil size={16} />
                let colorClass = 'bg-blue-100 text-blue-600'
                let actionText = 'Изменено'

                if (item.operation === 'INSERT') {
                    icon = <Plus size={16} />
                    colorClass = 'bg-green-100 text-green-600'
                    actionText = 'Задача создана'
                } else if (item.operation === 'DELETE') {
                    icon = <Trash2 size={16} />
                    colorClass = 'bg-red-100 text-red-600'
                    actionText = 'Задача удалена'
                }

                // Prepare details text
                let details = null
                if (item.operation === 'UPDATE' && item.changed_fields) {
                    details = (
                        <ul className="mt-1 text-sm text-gray-600 space-y-1">
                            {item.changed_fields.map(field => {
                                const label = FIELD_LABELS[field] || field
                                const oldVal = item.old_record?.[field as keyof typeof item.old_record]
                                const newVal = item.new_record?.[field as keyof typeof item.new_record]

                                // Format logic for specific fields can go here (e.g. booleans)
                                const formatVal = (v: any) => {
                                    if (typeof v === 'boolean') return v ? 'Да' : 'Нет'
                                    if (v === null || v === undefined) return 'Пусто'
                                    if (field === 'description') return stripHtml(v)

                                    // Check if date field
                                    if (['due_date', 'start_time', 'end_time', 'completed_at'].includes(field) && typeof v === 'string') {
                                        const d = new Date(v)
                                        if (!isNaN(d.getTime())) {
                                            return format(d, "d MMMM yyyy 'в' HH:mm", { locale: ru })
                                        }
                                    }

                                    return String(v)
                                }

                                return (
                                    <li key={field} className="flex flex-col sm:block">
                                        <span className="font-medium">{label}:</span>{' '}
                                        <span className="text-gray-500 line-through decoration-gray-400/50 mr-1">{formatVal(oldVal)}</span>
                                        <span className="text-gray-400">→</span>{' '}
                                        <span className="text-gray-800">{formatVal(newVal)}</span>
                                    </li>
                                )
                            })}
                        </ul>
                    )
                } else if (item.operation === 'UPDATE') {
                    // Fallback for updates without specific field changes recorded
                    details = (
                        <p className="mt-1 text-sm text-gray-500 italic">
                            Обновлены детали задачи
                        </p>
                    )
                }

                return (
                    <div key={item.id} className="relative pl-4 group">
                        {/* Timeline line */}
                        <div className="absolute left-[19px] top-8 bottom-[-16px] w-px bg-gray-100 group-last:hidden" />

                        <div className="flex gap-4 items-start">
                            <div className={clsx("shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10", colorClass)}>
                                {icon}
                            </div>
                            <div className="flex-1 bg-gray-50/50 rounded-lg p-3 border border-gray-100/50">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-semibold text-gray-800 text-sm">{actionText}</span>
                                    <span className="text-xs text-gray-400 whitespace-nowrap" title={format(date, 'PPpp', { locale: ru })}>
                                        {format(date, 'd MMM, HH:mm', { locale: ru })}
                                    </span>
                                </div>
                                {details}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function stripHtml(html: any) {
    if (typeof html !== 'string') return String(html)
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
}
