import { X } from 'lucide-react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'

type ImageViewerProps = {
    src: string | null
    onClose: () => void
}

export function ImageViewer({ src, onClose }: ImageViewerProps) {
    return (
        <Transition appear show={!!src} as={Fragment}>
            <Dialog as="div" className="relative z-[200]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-lg bg-transparent text-left align-middle shadow-xl transition-all relative outline-none">
                                <button
                                    onClick={onClose}
                                    className="absolute -top-2 right-0 p-2 text-white/70 hover:text-white bg-black/50 rounded-full z-10 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                                <img
                                    src={src || ''}
                                    alt="Preview"
                                    className="w-full h-auto max-h-[90vh] object-contain rounded-md"
                                />
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
