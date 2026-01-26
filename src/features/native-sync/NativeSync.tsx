import { useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { supabase } from '@/lib/supabase';

export const NativeSync = () => {
    useEffect(() => {
        const syncCredentials = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

                if (supabaseUrl) {
                    await Preferences.set({ key: 'supabase_url', value: supabaseUrl });
                }
                if (supabaseAnonKey) {
                    await Preferences.set({ key: 'supabase_key', value: supabaseAnonKey });
                }

                if (session) {
                    await Preferences.set({ key: 'access_token', value: session.access_token });
                    if (session.refresh_token) {
                        await Preferences.set({ key: 'refresh_token', value: session.refresh_token });
                    }
                    await Preferences.set({ key: 'user_id', value: session.user.id });
                    console.log('[NativeSync] Credentials synced to native storage');
                }
                // REMOVED: Do not delete credentials here if session is missing.
                // It might be initializing. Only delete on explicit SIGNED_OUT.

            } catch (error) {
                console.error('[NativeSync] Error syncing credentials:', error);
            }
        };

        syncCredentials();

        // Sync on app resume
        const resumeListener = App.addListener('appStateChange', (state) => {
            if (state.isActive) {
                console.log('[NativeSync] App resumed, syncing credentials...');
                syncCredentials();
            }
        });

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            try {
                console.log('[NativeSync] Auth event:', event);

                if (event === 'SIGNED_OUT') {
                    await Preferences.remove({ key: 'access_token' });
                    await Preferences.remove({ key: 'refresh_token' });
                    await Preferences.remove({ key: 'user_id' });
                    console.log('[NativeSync] User signed out, credentials cleared');
                    return;
                }

                if (session) {
                    console.log('[NativeSync] Session updated');

                    await Preferences.set({ key: 'access_token', value: session.access_token });
                    if (session.refresh_token) {
                        await Preferences.set({ key: 'refresh_token', value: session.refresh_token });
                    } else {
                        console.warn('[NativeSync] No refresh_token available for this session!');
                    }
                    await Preferences.set({ key: 'user_id', value: session.user.id });
                }
            } catch (error) {
                console.error('[NativeSync] Error handling auth change:', error);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
            resumeListener.then(l => l.remove());
        };
    }, []);

    return null;
};
