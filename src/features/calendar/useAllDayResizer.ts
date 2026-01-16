import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'pulse_all_day_max_rows'
const DEFAULT_ROWS = 8
const MIN_ROWS = 2
const MAX_ROWS = 20
const ROW_HEIGHT = 22

type UseAllDayResizerParams = {
    containerRef: React.RefObject<HTMLElement>
}

export const useAllDayResizer = ({ containerRef }: UseAllDayResizerParams) => {
    const [maxRows, setMaxRows] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            return saved ? Math.max(MIN_ROWS, Math.min(MAX_ROWS, parseInt(saved, 10))) : DEFAULT_ROWS
        } catch {
            return DEFAULT_ROWS
        }
    })

    const isDragging = useRef(false)
    const startY = useRef(0)
    const startRows = useRef(maxRows)
    const resizerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, String(maxRows))
        } catch { }
    }, [maxRows])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging.current) return
        const deltaY = e.clientY - startY.current
        const deltaRows = Math.round(deltaY / ROW_HEIGHT)
        const newRows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, startRows.current + deltaRows))
        setMaxRows(newRows)
    }, [])

    const handleMouseUp = useCallback(() => {
        if (isDragging.current) {
            isDragging.current = false
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            if (resizerRef.current) {
                resizerRef.current.style.background = 'transparent'
                const handle = resizerRef.current.querySelector('.resizer-handle') as HTMLElement
                if (handle) handle.style.background = '#d1d5db'
            }
        }
    }, [])

    const handleMouseDown = useCallback((e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        isDragging.current = true
        startY.current = e.clientY
        startRows.current = maxRows
        document.body.style.cursor = 'row-resize'
        document.body.style.userSelect = 'none'
    }, [maxRows])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        let positionInterval: number | null = null

        const findAllDayBottom = (): number | null => {
            // Find the header row that contains "Весь день" or the all-day section
            // In timeGrid view, look for the row that separates all-day from time slots
            
            // Method 1: Find the divider row
            const divider = container.querySelector('.fc-timegrid-divider')
            if (divider) {
                const rect = divider.getBoundingClientRect()
                const containerRect = container.getBoundingClientRect()
                return rect.top - containerRect.top + rect.height / 2
            }

            // Method 2: Find the all-day section row
            const allDayRow = container.querySelector('tr.fc-scrollgrid-section-all-day')
            if (allDayRow) {
                const rect = allDayRow.getBoundingClientRect()
                const containerRect = container.getBoundingClientRect()
                return rect.bottom - containerRect.top
            }

            // Method 3: Find by looking at slot structure
            const slots = container.querySelector('.fc-timegrid-slots')
            if (slots) {
                const rect = slots.getBoundingClientRect()
                const containerRect = container.getBoundingClientRect()
                return rect.top - containerRect.top
            }

            // Method 4: Find by time axis
            const timeAxis = container.querySelector('.fc-timegrid-slot-label[data-time="07:00:00"], .fc-timegrid-slot-label[data-time="00:00:00"]')
            if (timeAxis) {
                const rect = timeAxis.getBoundingClientRect()
                const containerRect = container.getBoundingClientRect()
                return rect.top - containerRect.top
            }

            return null
        }

        const createResizer = () => {
            if (resizerRef.current) return

            const resizer = document.createElement('div')
            resizer.className = 'pulse-all-day-resizer'
            resizer.style.cssText = `
                position: absolute;
                left: 0;
                right: 0;
                height: 14px;
                cursor: row-resize;
                z-index: 50;
                background: transparent;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s;
            `

            const handle = document.createElement('div')
            handle.className = 'resizer-handle'
            handle.style.cssText = `
                width: 50px;
                height: 5px;
                background: #d1d5db;
                border-radius: 3px;
                transition: background 0.15s, transform 0.15s;
            `
            resizer.appendChild(handle)

            resizer.addEventListener('mouseenter', () => {
                if (!isDragging.current) {
                    resizer.style.background = 'rgba(99, 102, 241, 0.08)'
                    handle.style.background = '#6366f1'
                    handle.style.transform = 'scaleX(1.2)'
                }
            })

            resizer.addEventListener('mouseleave', () => {
                if (!isDragging.current) {
                    resizer.style.background = 'transparent'
                    handle.style.background = '#d1d5db'
                    handle.style.transform = 'scaleX(1)'
                }
            })

            resizer.addEventListener('mousedown', handleMouseDown as any)

            container.style.position = 'relative'
            container.appendChild(resizer)
            resizerRef.current = resizer
        }

        const positionResizer = () => {
            if (!resizerRef.current) return

            const bottom = findAllDayBottom()
            if (bottom !== null) {
                resizerRef.current.style.top = `${bottom - 7}px`
                resizerRef.current.style.display = 'flex'
            } else {
                resizerRef.current.style.display = 'none'
            }
        }

        // Wait for FullCalendar to render
        const initTimeout = setTimeout(() => {
            createResizer()
            positionResizer()
            positionInterval = window.setInterval(positionResizer, 300)
        }, 300)

        const handleResize = () => positionResizer()
        window.addEventListener('resize', handleResize)

        return () => {
            clearTimeout(initTimeout)
            if (positionInterval) clearInterval(positionInterval)
            window.removeEventListener('resize', handleResize)
            if (resizerRef.current) {
                resizerRef.current.remove()
                resizerRef.current = null
            }
        }
    }, [containerRef, handleMouseDown])

    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [handleMouseMove, handleMouseUp])

    return { maxRows }
}
