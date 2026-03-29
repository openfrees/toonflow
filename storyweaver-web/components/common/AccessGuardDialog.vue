<template>
  <CommonConfirmDialog
    :visible="state.visible"
    :icon="state.icon"
    :title="state.title"
    :description="state.description"
    :confirm-text="state.confirmText"
    cancel-text="稍后再说"
    confirm-type="primary"
    @update:visible="emit('update:visible', $event)"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  />
</template>

<script setup>
defineProps({
  state: {
    type: Object,
    default: () => ({
      visible: false,
      icon: 'lucide:crown',
      title: '',
      description: '',
      confirmText: '',
    }),
  },
})

const emit = defineEmits(['confirm', 'cancel', 'update:visible'])
</script>
