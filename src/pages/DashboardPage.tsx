import { GreetingWidget } from "@/features/dashboard/GreetingWidget"
import { AIAssistantWidget } from "@/features/dashboard/AIAssistantWidget"
import { QuickCaptureWidget } from "@/features/dashboard/QuickCaptureWidget"
import { ProjectsWidget } from "@/features/dashboard/ProjectsWidget"
import { WeatherRatesWidget } from "@/features/dashboard/WeatherRatesWidget"
import { Plus, LayoutGrid, GripVertical } from "lucide-react"
import { toast } from "sonner"
import { useSettings } from "@/store/useSettings"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import clsx from "clsx"

const WIDGET_CONFIG: Record<string, { component: React.ComponentType, className: string, defaultVisible: boolean }> = {
    greeting: { component: GreetingWidget, className: "lg:col-span-2 h-[220px]", defaultVisible: true },
    weather: { component: WeatherRatesWidget, className: "lg:col-span-1 h-[220px]", defaultVisible: true },
    quick_capture: { component: QuickCaptureWidget, className: "lg:col-span-1 h-[220px]", defaultVisible: true },
    projects: { component: ProjectsWidget, className: "lg:col-span-2 h-[450px]", defaultVisible: true },
    ai_chat: { component: AIAssistantWidget, className: "lg:col-span-2 h-[450px]", defaultVisible: true },
}

function SortableWidget({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
    }

    return (
        <div ref={setNodeRef} style={style} className={clsx("relative group touch-none", className)}>
            <div
                {...attributes}
                {...listeners}
                className="absolute top-3 right-3 p-1.5 bg-white/80 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing z-20 hover:bg-white shadow-sm border border-transparent hover:border-gray-100 transition-all"
            >
                <GripVertical size={16} className="text-gray-400" />
            </div>
            {children}
            {isDragging && <div className="absolute inset-0 bg-gray-100/50 rounded-2xl border-2 border-blue-200 z-40" />}
        </div>
    )
}

export function DashboardPage() {
    const { settings, updateSettings } = useSettings()

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const defaultOrder = ['greeting', 'weather', 'quick_capture', 'projects', 'ai_chat']
    const order = (settings?.preferences?.dashboard_widget_order as string[]) || defaultOrder

    // Filter by visibility settings if needed, but for now we just show what's in the list 
    // AND enabled in settings.dashboard_layout.
    // However, if we only render enabled ones, Drag and Drop arrayMove might get confused if indices mismatch.
    // Best practice: Keep the 'order' list complete, but only render if enabled.
    // But SortableContext needs the list of ids being rendered.

    const layout = settings?.dashboard_layout || {
        greeting: true,
        weather: true,
        rates: true,
        ai_chat: true,
        quick_capture: true,
        deadline_tasks: true
    }

    // Since 'projects' widget maps to 'deadline_tasks' setting in previous logic, or maybe just always show?
    // Let's assume 'projects' widget corresponds to 'deadline_tasks' layout toggle based on previous file content.
    // Previous file: layout.deadline_tasks && <DeadlineTasksWidget> (which was removed)
    // AND <ProjectsWidget>.
    // Wait, in previous file `ProjectsWidget` was ALWAYS shown (lines 84-86).
    // `DeadlineTasksWidget` was conditional.
    // I should probably make `ProjectsWidget` conditional on `deadline_tasks`? 
    // Or just treat it as a new standard widget.
    // The user said "Deadline Widget... only multistep". The `ProjectsWidget` header is "DEADLINE".
    // So `ProjectsWidget` IS the "Deadline Widget".

    // I'll map the visibility keys:
    // greeting -> layout.greeting
    // weather -> layout.weather || layout.rates
    // quick_capture -> layout.quick_capture
    // projects -> true (it was hardcoded visible)
    // ai_chat -> layout.ai_chat

    const isVisible = (id: string) => {
        if (id === 'greeting') return layout.greeting
        if (id === 'weather') return layout.weather || layout.rates
        if (id === 'quick_capture') return layout.quick_capture
        if (id === 'projects') return true
        if (id === 'ai_chat') return layout.ai_chat
        return true
    }

    const visibleWidgets = order.filter(id => WIDGET_CONFIG[id] && isVisible(id))

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (active.id !== over?.id) {
            const oldIndex = order.indexOf(active.id as string)
            const newIndex = order.indexOf(over?.id as string)

            // We move in the FULL list 'order', not just visible ones, to preserve hidden items' positions relativity or just append.
            // Actually, safest to just move within the full list.
            const newOrder = arrayMove(order, oldIndex, newIndex)

            updateSettings({
                preferences: {
                    ...settings?.preferences,
                    dashboard_widget_order: newOrder
                }
            })
        }
    }

    return (
        <div className="h-full overflow-y-auto p-4 md:p-8 bg-gray-50/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Dashboard</h1>
                    <p className="text-gray-400 text-sm mt-1">Your personal command center</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => toast.info("Drag widgets by the handle to reorder!")}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                        title="Edit Layout"
                    >
                        <LayoutGrid size={20} />
                    </button>
                    <button
                        onClick={() => toast.success("Widget Gallery opened (Mock)")}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 font-medium active:scale-95"
                    >
                        <Plus size={18} />
                        <span>Add Widget</span>
                    </button>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={visibleWidgets}
                    strategy={rectSortingStrategy}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto pb-10">
                        {visibleWidgets.map((id) => {
                            const config = WIDGET_CONFIG[id]
                            const Component = config.component
                            return (
                                <SortableWidget key={id} id={id} className={config.className}>
                                    <Component />
                                </SortableWidget>
                            )
                        })}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}
