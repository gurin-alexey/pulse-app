
import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { Search, FileText, CheckCircle2, Calendar, Layout, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTasks } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'

import { useCommandStore } from '@/store/useCommandStore'
// ...

export function GlobalSearch() {
    const { isOpen, setOpen, toggle } = useCommandStore()
    const navigate = useNavigate()
    const [_, setSearchParams] = useSearchParams()

    const { data: tasks } = useTasks({ type: 'all', includeSubtasks: true })
    const { data: projects } = useProjects()

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                toggle()
            }
        }

        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [toggle])



    const handleSelectTask = (taskId: string) => {
        setSearchParams({ task: taskId })
        setOpen(false)
    }

    const handleSelectProject = (projectId: string) => {
        navigate(`/project/${projectId}`)
        setOpen(false)
    }

    return (
        <Command.Dialog
            open={isOpen}
            onOpenChange={setOpen}
            label="Global Search"
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm px-4"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
            >
                <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <Search className="w-5 h-5 text-gray-400 mr-3" />
                    <Command.Input
                        autoFocus
                        placeholder="Search tasks, projects..."
                        className="flex-1 text-lg bg-transparent outline-none placeholder:text-gray-400 dark:text-white"
                    />
                    <div className="flex gap-1">
                        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 dark:bg-gray-800 dark:text-gray-400">
                            <span className="text-xs">Ctrl</span>K
                        </kbd>
                    </div>
                </div>

                <Command.List className="max-h-[60vh] overflow-y-auto p-2 scroll-py-2">
                    <Command.Empty className="py-6 text-center text-sm text-gray-500">
                        No results found.
                    </Command.Empty>

                    {projects && projects.length > 0 && (
                        <Command.Group heading="Projects" className="text-xs font-medium text-gray-500 mb-2 px-2">
                            {projects.map(project => (
                                <Command.Item
                                    key={project.id}
                                    value={`project ${project.name}`}
                                    onSelect={() => handleSelectProject(project.id)}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-gray-700 dark:text-gray-200 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:aria-selected:bg-blue-900/20 dark:aria-selected:text-blue-400 transition-colors group"
                                >
                                    <Layout size={16} className="text-gray-400 group-aria-selected:text-blue-500" />
                                    <span>{project.name}</span>
                                    <ArrowRight size={14} className="ml-auto opacity-0 group-aria-selected:opacity-100" />
                                </Command.Item>
                            ))}
                        </Command.Group>
                    )}

                    {tasks && tasks.length > 0 && (
                        <Command.Group heading="Tasks" className="text-xs font-medium text-gray-500 mt-2 px-2">
                            {tasks.map(task => (
                                <Command.Item
                                    key={task.id}
                                    value={`task ${task.title}`}
                                    onSelect={() => handleSelectTask(task.id)}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-gray-700 dark:text-gray-200 aria-selected:bg-blue-50 aria-selected:text-blue-700 dark:aria-selected:bg-blue-900/20 dark:aria-selected:text-blue-400 transition-colors group"
                                >
                                    <div className={clsx("w-4 h-4 rounded-full border-2 flex items-center justify-center", task.is_completed ? "bg-green-100 border-green-500" : "border-gray-300 group-aria-selected:border-blue-400")}>
                                        {task.is_completed && <CheckCircle2 size={10} className="text-green-600" />}
                                    </div>
                                    <span className={clsx("flex-1 truncate", task.is_completed && "line-through opacity-60")}>
                                        {task.title}
                                    </span>
                                    {task.due_date && (
                                        <span className="text-xs text-gray-400 flex items-center gap-1 group-aria-selected:text-blue-400">
                                            <Calendar size={12} />
                                            {new Date(task.due_date).toLocaleDateString()}
                                        </span>
                                    )}
                                </Command.Item>
                            ))}
                        </Command.Group>
                    )}
                </Command.List>

                <div className="border-t border-gray-100 dark:border-gray-800 p-2 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center text-xs text-gray-400 px-4">
                    <span>Search powered by Pulse</span>
                    <div className="flex gap-2">
                        <span>↑↓ to navigate</span>
                        <span>↵ to select</span>
                    </div>
                </div>

            </motion.div>
        </Command.Dialog>
    )
}
