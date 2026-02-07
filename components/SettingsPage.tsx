import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronLeft, Key, Eye, EyeOff, Check, AlertTriangle,
    Download, Upload, BarChart2, Trash2, ExternalLink, Cpu, RefreshCw
} from 'lucide-react';
import {
    getApiKey as getGeminiApiKey,
    saveApiKey as saveGeminiApiKey,
    hasApiKey as hasGeminiApiKey,
    fetchAvailableModels,
    ModelInfo,
    getSelectedModel as getGeminiSelectedModel,
    saveSelectedModel as saveGeminiSelectedModel
} from '../services/gemini';
import {
    getOpenRouterApiKey,
    hasOpenRouterApiKey,
    saveOpenRouterApiKey,
    getOpenRouterSelectedModel,
    saveOpenRouterSelectedModel,
    fetchOpenRouterModels,
    type OpenRouterModelInfo,
} from '../services/openrouter';
import { AIProvider, getAIProvider, setAIProvider } from '../services/aiProvider';
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
    const [provider, setProviderState] = useState<AIProvider>(() => getAIProvider());
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [saved, setSaved] = useState(false);
    const [keyConfigured, setKeyConfigured] = useState(false);
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);
    const [importConfirmOpen, setImportConfirmOpen] = useState(false);
    const [pendingImportData, setPendingImportData] = useState<{ graphs: Graph[]; projects: Project[]; specialColors?: string[]; standardColors?: string[] } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [loadingModels, setLoadingModels] = useState(false);
    const [modelsFetched, setModelsFetched] = useState(false);
    const [modelsError, setModelsError] = useState<string | null>(null);
    const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModelInfo[]>([]);
    const [openRouterModelsFetched, setOpenRouterModelsFetched] = useState(false);
    const [openRouterModelsLoading, setOpenRouterModelsLoading] = useState(false);
    const [openRouterModelsError, setOpenRouterModelsError] = useState<string | null>(null);

    const loadProviderState = (p: AIProvider) => {
        const existingKey = p === 'openrouter' ? getOpenRouterApiKey() : getGeminiApiKey();
        if (existingKey) {
            setApiKey(existingKey);
            setKeyConfigured(true);
        } else {
            setApiKey('');
            setKeyConfigured(false);
        }

        const model = p === 'openrouter' ? getOpenRouterSelectedModel() : getGeminiSelectedModel();
        setSelectedModel(model);

        // Reset model-fetch UI when switching providers
        setAvailableModels([]);
        setModelsFetched(false);
        setModelsError(null);
        setLoadingModels(false);
        setOpenRouterModels([]);
        setOpenRouterModelsFetched(false);
        setOpenRouterModelsError(null);
        setOpenRouterModelsLoading(false);
    };

    useEffect(() => {
        const p = getAIProvider();
        setProviderState(p);
        loadProviderState(p);
    }, []);

    const handleProviderChange = (p: AIProvider) => {
        setAIProvider(p);
        setProviderState(p);
        setSaved(false);
        setShowKey(false);
        loadProviderState(p);
    };

    const handleFetchGeminiModels = async () => {
        if (!keyConfigured) {
            setModelsError('Please save your API key first');
            return;
        }

        setLoadingModels(true);
        setModelsError(null);
        try {
            const models = await fetchAvailableModels();
            setAvailableModels(models);
            setModelsFetched(true);

            // If current selected model is not in the list, select the first one
            if (models.length > 0 && !models.some(m => m.name === selectedModel)) {
                const firstModel = models[0].name;
                setSelectedModel(firstModel);
                saveGeminiSelectedModel(firstModel);
            }
        } catch (error) {
            setModelsError(error instanceof Error ? error.message : 'Failed to fetch models');
        } finally {
            setLoadingModels(false);
        }
    };

    const handleFetchOpenRouterModels = async () => {
        if (!keyConfigured) {
            setOpenRouterModelsError('Please save your API key first');
            return;
        }

        setOpenRouterModelsLoading(true);
        setOpenRouterModelsError(null);
        try {
            const models = await fetchOpenRouterModels();
            setOpenRouterModels(models);
            setOpenRouterModelsFetched(true);

            // If current selected model is not in the list, select the first one
            if (models.length > 0 && !models.some(m => m.id === selectedModel)) {
                const firstModel = models[0].id;
                setSelectedModel(firstModel);
                saveOpenRouterSelectedModel(firstModel);
            }
        } catch (error) {
            setOpenRouterModelsError(error instanceof Error ? error.message : 'Failed to fetch models');
        } finally {
            setOpenRouterModelsLoading(false);
        }
    };

    const handleModelChange = (modelName: string) => {
        setSelectedModel(modelName);
        if (provider === 'openrouter') {
            saveOpenRouterSelectedModel(modelName);
        } else {
            saveGeminiSelectedModel(modelName);
        }
    };

    const handleSaveKey = () => {
        if (provider === 'openrouter') {
            saveOpenRouterApiKey(apiKey);
            setKeyConfigured(hasOpenRouterApiKey());
        } else {
            saveGeminiApiKey(apiKey);
            setKeyConfigured(hasGeminiApiKey());
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleClearKey = () => {
        setApiKey('');
        if (provider === 'openrouter') {
            saveOpenRouterApiKey('');
        } else {
            saveGeminiApiKey('');
        }
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
                                <h2 className="font-semibold text-gray-900 text-lg">AI Provider & API Key</h2>
                                <p className="text-sm text-gray-500">Select a provider and configure the key used for diagram generation</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Provider selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Provider
                            </label>
                            <select
                                value={provider}
                                onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-gray-50 transition-all"
                            >
                                <option value="gemini">Google AI Studio (Gemini)</option>
                                <option value="openrouter">OpenRouter</option>
                            </select>
                        </div>
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
                                {provider === 'openrouter' ? 'OpenRouter API Key' : 'Google AI Studio API Key'}
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
                                    placeholder={provider === 'openrouter'
                                        ? 'Enter your OpenRouter API key...'
                                        : 'Enter your Google AI Studio API key...'}
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
                                Your key is stored locally in your browser and only sent to the selected provider when you generate diagrams.
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
                                href={provider === 'openrouter' ? 'https://openrouter.ai/keys' : 'https://aistudio.google.com/apikey'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                {provider === 'openrouter'
                                    ? 'Get an API key from OpenRouter'
                                    : 'Get a free API key from Google AI Studio'}
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </div>
                </section>

                {/* Model Selection Section */}
                <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Cpu className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900 text-lg">AI Model Selection</h2>
                                <p className="text-sm text-gray-500">
                                    {provider === 'openrouter'
                                        ? 'Set the OpenRouter model ID (e.g. provider/model)'
                                        : 'Choose which Gemini model to use for generation'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        {!keyConfigured ? (
                            <div className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg bg-amber-50 text-amber-700">
                                <AlertTriangle className="w-4 h-4" />
                                Configure your API key first to select a model
                            </div>
                        ) : (
                            <>
                                {provider === 'openrouter' ? (
                                    <div>
                                        {/* Fetch Models Button */}
                                        {(!openRouterModelsFetched || openRouterModels.length === 0) && (
                                            <button
                                                onClick={handleFetchOpenRouterModels}
                                                disabled={openRouterModelsLoading}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm w-full justify-center"
                                            >
                                                {openRouterModelsLoading ? (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                        Fetching Models...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw className="w-4 h-4" />
                                                        Fetch OpenRouter Models
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {/* Model Selector */}
                                        {openRouterModelsFetched && openRouterModels.length > 0 && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    Selected Model
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={selectedModel}
                                                        onChange={(e) => handleModelChange(e.target.value)}
                                                        className="flex-1 px-4 py-3 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm bg-gray-50 transition-all"
                                                    >
                                                        {openRouterModels.map((model) => (
                                                            <option key={model.id} value={model.id}>
                                                                {model.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={handleFetchOpenRouterModels}
                                                        disabled={openRouterModelsLoading}
                                                        className="p-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Refresh models"
                                                    >
                                                        <RefreshCw className={`w-4 h-4 ${openRouterModelsLoading ? 'animate-spin' : ''}`} />
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1.5">
                                                    {openRouterModels.length} model{openRouterModels.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        )}

                                        {/* Error Message */}
                                        {openRouterModelsError && (
                                            <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-red-50 text-red-700">
                                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                                {openRouterModelsError}
                                            </div>
                                        )}

                                        {/* Empty State */}
                                        {openRouterModelsFetched && openRouterModels.length === 0 && !openRouterModelsError && (
                                            <div className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg bg-amber-50 text-amber-700">
                                                <AlertTriangle className="w-4 h-4" />
                                                No structured-output models found. You can still enter a model ID manually.
                                            </div>
                                        )}

                                        {/* Current Model Display (fallback when not fetched) */}
                                        {(!openRouterModelsFetched || openRouterModels.length === 0) && selectedModel && (
                                            <div className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg bg-purple-50 text-purple-700">
                                                <Cpu className="w-4 h-4" />
                                                Currently using: {selectedModel}
                                            </div>
                                        )}

                                        {/* Manual model ID input (when no models fetched) */}
                                        {(!openRouterModelsFetched || openRouterModels.length === 0) && (
                                            <input
                                                value={selectedModel}
                                                onChange={(e) => handleModelChange(e.target.value)}
                                                placeholder="provider/model"
                                                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm bg-gray-50 transition-all mt-2"
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {/* Fetch Models Button */}
                                        {!modelsFetched && (
                                            <button
                                                onClick={handleFetchGeminiModels}
                                                disabled={loadingModels}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm w-full justify-center"
                                            >
                                                {loadingModels ? (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                        Fetching Models...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw className="w-4 h-4" />
                                                        Fetch Available Models
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {/* Model Selector */}
                                        {modelsFetched && availableModels.length > 0 && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    Selected Model
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={selectedModel}
                                                        onChange={(e) => handleModelChange(e.target.value)}
                                                        className="flex-1 px-4 py-3 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm bg-gray-50 transition-all"
                                                    >
                                                        {availableModels.map((model) => (
                                                            <option key={model.name} value={model.name}>
                                                                {model.displayName}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={handleFetchGeminiModels}
                                                        disabled={loadingModels}
                                                        className="p-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Refresh models"
                                                    >
                                                        <RefreshCw className={`w-4 h-4 ${loadingModels ? 'animate-spin' : ''}`} />
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1.5">
                                                    {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} available
                                                </p>
                                            </div>
                                        )}

                                        {/* Error Message */}
                                        {modelsError && (
                                            <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-red-50 text-red-700">
                                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                                {modelsError}
                                            </div>
                                        )}

                                        {/* Current Model Display */}
                                        {!modelsFetched && selectedModel && (
                                            <div className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg bg-purple-50 text-purple-700">
                                                <Cpu className="w-4 h-4" />
                                                Currently using: {selectedModel}
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
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
