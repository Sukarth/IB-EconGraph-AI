import React, { useState, useEffect, useCallback } from 'react';
import { Link2, Copy, Check, Loader2, Trash2, Crown, LogIn } from 'lucide-react';
import { Modal } from './Modal';
import { useAuth } from '../services/auth';
import {
    createOrUpdateGraphShare,
    getShareIdForGraph,
    revokeShare,
    shareUrl,
} from '../services/shares';
import { Graph } from '../types';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    graph: Graph | null;
    onOpenSettings: () => void;
    onOpenPricing: () => void;
}

/**
 * Creates/copies/revokes a view-only link for the active graph.
 * Supporter feature, non-entitled users see the upgrade path instead.
 */
export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, graph, onOpenSettings, onOpenPricing }) => {
    const { configured, user, isPro } = useAuth();
    const [shareId, setShareId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !graph || !user || !isPro) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        setCopied(false);
        getShareIdForGraph(graph.id)
            .then((id) => { if (!cancelled) setShareId(id); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [isOpen, graph, user, isPro]);

    const handleCreate = useCallback(async () => {
        if (!graph || !user || creating) return;
        setCreating(true);
        setError(null);
        const result = await createOrUpdateGraphShare(user.id, graph);
        setCreating(false);
        if (result.error) {
            setError(result.error);
        } else if (result.id) {
            setShareId(result.id);
        }
    }, [graph, user, creating]);

    const handleCopy = useCallback(async () => {
        if (!shareId) return;
        try {
            await navigator.clipboard.writeText(shareUrl(shareId));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('Could not copy, select the link and copy it manually.');
        }
    }, [shareId]);

    const handleRevoke = useCallback(async () => {
        if (!shareId) return;
        const result = await revokeShare(shareId);
        if (result.error) {
            setError(result.error);
        } else {
            setShareId(null);
        }
    }, [shareId]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share this graph" size="lg">
            {!configured ? (
                <p className="text-sm text-gray-500 py-2">
                    Sharing isn't available on this deployment. You can still export the
                    diagram as SVG/PNG and send the file.
                </p>
            ) : !user ? (
                <div className="text-center py-4 space-y-4">
                    <p className="text-sm text-gray-500">
                        Sign in to create a view-only link you can send to your teacher or group partner.
                    </p>
                    <button
                        onClick={() => { onClose(); onOpenSettings(); }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                        <LogIn className="w-4 h-4" />
                        Sign in from Settings
                    </button>
                </div>
            ) : !isPro ? (
                <div className="text-center py-4 space-y-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                        <Crown className="w-6 h-6 text-amber-600" />
                    </div>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                        Shareable links are part of the <span className="font-medium text-gray-700">Supporter</span> plan
                        ($5/month). Unable to support? Everything you need to finish your IA, editor, exports, AI with
                        your own key, still stays free forever.
                    </p>
                    <button
                        onClick={() => { onClose(); onOpenPricing(); }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-colors text-sm font-medium shadow-sm"
                    >
                        <Crown className="w-4 h-4" />
                        See the Supporter plan
                    </button>
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
            ) : shareId ? (
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                        Anyone with this link can <span className="font-medium text-gray-700">view</span> the
                        diagram (never your chat history). It stays up to date as you edit and sync.
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg min-w-0">
                            <Link2 className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-700 truncate font-mono">{shareUrl(shareId)}</span>
                        </div>
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shrink-0"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            className="text-sm text-gray-500 hover:text-gray-700 font-medium disabled:opacity-50"
                        >
                            {creating ? 'Updating…' : 'Update snapshot now'}
                        </button>
                        <button
                            onClick={handleRevoke}
                            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                            <Trash2 className="w-4 h-4" />
                            Revoke link
                        </button>
                    </div>
                    {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                        Create a view-only link for
                        {' '}<span className="font-medium text-gray-700">{graph?.diagramData.title || 'this graph'}</span>.
                        Perfect for sending to a teacher or group partner without exporting files.
                    </p>
                    <button
                        onClick={handleCreate}
                        disabled={creating}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors text-sm font-medium"
                    >
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                        Create share link
                    </button>
                    {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
                </div>
            )}
        </Modal>
    );
};

export default ShareModal;
