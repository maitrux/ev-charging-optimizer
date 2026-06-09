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
import type { NamedVehicle } from "../domain/models";
import { generateChargingSchedule } from "../domain/optimizer";
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

const selectedVehicle = computed(() =>
  vehicles.value.find((vehicle) => vehicle.name === selectedVehicleName.value),
);

const schedule = computed(() => {
  if (!selectedVehicle.value) return [];

  return generateChargingSchedule(selectedVehicle.value, sampleForecast);
});

const hours = computed(() =>
  sampleForecast.map((item) =>
    new Date(item.timestamp).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  ),
);

const targetTimeIndex = computed(() => {
  if (!selectedVehicle.value) return 0;

  const targetTime = new Date(selectedVehicle.value.targetTime).getTime();

  const closestIndex = sampleForecast.findIndex(
    (forecast) => new Date(forecast.timestamp).getTime() >= targetTime,
  );

  return closestIndex === -1 ? sampleForecast.length - 1 : closestIndex;
});

const scheduleByHour = computed(
  () =>
    new Map(
      schedule.value.map((entry) => [entry.hour, entry.chargingPower]),
    ),
);

const chargingPowerData = computed(() =>
  sampleForecast.map(
    (forecast) => scheduleByHour.value.get(forecast.timestamp) ?? 0,
  ),
);
const priceData = sampleForecast.map((item) => item.price);
const solarData = sampleForecast.map((item) => item.solar);
const confidenceData = sampleForecast.map((item) => item.confidence);

const socData = computed(() => {
  if (!selectedVehicle.value) return [];

  let currentEnergy =
    selectedVehicle.value.batteryCapacity *
    (selectedVehicle.value.currentSoc / 100);

  return sampleForecast.map((forecast) => {
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
    },
    legend: {
      top: 0,
    },
    grid: [
      { top: 60, height: 90, left: 60, right: 40 },
      { top: 190, height: 90, left: 60, right: 40 },
      { top: 320, height: 90, left: 60, right: 40 },
      { top: 450, height: 90, left: 60, right: 40 },
      { top: 580, height: 90, left: 60, right: 40 },
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
        data: priceData,
        smooth: true,
      },
      {
        name: "Solar",
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: solarData,
        smooth: true,
      },
      {
        name: "Plug-in Confidence",
        type: "line",
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: confidenceData,
        smooth: true,
      },
      {
        name: "Charging Power",
        type: "bar",
        xAxisIndex: 3,
        yAxisIndex: 3,
        data: chargingPowerData.value,
      },
      {
        name: "State of Charge",
        type: "line",
        xAxisIndex: 4,
        yAxisIndex: 4,
        data: socData.value,
        smooth: true,
        markLine: {
          symbol: "none",
          data: [
            {
              yAxis: selectedVehicle.value.targetSoc,
              name: "Target SoC",
              label: {
                formatter: `Target ${selectedVehicle.value.targetSoc}%`,
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
      <h2>Example Optimal Charging Schedule</h2>

      <div class="actions">
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
  align-items: center;
  gap: 0.75rem;
}

.vehicle-select {
  width: 240px;
}

.chart {
  height: 720px;
  width: 100%;
}
</style>
