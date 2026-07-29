import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, Check, Loader2, LogIn, UserPlus, ArrowLeft } from 'lucide-react';
import { Modal } from './Modal';
import { useAuth } from '../services/auth';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    /**
     * In-app path to return to after a redirect-based sign-in (Google OAuth, or
     * the emailed signup confirmation). Defaults to `/settings`. Callers that
     * gate an action behind sign-in should pass their own page, otherwise the
     * user lands somewhere they cannot resume from.
     */
    returnTo?: string;
}

const MIN_PASSWORD = 8;
type View = 'signin' | 'signup' | 'forgot' | 'confirm-sent' | 'reset-sent';

/**
 * Sign-in dialog: email + password (with one-time email confirmation on signup)
 * and Google OAuth. Creating an account is free, it's the prerequisite for
 * checkout and Supporter features. Password login keeps email volume low, which
 * matters on Supabase's rate-limited default mailer; Google sends none at all.
 */
export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    title = 'Sign in',
    message,
    returnTo,
}) => {
    const { signInWithPassword, signUpWithPassword, resetPassword, signInWithGoogle } = useAuth();
    const [view, setView] = useState<View>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset the flow each time the modal opens so a second open never shows a
    // stale success/confirmation screen from a previous attempt.
    useEffect(() => {
        if (isOpen) {
            setView('signin');
            setPassword('');
            setShowPassword(false);
            setError(null);
        }
    }, [isOpen]);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy || !email.trim() || !password) return;
        setBusy(true);
        setError(null);
        const result = await signInWithPassword(email, password);
        setBusy(false);
        if (result.error) setError(result.error);
        else onClose();
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy || !email.trim()) return;
        if (password.length < MIN_PASSWORD) {
            setError(`Password must be at least ${MIN_PASSWORD} characters.`);
            return;
        }
        setBusy(true);
        setError(null);
        const result = await signUpWithPassword(email, password, returnTo);
        setBusy(false);
        if (result.error) setError(result.error);
        else if (result.needsConfirmation) setView('confirm-sent');
        else onClose(); // confirmation disabled → signed in immediately
    };

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy || !email.trim()) return;
        setBusy(true);
        setError(null);
        const result = await resetPassword(email);
        setBusy(false);
        if (result.error) setError(result.error);
        else setView('reset-sent');
    };

    const handleGoogle = async () => {
        setError(null);
        const result = await signInWithGoogle(returnTo);
        if (result.error) setError(result.error);
    };

    // ---- "email sent" confirmation screens -------------------------------
    if (view === 'confirm-sent' || view === 'reset-sent') {
        const isConfirm = view === 'confirm-sent';
        return (
            <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
                <div className="text-center py-6">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-6 h-6 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Check your inbox</h4>
                    <p className="text-sm text-gray-500">
                        {/* Worded to be true whether or not the address was already
                            registered: signup deliberately does not reveal which,
                            so this screen must not either. */}
                        {isConfirm
                            ? <>We sent an email to <span className="font-medium text-gray-700">{email}</span>. Open the link in it to verify your account, then sign in. If you already have an account with this address, sign in instead.</>
                            : <>We sent a password-reset link to <span className="font-medium text-gray-700">{email}</span>. Open it to choose a new password.</>}
                    </p>
                    <button
                        onClick={() => { setView('signin'); setError(null); }}
                        className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Back to sign in
                    </button>
                </div>
            </Modal>
        );
    }

    // ---- forgot-password form --------------------------------------------
    if (view === 'forgot') {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Reset your password" size="md">
                <form onSubmit={handleForgot} className="space-y-4">
                    <p className="text-sm text-gray-500">
                        Enter your email and we'll send you a link to set a new password.
                    </p>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@school.org"
                            aria-label="Email address"
                            className="w-full pl-9 pr-3 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-gray-50"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={busy || !email.trim()}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        Send reset link
                    </button>
                    {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
                    <button
                        type="button"
                        onClick={() => { setView('signin'); setError(null); }}
                        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                    </button>
                </form>
            </Modal>
        );
    }

    // ---- sign-in / sign-up form ------------------------------------------
    const isSignup = view === 'signup';
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isSignup ? 'Create your account' : title} size="md">
            <div className="space-y-4">
                {message && <p className="text-sm text-gray-500">{message}</p>}

                <form onSubmit={isSignup ? handleSignUp : handleSignIn} className="space-y-3">
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@school.org"
                            aria-label="Email address"
                            className="w-full pl-9 pr-3 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-gray-50"
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            autoComplete={isSignup ? 'new-password' : 'current-password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={isSignup ? `Password (min ${MIN_PASSWORD} characters)` : 'Password'}
                            aria-label="Password"
                            className="w-full pl-9 pr-10 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-gray-50"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {!isSignup && (
                        <div className="flex justify-end -mt-1">
                            <button
                                type="button"
                                onClick={() => { setView('forgot'); setError(null); }}
                                className="text-xs text-gray-500 hover:text-gray-700"
                            >
                                Forgot password?
                            </button>
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={busy || !email.trim() || !password}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : isSignup ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                        {isSignup ? 'Create account' : 'Sign in'}
                    </button>
                </form>

                <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">or</span>
                    <div className="flex-1 h-px bg-gray-200" />
                </div>

                <button
                    onClick={handleGoogle}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    Continue with Google
                </button>

                {error && (
                    <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
                )}

                <p className="text-sm text-gray-500 text-center">
                    {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button
                        type="button"
                        onClick={() => { setView(isSignup ? 'signin' : 'signup'); setError(null); }}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                        {isSignup ? 'Sign in' : 'Create one'}
                    </button>
                </p>

                <p className="text-xs text-gray-400 text-center">
                    Accounts are free. You only need one for cloud features, the editor,
                    exports, and AI with your own key work without signing in.
                </p>
            </div>
        </Modal>
    );
};

export default AuthModal;
