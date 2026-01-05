import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { Repeat, Calendar, ListFilter } from 'lucide-react'
import clsx from 'clsx'

type RecurrenceEditMode = 'single' | 'following' | 'all'

interface RecurrenceEditModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (mode: RecurrenceEditMode) => void
    title?: string
}

export function RecurrenceEditModal({ isOpen, onClose, onConfirm, title = "Изменение повторяющегося мероприятия" }: RecurrenceEditModalProps) {
    const [selectedMode, setSelectedMode] = useState<RecurrenceEditMode>('single')

    const options = [
        {
            id: 'single',
            name: 'Только это мероприятие',
            description: 'Изменения коснутся только этого экземпляра.',
            icon: Calendar
        },
        {
            id: 'following',
            name: 'Это и последующие мероприятия',
            description: 'Изменения коснутся этого и всех будущих экземпляров.',
            icon: ListFilter
        },
        {
            id: 'all',
            name: 'Все мероприятия',
            description: 'Изменения коснутся всех экземпляров в серии.',
            icon: Repeat
        }
    ]

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
                                <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900 mb-6">
                                    {title}
                                </Dialog.Title>

                                <div className="space-y-3">
                                    {options.map((option) => (
                                        <label
                                            key={option.id}
                                            className={clsx(
                                                "relative flex cursor-pointer rounded-xl border p-4 shadow-sm focus:outline-none transition-all group",
                                                selectedMode === option.id
                                                    ? "bg-blue-50 border-blue-200 ring-2 ring-blue-500/20"
                                                    : "bg-white border-gray-100 hover:border-gray-300"
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="recurrence-mode"
                                                value={option.id}
                                                checked={selectedMode === option.id}
                                                onChange={() => setSelectedMode(option.id as RecurrenceEditMode)}
                                                className="sr-only"
                                            />
                                            <div className="flex w-full items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={clsx(
                                                        "p-2 rounded-lg transition-colors",
                                                        selectedMode === option.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                                                    )}>
                                                        <option.icon size={20} />
                                                    </div>
                                                    <div className="text-sm">
                                                        <p className={clsx(
                                                            "font-bold",
                                                            selectedMode === option.id ? "text-blue-900" : "text-gray-900"
                                                        )}>
                                                            {option.name}
                                                        </p>
                                                        <p className="text-gray-500 text-xs">
                                                            {option.description}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className={clsx(
                                                    "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                                                    selectedMode === option.id ? "border-blue-600 bg-blue-600" : "border-gray-200"
                                                )}>
                                                    {selectedMode === option.id && <div className="h-2 w-2 rounded-full bg-white" />}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <div className="mt-8 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                        onClick={onClose}
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        type="button"
                                        className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                                        onClick={() => onConfirm(selectedMode)}
                                    >
                                        ОК
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
