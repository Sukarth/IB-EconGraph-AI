// Content for the prerendered SEO landing pages (one per diagram type).
// Rendered to static HTML by generate-seo-pages.mjs at build time.
//
// Writing guidelines: every page must be genuinely useful to an IB Economics
// student on its own (not doorway-page filler), unique, and specific to the
// diagram type. Keep claims about the product truthful: free, unlimited,
// no watermark, BYOK AI free, hosted AI on the Supporter plan.

export const SITE_URL = 'https://ib-econgraph-ai.vercel.app';

/**
 * diagram: simple declarative spec rendered as an inline SVG.
 *  lines: [x1, y1, x2, y2, color, label, dashed?] in a 0–100 coordinate space
 *         (y up); labels are placed at the line's end.
 *  points: [x, y, label]
 * All pages share axes labelled by `axes` ([x, y]).
 */
export const DIAGRAM_PAGES = [
    {
        slug: 'supply-and-demand',
        keyword: 'supply and demand diagram',
        navTitle: 'Supply & Demand',
        title: 'Supply and Demand Diagram Maker: Free, No Watermark | IB EconGraph AI',
        metaDescription:
            'Draw exam-ready supply and demand diagrams for IB Economics in seconds, free, unlimited, no watermark. Generate with AI or drag curves by hand, then export as SVG or PNG for your IA.',
        h1: 'Supply and Demand Diagram Maker',
        intro: [
            'The supply and demand diagram is the workhorse of IB Economics: almost every microeconomics answer, from market equilibrium to government intervention, starts with these two curves. Examiners expect accurately drawn, fully labelled diagrams with equilibrium price and quantity clearly marked.',
            'IB EconGraph AI lets you draw one in seconds: describe the market in plain English and let AI plot mathematically consistent curves, or drag lines onto the canvas yourself. Export at full quality with no watermark, free, forever.',
        ],
        whatItShows: {
            text: 'A standard market diagram plots price (P) on the vertical axis and quantity (Q) on the horizontal axis:',
            bullets: [
                ['Demand curve (D)', 'downward-sloping, showing the inverse relationship between price and quantity demanded (law of demand).'],
                ['Supply curve (S)', 'upward-sloping, showing that producers supply more at higher prices (law of supply).'],
                ['Equilibrium (E)', 'the intersection of D and S, determining market price P* and quantity Q*, usually marked with dotted lines to both axes.'],
                ['Shifts vs movements', 'a change in a determinant (income, costs, tastes) shifts the whole curve to D₁/S₁; a price change causes movement along a curve.'],
                ['Consumer & producer surplus', 'the triangles between the curves and the equilibrium price line, often shaded in evaluation answers.'],
            ],
        },
        howToDraw: [
            'Open the editor and pick the "Supply & Demand" template from the Component Library, or type "supply and demand equilibrium for the coffee market" in the AI panel.',
            'Label both axes (Price / Quantity) and each curve, the editor supports subscripts like D₁ using underscore notation (D_1).',
            'Mark the equilibrium with an annotated point; enable dotted lines so P* and Q* project onto both axes.',
            'To show a shift, duplicate the curve, drag it left or right, and relabel (e.g. D to D₁); add arrows or a second equilibrium point E₁.',
            'Shade consumer or producer surplus with the fill tool if your answer discusses welfare, then export as SVG or PNG.',
        ],
        iaTips: [
            'For an IA commentary, always draw the diagram specific to your article, label the actual good ("Market for lithium") rather than a generic "Good X".',
            'Use a full title and figure caption (e.g. "Figure 1: Market for lithium after the export ban"), the editor has a dedicated caption field.',
            'IB markschemes reward accurate labelling above artistic quality: axes, curves, equilibrium values, and the direction of any shift must all be explicit.',
        ],
        faq: [
            ['Is this supply and demand graph maker really free?', 'Yes. Unlimited diagrams, every drawing tool, and full-quality SVG/PNG/JPEG export with no watermark are free forever. AI generation is also free with your own Google AI Studio key.'],
            ['Can the AI draw curve shifts?', 'Yes, ask for e.g. "show demand increasing for electric cars" and it plots the original curve, the shifted curve, and both equilibria with consistent intersection coordinates.'],
            ['What export formats can I use in my IA?', 'SVG (vector, scales perfectly in documents), PNG, and JPEG. All at full quality with no watermark on the free plan.'],
        ],
        axes: ['Quantity (Q)', 'Price (P)'],
        diagram: {
            lines: [
                [10, 90, 90, 10, '#ef4444', 'D'],
                [10, 10, 90, 90, '#3b82f6', 'S'],
            ],
            points: [[50, 50, 'E']],
        },
        related: ['price-ceilings-and-floors', 'tax-incidence', 'subsidy-diagram'],
    },
    {
        slug: 'monopoly-diagram',
        keyword: 'monopoly diagram',
        navTitle: 'Monopoly',
        title: 'Monopoly Diagram Maker (MR, MC, DWL): Free IB Economics Tool',
        metaDescription:
            'Create accurate IB monopoly diagrams with MR below AR, profit maximisation at MC = MR, abnormal profit and deadweight loss, free, AI-assisted, exportable with no watermark.',
        h1: 'Monopoly Diagram Maker',
        intro: [
            'The monopoly diagram is one of the hardest in the IB course to draw correctly: marginal revenue must sit below the demand (AR) curve with twice the slope, output is read at MC = MR, but price is read up on the demand curve. Getting these relationships wrong costs marks instantly.',
            'IB EconGraph AI knows those rules. Ask for "monopoly with abnormal profit and deadweight loss" and it plots D, MR, MC and ATC with mathematically consistent intersections, or build it yourself from the monopoly template.',
        ],
        whatItShows: {
            text: 'The profit-maximising monopolist diagram contains:',
            bullets: [
                ['Demand / AR curve', 'downward-sloping, the monopolist is a price maker facing the whole market demand.'],
                ['Marginal revenue (MR)', 'below AR, falling twice as steeply; drawn dashed in most textbooks.'],
                ['Profit maximisation', 'output Qₘ where MC = MR; price Pₘ read vertically up to the demand curve.'],
                ['Abnormal profit', 'the rectangle between Pₘ and ATC at Qₘ, shade it when the question asks about profits.'],
                ['Deadweight loss', 'the welfare triangle between the demand curve, MC, and Qₘ, showing allocative inefficiency (P > MC).'],
            ],
        },
        howToDraw: [
            'Start from the "Monopoly" template in the Component Library (D, MR and MC pre-arranged), or prompt the AI with the exact scenario you need.',
            'Find MC = MR and drop an annotated point; project the dotted line down for Qₘ and up to the demand curve for Pₘ.',
            'Add the ATC curve if your answer discusses abnormal profit, and shade the profit rectangle with the fill tool.',
            'For welfare analysis, shade the DWL triangle between Qₘ and the allocatively efficient output where P = MC.',
            'Label everything, Pₘ, Qₘ, and the competitive comparison point if you\'re contrasting with perfect competition.',
        ],
        iaTips: [
            'Paper 1 part (b) questions on monopoly almost always need the DWL triangle, practice shading it cleanly.',
            'When comparing with perfect competition, add P꜀ and Q꜀ on the same diagram rather than drawing two separate ones.',
            'Natural monopoly questions need a continuously falling ATC, use the bezier curve tool to get the shape right.',
        ],
        faq: [
            ['Does the AI get MR below AR right?', 'Yes, the generator is instructed to keep MR below the demand curve with the correct slope relationship, and you can drag any curve to fine-tune it.'],
            ['Can I shade abnormal profit and DWL on the same diagram?', 'Yes. The fill tool lets you shade any polygon; use different colours (e.g. green for profit, red for DWL) from the colour palette.'],
            ['Is the export watermarked?', 'No. Full-quality SVG, PNG, and JPEG exports are free with no watermark, that is part of the free-forever guarantee.'],
        ],
        axes: ['Quantity (Q)', 'Price, Costs (P)'],
        diagram: {
            lines: [
                [10, 90, 90, 10, '#ef4444', 'D=AR'],
                [10, 90, 55, 10, '#ec4899', 'MR', true],
                [10, 15, 85, 88, '#3b82f6', 'MC'],
            ],
            points: [[35, 44, 'MC=MR'], [35, 68, 'P_m']],
        },
        related: ['perfect-competition', 'supply-and-demand', 'negative-externalities'],
    },
    {
        slug: 'negative-externalities',
        keyword: 'negative externality diagram',
        navTitle: 'Negative Externalities',
        title: 'Negative Externality Diagram Maker (MSC/MPC): Free IB Tool',
        metaDescription:
            'Draw negative production and consumption externality diagrams with MSC, MPC, welfare loss triangles and corrective taxes, free, exam-ready, no watermark. Built for IB Economics.',
        h1: 'Negative Externality Diagram Maker',
        intro: [
            'Externality diagrams dominate IB market-failure questions and real-world IA commentaries, carbon taxes, congestion charges, sugar levies. The examiner wants to see marginal social cost diverging from marginal private cost, the welfare loss triangle pointing at the socially optimal output, and any corrective policy drawn in.',
            'With IB EconGraph AI you can generate a complete negative production externality diagram from one sentence, then adjust the divergence, shade the welfare loss, and add a tax shift, all with exact, consistent intersection points.',
        ],
        whatItShows: {
            text: 'A negative production externality diagram (e.g. a polluting factory) shows:',
            bullets: [
                ['MPC curve', 'the private supply curve, costs the producer actually pays.'],
                ['MSC curve', 'above MPC; the vertical gap is the external cost imposed on third parties.'],
                ['Market equilibrium (Q₁)', 'where MPC meets demand (MPB), the free-market outcome with overproduction.'],
                ['Social optimum (Q*)', 'where MSC meets MSB, the allocatively efficient output.'],
                ['Welfare loss', 'the triangle between MSC and MPB from Q* to Q₁, showing the deadweight loss of overproduction.'],
            ],
        },
        howToDraw: [
            'Prompt the AI with e.g. "negative production externality from a coal plant with welfare loss shaded", or draw MPC first and duplicate it upward for MSC.',
            'Keep MSC parallel to MPC (a constant marginal external cost) unless your analysis argues the externality grows with output.',
            'Mark both quantities: the market output Q₁ (D = MPC) and the social optimum Q* (D = MSC), with dotted lines to the axes.',
            'Shade the welfare loss triangle between the two quantities using the fill tool.',
            'For policy evaluation, shift MPC up towards MSC to show a Pigouvian tax internalising the externality.',
        ],
        iaTips: [
            'Most IA market-failure commentaries use this exact diagram, customise the labels to your article ("MSC of plastic production") to hit the "application" criterion.',
            'Distinguish production vs consumption externalities: consumption ones diverge MPB/MSB on the demand side instead.',
            'When evaluating a tax, note on the diagram whether it fully closes the MPC–MSC gap; partial internalisation is a strong evaluation point.',
        ],
        faq: [
            ['Can it draw consumption externalities too?', 'Yes, ask for a negative consumption externality (e.g. cigarettes) and it diverges MPB below MSB instead, with the welfare loss in the right place.'],
            ['How do I show a corrective (Pigouvian) tax?', 'Duplicate the MPC curve and shift it up by the tax; the new equilibrium moves toward the social optimum. The tax-incidence template also helps here.'],
            ['Is this suitable for my IA?', 'Yes, export vector SVGs that stay sharp at any size in your commentary, with your article-specific labels and figure caption.'],
        ],
        axes: ['Quantity (Q)', 'Costs / Benefits (P)'],
        diagram: {
            lines: [
                [10, 90, 90, 10, '#ef4444', 'MPB'],
                [10, 10, 90, 90, '#3b82f6', 'MPC'],
                [10, 30, 78, 95, '#648d49', 'MSC'],
            ],
            points: [[50, 50, 'Q_1'], [40, 55, 'Q^*']],
        },
        related: ['positive-externalities', 'tax-incidence', 'subsidy-diagram'],
    },
    {
        slug: 'positive-externalities',
        keyword: 'positive externality diagram',
        navTitle: 'Positive Externalities',
        title: 'Positive Externality Diagram Maker (MSB/MPB): Free IB Tool',
        metaDescription:
            'Create positive consumption and production externality diagrams with MSB above MPB, underconsumption, welfare loss and subsidy corrections, free and exam-ready for IB Economics.',
        h1: 'Positive Externality Diagram Maker',
        intro: [
            'Vaccinations, education, public transport, positive externality diagrams appear across IB Paper 1 and endless IA articles. The logic mirrors negative externalities but flipped: marginal social benefit sits above marginal private benefit, the market underconsumes, and government subsidies push output toward the social optimum.',
            'Generate the whole diagram with AI or assemble it from templates, with the welfare loss triangle and subsidy shift drawn precisely where they belong.',
        ],
        whatItShows: {
            text: 'A positive consumption externality diagram (e.g. vaccination) shows:',
            bullets: [
                ['MPB curve', 'the market demand curve, benefits captured by the individual consumer.'],
                ['MSB curve', 'above MPB; the gap is the external benefit enjoyed by third parties (herd immunity, a more educated workforce).'],
                ['Market equilibrium (Q₁)', 'where MPB meets supply (MSC), the free market underconsumes.'],
                ['Social optimum (Q*)', 'where MSB meets MSC, at a higher quantity than the market delivers.'],
                ['Welfare loss', 'the triangle between MSB and MSC from Q₁ to Q*, representing the forgone net benefit.'],
            ],
        },
        howToDraw: [
            'Ask the AI for "positive consumption externality of vaccines with welfare loss" or start with a supply-and-demand template and add a second, higher demand curve labelled MSB.',
            'Mark Q₁ at MPB = MSC and Q* at MSB = MSC with dotted projection lines.',
            'Shade the welfare-loss triangle between the two quantities.',
            'To show a subsidy, shift the supply curve down (or MPB up for demand-side policies like advertising) and mark the new equilibrium.',
            'Add a caption tying the diagram to the specific merit good you\'re analysing.',
        ],
        iaTips: [
            'State explicitly on the diagram which curves diverge, the IB rewards "MSB > MPB at every quantity" style annotations.',
            'Pair the diagram with the subsidy diagram when your article covers government support for merit goods.',
            'Evaluation gold: does the subsidy close the whole MPB–MSB gap? Draw a partial shift and discuss.',
        ],
        faq: [
            ['What is the difference between production and consumption positive externalities?', 'Production ones (e.g. R&D spillovers) diverge the cost curves (MSC below MPC); consumption ones (e.g. education) diverge the benefit curves (MSB above MPB). The AI handles both if you name the case.'],
            ['Can I show government subsidies on the same diagram?', 'Yes, duplicate and shift the supply curve downward by the subsidy, then mark the new quantity against Q*.'],
            ['Do I need an account?', 'No. The editor, templates, AI with your own key, and full-quality exports all work without signing in.'],
        ],
        axes: ['Quantity (Q)', 'Costs / Benefits (P)'],
        diagram: {
            lines: [
                [10, 80, 85, 10, '#ef4444', 'MPB'],
                [18, 95, 90, 22, '#648d49', 'MSB'],
                [10, 10, 90, 90, '#3b82f6', 'MSC'],
            ],
            points: [[45, 45, 'Q_1'], [56, 56, 'Q^*']],
        },
        related: ['negative-externalities', 'subsidy-diagram', 'supply-and-demand'],
    },
    {
        slug: 'price-ceilings-and-floors',
        keyword: 'price ceiling and price floor diagram',
        navTitle: 'Price Controls',
        title: 'Price Ceiling & Price Floor Diagram Maker: Free IB Tool',
        metaDescription:
            'Draw price ceiling (maximum price) and price floor (minimum price) diagrams with shortages, surpluses and welfare effects, free, unlimited, watermark-free. Made for IB Economics.',
        h1: 'Price Ceiling & Price Floor Diagram Maker',
        intro: [
            'Rent controls, food price caps, minimum wages, agricultural price supports, price control diagrams turn up in every IB paper and countless IA commentaries. The key skill is placing the controlled price on the correct side of equilibrium and reading off the resulting shortage or surplus.',
            'IB EconGraph AI draws the control line, marks Qd and Qs at the controlled price, and labels the shortage or surplus gap for you, or gives you a clean canvas to construct it manually.',
        ],
        whatItShows: {
            text: 'Price control diagrams start from ordinary supply and demand, then add a horizontal price line:',
            bullets: [
                ['Price ceiling (maximum price)', 'set below equilibrium, e.g. rent control. Quantity demanded exceeds quantity supplied, creating a shortage (excess demand).'],
                ['Price floor (minimum price)', 'set above equilibrium, e.g. minimum wage, farm supports. Quantity supplied exceeds quantity demanded, creating a surplus (excess supply).'],
                ['Qd and Qs', 'read where the control line crosses each curve; the horizontal gap between them is the shortage/surplus, label it explicitly.'],
                ['Welfare effects', 'shade the deadweight loss and the transfers between consumers and producers for evaluation answers.'],
            ],
        },
        howToDraw: [
            'Generate "price ceiling below equilibrium in the rental market showing the shortage" with AI, or add a horizontal line to the supply-and-demand template.',
            'Place the ceiling below (floor above) the equilibrium, the most common student error is putting it on the wrong side, where it has no effect.',
            'Drop annotated points where the price line crosses D and S; label Qd and Qs on the axis.',
            'Draw a labelled bracket or arrow for the shortage/surplus gap using the line and text tools.',
            'Shade the DWL triangle if the question asks about welfare or efficiency.',
        ],
        iaTips: [
            'A non-binding control (ceiling above equilibrium) is a legitimate evaluation point, you can draw both cases side by side in one project.',
            'For minimum wage articles, relabel the axes (Wage rate / Quantity of labour), double-click any label to edit it.',
            'Discussing black markets? Mark the price consumers would pay for the restricted quantity Qs up on the demand curve.',
        ],
        faq: [
            ['Which side of equilibrium does a price ceiling go?', 'A binding price ceiling sits below equilibrium (it caps the price), creating a shortage. A binding floor sits above, creating a surplus. The AI places them correctly from your description.'],
            ['Can I show both a ceiling and a floor?', 'Yes, projects let you keep multiple related graphs together, or you can place both lines on one canvas for a comparison diagram.'],
            ['Can I label the shortage gap?', 'Yes, use the text label tool for "shortage = Qd − Qs" and the line tool for the bracket arrows.'],
        ],
        axes: ['Quantity (Q)', 'Price (P)'],
        diagram: {
            lines: [
                [10, 90, 90, 10, '#ef4444', 'D'],
                [10, 10, 90, 90, '#3b82f6', 'S'],
                [10, 35, 90, 35, '#f59e0b', 'P_max'],
            ],
            points: [[35, 35, 'Q_s'], [65, 35, 'Q_d']],
        },
        related: ['supply-and-demand', 'tax-incidence', 'subsidy-diagram'],
    },
    {
        slug: 'tariff-diagram',
        keyword: 'tariff diagram',
        navTitle: 'Tariffs & Quotas',
        title: 'Tariff Diagram Maker (World Price, Welfare Loss): Free IB Tool',
        metaDescription:
            'Draw IB international trade tariff diagrams with world supply, domestic supply, tariff revenue and the two deadweight loss triangles, free, precise, watermark-free exports.',
        h1: 'Tariff Diagram Maker',
        intro: [
            'The tariff diagram is the most detail-dense diagram in the IB course: domestic supply and demand, a horizontal world supply line, a raised world-supply-plus-tariff line, and up to six labelled quantities with revenue rectangles and two welfare-loss triangles. Drawing it by hand under time pressure is brutal.',
            'IB EconGraph AI generates the full structure with consistent geometry, and the shading tools make the revenue rectangle and DWL triangles quick to add and easy to distinguish.',
        ],
        whatItShows: {
            text: 'The small-country tariff diagram shows:',
            bullets: [
                ['Domestic S and D', 'the home market curves determining the autarky equilibrium.'],
                ['World supply (Sw)', 'a horizontal line at the world price Pw, the country imports the gap between Qd and Qs at that price.'],
                ['Sw + tariff', 'a parallel horizontal line at Pw + t; imports shrink as domestic output expands and consumption contracts.'],
                ['Government revenue', 'the rectangle: tariff × post-tariff import quantity.'],
                ['Welfare losses', 'two triangles, the production inefficiency (higher-cost domestic output) and the consumption loss (forgone consumer surplus).'],
            ],
        },
        howToDraw: [
            'Prompt: "tariff diagram for a small country importing steel, show government revenue and both deadweight loss triangles".',
            'Check the four quantities on the x-axis (Qs, Qs\', Qd\', Qd) are in the right order and labelled.',
            'Shade the revenue rectangle between the two horizontal lines and the post-tariff import quantities.',
            'Shade the two DWL triangles either side of the revenue rectangle in a different colour.',
            'Add a caption naming the good and the tariff, and export as SVG for your document.',
        ],
        iaTips: [
            'Trade-war and protectionism articles are IA staples, this diagram plus a stakeholder analysis (consumers, producers, government, foreign exporters) is a complete commentary skeleton.',
            'A quota uses the same structure but with no revenue rectangle for the government (the quota rent may go to foreign producers), a strong evaluation contrast.',
            'Keep colours consistent: one colour for welfare losses, another for revenue, so the examiner can read it at a glance.',
        ],
        faq: [
            ['Does it handle quota diagrams too?', 'Yes, describe a quota and the AI draws the restricted-imports structure; or adapt the tariff diagram manually by replacing the tariff line.'],
            ['Can I label all six quantities?', 'Yes, annotated points project dotted lines onto the axes, and every label supports subscripts (Q_1, Q_2 …).'],
            ['Why are there two deadweight loss triangles?', 'One is the production inefficiency (domestic firms produce units that the world could supply more cheaply); the other is lost consumer surplus from reduced consumption. The page diagram shows both positions.'],
        ],
        axes: ['Quantity (Q)', 'Price (P)'],
        diagram: {
            lines: [
                [10, 90, 90, 10, '#ef4444', 'D'],
                [10, 10, 90, 90, '#3b82f6', 'S'],
                [10, 30, 90, 30, '#64748b', 'S_w'],
                [10, 45, 90, 45, '#f59e0b', 'S_w+t'],
            ],
            points: [],
        },
        related: ['exchange-rate-diagram', 'supply-and-demand', 'tax-incidence'],
    },
    {
        slug: 'ad-as-diagram',
        keyword: 'AD-AS diagram',
        navTitle: 'AD–AS Model',
        title: 'AD-AS Diagram Maker (Keynesian & Monetarist): Free IB Tool',
        metaDescription:
            'Draw AD-AS diagrams for IB macro, monetarist/new-classical LRAS, Keynesian AS, demand-side and supply-side shocks, output gaps, free with watermark-free exports.',
        h1: 'AD–AS Diagram Maker',
        intro: [
            'Aggregate demand–aggregate supply diagrams carry the whole IB macroeconomics syllabus: inflation, unemployment, growth, and every fiscal or monetary policy question. You need both versions, the monetarist/new-classical model with a vertical LRAS, and the Keynesian AS curve with its flat, curved, and vertical sections.',
            'IB EconGraph AI draws both. The bezier curve tool produces a clean Keynesian AS shape that\'s notoriously hard to sketch by hand, and the AI understands prompts like "deflationary gap in the Keynesian model".',
        ],
        whatItShows: {
            text: 'The AD–AS framework plots average price level against real GDP:',
            bullets: [
                ['AD curve', 'downward-sloping: C + I + G + (X − M) at each price level.'],
                ['SRAS', 'upward-sloping short-run aggregate supply based on sticky input costs.'],
                ['LRAS (monetarist)', 'vertical at potential output Yp, output returns there in the long run.'],
                ['Keynesian AS', 'flat at low output (spare capacity), curving upward, vertical at full capacity, equilibria below Yp can persist.'],
                ['Output gaps', 'deflationary (recessionary) gaps left of Yp; inflationary gaps to the right.'],
            ],
        },
        howToDraw: [
            'Tell the AI which school you need: "monetarist AD-AS with a short-run inflationary gap" vs "Keynesian AS with equilibrium below full employment".',
            'For the Keynesian curve, use a bezier curve: start flat, add a control point to bend it up into the vertical section.',
            'Mark Yp with a vertical dashed line and label the gap between Y₁ and Yp explicitly.',
            'Show policy responses by shifting AD (fiscal/monetary) or SRAS/LRAS (supply-side) and adding the new equilibrium.',
            'Relabel axes as "Average price level" and "Real GDP (Y)", double-click any label to edit.',
        ],
        iaTips: [
            'Macro IA commentaries score well when the diagram shows the specific gap from your article (e.g. "Japan\'s deflationary gap") rather than a generic model.',
            'Paper 1: choose the model that matches your argument, using the Keynesian AS to discuss persistent unemployment is a classic top-band move.',
            'Always label the price level change (PL₁ to PL₂) as well as output, half the marks are on the vertical axis.',
        ],
        faq: [
            ['Can it draw the Keynesian AS curve shape?', 'Yes, the AI produces the three-section shape with a bezier curve, and you can drag the control points to adjust the curvature precisely.'],
            ['How do I show stagflation?', 'Shift SRAS left: the new equilibrium has a higher price level and lower real output. Prompt the AI with "stagflation from an oil price shock".'],
            ['Does it work for exchange-rate or Phillips-curve style axes?', 'Axes and labels are fully editable, so any two-axis macro diagram is drawable manually even when there is no dedicated template.'],
        ],
        axes: ['Real GDP (Y)', 'Price level'],
        diagram: {
            lines: [
                [10, 80, 80, 15, '#ef4444', 'AD'],
                [15, 12, 88, 85, '#3b82f6', 'SRAS'],
                [65, 5, 65, 95, '#64748b', 'LRAS'],
            ],
            points: [[52, 43, 'Y_1']],
        },
        related: ['exchange-rate-diagram', 'ppc-diagram', 'supply-and-demand'],
    },
    {
        slug: 'perfect-competition',
        keyword: 'perfect competition diagram',
        navTitle: 'Perfect Competition',
        title: 'Perfect Competition Diagrams (Firm & Industry): Free IB Tool',
        metaDescription:
            'Draw side-by-side industry and firm diagrams for perfect competition, short-run profit/loss and long-run equilibrium at minimum ATC, free IB Economics diagram maker, no watermark.',
        h1: 'Perfect Competition Diagram Maker',
        intro: [
            'Perfect competition answers usually need two linked diagrams: the industry (market supply and demand setting price) and the individual firm (a horizontal P = AR = MR line against MC and ATC). Keeping the price line at exactly the same height across both panels is what examiners look for first.',
            'With IB EconGraph AI you can generate each panel and keep them in one project, using the horizontal-line template for the firm\'s demand curve and precise point snapping for the tangency conditions.',
        ],
        whatItShows: {
            text: 'The two-panel perfect competition model shows:',
            bullets: [
                ['Industry panel', 'market S and D determine the equilibrium price P*.'],
                ['Firm panel', 'the firm takes P* as given, a horizontal line labelled P = AR = MR.'],
                ['Profit maximisation', 'output where MC cuts MR from below.'],
                ['Short-run abnormal profit/loss', 'the rectangle between price and ATC at the chosen output.'],
                ['Long-run equilibrium', 'entry/exit shifts industry supply until P = minimum ATC and firms earn normal profit only.'],
            ],
        },
        howToDraw: [
            'Create one graph for the industry (supply & demand template) and one for the firm within the same project.',
            'In the firm panel, add a horizontal "Price Line" from the Component Library and label it P = AR = MR at the industry price.',
            'Add MC and ATC bezier curves; profit-maximising output is where MC crosses the price line.',
            'Shade the profit or loss rectangle between the price line and ATC.',
            'For the long run, drag ATC until its minimum is tangent to the price line, snapping makes the tangency exact.',
        ],
        iaTips: [
            'Draw the two panels with identical vertical scales so the shared price line reads clearly.',
            'Short-run loss diagrams (P below ATC but above AVC) are a common discriminator question, keep an AVC curve handy in a saved template.',
            'In "evaluate whether perfect competition is efficient" essays, mark both allocative (P = MC) and productive (min ATC) efficiency points on the firm diagram.',
        ],
        faq: [
            ['Can I draw the firm and industry side by side?', 'Each graph is one canvas, but projects keep the two panels together, and consistent export sizes make them easy to place side by side in a document.'],
            ['How do I make ATC tangent to the price line?', 'Use point snapping, drag the ATC minimum onto the price line and the editor snaps the tangency point precisely.'],
            ['Does the AI know P = AR = MR?', 'Yes, asking for "perfectly competitive firm in long-run equilibrium" produces the horizontal price line tangent to minimum ATC.'],
        ],
        axes: ['Quantity (Q)', 'Price, Costs (P)'],
        diagram: {
            lines: [
                [10, 55, 90, 55, '#f59e0b', 'P=AR=MR'],
            ],
            curves: [
                [10, 60, 40, 15, 90, 90, '#22c55e', 'MC'],
                [10, 85, 50, 40, 90, 80, '#8b5cf6', 'ATC'],
            ],
            points: [[62, 55, 'Q^*']],
        },
        related: ['monopoly-diagram', 'supply-and-demand', 'ppc-diagram'],
    },
    {
        slug: 'ppc-diagram',
        keyword: 'PPC diagram',
        navTitle: 'PPC / PPF',
        title: 'PPC Diagram Maker (Production Possibilities Curve): Free IB Tool',
        metaDescription:
            'Draw production possibilities curves for IB Economics, opportunity cost, scarcity, actual vs potential growth, efficiency points, free PPC/PPF diagram maker with clean exports.',
        h1: 'PPC / PPF Diagram Maker',
        intro: [
            'The production possibilities curve is the first diagram in the IB course and a favourite for short Paper 1 questions: scarcity, choice, opportunity cost, and the difference between actual and potential growth all live on this one curve.',
            'IB EconGraph AI\'s bezier tool draws the classic concave-to-origin bow shape smoothly, with labelled points inside, on, and outside the frontier, plus shifted curves for economic growth.',
        ],
        whatItShows: {
            text: 'The PPC plots the maximum combinations of two goods an economy can produce:',
            bullets: [
                ['The frontier', 'concave to the origin because resources are not equally suited to both goods (increasing opportunity cost).'],
                ['Points on the curve', 'productive efficiency, all resources fully employed.'],
                ['Points inside', 'unemployment or inefficiency (e.g. a recession).'],
                ['Points outside', 'currently unattainable, reachable only through growth.'],
                ['Outward shifts', 'potential growth from more/better resources or technology; movements from inside toward the curve are actual growth.'],
            ],
        },
        howToDraw: [
            'Draw a bezier curve from the y-axis to the x-axis and drag the control point outward for the concave bow shape.',
            'Label the axes with your two goods (e.g. "Capital goods" and "Consumer goods").',
            'Add annotated points: A and B on the curve, C inside (unemployment), D outside (unattainable).',
            'For growth questions, duplicate the curve and drag it outward, label PPC₁ and PPC₂.',
            'A straight-line PPC (constant opportunity cost) is just the line tool, useful for comparative advantage questions.',
        ],
        iaTips: [
            'Use arrows between labelled points to show the story: C to A is actual growth, curve shift is potential growth.',
            'For opportunity cost questions, mark the movement along the curve and annotate how much of one good is given up.',
            'Asymmetric shifts (pivot on one axis) show growth biased toward one sector, a subtle detail that impresses examiners.',
        ],
        faq: [
            ['Can I draw both straight and curved PPCs?', 'Yes, the line tool gives constant opportunity cost, the bezier tool gives the standard concave frontier.'],
            ['How do I show economic growth?', 'Duplicate the curve and drag it outward (or ask the AI for "PPC with outward shift showing potential growth").'],
            ['Is this free for classroom use?', 'Completely, teachers and students can use everything without accounts or licences, and the project is MIT open source.'],
        ],
        axes: ['Consumer goods', 'Capital goods'],
        diagram: {
            curves: [
                [10, 85, 60, 75, 85, 10, '#3b82f6', 'PPC'],
            ],
            points: [[45, 68, 'A'], [30, 40, 'B']],
        },
        related: ['ad-as-diagram', 'supply-and-demand', 'perfect-competition'],
    },
    {
        slug: 'tax-incidence',
        keyword: 'tax incidence diagram',
        navTitle: 'Indirect Taxes',
        title: 'Indirect Tax & Tax Incidence Diagram Maker: Free IB Tool',
        metaDescription:
            'Draw specific and ad valorem tax diagrams with consumer/producer incidence, government revenue and deadweight loss, free IB Economics tool with exact intersections and clean exports.',
        h1: 'Indirect Tax & Tax Incidence Diagram Maker',
        intro: [
            'Indirect tax diagrams demand precision: the supply curve shifts up by exactly the tax, the new equilibrium splits the burden between consumers and producers, and the revenue rectangle plus DWL triangle must sit in exactly the right cells. Elasticity determines who pays more, the analytical heart of the question.',
            'IB EconGraph AI keeps the geometry consistent (the vertical gap between S and S+tax stays equal to the tax) and the shading tools make incidence areas unambiguous.',
        ],
        whatItShows: {
            text: 'A specific (per-unit) tax diagram shows:',
            bullets: [
                ['S and S + tax', 'the supply curve shifts vertically upward by the tax per unit (parallel for a specific tax, diverging for ad valorem).'],
                ['New equilibrium', 'higher consumer price Pc, lower quantity Qt; producers receive Pp = Pc − tax.'],
                ['Consumer incidence', 'the rectangle between the original price P* and Pc across Qt.'],
                ['Producer incidence', 'the rectangle between P* and Pp across Qt.'],
                ['Government revenue and DWL', 'revenue = tax × Qt (both incidence rectangles combined); the welfare-loss triangle sits between Qt and Q*.'],
            ],
        },
        howToDraw: [
            'Use the "Tax Incidence" template, or prompt: "specific tax on cigarettes showing incidence on consumers and producers".',
            'Verify the vertical distance between S and S+tax equals the tax everywhere, drag with snapping if you adjust manually.',
            'Mark P*, Pc, and Pp with dotted lines; label Qt and Q* on the quantity axis.',
            'Shade consumer incidence and producer incidence in different colours, then the DWL triangle.',
            'For elasticity analysis, flatten or steepen the demand curve and watch the incidence split change, great for screenshots of both cases.',
        ],
        iaTips: [
            'Sugar taxes, fuel duties, and tobacco excises are perennial IA topics, this diagram plus elasticity commentary is the expected core.',
            'PED vs PES rule: the more inelastic side bears more of the tax. Draw two versions to demonstrate it rather than just asserting it.',
            'Ad valorem taxes pivot the supply curve rather than shifting it in parallel, mention and draw the difference for top-band analysis.',
        ],
        faq: [
            ['Can it draw ad valorem taxes?', 'Yes, ask for an ad valorem (percentage) tax and the shifted supply curve diverges from the original instead of staying parallel.'],
            ['How is a subsidy different?', 'A subsidy shifts supply down by the subsidy per unit, see the dedicated subsidy diagram page for the mirrored analysis.'],
            ['Can I show government revenue?', 'Yes, shade the rectangle (tax × new quantity) with the fill tool; split it into the consumer and producer portions with two colours.'],
        ],
        axes: ['Quantity (Q)', 'Price (P)'],
        diagram: {
            lines: [
                [10, 90, 90, 10, '#ef4444', 'D'],
                [10, 10, 90, 90, '#3b82f6', 'S'],
                [10, 30, 70, 90, '#3b82f6', 'S+tax', true],
            ],
            points: [[50, 50, 'E'], [40, 60, 'E_1']],
        },
        related: ['subsidy-diagram', 'negative-externalities', 'price-ceilings-and-floors'],
    },
    {
        slug: 'subsidy-diagram',
        keyword: 'subsidy diagram',
        navTitle: 'Subsidies',
        title: 'Subsidy Diagram Maker (IB Economics): Free, No Watermark',
        metaDescription:
            'Draw subsidy diagrams with the supply shift, price fall, government cost rectangle and welfare analysis, free IB Economics diagram generator with AI assistance.',
        h1: 'Subsidy Diagram Maker',
        intro: [
            'Subsidy diagrams mirror tax diagrams: supply shifts down by the per-unit subsidy, consumers pay less, producers receive more, and the government cost rectangle spans the entire subsidy times the new quantity. IB questions love asking who gains more, and the answer again comes down to relative elasticities.',
            'Generate the complete diagram from a one-line prompt, or shift a duplicated supply curve down with drag-and-snap precision.',
        ],
        whatItShows: {
            text: 'A per-unit subsidy diagram shows:',
            bullets: [
                ['S and S − subsidy', 'the supply curve shifts vertically down by the subsidy per unit.'],
                ['New equilibrium', 'quantity rises to Qs; consumers pay the lower Pc while producers receive Pp = Pc + subsidy.'],
                ['Government cost', 'the rectangle subsidy × Qs, usually the largest area on the diagram.'],
                ['Consumer and producer gains', 'split of the subsidy benefit determined by relative elasticities.'],
                ['Welfare loss', 'the small triangle beyond Q* where the marginal cost of extra output exceeds its marginal benefit.'],
            ],
        },
        howToDraw: [
            'Prompt the AI with "subsidy for solar panels showing government cost and the price received by producers".',
            'Keep the vertical gap between the two supply curves constant, it equals the subsidy per unit.',
            'Mark three prices: original P*, consumer price Pc, and producer price Pp, all with dotted lines.',
            'Shade the government cost rectangle between Pc and Pp across the new quantity Qs.',
            'For welfare evaluation, shade the DWL triangle to the right of the original equilibrium.',
        ],
        iaTips: [
            'Renewable energy and agricultural subsidy articles are IA classics, pair this diagram with an opportunity-cost evaluation of the government spending.',
            'Show explicitly that Pp − Pc equals the subsidy, annotating that vertical distance earns analysis marks.',
            'For merit goods, combine with the positive externality diagram: the subsidy is the policy that closes the MPB–MSB gap.',
        ],
        faq: [
            ['Which direction does supply shift for a subsidy?', 'Down (right) by the subsidy per unit, production is cheaper at every output level. The AI handles the geometry automatically.'],
            ['How do I show who benefits more?', 'Compare the consumer gain (P* − Pc) with the producer gain (Pp − P*): the more inelastic side captures more. Draw steep vs flat demand versions to demonstrate.'],
            ['Can I export this for my IA at high quality?', 'Yes, SVG, PNG, and JPEG exports are full quality and watermark-free, free forever.'],
        ],
        axes: ['Quantity (Q)', 'Price (P)'],
        diagram: {
            lines: [
                [10, 90, 90, 10, '#ef4444', 'D'],
                [10, 25, 90, 95, '#3b82f6', 'S'],
                [18, 10, 90, 72, '#22c55e', 'S-sub', true],
            ],
            points: [[47, 55, 'E'], [58, 46, 'E_1']],
        },
        related: ['tax-incidence', 'positive-externalities', 'price-ceilings-and-floors'],
    },
    {
        slug: 'exchange-rate-diagram',
        keyword: 'exchange rate diagram',
        navTitle: 'Exchange Rates',
        title: 'Exchange Rate Diagram Maker (Currency S&D): Free IB Tool',
        metaDescription:
            'Draw floating exchange rate diagrams, currency supply and demand, appreciation and depreciation shifts, central bank intervention, free IB Economics diagram maker.',
        h1: 'Exchange Rate Diagram Maker',
        intro: [
            'Exchange rate diagrams apply supply and demand to a currency market: the price axis becomes the exchange rate (e.g. USD per EUR) and the quantity axis the quantity of currency traded. Appreciations and depreciations are just demand and supply shifts, but mislabelling the axes is the classic way to lose easy marks.',
            'IB EconGraph AI relabels everything for a currency market from a single prompt and shifts the right curve for your scenario, whether it\'s rising interest rates, import demand, or central bank intervention.',
        ],
        whatItShows: {
            text: 'A floating exchange rate diagram for, say, the euro shows:',
            bullets: [
                ['Demand for EUR', 'from foreigners buying eurozone exports, assets, or travelling there, downward-sloping against the exchange rate.'],
                ['Supply of EUR', 'from eurozone residents buying imports or investing abroad, upward-sloping.'],
                ['Equilibrium exchange rate', 'where the curves cross, e.g. 1.10 USD/EUR.'],
                ['Appreciation', 'demand shifts right (or supply left) to higher exchange rate.'],
                ['Depreciation', 'demand shifts left (or supply right) to lower exchange rate.'],
            ],
        },
        howToDraw: [
            'Prompt: "market for the British pound after an interest rate rise, showing appreciation", the AI labels axes as $ per £ automatically.',
            'Or start from the supply-and-demand template and double-click the axis labels to change them to "Exchange rate (USD/EUR)" and "Quantity of EUR".',
            'Shift the appropriate curve and mark both equilibria (e₁ to e₂) with dotted lines.',
            'Add an arrow annotation showing the appreciation/depreciation direction.',
            'For managed rates, add a horizontal intervention line and discuss reserves in your commentary.',
        ],
        iaTips: [
            'Currency articles pair this diagram with the AD-AS model (a depreciation boosting net exports shifts AD right), keep both graphs in one project.',
            'Always state the exchange rate as a ratio in the axis label (USD per EUR), ambiguous labels are penalised.',
            'Central bank intervention articles: draw the rate the bank defends and the excess demand/supply it must absorb, similar to a price control.',
        ],
        faq: [
            ['Which curve shifts when interest rates rise?', 'Higher domestic interest rates attract foreign capital: demand for the currency shifts right (and supply may shift left as residents keep funds at home), an appreciation. Describe the scenario and the AI shifts the correct curve.'],
            ['Can I draw a fixed exchange rate?', 'Yes, add a horizontal line at the pegged rate, like a price control, and mark the intervention gap.'],
            ['Does this work for any currency pair?', 'Yes, all labels are editable, so any base/quote pair works.'],
        ],
        axes: ['Quantity of EUR', 'Exchange rate (USD/EUR)'],
        diagram: {
            lines: [
                [10, 90, 90, 10, '#ef4444', 'D_{EUR}'],
                [10, 10, 90, 90, '#3b82f6', 'S_{EUR}'],
                [25, 95, 90, 30, '#f97316', 'D_1', true],
            ],
            points: [[50, 50, 'e_1'], [60, 60, 'e_2']],
        },
        related: ['ad-as-diagram', 'tariff-diagram', 'supply-and-demand'],
    },
];
