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

import {
  sampleForecast,
  sampleForecastFullDay,
  sampleVehicles,
} from "../data/sample-data";
import {
  formatChartAxisLabels,
  formatDateTimeDeDe,
  getTargetTimeChartAxisPosition,
} from "../domain/datetime";
import type { ForecastHour, NamedVehicle } from "../domain/models";
import { generateChargingSchedule } from "../domain/optimizer";
import { scoreForecastHours } from "../domain/scoring";
import { calculateTargetSocReachProbability } from "../domain/target-soc-probability";
import {
  parseForecastJson,
  validateTargetTimeWithinForecast,
} from "../domain/validation";
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

type ForecastSource = "default" | "full-day" | "uploaded";

const chartGridCount = 5;

const vehicles = ref<NamedVehicle[]>([...sampleVehicles]);
const selectedVehicleName = ref(vehicles.value[0].name);

const selectedForecastSource = ref<ForecastSource | null>("default");
const uploadedForecast = ref<ForecastHour[] | null>(null);
const uploadedForecastName = ref<string | null>(null);
const forecastUploadError = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const vehicleNames = computed(() =>
  vehicles.value.map((vehicle) => vehicle.name),
);

const forecastSourceOptions = computed(() => {
  const options: { title: string; value: ForecastSource }[] = [
    { title: "Default forecast", value: "default" },
    { title: "Full-day forecast", value: "full-day" },
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
  if (!selectedForecastSource.value) {
    return [];
  }

  if (selectedForecastSource.value === "uploaded" && uploadedForecast.value) {
    return uploadedForecast.value;
  }

  if (selectedForecastSource.value === "full-day") {
    return sampleForecastFullDay;
  }

  return sampleForecast;
});

const selectedVehicle = computed(() =>
  vehicles.value.find((vehicle) => vehicle.name === selectedVehicleName.value),
);

const forecastTimestamps = computed(() =>
  activeForecast.value.map((forecast) => forecast.timestamp),
);

const chartAxisLabels = computed(() =>
  formatChartAxisLabels(forecastTimestamps.value),
);

const chartXAxisMax = computed(() =>
  Math.max(0, activeForecast.value.length - 1),
);

const targetTimeChartPosition = computed(() => {
  if (!selectedVehicle.value) return 0;

  return getTargetTimeChartAxisPosition(
    forecastTimestamps.value,
    selectedVehicle.value.targetTime,
  );
});

const scheduleValidationError = computed(() => {
  if (!selectedVehicle.value || !selectedForecastSource.value) return null;

  try {
    validateTargetTimeWithinForecast(
      selectedVehicle.value,
      activeForecast.value,
    );

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
});

const canShowChart = computed(
  () =>
    Boolean(selectedVehicle.value) &&
    Boolean(selectedForecastSource.value) &&
    !scheduleValidationError.value &&
    !forecastUploadError.value,
);

const schedule = computed(() => {
  if (!selectedVehicle.value || scheduleValidationError.value) {
    return [];
  }

  return generateChargingSchedule(selectedVehicle.value, activeForecast.value);
});

const scheduleByHour = computed(
  () =>
    new Map(schedule.value.map((entry) => [entry.hour, entry.chargingPower])),
);

const targetSocProbability = computed(() => {
  if (!selectedVehicle.value || scheduleValidationError.value) {
    return null;
  }

  return calculateTargetSocReachProbability(
    selectedVehicle.value,
    schedule.value,
    activeForecast.value,
  );
});

const formattedTargetSocProbability = computed(() => {
  if (targetSocProbability.value === null) return "";

  return `${(targetSocProbability.value * 100).toFixed(1)}%`;
});

const chargingPowerData = computed(() =>
  activeForecast.value.map(
    (forecast) => scheduleByHour.value.get(forecast.timestamp) ?? 0,
  ),
);

const priceData = computed(() =>
  activeForecast.value.map((forecast) => forecast.price),
);

const solarData = computed(() =>
  activeForecast.value.map((forecast) => forecast.solar),
);

const confidenceData = computed(() =>
  activeForecast.value.map((forecast) => forecast.confidence),
);

const benefitByTimestamp = computed(() => {
  if (!selectedVehicle.value) return new Map<string, number>();

  const targetTime = new Date(selectedVehicle.value.targetTime).getTime();

  const usableForecasts = activeForecast.value.filter((forecast) => {
    const forecastTime = new Date(forecast.timestamp).getTime();

    return forecastTime <= targetTime;
  });

  return new Map(
    scoreForecastHours(usableForecasts).map((forecast) => [
      forecast.timestamp,
      forecast.benefit,
    ]),
  );
});

const benefitData = computed(() =>
  activeForecast.value.map(
    (forecast) => benefitByTimestamp.value.get(forecast.timestamp) ?? null,
  ),
);

const socData = computed(() => {
  const vehicle = selectedVehicle.value;

  if (!vehicle) return [];

  let currentEnergyKwh = vehicle.batteryCapacity * (vehicle.currentSoc / 100);

  return activeForecast.value.map((forecast) => {
    const chargingPower = scheduleByHour.value.get(forecast.timestamp) ?? 0;

    currentEnergyKwh += chargingPower;

    const soc = (currentEnergyKwh / vehicle.batteryCapacity) * 100;

    return Math.min(Math.round(soc), 100);
  });
});

function toIndexedSeriesData(values: Array<number | null>) {
  return values.map((value, index) => [index, value]);
}

function seriesValue(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return Number(value[1]);
  }

  return Number(value);
}

function formatTooltip(params: unknown) {
  if (!Array.isArray(params) || params.length === 0) return "";

  const index = params[0]?.dataIndex ?? 0;
  const forecast = activeForecast.value[index];

  if (!forecast) return "";

  const lines = [
    `<strong>${formatDateTimeDeDe(forecast.timestamp)}</strong>`,
    `Price: ${forecast.price.toFixed(2)} €/kWh`,
    `Solar: ${forecast.solar.toFixed(1)} kWh`,
    `Plug-in confidence: ${(forecast.confidence * 100).toFixed(0)}%`,
  ];

  const benefit = benefitByTimestamp.value.get(forecast.timestamp);

  if (benefit !== undefined) {
    lines.push(`Benefit: ${benefit.toFixed(2)}`);
  }

  for (const param of params) {
    const value = seriesValue(param.value);

    if (value === null) continue;

    if (param.seriesName === "Benefit") {
      lines.push(`${param.marker} ${param.seriesName}: ${value.toFixed(2)}`);
      continue;
    }

    if (param.seriesName === "Plug-in Confidence") {
      const percentage = (value * 100).toFixed(0);

      lines.push(`${param.marker} ${param.seriesName}: ${percentage}%`);
      continue;
    }

    lines.push(`${param.marker} ${param.seriesName}: ${value}`);
  }

  return lines.join("<br/>");
}

const chartOptions = computed(() => {
  const vehicle = selectedVehicle.value;

  if (!vehicle) return {};

  return {
    tooltip: {
      trigger: "axis",
      formatter: formatTooltip,
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
    xAxis: Array.from({ length: chartGridCount }, (_, index) => ({
      type: "value",
      gridIndex: index,
      min: 0,
      max: chartXAxisMax.value,
      interval: 1,
      splitLine: {
        show: false,
      },
      axisLabel: {
        show: index === chartGridCount - 1,
        formatter: (value: number) => {
          if (!Number.isInteger(value)) return "";

          return chartAxisLabels.value[value] ?? "";
        },
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
        gridIndex: 3,
        name: "Benefit",
        min: 0,
        max: 1,
        position: "right",
        splitLine: {
          show: false,
        },
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
        data: toIndexedSeriesData(priceData.value),
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        color: "#2196F3",
        lineStyle: { width: 2 },
      },
      {
        name: "Solar",
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: toIndexedSeriesData(solarData.value),
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        color: "#FFC107",
      },
      {
        name: "Plug-in Confidence",
        type: "line",
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: toIndexedSeriesData(confidenceData.value),
        color: "#4CAF50",
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
      },
      {
        name: "Charging Power",
        type: "bar",
        xAxisIndex: 3,
        yAxisIndex: 3,
        data: toIndexedSeriesData(chargingPowerData.value),
        barMaxWidth: 36,
        color: "#7986CB",
      },
      {
        name: "Benefit",
        type: "line",
        xAxisIndex: 3,
        yAxisIndex: 4,
        data: toIndexedSeriesData(benefitData.value),
        smooth: true,
        showSymbol: false,
        color: "#9E9E9E",
        lineStyle: {
          type: "dotted",
          width: 2,
          color: "#9E9E9E",
        },
        connectNulls: false,
      },
      {
        name: "State of Charge",
        type: "line",
        xAxisIndex: 4,
        yAxisIndex: 5,
        data: toIndexedSeriesData(socData.value),
        smooth: true,
        color: "#9C27B0",
        markLine: {
          symbol: "none",
          data: [
            {
              yAxis: vehicle.targetSoc,
              name: "Target SoC",
              label: {
                formatter: `Target SoC ${vehicle.targetSoc}%`,
              },
            },
            {
              xAxis: targetTimeChartPosition.value,
              name: "Target Time",
              label: {
                formatter: `Target time ${formatDateTimeDeDe(vehicle.targetTime)}`,
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

function handleForecastSourceChange(source: ForecastSource | null) {
  forecastUploadError.value = null;
  selectedForecastSource.value = source;
}

function openForecastUpload() {
  fileInputRef.value?.click();
}

function clearUploadedForecast() {
  uploadedForecast.value = null;
  uploadedForecastName.value = null;
}

async function handleForecastUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  input.value = "";

  if (!file) return;

  forecastUploadError.value = null;

  try {
    const content = await file.text();
    const forecast = parseForecastJson(content);

    if (selectedVehicle.value) {
      validateTargetTimeWithinForecast(selectedVehicle.value, forecast);
    }

    uploadedForecast.value = forecast;
    uploadedForecastName.value = file.name;
    selectedForecastSource.value = "uploaded";
  } catch (error) {
    clearUploadedForecast();
    selectedForecastSource.value = null;

    forecastUploadError.value =
      error instanceof Error ? error.message : "Could not read forecast file.";
  }
}
</script>

<template>
  <section class="chart-card bg-white">
    <div class="chart-header">
      <h2>Optimal Charging Schedule</h2>

      <div class="actions">
        <div class="action-group">
          <v-select
            :model-value="selectedForecastSource"
            :items="forecastSourceOptions"
            item-title="title"
            item-value="value"
            label="Forecast"
            placeholder="Select forecast"
            density="compact"
            variant="outlined"
            hide-details
            class="forecast-select"
            @update:model-value="handleForecastSourceChange"
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
            :items="vehicleNames"
            label="Vehicle"
            density="compact"
            variant="outlined"
            hide-details
            class="vehicle-select"
          />

          <CreateVehicleDialog
            :existing-vehicle-names="vehicleNames"
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
      icon="mdi-alert-circle"
      @click:close="forecastUploadError = null"
    >
      {{ forecastUploadError }}
    </v-alert>

    <v-alert
      v-else-if="scheduleValidationError"
      type="error"
      variant="tonal"
      class="mt-4"
    >
      {{ scheduleValidationError }}
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
        {{ formatDateTimeDeDe(selectedVehicle.targetTime) }}
      </p>
    </v-alert>

    <v-alert
      v-if="canShowChart"
      color="deep-purple"
      variant="tonal"
      class="mt-4"
    >
      <p>
        <strong>Probability of reaching target SoC:</strong>
        {{ formattedTargetSocProbability }}
      </p>
    </v-alert>

    <VChart
      v-if="canShowChart"
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
