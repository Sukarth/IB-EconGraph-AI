import React from 'react';

const SITE = 'https://ib-econgraph-ai.vercel.app';
const REPO = 'https://github.com/sukarth/IB-EconGraph-AI';
const CONTACT_EMAIL = 'sukarth.dev@gmail.com';
const LAST_UPDATED = '19 July 2026';

/** Inline chevron used in place of a literal arrow character in nav breadcrumbs. */
const Arrow: React.FC = () => (
    <svg
        viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        className="inline-block align-[-0.05em] mx-0.5 text-gray-400" aria-hidden="true"
    >
        <path d="m9 18 6-6-6-6" />
    </svg>
);

const LegalLayout: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="min-h-screen bg-white text-gray-700">
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100">
            <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                <a href="/" className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200/50">
                        <span className="text-white font-bold text-sm">EG</span>
                    </div>
                    <span className="font-semibold text-gray-900">IB EconGraph AI</span>
                </a>
                <div className="flex items-center gap-5 text-sm">
                    <a href="/privacy" className="text-gray-500 hover:text-gray-900 transition-colors">Privacy</a>
                    <a href="/terms" className="text-gray-500 hover:text-gray-900 transition-colors">Terms</a>
                </div>
            </div>
        </nav>
        <main className="max-w-3xl mx-auto px-6 py-12">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-2">{title}</h1>
            {/* gray-500 rather than gray-400: gray-400 on white is 2.5:1, under
                WCAG AA's 4.5:1 minimum for normal-size text. */}
            <p className="text-sm text-gray-500 mb-10">Last updated: {LAST_UPDATED}</p>
            <div className="space-y-8 leading-relaxed">{children}</div>
            <footer className="mt-16 pt-8 border-t border-slate-100 text-sm text-gray-500 flex flex-wrap gap-x-6 gap-y-2">
                <a href="/" className="hover:text-gray-700">Home</a>
                <a href="/privacy" className="hover:text-gray-700">Privacy Policy</a>
                <a href="/terms" className="hover:text-gray-700">Terms of Service</a>
                <a href={REPO} className="hover:text-gray-700" target="_blank" rel="noopener noreferrer">GitHub</a>
            </footer>
        </main>
    </div>
);

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 className="text-xl font-bold text-gray-900 tracking-tight mb-3">{children}</h2>
);
const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-gray-600 mb-3">{children}</p>
);
const LI: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="text-gray-600">{children}</li>
);

export const PrivacyPage: React.FC = () => (
    <LegalLayout title="Privacy Policy">
        <section>
            <P>
                IB EconGraph AI ("the Service", "we", "us") is a free, open-source diagram editor for
                IB Economics students and teachers. This policy explains what data we handle and why.
                The Service works fully offline in your browser without an account. The data below is
                only involved if you choose to create an account or use the optional Supporter features.
            </P>
        </section>

        <section>
            <H2>What we collect</H2>
            <ul className="list-disc pl-5 space-y-1.5">
                <LI><strong>Account details.</strong> If you sign up, we store your email address and, via our
                    authentication provider, a securely hashed password. Google sign-in shares your email and
                    basic profile. You may optionally add a display name or a "supporter name".</LI>
                <LI><strong>Synced content (Supporter plan).</strong> If you turn on cloud sync, your diagrams,
                    projects, custom templates, version history and share links are stored on our servers so you
                    can access them across devices.</LI>
                <LI><strong>Hosted AI prompts (Supporter plan).</strong> When you use hosted AI generation, the
                    text prompt you submit is sent to Google's Gemini models to produce a diagram. We meter the
                    number of generations per month but do not use your prompts to train any model.</LI>
                <LI><strong>Billing data.</strong> Payments are processed by Polar as merchant of record. We never
                    receive or store your full card details. We store a Polar customer/subscription identifier and
                    your subscription status so we can grant Supporter access.</LI>
                <LI><strong>Local-only data.</strong> Diagrams you create without sync, and any AI API keys you
                    enter yourself (BYOK), stay in your browser's local storage and are <em>never</em> sent to us.</LI>
            </ul>
        </section>

        <section>
            <H2>How we use it</H2>
            <P>
                We use this data only to provide the Service: to authenticate you, sync and back up your work,
                deliver hosted AI, process your subscription, and credit supporters who opt in. We do not sell
                your data, and we do not run third-party advertising trackers.
            </P>
        </section>

        <section>
            <H2>Service providers</H2>
            <P>We rely on a small number of processors, each handling only what their function needs:</P>
            <ul className="list-disc pl-5 space-y-1.5">
                <LI><strong>Supabase</strong>: authentication and database (your account and synced content).</LI>
                <LI><strong>Polar</strong>: subscription billing and payment processing (merchant of record).</LI>
                <LI><strong>Google (Gemini models, via Vertex AI or the Gemini API)</strong>: processes hosted AI prompts to generate diagrams.</LI>
                <LI><strong>Vercel</strong>: application hosting and content delivery.</LI>
            </ul>
        </section>

        <section>
            <H2>Data retention &amp; deletion</H2>
            <P>
                We keep your account data until you delete it. You can permanently delete your account and all
                cloud-synced data at any time from <strong>Settings <Arrow />Account &amp; Cloud <Arrow />Delete account</strong>,
                which also cancels any active subscription. You can export a full copy of your data at any time
                from <strong>Settings <Arrow />Import &amp; Export</strong>. To make a request by email, contact us at
                the address below.
            </P>
        </section>

        <section>
            <H2>Your rights</H2>
            <P>
                Depending on where you live (for example under the EU/UK GDPR), you have rights to access, correct,
                export, and delete your personal data, and to object to certain processing. The in-app export and
                delete tools cover most of these directly; for anything else, email us and we'll help.
            </P>
        </section>

        <section>
            <H2>Children &amp; students</H2>
            <P>
                The Service is aimed at IB Economics students, some of whom are minors. We only collect the
                minimal account data described above. If you are below the age of digital consent in your country
                (for example under 16 in parts of the EU, or under 13 in the US), please use the Service with a
                parent's or guardian's permission, and have them create or approve any account. If you believe a
                child has given us personal data without appropriate consent, contact us and we will delete it.
            </P>
        </section>

        <section>
            <H2>Security &amp; international transfer</H2>
            <P>
                Data is transmitted over encrypted connections (HTTPS) and protected by row-level security so each
                account can only access its own records. Our providers may process data in the EU and the US;
                where required, they rely on appropriate safeguards for international transfers.
            </P>
        </section>

        <section>
            <H2>Changes &amp; contact</H2>
            <P>
                We may update this policy as the Service evolves, and we'll revise the "last updated" date above.
                Questions or requests: email <a className="text-blue-600 hover:text-blue-700" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{' '}
                or open an issue on <a className="text-blue-600 hover:text-blue-700" href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a>.
            </P>
        </section>
    </LegalLayout>
);

export const TermsPage: React.FC = () => (
    <LegalLayout title="Terms of Service">
        <section>
            <P>
                These terms govern your use of IB EconGraph AI ("the Service"). By using the Service you agree to
                them. If you don't agree, please don't use the Service.
            </P>
        </section>

        <section>
            <H2>The Service</H2>
            <P>
                IB EconGraph AI is a diagram editor for IB Economics. The core editor is free to use, and we
                intend to keep it that way: unlimited diagrams and projects, every drawing tool and template,
                full-quality exports with no watermark, and AI generation using your own API key. We won't
                retroactively paywall diagrams you've already made or your ability to export them. The optional
                <strong> Supporter plan</strong> adds hosted conveniences (hosted AI, cloud sync, version history,
                share links, synced templates).
            </P>
        </section>

        <section>
            <H2>Accounts</H2>
            <P>
                You need an account only for Supporter features. Provide accurate information, keep your password
                secure, and you're responsible for activity under your account. You can delete your account at any
                time from Settings.
            </P>
        </section>

        <section>
            <H2>Subscriptions, billing &amp; cancellation</H2>
            <ul className="list-disc pl-5 space-y-1.5">
                <LI>The Supporter plan is $5/month or $50/year, billed through Polar, our merchant of record,
                    which also handles applicable taxes (e.g. VAT).</LI>
                <LI>Subscriptions renew automatically each period until cancelled.</LI>
                <LI>You can cancel any time via <strong>Manage billing</strong> in Settings. Access continues
                    until the end of the period you've already paid for, after which it ends.</LI>
                <LI>Except where required by law (for example EU/UK withdrawal rights, handled through Polar),
                    payments are non-refundable. Deleting your account cancels the subscription.</LI>
            </ul>
        </section>

        <section>
            <H2>Hosted AI &amp; fair use</H2>
            <P>
                Hosted AI generation is included with the Supporter plan up to a monthly limit (currently 150
                generations). It's for normal, personal use in creating economics diagrams. Automated abuse,
                reselling, or attempts to extract or overuse the underlying AI service may be rate-limited or
                suspended. You can always switch to your own API key instead. Bring-your-own-key generation is
                not metered by this app, but it stays subject to your provider's own limits, usage rules and costs.
            </P>
        </section>

        <section>
            <H2>Acceptable use</H2>
            <P>
                Don't use the Service for anything unlawful, don't attempt to break its security or access other
                users' data, and don't misuse the AI features. We may suspend accounts that do.
            </P>
        </section>

        <section>
            <H2>Your content &amp; our code</H2>
            <P>
                Your diagrams and projects are yours. The application's source code is open source under the GNU
                Affero General Public License v3.0 (AGPL-3.0); see our repository for the full text. You grant us
                only the limited permission needed to store and sync your content so we can provide the Service.
            </P>
        </section>

        <section>
            <H2>Disclaimer &amp; liability</H2>
            <P>
                The Service is provided "as is", without warranties of any kind. It's an educational tool;
                AI-generated diagrams may contain mistakes, and you're responsible for checking your work. We
                don't guarantee exam accuracy or results. To the fullest extent permitted by law, we are not
                liable for indirect or consequential damages, and our total liability is limited to the amount you
                paid us in the past 12 months.
            </P>
        </section>

        <section>
            <H2>Changes, termination &amp; contact</H2>
            <P>
                We may update these terms or the Service; material changes will be reflected in the "last updated"
                date. We may suspend or end access for violations of these terms. These terms are governed by the
                laws of <strong>Finland</strong>. If you are a consumer in the EU or EEA, you also keep the
                protection of the mandatory consumer-law provisions of your country of residence. Questions:
                email <a className="text-blue-600 hover:text-blue-700" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{' '}
                or open an issue on <a className="text-blue-600 hover:text-blue-700" href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a>.
            </P>
        </section>
    </LegalLayout>
);
