<script setup lang="ts">
import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { computed, ref } from "vue";
import VChart from "vue-echarts";

import { sampleForecast, sampleVehicles } from "../data/sample-data";
import type { ForecastHour, NamedVehicle } from "../domain/models";
import { generateChargingSchedule } from "../domain/optimizer";
import { calculateGridCostPerKwh } from "../domain/scoring";
import CreateVehicleDialog from "./CreateVehicleDialog.vue";

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
]);

const vehicles = ref<NamedVehicle[]>([...sampleVehicles]);
const selectedVehicleName = ref(vehicles.value[0].name);

type ForecastSource = "default" | "uploaded";

const selectedForecastSource = ref<ForecastSource>("default");
const uploadedForecast = ref<ForecastHour[] | null>(null);
const uploadedForecastName = ref<string | null>(null);
const forecastUploadError = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const forecastSourceOptions = computed(() => {
  const options: { title: string; value: ForecastSource }[] = [
    { title: "Default forecast", value: "default" },
  ];

  if (uploadedForecast.value) {
    options.push({
      title: uploadedForecastName.value ?? "Uploaded forecast",
      value: "uploaded",
    });
  }

  return options;
});

const activeForecast = computed(() => {
  if (selectedForecastSource.value === "uploaded" && uploadedForecast.value) {
    return uploadedForecast.value;
  }

  return sampleForecast;
});

const selectedVehicle = computed(() =>
  vehicles.value.find((vehicle) => vehicle.name === selectedVehicleName.value),
);

const schedule = computed(() => {
  if (!selectedVehicle.value) return [];

  return generateChargingSchedule(selectedVehicle.value, activeForecast.value);
});

const hours = computed(() =>
  activeForecast.value.map((item) =>
    new Date(item.timestamp).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  ),
);

const targetTimeIndex = computed(() => {
  if (!selectedVehicle.value) return 0;

  const targetTime = new Date(selectedVehicle.value.targetTime).getTime();

  const closestIndex = activeForecast.value.findIndex(
    (forecast) => new Date(forecast.timestamp).getTime() >= targetTime,
  );

  return closestIndex === -1 ? activeForecast.value.length - 1 : closestIndex;
});

const scheduleByHour = computed(
  () =>
    new Map(schedule.value.map((entry) => [entry.hour, entry.chargingPower])),
);

const chargingPowerData = computed(() =>
  activeForecast.value.map(
    (forecast) => scheduleByHour.value.get(forecast.timestamp) ?? 0,
  ),
);
const priceData = computed(() =>
  activeForecast.value.map((item) => item.price),
);
const gridCostData = computed(() =>
  activeForecast.value.map((item) => {
    const cost = calculateGridCostPerKwh(item);

    return Number.isFinite(cost) ? Number(cost.toFixed(4)) : null;
  }),
);
const solarData = computed(() =>
  activeForecast.value.map((item) => item.solar),
);
const confidenceData = computed(() =>
  activeForecast.value.map((item) => item.confidence),
);

const socData = computed(() => {
  if (!selectedVehicle.value) return [];

  let currentEnergy =
    selectedVehicle.value.batteryCapacity *
    (selectedVehicle.value.currentSoc / 100);

  return activeForecast.value.map((forecast) => {
    currentEnergy += scheduleByHour.value.get(forecast.timestamp) ?? 0;

    const soc = (currentEnergy / selectedVehicle.value!.batteryCapacity) * 100;

    return Math.min(Math.round(soc), 100);
  });
});

const chartOptions = computed(() => {
  if (!selectedVehicle.value) return {};

  return {
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) return "";

        const index = params[0]?.dataIndex ?? 0;
        const forecast = activeForecast.value[index];

        if (!forecast) return "";

        const hour = hours.value[index];
        const gridCost = calculateGridCostPerKwh(forecast);
        const gridCostLabel = Number.isFinite(gridCost)
          ? `${gridCost.toFixed(3)} €/kWh`
          : "n/a";

        const lines = [
          `<strong>${hour}</strong>`,
          `Price: ${forecast.price.toFixed(2)} €/kWh`,
          `Grid cost (price ÷ confidence): ${gridCostLabel}`,
          `Solar: ${forecast.solar.toFixed(1)} kWh`,
          `Plug-in confidence: ${(forecast.confidence * 100).toFixed(0)}%`,
        ];

        for (const param of params) {
          const value = param.value;

          if (value === null || value === undefined) continue;

          lines.push(`${param.marker} ${param.seriesName}: ${value}`);
        }

        return lines.join("<br/>");
      },
    },
    legend: {
      top: 0,
    },
    grid: [
      { top: 60, height: 90, left: 60, right: 120 },
      { top: 190, height: 90, left: 60, right: 120 },
      { top: 320, height: 90, left: 60, right: 120 },
      { top: 450, height: 90, left: 60, right: 120 },
      { top: 580, height: 90, left: 60, right: 120 },
    ],
    xAxis: Array.from({ length: 5 }, (_, index) => ({
      type: "category",
      gridIndex: index,
      data: hours.value,
      axisLabel: {
        show: index === 4,
      },
    })),
    yAxis: [
      {
        type: "value",
        gridIndex: 0,
        name: "€/kWh",
      },
      {
        type: "value",
        gridIndex: 1,
        name: "kWh",
      },
      {
        type: "value",
        gridIndex: 2,
        name: "Confidence",
        min: 0,
        max: 1,
      },
      {
        type: "value",
        gridIndex: 3,
        name: "kW",
      },
      {
        type: "value",
        gridIndex: 4,
        name: "SoC",
        min: 0,
        max: 100,
        axisLabel: {
          formatter: "{value}%",
        },
      },
    ],
    series: [
      {
        name: "Price",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: priceData.value,
        smooth: true,
        showSymbol: false,
        color: "#2196F3",
        lineStyle: { width: 2 },
      },
      {
        name: "Grid cost",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: gridCostData.value,
        smooth: true,
        showSymbol: false,
        color: "#78909C",
        lineStyle: { type: "dashed", width: 2 },
      },
      {
        name: "Solar",
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: solarData.value,
        smooth: true,
        color: "#FFC107",
      },
      {
        name: "Plug-in Confidence",
        type: "line",
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: confidenceData.value,
        color: "#4CAF50",
        smooth: true,
      },
      {
        name: "Charging Power",
        type: "bar",
        xAxisIndex: 3,
        yAxisIndex: 3,
        data: chargingPowerData.value,
        color: "#7986CB",
      },
      {
        name: "State of Charge",
        type: "line",
        xAxisIndex: 4,
        yAxisIndex: 4,
        data: socData.value,
        smooth: true,
        color: "#9C27B0",
        markLine: {
          symbol: "none",
          data: [
            {
              yAxis: selectedVehicle.value.targetSoc,
              name: "Target SoC",
              label: {
                formatter: `Target SoC ${selectedVehicle.value.targetSoc}%`,
              },
            },
            {
              xAxis: targetTimeIndex.value,
              name: "Target Time",
              label: {
                formatter: "Target time",
              },
            },
          ],
        },
      },
    ],
  };
});

function addVehicle(vehicle: NamedVehicle) {
  vehicles.value.push(vehicle);
  selectedVehicleName.value = vehicle.name;
}

function isForecastHour(value: unknown): value is ForecastHour {
  if (typeof value !== "object" || value === null) return false;

  const entry = value as Record<string, unknown>;

  return (
    typeof entry.timestamp === "string" &&
    typeof entry.price === "number" &&
    typeof entry.solar === "number" &&
    typeof entry.confidence === "number"
  );
}

function parseForecastFile(content: string): ForecastHour[] {
  const parsed: unknown = JSON.parse(content);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Forecast file must be a non-empty JSON array.");
  }

  if (!parsed.every(isForecastHour)) {
    throw new Error(
      "Each entry must include timestamp, price, solar, and confidence.",
    );
  }

  return parsed;
}

function openForecastUpload() {
  fileInputRef.value?.click();
}

async function handleForecastUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  input.value = "";

  if (!file) return;

  forecastUploadError.value = null;

  try {
    const content = await file.text();
    uploadedForecast.value = parseForecastFile(content);
    uploadedForecastName.value = file.name;
    selectedForecastSource.value = "uploaded";
  } catch (error) {
    uploadedForecast.value = null;
    uploadedForecastName.value = null;
    selectedForecastSource.value = "default";

    forecastUploadError.value =
      error instanceof Error ? error.message : "Could not read forecast file.";
  }
}

function mapUTCToLocalDateTime(utcTime: string) {
  return new Date(utcTime).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
</script>

<template>
  <section class="chart-card bg-white">
    <div class="chart-header">
      <h2>Optimal Charging Schedule</h2>

      <div class="actions">
        <div class="action-group">
          <v-select
            v-model="selectedForecastSource"
            :items="forecastSourceOptions"
            item-title="title"
            item-value="value"
            label="Forecast"
            density="compact"
            variant="outlined"
            hide-details
            class="forecast-select"
          />

          <input
            ref="fileInputRef"
            type="file"
            accept=".json,application/json"
            hidden
            @change="handleForecastUpload"
          />

          <v-btn
            variant="flat"
            color="teal"
            @click="openForecastUpload"
          >
            <v-icon start>mdi-upload</v-icon>
            Upload JSON
          </v-btn>
        </div>

        <div class="action-group">
          <v-select
            v-model="selectedVehicleName"
            :items="vehicles.map((vehicle) => vehicle.name)"
            label="Vehicle"
            density="compact"
            variant="outlined"
            hide-details
            class="vehicle-select"
          />

          <CreateVehicleDialog
            :existing-vehicle-names="vehicles.map((vehicle) => vehicle.name)"
            @create="addVehicle"
          />
        </div>
      </div>
    </div>

    <v-alert
      v-if="forecastUploadError"
      type="error"
      variant="tonal"
      class="mt-4"
      closable
      @click:close="forecastUploadError = null"
    >
      {{ forecastUploadError }}
    </v-alert>

    <v-alert
      v-else-if="selectedForecastSource === 'uploaded' && uploadedForecast"
      color="success"
      variant="tonal"
      class="mt-4"
      density="compact"
    >
      Using uploaded forecast
      <strong>{{ uploadedForecastName }}</strong>
    </v-alert>

    <v-alert
      v-if="selectedVehicle"
      color="primary"
      variant="tonal"
      class="mt-4"
    >
      <p>
        <strong>Battery Capacity:</strong>
        {{ selectedVehicle.batteryCapacity }} kWh
      </p>
      <p><strong>Current SoC:</strong> {{ selectedVehicle.currentSoc }}%</p>
      <p><strong>Target SoC:</strong> {{ selectedVehicle.targetSoc }}%</p>
      <p>
        <strong>Max Charging Power:</strong>
        {{ selectedVehicle.maxChargingPower }} kW
      </p>
      <p>
        <strong>Target time:</strong>
        {{ mapUTCToLocalDateTime(selectedVehicle.targetTime) }}
      </p>
    </v-alert>

    <VChart
      class="chart mt-8"
      :option="chartOptions"
      autoresize
    />
  </section>
</template>

<style scoped>
.chart-card {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 12px;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.actions {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.forecast-select,
.vehicle-select {
  width: 220px;
}

.chart {
  height: 720px;
  width: 100%;
}
</style>
