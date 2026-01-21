/**
 * E2E-подобные тесты для полных сценариев работы с повторяющимися задачами
 * 
 * Эти тесты проверяют комплексные пользовательские сценарии
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    generateRecurringInstances,
    getPastIncompleteInstances,
    getNextOccurrenceDate,
    addUntilToRRule,
    updateDTStartInRRule,
    updateRRuleByDay
} from '@/utils/recurrence'
import type { Task } from '@/types/database'

// Хелпер для создания тестовой задачи
const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-uuid-12345',
    title: 'Утренняя зарядка',
    description: 'Каждый день в 7:00',
    priority: 'high',
    project_id: 'health-project',
    user_id: 'user-1',
    parent_id: null,
    due_date: '2026-01-20',
    start_time: '2026-01-20T07:00:00.000Z',
    end_time: '2026-01-20T07:30:00.000Z',
    recurrence_rule: 'FREQ=DAILY',
    is_completed: false,
    completed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    section_id: null,
    sort_order: 0,
    is_project: false,
    ...overrides
})

// Симуляция in-memory базы данных
class MockDatabase {
    tasks: Map<string, Task> = new Map()
    occurrences: Map<string, { task_id: string; original_date: string; status: string }> = new Map()

    constructor() {
        this.reset()
    }

    reset() {
        this.tasks.clear()
        this.occurrences.clear()
    }

    createTask(task: Task) {
        this.tasks.set(task.id, { ...task })
        return task
    }

    updateTask(taskId: string, updates: Partial<Task>) {
        const task = this.tasks.get(taskId)
        if (task) {
            const updated = { ...task, ...updates }
            this.tasks.set(taskId, updated)
            return updated
        }
        return null
    }

    setOccurrenceStatus(taskId: string, date: string, status: string) {
        const key = `${taskId}_${date}`
        this.occurrences.set(key, { task_id: taskId, original_date: date, status })
    }

    getOccurrencesMap(taskId: string): Record<string, string> {
        const map: Record<string, string> = {}
        this.occurrences.forEach((value, key) => {
            if (value.task_id === taskId) {
                map[key] = value.status
            }
        })
        return map
    }

    getTask(taskId: string) {
        return this.tasks.get(taskId)
    }
}

describe('Сценарий: Создание и выполнение ежедневной задачи', () => {
    let db: MockDatabase

    beforeEach(() => {
        db = new MockDatabase()
    })

    it('Полный цикл: создание → отображение → выполнение → следующий повтор', () => {
        // 1. Создаём повторяющуюся задачу
        const masterTask = createTestTask({
            id: 'master-1',
            due_date: '2026-01-20',
            recurrence_rule: 'FREQ=DAILY'
        })
        db.createTask(masterTask)

        // 2. Генерируем экземпляры для отображения в календаре
        const instances = generateRecurringInstances(
            masterTask,
            new Date('2026-01-20'),
            new Date('2026-01-25'),
            {}
        )

        expect(instances.length).toBe(5)
        expect(instances[0].due_date).toBe('2026-01-20')
        expect(instances[1].due_date).toBe('2026-01-21')
        expect(instances[2].due_date).toBe('2026-01-22')

        // 3. Пользователь выполняет задачу на 20 января
        const completedDate = '2026-01-20'

        // 3a. Создаём выполненный клон
        const clone = {
            ...masterTask,
            id: 'clone-' + Date.now(),
            due_date: completedDate,
            recurrence_rule: null,
            is_completed: true,
            completed_at: new Date().toISOString()
        }
        db.createTask(clone as Task)

        // 3b. Помечаем экземпляр мастера как completed
        db.setOccurrenceStatus('master-1', completedDate, 'completed')

        // 3c. Продвигаем мастера вперёд
        const nextDate = getNextOccurrenceDate(masterTask, new Date(completedDate + 'T12:00:00'))
        expect(nextDate).toBeTruthy()

        const nextDateStr = nextDate!.toISOString().split('T')[0]
        db.updateTask('master-1', {
            due_date: nextDateStr,
            start_time: `${nextDateStr}T07:00:00.000Z`,
            end_time: `${nextDateStr}T07:30:00.000Z`,
            recurrence_rule: updateDTStartInRRule(masterTask.recurrence_rule!, nextDate!)
        })

        // 4. Проверяем результат
        const updatedMaster = db.getTask('master-1')!
        expect(updatedMaster.due_date).toBe('2026-01-21')

        // 5. Генерируем экземпляры снова
        // Мастер теперь начинается с 21 января, поэтому 20 января не генерируется как виртуальный
        const occurrencesMap = db.getOccurrencesMap('master-1')
        const newInstances = generateRecurringInstances(
            updatedMaster,
            new Date('2026-01-20'),
            new Date('2026-01-25'),
            occurrencesMap
        )

        // 20 января не генерируется т.к. мастер уже продвинут на 21
        const jan20 = newInstances.find(i => i.due_date === '2026-01-20')
        expect(jan20).toBeUndefined()

        // Но начиная с 21 - всё есть
        const jan21 = newInstances.find(i => i.due_date === '2026-01-21')
        expect(jan21).toBeTruthy()
        expect(jan21?.is_virtual).toBe(true)
    })
})

describe('Сценарий: Редактирование серии - режим "following"', () => {
    let db: MockDatabase

    beforeEach(() => {
        db = new MockDatabase()
    })

    it('Разделение серии на две независимые', () => {
        // 1. Создаём еженедельную задачу (вторники)
        const masterTask = createTestTask({
            id: 'weekly-1',
            due_date: '2026-01-20', // Tuesday
            recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU'
        })
        db.createTask(masterTask)

        // 2. Пользователь хочет изменить все повторы начиная с 3 февраля
        const splitDate = '2026-02-03'

        // 3a. Обрезаем старую серию (UNTIL = 2 февраля 23:59:59)
        const untilTime = new Date('2026-02-02T23:59:59Z')
        const truncatedRule = addUntilToRRule(masterTask.recurrence_rule!, untilTime)

        db.updateTask('weekly-1', {
            recurrence_rule: truncatedRule
        })

        // 3b. Архивируем экземпляр на дату разделения
        db.setOccurrenceStatus('weekly-1', splitDate, 'archived')

        // 3c. Создаём новую серию
        const newSeries = {
            ...masterTask,
            id: 'weekly-2',
            title: 'Утренняя зарядка (с февраля)',
            due_date: splitDate,
            start_time: `${splitDate}T08:00:00.000Z`, // Новое время!
            end_time: `${splitDate}T08:30:00.000Z`,
            recurrence_rule: updateRRuleByDay('FREQ=WEEKLY', new Date(splitDate)) // Сохраняем день недели
        }
        db.createTask(newSeries as Task)

        // 4. Проверки
        const oldSeries = db.getTask('weekly-1')!
        expect(oldSeries.recurrence_rule).toContain('UNTIL=')

        // Генерируем экземпляры старой серии - должны закончиться до 3 февраля
        const oldInstances = generateRecurringInstances(
            oldSeries,
            new Date('2026-01-01'),
            new Date('2026-03-01'),
            db.getOccurrencesMap('weekly-1')
        )

        // Все экземпляры старой серии должны быть до 3 февраля
        oldInstances.forEach(i => {
            expect(new Date(i.due_date).getTime()).toBeLessThan(new Date('2026-02-03').getTime())
        })

        // Новая серия начинается с 3 февраля
        expect(db.getTask('weekly-2')!.due_date).toBe('2026-02-03')
    })
})

describe('Сценарий: Пропущенные повторы', () => {
    let db: MockDatabase

    beforeEach(() => {
        db = new MockDatabase()
    })

    it('Обнаружение и обработка пропущенных экземпляров', () => {
        // 1. Создаём задачу с датой начала 5 дней назад
        const today = new Date('2026-01-25')
        const masterTask = createTestTask({
            id: 'daily-1',
            due_date: '2026-01-20',
            recurrence_rule: 'FREQ=DAILY'
        })
        db.createTask(masterTask)

        // 2. Пользователь только 22-го выполнил задачу
        db.setOccurrenceStatus('daily-1', '2026-01-22', 'completed')

        // 3. Проверяем пропущенные
        const occurrencesMap = db.getOccurrencesMap('daily-1')
        const pastIncomplete = getPastIncompleteInstances(masterTask, occurrencesMap, today)

        // 20, 21, 23, 24 - должны быть пропущенными (22 выполнен)
        expect(pastIncomplete).toContain('2026-01-20')
        expect(pastIncomplete).toContain('2026-01-21')
        expect(pastIncomplete).toContain('2026-01-23')
        expect(pastIncomplete).toContain('2026-01-24')
        expect(pastIncomplete).not.toContain('2026-01-22')

        // 4. Пользователь решает пометить все как skipped
        pastIncomplete.forEach(date => {
            db.setOccurrenceStatus('daily-1', date, 'skipped')
        })

        // 5. Генерируем экземпляры - пропущенные не должны отображаться
        const updatedOccurrences = db.getOccurrencesMap('daily-1')
        const instances = generateRecurringInstances(
            masterTask,
            new Date('2026-01-20'),
            new Date('2026-01-27'),
            updatedOccurrences
        )

        // Только 22 (completed) и 25, 26 (будущие) должны остаться
        const visibleDates = instances.map(i => i.due_date)
        expect(visibleDates).not.toContain('2026-01-20')
        expect(visibleDates).not.toContain('2026-01-21')
        expect(visibleDates).toContain('2026-01-22')
        expect(visibleDates).not.toContain('2026-01-23')
        expect(visibleDates).not.toContain('2026-01-24')
        expect(visibleDates).toContain('2026-01-25')
        expect(visibleDates).toContain('2026-01-26')
    })
})

describe('Сценарий: Редактирование только одного экземпляра', () => {
    let db: MockDatabase

    beforeEach(() => {
        db = new MockDatabase()
    })

    it('Перенос одного экземпляра на другой день без влияния на серию', () => {
        // 1. Создаём ежедневную задачу
        const masterTask = createTestTask({
            id: 'daily-1',
            due_date: '2026-01-20',
            recurrence_rule: 'FREQ=DAILY'
        })
        db.createTask(masterTask)

        // 2. Пользователь переносит экземпляр 22 января на 23 января
        const movedDate = '2026-01-22'
        const newDate = '2026-01-23'

        // 2a. Архивируем оригинальный экземпляр
        db.setOccurrenceStatus('daily-1', movedDate, 'archived')

        // 2b. Создаём независимую задачу на новую дату
        const singleTask = {
            ...masterTask,
            id: 'single-task-1',
            due_date: newDate,
            start_time: `${newDate}T07:00:00.000Z`,
            end_time: `${newDate}T07:30:00.000Z`,
            recurrence_rule: null // Важно: не повторяется!
        }
        db.createTask(singleTask as Task)

        // 3. Проверяем что серия не изменилась
        const master = db.getTask('daily-1')!
        expect(master.due_date).toBe('2026-01-20')
        expect(master.recurrence_rule).toBe('FREQ=DAILY')

        // 4. Генерируем экземпляры - 22 января не должно быть
        const instances = generateRecurringInstances(
            master,
            new Date('2026-01-20'),
            new Date('2026-01-27'),
            db.getOccurrencesMap('daily-1')
        )

        const dates = instances.map(i => i.due_date)
        expect(dates).toContain('2026-01-20')
        expect(dates).toContain('2026-01-21')
        expect(dates).not.toContain('2026-01-22') // Архивирован
        expect(dates).toContain('2026-01-23') // Это другой экземпляр серии, не перенесённый
        expect(dates).toContain('2026-01-24')

        // Перенесённая задача существует отдельно
        const single = db.getTask('single-task-1')!
        expect(single.due_date).toBe('2026-01-23')
        expect(single.recurrence_rule).toBeNull()
    })
})

describe('Сценарий: Завершение серии', () => {
    let db: MockDatabase

    beforeEach(() => {
        db = new MockDatabase()
    })

    it('Выполнение последнего экземпляра завершает мастера', () => {
        // 1. Создаём задачу с ограничением COUNT=3
        const masterTask = createTestTask({
            id: 'limited-1',
            due_date: '2026-01-20',
            recurrence_rule: 'FREQ=DAILY;COUNT=3' // Только 3 повтора
        })
        db.createTask(masterTask)

        // 2. Генерируем экземпляры
        const instances = generateRecurringInstances(
            masterTask,
            new Date('2026-01-01'),
            new Date('2026-02-28'),
            {}
        )

        expect(instances.length).toBe(3)
        expect(instances[0].due_date).toBe('2026-01-20')
        expect(instances[1].due_date).toBe('2026-01-21')
        expect(instances[2].due_date).toBe('2026-01-22')

        // 3. Выполняем все экземпляры
        for (const instance of instances) {
            db.setOccurrenceStatus('limited-1', instance.due_date as string, 'completed')
        }

        // 4. При выполнении последнего - следующей даты нет
        const lastInstance = instances[2]
        const nextDate = getNextOccurrenceDate(masterTask, new Date(lastInstance.due_date + 'T12:00:00'))

        expect(nextDate).toBeNull()

        // 5. Мастер должен быть завершён
        db.updateTask('limited-1', {
            is_completed: true,
            completed_at: new Date().toISOString(),
            recurrence_rule: null
        })

        const master = db.getTask('limited-1')!
        expect(master.is_completed).toBe(true)
        expect(master.recurrence_rule).toBeNull()
    })
})

describe('Сценарий: All-day задачи', () => {
    let db: MockDatabase

    beforeEach(() => {
        db = new MockDatabase()
    })

    it('Корректная работа без start_time и end_time', () => {
        // 1. Создаём all-day задачу
        const masterTask = createTestTask({
            id: 'allday-1',
            due_date: '2026-01-20',
            start_time: null,
            end_time: null,
            recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO'
        })
        db.createTask(masterTask)

        // 2. Генерируем экземпляры
        const instances = generateRecurringInstances(
            masterTask,
            new Date('2026-01-01'),
            new Date('2026-02-28'),
            {}
        )

        // Все экземпляры должны быть понедельниками
        instances.forEach(instance => {
            expect(instance.start_time).toBeNull()
            expect(instance.end_time).toBeNull()

            const date = new Date(instance.due_date)
            expect(date.getDay()).toBe(1) // Monday
        })
    })
})
