# Benchmark Results

Generated from `summary-starter.csv` and `benchmarks-starter.csv` with `20` measured runs (`starter` scenario, latest rerun).
Co-authored by AmpCode.

## Dev Spinup Readiness (Cold, readyMeanMs)

1. `manic` - `145 ms`
2. `vite` - `341 ms`
3. `next` - `494 ms`
4. `nuxt` - `579 ms`
5. `tanstack` - `669 ms`
6. `remix` - `737 ms`
7. `astro` - `1930 ms`

## Build Time (Cold, Mean)

1. `manic` - `408 ms`
2. `remix` - `1068 ms`
3. `tanstack` - `1347 ms`
4. `astro` - `1712 ms`
5. `vite` - `2351 ms`
6. `nuxt` - `6334 ms`
7. `next` - `6659 ms`

## Build Time (Warm, Mean)

1. `manic` - `397 ms`
2. `vite` - `1690 ms`
3. `remix` - `1716 ms`
4. `tanstack` - `2218 ms`
5. `astro` - `2463 ms`
6. `nuxt` - `4193 ms`
7. `next` - `8167 ms`

## Output Size (Cold, outputBytesMean)

Smallest to largest:

1. `astro` - `16.4 KB`
2. `vite` - `232.8 KB`
3. `remix` - `358.2 KB`
4. `manic` - `371.8 KB`
5. `tanstack` - `1.23 MB`
6. `nuxt` - `2.52 MB`
7. `next` - `5.54 MB`

## CSV Files

- `benchmarks/results/benchmarks-starter.csv` (per-run raw rows)
- `benchmarks/results/summary-starter.csv` (aggregated starter metrics)
- `benchmarks/results/raw-runs.json` (full raw JSON with stderr tails)

## Dev Summary Table

| Framework | Cold Ready Mean | Cold Ready p95 | Warm Ready Mean | Warm Ready p95 | Cold Spinup Mean | Cold Min | Cold Max | Warm Spinup Mean | Warm Min | Warm Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| manic | 145 ms | 207 ms | 174 ms | 235 ms | 1368 ms | 1307 ms | 1464 ms | 1401 ms | 1307 ms | 1569 ms |
| vite | 341 ms | 452 ms | 270 ms | 348 ms | 1586 ms | 1473 ms | 1723 ms | 1507 ms | 1419 ms | 1697 ms |
| next | 494 ms | 787 ms | 344 ms | 546 ms | 1740 ms | 1571 ms | 2061 ms | 1595 ms | 1492 ms | 1794 ms |
| nuxt | 579 ms | 1111 ms | 414 ms | 582 ms | 1875 ms | 1613 ms | 2667 ms | 1695 ms | 1472 ms | 2047 ms |
| tanstack | 669 ms | 824 ms | 1363 ms | 1806 ms | 1929 ms | 1677 ms | 2225 ms | 2645 ms | 2092 ms | 3240 ms |
| remix | 737 ms | 1062 ms | 1224 ms | 1784 ms | 1974 ms | 1717 ms | 2304 ms | 2482 ms | 1879 ms | 3115 ms |
| astro | 1930 ms | 2882 ms | 2539 ms | 3987 ms | 3179 ms | 2287 ms | 4155 ms | 3790 ms | 2497 ms | 5432 ms |

## Build Summary Table

| Framework | Cold Build Mean | Cold Build p95 | Cold Min | Cold Max | Warm Build Mean | Warm Build p95 | Warm Min | Warm Max | Cold Output Mean | Warm Output Mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| manic | 408 ms | 540 ms | 249 ms | 580 ms | 397 ms | 505 ms | 204 ms | 616 ms | 371.8 KB | 371.8 KB |
| remix | 1068 ms | 1494 ms | 653 ms | 1843 ms | 1716 ms | 2448 ms | 937 ms | 2612 ms | 358.2 KB | 358.2 KB |
| tanstack | 1347 ms | 1832 ms | 883 ms | 2130 ms | 2218 ms | 3119 ms | 1260 ms | 3632 ms | 1.23 MB | 1.23 MB |
| astro | 1712 ms | 2432 ms | 1201 ms | 2883 ms | 2463 ms | 4210 ms | 1431 ms | 4437 ms | 16.4 KB | 16.5 KB |
| vite | 2351 ms | 3183 ms | 1472 ms | 3369 ms | 1690 ms | 2147 ms | 1234 ms | 2150 ms | 232.8 KB | 232.8 KB |
| nuxt | 6334 ms | 10455 ms | 3857 ms | 10926 ms | 4193 ms | 5311 ms | 2762 ms | 5834 ms | 2.52 MB | 2.82 MB |
| next | 6659 ms | 9274 ms | 4812 ms | 9954 ms | 8167 ms | 9194 ms | 3262 ms | 67098 ms | 5.54 MB | 5.54 MB |
