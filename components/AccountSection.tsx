import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    User as UserIcon, LogOut, Crown, Cloud, CloudOff, RefreshCw, Check,
    Sparkles, ExternalLink, Loader2, Heart, Lock, Trash2,
} from 'lucide-react';
import { useAuth } from '../services/auth';
import { openBillingPortal, deleteAccount } from '../services/billing';
import { fetchHostedUsage, HostedUsage } from '../services/hostedAi';
import { SyncState } from '../services/useCloudSync';
import AuthModal from './AuthModal';

interface AccountSectionProps {
    syncState: SyncState;
    onSyncNow: () => void;
    onOpenPricing: () => void;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatSyncTime(ts: number | null): string {
    if (!ts) return 'not yet';
    const secs = Math.round((Date.now() - ts) / 1000);
    if (secs < 5) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * "Account & Cloud" card for the Settings page: sign-in, plan status,
 * hosted AI usage, sync controls, and supporter recognition.
 */
const AccountSection: React.FC<AccountSectionProps> = ({ syncState, onSyncNow, onOpenPricing }) => {
    const { configured, loading, user, profile, isPro, recoveryMode, signOut, refreshProfile, updateProfile, updatePassword } = useAuth();
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [showPwForm, setShowPwForm] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [pwBusy, setPwBusy] = useState(false);
    const [pwError, setPwError] = useState<string | null>(null);
    const [pwSaved, setPwSaved] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [usage, setUsage] = useState<HostedUsage | null>(null);
    const [portalLoading, setPortalLoading] = useState(false);
    const [portalError, setPortalError] = useState<string | null>(null);
    const [supporterName, setSupporterName] = useState('');
    const [showInSupporters, setShowInSupporters] = useState(false);
    const [supporterSaved, setSupporterSaved] = useState(false);
    const [supporterBusy, setSupporterBusy] = useState(false);
    const [checkoutPending, setCheckoutPending] = useState(false);
    const [checkoutSuccess, setCheckoutSuccess] = useState(false);
    const [checkoutDelayed, setCheckoutDelayed] = useState(false);
    const pollRef = useRef<number | null>(null);
    const pollAttemptsRef = useRef(0);

    // Load profile-backed form state
    useEffect(() => {
        setSupporterName(profile?.supporter_name ?? '');
        setShowInSupporters(profile?.show_in_supporters ?? false);
    }, [profile?.supporter_name, profile?.show_in_supporters]);

    // Hosted usage meter
    useEffect(() => {
        if (!user || !isPro) {
            setUsage(null);
            return;
        }
        // Ignore a response that arrives after the account changed, otherwise
        // the meter can show the previous account's generation count.
        let cancelled = false;
        fetchHostedUsage().then((u) => { if (!cancelled) setUsage(u); });
        return () => { cancelled = true; };
    }, [user, isPro]);

    // Checkout return flow: ?checkout=success → poll until webhook lands
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('checkout') !== 'success') return;
        pollAttemptsRef.current = 0;
        setCheckoutPending(true);
        // Clean the URL so refreshes don't re-trigger
        window.history.replaceState({}, '', window.location.pathname);
    }, []);

    useEffect(() => {
        if (!checkoutPending) return;
        if (isPro) {
            setCheckoutPending(false);
            setCheckoutDelayed(false);
            setCheckoutSuccess(true);
            return;
        }
        // The count lives in a ref, not a local: this effect depends on
        // refreshProfile, so anything that re-creates that callback restarts the
        // effect. With a local counter the restart would reset the tally and the
        // "taking longer" fallback could never be reached.
        pollRef.current = window.setInterval(() => {
            pollAttemptsRef.current += 1;
            refreshProfile();
            if (pollAttemptsRef.current > 20) {
                // ~60s with no webhook yet, surface an explicit "taking longer"
                // state (with a manual Check button) instead of a stuck spinner.
                setCheckoutDelayed(true);
                if (pollRef.current) window.clearInterval(pollRef.current);
                pollRef.current = null;
            }
        }, 3000);
        return () => {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
        };
    }, [checkoutPending, isPro, refreshProfile]);

    // Auto-dismiss the success banner after a few seconds.
    useEffect(() => {
        if (!checkoutSuccess) return;
        const t = window.setTimeout(() => setCheckoutSuccess(false), 8000);
        return () => window.clearTimeout(t);
    }, [checkoutSuccess]);

    const handlePortal = useCallback(async () => {
        setPortalLoading(true);
        setPortalError(null);
        const result = await openBillingPortal();
        setPortalLoading(false);
        if (result.url) {
            window.location.href = result.url;
        } else {
            setPortalError(result.error ?? 'Could not open the billing portal.');
        }
    }, []);

    // A password-reset link lands here in recovery mode, open the form.
    useEffect(() => {
        if (recoveryMode) { setShowPwForm(true); setPwError(null); }
    }, [recoveryMode]);

    const handleSetPassword = useCallback(async () => {
        if (newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
        setPwBusy(true);
        setPwError(null);
        const result = await updatePassword(newPassword);
        setPwBusy(false);
        if (result.error) { setPwError(result.error); return; }
        setNewPassword('');
        setShowPwForm(false);
        setPwSaved(true);
        setTimeout(() => setPwSaved(false), 2500);
    }, [newPassword, updatePassword]);

    const handleDeleteAccount = useCallback(async () => {
        setDeleteBusy(true);
        setDeleteError(null);
        const result = await deleteAccount();
        if (result.error) {
            setDeleteBusy(false);
            setDeleteError(result.error);
            return;
        }
        // Account is gone, clear the now-invalid session and local caches.
        await signOut();
    }, [signOut]);

    const handleSaveSupporter = useCallback(async () => {
        // Without this guard, clicking Save twice in quick succession fires two
        // overlapping updates and whichever reply lands last wins, so the older
        // value can end up persisted. Same pattern as the password and
        // account-deletion actions.
        if (supporterBusy) return;
        setSupporterBusy(true);
        try {
            const result = await updateProfile({
                supporter_name: supporterName.trim() || null,
                show_in_supporters: showInSupporters,
            });
            if (!result.error) {
                setSupporterSaved(true);
                setTimeout(() => setSupporterSaved(false), 2000);
            }
        } finally {
            setSupporterBusy(false);
        }
    }, [supporterBusy, supporterName, showInSupporters, updateProfile]);

    if (!configured) return null;

    return (
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

            <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-gray-900 text-lg">Account &amp; Cloud</h2>
                        <p className="text-sm text-gray-500">Sync your diagrams across devices, share links, and hosted AI</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-5">
                {checkoutPending && !isPro && !checkoutDelayed && (
                    <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-green-50 text-green-700">
                        <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />
                        Payment received, activating your Supporter plan. This usually takes a few seconds.
                    </div>
                )}
                {checkoutPending && !isPro && checkoutDelayed && (
                    <div className="flex items-start justify-between gap-3 text-sm p-3 rounded-lg bg-amber-50 text-amber-800">
                        <span>
                            Payment received, activation is taking longer than usual. It will complete
                            automatically; you can check again or reload this page.
                        </span>
                        <button
                            onClick={() => refreshProfile()}
                            className="shrink-0 px-3 py-1 rounded-md bg-white border border-amber-200 font-medium hover:bg-amber-100 transition-colors"
                        >
                            Check again
                        </button>
                    </div>
                )}
                {checkoutSuccess && isPro && (
                    <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-green-50 text-green-700">
                        <Check className="w-4 h-4 mt-0.5 shrink-0" />
                        You're a Supporter now, thank you! Cloud sync and hosted AI are active.
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading account…
                    </div>
                ) : !user ? (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-500">
                            You're not signed in. Everything you need to finish your IA works without an
                            account, sign in only if you want <span className="font-medium text-gray-700">cloud sync,
                                share links, or hosted AI</span> (Supporter plan).
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setAuthModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                            >
                                Sign in / Create account
                            </button>
                            <button
                                onClick={onOpenPricing}
                                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                            >
                                What's in the Supporter plan?
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Identity + plan */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{user.email}</div>
                                {isPro ? (
                                    <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mt-0.5">
                                        <Crown className="w-3.5 h-3.5" />
                                        Supporter{profile?.plan_interval === 'year' ? ' (yearly)' : profile?.plan_interval === 'month' ? ' (monthly)' : ''}
                                        {profile?.pro_until && <span className="text-gray-400 font-normal">· renews/expires {formatDate(profile.pro_until)}</span>}
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-400 mt-0.5">Free plan, unlimited local diagrams, BYOK AI, full exports</div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {isPro ? (
                                    <button
                                        onClick={handlePortal}
                                        disabled={portalLoading}
                                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                                        Manage billing
                                    </button>
                                ) : (
                                    <button
                                        onClick={onOpenPricing}
                                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-colors shadow-sm"
                                    >
                                        <Crown className="w-3.5 h-3.5" />
                                        Become a Supporter
                                    </button>
                                )}
                                <button
                                    onClick={() => signOut()}
                                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    Sign out
                                </button>
                            </div>
                        </div>
                        {portalError && (
                            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{portalError}</div>
                        )}

                        {/* Hosted AI usage */}
                        {isPro && usage && (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                        <Sparkles className="w-4 h-4 text-purple-600" />
                                        Hosted AI generations this month
                                    </div>
                                    <span className="text-sm text-gray-500 font-mono">{usage.used} / {usage.limit}</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${usage.used / usage.limit > 0.9 ? 'bg-amber-500' : 'bg-purple-500'}`}
                                        style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                    Resets monthly. Your own API key (BYOK) is always unlimited and free.
                                </p>
                            </div>
                        )}

                        {/* Sync status */}
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center gap-3 min-w-0">
                                {isPro ? (
                                    syncState.status === 'error'
                                        ? <CloudOff className="w-5 h-5 text-red-500 shrink-0" />
                                        : <Cloud className="w-5 h-5 text-blue-600 shrink-0" />
                                ) : (
                                    <CloudOff className="w-5 h-5 text-gray-400 shrink-0" />
                                )}
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-700">Cloud sync</div>
                                    <div className="text-xs text-gray-400 truncate">
                                        {!isPro
                                            ? 'Supporter feature, protects your IA from a cleared browser cache'
                                            : syncState.status === 'syncing'
                                                ? 'Syncing…'
                                                : syncState.status === 'error'
                                                    ? (syncState.error ?? 'Sync error')
                                                    : syncState.status === 'offline'
                                                        ? 'Offline, will retry when back online'
                                                        : `Synced ${formatSyncTime(syncState.lastSyncedAt)}`}
                                    </div>
                                </div>
                            </div>
                            {isPro && (
                                <button
                                    onClick={onSyncNow}
                                    disabled={syncState.status === 'syncing'}
                                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-white transition-colors disabled:opacity-50 shrink-0"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                                    Sync now
                                </button>
                            )}
                        </div>

                        {/* Password */}
                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Lock className="w-4 h-4 text-gray-500" />
                                    Password
                                </div>
                                {!showPwForm && (
                                    <button
                                        onClick={() => { setShowPwForm(true); setPwError(null); }}
                                        className="text-sm font-medium text-gray-500 hover:text-gray-700"
                                    >
                                        {pwSaved
                                            ? <span className="text-green-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Updated</span>
                                            : 'Change password'}
                                    </button>
                                )}
                            </div>
                            {recoveryMode && (
                                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                                    Choose a new password to finish resetting your account.
                                </p>
                            )}
                            {showPwForm && (
                                <div className="flex flex-wrap items-center gap-3">
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        autoComplete="new-password"
                                        placeholder="New password (min 8 characters)"
                                        className="flex-1 min-w-48 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-gray-50"
                                    />
                                    <button
                                        onClick={handleSetPassword}
                                        disabled={pwBusy || newPassword.length < 8}
                                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                    >
                                        {pwBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save password'}
                                    </button>
                                    {!recoveryMode && (
                                        <button
                                            onClick={() => { setShowPwForm(false); setNewPassword(''); setPwError(null); }}
                                            className="text-sm text-gray-500 hover:text-gray-700"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            )}
                            {pwError && <p className="text-xs text-red-600 px-1">{pwError}</p>}
                        </div>

                        {/* Supporter recognition */}
                        {isPro && (
                            <div className="pt-4 border-t border-gray-100 space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Heart className="w-4 h-4 text-rose-500" />
                                    Supporter recognition
                                </div>
                                <p className="text-xs text-gray-400">
                                    Optionally list your name in the project README's supporters section. Leave blank to stay anonymous.
                                </p>
                                <div className="flex flex-wrap items-center gap-3">
                                    <input
                                        value={supporterName}
                                        onChange={(e) => setSupporterName(e.target.value)}
                                        maxLength={50}
                                        placeholder="Name to display (optional)"
                                        className="flex-1 min-w-48 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-gray-50"
                                    />
                                    <label className="flex items-center gap-2 text-sm text-gray-600 select-none">
                                        <input
                                            type="checkbox"
                                            checked={showInSupporters}
                                            onChange={(e) => setShowInSupporters(e.target.checked)}
                                            className="rounded border-gray-300"
                                        />
                                        Show me in the README
                                    </label>
                                    <button
                                        onClick={handleSaveSupporter}
                                        disabled={supporterBusy}
                                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {supporterBusy
                                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving</>
                                            : supporterSaved
                                                ? <><Check className="w-3.5 h-3.5" /> Saved</>
                                                : 'Save'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Danger zone, delete account + all cloud data */}
                        <div className="pt-4 border-t border-gray-100 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                                <Trash2 className="w-4 h-4" />
                                Delete account
                            </div>
                            <p className="text-xs text-gray-400">
                                Permanently deletes your account and all cloud-synced data (projects, graphs,
                                version history, templates, share links) and cancels any active subscription.
                                This can't be undone. Diagrams stored locally on this device are not affected.
                            </p>
                            {!deleteConfirm ? (
                                <button
                                    onClick={() => { setDeleteConfirm(true); setDeleteError(null); }}
                                    className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    Delete my account
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-red-700">Are you sure? This is permanent.</p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleDeleteAccount}
                                            disabled={deleteBusy}
                                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                        >
                                            {deleteBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                            Yes, delete everything
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(false)}
                                            disabled={deleteBusy}
                                            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                            {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
};

export default AccountSection;
