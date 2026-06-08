<script setup lang="ts">
import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import VChart from "vue-echarts";
import { sampleForecast, sampleSchedule } from "../data/sample-data";

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
]);

const hours = sampleForecast.map((item) =>
  new Date(item.timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }),
);

const chargingPower = sampleSchedule.map((item) => item.chargingPower);
const prices = sampleForecast.map((item) => item.price);
const solar = sampleForecast.map((item) => item.solar);
const confidence = sampleForecast.map((item) => item.confidence);

const chartOptions = {
  tooltip: {
    trigger: "axis",
  },
  legend: {
    top: 0,
  },
  grid: {
    top: 50,
    left: 50,
    right: 50,
    bottom: 40,
  },
  xAxis: {
    type: "category",
    data: hours,
  },
  yAxis: {
    type: "value",
  },
  series: [
    {
      name: "Charging Power (kW)",
      type: "bar",
      data: chargingPower,
    },
    {
      name: "Price (€/kWh)",
      type: "line",
      data: prices,
    },
    {
      name: "Solar (kWh)",
      type: "line",
      data: solar,
    },
    {
      name: "Plug-in Confidence",
      type: "line",
      data: confidence,
    },
  ],
};
</script>

<template>
  <section class="chart-card">
    <h2>Optimal Charging Schedule</h2>

    <VChart
      class="chart"
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

.chart {
  height: 500px;
  width: 100%;
}
</style>
