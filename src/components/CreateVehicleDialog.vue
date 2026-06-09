<script setup lang="ts">
import { computed, ref } from "vue";
import type { NamedVehicle } from "../domain/models";

const props = defineProps<{
  existingVehicleNames: string[];
}>();

const emit = defineEmits<{
  create: [vehicle: NamedVehicle];
}>();

const dialog = ref(false);
const formRef = ref();

const requiredRule = (value: unknown) => !!value || "This field is required";

const positiveNumberRule = (value: number) =>
  value > 0 || "Value must be greater than 0";

const socRule = (value: number) =>
  (value >= 0 && value <= 100) || "SoC must be between 0 and 100";

const normalizedExistingVehicleNames = computed(() =>
  props.existingVehicleNames.map((name) => name.trim().toLowerCase()),
);

const uniqueNameRule = (value: string) =>
  !normalizedExistingVehicleNames.value.includes(value.trim().toLowerCase()) ||
  "Name must be unique";

const form = ref<NamedVehicle>({
  name: "",
  batteryCapacity: 60,
  currentSoc: 40,
  targetSoc: 80,
  maxChargingPower: 11,
  targetTime: getDefaultTargetTime(),
});

function getDefaultTargetTime(): string {
  const date = new Date();

  date.setHours(date.getHours() + 24);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function resetForm() {
  form.value = {
    name: "",
    batteryCapacity: 60,
    currentSoc: 40,
    targetSoc: 80,
    maxChargingPower: 11,
    targetTime: getDefaultTargetTime(),
  };
}

async function createVehicle() {
  const result = await formRef.value?.validate();

  if (!result?.valid) return;

  emit("create", {
    ...form.value,
    name: form.value.name.trim(),
  });

  resetForm();
  dialog.value = false;
}
</script>

<template>
  <v-dialog
    v-model="dialog"
    max-width="500"
  >
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        color="primary"
        variant="flat"
      >
        <v-icon class="mr-2">mdi-plus</v-icon>Add vehicle
      </v-btn>
    </template>

    <v-card>
      <v-card-title>Create Vehicle</v-card-title>

      <v-card-text>
        <v-form ref="formRef">
          <v-text-field
            v-model="form.name"
            label="Vehicle name"
            :rules="[requiredRule, uniqueNameRule]"
          />

          <v-text-field
            v-model.number="form.batteryCapacity"
            label="Battery capacity (kWh)"
            type="number"
            :rules="[requiredRule, positiveNumberRule]"
          />

          <v-text-field
            v-model.number="form.currentSoc"
            label="Current SoC (%)"
            type="number"
            :rules="[requiredRule, socRule]"
          />

          <v-text-field
            v-model.number="form.targetSoc"
            label="Target SoC (%)"
            type="number"
            :rules="[requiredRule, socRule]"
          />

          <v-text-field
            v-model.number="form.maxChargingPower"
            label="Max charging power (kW)"
            type="number"
            :rules="[requiredRule, positiveNumberRule]"
          />

          <v-text-field
            v-model="form.targetTime"
            label="Target time"
            type="datetime-local"
            :rules="[requiredRule]"
          />
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn
          variant="text"
          @click="dialog = false"
        >
          Cancel
        </v-btn>

        <v-btn
          color="primary"
          @click="createVehicle"
        >
          Create
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
