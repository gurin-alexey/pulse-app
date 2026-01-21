/**
 * Интеграционные тесты для утилит повторяющихся задач
 * 
 * Тестируемые функции:
 * - generateRecurringInstances: генерация виртуальных экземпляров
 * - getPastIncompleteInstances: поиск пропущенных повторов
 * - getNextOccurrenceDate: расчёт следующей даты
 * - addExDateToRRule / addUntilToRRule: модификация правил
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
    generateRecurringInstances,
    getPastIncompleteInstances,
    getNextOccurrenceDate,
    addExDateToRRule,
    addUntilToRRule,
    updateRRuleByDay,
    updateDTStartInRRule
} from '@/utils/recurrence'
import type { Task } from '@/types/database'

// Хелпер для создания тестовой задачи
const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'test-task-id',
    title: 'Test Task',
    description: null,
    priority: 'high',
    project_id: 'project-1',
    user_id: 'user-1',
    parent_id: null,
    due_date: '2026-01-20',
    start_time: null,
    end_time: null,
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

describe('generateRecurringInstances', () => {
    describe('Генерация ежедневных повторов', () => {
        it('должен создать виртуальные экземпляры для каждого дня в диапазоне', () => {
            const task = createTestTask({
                due_date: '2026-01-20',
                recurrence_rule: 'FREQ=DAILY'
            })

            const rangeStart = new Date('2026-01-20T00:00:00')
            const rangeEnd = new Date('2026-01-25T00:00:00')

            const instances = generateRecurringInstances(task, rangeStart, rangeEnd, {})

            expect(instances.length).toBe(5) // 20, 21, 22, 23, 24
            expect(instances[0].due_date).toBe('2026-01-20')
            expect(instances[0].is_virtual).toBe(true)
            expect(instances[0].original_id).toBe('test-task-id')
        })

        it('должен пропустить экземпляры со статусом "skipped"', () => {
            const task = createTestTask({
                due_date: '2026-01-20',
                recurrence_rule: 'FREQ=DAILY'
            })

            const rangeStart = new Date('2026-01-20T00:00:00')
            const rangeEnd = new Date('2026-01-25T00:00:00')

            const occurrencesMap = {
                'test-task-id_2026-01-22': 'skipped'
            }

            const instances = generateRecurringInstances(task, rangeStart, rangeEnd, occurrencesMap)

            expect(instances.length).toBe(4) // 22 января пропущен
            expect(instances.map(i => i.due_date)).not.toContain('2026-01-22')
        })

        it('должен пометить экземпляр как выполненный, если есть статус "completed"', () => {
            const task = createTestTask({
                due_date: '2026-01-20',
                recurrence_rule: 'FREQ=DAILY'
            })

            const rangeStart = new Date('2026-01-20T00:00:00')
            const rangeEnd = new Date('2026-01-23T00:00:00')

            const occurrencesMap = {
                'test-task-id_2026-01-21': 'completed'
            }

            const instances = generateRecurringInstances(task, rangeStart, rangeEnd, occurrencesMap)

            const jan21 = instances.find(i => i.due_date === '2026-01-21')
            expect(jan21?.is_completed).toBe(true)
        })
    })

    describe('Генерация еженедельных повторов', () => {
        it('должен создать экземпляры для каждой недели', () => {
            const task = createTestTask({
                due_date: '2026-01-20', // Tuesday
                recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU'
            })

            const rangeStart = new Date('2026-01-01T00:00:00')
            const rangeEnd = new Date('2026-02-28T00:00:00')

            const instances = generateRecurringInstances(task, rangeStart, rangeEnd, {})

            // Все экземпляры должны быть во вторник
            instances.forEach(instance => {
                const date = new Date(instance.due_date)
                expect(date.getDay()).toBe(2) // Tuesday = 2
            })
        })
    })

    describe('Задачи со временем', () => {
        it('должен правильно рассчитать start_time и end_time для каждого экземпляра', () => {
            const task = createTestTask({
                due_date: '2026-01-20',
                start_time: '2026-01-20T10:00:00.000Z',
                end_time: '2026-01-20T11:30:00.000Z',
                recurrence_rule: 'FREQ=DAILY'
            })

            const rangeStart = new Date('2026-01-20T00:00:00Z')
            const rangeEnd = new Date('2026-01-23T00:00:00Z')

            const instances = generateRecurringInstances(task, rangeStart, rangeEnd, {})

            instances.forEach(instance => {
                expect(instance.start_time).toBeTruthy()
                expect(instance.end_time).toBeTruthy()

                // Проверяем что длительность сохраняется (1.5 часа)
                const start = new Date(instance.start_time).getTime()
                const end = new Date(instance.end_time).getTime()
                expect(end - start).toBe(90 * 60 * 1000) // 90 минут
            })
        })
    })

    describe('Edge cases', () => {
        it('должен вернуть сам task если нет recurrence_rule', () => {
            const task = createTestTask({ recurrence_rule: null })

            const instances = generateRecurringInstances(
                task,
                new Date('2026-01-01'),
                new Date('2026-01-31'),
                {}
            )

            expect(instances.length).toBe(1)
            expect(instances[0]).toEqual(task)
        })

        it('должен вернуть сам task если нет due_date', () => {
            const task = createTestTask({ due_date: null })

            const instances = generateRecurringInstances(
                task,
                new Date('2026-01-01'),
                new Date('2026-01-31'),
                {}
            )

            expect(instances.length).toBe(1)
        })

        it('должен работать с Map вместо Record', () => {
            const task = createTestTask({
                due_date: '2026-01-20',
                recurrence_rule: 'FREQ=DAILY'
            })

            const occurrencesMap = new Map([
                ['test-task-id_2026-01-22', 'skipped']
            ])

            const instances = generateRecurringInstances(
                task,
                new Date('2026-01-20'),
                new Date('2026-01-25'),
                occurrencesMap
            )

            expect(instances.map(i => i.due_date)).not.toContain('2026-01-22')
        })
    })
})

describe('getPastIncompleteInstances', () => {
    it('должен найти все пропущенные экземпляры в прошлом', () => {
        const task = createTestTask({
            due_date: '2026-01-10',
            recurrence_rule: 'FREQ=DAILY',
            created_at: '2026-01-10T00:00:00Z'
        })

        const referenceDate = new Date('2026-01-15T00:00:00')

        const incomplete = getPastIncompleteInstances(task, {}, referenceDate)

        // 10, 11, 12, 13, 14 - все дни до 15-го
        expect(incomplete.length).toBe(5)
    })

    it('должен исключить выполненные экземпляры', () => {
        const task = createTestTask({
            due_date: '2026-01-10',
            recurrence_rule: 'FREQ=DAILY'
        })

        const occurrencesMap = {
            'test-task-id_2026-01-11': 'completed',
            'test-task-id_2026-01-12': 'skipped'
        }

        const referenceDate = new Date('2026-01-15T00:00:00')

        const incomplete = getPastIncompleteInstances(task, occurrencesMap, referenceDate)

        expect(incomplete).not.toContain('2026-01-11')
        expect(incomplete).not.toContain('2026-01-12')
    })

    it('должен вернуть пустой массив если нет пропущенных', () => {
        const task = createTestTask({
            due_date: '2026-01-15',
            recurrence_rule: 'FREQ=DAILY'
        })

        const referenceDate = new Date('2026-01-15T00:00:00')

        const incomplete = getPastIncompleteInstances(task, {}, referenceDate)

        expect(incomplete.length).toBe(0)
    })
})

describe('getNextOccurrenceDate', () => {
    it('должен вернуть следующую дату для ежедневного повтора', () => {
        const task = createTestTask({
            due_date: '2026-01-20',
            recurrence_rule: 'FREQ=DAILY'
        })

        const completionDate = new Date('2026-01-20T10:00:00')
        const nextDate = getNextOccurrenceDate(task, completionDate)

        expect(nextDate).toBeTruthy()
        expect(nextDate!.toISOString().split('T')[0]).toBe('2026-01-21')
    })

    it('должен вернуть следующую дату для еженедельного повтора', () => {
        const task = createTestTask({
            due_date: '2026-01-20', // Tuesday
            recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU'
        })

        const completionDate = new Date('2026-01-20T10:00:00')
        const nextDate = getNextOccurrenceDate(task, completionDate)

        expect(nextDate).toBeTruthy()
        expect(nextDate!.toISOString().split('T')[0]).toBe('2026-01-27')
    })

    it('должен вернуть null для задачи без recurrence_rule', () => {
        const task = createTestTask({ recurrence_rule: null })

        const nextDate = getNextOccurrenceDate(task, new Date())

        expect(nextDate).toBeNull()
    })

    it('должен вернуть null если серия завершена (UNTIL в прошлом)', () => {
        const task = createTestTask({
            due_date: '2026-01-01',
            recurrence_rule: 'FREQ=DAILY;UNTIL=20260115T000000Z'
        })

        const completionDate = new Date('2026-01-20T10:00:00')
        const nextDate = getNextOccurrenceDate(task, completionDate)

        expect(nextDate).toBeNull()
    })
})

describe('addExDateToRRule', () => {
    it('должен добавить EXDATE к правилу', () => {
        const rule = 'FREQ=DAILY'
        const dateToExclude = new Date('2026-01-22T00:00:00Z')

        const newRule = addExDateToRRule(rule, dateToExclude)

        expect(newRule).toContain('EXDATE:')
        expect(newRule).toContain('20260122')
    })

    it('должен добавить несколько EXDATE при повторных вызовах', () => {
        let rule = 'FREQ=DAILY'
        rule = addExDateToRRule(rule, new Date('2026-01-22T00:00:00Z'))
        rule = addExDateToRRule(rule, new Date('2026-01-25T00:00:00Z'))

        const exdateCount = (rule.match(/EXDATE:/g) || []).length
        expect(exdateCount).toBe(2)
    })
})

describe('addUntilToRRule', () => {
    it('должен добавить UNTIL к правилу без UNTIL', () => {
        const rule = 'RRULE:FREQ=DAILY'
        const untilDate = new Date('2026-01-30T00:00:00Z')

        const newRule = addUntilToRRule(rule, untilDate)

        expect(newRule).toContain('UNTIL=')
        expect(newRule).toContain('20260130')
    })

    it('должен обновить существующий UNTIL', () => {
        const rule = 'RRULE:FREQ=DAILY;UNTIL=20260115T000000Z'
        const untilDate = new Date('2026-01-30T00:00:00Z')

        const newRule = addUntilToRRule(rule, untilDate)

        expect(newRule).toContain('UNTIL=20260130')
        expect(newRule).not.toContain('UNTIL=20260115')

        // Должен быть только один UNTIL
        const untilCount = (newRule.match(/UNTIL=/g) || []).length
        expect(untilCount).toBe(1)
    })
})

describe('updateRRuleByDay', () => {
    it('должен обновить BYDAY для еженедельного правила', () => {
        const rule = 'FREQ=WEEKLY;BYDAY=MO'
        const newDate = new Date('2026-01-23') // Friday

        const newRule = updateRRuleByDay(rule, newDate)

        expect(newRule).toContain('BYDAY=FR')
        expect(newRule).not.toContain('BYDAY=MO')
    })

    it('должен добавить BYDAY если его нет', () => {
        const rule = 'FREQ=WEEKLY'
        const newDate = new Date('2026-01-21') // Wednesday

        const newRule = updateRRuleByDay(rule, newDate)

        expect(newRule).toContain('BYDAY=WE')
    })

    it('не должен менять правило если FREQ не WEEKLY', () => {
        const rule = 'FREQ=DAILY'
        const newDate = new Date('2026-01-23')

        const newRule = updateRRuleByDay(rule, newDate)

        expect(newRule).toBe(rule)
    })
})

describe('updateDTStartInRRule', () => {
    it('должен добавить DTSTART к правилу без него', () => {
        const rule = 'RRULE:FREQ=DAILY'
        const newStart = new Date('2026-02-01T10:00:00Z')

        const newRule = updateDTStartInRRule(rule, newStart)

        expect(newRule).toContain('DTSTART:')
        expect(newRule).toContain('20260201')
    })

    it('должен обновить существующий DTSTART', () => {
        const rule = 'DTSTART:20260101T100000Z\nRRULE:FREQ=DAILY'
        const newStart = new Date('2026-02-15T14:00:00Z')

        const newRule = updateDTStartInRRule(rule, newStart)

        expect(newRule).toContain('DTSTART:20260215')
        expect(newRule).not.toContain('20260101')

        // Должен быть только один DTSTART
        const dtstartCount = (newRule.match(/DTSTART:/g) || []).length
        expect(dtstartCount).toBe(1)
    })
})
