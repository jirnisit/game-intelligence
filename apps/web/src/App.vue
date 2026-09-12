<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import TeamView from './TeamView.vue';
import type { Text, Character, Detail, Meta, Effect } from './types';
const lang = ref<'th'|'en'>('th');
const t = (th: string, en: string) => lang.value === 'th' ? th : en;
const label = (value?: Text) => value?.[lang.value] || value?.en || value?.th || '—';
const stats: Record<string,string> = {atk:'ATK',def:'DEF',hp:'HP',max_hp:'Max HP',crit_rate:'CRIT Rate',crit_dmg:'CRIT DMG',dmg_bonus:'DMG',elemental_dmg:'Elemental DMG',break_gauge:'Break Gauge',ultimate_gauge:'Ultimate Gauge',rift_gauge:'Rift Gauge',cooldown:'Cooldown',stagger:'Stagger',down:'Down'};
const effectLabel = (type: string) => ({ stat_increase:t('เพิ่มค่าสถานะ','Stat buff'),heal:t('ฟื้น HP','Healing'),damage_taken_increase:t('ศัตรูรับดาเมจเพิ่ม','Enemy damage taken'),break_damage_taken_increase:t('ศัตรูรับดาเมจเกจ Break เพิ่ม','Enemy Break damage taken'),skill_damage_increase:t('เพิ่มดาเมจเฉพาะสกิล','Skill damage bonus'),damage:t('ดาเมจตามเงื่อนไข','Triggered damage'),immunity:t('ป้องกันสถานะ','Immunity'),cooldown_reduction:t('ลดคูลดาวน์','Cooldown reduction'),gauge_recovery:t('ฟื้นเกจ','Gauge recovery') }[type] || type);
const target = (value: string) => ({ self:t('เฉพาะตัวเอง','Self only'),all_allies:t('ทั้งทีม','All allies'),enemy:t('ศัตรู','Enemy'),unknown:t('ยังไม่ทราบ','Unknown') }[value] || value);
const q=ref(''), game=ref(''), element=ref(''), classCode=ref(''), buff=ref(''), recipient=ref(''), hold=ref(false), awakening=ref(0), page=ref(0);
const items=ref<Character[]>([]), total=ref(0), meta=ref<Meta>({games:[],elements:[],classes:[],buffStats:[]});
const loading=ref(false), error=ref(''), detail=ref<Detail|null>(null), detailLoading=ref(false), detailError=ref('');
const route = ref(location.hash);
const isTeams = computed(() => /^#\/teams(?:\/|$)/.test(route.value));
function readHash(){try{return location.hash.startsWith('#/characters/') ? decodeURIComponent(location.hash.slice(13)) : '';}catch{return 'invalid';}}
const selected=ref(readHash());
const visibleElements = computed(()=>meta.value.elements.filter(e=>!game.value||e.game_id===game.value));
const visibleClasses = computed(()=>meta.value.classes.filter(e=>!game.value||e.game_id===game.value));
let listController: AbortController | undefined, detailController: AbortController | undefined, timer: ReturnType<typeof setTimeout>;
async function json(url:string, signal?:AbortSignal) { const r=await fetch(url,{signal}); if(!r.ok) throw new Error(String(r.status)); return r.json(); }
async function loadList() {
  listController?.abort(); const controller = new AbortController(); listController=controller;
  loading.value=true; error.value='';
  const params = new URLSearchParams({awakening:String(awakening.value),limit:'24',offset:String(page.value*24)});
  for(const [key,value] of Object.entries({q:q.value,game:game.value,element:element.value,class:classCode.value,buff:buff.value,target:recipient.value,hold:hold.value?'true':''})) if(value) params.set(key,value);
  try { const result=await json('/api/characters?'+params,controller.signal); if(!controller.signal.aborted){items.value=result.items;total.value=result.total;} }
  catch(e){if(!controller.signal.aborted){items.value=[];error.value=String(e);}}
  finally {if(!controller.signal.aborted) loading.value=false;}
}
async function loadDetail() {
  detailController?.abort(); detail.value=null; detailError.value='';
  if(!selected.value){detailLoading.value=false;return;}
  const controller=new AbortController();detailController=controller;detailLoading.value=true;
  try {const result=await json(`/api/characters/${encodeURIComponent(selected.value)}?awakening=${awakening.value}`,controller.signal);if(!controller.signal.aborted)detail.value=result;}
  catch(e){if(!controller.signal.aborted)detailError.value=String(e);}
  finally {if(!controller.signal.aborted)detailLoading.value=false;}
}
async function loadMeta() {try{meta.value=await json('/api/characters/meta');}catch{error.value='metadata';}}
function reset(){q.value='';game.value='';element.value='';classCode.value='';buff.value='';recipient.value='';hold.value=false;}
function hashChanged(){route.value=location.hash;selected.value=readHash();window.scrollTo({top:0,behavior:'smooth'});}
watch([q,game,element,classCode,buff,recipient,hold,awakening],()=>{page.value=0;clearTimeout(timer);timer=setTimeout(loadList,200);});
watch(game,()=>{element.value='';classCode.value='';});
watch(page,loadList);watch([selected,awakening],loadDetail);
onMounted(()=>{loadMeta();loadList();loadDetail();window.addEventListener('hashchange',hashChanged);});
onUnmounted(()=>{clearTimeout(timer);listController?.abort();detailController?.abort();window.removeEventListener('hashchange',hashChanged);});
const effectGroups = computed(() => {
  const groups = new Map<string, Effect & { entries: Effect[] }>();
  for (const effect of detail.value?.effects || []) {
    // Keep recipients and activation conditions distinct within the same status.
    const key = effect.status_id
      ? JSON.stringify([effect.status_id, effect.target, effect.condition, effect.directly_granted])
      : effect.id;
    const group = groups.get(key);
    if (group) group.entries.push(effect);
    else groups.set(key, { ...effect, entries: [effect] });
  }
  return [...groups.values()];
});
const ruleFor = (effect: Effect) => detail.value?.statuses.find(status => status.id === effect.status_id)?.rule;
function durationFor(effect: Effect) {
  const rule = ruleFor(effect);
  if (rule?.mechanics?.end_when === 'rift_gauge_zero') return t('จน Rift Gauge หมด', 'Until Rift Gauge reaches 0');
  if (rule?.duration_kind === 'timed') return rule.duration_seconds + t(' วินาที', ' seconds');
  if (rule?.duration_kind === 'unlimited') return t('ไม่จำกัดเวลา', 'Unlimited');
  return t('ยังไม่ระบุ', 'Unknown');
}
const formatValue=(e:{value:number|string|null;unit:string|null;per_stack:boolean})=>e.value==null?'—':`${e.value}${e.unit==='percent'||e.unit==='percent_of_stat'?'%':e.unit==='seconds'?'s':''}${e.per_stack?t(' / stack',' / stack'):''}`;
function skillText(text: string) {
  const names = [...new Set((detail.value?.statuses || []).flatMap(s => [s.name.en]).filter((n): n is string => !!n))].sort((a,b)=>b.length-a.length);
  if (!names.length) return [{text, status:false}];
  const escaped=names.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  return text.split(new RegExp('(?<![\\p{L}\\p{N}_])('+escaped.join('|')+')(?![\\p{L}\\p{N}_])','gu')).filter(Boolean).map(part=>({text:part,status:names.includes(part)}));
}
const conditionLabel=(e:Effect)=>{
 const c=e.condition;
 const parts:string[]=[];
 if(c.section_name && e.skill_id)parts.push(label(c.section_name as Text));
 if(c.requires_statuses)parts.push(t('ต้องมี Sun และ Moon เพื่อแปลงสถานะ','Requires Sun and Moon conversion'));
 if(c.requires_status==='rift')parts.push(t('ขณะอยู่ใน Rift’s Power','While in Rift’s Power'));
 if(c.inside_field)parts.push(t('อยู่ภายในสนาม ทุก 1 วินาที','Inside the field, every second'));
 if(c.trigger==='max_stacks_reached')parts.push(t('เมื่อ stack เต็ม แล้วล้างทั้งหมด','At maximum stacks, then clear all'));
 if(c.resource==='darkness')parts.push(t('มี Darkness อย่างน้อย 2 stacks และใช้ทั้งหมด','Have at least 2 Darkness stacks; consume all'));
 if(c.per_resource_consumed)parts.push(t('ต่อ Devotion ที่ใช้ 1 stack','Per Devotion stack consumed'));
 if(c.on_hits)parts.push(t('โจมตีปกติครั้งที่ 2 หรือ 4 โดน','Normal hit 2 or 4 lands'));
 if(c.excludes)parts.push(t('ยกเว้นการโจมตีพิเศษ','Excludes special attacks'));
 return parts.join(' · ');
};
</script>

<template>
  <div class="app-shell">
    <header class="topbar"><a href="#" class="brand"><span class="brand-mark">G<span>i</span></span><span>GAME INTELLIGENCE<small>{{t('คลังข้อมูลและความสามารถตัวละคร','CHARACTER KNOWLEDGE BASE')}}</small></span></a><button class="lang-button" @click="lang=lang==='th'?'en':'th'" :aria-label="t('เปลี่ยนภาษาเป็นอังกฤษ','Switch language to Thai')">{{lang==='th'?'EN / ไทย':'TH / English'}}</button></header>
    <nav class="section-nav" aria-label="Main"><a href="#" :aria-current="!isTeams ? 'page' : undefined">{{t('ตัวละคร','Characters')}}</a><a href="#/teams" :aria-current="isTeams ? 'page' : undefined">{{t('ทีม','Teams')}}</a></nav>
    <main>
      <TeamView v-if="isTeams" :lang="lang" :route="route" />
      <template v-else>
      <div class="page-heading"><div><p class="eyebrow">BREAKER ARCHIVE / 01</p><h1>{{selected?t('รายละเอียดตัวละคร','Character details'):t('ค้นหาตัวละครที่ใช่','Find your next teammate')}}</h1><p class="subtitle">{{t('สำรวจสกิล บัฟ และเงื่อนไขการทำงาน ก่อนวางทีมของคุณ','Explore skills, buffs and their conditions before building your team.')}}</p></div><label class="awakening-label">{{t('ระดับ Awakening ที่ใช้ดูผล','View effects at awakening')}}<select v-model.number="awakening" aria-label="Awakening"><option v-for="level in 6" :key="level" :value="level-1">Awakening {{level-1}}</option></select></label></div>
      <template v-if="!selected">
        <section class="filters" :aria-label="t('ตัวกรองตัวละคร','Character filters')">
          <label class="search-field">{{t('ค้นหาชื่อ','Search name')}}<input v-model="q" type="search" :placeholder="t('เช่น Mei, เฮเลน…','Mei, Helen…')" /></label>
          <label>{{t('เกม','Game')}}<select v-model="game"><option value="">{{t('ทุกเกม','All games')}}</option><option v-for="g in meta.games" :key="g.id" :value="g.id">{{label(g.name)}}</option></select></label>
          <label>{{t('ธาตุ','Element')}}<select v-model="element"><option value="">{{t('ทุกธาตุ','All elements')}}</option><option v-for="e in visibleElements" :key="e.game_id+e.code" :value="e.code">{{label(e.name)}}</option></select></label>
          <label>{{t('คลาส','Class')}}<select v-model="classCode"><option value="">{{t('ทุกคลาส','All classes')}}</option><option v-for="c in visibleClasses" :key="c.game_id+c.code" :value="c.code">{{label(c.name)}}</option></select></label>
          <label>{{t('บัฟที่เพิ่ม','Stat buff')}}<select v-model="buff" :aria-label="t('บัฟที่เพิ่ม','Stat buff')" data-testid="buff-filter"><option value="">{{t('ทุกบัฟ','Any buff')}}</option><option v-for="s in meta.buffStats" :key="s" :value="s">{{stats[s]||s}}</option></select></label>
          <label>{{t('ผู้รับบัฟ','Buff recipient')}}<select v-model="recipient" :aria-label="t('ผู้รับบัฟ','Buff recipient')" data-testid="target-filter"><option value="">{{t('ทั้งหมด','Any recipient')}}</option><option value="self">{{t('เฉพาะตัวเอง','Self only')}}</option><option value="all_allies">{{t('แจกทั้งทีม','All allies')}}</option></select></label>
          <div class="filter-footer"><label class="checkbox"><input v-model="hold" type="checkbox" />{{t('มีท่าที่ต้องกดค้าง','Has a hold action')}}</label><button class="text-button" @click="reset">{{t('ล้างตัวกรอง','Reset filters')}}</button></div>
        </section>
        <div class="results-heading"><h2>{{t('ตัวละคร','Characters')}} <span>{{loading?'…':total}}</span></h2><p>{{t('บัฟที่มีวิธีได้รับยืนยันแล้ว • ยังต้องทำตามเงื่อนไขสกิล','Documented buff sources • Skill conditions still apply')}}</p></div>
        <div v-if="error" role="alert" class="state-panel"><h2>{{t('ยังโหลดข้อมูลไม่ได้','Unable to load characters')}}</h2><p>{{t('ลองอีกครั้งเมื่อระบบข้อมูลพร้อม','Please try again when the data service is available.')}}</p><button @click="loadMeta();loadList()">{{t('ลองใหม่','Retry')}}</button></div>
        <div v-else-if="loading" role="status" class="state-panel">{{t('กำลังค้นหาตัวละคร…','Loading characters…')}}</div>
        <div v-else-if="!items.length" class="state-panel"><h2>{{t('ไม่พบตัวละครตามเงื่อนไข','No matching characters')}}</h2><p>{{t('ลองเปลี่ยนบัฟหรือผู้รับบัฟ หากยังไม่มีข้อมูล ให้เพิ่มข้อมูลตัวละครก่อน','Try another buff or recipient. If the archive is empty, add character data first.')}}</p><button @click="reset">{{t('ล้างตัวกรอง','Reset filters')}}</button></div>
        <section v-else class="character-grid">
          <a v-for="c in items" :key="c.id" :href="`#/characters/${encodeURIComponent(c.id)}`" class="character-card" :data-testid="`character-${c.id}`">
            <div class="card-top"><span class="element-pill" :class="c.element_code">{{label(c.element_name)}}</span><span class="rarity">{{c.rarity}}</span></div>
            <div class="character-monogram" :class="c.element_code">{{c.name.en?.slice(0,1)}}<span>BREAKER</span></div>
            <div class="card-title"><h3>{{label(c.name)}}</h3><span>↗</span></div><p class="class-line">{{label(c.class_name)}} · {{label(c.race)}}</p>
            <div class="buff-list"><span v-for="b in c.buffs" :key="b.id" class="buff-chip">{{stats[b.stat_code]}} +{{formatValue(b)}} <small>{{target(b.target)}}</small></span><span v-if="!c.buffs.length" class="muted">{{t('ยังไม่มีบัฟค่าสถานะที่ยืนยัน','No documented stat buffs')}}</span></div>
            <div class="card-bottom"><span>{{c.has_hold?t('มีท่ากดค้าง','Hold action'):t('ดูสกิลและเงื่อนไข','Skills & conditions')}}</span><span>{{t('ดูรายละเอียด','View details')}} →</span></div>
          </a>
        </section>
        <nav v-if="total>24" class="pagination"><button :disabled="page===0" @click="page--">{{t('ก่อนหน้า','Previous')}}</button><span>{{page+1}}</span><button :disabled="(page+1)*24>=total" @click="page++">{{t('ถัดไป','Next')}}</button></nav>
        <p class="archive-note">{{t('ตัวกรองบัฟแยกจากการฟื้น HP และการเพิ่มดาเมจเฉพาะสกิล ส่วนบัฟที่ต้องผสมสถานะแสดงในหน้ารายละเอียด','Stat buffs are separate from healing and skill damage bonuses. Conversion-dependent buffs appear in character details.')}}</p>
      </template>
      <template v-else>
        <a href="#" class="back-link">← {{t('กลับไปตัวละครทั้งหมด','Back to characters')}}</a>
        <div v-if="detailLoading" role="status" class="state-panel">{{t('กำลังโหลดรายละเอียด…','Loading character…')}}</div>
        <div v-else-if="detailError" role="alert" class="state-panel"><h2>{{detailError.includes('404')?t('ไม่พบตัวละครนี้','Character not found'):t('โหลดรายละเอียดไม่ได้','Unable to load details')}}</h2><button @click="loadDetail">{{t('ลองใหม่','Retry')}}</button></div>
        <article v-else-if="detail" class="detail-layout">
          <aside class="profile-panel"><div class="character-monogram" :class="detail.element_code">{{detail.name.en?.slice(0,1)}}<span>BREAKER / {{detail.rarity}}</span></div><h2>{{label(detail.name)}}</h2><p>{{detail.name.en}}</p><div class="profile-tags"><span>{{label(detail.element_name)}}</span><span>{{label(detail.class_name)}}</span><span>{{label(detail.race)}}</span></div><p class="note">{{t('ค่าผลสกิลที่แสดงใช้ Awakening','Effects shown for Awakening')}} {{awakening}}</p><p class="note">{{label(detail.notes)}}</p></aside>
          <div class="detail-main">
            <section class="detail-section"><h2>{{t('บัฟและผลต่อการต่อสู้','Buffs & combat effects')}}</h2><p class="subtitle">{{t('แยกผู้รับ ผลเฉพาะท่า และผลที่ต้องอาศัยสถานะอื่น','Recipients, skill-specific bonuses and conditional effects are shown separately.')}}</p>
              <div class="effect-grid"><div v-for="e in effectGroups" :key="e.id" class="effect-card"><div class="effect-top"><span>{{[...new Set(e.entries.map(entry => effectLabel(entry.effect_type)))].join(' · ')}}</span><span class="target-badge">{{target(e.target)}}</span></div><h3>{{label(e.status_name||e.skill_name)}}</h3><div v-for="entry in e.entries" :key="entry.id" class="effect-value"><strong>{{formatValue(entry)}}</strong><p>{{stats[entry.stat_code]||t('ดาเมจ','Damage')}}<template v-if="entry.element_code"> · {{entry.element_code}}</template><template v-if="entry.scaling_stat"> · {{t('อิง','Based on')}} {{stats[entry.scaling_stat]}} ({{entry.scaling_character_id}})</template></p></div><div v-if="e.status_id" class="buff-rules" data-testid="buff-rules"><dl><div><dt>{{t('ระยะเวลา','Duration')}}</dt><dd>{{durationFor(e)}}</dd></div><div><dt>Max Stack</dt><dd>{{ruleFor(e)?.max_stacks ?? t('ยังไม่ระบุ','Unknown')}}</dd></div></dl><p v-if="ruleFor(e)?.refresh_on_stack === true">{{t('ได้ stack เพิ่ม → รีเซ็ตระยะเวลา','Additional stacks refresh duration')}}</p><p v-else-if="ruleFor(e)?.duration_kind === 'timed' && ruleFor(e)?.refresh_on_stack === false">{{t('ได้ stack เพิ่ม → ไม่รีเซ็ตเวลา','Additional stacks do not refresh duration')}}</p><p v-else-if="ruleFor(e)?.duration_kind === 'timed'">{{t('การรีเซ็ตเวลายังไม่ระบุ','Duration refresh unknown')}}</p><p v-if="ruleFor(e)?.mechanics?.clear_all_stacks">{{t('เมื่อ stack เต็ม: ทำดาเมจแล้วล้าง stack ทั้งหมด','At maximum stacks: deal damage and clear all stacks')}}</p></div><p v-if="!e.directly_granted" class="conditional">{{e.required_statuses.length?t('เกิดจากการผสมสถานะ','Created by combining statuses'):t('ยังไม่มีวิธีได้รับโดยตรงที่ยืนยัน','No documented direct grant')}}</p><p v-if="conditionLabel(e)" class="condition-text">{{conditionLabel(e)}}</p><div v-if="e.required_statuses.length" class="status-providers"><div v-for="required in e.required_statuses" :key="required.code"><b>{{required.code}}</b><p v-if="!required.providers.length">{{t('ยังไม่มีข้อมูลผู้ให้สถานะนี้','No documented provider yet')}}</p><div v-for="(provider,i) in required.providers" :key="provider.character_id+i" class="provider"><a :href="`#/characters/${encodeURIComponent(provider.character_id)}`">{{label(provider.character_name)}} ↗</a><span>{{target(provider.target)}}<template v-if="provider.stacks!==null"> · {{provider.stacks}} stacks</template></span><p>{{label(provider.description)}}</p></div></div><p class="conversion-note">{{t('ใช้ Sun และ Moon อย่างละ 1 stack บนผู้รับคนเดียวกัน จึงเกิด Lunar Eclipse; สถานะเฉพาะตัวเองไม่ได้แจกให้เพื่อน','Consumes 1 Sun and 1 Moon on the same recipient to create Lunar Eclipse. Self-only statuses are not shared with allies.')}}</p></div><details v-if="e.applications.length"><summary>{{t('วิธีได้รับและเงื่อนไข','How to obtain')}}</summary><p v-for="(a,i) in e.applications" :key="i"><b>{{label(a.name)}}</b> — {{label(a.description)}}</p></details></div></div>
            </section>
            <section class="detail-section"><h2>{{t('สกิลหลัก','Skills')}} <span class="count">{{detail.skills.length}} / 6</span></h2><div class="skill-list"><section v-for="skill in detail.skills" :key="skill.id" class="skill-card"><h3>{{label(skill.name)}}</h3><div class="action"><div class="action-heading"><span v-if="skill.has_hold" class="hold-badge" data-testid="hold-badge">{{t('มีการกดค้าง','HOLD')}}</span><span v-if="skill.cooldown_seconds!==null" class="muted">{{skill.cooldown_seconds}}s CD</span></div><p class="skill-description"><template v-for="(part,i) in skillText(label(skill.description))" :key="i"><mark v-if="part.status">{{part.text}}</mark><template v-else>{{part.text}}</template></template></p></div></section></div></section>
            <section class="detail-section"><h2>Awakening</h2><div class="awakening-grid"><div v-for="a in detail.awakenings" :key="a.level" class="awakening-card" :class="{locked:!a.unlocked}"><span class="eyebrow">A{{a.level}} · {{a.unlocked?t('ปลดล็อกตามขั้นที่เลือก','ACTIVE'):t('ยังไม่ถึงขั้นที่เลือก','LOCKED')}}</span><h3>{{label(a.name)}}</h3><p>{{label(a.description)}}</p></div></div></section>
            <section class="detail-section"><h2>{{t('สถานะและระยะเวลา','Statuses & duration')}}</h2><div class="status-list"><div v-for="s in detail.statuses" :key="s.id"><strong>{{label(s.name)}}</strong><span>{{s.rule?.max_stacks?`${s.rule.max_stacks} stacks`:t('จำนวน stack ยังไม่ระบุ','Stack cap unknown')}}</span><span>{{s.rule?.duration_kind==='timed'?`${s.rule.duration_seconds}s`:s.rule?.duration_kind==='unlimited'?t('ไม่จำกัดเวลา','Unlimited'):t('ระยะเวลายังไม่ระบุ','Duration unknown')}}</span><small v-if="s.completeness==='partial'">{{t('ข้อมูลยังไม่ครบ','Partial data')}}</small></div></div></section>

          </div>
        </article>
      </template>
      </template>
    </main><footer>GAME INTELLIGENCE <span>{{t('อ่านเงื่อนไขก่อนจัดทีมเสมอ','Every effect has a context.')}}</span></footer>
  </div>
</template>
