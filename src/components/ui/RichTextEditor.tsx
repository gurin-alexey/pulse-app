import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'
import { Bold, Italic, List, ListOrdered, Code, Quote, Link as LinkIcon, Minus, Type, CheckSquare, Image as ImageIcon } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useCallback, useState, useRef } from 'react'
import { VoiceInputButton } from './VoiceInputButton'
import { uploadImage } from '@/utils/imageUpload'
import { ImageViewer } from './ImageViewer'

type RichTextEditorProps = {
    content: string
    onChange: (content: string) => void
    onBlur?: () => void
    placeholder?: string
    className?: string
    editable?: boolean
}

const MenuButton = ({
    isActive,
    onClick,
    children,
    title
}: {
    isActive: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title?: string
}) => (
    <button
        onClick={onClick}
        title={title}
        className={clsx(
            "p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-500",
            isActive && "bg-gray-100 text-blue-600 font-medium"
        )}
        type="button" // Prevent form submission
    >
        {children}
    </button>
)

export function RichTextEditor({ content, onChange, onBlur, placeholder = "Add a description...", className, editable = true }: RichTextEditorProps) {
    const [showToolbar, setShowToolbar] = useState(false)
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) return

        // Show loading state or optimized placeholder if needed?
        // For now, we await upload.
        const url = await uploadImage(file)
        if (url && editor) {
            editor.chain().focus().setImage({ src: url }).run()
        }
    }

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // We are using a custom Link extension below with specific settings
                // so we disable the one bundled in StarterKit to avoid duplicates.
                // @ts-ignore
                link: false,
            }),
            Placeholder.configure({
                placeholder,
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-500 hover:text-blue-700 underline cursor-pointer',
                },
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Image.configure({
                inline: true,
                allowBase64: true, // fallback
            }),
        ],
        content: content,
        editable: editable,
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] text-gray-600 leading-relaxed text-[13.8px]', // Explicitly slightly smaller than base 14px if needed, or stick to prose-sm
            },
            handleClick: (view, pos, event) => {
                const target = event.target as HTMLElement
                if (target.tagName === 'IMG' && target.hasAttribute('src')) {
                    setPreviewImage(target.getAttribute('src'))
                    return true
                }
                return false
            },
            handlePaste: (view, event) => {
                const items = Array.from(event.clipboardData?.items || [])
                const images = items.filter(item => item.type.indexOf('image') === 0)

                if (images.length > 0) {
                    event.preventDefault()
                    images.forEach(item => {
                        const file = item.getAsFile()
                        if (file) handleImageUpload(file)
                    })
                    return true
                }
                return false
            },
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
                    const files = Array.from(event.dataTransfer.files)
                    const images = files.filter(f => f.type.startsWith('image/'))

                    if (images.length > 0) {
                        event.preventDefault()
                        images.forEach(file => handleImageUpload(file))
                        return true
                    }
                }
                return false
            }
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        onBlur: () => {
            onBlur?.()
        }
    })

    // Update content if it changes externally
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            if (editor.getText() === "" && content) {
                editor.commands.setContent(content)
            } else if (content === "" && editor.getText() !== "") {
                editor.commands.setContent("")
            }
        }
    }, [content, editor])

    const setLink = useCallback(() => {
        if (!editor) return

        const previousUrl = editor.getAttributes('link').href
        const url = window.prompt('URL', previousUrl)

        if (url === null) return

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }, [editor])

    if (!editor) {
        return null
    }

    return (
        <div className={clsx("w-full transition-all relative group", className)}>

            {/* Toggle Toolbar Button */}
            <div className="absolute top-0 right-0 z-10">
                <button
                    onClick={() => setShowToolbar(!showToolbar)}
                    className={clsx(
                        "p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600",
                        showToolbar && "bg-gray-100 text-gray-600"
                    )}
                    // Prevent taking focus away from editor when clicking
                    onMouseDown={(e) => e.preventDefault()}
                    title="Toggle Formatting"
                >
                    <Type size={16} />
                </button>
            </div>

            {/* Toolbar */}
            {showToolbar && (
                <div className="flex items-center gap-1 border-b border-gray-100 pb-2 mb-2 px-1 flex-wrap animate-in slide-in-from-top-1 fade-in duration-200">
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                        title="Bold"
                    >
                        <Bold size={16} />
                    </MenuButton>
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                        title="Italic"
                    >
                        <Italic size={16} />
                    </MenuButton>

                    <div className="w-px h-4 bg-gray-200 mx-1" />

                    <MenuButton
                        onClick={() => editor.chain().focus().toggleTaskList().run()}
                        isActive={editor.isActive('taskList')}
                        title="Checklist"
                    >
                        <CheckSquare size={16} />
                    </MenuButton>
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive('bulletList')}
                        title="Bullet List"
                    >
                        <List size={16} />
                    </MenuButton>
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive('orderedList')}
                        title="Ordered List"
                    >
                        <ListOrdered size={16} />
                    </MenuButton>

                    <div className="w-px h-4 bg-gray-200 mx-1" />

                    <MenuButton
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        isActive={editor.isActive('blockquote')}
                        title="Quote"
                    >
                        <Quote size={16} />
                    </MenuButton>
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleCode().run()}
                        isActive={editor.isActive('code')}
                        title="Code"
                    >
                        <Code size={16} />
                    </MenuButton>

                    <div className="w-px h-4 bg-gray-200 mx-1" />

                    <MenuButton
                        onClick={setLink}
                        isActive={editor.isActive('link')}
                        title="Link"
                    >
                        <LinkIcon size={16} />
                    </MenuButton>
                    <MenuButton
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        isActive={false}
                        title="Horizontal Rule"
                    >
                        <Minus size={16} />
                    </MenuButton>

                    <MenuButton
                        onClick={() => fileInputRef.current?.click()}
                        isActive={false}
                        title="Upload Image"
                    >
                        <ImageIcon size={16} />
                    </MenuButton>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                            if (e.target.files?.[0]) handleImageUpload(e.target.files[0])
                        }}
                    />

                    <div className="w-px h-4 bg-gray-200 mx-1" />

                    <VoiceInputButton
                        onTranscription={(text) => {
                            if (editor) {
                                editor.chain().focus().insertContent(text + ' ').run()
                            }
                        }}
                        className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                    />
                </div>
            )}

            <div className="px-1 pb-1">
                <EditorContent editor={editor} className="min-h-[80px]" />
            </div>

            <ImageViewer src={previewImage} onClose={() => setPreviewImage(null)} />

            <style>{`
                .ProseMirror p.is-editor-empty:first-child::before {
                    color: #9ca3af;
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
                .ProseMirror p {
                    margin-bottom: 0.5em; /* Restore slight spacing for readability */
                    line-height: 1.6;
                }
                .ProseMirror ul, .ProseMirror ol {
                    margin-top: 0;
                    margin-bottom: 0;
                }
                .ProseMirror li {
                    margin-bottom: 0;
                    line-height: 1.2;
                }
                
                /* Task List Styles */
                ul[data-type="taskList"] {
                    list-style: none;
                    padding: 0;
                    margin-top: 0.75em; /* Increased spacing before list */
                    margin-bottom: 0;
                }
                
                ul[data-type="taskList"] li {
                    display: flex;
                    align-items: flex-start;
                    margin-bottom: 0;
                    line-height: 1.15;
                    margin-top: -0.25em; /* Pull items even closer together */
                }

                ul[data-type="taskList"] li > label {
                    flex: 0 0 auto;
                    margin-right: 0.5rem;
                    user-select: none;
                    margin-top: 0.25em; /* adjust for flex-start alignment */
                }

                ul[data-type="taskList"] li > div {
                    flex: 1 1 auto;
                }

                ul[data-type="taskList"] input[type="checkbox"] {
                    cursor: pointer;
                    border-radius: 4px;
                    border: 2px solid #cbd5e1;
                    width: 1.1em;
                    height: 1.1em;
                    appearance: none;
                    background-color: #fff;
                    display: grid;
                    place-content: center;
                    margin: 0;
                }

                ul[data-type="taskList"] input[type="checkbox"]::before {
                    content: "";
                    width: 0.65em;
                    height: 0.65em;
                    transform: scale(0);
                    transition: 120ms transform ease-in-out;
                    box-shadow: inset 1em 1em #fff;
                    background-color: #fff;
                    transform-origin: center;
                    clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
                }

                ul[data-type="taskList"] input[type="checkbox"]:checked {
                    background-color: #3b82f6;
                    border-color: #3b82f6;
                }

                ul[data-type="taskList"] input[type="checkbox"]:checked::before {
                    transform: scale(1);
                }
            `}</style>
        </div>
    )
}
