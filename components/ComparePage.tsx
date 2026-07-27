import React from 'react';
import {
    BarChart2, Check, X, Minus, Github, ArrowRight, ShieldCheck, Info,
} from 'lucide-react';

interface ComparePageProps {
    onOpenEditor: () => void;
    onOpenLanding: () => void;
    onOpenPricing: () => void;
}

type CellValue = { kind: 'yes' | 'no' | 'partial'; text: string };

const yes = (text: string): CellValue => ({ kind: 'yes', text });
const no = (text: string): CellValue => ({ kind: 'no', text });
const partial = (text: string): CellValue => ({ kind: 'partial', text });

// Competitor facts verified against their live sites on 2026-07-17.
// EconGraph Pro: econgraphs.diplomacollective.com (Diploma Collective)
// EconDiagrams: econdiagrams.com (EconDaddy.com Ltd., in beta)
const ROWS: { label: string; us: CellValue; egp: CellValue; ed: CellValue }[] = [
    {
        label: 'Price to create & export a diagram',
        us: yes('Free, forever, no watermark'),
        egp: no('Paid membership required to download or save ($2/mo at checkout; their site also shows $1.66/mo)'),
        ed: partial('Free tier exports images, capped at 3 diagrams'),
    },
    {
        label: 'Diagram limit on the free tier',
        us: yes('Unlimited diagrams & projects'),
        egp: no('None savable, downloads and saving are fully paywalled'),
        ed: no('3 diagrams, 1 whiteboard, 1 collection'),
    },
    {
        label: 'AI diagram generation',
        us: yes('Yes, free with your own key, or hosted on the Supporter plan'),
        egp: no('No AI features'),
        ed: no('No AI features'),
    },
    {
        label: 'Export formats',
        us: yes('SVG, PNG, and JPEG at full quality'),
        egp: partial('Single "Download Diagram" button, behind the paywall (formats unverified)'),
        ed: partial('"Export as image" (format unspecified)'),
    },
    {
        label: 'Works without an account',
        us: yes('Yes, no sign-up to create or export'),
        egp: partial('Can edit without an account, but paid account needed to download'),
        ed: no('Email registration required'),
    },
    {
        label: 'Diagram coverage',
        us: yes('Any IB diagram, freeform tools, 15+ templates, and AI for the rest'),
        egp: no('5 diagram types live (a 6th marked "Coming Soon")'),
        ed: yes('40+ IB-aligned templates claimed (site also says 50+)'),
    },
    {
        label: 'Your data stays on your device',
        us: yes('Local-first, cloud sync is optional'),
        egp: no('Cloud-based'),
        ed: no('Cloud-based'),
    },
    {
        label: 'Open source',
        us: yes('AGPL-3.0 licensed, audit it, fork it, self-host it'),
        egp: no('Proprietary'),
        ed: no('Proprietary'),
    },
    {
        label: 'Product status',
        us: yes('Live and actively maintained'),
        egp: yes('Live'),
        ed: partial('Public beta (paid plan invite-only, unpriced)'),
    },
];

const CellIcon: React.FC<{ kind: CellValue['kind'] }> = ({ kind }) => {
    if (kind === 'yes') {
        return (
            <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
            </div>
        );
    }
    if (kind === 'no') {
        return (
            <div className="w-5 h-5 bg-red-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <X className="w-3.5 h-3.5 text-red-400" />
            </div>
        );
    }
    return (
        <div className="w-5 h-5 bg-amber-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <Minus className="w-3.5 h-3.5 text-amber-500" />
        </div>
    );
};

const ComparePage: React.FC<ComparePageProps> = ({ onOpenEditor, onOpenLanding, onOpenPricing }) => {
    return (
        <div className="min-h-screen bg-white">
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
                        <button onClick={onOpenPricing} className="hidden sm:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-2">
                            Pricing
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
            <section className="pt-20 pb-10 px-6 text-center">
                <div className="max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-8 border border-blue-100">
                        <ShieldCheck className="w-4 h-4" />
                        An honest comparison
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight mb-6">
                        How IB EconGraph AI compares
                    </h1>
                    <p className="text-lg text-gray-500 leading-relaxed font-light">
                        The two tools IB Economics students most often consider are{' '}
                        <span className="font-medium text-gray-700">EconGraph Pro</span> (Diploma Collective) and{' '}
                        <span className="font-medium text-gray-700">EconDiagrams</span> (EconDaddy). Here's the honest, factual breakdown.
                    </p>
                </div>
            </section>

            {/* Comparison table */}
            <section className="pb-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                        <table className="w-full text-left text-sm min-w-[760px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="p-4 font-semibold text-gray-500 w-[22%]"></th>
                                    <th className="p-4 font-bold text-gray-900 w-[26%] bg-blue-50/50">
                                        IB EconGraph AI
                                        <div className="text-xs font-medium text-blue-600 mt-0.5">this tool</div>
                                    </th>
                                    <th className="p-4 font-semibold text-gray-700 w-[26%]">
                                        EconGraph Pro
                                        <div className="text-xs font-normal text-gray-400 mt-0.5">Diploma Collective</div>
                                    </th>
                                    <th className="p-4 font-semibold text-gray-700 w-[26%]">
                                        EconDiagrams
                                        <div className="text-xs font-normal text-gray-400 mt-0.5">EconDaddy · beta</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {ROWS.map((row, i) => (
                                    <tr key={i} className="border-b border-slate-100 last:border-0 align-top">
                                        <td className="p-4 font-medium text-gray-700">{row.label}</td>
                                        <td className="p-4 bg-blue-50/30">
                                            <div className="flex items-start gap-2 text-gray-700">
                                                <CellIcon kind={row.us.kind} />
                                                <span>{row.us.text}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-start gap-2 text-gray-500">
                                                <CellIcon kind={row.egp.kind} />
                                                <span>{row.egp.text}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-start gap-2 text-gray-500">
                                                <CellIcon kind={row.ed.kind} />
                                                <span>{row.ed.text}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex items-start gap-2 text-xs text-gray-400">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <p>
                            Based on each product's publicly visible website and app as of July 17, 2026. Details behind
                            paywalls or logins are marked unverified. Products may change, so check their sites for current
                            terms. Spotted an inaccuracy?{' '}
                            <a
                                href="https://github.com/sukarth/IB-EconGraph-AI/issues"
                                target="_blank" rel="noopener noreferrer"
                                className="underline hover:text-gray-600"
                            >
                                Open an issue
                            </a>{' '}
                            and it will be corrected.
                        </p>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-14 px-6 bg-slate-50 border-y border-slate-100 text-center">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">
                        Try it now!
                        <br></br>
                        You got nothing to lose, literally
                    </h2>
                    <p className="text-gray-500 mb-8">
                        No account, no card, no watermark. Your first exam-ready diagram is 30 seconds away.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <button
                            onClick={onOpenEditor}
                            className="group inline-flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg shadow-blue-200/50 hover:shadow-xl transition-all hover:-translate-y-0.5"
                        >
                            Open the free editor
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={onOpenPricing}
                            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                        >
                            See pricing &amp; the free-forever guarantee
                        </button>
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
                        <button onClick={onOpenPricing} className="hover:text-gray-700 transition-colors">Pricing</button>
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

export default ComparePage;
