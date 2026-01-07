import { useEffect } from "react"
import { TrendingUp, DollarSign } from "lucide-react"

export function WeatherRatesWidget() {
    useEffect(() => {
        const id = 'weatherwidget-io-js'
        const d = document
        const s = 'script'
        if (!d.getElementById(id)) {
            const js = d.createElement(s) as HTMLScriptElement
            js.id = id
            js.src = 'https://weatherwidget.io/js/widget.min.js'
            const fjs = d.getElementsByTagName(s)[0]
            fjs.parentNode?.insertBefore(js, fjs)
        } else {
            // If script exists, trigger reload for new elements
            // @ts-ignore
            if (window.__weatherwidget_init) {
                // @ts-ignore
                window.__weatherwidget_init()
            }
        }
    }, [])

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">
            <div className="flex-1 w-full relative min-h-full flex flex-col justify-center">
                <a
                    className="weatherwidget-io"
                    href="https://forecast7.com/ru/48d4635d05/dnipro/"
                    data-label_1="ДНЕПР"
                    data-days="3"
                    data-theme="sky"
                    style={{
                        display: 'block',
                        position: 'relative',
                        height: '100%',
                        padding: 0,
                        overflow: 'hidden',
                    }}
                >
                    ДНЕПР
                </a>
            </div>
        </div>
    )
}
