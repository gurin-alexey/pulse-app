import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { CheckCircle2, History, Archive } from 'lucide-react'
import clsx from 'clsx'

interface OccurrenceCompletionModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (mode: 'all_completed' | 'all_skipped' | 'just_this') => void
    pastCount: number
}

export function OccurrenceCompletionModal({
    isOpen,
    onClose,
    onConfirm,
    pastCount
}: OccurrenceCompletionModalProps) {
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
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                                <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900 mb-2">
                                    У вас есть пропущенные повторы
                                </Dialog.Title>
                                <p className="text-gray-500 text-sm mb-6">
                                    Найдено {pastCount} незавершенных повторений в прошлом. Что с ними сделать?
                                </p>

                                <div className="space-y-3">
                                    <button
                                        onClick={() => onConfirm('all_completed')}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all group text-left"
                                    >
                                        <div className="p-2 rounded-lg bg-green-100 text-green-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <CheckCircle2 size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 group-hover:text-blue-900">Отметить все как выполненные</p>
                                            <p className="text-gray-500 text-xs text-balance">Все прошлые экземпляры будут помечены выполненными.</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => onConfirm('all_skipped')}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white hover:bg-orange-50 hover:border-orange-200 transition-all group text-left"
                                    >
                                        <div className="p-2 rounded-lg bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                            <Archive size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 group-hover:text-orange-900">Отметить все как пропущенные</p>
                                            <p className="text-gray-500 text-xs text-balance">Все прошлые экземпляры будут заархивированы.</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => onConfirm('just_this')}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all group text-left"
                                    >
                                        <div className="p-2 rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 transition-colors">
                                            <History size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">Оставить их как есть</p>
                                            <p className="text-gray-500 text-xs text-balance">Выполнить только сегодняшний экземпляр.</p>
                                        </div>
                                    </button>
                                </div>

                                <div className="mt-8 flex justify-end">
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                        onClick={onClose}
                                    >
                                        Отмена
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
