import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTaskHistory, useDeleteHistoryItem } from '@/hooks/useTaskHistory'
import { Loader2, Plus, Pencil, Trash2, History } from 'lucide-react'
import clsx from 'clsx'
import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'

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

function ExpandableChange({ label, oldVal, newVal }: { label: string, oldVal: any, newVal: any }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <li className="text-gray-800">
            <div>
                {label}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="ml-2 text-blue-600 hover:text-blue-700 text-xs font-medium underline"
                >
                    {isOpen ? 'Скрыть детали' : 'Показать детали'}
                </button>
            </div>

            {isOpen && (
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs space-y-2">
                    <div>
                        <span className="font-semibold text-red-500 block mb-1">Было:</span>
                        <div className="break-words text-gray-600 bg-white p-2 rounded border border-gray-200">
                            {oldVal ? String(oldVal) : <span className="italic text-gray-400">Пусто</span>}
                        </div>
                    </div>
                    <div>
                        <span className="font-semibold text-green-600 block mb-1">Стало:</span>
                        <div className="break-words text-gray-800 bg-white p-2 rounded border border-gray-200">
                            {newVal ? String(newVal) : <span className="italic text-gray-400">Пусто</span>}
                        </div>
                    </div>
                </div>
            )}
        </li>
    )
}

import { useProjects } from '@/hooks/useProjects'
import { useAllSections } from '@/hooks/useAllSections'
import { useAllTasks } from '@/hooks/useAllTasks'

export function TaskHistoryList({ taskId }: TaskHistoryListProps) {
    const { data: history, isLoading } = useTaskHistory(taskId)
    const { data: projects } = useProjects()
    const { data: sections } = useAllSections()
    const { data: allTasksData } = useAllTasks()

    // Create lookup maps
    const projectMap = new Map(projects?.map(p => [p.id, p.name]))
    const sectionMap = new Map(sections?.map(s => [s.id, s.name]))
    // allTasksData.tasks array contains tasks
    const taskMap = new Map(allTasksData?.tasks?.map(t => [t.id, t.title]))

    const deleteHistoryMutation = useDeleteHistoryItem()
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
    const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            Object.values(timeoutsRef.current).forEach(clearTimeout)
        }
    }, [])

    const handleDelete = (historyId: string) => {
        // 1. Optimistically hide
        setHiddenIds(prev => {
            const next = new Set(prev)
            next.add(historyId)
            return next
        })

        // 2. Schedule deletion
        timeoutsRef.current[historyId] = setTimeout(() => {
            deleteHistoryMutation.mutate(historyId)
            // Cleanup from hiddenIds after mutation? 
            // Actually, once mutated, it will disappear from 'history' data anyway. 
            // But we can keep it in hiddenIds just in case until data refreshes.
        }, 5000)

        // 3. Show toast with Undo
        toast('Запись удалена', {
            action: {
                label: 'Отмена',
                onClick: () => {
                    // Undo logic
                    clearTimeout(timeoutsRef.current[historyId])
                    delete (timeoutsRef.current[historyId])
                    setHiddenIds(prev => {
                        const next = new Set(prev)
                        next.delete(historyId)
                        return next
                    })
                }
            },
            duration: 4000 // Slightly less than timeout to ensure user can't click too late
        })
    }

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
            {history.filter(item => !hiddenIds.has(item.id)).map((item) => {
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

                let details = null
                if (item.operation === 'UPDATE' && item.changed_fields) {
                    const changes: JSX.Element[] = []

                    // Helper to get raw values
                    const getVal = (f: string) => ({
                        old: item.old_record?.[f as keyof typeof item.old_record],
                        new: item.new_record?.[f as keyof typeof item.new_record]
                    })

                    // 0. Soft Delete (deleted_at)
                    if (item.changed_fields.includes('deleted_at')) {
                        const { new: newVal, old: oldVal } = getVal('deleted_at')
                        if (newVal && !oldVal) {
                            changes.push(
                                <li key="soft_delete" className="text-gray-800">
                                    <span className="text-red-600 font-medium">Задача перемещена в корзину</span>
                                </li>
                            )
                        } else if (!newVal && oldVal) {
                            changes.push(
                                <li key="soft_restore" className="text-gray-800">
                                    <span className="text-green-600 font-medium">Задача восстановлена из корзины</span>
                                </li>
                            )
                        }
                    }

                    // 1. Completion Status
                    if (item.changed_fields.includes('is_completed') || item.changed_fields.includes('completed_at')) {
                        const isCompleted = getVal('is_completed').new
                        if (isCompleted) {
                            changes.push(
                                <li key="completion" className="text-gray-800">
                                    Задача отмечена как <span className="font-medium text-green-600">выполненная</span>
                                </li>
                            )
                        } else {
                            changes.push(
                                <li key="completion" className="text-gray-800">
                                    Задача <span className="font-medium text-amber-600">возвращена в работу</span>
                                </li>
                            )
                        }
                    }

                    // 2. Dates (Due Date)
                    if (item.changed_fields.includes('due_date')) {
                        const { new: newVal, old: oldVal } = getVal('due_date')
                        if (newVal && !oldVal) {
                            // Check if it has time (start_time)
                            const hasTime = item.new_record?.start_time
                            const dateStr = format(new Date(newVal as string), 'd MMMM yyyy', { locale: ru })
                            const timeStr = hasTime ? ` в ${format(new Date(item.new_record?.start_time as string), 'HH:mm')}` : ''

                            changes.push(
                                <li key="due_date" className="text-gray-800">
                                    Установлен срок выполнения: <span className="font-medium">{dateStr}{timeStr}</span>
                                </li>
                            )
                        } else if (!newVal && oldVal) {
                            changes.push(
                                <li key="due_date" className="text-gray-800">
                                    <span className="text-red-500">Удален срок выполнения</span>
                                </li>
                            )
                        } else if (newVal && oldVal) {
                            const hasTime = item.new_record?.start_time
                            const dateStr = format(new Date(newVal as string), 'd MMMM yyyy', { locale: ru })
                            const timeStr = hasTime ? ` в ${format(new Date(item.new_record?.start_time as string), 'HH:mm')}` : ''

                            changes.push(
                                <li key="due_date" className="text-gray-800">
                                    Срок выполнения изменен на: <span className="font-medium">{dateStr}{timeStr}</span>
                                </li>
                            )
                        }
                    }

                    // 3. Description logic (IGNORED per user request)
                    // We keep 'description' in processedFields to prevent it from showing in generic fallback,
                    // but we don't generate any UI for it here.

                    // 4. Title logic
                    if (item.changed_fields.includes('title')) {
                        const { new: newVal, old: oldVal } = getVal('title')
                        changes.push(
                            <ExpandableChange
                                key="title"
                                label="Изменено название"
                                oldVal={oldVal}
                                newVal={newVal}
                            />
                        )
                    }

                    // 5. Time logic (start_time)
                    if (item.changed_fields.includes('start_time')) {
                        const { new: newVal, old: oldVal } = getVal('start_time')
                        if (newVal && !oldVal) {
                            changes.push(
                                <li key="start_time" className="text-gray-800">
                                    Установлено время: <span className="font-medium">{format(new Date(newVal as string), 'HH:mm')}</span>
                                </li>
                            )
                        } else if (!newVal && oldVal) {
                            changes.push(
                                <li key="start_time" className="text-gray-800">
                                    <span className="text-red-500">Удалено время (задача на весь день)</span>
                                </li>
                            )
                        } else if (newVal && oldVal) {
                            changes.push(
                                <li key="start_time" className="text-gray-800">
                                    Время изменено: <span className="font-medium">{format(new Date(newVal as string), 'HH:mm')}</span>
                                </li>
                            )
                        }
                    }

                    // 6. Structure Changes (Project, Section, Parent)
                    if (item.changed_fields.includes('project_id')) {
                        const { new: newVal } = getVal('project_id')
                        const projectName = newVal ? projectMap.get(newVal as string) : null
                        changes.push(
                            <li key="project" className="text-gray-800">
                                <span>Задача перемещена в проект </span>
                                <span className="font-medium text-blue-600">
                                    {projectName ? `«${projectName}»` : '...'}
                                </span>
                            </li>
                        )
                    }

                    if (item.changed_fields.includes('section_id')) {
                        const { new: newVal } = getVal('section_id')
                        const sectionName = newVal ? sectionMap.get(newVal as string) : null
                        changes.push(
                            <li key="section" className="text-gray-800">
                                <span>Задача перемещена в колонку </span>
                                <span className="font-medium text-blue-600">
                                    {sectionName ? `«${sectionName}»` : '...'}
                                </span>
                            </li>
                        )
                    }

                    if (item.changed_fields.includes('parent_id')) {
                        const { new: newVal, old: oldVal } = getVal('parent_id')
                        const parentTitle = newVal ? taskMap.get(newVal as string) : null

                        if (newVal && !oldVal) {
                            changes.push(
                                <li key="parent" className="text-gray-800">
                                    <span>Преобразована в подзадачу для </span>
                                    <span className="font-medium text-blue-600">
                                        {parentTitle ? `«${parentTitle}»` : 'другой задачи'}
                                    </span>
                                </li>
                            )
                        } else if (!newVal && oldVal) {
                            changes.push(
                                <li key="parent" className="text-gray-800">
                                    <span className="font-medium text-blue-600">Преобразована в основную задачу</span>
                                </li>
                            )
                        } else {
                            changes.push(
                                <li key="parent" className="text-gray-800">
                                    <span>Перемещена в другую родительскую задачу: </span>
                                    <span className="font-medium text-blue-600">
                                        {parentTitle ? `«${parentTitle}»` : '...'}
                                    </span>
                                </li>
                            )
                        }
                    }

                    // 7. Generic fallback for other fields
                    const processedFields = [
                        'is_completed', 'completed_at', 'due_date',
                        'description', // Explicitly processed (ignored)
                        'title', 'start_time', 'end_time', 'deleted_at',
                        'project_id', 'section_id', 'parent_id' // Newly processed
                    ]
                    const otherFields = item.changed_fields.filter(f => !processedFields.includes(f))

                    otherFields.forEach(field => {
                        const label = FIELD_LABELS[field] || field
                        const oldVal = item.old_record?.[field as keyof typeof item.old_record]
                        const newVal = item.new_record?.[field as keyof typeof item.new_record]

                        const formatVal = (v: any) => {
                            if (typeof v === 'boolean') return v ? 'Да' : 'Нет'
                            if (v === null || v === undefined) return 'Пусто'
                            return String(v)
                        }

                        changes.push(
                            <li key={field} className="flex flex-col sm:block">
                                <span className="font-medium">{label}:</span>{' '}
                                <span className="text-gray-500 line-through decoration-gray-400/50 mr-1">{formatVal(oldVal)}</span>
                                <span className="text-gray-400">→</span>{' '}
                                <span className="text-gray-800">{formatVal(newVal)}</span>
                            </li>
                        )
                    })

                    if (changes.length > 0) {
                        details = (
                            <ul className="text-sm text-gray-600 space-y-1">
                                {changes}
                            </ul>
                        )
                    }
                } else if (item.operation === 'UPDATE') {
                    // Fallback for updates without specific field changes recorded
                    details = (
                        <p className="text-sm text-gray-500 italic">
                            Обновлены детали задачи
                        </p>
                    )
                }

                // Skip rendering if it's an update with no processing details
                if (item.operation === 'UPDATE' && !details) {
                    return null
                }

                return (
                    <div key={item.id} className="relative pl-4 group">
                        <div className="absolute left-[19px] top-8 bottom-[-16px] w-px bg-gray-100 group-last:hidden" />

                        <div className="flex gap-4 items-start w-full group/item">
                            <div className={clsx("shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10", colorClass)}>
                                {icon}
                            </div>
                            <div className="flex-1 bg-gray-50/50 rounded-lg p-3 border border-gray-100/50">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="text-sm w-full">
                                        {item.operation !== 'UPDATE' && (
                                            <div className="font-semibold text-gray-800 mb-1">{actionText}</div>
                                        )}
                                        {details}
                                    </div>
                                    <div className="flex items-start gap-2 shrink-0">
                                        <span className="text-xs text-gray-400 whitespace-nowrap pt-0.5" title={format(date, 'PPpp', { locale: ru })}>
                                            {format(date, 'd MMM, HH:mm', { locale: ru })}
                                        </span>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                            title="Удалить запись"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
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
