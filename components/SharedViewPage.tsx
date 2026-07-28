import React, { useState, useEffect } from 'react';
import { BarChart2, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import DiagramRenderer from './DiagramRenderer';
import { fetchSharedPayload, SharePayload, SharedGraphEntry } from '../services/shares';
import { DEFAULT_EDITOR_SETTINGS } from '../types';

interface SharedViewPageProps {
    slug: string;
    onGoHome: () => void;
}

/**
 * Public, read-only viewer for shared diagram/project links (/s/:slug).
 * No account needed, anyone with the link can view.
 */
const SharedViewPage: React.FC<SharedViewPageProps> = ({ slug, onGoHome }) => {
    const [payload, setPayload] = useState<SharePayload | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
    const [activeIndex, setActiveIndex] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setStatus('loading');
        fetchSharedPayload(slug)
            .then((data) => {
                if (cancelled) return;
                if (data) {
                    setPayload(data);
                    setStatus('ready');
                } else {
                    setStatus('notfound');
                }
            })
            .catch(() => {
                if (!cancelled) setStatus('error');
            });
        return () => { cancelled = true; };
    }, [slug, reloadKey]);

    const graphs: SharedGraphEntry[] = payload
        ? payload.kind === 'graph'
            ? [{ id: 'single', title: payload.title, caption: payload.caption, diagramData: payload.diagramData }]
            : payload.graphs
        : [];
    const active = graphs[Math.min(activeIndex, Math.max(graphs.length - 1, 0))];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                            <BarChart2 className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate">
                                {payload?.kind === 'project' ? payload.name : active?.title || 'Shared diagram'}
                            </div>
                            <div className="text-xs text-gray-400">Shared view-only · IB EconGraph AI</div>
                        </div>
                    </div>
                    <button
                        onClick={onGoHome}
                        className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shrink-0"
                    >
                        Make your own, free
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <main className="flex-1 flex">
                {status === 'loading' && (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                )}

                {status === 'notfound' && (
                    <div className="flex-1 flex items-center justify-center p-6">
                        <div className="text-center max-w-sm">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-6 h-6 text-amber-600" />
                            </div>
                            <h1 className="font-semibold text-gray-900 mb-1">This link isn't available</h1>
                            <p className="text-sm text-gray-500 mb-6">
                                The share link may have been revoked, or the diagram was deleted by its owner.
                            </p>
                            <button
                                onClick={onGoHome}
                                className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                Create your own diagrams, free
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex-1 flex items-center justify-center p-6">
                        <div className="text-center max-w-sm">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-6 h-6 text-gray-500" />
                            </div>
                            <h1 className="font-semibold text-gray-900 mb-1">Couldn't load this link</h1>
                            <p className="text-sm text-gray-500 mb-6">
                                Something went wrong reaching the server. Check your connection and try again.
                            </p>
                            <button
                                onClick={() => setReloadKey((k) => k + 1)}
                                className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                {status === 'ready' && payload && (
                    <>
                        {payload.kind === 'project' && graphs.length > 1 && (
                            <aside className="w-60 bg-white border-r border-gray-200 p-3 space-y-1 overflow-y-auto shrink-0 hidden sm:block">
                                <div className="text-xs text-gray-500 font-medium px-1 mb-2">
                                    {graphs.length} graphs in this project
                                </div>
                                {graphs.map((g, i) => (
                                    <button
                                        key={g.id}
                                        onClick={() => setActiveIndex(i)}
                                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${i === activeIndex
                                            ? 'bg-blue-50 text-blue-700 font-medium'
                                            : 'hover:bg-gray-100 text-gray-700'
                                            }`}
                                    >
                                        <BarChart2 className={`w-4 h-4 shrink-0 ${i === activeIndex ? 'text-blue-600' : 'text-gray-400'}`} />
                                        <span className="truncate">{g.title || 'Untitled'}</span>
                                    </button>
                                ))}
                            </aside>
                        )}

                        <div className="flex-1 flex flex-col overflow-auto min-w-0">
                            {payload.kind === 'project' && graphs.length > 1 && (
                                // Phone fallback for the sidebar above, which is
                                // hidden below `sm`. Without it, a shared project
                                // only ever showed its first graph on a phone.
                                <div className="sm:hidden shrink-0 border-b border-gray-200 bg-white px-3 py-2 overflow-x-auto">
                                    <div className="flex gap-2 w-max">
                                        {graphs.map((g, i) => (
                                            <button
                                                key={g.id}
                                                onClick={() => setActiveIndex(i)}
                                                aria-current={i === activeIndex}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${i === activeIndex
                                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                                    : 'bg-gray-100 text-gray-700'
                                                    }`}
                                            >
                                                <BarChart2 className={`w-3.5 h-3.5 shrink-0 ${i === activeIndex ? 'text-blue-600' : 'text-gray-500'}`} />
                                                {g.title || 'Untitled'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center">
                                {active ? (
                                    <div className="w-full max-w-4xl">
                                        <DiagramRenderer
                                            data={active.diagramData}
                                            readOnly
                                            width={800}
                                            height={550}
                                            settings={{ ...DEFAULT_EDITOR_SETTINGS, showGrid: false }}
                                            className="w-full shadow-xl bg-white rounded-xl"
                                        />
                                        {active.caption && (
                                            <p className="text-center text-sm text-gray-500 mt-4">{active.caption}</p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">This project has no graphs yet.</p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>

            <footer className="py-4 text-center text-xs text-gray-500 border-t border-gray-100 bg-white">
                Made with{' '}
                <button onClick={onGoHome} className="text-blue-600 hover:underline font-medium">
                    IB EconGraph AI
                </button>
                , the free, open-source economics diagram editor for IB students.
            </footer>
        </div>
    );
};

export default SharedViewPage;
