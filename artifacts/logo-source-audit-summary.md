# Logo source audit summary

Generated on 2026-08-20 from the 20,524-listing HUDI catalog.

## Audit result

TradingView returned an exact exchange+ticker logo for 18,924 listings
(92.20%). The visual comparison against the catalog renderer assets produced:

| Result | Listings |
| --- | ---: |
| Same TradingView source | 4,368 |
| Likely visual match | 7,516 |
| Human review candidate | 7,039 |
| No TradingView logo | 1,600 |
| Unreadable current asset | 1 |

The review threshold is advisory. A low score means that the shapes differ; it
does not automatically establish that either provider is correct. Alternate
official lockups, emblems cropped from wordmarks, and share-class marks can all
produce legitimate differences.

The review queue has 187 very-low-similarity results below 0.10, 2,227 results
from 0.10 to 0.25, and 4,625 results from 0.25 to 0.48. Review the lowest band
first.

## Exchange coverage

| Exchange | Listings | TradingView resolved | Review candidates |
| --- | ---: | ---: | ---: |
| HKEX | 2,773 | 2,702 | 1,037 |
| KRX | 1,774 | 1,751 | 302 |
| NASDAQ | 4,355 | 3,567 | 1,656 |
| NYSE | 3,309 | 2,615 | 1,318 |
| SSE | 1,699 | 1,698 | 415 |
| SZSE | 2,896 | 2,889 | 724 |
| TSE | 3,718 | 3,702 | 1,587 |

## Corrections applied

`HKEX:0012` Henderson Land was replaced with TradingView's exact
`henderson-land-development-co` mark. The previous Logo.dev asset was a gold
“50 years” campaign mark.

`SZSE:300968` Guangdong Green Precision Components was effectively blank after
processing and was replaced with TradingView's exact `guangdong-green-pr`
asset.

The exact-source revalidation also replaced 39 previously rejected
low-resolution assets with TradingView sources. After finalization, the catalog
contains 4,440 TradingView assets and no assets below the resolution floor.
The remaining source-review list has 105 rows: 23 missing, 1 failed, and 81
quarantined duplicate-provider collisions.

## Logo.dev scope

The audit compares TradingView against the Logo.dev snapshot already stored in
the catalog. It does not make a live 20,524-request Logo.dev refresh: Logo.dev's
current fair-use rules prohibit automated bulk logo downloads, and every ticker
request consumes the account's monthly request pool. The supplied publishable
key was not stored in source, reports, or local environment files.

See `logo-source-audit.json` for all listing results and
`logo-source-audit.csv` for the review queue.
