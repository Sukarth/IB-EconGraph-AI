import React, { useState, useEffect } from 'react';
import { History, Loader2, RotateCcw, CloudOff } from 'lucide-react';
import { Modal } from './Modal';
import { useAuth } from '../services/auth';
import { fetchGraphVersions, CloudVersion } from '../services/customTemplates';
import { DiagramData, Graph } from '../types';

interface CloudHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    graph: Graph | null;
    onRestore: (diagramData: DiagramData) => void;
}

function formatWhen(iso: string): string {
    const date = new Date(iso);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return sameDay
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Cloud version history (Supporter feature). Lists synced snapshots of the
 * active graph and restores the diagram content of a chosen version.
 */
export const CloudHistoryModal: React.FC<CloudHistoryModalProps> = ({ isOpen, onClose, graph, onRestore }) => {
    const { user, isPro } = useAuth();
    const [versions, setVersions] = useState<CloudVersion[]>([]);
    const [loading, setLoading] = useState(false);

    // Keyed on the ids, not the objects: `activeGraph` in App.tsx is a useMemo
    // over `graphs` and the Supabase User is replaced on every token refresh,
    // so with the objects in the deps this re-queried the version list while the
    // user was simply editing the diagram with the modal open.
    const graphId = graph?.id ?? null;
    const userId = user?.id ?? null;
    useEffect(() => {
        // Clear first: otherwise the previous graph's snapshots stay listed
        // until the new query resolves, and restoring one would write another
        // diagram's content into this graph.
        setVersions([]);
        if (!isOpen || !graphId || !userId || !isPro) return;
        let cancelled = false;
        setLoading(true);
        fetchGraphVersions(graphId)
            .then((v) => { if (!cancelled) setVersions(v); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [isOpen, graphId, userId, isPro]);

    const handleRestore = (version: CloudVersion) => {
        const data = version.data as Graph | null;
        if (data && typeof data === 'object' && data.diagramData) {
            onRestore(data.diagramData);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Cloud version history" size="lg">
            {!user || !isPro ? (
                <div className="text-center py-6 text-gray-500 text-sm space-y-2">
                    <CloudOff className="w-8 h-8 mx-auto text-gray-300" />
                    <p>Version history is part of the Supporter plan and needs cloud sync to be active.</p>
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
            ) : versions.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm space-y-2">
                    <History className="w-8 h-8 mx-auto text-gray-300" />
                    <p>No cloud versions yet. Versions are saved automatically every time this graph syncs.</p>
                </div>
            ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto -mx-1 px-1">
                    <p className="text-xs text-gray-400 mb-2">
                        Restoring replaces the current diagram (your chat history is kept). You can undo with Ctrl+Z.
                    </p>
                    {versions.map((version, i) => (
                        <div
                            key={version.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group"
                        >
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                                <History className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800 truncate">
                                    {version.title || 'Untitled graph'}
                                    {i === 0 && <span className="ml-2 text-xs text-green-600 font-normal">latest</span>}
                                </div>
                                <div className="text-xs text-gray-400">{formatWhen(version.createdAt)}</div>
                            </div>
                            <button
                                onClick={() => handleRestore(version)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Restore
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
};

export default CloudHistoryModal;
