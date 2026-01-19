import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo)
    }

    private handleReload = () => {
        window.location.reload()
    }

    private handleGoHome = () => {
        window.location.href = '/'
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
                        <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-6 animate-in zoom-in duration-300">
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Что-то пошло не так
                        </h2>

                        <p className="text-gray-500 mb-8 leading-relaxed">
                            Произошла неожиданная ошибка. Мы уже работаем над ее устранением.
                            Попробуйте обновить страницу.
                        </p>

                        {this.state.error && (
                            <div className="mb-6 p-4 bg-gray-50 rounded-lg text-left overflow-auto max-h-32 text-xs font-mono text-gray-600 border border-gray-200">
                                {this.state.error.toString()}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={this.handleReload}
                                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm active:scale-95"
                            >
                                <RefreshCw className="mr-2 h-5 w-5" />
                                Обновить
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="inline-flex items-center justify-center px-6 py-3 border border-gray-200 text-base font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-colors shadow-sm active:scale-95"
                            >
                                <Home className="mr-2 h-5 w-5" />
                                На главную
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
