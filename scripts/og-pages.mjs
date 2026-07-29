/**
 * Which social preview cards exist, and what goes on each.
 *
 * One list, used by both the preview sheet and whatever writes the final
 * images, so what gets approved is what ships. `name` is the file stem and
 * `paths` are the routes whose HTML should point at it.
 */

import { DIAGRAM_PAGES } from './seo-content.mjs';
import { renderDiagramSvg } from './diagram-svg.mjs';

const BADGES = ['Free forever', 'No watermark', 'No account needed'];

const byslug = (slug) => {
    const page = DIAGRAM_PAGES.find((p) => p.slug === slug);
    // Say which slug is wrong, rather than failing later on an undefined page.
    if (!page) throw new Error(`og-pages: no diagram page with slug "${slug}"`);
    return page;
};

export const OG_CARDS = [
    {
        name: 'og-default',
        // Also the fallback for any page without one of its own, which is why
        // it carries no page-specific wording.
        paths: ['/', '/privacy', '/terms'],
        spec: {
            eyebrow: 'Free IB Economics tool',
            title: 'Every IB Economics diagram, drawable in seconds',
            subtitle: 'Generate with AI or draw by hand, then export at full quality.',
            badges: BADGES,
            diagramSvg: renderDiagramSvg(byslug('supply-and-demand')),
        },
    },
    {
        name: 'og-diagrams',
        paths: ['/diagrams'],
        spec: {
            eyebrow: '12 diagram guides',
            title: 'Every diagram in the syllabus, one guide each',
            subtitle: 'Micro, macro and international trade, with the marks examiners look for.',
            badges: BADGES,
            diagramSvg: renderDiagramSvg(byslug('ad-as-diagram')),
        },
    },
    {
        name: 'og-pricing',
        paths: ['/pricing'],
        spec: {
            eyebrow: 'Pricing',
            title: 'Free forever. Supporter is $5/mo.',
            subtitle: 'Everything you need for your IA stays free, unlimited and watermark-free.',
            badges: ['Unlimited diagrams', 'All exports', 'Bring your own AI key'],
        },
    },
    {
        name: 'og-compare',
        paths: ['/compare'],
        spec: {
            eyebrow: 'Comparison',
            title: 'How IB EconGraph AI compares',
            subtitle: 'Against the other IB Economics diagram tools, fact-checked and dated.',
            badges: ['Free export', 'AI generation', 'Open source'],
        },
    },
    ...DIAGRAM_PAGES.map((page) => ({
        name: `og-${page.slug}`,
        paths: [`/diagrams/${page.slug}`],
        spec: {
            eyebrow: 'IB Economics diagram',
            title: page.h1,
            subtitle: 'Draw it in seconds, label it properly, export with no watermark.',
            badges: BADGES,
            diagramSvg: renderDiagramSvg(page),
        },
    })),
];
