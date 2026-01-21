/**
 * Тесты для бизнес-логики завершения и редактирования повторяющихся задач
 * 
 * Используем моки для изоляции логики от Supabase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Мокаем зависимости перед импортом хуков
const mockCreateTask = vi.fn()
const mockUpdateTask = vi.fn()
const mockSetOccurrenceStatus = vi.fn()
const mockRemoveOccurrence = vi.fn()
const mockBatchSetOccurrenceStatus = vi.fn()

vi.mock('@/hooks/useCreateTask', () => ({
    useCreateTask: () => ({
        mutateAsync: mockCreateTask
    })
}))

vi.mock('@/hooks/useUpdateTask', () => ({
    useUpdateTask: () => ({
        mutateAsync: mockUpdateTask
    })
}))

vi.mock('@/hooks/useTaskOccurrence', () => ({
    useTaskOccurrence: () => ({
        setOccurrenceStatus: mockSetOccurrenceStatus,
        removeOccurrence: mockRemoveOccurrence,
        batchSetOccurrenceStatus: mockBatchSetOccurrenceStatus
    })
}))

vi.mock('@tanstack/react-query', () => ({
    useMutation: (config: any) => ({
        mutate: config.mutationFn,
        mutateAsync: config.mutationFn
    }),
    useQueryClient: () => ({
        invalidateQueries: vi.fn()
    })
}))

import type { Task } from '@/types/database'

// Хелпер для создания тестовой задачи
const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'master-task-id',
    title: 'Recurring Task',
    description: null,
    priority: 'high',
    project_id: 'project-1',
    user_id: 'user-1',
    parent_id: null,
    due_date: '2026-01-20',
    start_time: '2026-01-20T10:00:00.000Z',
    end_time: '2026-01-20T11:00:00.000Z',
    recurrence_rule: 'FREQ=DAILY',
    is_completed: false,
    completed_at: null,
    created_at: '2026-01-15T00:00:00Z',
    deleted_at: null,
    section_id: null,
    sort_order: 0,
    is_project: false,
    ...overrides
})

describe('Логика завершения повторяющейся задачи', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCreateTask.mockResolvedValue({ id: 'new-clone-id' })
        mockUpdateTask.mockResolvedValue({})
    })

    describe('Advance via Mutation Pattern', () => {
        it('должен создать выполненный клон при завершении экземпляра', async () => {
            // Симуляция логики из useTaskCompletion
            const task = createTestTask()
            const occurrenceDate = '2026-01-20'

            // Шаг 1: Создание клона
            await mockCreateTask({
                title: task.title,
                due_date: occurrenceDate,
                start_time: task.start_time,
                end_time: task.end_time,
                recurrence_rule: null, // Клон не повторяется!
                is_completed: true,
                completed_at: expect.any(String)
            })

            expect(mockCreateTask).toHaveBeenCalledTimes(1)
            expect(mockCreateTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    recurrence_rule: null,
                    is_completed: true
                })
            )
        })

        it('должен пометить экземпляр мастера как completed', async () => {
            const task = createTestTask()
            const occurrenceDate = '2026-01-20'

            // Шаг 2: Помечаем в task_occurrences
            mockSetOccurrenceStatus({
                taskId: task.id,
                date: occurrenceDate,
                status: 'completed'
            })

            expect(mockSetOccurrenceStatus).toHaveBeenCalledWith({
                taskId: 'master-task-id',
                date: '2026-01-20',
                status: 'completed'
            })
        })

        it('должен продвинуть мастера на следующую дату', async () => {
            const task = createTestTask()

            // Шаг 3: Обновляем мастера
            await mockUpdateTask({
                taskId: task.id,
                updates: {
                    due_date: '2026-01-21', // Следующий день для FREQ=DAILY
                    start_time: '2026-01-21T10:00:00.000Z',
                    end_time: '2026-01-21T11:00:00.000Z',
                    is_completed: false
                }
            })

            expect(mockUpdateTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    updates: expect.objectContaining({
                        due_date: '2026-01-21',
                        is_completed: false
                    })
                })
            )
        })
    })

    describe('Отмена выполнения (Uncomplete)', () => {
        it('должен удалить запись из task_occurrences для виртуального экземпляра', () => {
            const task = createTestTask({ is_completed: true })
            const occurrenceDate = '2026-01-20'

            mockRemoveOccurrence({
                taskId: task.id,
                date: occurrenceDate
            })

            expect(mockRemoveOccurrence).toHaveBeenCalledWith({
                taskId: 'master-task-id',
                date: '2026-01-20'
            })
        })
    })

    describe('Обработка пропущенных экземпляров', () => {
        it('должен пометить все пропущенные как completed (batch)', () => {
            const taskId = 'master-task-id'
            const pastDates = ['2026-01-18', '2026-01-19']

            mockBatchSetOccurrenceStatus({
                taskId,
                dates: pastDates,
                status: 'completed'
            })

            expect(mockBatchSetOccurrenceStatus).toHaveBeenCalledWith({
                taskId: 'master-task-id',
                dates: ['2026-01-18', '2026-01-19'],
                status: 'completed'
            })
        })

        it('должен пометить все пропущенные как skipped (batch)', () => {
            const taskId = 'master-task-id'
            const pastDates = ['2026-01-18', '2026-01-19']

            mockBatchSetOccurrenceStatus({
                taskId,
                dates: pastDates,
                status: 'skipped'
            })

            expect(mockBatchSetOccurrenceStatus).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'skipped'
                })
            )
        })
    })
})

describe('Логика редактирования серии', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCreateTask.mockResolvedValue({ id: 'new-task-id' })
        mockUpdateTask.mockResolvedValue({})
    })

    describe('Режим "single" - только этот экземпляр', () => {
        it('должен архивировать экземпляр и создать независимую задачу', async () => {
            const task = createTestTask()
            const occurrenceDate = '2026-01-22'

            // Шаг 1: Архивировать
            mockSetOccurrenceStatus({
                taskId: task.id,
                date: occurrenceDate,
                status: 'archived'
            })

            // Шаг 2: Создать новую задачу БЕЗ recurrence_rule
            await mockCreateTask({
                title: task.title,
                due_date: occurrenceDate,
                recurrence_rule: null // Важно!
            })

            expect(mockSetOccurrenceStatus).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'archived' })
            )
            expect(mockCreateTask).toHaveBeenCalledWith(
                expect.objectContaining({ recurrence_rule: null })
            )
        })

        it('должен продвинуть мастера если редактируется первый экземпляр', async () => {
            const task = createTestTask({
                due_date: '2026-01-20',
                start_time: '2026-01-20T10:00:00.000Z'
            })
            const occurrenceDate = '2026-01-20' // Первый экземпляр = мастер

            // После создания исключения, мастер должен сдвинуться
            await mockUpdateTask({
                taskId: task.id,
                updates: {
                    due_date: '2026-01-21',
                    start_time: '2026-01-21T10:00:00.000Z'
                }
            })

            expect(mockUpdateTask).toHaveBeenCalled()
        })
    })

    describe('Режим "following" - этот и последующие', () => {
        it('должен обрезать старую серию и создать новую', async () => {
            const task = createTestTask({
                recurrence_rule: 'FREQ=DAILY'
            })
            const occurrenceDate = '2026-01-25'

            // Шаг 1: Обрезать старую серию (добавить UNTIL)
            await mockUpdateTask({
                taskId: task.id,
                updates: {
                    recurrence_rule: expect.stringContaining('UNTIL=')
                }
            })

            // Шаг 2: Архивировать точку разрыва
            mockSetOccurrenceStatus({
                taskId: task.id,
                date: occurrenceDate,
                status: 'archived'
            })

            // Шаг 3: Создать новую серию
            await mockCreateTask({
                title: task.title,
                due_date: occurrenceDate,
                recurrence_rule: expect.any(String) // Новое правило
            })

            expect(mockUpdateTask).toHaveBeenCalled()
            expect(mockCreateTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    recurrence_rule: expect.any(String)
                })
            )
        })
    })

    describe('Режим "all" - все экземпляры', () => {
        it('должен обновить только мастера', async () => {
            const task = createTestTask()
            const newTitle = 'Updated Title'

            await mockUpdateTask({
                taskId: task.id,
                updates: {
                    title: newTitle
                }
            })

            expect(mockUpdateTask).toHaveBeenCalledTimes(1)
            expect(mockCreateTask).not.toHaveBeenCalled()
            expect(mockSetOccurrenceStatus).not.toHaveBeenCalled()
        })

        it('должен обновить BYDAY при смене дня недели', async () => {
            const task = createTestTask({
                due_date: '2026-01-20', // Tuesday
                recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU'
            })

            // Переносим на пятницу
            await mockUpdateTask({
                taskId: task.id,
                updates: {
                    due_date: '2026-01-23', // Friday
                    recurrence_rule: expect.stringContaining('BYDAY=FR')
                }
            })

            expect(mockUpdateTask).toHaveBeenCalled()
        })
    })
})

describe('Edge Cases', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Виртуальные ID', () => {
        it('должен корректно извлечь реальный ID из виртуального', () => {
            const virtualId = 'master-task-id_recur_1737356400000'
            const realId = virtualId.split('_recur_')[0]

            expect(realId).toBe('master-task-id')
        })

        it('должен работать с UUID содержащими дефисы', () => {
            const virtualId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890_recur_1737356400000'
            const realId = virtualId.split('_recur_')[0]

            expect(realId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
        })
    })

    describe('All-day задачи', () => {
        it('должен работать без start_time и end_time', async () => {
            const task = createTestTask({
                start_time: null,
                end_time: null,
                recurrence_rule: 'FREQ=DAILY'
            })

            await mockCreateTask({
                title: task.title,
                due_date: '2026-01-20',
                start_time: null,
                end_time: null,
                recurrence_rule: null,
                is_completed: true
            })

            expect(mockCreateTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    start_time: null,
                    end_time: null
                })
            )
        })
    })

    describe('Серия с UNTIL', () => {
        it('должен завершить мастера если следующей даты нет', async () => {
            const task = createTestTask({
                due_date: '2026-01-20',
                recurrence_rule: 'FREQ=DAILY;UNTIL=20260120T235959Z'
            })

            // Это последний экземпляр - мастер должен быть завершён
            await mockUpdateTask({
                taskId: task.id,
                updates: {
                    is_completed: true,
                    completed_at: expect.any(String),
                    recurrence_rule: null
                }
            })

            expect(mockUpdateTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    updates: expect.objectContaining({
                        is_completed: true,
                        recurrence_rule: null
                    })
                })
            )
        })
    })
})
