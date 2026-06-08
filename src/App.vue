<script setup lang="ts">
import ChargingChart from "./components/ChargingChart.vue";
import SocChart from "./components/SocChart.vue";
</script>

<template>
  <v-app class="bg-grey-lighten-3">
    <v-main class="ma-4">
      <v-container fluid>
        <h1>EV Charging Schedule Optimizer</h1>
        <v-row>
          <v-col
            cols="12"
            md="6"
          >
            <ChargingChart />
          </v-col>

          <v-col
            cols="12"
            md="6"
          >
            <SocChart />
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>
