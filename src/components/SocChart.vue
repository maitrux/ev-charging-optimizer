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
import VChart from "vue-echarts";
import {
  sampleForecast,
  sampleSchedule,
  sampleVehicle,
} from "../data/sample-data";

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
]);

const hours = sampleForecast.map((item) =>
  new Date(item.timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }),
);

let currentEnergy =
  sampleVehicle.batteryCapacity * (sampleVehicle.currentSoc / 100);

const socData = sampleSchedule.map((entry) => {
  currentEnergy += entry.chargingPower;

  const soc = (currentEnergy / sampleVehicle.batteryCapacity) * 100;

  return Math.min(Math.round(soc), 100);
});

const chartOptions = {
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
    right: 30,
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
      data: socData,
      smooth: true,
      markLine: {
        symbol: "none",
        data: [
          {
            yAxis: sampleVehicle.targetSoc,
            name: "Target SoC",
            label: {
              formatter: `Target ${sampleVehicle.targetSoc}%`,
            },
          },
        ],
      },
    },
  ],
};
</script>

<template>
  <section class="chart-card">
    <h2>Battery State of Charge</h2>

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
  height: 360px;
  width: 100%;
}
</style>
