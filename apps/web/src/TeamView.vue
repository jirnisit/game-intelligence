<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import type { Text } from './types';
type Team = { id: string; name: Text; description: Text; game_name: Text; characters: {id: string; name: Text}[] };
const props = defineProps<{lang: 'th'|'en'; route: string}>();
const t = (th: string,en: string) => props.lang === 'th' ? th : en;
const label = (value: Text) => value[props.lang] || value.en || value.th || '';
const id = computed(() => {try {return decodeURIComponent(props.route.slice('#/teams'.length).replace(/^\//,''));} catch {return 'invalid';}});
const items=ref<Team[]>([]), team=ref<Team|null>(null), loading=ref(false), error=ref(''), page=ref(0), total=ref(0);
let controller: AbortController | undefined;
async function load() {
  controller?.abort(); const current=new AbortController(); controller=current;
  loading.value=true;error.value='';team.value=null;items.value=[];
  try {
    const response=await fetch(id.value ? `/api/teams/${encodeURIComponent(id.value)}` : `/api/teams?limit=24&offset=${page.value*24}`,{signal:current.signal});
    if(!response.ok)throw new Error(String(response.status));
    const data=await response.json();
    if(current.signal.aborted)return;
    if(id.value)team.value=data;else {items.value=data.items;total.value=data.total;}
  } catch(e) {if(!current.signal.aborted)error.value=String(e);}
  finally {if(!current.signal.aborted)loading.value=false;}
}
watch(id,()=>{page.value=0;load();},{immediate:true});
watch(page,load);
onUnmounted(()=>controller?.abort());
</script>
<template>
  <div class="page-heading"><div><p class="eyebrow">TEAM ARCHIVE / 02</p><h1>{{t('ทีมและลำดับการเล่น','Teams & rotations')}}</h1><p class="subtitle">{{t('สมาชิกทีมและโน้ตการเล่นของคุณ','Your team members and play notes')}}</p></div></div>
  <a v-if="id" href="#/teams" class="back-link">← {{t('กลับไปรายการทีม','Back to teams')}}</a>
  <div v-if="loading" role="status" class="state-panel">{{t('กำลังโหลดทีม…','Loading teams…')}}</div>
  <div v-else-if="error" role="alert" class="state-panel"><h2>{{error.includes('404')?t('ไม่พบทีมนี้','Team not found'):t('โหลดทีมไม่ได้','Unable to load teams')}}</h2><button @click="load">{{t('ลองใหม่','Retry')}}</button></div>
  <article v-else-if="team" class="team-detail effect-card">
    <p class="eyebrow">{{label(team.game_name)}}</p><h2>{{label(team.name)}}</h2>
    <div class="team-members"><a v-for="member in team.characters" :key="member.id" :href="`#/characters/${encodeURIComponent(member.id)}`">{{label(member.name)}} ↗</a></div>
    <h3>{{t('รายละเอียดและลำดับการเล่น','Details & rotation')}}</h3>
    <p class="team-description">{{label(team.description) || t('ยังไม่มีรายละเอียด','No details yet')}}</p>
  </article>
  <template v-else>
    <div v-if="!items.length" class="state-panel">{{t('ยังไม่มีทีม','No teams yet')}}</div>
    <section v-else class="character-grid">
      <article v-for="item in items" :key="item.id" class="team-card effect-card">
        <p class="eyebrow">{{label(item.game_name)}}</p>
        <h2><a :href="`#/teams/${encodeURIComponent(item.id)}`">{{label(item.name)}} →</a></h2>
        <div class="team-members"><a v-for="member in item.characters" :key="member.id" :href="`#/characters/${encodeURIComponent(member.id)}`">{{label(member.name)}} ↗</a></div>
        <p class="team-preview">{{label(item.description)}}</p>
        <a class="back-link" :href="`#/teams/${encodeURIComponent(item.id)}`">{{t('ดูรายละเอียด','View details')}} →</a>
      </article>
    </section>
    <nav v-if="total>24" class="pagination"><button :disabled="page===0" @click="page--">{{t('ก่อนหน้า','Previous')}}</button><span>{{page+1}}</span><button :disabled="(page+1)*24>=total" @click="page++">{{t('ถัดไป','Next')}}</button></nav>
  </template>
</template>
