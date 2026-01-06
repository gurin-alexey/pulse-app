import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { Bold, Italic, List, ListOrdered, Code, Quote, Link as LinkIcon, Minus } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useCallback } from 'react'

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
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] text-gray-600 leading-relaxed',
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
        <div className={clsx("w-full border border-transparent rounded-lg transition-all focus-within:border-gray-200 focus-within:ring-4 focus-within:ring-gray-50", className)}>

            {/* Toolbar */}
            <div className="flex items-center gap-1 border-b border-gray-100 pb-2 mb-2 px-1 flex-wrap">
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
            </div>

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
