<script setup lang="ts">
import { onMounted, ref } from 'vue';
const status = ref<'loading' | 'ready' | 'error'>('loading');
async function checkConnection() {
  status.value = 'loading';
  try {
    const response = await fetch('/api/health', { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Service unavailable');
    const health = await response.json();
    status.value = health.status === 'ok' ? 'ready' : 'error';
  } catch { status.value = 'error'; }
}
onMounted(checkConnection);
</script>

<template>
  <main class="min-h-screen bg-slate-950 px-6 py-20 text-slate-100">
    <section class="mx-auto max-w-3xl">
      <p class="text-sm font-semibold tracking-widest text-teal-400">LIMIT ZERO BREAKERS</p>
      <h1 class="mt-4 text-4xl font-bold sm:text-6xl">Game Intelligence</h1>
      <p class="mt-6 text-lg leading-relaxed text-slate-400">พื้นที่สำหรับรวบรวมข้อมูลตัวละคร สกิล และวิเคราะห์ทีม</p>
      <div class="mt-12 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 class="text-xl font-semibold">เริ่มต้นโปรเจกต์</h2>
        <p class="mt-3 text-slate-400">โครงระบบพร้อมสำหรับพัฒนาฐานข้อมูลเกมและเครื่องมือวิเคราะห์ต่อไป</p>
        <p role="status" class="mt-6" :class="status === 'ready' ? 'text-teal-400' : 'text-amber-300'">
          {{ status === 'loading' ? 'กำลังตรวจสอบการเชื่อมต่อ…' : status === 'ready' ? 'เชื่อมต่อระบบและฐานข้อมูลแล้ว' : 'ยังเชื่อมต่อระบบไม่ได้' }}
        </p>
        <button class="mt-4 rounded-lg bg-slate-800 px-4 py-2 hover:bg-slate-700 disabled:opacity-50" :disabled="status === 'loading'" @click="checkConnection">ตรวจสอบอีกครั้ง</button>
      </div>
    </section>
  </main>
</template>
