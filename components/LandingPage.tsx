import React, { useState, useEffect, useRef } from 'react';
import {
    Sparkles,
    TrendingUp,
    PaintBucket,
    MousePointer2,
    Layers,
    Zap,
    ArrowRight,
    BarChart2,
    Bot,
    Brush,
    CheckCircle2,
    Github,
    Star,
    Code2,
    GraduationCap,
    Heart
} from 'lucide-react';

export interface LandingPageProps {
    onGoHome: () => void;
    onOpenPricing: () => void;
    onOpenCompare: () => void;
}

// ─── Fade-in on scroll component ───
const ScrollReveal: React.FC<{
    children: React.ReactNode;
    className?: string;
    delay?: number;
    direction?: 'up' | 'left' | 'right';
    style?: React.CSSProperties;
}> = ({ children, className = '', delay = 0, direction = 'up', style = {} }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const initial: Record<string, string> = {
        up: 'translateY(40px)',
        left: 'translateX(-40px)',
        right: 'translateX(40px)',
    };

    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0) translateX(0)' : initial[direction],
                transition: `opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
                ...style,
            }}
        >
            {children}
        </div>
    );
};

const LandingPage: React.FC<LandingPageProps> = ({ onGoHome, onOpenPricing, onOpenCompare }) => {
    const [scrollY, setScrollY] = useState(0);
    const [heroTilt, setHeroTilt] = useState({ rotateX: 0, rotateY: 0 });
    const [openSourceMouse, setOpenSourceMouse] = useState({ x: 50, y: 50 });
    const heroRef = useRef<HTMLDivElement>(null);
    const openSourceRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!heroRef.current) return;
        const rect = heroRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rotateY = (x - 0.5) * 10; // -5 to 5 degrees
        const rotateX = (y - 0.5) * -10; // -5 to 5 degrees
        setHeroTilt({ rotateX, rotateY });
    };

    const handleHeroMouseLeave = () => {
        setHeroTilt({ rotateX: 0, rotateY: 0 });
    };

    const handleOpenSourceMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!openSourceRef.current) return;
        const rect = openSourceRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setOpenSourceMouse({ x, y });
    };

    const features = [
        {
            icon: <MousePointer2 className="w-6 h-6" />,
            title: 'Intuitive Drawing Tools',
            description: 'Draw curves, lines, and shapes with precision. Drag entire lines or just endpoints to customize your diagrams.',
            color: 'text-blue-600 bg-blue-100',
        },
        {
            icon: <Sparkles className="w-6 h-6" />,
            title: 'AI-Powered Generation',
            description: 'Describe any IB Economics concept and watch it come to life with accurate, exam-ready diagrams.',
            color: 'text-purple-600 bg-purple-100',
        },
        {
            icon: <PaintBucket className="w-6 h-6" />,
            title: 'Area Shading',
            description: 'Easily shade consumer surplus, deadweight loss, tax revenue, and other key economic areas.',
            color: 'text-emerald-600 bg-emerald-100',
        },
        {
            icon: <Layers className="w-6 h-6" />,
            title: 'Component Library',
            description: 'Pre-built IB curves, points, and complete diagrams ready to drag and drop onto your canvas.',
            color: 'text-amber-600 bg-amber-100',
        },
        {
            icon: <Zap className="w-6 h-6" />,
            title: 'Smart Snapping',
            description: 'Points snap to grid and linked elements. Curves stay connected when you drag them around.',
            color: 'text-rose-600 bg-rose-100',
        },
        {
            icon: <BarChart2 className="w-6 h-6" />,
            title: 'Export & Share',
            description: 'Export high-quality SVGs perfect for IB Internal Assessments, presentations, and papers.',
            color: 'text-cyan-600 bg-cyan-100',
        },
    ];

    const diagramTypes = [
        'Supply & Demand',
        'Monopoly',
        'Negative Externalities',
        'Price Controls',
        'Tariffs & Quotas',
        'AD/AS Model',
        'Perfect Competition',
        'PPC Curves',
        'Tax Incidence',
        'Exchange Rates',
    ];

    return (
        <div
            className="min-h-screen relative"
            style={{
                background: `
                    radial-gradient(ellipse 900px 700px at 85% 80px, rgba(219, 234, 254, 0.5), transparent),
                    radial-gradient(ellipse 700px 600px at 10% 900px, rgba(224, 231, 255, 0.35), transparent),
                    radial-gradient(ellipse 800px 700px at 90% 2200px, rgba(233, 213, 255, 0.25), transparent),
                    radial-gradient(ellipse 600px 500px at 15% 3400px, rgba(219, 234, 254, 0.25), transparent),
                    radial-gradient(ellipse 700px 600px at 80% 4400px, rgba(224, 231, 255, 0.2), transparent),
                    white
                `,
            }}
        >

            {/* ──────── NAVIGATION ──────── */}
            <nav
                className="sticky top-0 z-50 transition-all duration-500"
                style={{
                    backgroundColor: scrollY > 50 ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.5)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderBottom: scrollY > 50 ? '1px solid rgba(226,232,240,0.7)' : '1px solid transparent',
                    boxShadow: scrollY > 50 ? '0 1px 8px rgba(0,0,0,0.04)' : 'none',
                }}
            >
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200/50">
                            <BarChart2 className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-xl text-gray-900 tracking-tight">
                            IB EconGraph AI
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onOpenPricing}
                            className="hidden md:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-2"
                        >
                            Pricing
                        </button>
                        <button
                            onClick={onOpenCompare}
                            className="hidden md:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-2"
                        >
                            Compare
                        </button>
                        <a
                            href="https://github.com/sukarth/IB-EconGraph-AI"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 transition-all text-gray-700 text-sm font-medium"
                        >
                            <Github className="w-4 h-4" />
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span>Star on GitHub</span>
                        </a>
                        <button
                            onClick={onGoHome}
                            className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-all shadow-sm hover:shadow-md"
                        >
                            Open Editor
                        </button>
                    </div>
                </div>
            </nav>

            {/* ──────── HERO SECTION ──────── */}
            <section className="relative pt-24 pb-16 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center max-w-4xl mx-auto">
                        <ScrollReveal delay={0}>
                            <div className="inline-flex items-center gap-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 px-5 py-2.5 rounded-full text-sm font-medium mb-8 border border-blue-100/80 shadow-sm">
                                <Code2 className="w-4 h-4" />
                                Open Source
                                <span className="w-1 h-1 rounded-full bg-blue-300" />
                                <GraduationCap className="w-4 h-4" />
                                Built for IB Economics
                            </div>
                        </ScrollReveal>

                        <ScrollReveal delay={120}>
                            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 leading-[1.1] mb-7 tracking-tight">
                                Create Beautiful{' '}
                                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                    Economic Diagrams
                                </span>{' '}
                                in Seconds
                            </h1>
                        </ScrollReveal>

                        <ScrollReveal delay={240}>
                            <p className="text-xl md:text-2xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed font-light">
                                The free, open-source diagram editor built for IB Economics students and educators.
                                Draw manually or let AI generate publication-ready diagrams instantly.
                            </p>
                        </ScrollReveal>

                        <ScrollReveal delay={360}>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button
                                    onClick={onGoHome}
                                    className="group flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg shadow-blue-200/50 hover:shadow-xl hover:shadow-blue-300/50 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    Start Creating Free
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-400 mt-5 flex items-center justify-center gap-1.5 font-small">
                                <Heart className="w-3.5 h-3.5 text-rose-400" />
                                Everything a student needs to finish their IA is free and unlimited, forever.
                            </p>
                        </ScrollReveal>
                    </div>

                    {/* Hero Illustration */}
                    <ScrollReveal delay={480} className="mt-20 relative" style={{ perspective: '1000px' }}>
                        <div
                            ref={heroRef}
                            onMouseMove={handleHeroMouseMove}
                            onMouseLeave={handleHeroMouseLeave}
                            className="cursor-pointer"
                            style={{
                                transform: `translateY(${scrollY * 0.025}px) rotateX(${heroTilt.rotateX}deg) rotateY(${heroTilt.rotateY}deg)`,
                                transition: 'transform 0.3s ease-out',
                                transformStyle: 'preserve-3d',
                            }}
                        >
                            <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden max-w-5xl mx-auto" style={{ boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.12), 0 10px 30px -10px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(148, 163, 184, 0.1)' }}>
                                <div className="h-12 bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-100 flex items-center px-4 gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-400/80" />
                                    <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                                    <div className="w-3 h-3 rounded-full bg-green-400/80" />
                                    <span className="ml-4 text-sm text-slate-400 font-medium">IB EconGraph AI Studio</span>
                                </div>
                                <div className="p-8 bg-gradient-to-br from-slate-50/50 to-white">
                                    <svg viewBox="0 0 600 350" className="w-full">
                                        <defs>
                                            <pattern id="heroGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                                                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                                            </pattern>
                                            <marker id="arrowhead" markerWidth="5" markerHeight="6" refX="2" refY="2.5" orient="auto">
                                                <polygon points="0 0, 5 2.5, 0 5" fill="#374151" />
                                            </marker>
                                        </defs>
                                        <rect fill="url(#heroGrid)" width="600" height="350" />

                                        {/* Axes */}
                                        <line x1="80" y1="300" x2="560" y2="300" stroke="#374151" strokeWidth="2" markerEnd="url(#arrowhead)" />
                                        <line x1="80" y1="300" x2="80" y2="30" stroke="#374151" strokeWidth="2" markerEnd="url(#arrowhead)" />
                                        <text x="530" y="325" fill="#374151" fontWeight="600" fontSize="14">Quantity</text>
                                        <text x="28" y="40" fill="#374151" fontWeight="600" fontSize="14">Price</text>

                                        {/* Consumer Surplus */}
                                        <polygon points="80,44 320,170 80,170" fill="rgba(34, 197, 94, 0.15)" stroke="none" />
                                        <text x="155" y="142" fill="#16a34a" fontWeight="600" fontSize="13">CS</text>

                                        {/* Producer Surplus */}
                                        <polygon points="80,296 320,170 80,170" fill="rgba(59, 130, 246, 0.15)" stroke="none" />
                                        <text x="155" y="225" fill="#2563eb" fontWeight="600" fontSize="13">PS</text>

                                        {/* Demand Curve */}
                                        <line x1="80" y1="44" x2="520" y2="275" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                                        <text x="528" y="283" fill="#ef4444" fontWeight="700" fontSize="15">D</text>

                                        {/* Supply Curve */}
                                        <line x1="80" y1="296" x2="520" y2="65" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
                                        <text x="528" y="73" fill="#3b82f6" fontWeight="700" fontSize="15">S</text>

                                        {/* Dotted Lines */}
                                        <line x1="320" y1="170" x2="320" y2="300" stroke="#9ca3af" strokeWidth="1" strokeDasharray="5,4" />
                                        <line x1="80" y1="170" x2="320" y2="170" stroke="#9ca3af" strokeWidth="1" strokeDasharray="5,4" />

                                        {/* Equilibrium Point */}
                                        <circle cx="320" cy="170" r="6" fill="#111827" stroke="white" strokeWidth="2.5" />
                                        <text x="316" y="153" fill="#111827" fontWeight="700" fontSize="14">E</text>

                                        {/* Axis Labels - Price label moved further left */}
                                        <text x="320" y="318" fill="#6b7280" fontSize="12" textAnchor="middle">Q*</text>
                                        <text x="65" y="174" fill="#6b7280" fontSize="12" textAnchor="end">P*</text>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </ScrollReveal>
                </div>
            </section>

            {/* ──────── DIAGRAM TYPES TICKER ──────── */}
            <section className="relative py-14 overflow-hidden">
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: 'linear-gradient(to right, white 0%, transparent 10%, transparent 90%, white 100%)',
                    }}
                />
                <div className="flex animate-scroll">
                    {[...diagramTypes, ...diagramTypes].map((type, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 px-6 py-3 mx-3 bg-white/80 backdrop-blur-sm rounded-full border border-slate-200/80 shadow-sm whitespace-nowrap hover:border-blue-200 hover:shadow-md transition-all duration-300"
                        >
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-medium text-gray-700">{type}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ──────── OPEN SOURCE SECTION ──────── */}
            <section className="relative py-24 px-6">
                <ScrollReveal>
                    <div className="max-w-5xl mx-auto">
                        <div
                            ref={openSourceRef}
                            onMouseMove={handleOpenSourceMouseMove}
                            className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-10 md:p-14 text-white overflow-hidden"
                        >
                            {/* Decorative glow */}
                            <div
                                className="absolute w-72 h-72 rounded-full pointer-events-none transition-all duration-300 ease-out"
                                style={{
                                    left: `${openSourceMouse.x}%`,
                                    top: `${openSourceMouse.y}%`,
                                    transform: 'translate(-50%, -50%)',
                                    background: 'radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)'
                                }}
                            />
                            <div
                                className="absolute w-56 h-56 rounded-full pointer-events-none transition-all duration-500 ease-out"
                                style={{
                                    left: `${100 - openSourceMouse.x}%`,
                                    top: `${100 - openSourceMouse.y}%`,
                                    transform: 'translate(-50%, -50%)',
                                    background: 'radial-gradient(circle, rgba(99,102,241,0.12), transparent 70%)'
                                }}
                            />

                            <div className="relative flex flex-col md:flex-row items-center gap-10 md:gap-14">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-5">
                                        <Code2 className="w-5 h-5 text-blue-400" />
                                        <span className="text-blue-400 text-sm font-semibold tracking-wide uppercase">Open Source</span>
                                    </div>
                                    <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                                        Free Forever.{' '}
                                        <span className="text-blue-400">Community Driven.</span>
                                    </h2>
                                    <p className="text-slate-300 text-lg leading-relaxed mb-8">
                                        IB EconGraph AI is fully open source under the GNU AGPL v3. Inspect the code,
                                        contribute features, report bugs, or fork it for your own needs.
                                        Built by students, for students.
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        <a
                                            href="https://github.com/sukarth/IB-EconGraph-AI"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 bg-white text-slate-900 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors"
                                        >
                                            <Github className="w-4 h-4" />
                                            View on GitHub
                                        </a>
                                        <a
                                            href="https://github.com/sukarth/IB-EconGraph-AI"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 bg-white/10 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors border border-white/10"
                                        >
                                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                                            Star the Repo
                                        </a>
                                        <a
                                            href="https://ko-fi.com/sukarth"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 bg-white/10 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors border border-white/10"
                                        >
                                            <Heart className="w-4 h-4 fill-rose-400 text-rose-400" />
                                            Support the Project
                                        </a>
                                    </div>
                                    <p className="text-slate-400 text-sm mt-5">
                                        Sponsorships and the{' '}
                                        <button onClick={onOpenPricing} className="text-blue-400 hover:text-blue-300 underline">
                                            Supporter plan
                                        </button>{' '}
                                        keep this tool free for every student. Thank you.
                                    </p>
                                </div>
                                <div className="flex gap-8 md:gap-10 text-center shrink-0">
                                    <div>
                                        <div className="text-3xl md:text-4xl font-bold text-white">100%</div>
                                        <div className="text-slate-400 text-sm mt-1">Free</div>
                                    </div>
                                    <div>
                                        <div className="text-3xl md:text-4xl font-bold text-white">AGPL</div>
                                        <div className="text-slate-400 text-sm mt-1">License</div>
                                    </div>
                                    <div>
                                        <div className="text-3xl md:text-4xl font-bold text-blue-400">
                                            <Heart className="w-8 h-8 md:w-9 md:h-9 mx-auto fill-blue-400" />
                                        </div>
                                        <div className="text-slate-400 text-sm mt-1">Open Source</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollReveal>
            </section>

            {/* ──────── FEATURES GRID ──────── */}
            <section className="relative py-28 px-6">
                <div className="max-w-7xl mx-auto">
                    <ScrollReveal>
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-5 tracking-tight">
                                Everything You Need
                            </h2>
                            <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
                                Professional tools designed specifically for IB Economics diagrams
                            </p>
                        </div>
                    </ScrollReveal>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature, i) => (
                            <ScrollReveal key={i} delay={i * 80}>
                                <div className="group p-7 bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/70 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-100/80 transition-all duration-300 hover:-translate-y-0.5">
                                    <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                                        {feature.icon}
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                                    <p className="text-gray-500 leading-relaxed">{feature.description}</p>
                                </div>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ──────── AI FEATURE ──────── */}
            <section className="relative py-28 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <ScrollReveal direction="left">
                            <div>
                                <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-purple-100">
                                    <Bot className="w-4 h-4" />
                                    AI Assistant
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 tracking-tight">
                                    Describe It, We Draw It
                                </h2>
                                <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                                    Simply type what you want: &quot;Show the effect of a tariff on imports&quot; or
                                    &quot;Negative externality with welfare loss&quot;. Our AI understands IB Economics
                                    and creates accurate, exam-ready diagrams instantly.
                                </p>
                                <ul className="space-y-4">
                                    {[
                                        'Natural language understanding',
                                        'Auto-calculates equilibrium points',
                                        'Iterative refinement through chat',
                                        'IB-curriculum aware suggestions',
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3 text-gray-600">
                                            <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            </div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </ScrollReveal>

                        <ScrollReveal direction="right">
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-200/70 p-6">
                                <div className="space-y-4">
                                    {/* User message - RIGHT aligned */}
                                    <div className="flex justify-end">
                                        <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-br-sm text-sm max-w-[80%] shadow-sm">
                                            Show monopoly pricing with deadweight loss and consumer surplus
                                        </div>
                                    </div>
                                    {/* AI message - LEFT aligned */}
                                    <div className="flex justify-start">
                                        <div className="bg-slate-100 text-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm text-sm max-w-[80%]">
                                            Here&apos;s a monopoly diagram showing MR below D, profit-maximizing quantity
                                            where MR=MC, price on demand curve, and the resulting DWL triangle.
                                        </div>
                                    </div>
                                    {/* User message - RIGHT aligned */}
                                    <div className="flex justify-end">
                                        <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-br-sm text-sm max-w-[80%] shadow-sm">
                                            Add the ATC curve and show economic profit
                                        </div>
                                    </div>
                                    {/* AI message - LEFT aligned */}
                                    <div className="flex justify-start">
                                        <div className="bg-slate-100 text-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm text-sm max-w-[80%]">
                                            Done! I&apos;ve added the ATC curve and shaded the economic profit area between
                                            price and ATC at the profit-maximizing quantity.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollReveal>
                    </div>
                </div>
            </section>

            {/* ──────── MANUAL DRAWING FEATURE ──────── */}
            <section className="relative py-28 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <ScrollReveal direction="left" className="order-2 lg:order-1">
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-200/70 p-6">
                                <div className="flex gap-2 mb-4">
                                    {[
                                        { icon: <MousePointer2 className="w-4 h-4" />, active: false },
                                        { icon: <div className="w-4 h-0.5 bg-current" />, active: true },
                                        { icon: <Brush className="w-4 h-4" />, active: false },
                                        { icon: <PaintBucket className="w-4 h-4" />, active: false },
                                    ].map((tool, i) => (
                                        <div
                                            key={i}
                                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${tool.active
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200/50'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}
                                        >
                                            {tool.icon}
                                        </div>
                                    ))}
                                </div>
                                <div className="h-64 bg-gradient-to-br from-slate-50 to-white rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                                    <div className="text-center text-slate-400">
                                        <Brush className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <span className="text-sm font-medium">Draw directly on canvas</span>
                                    </div>
                                </div>
                            </div>
                        </ScrollReveal>
                        <ScrollReveal direction="right" className="order-1 lg:order-2">
                            <div>
                                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-emerald-100">
                                    <Brush className="w-4 h-4" />
                                    Manual Tools
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 tracking-tight">
                                    Full Creative Control
                                </h2>
                                <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                                    Use our intuitive drawing tools for full customization. Draw curves,
                                    add points, shade areas, and position labels exactly where you want them.
                                </p>
                                <ul className="space-y-4">
                                    {[
                                        'Drag entire lines, not just endpoints',
                                        'Smart snapping to grid and points',
                                        'Area fill tool for surplus and losses',
                                        'Professional SVG export',
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3 text-gray-600">
                                            <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            </div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </ScrollReveal>
                    </div>
                </div>
            </section>

            {/* ──────── IB ECONOMICS SECTION ──────── */}
            <section className="relative py-28 px-6">
                <ScrollReveal>
                    <div className="max-w-5xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full text-sm font-medium mb-8 border border-amber-100">
                            <GraduationCap className="w-4 h-4" />
                            Built for IB Students
                        </div>
                        <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
                            Ace Your IB Economics Diagrams
                        </h2>
                        <p className="text-lg text-gray-500 max-w-3xl mx-auto mb-14 leading-relaxed">
                            Whether you&apos;re preparing for Paper 1, working on your Internal Assessment,
                            or studying for exams, IB EconGraph AI helps you create the exact diagrams
                            your IB Economics course demands, from microeconomics to international trade.
                        </p>
                        <div className="grid sm:grid-cols-3 gap-6">
                            {[
                                {
                                    icon: <BarChart2 className="w-6 h-6" />,
                                    title: 'Exam-Ready Diagrams',
                                    desc: 'Create diagrams that meet IB assessment standards with proper labeling and formatting.',
                                    color: 'text-blue-600 bg-blue-100',
                                },
                                {
                                    icon: <Sparkles className="w-6 h-6" />,
                                    title: 'IA Support',
                                    desc: 'Generate professional diagrams for your Internal Assessment commentaries in seconds.',
                                    color: 'text-purple-600 bg-purple-100',
                                },
                                {
                                    icon: <GraduationCap className="w-6 h-6" />,
                                    title: 'Full IB Curriculum',
                                    desc: 'Covers all the IB Economics topics: micro, macro and international economics.',
                                    color: 'text-amber-600 bg-amber-100',
                                },
                            ].map((item, i) => (
                                <ScrollReveal key={i} delay={i * 120}>
                                    <div className="p-7 bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/70 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                                        <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mb-5 mx-auto`}>
                                            {item.icon}
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                                        <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                                    </div>
                                </ScrollReveal>
                            ))}
                        </div>
                    </div>
                </ScrollReveal>
            </section>

            {/* ──────── CTA SECTION ──────── */}
            <section className="relative py-28 px-6">
                <ScrollReveal>
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-12 md:p-16 text-white shadow-2xl shadow-blue-200/40 overflow-hidden">
                            {/* Decorative glow */}
                            <div className="absolute top-0 right-0 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.07), transparent 70%)' }} />
                            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.05), transparent 70%)' }} />

                            <div className="relative">
                                <h2 className="text-3xl md:text-5xl font-bold mb-5 tracking-tight">
                                    Ready to Create Amazing Diagrams?
                                </h2>
                                <p className="text-lg md:text-xl text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed">
                                    Join IB Economics students and educators worldwide who use IB EconGraph AI.
                                    Free, open source, and always will be.
                                </p>
                                <button
                                    onClick={onGoHome}
                                    className="group inline-flex items-center gap-2.5 bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    Get Started
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>
                </ScrollReveal>
            </section>

            {/* ──────── FOOTER ──────── */}
            <footer className="relative py-12 px-6 border-t border-slate-100/80">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-semibold text-gray-900">IB EconGraph AI</span>
                    </div>
                    <p className="text-sm text-gray-400">
                        Free & open source. Built for IB Economics students and educators.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <button
                            onClick={onOpenPricing}
                            className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
                        >
                            Pricing
                        </button>
                        <button
                            onClick={onOpenCompare}
                            className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
                        >
                            Compare
                        </button>
                        <a
                            href="/privacy"
                            className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
                        >
                            Privacy
                        </a>
                        <a
                            href="/terms"
                            className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
                        >
                            Terms
                        </a>
                        <a
                            href="https://ko-fi.com/sukarth"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-gray-400 hover:text-gray-900 text-sm transition-colors"
                        >
                            <Heart className="w-3.5 h-3.5" />
                            Support
                        </a>
                        <a
                            href="https://github.com/sukarth/IB-EconGraph-AI"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-gray-400 hover:text-gray-900 text-sm transition-colors"
                        >
                            <Github className="w-4 h-4" />
                            GitHub
                        </a>
                        <span className="text-gray-200">|</span>
                        <span className="text-sm text-gray-400">AGPL-3.0</span>
                    </div>
                </div>
            </footer>

            {/* ──────── CSS ANIMATIONS ──────── */}
            <style>{`
                @keyframes scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-scroll {
                    animation: scroll 30s linear infinite;
                }
                .animate-scroll:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </div>
    );
};

export default LandingPage;
