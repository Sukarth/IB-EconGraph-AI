import React, { useState } from 'react';
import {
    BarChart2, Check, Crown, Github, Heart, ArrowRight, Sparkles, Cloud,
    Link2, Layers, BookOpen, Loader2, Coffee, Star, GraduationCap, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../services/auth';
import { startCheckout } from '../services/billing';
import AuthModal from './AuthModal';

interface PricingPageProps {
    onOpenEditor: () => void;
    onOpenLanding: () => void;
    onOpenCompare: () => void;
    onOpenSettings: () => void;
}

const FREE_FEATURES = [
    'Unlimited diagrams and projects',
    'Every drawing tool and all 15+ built-in templates',
    'All export formats (SVG, PNG, JPEG) at full quality, no watermark, ever',
    'Unlimited AI generation with your own free API key (BYOK)',
    'Local JSON backup & restore of everything',
    'Open source (AGPL-3.0), inspect it, fork it, self-host it',
];

const SUPPORTER_FEATURES: { icon: React.ReactNode; text: string }[] = [
    { icon: <Sparkles className="w-4 h-4 text-purple-600" />, text: 'Hosted AI, no API key setup, 150 generations/month included' },
    { icon: <Cloud className="w-4 h-4 text-blue-600" />, text: 'Cloud sync across devices (school laptop and home) with version history' },
    { icon: <Link2 className="w-4 h-4 text-emerald-600" />, text: 'Shareable view-only links, send a diagram to your teacher or group partner' },
    { icon: <Layers className="w-4 h-4 text-amber-600" />, text: 'Custom template library, save your own curve setups, synced' },
    { icon: <Heart className="w-4 h-4 text-rose-500" />, text: 'Supporter badge + your name in the README (optional)' },
];

const FAQ: { q: string; a: string }[] = [
    {
        q: 'Will features ever move from Free to paid?',
        a: 'No. That is the whole point of the guarantee: unlimited diagrams, all tools and templates, full-quality watermark-free exports, unlimited BYOK AI, and local backup stay free forever. Supporter only adds hosted conveniences that genuinely cost money to run (servers, hosted AI).',
    },
    {
        q: 'What happens to my data if I cancel Supporter?',
        a: 'You keep everything. Your data always lives in your browser first, you can export a full JSON backup any time, and reading your synced data is never locked, only new cloud writes pause until you resubscribe.',
    },
    {
        q: 'Is VAT included? Can I get an invoice?',
        a: 'Yes. Payments are processed by Polar as merchant of record, which handles EU VAT and provides invoices from the billing portal.',
    },
    {
        q: 'Is my work private?',
        a: 'Yes. Locally, everything stays in your browser. With sync, data is stored under your account (row-level security). Share links contain only the diagram, never your AI chat history, and can be revoked at any time.',
    },
    {
        q: "I'm a teacher, can I get this for my whole class?",
        a: "The free tier already covers everything a class needs for IAs. If there's genuine demand for a Classroom plan (one license, whole class gets Supporter), it will happen, open a GitHub issue to register interest.",
    },
];

const PricingPage: React.FC<PricingPageProps> = ({ onOpenEditor, onOpenLanding, onOpenCompare, onOpenSettings }) => {
    const { configured, user, isPro } = useAuth();
    const [interval, setInterval] = useState<'month' | 'year'>('month');
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [authModalOpen, setAuthModalOpen] = useState(false);

    const handleSubscribe = async () => {
        setCheckoutError(null);
        if (!configured) {
            setCheckoutError('Billing is not configured on this deployment.');
            return;
        }
        if (!user) {
            setAuthModalOpen(true);
            return;
        }
        if (isPro) {
            onOpenSettings();
            return;
        }
        setCheckoutLoading(true);
        const result = await startCheckout(interval);
        setCheckoutLoading(false);
        if (result.url) {
            window.location.href = result.url;
        } else {
            setCheckoutError(result.error ?? 'Could not start checkout.');
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <AuthModal
                isOpen={authModalOpen}
                onClose={() => setAuthModalOpen(false)}
                title="Sign in to continue"
                message="Create a free account first (it takes a few seconds). Once you're signed in, click Become a Supporter again to go to checkout."
                // Come back here, not to Settings: the message above tells them
                // to click Become a Supporter again, which only exists on this page.
                returnTo="/pricing"
            />

            {/* Nav */}
            <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button onClick={onOpenLanding} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200/50">
                            <BarChart2 className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-xl text-gray-900 tracking-tight">IB EconGraph AI</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <button onClick={onOpenCompare} className="hidden sm:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-2">
                            Compare
                        </button>
                        <button
                            onClick={onOpenEditor}
                            className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-all"
                        >
                            Open Editor
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-20 pb-12 px-6 text-center">
                <div className="max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-8 border border-emerald-100">
                        <ShieldCheck className="w-4 h-4" />
                        The guarantee
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
                        Everything a student needs to finish their IA is{' '}
                        <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                            free and unlimited, forever.
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-gray-500 leading-relaxed font-light max-w-2xl mx-auto">
                        No trials, no watermarks, no export paywalls, no diagram limits.
                        The Supporter plan exists for hosted convenience and for people who want
                        to keep this project alive.
                    </p>
                </div>
            </section>

            {/* Plans */}
            <section className="pb-20 px-6">
                <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6 items-stretch">
                    {/* Free */}
                    <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white p-8 flex flex-col">
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-2">
                                <GraduationCap className="w-5 h-5 text-emerald-600" />
                                <h2 className="text-xl font-bold text-gray-900">Free</h2>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-bold text-gray-900">$0</span>
                                <span className="text-gray-400">forever</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">Everything you need for your IA, Paper 1, and beyond.</p>
                        </div>
                        <ul className="space-y-3.5 flex-1">
                            {FREE_FEATURES.map((feature, i) => (
                                <li key={i} className="flex items-start gap-3 text-gray-600 text-sm leading-relaxed">
                                    <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    </div>
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={onOpenEditor}
                            className="mt-8 w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                        >
                            Start creating now
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Supporter */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-8 flex flex-col shadow-xl shadow-slate-100">
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Crown className="w-5 h-5 text-amber-500" />
                                <h2 className="text-xl font-bold text-gray-900">Supporter</h2>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-bold text-gray-900">{interval === 'month' ? '$5' : '$50'}</span>
                                <span className="text-gray-400">/{interval === 'month' ? 'month' : 'year'}</span>
                            </div>
                            <div className="inline-flex mt-3 p-1 bg-gray-100 rounded-lg text-sm">
                                <button
                                    onClick={() => setInterval('month')}
                                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${interval === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setInterval('year')}
                                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${interval === 'year' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                                >
                                    Yearly <span className="text-emerald-600">(2 months free)</span>
                                </button>
                            </div>
                        </div>
                        <div className="text-sm text-gray-500 mb-4 font-medium">Everything in Free, plus:</div>
                        <ul className="space-y-3.5 flex-1">
                            {SUPPORTER_FEATURES.map((feature, i) => (
                                <li key={i} className="flex items-start gap-3 text-gray-600 text-sm leading-relaxed">
                                    <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        {feature.icon}
                                    </div>
                                    {feature.text}
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={handleSubscribe}
                            disabled={checkoutLoading}
                            className="mt-8 w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-colors shadow-lg shadow-amber-100 disabled:opacity-60"
                        >
                            {checkoutLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isPro ? (
                                <>You're a Supporter, manage in Settings</>
                            ) : (
                                <>
                                    <Crown className="w-4 h-4" />
                                    Become a Supporter
                                </>
                            )}
                        </button>
                        {checkoutError && (
                            <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{checkoutError}</div>
                        )}
                        <p className="mt-3 text-xs text-gray-400 text-center">
                            Payments processed by Polar. 
                        </p>
                    </div>
                </div>
            </section>

            {/* Other ways to support */}
            <section className="py-16 px-6 bg-slate-50 border-y border-slate-100">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 tracking-tight">
                        Other ways to support the project
                    </h2>
                    <p className="text-gray-500 mb-8">
                        Not into subscriptions? One-off support keeps the lights on just as well. And starring the
                        repo helps more students find a free tool.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <a
                            href="https://github.com/sponsors/Sukarth"
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-white border border-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:border-slate-300 hover:shadow-sm transition-all"
                        >
                            <Heart className="w-4 h-4 text-pink-500" />
                            GitHub Sponsors
                        </a>
                        <a
                            href="https://ko-fi.com/sukarth"
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-white border border-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:border-slate-300 hover:shadow-sm transition-all"
                        >
                            <Coffee className="w-4 h-4 text-rose-500" />
                            Ko-fi
                        </a>
                        <a
                            href="https://buymeacoffee.com/sukarth"
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-white border border-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:border-slate-300 hover:shadow-sm transition-all"
                        >
                            <Coffee className="w-4 h-4 text-amber-500" />
                            Buy Me a Coffee
                        </a>
                        <a
                            href="https://github.com/sukarth/IB-EconGraph-AI"
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-white border border-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:border-slate-300 hover:shadow-sm transition-all"
                        >
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            Star on GitHub
                        </a>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-20 px-6">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-10 tracking-tight text-center">
                        Questions, answered honestly
                    </h2>
                    <div className="space-y-8">
                        {FAQ.map((item, i) => (
                            <div key={i}>
                                <h3 className="font-semibold text-gray-900 mb-2">{item.q}</h3>
                                <p className="text-gray-500 leading-relaxed text-sm md:text-base">{item.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-slate-100">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <button onClick={onOpenLanding} className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                            <BarChart2 className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-semibold text-gray-900">IB EconGraph AI</span>
                    </button>
                    <div className="flex items-center gap-5 text-sm text-gray-400">
                        <button onClick={onOpenCompare} className="hover:text-gray-700 transition-colors">Compare</button>
                        <a
                            href="https://github.com/sukarth/IB-EconGraph-AI"
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                        >
                            <Github className="w-4 h-4" /> GitHub
                        </a>
                        <span>AGPL-3.0</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PricingPage;
