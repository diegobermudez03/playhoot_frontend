# Engineering Radar

Status: NON-AUTHORITATIVE TECHNICAL RADAR

This is the canonical location for the Playhoot frontend's current engineering recommendations and future concerns, but the content is NON-AUTHORITATIVE.

A radar item is:

- an AI recommendation or concern;
- not an accepted decision;
- not an engineering standard;
- not architecture;
- not a roadmap commitment;
- not an approved WORK specification;
- not implementation authority.

NOW != READY

A NOW radar item does not authorize a Codebase Agent to implement anything.

## Authority Boundaries

If a radar recommendation later produces an accepted product decision, architecture/domain decision, or engineering standard, the accepted fact must live in its canonical owner.

The Radar must not become a duplicate source of accepted truth. After such a decision, remove the radar item if the concern has been fully resolved at the recommendation level, or update it to describe only the meaningful remaining concern.

A radar item must never directly authorize implementation. If a recommendation reaches the point where concrete implementation is approved, use `FEATURE_DEVELOPMENT` and the WORK specification system.

The Radar is not:

- a product backlog;
- an engineering task tracker;
- a sprint board;
- a product roadmap;
- a list of all future features;
- a list of all technical debt.

Only persist concerns or recommendations whose continued visibility is useful at the Principal Engineer level.

## Horizons

The horizon is primarily an action/attention recommendation.

It is not:

- a WORK status;
- a decision status;
- a formal incident severity;
- an implementation priority automatically accepted by the human.

Impact or risk can be explained inside an item when useful. Do not introduce a separate mandatory severity system here.

## NOW

The concern/opportunity exists under current conditions and deserves active follow-up now or alongside near-term work.

NOW does not itself mean:

- implementation is approved;
- an incident exists;
- architecture has been decided.

No items have yet been persisted under the Engineering Radar mechanism.

## SOON

The concern does not need immediate action but is likely worth addressing before a meaningful near-term milestone or before continued development makes it materially more expensive/risky.

No items have yet been persisted under the Engineering Radar mechanism.

## LATER

The concern is legitimate, but current conditions do not justify acting on it.

A LATER item should have a meaningful reevaluation trigger where possible.

No items have yet been persisted under the Engineering Radar mechanism.

## NOT NEEDED

The concern/technology/sophistication has been considered and is not justified under current conditions.

NOT NEEDED is not a permanent universal rejection. Include a reevaluation trigger where future conditions could change the assessment.

Persist NOT NEEDED items selectively. Do not fill the radar with every technology Playhoot could theoretically use.

A NOT NEEDED item is most useful when:

- the idea is likely to recur;
- recording why it is unnecessary helps prevent repeated architecture-astronautics;
- a future trigger for reconsideration is meaningful.

NOT NEEDED means "currently not justified", not "completed."

No items have yet been persisted under the Engineering Radar mechanism.
