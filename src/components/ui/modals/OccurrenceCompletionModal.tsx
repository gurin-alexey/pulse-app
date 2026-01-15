import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState, useEffect } from 'react'
import { CheckCircle2, History, Archive, X, Check, ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface OccurrenceCompletionModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (decisions: Record<string, 'completed' | 'skipped' | 'ignore'>) => void
    pastInstances: string[]
}

export function OccurrenceCompletionModal({
    isOpen,
    onClose,
    onConfirm,
    pastInstances
}: OccurrenceCompletionModalProps) {
    const [decisions, setDecisions] = useState<Record<string, 'completed' | 'skipped' | 'ignore'>>({})

    // Initialize decisions as 'ignore' or maybe empty?
    // Let's keep them undefined (unset) initially, or strictly controlled.

    // When modal opens/changes instances, reset decisions
    useEffect(() => {
        if (isOpen) {
            const initial: Record<string, 'completed' | 'skipped' | 'ignore'> = {}
            pastInstances.forEach(date => initial[date] = 'ignore')
            setDecisions(initial)
        }
    }, [isOpen, pastInstances])

    const handleSetDecision = (date: string, status: 'completed' | 'skipped' | 'ignore') => {
        setDecisions(prev => ({ ...prev, [date]: status }))
    }

    const handleConfirm = () => {
        onConfirm(decisions)
    }

    const markAll = (status: 'completed' | 'skipped') => {
        const newDecisions: Record<string, 'completed' | 'skipped' | 'ignore'> = {}
        pastInstances.forEach(date => newDecisions[date] = status)
        setDecisions(newDecisions)
    }

    // Count statistics for the button
    const completedCount = Object.values(decisions).filter(s => s === 'completed').length
    const skippedCount = Object.values(decisions).filter(s => s === 'skipped').length
    const ignoredCount = Object.values(decisions).filter(s => s === 'ignore').length

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                                <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900 mb-2">
                                    Пропущенные повторы
                                </Dialog.Title>
                                <p className="text-gray-500 text-sm mb-6">
                                    Найдено {pastInstances.length} незавершенных повторений. Отметьте, что с ними произошло.
                                </p>

                                {/* List of instances */}
                                <div className="max-h-[60vh] overflow-y-auto mb-6 pr-2 -mr-2 space-y-2">
                                    {pastInstances.map((date) => {
                                        const status = decisions[date]
                                        const dateObj = new Date(date)
                                        return (
                                            <div key={date} className={clsx(
                                                "flex items-center justify-between p-3 rounded-lg border transition-all",
                                                status === 'completed' ? "bg-green-50 border-green-200" :
                                                    status === 'skipped' ? "bg-orange-50 border-orange-200" :
                                                        "bg-white border-gray-100"
                                            )}>
                                                <div className="flex flex-col">
                                                    <span className={clsx(
                                                        "font-medium",
                                                        status === 'completed' ? "text-green-700" :
                                                            status === 'skipped' ? "text-orange-700" :
                                                                "text-gray-700"
                                                    )}>
                                                        {format(dateObj, 'd MMMM yyyy', { locale: ru })}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {format(dateObj, 'EEEE', { locale: ru })}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleSetDecision(date, status === 'completed' ? 'ignore' : 'completed')}
                                                        className={clsx(
                                                            "p-2 rounded-md transition-colors",
                                                            status === 'completed'
                                                                ? "bg-green-100 text-green-700"
                                                                : "hover:bg-green-50 text-gray-300 hover:text-green-600"
                                                        )}
                                                        title="Выполнено"
                                                    >
                                                        <Check size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleSetDecision(date, status === 'skipped' ? 'ignore' : 'skipped')}
                                                        className={clsx(
                                                            "p-2 rounded-md transition-colors",
                                                            status === 'skipped'
                                                                ? "bg-orange-100 text-orange-700"
                                                                : "hover:bg-orange-50 text-gray-300 hover:text-orange-600"
                                                        )}
                                                        title="Пропущено"
                                                    >
                                                        <Archive size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Quick Actions */}
                                <div className="flex gap-2 mb-6 text-sm">
                                    <button
                                        onClick={() => markAll('completed')}
                                        className="text-green-600 hover:text-green-700 font-medium px-3 py-1.5 rounded-md hover:bg-green-50 transition-colors"
                                    >
                                        Все выполнены
                                    </button>
                                    <button
                                        onClick={() => markAll('skipped')}
                                        className="text-orange-600 hover:text-orange-700 font-medium px-3 py-1.5 rounded-md hover:bg-orange-50 transition-colors"
                                    >
                                        Все пропущены
                                    </button>
                                </div>

                                <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                        onClick={onClose}
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2 shadow-sm shadow-blue-200"
                                        onClick={handleConfirm}
                                    >
                                        <span>Продолжить</span>
                                        <ArrowRight size={16} />
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
