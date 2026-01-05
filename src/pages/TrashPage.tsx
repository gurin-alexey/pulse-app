import { useState } from "react"
import { useTasks } from "@/hooks/useTasks"
import { useTrashProjects } from "@/hooks/useTrashProjects"
import { useTrashActions } from "@/hooks/useTrashActions"
import { Loader2, Trash2, RotateCcw, AlertTriangle, Folder, CheckSquare } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import clsx from "clsx"

export function TrashPage() {
    const [activeTab, setActiveTab] = useState<'tasks' | 'projects'>('tasks')
    const { data: tasks, isLoading: tasksLoading, isError: tasksError, error: tError } = useTasks({ type: 'trash' })
    const { data: projects, isLoading: projectsLoading, isError: projectsError, error: pError } = useTrashProjects()
    const { restoreTask, deleteForever, restoreProject, deleteProjectForever, emptyTrash } = useTrashActions()

    const isLoading = tasksLoading || projectsLoading
    const isError = tasksError || projectsError

    if (isLoading) return <div className="flex items-center justify-center h-full text-gray-400"><Loader2 className="animate-spin mr-2" />Loading...</div>

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-red-500 p-8 text-center">
                <AlertTriangle size={48} className="mb-4" />
                <h2 className="font-bold text-lg mb-2">Error loading trash</h2>
                <p className="text-sm opacity-80 max-w-md">
                    {(tError as any)?.message || (pError as any)?.message || 'Unknown error occurred'}
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    Retry
                </button>
            </div>
        )
    }

    const handleRestoreTask = (id: string) => restoreTask.mutate(id)
    const handleDeleteTaskForever = (id: string) => {
        if (confirm('Delete this task forever? cannot be undone.')) {
            deleteForever.mutate(id)
        }
    }

    const handleRestoreProject = (id: string) => restoreProject.mutate(id)
    const handleDeleteProjectForever = (id: string) => {
        if (confirm('Delete this project forever? All its tasks and sections will be permanently removed. This cannot be undone.')) {
            deleteProjectForever.mutate(id)
        }
    }

    const handleEmptyTrash = () => {
        if (confirm('Empty trash? This will permanently delete all items.')) {
            emptyTrash.mutate()
        }
    }

    const itemCount = activeTab === 'tasks' ? (tasks?.length || 0) : (projects?.length || 0)

    return (
        <div className="h-full flex flex-col bg-gray-50/30">
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4 shrink-0 bg-white sticky top-0 z-10 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Trash2 className="text-red-500" />
                        <h2 className="font-bold text-lg text-gray-800">Trash</h2>
                    </div>

                    {(tasks?.length || 0) + (projects?.length || 0) > 0 && (
                        <button
                            onClick={handleEmptyTrash}
                            className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <Trash2 size={16} />
                            Empty Trash
                        </button>
                    )}
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={clsx(
                            "flex items-center gap-2 px-1 pb-2 font-medium text-sm transition-colors border-b-2",
                            activeTab === 'tasks' ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <CheckSquare size={16} />
                        Tasks
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-500">
                            {tasks?.length || 0}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('projects')}
                        className={clsx(
                            "flex items-center gap-2 px-1 pb-2 font-medium text-sm transition-colors border-b-2",
                            activeTab === 'projects' ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <Folder size={16} />
                        Projects
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-500">
                            {projects?.length || 0}
                        </span>
                    </button>
                </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto pb-20">
                <AnimatePresence mode="wait">
                    {activeTab === 'tasks' ? (
                        <motion.div
                            key="tasks-tab"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="space-y-2"
                        >
                            {tasks?.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-gray-400 opacity-60">
                                    <CheckSquare size={48} className="mb-4" />
                                    <p>No deleted tasks</p>
                                </div>
                            ) : (
                                tasks?.map(task => (
                                    <motion.div
                                        key={task.id}
                                        layout
                                        className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate text-gray-600 line-through decoration-gray-300">
                                                {task.title}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                Deleted {task.deleted_at && new Date(task.deleted_at).toLocaleDateString()}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleRestoreTask(task.id)}
                                                className="p-2 text-blue-500 hover:bg-blue-50 rounded"
                                                title="Restore"
                                            >
                                                <RotateCcw size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTaskForever(task.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded"
                                                title="Delete Forever"
                                            >
                                                <AlertTriangle size={18} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="projects-tab"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-2"
                        >
                            {projects?.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-gray-400 opacity-60">
                                    <Folder size={48} className="mb-4" />
                                    <p>No deleted projects</p>
                                </div>
                            ) : (
                                projects?.map(project => (
                                    <motion.div
                                        key={project.id}
                                        layout
                                        className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between group"
                                    >
                                        <div className="flex-1 min-w-0 flex items-center gap-3">
                                            <Folder className="text-gray-300" size={20} />
                                            <div>
                                                <div className="font-medium text-gray-600">
                                                    {project.name}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    Deleted {project.deleted_at && new Date(project.deleted_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleRestoreProject(project.id)}
                                                className="p-2 text-blue-500 hover:bg-blue-50 rounded"
                                                title="Restore"
                                            >
                                                <RotateCcw size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteProjectForever(project.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded"
                                                title="Delete Forever"
                                            >
                                                <AlertTriangle size={18} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
