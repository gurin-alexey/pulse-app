import { useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
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
                    await Preferences.set({ key: 'refresh_token', value: session.refresh_token });
                    await Preferences.set({ key: 'user_id', value: session.user.id });
                    console.log('[NativeSync] Credentials synced to native storage');
                } else {
                    await Preferences.remove({ key: 'access_token' });
                    await Preferences.remove({ key: 'refresh_token' });
                    await Preferences.remove({ key: 'user_id' });
                    console.log('[NativeSync] Credentials cleared from native storage');
                }
            } catch (error) {
                console.error('[NativeSync] Error syncing credentials:', error);
            }
        };

        syncCredentials();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            try {
                if (session) {
                    await Preferences.set({ key: 'access_token', value: session.access_token });
                    await Preferences.set({ key: 'refresh_token', value: session.refresh_token });
                    await Preferences.set({ key: 'user_id', value: session.user.id });
                    console.log('[NativeSync] Auth change: Credentials synced');
                } else {
                    await Preferences.remove({ key: 'access_token' });
                    await Preferences.remove({ key: 'refresh_token' });
                    await Preferences.remove({ key: 'user_id' });
                    console.log('[NativeSync] Auth change: Credentials cleared');
                }
            } catch (error) {
                console.error('[NativeSync] Error handling auth change:', error);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    return null;
};
