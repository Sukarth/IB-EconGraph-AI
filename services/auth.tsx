import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isCloudConfigured } from './supabaseClient';
import { clearTemplateCache } from './customTemplates';
import { isProUntilActive } from './entitlement';

export interface Profile {
    id: string;
    email: string | null;
    display_name: string | null;
    supporter_name: string | null;
    show_in_supporters: boolean;
    pro_status: string;
    pro_until: string | null;
    plan_interval: string | null;
}

export type EditableProfileFields = Partial<Pick<Profile, 'display_name' | 'supporter_name' | 'show_in_supporters'>>;

interface AuthContextValue {
    /** Whether Supabase is configured for this deployment at all. */
    configured: boolean;
    /** True until the initial session restore has finished. */
    loading: boolean;
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    /** Active Supporter (Pro) entitlement. */
    isPro: boolean;
    /**
     * True after the user follows a password-reset link (Supabase fires a
     * PASSWORD_RECOVERY event). The Settings page uses this to prompt for a new
     * password.
     */
    recoveryMode: boolean;
    /** Create an account with email + password. `needsConfirmation` when a
     * verification email was sent and no session was established yet.
     * `returnTo` is the in-app path to land on afterwards (default `/settings`). */
    signUpWithPassword: (email: string, password: string, returnTo?: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
    signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
    /** Send a password-reset email. */
    resetPassword: (email: string) => Promise<{ error?: string }>;
    /** Set a new password for the signed-in (or recovering) user. */
    updatePassword: (password: string) => Promise<{ error?: string }>;
    clearRecoveryMode: () => void;
    /** `returnTo` is the in-app path to land on afterwards (default `/settings`). */
    signInWithGoogle: (returnTo?: string) => Promise<{ error?: string }>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    updateProfile: (patch: EditableProfileFields) => Promise<{ error?: string }>;
}

const NOT_CONFIGURED = { error: 'Accounts are not available on this deployment.' } as const;

const AuthContext = createContext<AuthContextValue>({
    configured: false,
    loading: false,
    session: null,
    user: null,
    profile: null,
    isPro: false,
    recoveryMode: false,
    signUpWithPassword: async () => NOT_CONFIGURED,
    signInWithPassword: async () => NOT_CONFIGURED,
    resetPassword: async () => NOT_CONFIGURED,
    updatePassword: async () => NOT_CONFIGURED,
    clearRecoveryMode: () => { },
    signInWithGoogle: async () => NOT_CONFIGURED,
    signOut: async () => { },
    refreshProfile: async () => { },
    updateProfile: async () => NOT_CONFIGURED,
});

export function profileIsPro(profile: Profile | null): boolean {
    return isProUntilActive(profile?.pro_until);
}

/**
 * Absolute URL for an auth redirect back into the app. Only a same-origin path
 * is accepted: anything else (a full URL, a protocol-relative `//host` that the
 * browser would treat as another origin, a backslash variant some parsers
 * normalise to `/`) falls back to Settings, so a redirect target can never be
 * pointed off-site.
 */
function authRedirectUrl(returnTo?: string): string {
    const safe =
        returnTo && /^\/[A-Za-z0-9._~\-/]*$/.test(returnTo) && !returnTo.startsWith('//')
            ? returnTo
            : '/settings';
    return `${window.location.origin}${safe}`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(isCloudConfigured);
    const [recoveryMode, setRecoveryMode] = useState(false);
    const userIdRef = useRef<string | null>(null);

    const fetchProfile = useCallback(async (userId: string | null) => {
        if (!supabase || !userId) {
            setProfile(null);
            return;
        }
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, display_name, supporter_name, show_in_supporters, pro_status, pro_until, plan_interval')
            .eq('id', userId)
            .maybeSingle();
        if (!error && userIdRef.current === userId) {
            setProfile((data as Profile) ?? null);
        }
    }, []);

    useEffect(() => {
        if (!supabase) return;

        let cancelled = false;
        supabase.auth.getSession().then(({ data }) => {
            if (cancelled) return;
            setSession(data.session);
            userIdRef.current = data.session?.user?.id ?? null;
            fetchProfile(userIdRef.current).finally(() => {
                if (!cancelled) setLoading(false);
            });
        }).catch((err) => {
            // Don't leave the UI stuck on the loading spinner if session
            // restore fails (transient network/storage error).
            console.error('auth: getSession failed', err);
            if (!cancelled) setLoading(false);
        });

        const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
            // Arrived via a password-reset link → prompt for a new password.
            if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
            setSession(newSession);
            const newUserId = newSession?.user?.id ?? null;
            if (newUserId !== userIdRef.current) {
                if (!newUserId) clearTemplateCache(); // signed out / expired elsewhere
                userIdRef.current = newUserId;
                // Drop the old profile immediately. Leaving it in place until the
                // replacement query resolves shows the previous account's name
                // and Supporter status under the new session.
                setProfile(null);
                fetchProfile(newUserId);
            }
        });

        return () => {
            cancelled = true;
            sub.subscription.unsubscribe();
        };
    }, [fetchProfile]);

    const signUpWithPassword = useCallback(async (email: string, password: string, returnTo?: string) => {
        if (!supabase) return NOT_CONFIGURED;
        const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: authRedirectUrl(returnTo) },
        });
        if (error) return { error: error.message };
        // Session present → email confirmation is disabled, user is signed in.
        if (data.session) return {};
        // Supabase deliberately does NOT say whether the address is already
        // registered: it returns a user with an empty `identities` array instead
        // of an error, precisely so the endpoint can't be used to enumerate
        // accounts. Reporting "an account already exists" here would undo that,
        // so both cases get the identical confirmation screen. Someone who does
        // own the address learns the truth from the mail they receive; someone
        // probing addresses learns nothing.
        return { needsConfirmation: true };
    }, []);

    const signInWithPassword = useCallback(async (email: string, password: string) => {
        if (!supabase) return NOT_CONFIGURED;
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (!error) return {};
        // Friendlier copy for the common "not confirmed yet" case.
        if (/email not confirmed/i.test(error.message)) {
            return { error: 'Please confirm your email first, check your inbox for the verification link.' };
        }
        return { error: error.message };
    }, []);

    const resetPassword = useCallback(async (email: string) => {
        if (!supabase) return NOT_CONFIGURED;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/settings`,
        });
        return error ? { error: error.message } : {};
    }, []);

    const updatePassword = useCallback(async (password: string) => {
        if (!supabase) return NOT_CONFIGURED;
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return { error: error.message };
        setRecoveryMode(false);
        return {};
    }, []);

    const clearRecoveryMode = useCallback(() => setRecoveryMode(false), []);

    const signInWithGoogle = useCallback(async (returnTo?: string) => {
        if (!supabase) return NOT_CONFIGURED;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: authRedirectUrl(returnTo) },
        });
        return error ? { error: error.message } : {};
    }, []);

    const signOut = useCallback(async () => {
        if (!supabase) return;
        clearTemplateCache();
        setRecoveryMode(false);
        await supabase.auth.signOut();
        setProfile(null);
    }, []);

    const refreshProfile = useCallback(async () => {
        await fetchProfile(userIdRef.current);
    }, [fetchProfile]);

    const updateProfile = useCallback(async (patch: EditableProfileFields) => {
        if (!supabase || !userIdRef.current) return { error: 'Not signed in.' };
        const { error } = await supabase
            .from('profiles')
            .update(patch)
            .eq('id', userIdRef.current);
        if (error) return { error: error.message };
        await fetchProfile(userIdRef.current);
        return {};
    }, [fetchProfile]);

    const value = useMemo<AuthContextValue>(() => ({
        configured: isCloudConfigured,
        loading,
        session,
        user: session?.user ?? null,
        profile,
        isPro: profileIsPro(profile),
        recoveryMode,
        signUpWithPassword,
        signInWithPassword,
        resetPassword,
        updatePassword,
        clearRecoveryMode,
        signInWithGoogle,
        signOut,
        refreshProfile,
        updateProfile,
    }), [loading, session, profile, recoveryMode, signUpWithPassword, signInWithPassword, resetPassword, updatePassword, clearRecoveryMode, signInWithGoogle, signOut, refreshProfile, updateProfile]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
    return useContext(AuthContext);
}
