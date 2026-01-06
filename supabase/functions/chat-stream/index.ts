import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { messages, provider, model, systemPrompt } = await req.json()

        if (!messages) {
            throw new Error('Missing messages')
        }

        let result;

        if (provider === 'gemini') {
            const apiKey = Deno.env.get('GEMINI_API_KEY')
            if (!apiKey) throw new Error('GEMINI_API_KEY not set on server')

            const payload: any = {
                contents: messages.map((m: any) => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.content }]
                }))
            }

            if (systemPrompt) {
                payload.systemInstruction = {
                    parts: [{ text: systemPrompt }]
                }
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error?.message || 'Gemini API Error')
            }

            // Format response to match our internal schema
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response"
            result = { content: text }

        } else {
            // Default to OpenAI
            const apiKey = Deno.env.get('OPENAI_API_KEY')
            if (!apiKey) throw new Error('OPENAI_API_KEY not set on server')

            const finalMessages = [...messages];
            if (systemPrompt) {
                finalMessages.unshift({ role: 'system', content: systemPrompt })
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || 'gpt-3.5-turbo',
                    messages: finalMessages,
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error?.message || 'OpenAI API Error')
            }

            result = { content: data.choices[0].message.content }
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
