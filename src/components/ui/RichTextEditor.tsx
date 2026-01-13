import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { Bold, Italic, List, ListOrdered, Code, Quote, Link as LinkIcon, Minus, Type } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useCallback, useState } from 'react'
import { VoiceInputButton } from './VoiceInputButton'

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

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder,
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-500 hover:text-blue-700 underline cursor-pointer',
                },
            }),
        ],
        content: content,
        editable: editable,
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] text-gray-600 leading-relaxed text-[13.8px]', // Explicitly slightly smaller than base 14px if needed, or stick to prose-sm
            },
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
            <div className="absolute top-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => setShowToolbar(!showToolbar)}
                    className={clsx(
                        "p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600",
                        showToolbar && "bg-gray-100 text-gray-600"
                    )}
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

            <style>{`
                .ProseMirror p.is-editor-empty:first-child::before {
                    color: #9ca3af;
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
                .ProseMirror p {
                    margin-bottom: 1.25em; /* Adjusted spacing */
                    line-height: 1.75;
                }
                .ProseMirror ul {
                    list-style-type: disc;
                    padding-left: 1.5em;
                }
                .ProseMirror ol {
                    list-style-type: decimal;
                    padding-left: 1.5em;
                }
                .ProseMirror blockquote {
                    border-left: 3px solid #e5e7eb;
                    padding-left: 1em;
                    font-style: italic;
                }
                .ProseMirror a {
                    color: #3b82f6; 
                    text-decoration: underline;
                    cursor: pointer;
                }
                .ProseMirror a:hover {
                    color: #1d4ed8;
                }
                .ProseMirror hr {
                    border-top: 2px solid #e5e7eb;
                    margin: 1.5em 0;
                }
            `}</style>
        </div>
    )
}
