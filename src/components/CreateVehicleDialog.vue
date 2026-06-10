<script setup lang="ts">
import { computed, ref } from "vue";
import {
  datetimeLocalToUtcIso,
  formatDateTimeDeDe,
  getDefaultTargetTimeUtc,
  utcIsoToDatetimeLocal,
} from "../domain/datetime";
import type { NamedVehicle } from "../domain/models";
import { validateVehicle } from "../domain/validation";

const props = defineProps<{
  existingVehicleNames: string[];
}>();

const emit = defineEmits<{
  create: [vehicle: NamedVehicle];
}>();

const dialog = ref(false);
const formRef = ref();
const validationError = ref<string | null>(null);

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
  targetTime: getDefaultTargetTimeUtc(),
});

const targetTimeLocal = computed({
  get: () => utcIsoToDatetimeLocal(form.value.targetTime),
  set: (value: string) => {
    form.value.targetTime = datetimeLocalToUtcIso(value);
  },
});

const targetTimePreview = computed(() =>
  formatDateTimeDeDe(form.value.targetTime),
);

const targetSocRule = (value: number) => {
  if (value < form.value.currentSoc) {
    return "Target SoC must be greater than or equal to current SoC";
  }

  return socRule(value);
};

function resetForm() {
  form.value = {
    name: "",
    batteryCapacity: 60,
    currentSoc: 40,
    targetSoc: 80,
    maxChargingPower: 11,
    targetTime: getDefaultTargetTimeUtc(),
  };
  validationError.value = null;
}

async function createVehicle() {
  validationError.value = null;

  const result = await formRef.value?.validate();

  if (!result?.valid) return;

  try {
    validateVehicle(form.value, "Vehicle");
  } catch (error) {
    validationError.value =
      error instanceof Error ? error.message : String(error);
    return;
  }

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
            :rules="[requiredRule, targetSocRule]"
          />

          <v-text-field
            v-model.number="form.maxChargingPower"
            label="Max charging power (kW)"
            type="number"
            :rules="[requiredRule, positiveNumberRule]"
          />

          <v-text-field
            v-model="targetTimeLocal"
            label="Target time"
            type="datetime-local"
            lang="de-DE"
            :hint="targetTimePreview"
            persistent-hint
            :rules="[requiredRule]"
          />

          <v-alert
            v-if="validationError"
            type="error"
            variant="tonal"
            class="mt-4"
            density="compact"
          >
            {{ validationError }}
          </v-alert>
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
