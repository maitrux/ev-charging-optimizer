<script setup lang="ts">
import { LineChart } from "echarts/charts";
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
  sampleSchedule,
  sampleVehicles,
} from "../data/sample-data";
import type { Vehicle } from "../domain/models";
import CreateVehicleDialog from "./CreateVehicleDialog.vue";

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
]);

const vehicles = ref<Vehicle[]>([...sampleVehicles]);
const selectedVehicleName = ref(vehicles.value[0].name);

const selectedVehicle = computed(() =>
  vehicles.value.find((vehicle) => vehicle.name === selectedVehicleName.value),
);

const hours = sampleForecast.map((item) =>
  new Date(item.timestamp).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }),
);

const targetTimeIndex = computed(() => {
  if (!selectedVehicle.value) return 0;

  const targetTime = new Date(selectedVehicle.value.targetTime).getTime();

  const closestIndex = sampleForecast.findIndex((forecast) => {
    return new Date(forecast.timestamp).getTime() >= targetTime;
  });

  return closestIndex === -1 ? sampleForecast.length - 1 : closestIndex;
});

const socData = computed(() => {
  if (!selectedVehicle.value) return [];

  let currentEnergy =
    selectedVehicle.value.batteryCapacity *
    (selectedVehicle.value.currentSoc / 100);

  return sampleSchedule.map((entry) => {
    currentEnergy += entry.chargingPower;

    const soc = (currentEnergy / selectedVehicle.value!.batteryCapacity) * 100;

    return Math.min(Math.round(soc), 100);
  });
});

const chartOptions = computed(() => {
  if (!selectedVehicle.value) return {};

  return {
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: number) => `${value}%`,
    },
    legend: {
      top: 0,
    },
    grid: {
      top: 50,
      left: 50,
      right: 120,
      bottom: 40,
    },
    xAxis: {
      type: "category",
      data: hours,
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: {
        formatter: "{value}%",
      },
    },
    series: [
      {
        name: "State of Charge",
        type: "line",
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

function addVehicle(vehicle: Vehicle) {
  vehicles.value.push(vehicle);
  selectedVehicleName.value = vehicle.name;
}

// Format 03.06.2026 10:00
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
      <h2>Battery State of Charge (SoC)</h2>

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
    >
      <p><strong>Battery Capacity:</strong> {{ selectedVehicle.targetSoc }}%</p>
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
      class="chart mt-10"
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
  height: 360px;
  width: 100%;
}
</style>
