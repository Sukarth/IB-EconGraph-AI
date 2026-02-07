import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronLeft, Key, Eye, EyeOff, Check, AlertTriangle,
    Download, Upload, BarChart2, Trash2, ExternalLink
} from 'lucide-react';
import { getApiKey, saveApiKey, hasApiKey } from '../services/gemini';
import { Graph, Project } from '../types';
import { ConfirmModal } from './Modal';

interface SettingsPageProps {
    onBack: () => void;
    graphs: Graph[];
    projects: Project[];
    onImportData: (data: { graphs: Graph[]; projects: Project[]; specialColors?: string[]; standardColors?: string[] }) => void;
}

const EXPORT_VERSION = 1;

interface ExportPayload {
    version: number;
    exportedAt: string;
    app: string;
    data: {
        graphs: Graph[];
        projects: Project[];
        specialColors: string[];
        standardColors: string[];
    };
}

const SettingsPage: React.FC<SettingsPageProps> = ({
    onBack,
    graphs,
    projects,
    onImportData,
}) => {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [saved, setSaved] = useState(false);
    const [keyConfigured, setKeyConfigured] = useState(false);
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);
    const [importConfirmOpen, setImportConfirmOpen] = useState(false);
    const [pendingImportData, setPendingImportData] = useState<{ graphs: Graph[]; projects: Project[]; specialColors?: string[]; standardColors?: string[] } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const existing = getApiKey();
        if (existing) {
            setApiKey(existing);
            setKeyConfigured(true);
        }
    }, []);

    const handleSaveKey = () => {
        saveApiKey(apiKey);
        setKeyConfigured(apiKey.trim().length > 0);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleClearKey = () => {
        setApiKey('');
        saveApiKey('');
        setKeyConfigured(false);
    };

    const maskKey = (key: string) => {
        if (key.length <= 8) return '*'.repeat(key.length);
        return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4);
    };

    // --- Export ---
    const handleExport = () => {
        const specialColors = JSON.parse(localStorage.getItem('econgraph_special_colors') || '[]');
        const standardColors = JSON.parse(localStorage.getItem('econgraph_standard_colors') || '[]');

        const payload: ExportPayload = {
            version: EXPORT_VERSION,
            exportedAt: new Date().toISOString(),
            app: 'econgraph-ai',
            data: {
                graphs,
                projects,
                specialColors,
                standardColors,
            },
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `econgraph-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- Import ---
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const raw = event.target?.result as string;
                const payload = JSON.parse(raw) as ExportPayload;

                // Validate structure
                if (payload.app !== 'econgraph-ai' || !payload.data) {
                    setImportStatus({ type: 'error', message: 'Invalid backup file. This file was not exported from IB EconGraph AI.' });
                    return;
                }

                if (!Array.isArray(payload.data.graphs) || !Array.isArray(payload.data.projects)) {
                    setImportStatus({ type: 'error', message: 'Backup file is corrupted or missing required data.' });
                    return;
                }

                // Store the data and show confirmation modal
                setPendingImportData({
                    graphs: payload.data.graphs,
                    projects: payload.data.projects,
                    specialColors: payload.data.specialColors,
                    standardColors: payload.data.standardColors,
                });
                setImportConfirmOpen(true);
            } catch {
                setImportStatus({ type: 'error', message: 'Failed to parse the backup file. Make sure it is a valid JSON export.' });
            }
        };
        reader.readAsText(file);

        // Reset input so the same file can be selected again
        e.target.value = '';
    };

    const confirmImport = () => {
        if (!pendingImportData) return;

        onImportData(pendingImportData);

        const graphCount = pendingImportData.graphs.length;
        const projectCount = pendingImportData.projects.length;
        setImportStatus({
            type: 'success',
            message: `Imported ${graphCount} graph${graphCount !== 1 ? 's' : ''} and ${projectCount} project${projectCount !== 1 ? 's' : ''} successfully.`
        });

        setPendingImportData(null);
        setImportConfirmOpen(false);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <ConfirmModal
                isOpen={confirmClearOpen}
                onClose={() => setConfirmClearOpen(false)}
                onConfirm={() => {
                    handleClearKey();
                    setConfirmClearOpen(false);
                }}
                title="Remove API Key"
                message="Are you sure you want to remove your API key? You won't be able to use AI features until you add a new one."
                confirmText="Remove"
                variant="danger"
            />

            <ConfirmModal
                isOpen={importConfirmOpen}
                onClose={() => {
                    setImportConfirmOpen(false);
                    setPendingImportData(null);
                }}
                onConfirm={confirmImport}
                title="Import Backup Data"
                message={`This will replace all your current data with ${pendingImportData?.graphs.length || 0} graph${(pendingImportData?.graphs.length || 0) !== 1 ? 's' : ''} and ${pendingImportData?.projects.length || 0} project${(pendingImportData?.projects.length || 0) !== 1 ? 's' : ''}. This action cannot be undone.`}
                confirmText="Import"
                variant="danger"
            />

            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200/50">
                                <BarChart2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-xl text-gray-900">Settings</h1>
                                <p className="text-xs text-gray-500">Manage your API key and data</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
                {/* API Key Section */}
                <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                                <Key className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900 text-lg">Google AI Studio API Key</h2>
                                <p className="text-sm text-gray-500">Required for AI diagram generation</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Status indicator */}
                        <div className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg ${keyConfigured
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-700'
                            }`}>
                            {keyConfigured ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    API key is configured
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="w-4 h-4" />
                                    No API key configured — AI features are disabled
                                </>
                            )}
                        </div>

                        {/* Key input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                API Key
                            </label>
                            <div className="relative">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    value={showKey ? apiKey : (apiKey ? maskKey(apiKey) : '')}
                                    onChange={(e) => {
                                        if (showKey) {
                                            setApiKey(e.target.value);
                                        } else {
                                            // When masked, replace entire value
                                            setApiKey(e.target.value);
                                            setShowKey(true);
                                        }
                                    }}
                                    onFocus={() => {
                                        if (!showKey && apiKey) {
                                            setShowKey(true);
                                        }
                                    }}
                                    placeholder="Enter your Google AI Studio API key..."
                                    className="w-full pr-24 pl-4 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono bg-gray-50 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-1.5">
                                Your key is stored locally in your browser and never sent to any server other than Google's API.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSaveKey}
                                disabled={!apiKey.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
                            >
                                {saved ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Saved
                                    </>
                                ) : (
                                    'Save Key'
                                )}
                            </button>
                            {keyConfigured && (
                                <button
                                    onClick={() => setConfirmClearOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Remove Key
                                </button>
                            )}
                        </div>

                        {/* Help link */}
                        <div className="pt-2 border-t border-gray-100">
                            <a
                                href="https://aistudio.google.com/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Get a free API key from Google AI Studio
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </div>
                </section>

                {/* Import/Export Section */}
                <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Download className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900 text-lg">Import & Export Data</h2>
                                <p className="text-sm text-gray-500">Back up or restore all your graphs and projects</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Data summary */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-gray-900">{graphs.length}</div>
                                <div className="text-sm text-gray-500">Graph{graphs.length !== 1 ? 's' : ''}</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-gray-900">{projects.length}</div>
                                <div className="text-sm text-gray-500">Project{projects.length !== 1 ? 's' : ''}</div>
                            </div>
                        </div>

                        {/* Export */}
                        <div>
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-sm w-full justify-center"
                            >
                                <Download className="w-4 h-4" />
                                Export All Data
                            </button>
                            <p className="text-xs text-gray-400 mt-1.5">
                                Downloads a JSON file with all your graphs, projects, and color settings.
                            </p>
                        </div>

                        {/* Import */}
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <button
                                onClick={handleImportClick}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium w-full justify-center"
                            >
                                <Upload className="w-4 h-4" />
                                Import Data from Backup
                            </button>
                            <p className="text-xs text-gray-400 mt-1.5">
                                Replaces all current data with the contents of the backup file.
                            </p>
                        </div>

                        {/* Import status */}
                        {importStatus && (
                            <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${importStatus.type === 'success'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                                }`}>
                                {importStatus.type === 'success' ? (
                                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                                ) : (
                                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                )}
                                {importStatus.message}
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default SettingsPage;
