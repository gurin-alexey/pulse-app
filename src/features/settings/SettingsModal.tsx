import React, { useState, Fragment } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { X, Moon, Sun, Smartphone, LayoutDashboard, Settings, User, LogOut, Trash2, Type, MessageSquare } from 'lucide-react';
import { useSettings } from '../../store/useSettings';
import { supabase } from '../../lib/supabase';
import clsx from 'clsx';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { settings, updateSettings } = useSettings();
    const [selectedTab, setSelectedTab] = useState(0);

    if (!settings) return null;

    const tabs = [
        { name: 'General', icon: Settings },
        { name: 'Dashboard', icon: LayoutDashboard },
        { name: 'Account', icon: User },
    ];

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
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
                            <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 text-left align-middle shadow-xl transition-all border border-zinc-200 dark:border-zinc-800 h-[85vh] md:h-[600px] flex flex-col md:flex-row">

                                {/* Sidebar Navigation */}
                                <div className="w-full md:w-64 bg-zinc-50 dark:bg-zinc-950/50 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 p-2 md:p-4 flex flex-col shrink-0">
                                    <h2 className="text-lg font-semibold mb-2 md:mb-6 px-3 text-zinc-900 dark:text-zinc-100 hidden md:block">Settings</h2>
                                    <div className="flex md:flex-col space-x-2 md:space-x-0 md:space-y-1 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                                        {tabs.map((tab, index) => (
                                            <button
                                                key={tab.name}
                                                onClick={() => setSelectedTab(index)}
                                                className={clsx(
                                                    "flex-shrink-0 flex items-center gap-2 md:w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                                                    selectedTab === index
                                                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                                        : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
                                                )}
                                            >
                                                <tab.icon size={18} />
                                                <span>{tab.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 flex flex-col min-w-0">
                                    <div className="flex items-center justify-between p-4 md:p-6 border-b border-zinc-200 dark:border-zinc-800">
                                        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                                            {tabs[selectedTab].name}
                                        </h3>
                                        <button
                                            onClick={onClose}
                                            className="text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
                                        {/* Tab 0: General (Includes Theme & Preferences) */}
                                        {selectedTab === 0 && (
                                            <div className="space-y-8">
                                                {/* Theme Section */}
                                                <section>
                                                    <h4 className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-wider">Theme</h4>
                                                    <div className="grid grid-cols-3 gap-4">
                                                        {[
                                                            { id: 'light', name: 'Light', icon: Sun },
                                                            { id: 'dark', name: 'Dark', icon: Moon },
                                                            { id: 'system', name: 'System', icon: Smartphone },
                                                        ].map((theme) => (
                                                            <button
                                                                key={theme.id}
                                                                onClick={() => updateSettings({ theme: theme.id as any })}
                                                                className={clsx(
                                                                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
                                                                    settings.theme === theme.id
                                                                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                                                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                                                                )}
                                                            >
                                                                <theme.icon size={24} className="mb-2" />
                                                                <span className="text-sm font-medium">{theme.name}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </section>

                                                <section>
                                                    <h4 className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-wider">Typography</h4>

                                                    <div className="space-y-6">
                                                        <div>
                                                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                                                                Font Size
                                                            </label>
                                                            <div className="grid grid-cols-3 gap-3">
                                                                {[
                                                                    { id: 'small', name: 'Small', size: '15px' },
                                                                    { id: 'medium', name: 'Medium', size: '16px' },
                                                                    { id: 'large', name: 'Large', size: '17px' },
                                                                ].map((option) => (
                                                                    <button
                                                                        key={option.id}
                                                                        onClick={() => updateSettings({
                                                                            preferences: { ...settings.preferences, font_size: option.id as any }
                                                                        })}
                                                                        className={clsx(
                                                                            "px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                                                                            (settings.preferences.font_size || 'small') === option.id
                                                                                ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                                                                                : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                                                                        )}
                                                                    >
                                                                        <div className="text-xs opacity-60 mb-1">{option.size}</div>
                                                                        {option.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                                                                Font Family
                                                            </label>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <button
                                                                    onClick={() => updateSettings({
                                                                        preferences: { ...settings.preferences, font_family: 'sans' }
                                                                    })}
                                                                    className={clsx(
                                                                        "flex items-center justify-center gap-2 px-3 py-3 rounded-lg border text-sm font-medium transition-colors",
                                                                        (settings.preferences.font_family || 'sans') === 'sans'
                                                                            ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                                                                            : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                                                                    )}
                                                                >
                                                                    <Type size={16} />
                                                                    <span className="font-sans">Standard</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => updateSettings({
                                                                        preferences: { ...settings.preferences, font_family: 'mono' }
                                                                    })}
                                                                    className={clsx(
                                                                        "flex items-center justify-center gap-2 px-3 py-3 rounded-lg border text-sm font-medium transition-colors",
                                                                        settings.preferences.font_family === 'mono'
                                                                            ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                                                                            : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                                                                    )}
                                                                >
                                                                    <div className="font-mono text-xs border border-current rounded px-1">M</div>
                                                                    <span className="font-mono">JetBrains Mono</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </section>

                                                <section>
                                                    <h4 className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-wider">Preferences</h4>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                                                Start of Week
                                                            </label>
                                                            <select
                                                                value={settings.preferences.start_of_week || 'monday'}
                                                                onChange={(e) => updateSettings({
                                                                    preferences: { ...settings.preferences, start_of_week: e.target.value as 'monday' | 'sunday' }
                                                                })}
                                                                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                                            >
                                                                <option value="monday">Monday</option>
                                                                <option value="sunday">Sunday</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                                                Language
                                                            </label>
                                                            <select
                                                                value={settings.preferences.language || 'ru'}
                                                                onChange={(e) => updateSettings({
                                                                    preferences: { ...settings.preferences, language: e.target.value as 'ru' | 'en' }
                                                                })}
                                                                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                                            >
                                                                <option value="ru">Русский</option>
                                                                <option value="en">English</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                                                Start Page
                                                            </label>
                                                            <select
                                                                value={settings.preferences.default_page || 'today'}
                                                                onChange={(e) => updateSettings({
                                                                    preferences: { ...settings.preferences, default_page: e.target.value as any }
                                                                })}
                                                                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                                            >
                                                                <option value="dashboard">Dashboard</option>
                                                                <option value="today">Today</option>
                                                                <option value="calendar">Calendar</option>
                                                            </select>
                                                        </div>

                                                        {/* Hints Toggle */}
                                                        <div className="flex items-center justify-between py-2">
                                                            <div>
                                                                <h5 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Всплывающие подсказки</h5>
                                                                <p className="text-xs text-zinc-500">Показывать уведомления после команд меню</p>
                                                            </div>
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={settings.preferences.show_toast_hints !== false}
                                                                    onChange={(e) => updateSettings({
                                                                        preferences: {
                                                                            ...settings.preferences,
                                                                            show_toast_hints: e.target.checked
                                                                        }
                                                                    })}
                                                                />
                                                                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                            </label>
                                                        </div>

                                                        {/* Hide Night Time Toggle */}
                                                        <div className="flex items-center justify-between py-2 border-t border-zinc-100 dark:border-zinc-800">
                                                            <div>
                                                                <h5 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Скрыть ночное время</h5>
                                                                <p className="text-xs text-zinc-500">Показывать календарь только с 07:00 до 23:00</p>
                                                            </div>
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={settings.preferences.hide_night_time === true}
                                                                    onChange={(e) => updateSettings({
                                                                        preferences: {
                                                                            ...settings.preferences,
                                                                            hide_night_time: e.target.checked
                                                                        }
                                                                    })}
                                                                />
                                                                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </section>

                                                <section>
                                                    <h4 className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-wider">Notifications</h4>
                                                    <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20">
                                                        <div>
                                                            <h5 className="text-sm font-medium text-blue-900 dark:text-blue-100">Push Notifications</h5>
                                                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                                                Enable push notifications to stay updated on your tasks.
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => Notification.requestPermission()}
                                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                                        >
                                                            Request Permission
                                                        </button>
                                                    </div>
                                                </section>
                                            </div>
                                        )}

                                        {/* Tab 1: Dashboard */}
                                        {selectedTab === 1 && (
                                            <div className="space-y-8">
                                                <section>
                                                    <h4 className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-wider">Visible Widgets</h4>
                                                    <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl p-2">
                                                        {Object.keys(settings.dashboard_layout).map((key) => (
                                                            <div key={key} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700/50 shadow-sm">
                                                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 capitalize">
                                                                    {key.replace('_', ' ')}
                                                                </span>
                                                                <label className="relative inline-flex items-center cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="sr-only peer"
                                                                        checked={settings.dashboard_layout[key]}
                                                                        onChange={(e) => updateSettings({
                                                                            dashboard_layout: {
                                                                                ...settings.dashboard_layout,
                                                                                [key]: e.target.checked
                                                                            }
                                                                        })}
                                                                    />
                                                                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                                <section>
                                                    <h4 className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-wider">Integrations</h4>
                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                                            OpenAI API Key
                                                        </label>
                                                        <input
                                                            type="password"
                                                            value={settings.preferences.openai_api_key || ''}
                                                            onChange={(e) => updateSettings({
                                                                preferences: {
                                                                    ...settings.preferences,
                                                                    openai_api_key: e.target.value
                                                                }
                                                            })}
                                                            placeholder="sk-..."
                                                            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                                                        />
                                                        <p className="text-xs text-zinc-500">
                                                            Required for AI Chat functionality. Stored securely in your settings.
                                                        </p>
                                                    </div>
                                                </section>
                                            </div>
                                        )}

                                        {/* Tab 2: Account */}
                                        {selectedTab === 2 && (
                                            <div className="space-y-8">
                                                <section>
                                                    <h4 className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-wider">Account</h4>
                                                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 space-y-4">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-12 h-12 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                                                                <User size={24} className="text-zinc-500" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-zinc-900 dark:text-zinc-100">User Account</p>
                                                                <p className="text-sm text-zinc-500">Managed by Supabase</p>
                                                            </div>
                                                        </div>
                                                        <hr className="border-zinc-200 dark:border-zinc-700" />
                                                        <button
                                                            onClick={handleLogout}
                                                            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                                                        >
                                                            <LogOut size={16} />
                                                            <span>Log Out</span>
                                                        </button>
                                                    </div>
                                                </section>

                                                <section>
                                                    <h4 className="text-sm font-medium text-red-500 mb-4 uppercase tracking-wider">Danger Zone</h4>
                                                    <div className="border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded-xl p-4">
                                                        <h5 className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">Delete Account</h5>
                                                        <p className="text-xs text-red-700 dark:text-red-300 mb-4">
                                                            Once you delete your account, there is no going back. Please be certain.
                                                        </p>
                                                        <button className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
                                                            <Trash2 size={16} />
                                                            <span>Delete Account</span>
                                                        </button>
                                                    </div>
                                                </section>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};
