import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { UserSettings } from '../types/database';

interface SettingsState {
    settings: UserSettings | null;
    isLoading: boolean;
    fetchSettings: () => Promise<void>;
    updateSettings: (newSettings: Partial<UserSettings>) => void;
    syncToSupabase: (settings: UserSettings) => Promise<void>;
}

// Simple debounce implementation
const debounce = (func: Function, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'> = {
    theme: 'system',
    dashboard_layout: {
        greeting: true,
        weather: true,
        rates: true,
        ai_chat: true,
        quick_capture: true,
        deadline_tasks: true,
    },
    preferences: {
        start_of_week: 'monday',
        language: 'ru',
        show_completed_tasks: false,
        show_toast_hints: true,
    },
};

export const useSettings = create<SettingsState>((set, get) => {
    // Debounced sync function
    const debouncedSync = debounce(async (settings: UserSettings) => {
        const { user_id, theme, dashboard_layout, preferences } = settings;
        try {
            const { error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id,
                    theme,
                    dashboard_layout,
                    preferences,
                    updated_at: new Date().toISOString(),
                });

            if (error) {
                console.error('Error syncing settings:', error);
            }
        } catch (err) {
            console.error('Unexpected error syncing settings:', err);
        }
    }, 1000);

    return {
        settings: null,
        isLoading: false,

        fetchSettings: async () => {
            set({ isLoading: true });
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    set({ isLoading: false });
                    return;
                }

                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows"
                    console.error('Error fetching settings:', error);
                    set({ isLoading: false });
                    return;
                }

                let settings = data as UserSettings;

                if (!settings) {
                    // Initialize default settings if not exists
                    settings = {
                        user_id: user.id,
                        ...DEFAULT_SETTINGS,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    } as UserSettings;

                    // Create immediately in DB
                    const { error: insertError } = await supabase
                        .from('user_settings')
                        .insert(settings);

                    if (insertError) {
                        console.error('Error creating default settings:', insertError);
                    }
                } else {
                    // Merge defaults to ensure new fields are present
                    settings = {
                        ...settings,
                        dashboard_layout: { ...DEFAULT_SETTINGS.dashboard_layout, ...settings.dashboard_layout },
                        preferences: { ...DEFAULT_SETTINGS.preferences, ...settings.preferences }
                    };
                }

                set({ settings, isLoading: false });

                // Apply theme immediately
                const root = window.document.documentElement;
                root.classList.remove('light', 'dark');
                if (settings.theme === 'system') {
                    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                    root.classList.add(systemTheme);
                } else {
                    root.classList.add(settings.theme);
                }

            } catch (err) {
                console.error('Unexpected error in fetchSettings:', err);
                set({ isLoading: false });
            }
        },

        updateSettings: (newSettings: Partial<UserSettings>) => {
            const currentSettings = get().settings;
            if (!currentSettings) return;

            const updatedSettings = { ...currentSettings, ...newSettings };

            // Optimistic update
            set({ settings: updatedSettings });

            // Apply theme immediately if changed
            if (newSettings.theme) {
                const root = window.document.documentElement;
                root.classList.remove('light', 'dark');
                if (newSettings.theme === 'system') {
                    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                    root.classList.add(systemTheme);
                } else {
                    root.classList.add(newSettings.theme);
                }
            }

            // Sync to Supabase
            get().syncToSupabase(updatedSettings);
        },

        syncToSupabase: async (settings: UserSettings) => {
            debouncedSync(settings);
        }
    };
});
