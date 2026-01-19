import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';

export interface ContextMenuItem {
    label?: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    variant?: 'default' | 'danger';
    className?: string;
    submenu?: ContextMenuItem[];
    type?: 'item' | 'separator' | 'custom';
    content?: React.ReactNode;
}

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    items: ContextMenuItem[];
}

const MenuItem: React.FC<{ item: ContextMenuItem; onClose: () => void; depth: number }> = ({ item, onClose, depth }) => {
    const [showSubmenu, setShowSubmenu] = useState(false);
    const itemRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setShowSubmenu(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setShowSubmenu(false);
        }, 150);
    };

    if (item.type === 'separator') {
        return <div className="my-1 border-t border-gray-100" />;
    }

    if (item.type === 'custom') {
        return <>{item.content}</>;
    }

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                type="button"
                onClick={(e) => {
                    if (item.submenu) return;
                    e.stopPropagation();
                    item.onClick?.();
                    onClose();
                }}
                className={clsx(
                    "w-full px-3 py-1.5 text-sm flex items-center justify-between gap-3 transition-colors text-left group",
                    item.variant === 'danger'
                        ? "text-red-500 hover:bg-red-50"
                        : "text-gray-700 hover:bg-gray-50",
                    item.className,
                    showSubmenu && "bg-gray-50"
                )}
            >
                <div className="flex items-center gap-3">
                    {item.icon && <span className="text-gray-400 group-hover:text-inherit shrink-0">{item.icon}</span>}
                    <span className="font-medium">{item.label}</span>
                </div>
                {item.submenu && <ChevronRight size={14} className="text-gray-300" />}
            </button>

            {item.submenu && showSubmenu && (
                <div
                    className="absolute top-0 shadow-2xl"
                    style={{
                        left: '100%',
                        paddingLeft: '4px',
                        marginTop: '-6px'
                    }}
                >
                    <div className="min-w-[180px] bg-white border border-gray-100 shadow-2xl rounded-xl py-1.5 overflow-hidden ring-1 ring-black/5">
                        {item.submenu.map((sub, i) => (
                            <MenuItem key={i} item={sub} onClose={onClose} depth={depth + 1} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, items }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x, y });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleScroll = () => onClose();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('scroll', handleScroll, true);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('scroll', handleScroll, true);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    useEffect(() => {
        if (menuRef.current) {
            const menuRect = menuRef.current.getBoundingClientRect();
            const padding = 20;
            let newX = x;
            let newY = y;

            if (x + menuRect.width > window.innerWidth - padding) {
                newX = window.innerWidth - menuRect.width - padding;
            }
            if (y + menuRect.height > window.innerHeight - padding) {
                newY = window.innerHeight - menuRect.height - padding;
            }

            setPosition({ x: newX, y: newY });
        }
    }, [x, y]);

    return createPortal(
        <AnimatePresence>
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.98, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -5 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
                style={{
                    position: 'fixed',
                    top: position.y,
                    left: position.x,
                    zIndex: 9999,
                }}
                className="min-w-[190px] bg-white border border-gray-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] rounded-xl py-1.5 overflow-visible ring-1 ring-black/5"
            >
                {items.map((item, index) => (
                    <MenuItem key={index} item={item} onClose={onClose} depth={0} />
                ))}
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};
