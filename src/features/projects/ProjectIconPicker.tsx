import { useState, useRef, useEffect } from "react"
import { PROJECT_ICONS, type ProjectIconName } from "@/utils/projectIcons"
import clsx from "clsx"
import { createPortal } from "react-dom"

interface ProjectIconPickerProps {
    currentIcon: string | null
    onSelect: (iconName: string) => void
    onClose: () => void
    position: { top: number, left: number }
}

export function ProjectIconPicker({ currentIcon, onSelect, onClose, position }: ProjectIconPickerProps) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose()
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [onClose])

    return createPortal(
        <div
            className="fixed inset-0 z-[100] bg-transparent"
            onClick={onClose}
        >
            <div
                ref={ref}
                className="absolute bg-white border border-gray-200 shadow-xl rounded-lg p-3 animate-in fade-in zoom-in-95 duration-100 max-w-[280px]"
                style={{
                    top: position.top,
                    left: position.left,
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="grid grid-cols-6 gap-2">
                    {Object.entries(PROJECT_ICONS).map(([name, Icon]) => (
                        <button
                            key={name}
                            onClick={() => onSelect(name)}
                            className={clsx(
                                "p-2 rounded hover:bg-gray-100 flex items-center justify-center transition-colors",
                                currentIcon === name && "bg-blue-50 text-blue-600"
                            )}
                            title={name}
                        >
                            <Icon size={18} />
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    )
}
