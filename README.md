# EV Charging Schedule Optimizer

An algorithm and visualization tool that builds an optimal EV charging schedule from hourly forecasts of electricity price, solar production, and plug-in confidence.

Built as a take-home assignment for **Zählerfreunde** — reduce energy costs while maximizing local solar use, with uncertainty factored in.

## Approach

The optimizer uses a **split-slot greedy algorithm**. Each forecast hour is divided into two charging buckets:

| Bucket | Energy available | Cost |
|--------|------------------|------|
| **Solar** | `min(solar, maxChargingPower)` kWh | 0 (free local production) |
| **Grid** | remaining slot capacity | `price / confidence` per kWh |

All buckets across the planning horizon are ranked by cost. The algorithm greedily fills the cheapest buckets until the battery plan is satisfied, then applies the result chronologically so the battery never exceeds 100%.

This gives three behaviors in one model:

1. **Solar utilization** — partial solar hours charge at reduced power (e.g. 3 kW when only 3 kWh solar is available), not always at max power.
2. **Cost minimization** — grid energy is only bought from the cheapest reliable hours once free solar is exhausted.
3. **Reliability** — low plug-in confidence raises the effective grid cost, making uncertain cheap slots less attractive.

**Target SoC** is the minimum required by departure time. When affordable energy remains, charging continues up to **100% battery capacity**.

## Architecture

How the UI, CLI, and domain logic connect:

```mermaid
flowchart TB
  subgraph inputs [Inputs]
    V[Vehicle JSON]
    F[Forecast JSON]
  end

  subgraph domain [Domain Layer]
    M[models.ts]
    S[scoring.ts]
    O[optimizer.ts]
  end

  subgraph apps [Applications]
    CLI[cli/index.ts]
    UI[ChargingChart.vue]
  end

  V --> CLI
  F --> CLI
  V --> UI
  F --> UI

  CLI --> O
  UI --> O

  O --> S
  O --> M
  S --> M

  O --> SCHED[ScheduleEntry array]
  SCHED --> CLI
  SCHED --> UI

  UI --> CHART[ECharts visualization]
```

## Optimization pipeline

End-to-end flow inside `generateChargingSchedule`:

```mermaid
flowchart TD
  A[Vehicle + Forecasts] --> B{Battery already full?}
  B -->|Yes| Z[Return empty schedule]
  B -->|No| C[Filter hours before target time]
  C --> D[Build ranked charging buckets]
  D --> E[Greedy allocation by cost]
  E --> F[Convert kWh per hour to kW]
  F --> G[Apply chronologically]
  G --> H[Clip when battery reaches 100%]
  H --> I[Charging schedule]

  subgraph bucketBuild [buildChargingBuckets]
    D1[Split each hour into solar + grid buckets]
    D2[Sort by cost, then type, then time]
    D1 --> D2
  end

  D --> bucketBuild
```

## Bucket model per hour

How a single forecast hour becomes chargeable energy:

```mermaid
flowchart LR
  subgraph hour [One forecast hour]
    P[Price €/kWh]
    SO[Solar kWh]
    C[Confidence 0–1]
    MP[Max charging power kW]
  end

  hour --> SB[Solar bucket<br/>energy = min solar, maxPower<br/>cost = 0]
  hour --> GB[Grid bucket<br/>energy = maxPower − solar<br/>cost = price / confidence]

  SB --> SLOT[Hour slot<br/>max maxPower kWh]
  GB --> SLOT

  SLOT --> OUT[chargingPower kW<br/>solar + grid combined]
```

Example for 3 kWh solar, 7.4 kW max, 0.28 €/kWh, 95% confidence:

- Solar bucket: **3 kWh at €0**
- Grid bucket: **4.4 kWh at €0.295/kWh**
- Possible outcomes: 3 kW solar-only, or 7.4 kW mixed, depending on what the greedy pass still needs.

## Bucket ranking and allocation

How the greedy pass decides what to charge:

```mermaid
flowchart TD
  START[Remaining energy = battery capacity − current SoC] --> SOLAR[Take all solar buckets cost = 0]
  SOLAR --> GRID[Take grid buckets cheapest first]
  GRID --> CHECK{Energy plan complete?}
  CHECK -->|No| GRID
  CHECK -->|Yes| TIME[Walk schedule in time order]
  TIME --> FULL{Battery full?}
  FULL -->|Yes| SKIP[Set chargingPower = 0]
  FULL -->|No| APPLY[Apply planned power capped by remaining capacity]
  SKIP --> NEXT[Next hour]
  APPLY --> NEXT
  NEXT --> TIME
```

## Key assumptions

- **Hourly slots** — each forecast entry represents one hour; charging power is constant within the slot.
- **Solar is free and local** — using forecasted solar costs nothing; unused solar in non-charging hours is not modeled (no feed-in tariff or curtailment).
- **Solar caps power, grid fills the rest** — within an hour, solar energy limits the free portion; any additional energy in that slot comes from the grid at the forecasted price.
- **Confidence adjusts grid cost only** — zero confidence excludes an hour entirely; solar buckets are also skipped when confidence is zero.
- **Fill to 100% when economical** — the optimizer plans energy up to full battery capacity, not just to target SoC, as long as affordable buckets exist before target time.
- **Perfect foresight** — prices, solar, and confidence are taken as given; no real-time re-optimization.

## Trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| Greedy bucket filling | Simple, fast, easy to explain | Not globally optimal if hour coupling mattered |
| Split solar / grid buckets | Realistic partial solar charging | Two-pass planning (cost order, then time order) can discard late assignments if the battery fills early |
| `price / confidence` for grid | Handles uncertainty without complex probability models | Confidence is a scalar penalty, not a full stochastic model |
| No feed-in / export model | Keeps the objective function small | May under-use midday solar if the car is unplugged |
| Fill beyond target SoC | Captures cheap energy when available | Uses more energy than strictly required for departure |

## Project structure

```
src/
├── domain/
│   ├── models.ts       # Vehicle, ForecastHour, ScheduleEntry types
│   ├── scoring.ts      # Bucket building and cost ranking
│   └── optimizer.ts    # Schedule generation
├── cli/index.ts        # Command-line interface
├── components/
│   ├── ChargingChart.vue      # Interactive chart (Vue + ECharts)
│   └── CreateVehicleDialog.vue
├── data/               # Sample vehicles and forecast
└── tests/              # Vitest unit tests
examples/
├── sample-vehicle.json
└── sample-forecast.json
```

## How to run

Requires [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/) (or npm).

```bash
# Install dependencies
pnpm install

# Run unit tests
pnpm test

# Start the web UI with chart visualization
pnpm dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`). Select a vehicle, optionally upload a custom forecast JSON, and inspect the stacked chart of price, solar, confidence, charging power, and SoC.

### CLI

Generate a schedule from JSON files:

```bash
pnpm cli -- examples/sample-forecast.json examples/sample-vehicle.json
```

Example output:

```json
[
  { "hour": "2026-06-10T02:00:00Z", "chargingPower": 4.2 },
  { "hour": "2026-06-10T06:00:00Z", "chargingPower": 0.5 }
]
```

### Input format

**Vehicle** (`examples/sample-vehicle.json`):

| Field | Type | Description |
|-------|------|-------------|
| `batteryCapacity` | number | Max capacity in kWh |
| `currentSoc` | number | Starting SoC in % |
| `targetSoc` | number | Minimum required SoC by target time |
| `targetTime` | string | ISO timestamp deadline |
| `maxChargingPower` | number | Max charger power in kW |

**Forecast** (`examples/sample-forecast.json`) — array of hourly entries:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp for the hour |
| `price` | number | Electricity price in €/kWh |
| `solar` | number | Available solar energy in kWh |
| `confidence` | number | Plug-in probability from 0 to 1 |

## Tech stack

- **TypeScript** — domain logic and type safety
- **Vue 3 + Vuetify** — web UI
- **ECharts** — schedule visualization
- **Vitest** — unit tests
- **tsx** — CLI runner
