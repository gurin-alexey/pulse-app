// @ts-nocheck
import { google } from '@ai-sdk/google'
import { streamText, tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

export async function POST(req: Request) {
    const { messages } = await req.json()

    // @ts-ignore
    const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
    // @ts-ignore
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const model = google('gemini-1.5-pro-latest')

    const result = streamText({
        model,
        messages,
        system: `Ты — личный помощник в таск-трекере Pulse.
Твоя цель — максимально быстро выполнять команды.
Текущее время сервера: ${new Date().toISOString()}.
1. Если просят создать задачу — молча вызывай createTask. Не переспрашивай.
2. Если просят разбить проект — предлагай шаги.
3. Общайся кратко, на русском языке.`,
        tools: {
            // @ts-ignore
            createTask: tool({
                description: 'Создать новую задачу. Обязательно вызывать, если пользователь хочет что-то сделать/купить/пойти.',
                parameters: z.object({
                    title: z.string().describe('Название задачи'),
                    date: z.string().describe('Дата выполнения (ISO). Если не указано, используй сегодня.').optional(),
                    is_project: z.boolean().describe('True если это проект').optional(),
                }),
                execute: async ({ title, date, is_project }: any) => {
                    console.log('Создание задачи:', title)
                    // Попытка вставки. Примечание: RLS может заблокировать, если нет сессии пользователя.
                    // В реальном приложении передавайте токен доступа пользователя из заголовков.
                    const { data, error } = await supabase.from('tasks').insert({
                        title,
                        due_date: date || new Date().toISOString().split('T')[0],
                        is_project: is_project || false,
                    }).select().single()

                    if (error) {
                        console.error('Task creation error:', error)
                        return { error: error.message }
                    }
                    return { id: data.id, title: data.title, status: 'created' }
                },
            }),
            // @ts-ignore
            getTasks: tool({
                description: 'Получить список задач пользователя.',
                parameters: z.object({
                    filter: z.enum(['today', 'overdue', 'all']).describe('Фильтр')
                }),
                execute: async ({ filter }: any) => {
                    let query = supabase.from('tasks').select('*')
                    if (filter === 'today') {
                        const today = new Date().toISOString().split('T')[0]
                        query = query.eq('due_date', today)
                    }
                    const { data, error } = await query
                    if (error) return { error: error.message }
                    return data
                }
            }),
            // @ts-ignore
            ai_subtasks: tool({
                description: 'Сгенерировать список подзадач для проекта.',
                parameters: z.object({ topic: z.string() }),
                execute: async ({ topic }: any) => {
                    // Basic implementation returning static suggestion for now or use another LLM call?
                    // For speed/demo:
                    return { steps: [`Analyze ${topic}`, `Plan ${topic}`, `Execute ${topic}`] }
                }
            })
        },
    })

    // @ts-ignore
    return result.toDataStreamResponse()
}
