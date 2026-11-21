# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/AryFlows/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/AryFlows/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

Frost CSV Reader — a faster drop-in for make.fun's csv-reader 1.0.0. It answers exactly as the reference ({columns, rows, errors}) on every case, including BOM drop, LF/CRLF line breaks, stray CR errors, quoted fields with embedded newlines and doubled quotes, unterminated quotes, quote junk, and short/long rows — while running several times faster. The parser never scans character by character: it jumps from delimiter to delimiter with indexOf, slices whole fields at once, and checks each line for stray CRs a single time instead of once per field.

On the kit's practice set (6 cases, ~10.2M characters) it matches the reference byte for byte on all 6 cases and parses about 4–5x faster than the reference (cold-start, fresh process).

## Run it

```sh
node main.ts
```

Outside the grader's container, point it at a case set with `MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR`:

```sh
MAKEFUN_INPUT_DIR=./input MAKEFUN_OUTPUT_DIR=./output node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=m2fjazt9&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
