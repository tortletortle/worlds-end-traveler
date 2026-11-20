/*
 * Alvira population ecology model V0.3
 * Deterministic seeded demographic, territory, food-web and succession model.
 * Time unit: one simulated ecology day = 300 seconds of game simulation.
 * Stylized game-world model; parameters are tuned for playable ecosystem dynamics,
 * not intended as real-world wildlife forecasts.
 */
(function(root){
'use strict';
const SPECIES={
 deer:{name:'苔角鹿',maturity:18,maxAge:1500,gestation:22,litter:[1,1],breed:[2],cooldown:92,fertility:.075,mortality:.00022,maxPop:20},
 fox:{name:'雾尾狐',maturity:12,maxAge:1050,gestation:6,litter:[2,3],breed:[3],cooldown:58,fertility:.11,mortality:.00014,maxPop:9},
 rabbit:{name:'林地兔',maturity:6,maxAge:300,gestation:4,litter:[2,4],breed:[0,1],cooldown:20,fertility:.19,mortality:.00105,maxPop:34},
 bird:{name:'雾翎鸟',maturity:5,maxAge:560,gestation:3,litter:[2,3],breed:[0],cooldown:36,fertility:.13,mortality:.00078,maxPop:34}
};
const SEASONS=[
 {id:'spring',name:'春',growth:1.30,food:{grass:1.30,berries:1.08,seeds:.78}},
 {id:'summer',name:'夏',growth:1.12,food:{grass:1.02,berries:1.34,seeds:1.00}},
 {id:'autumn',name:'秋',growth:.78,food:{grass:.82,berries:.90,seeds:1.42}},
 {id:'winter',name:'冬',growth:.32,food:{grass:.38,berries:.32,seeds:.62}}
];
const STAGES=['先锋地被','草地','灌丛','幼林','成熟森林'];
const HABITAT_NEIGHBORS={meadow:['edge','grove','mother'],edge:['meadow','ruin','cave'],ruin:['edge','grove','cave'],grove:['meadow','ruin','mother'],mother:['grove','cave'],cave:['edge','ruin','mother']};
function habitatConnected(a,b){return a===b||(HABITAT_NEIGHBORS[a]||[]).includes(b);}
const CAP={
 meadow:{deer:5,fox:1,rabbit:7,bird:8},edge:{deer:4,fox:2,rabbit:7,bird:4},
 ruin:{deer:2,fox:2,rabbit:6,bird:6},grove:{deer:3,fox:1,rabbit:3,bird:10},
 mother:{deer:4,fox:1,rabbit:3,bird:10},cave:{deer:0,fox:3,rabbit:3,bird:0}
};
const DEFAULT_HABITATS=[
 {id:'meadow',name:'鹿踪草甸',stage:1,biomass:.78,soil:.82,x:9,z:49,species:['deer','rabbit','bird']},
 {id:'edge',name:'林缘草地',stage:2,biomass:.72,soil:.76,x:-76,z:62,species:['deer','rabbit','fox']},
 {id:'ruin',name:'断城苔地',stage:0,biomass:.36,soil:.62,x:-64,z:-57,species:['fox','rabbit','bird']},
 {id:'grove',name:'低语林庭',stage:4,biomass:.96,soil:.94,x:1,z:-68,species:['bird','deer']},
 {id:'mother',name:'母树根圃',stage:4,biomass:.98,soil:.96,x:58,z:-52,species:['deer','bird','fox']},
 {id:'cave',name:'根脉洞口',stage:3,biomass:.56,soil:.68,x:42,z:23,species:['fox','rabbit']}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function stageFor(species,age){const s=SPECIES[species];if(age<5)return '幼崽';if(age<s.maturity*1.1)return '幼年';if(age<s.maturity*2)return '亚成年';if(age<s.maxAge*.78)return '成年';return '老年';}
function seasonAt(day){return SEASONS[Math.floor(((day%120)+120)%120/30)];}
function nearestHabitatId(species,a,defs){let best=null,dmin=Infinity;for(const h of defs){if(!(h.species||[]).includes(species))continue;const d=Math.hypot((a.x||0)-h.x,(a.z||0)-h.z);if(d<dmin){dmin=d;best=h.id;}}return best||'meadow';}
function createState(seed,visualAnimals=[],habitatDefs=null){
 const rng=mulberry32(seed>>>0),defs=habitatDefs||DEFAULT_HABITATS;
 const habitats=defs.map(h=>{const base=DEFAULT_HABITATS.find(v=>v.id===h.id)||{};const biomass=h.biomass??base.biomass??.7;return {id:h.id,name:h.name,stage:typeof h.stage==='number'?h.stage:(base.stage??(h.id==='ruin'?0:2)),stageDays:0,biomass,soil:h.soil??base.soil??.7,seedBank:.55,disturbance:0,cover:biomass};});
 const speciesIndex={deer:0,fox:0,rabbit:0,bird:0},individuals=[];let nextId=visualAnimals.length+1;
 for(const a of visualAnimals){const s=SPECIES[a.species];if(!s)continue;const i=speciesIndex[a.species]++;let age;
   if(visualAnimals.filter(v=>v.species===a.species).length<=2)age=s.maturity+5+rng()*s.maxAge*.12;
   else if(i===0)age=rng()*Math.max(2,s.maturity*.32);
   else if(i===1)age=s.maturity*1.18+rng()*s.maturity*.48;
   else if(i%10===9)age=s.maxAge*.80+rng()*s.maxAge*.1;
   else age=s.maturity+rng()*s.maxAge*.22;
   const record={id:a.id||`wild-${nextId++}`,species:a.species,sex:i%2===0?'female':'male',ageDays:Math.round(age*10)/10,alive:true,condition:.74+rng()*.2,gestationDays:0,pregnancyLitter:0,cooldownDays:rng()*14,habitatId:nearestHabitatId(a.species,a,defs),territoryId:null,dispersingDays:0,starvationDays:0,deathCause:null,bornDay:0};
   record.territoryId=record.habitatId;a.population=record;a.sex=record.sex;a.ageDays=record.ageDays;a.lifeStage=stageFor(a.species,age);individuals.push(record);
 }
 const counts={deer:0,fox:0,rabbit:0,bird:0};for(const p of individuals)counts[p.species]++;
 return {seed:seed>>>0,rng,day:0,nextId,individuals,habitats,season:'spring',stats:{births:0,deaths:0,predations:0,territoryConflicts:0,dispersals:0,seasonChanges:0,successionChanges:0,starvationDeaths:0},events:[],counts,initialCounts:counts,extinctions:[],foodIndex:.82,conflictCooldowns:{},lastPredationEventDay:-999};
}
function pushEvent(state,type,title,description){const ev={day:state.day,type,title,description};state.events.unshift(ev);if(state.events.length>100)state.events.length=100;return ev;}
function countBySpecies(state){const out={deer:0,fox:0,rabbit:0,bird:0};for(const p of state.individuals)if(p.alive)out[p.species]++;return out;}
function ageStructure(state){const out={};for(const k of Object.keys(SPECIES))out[k]={幼崽:0,幼年:0,亚成年:0,成年:0,老年:0};for(const p of state.individuals)if(p.alive)out[p.species][stageFor(p.species,p.ageDays)]++;return out;}
function litterSize(s,rng){return s.litter[0]+Math.floor(rng()*(s.litter[1]-s.litter[0]+1));}
function chooseHabitat(state,species,preferred){const candidates=state.habitats.filter(h=>(CAP[h.id]||{})[species]>0);if(!candidates.length)return preferred||'meadow';let best=candidates[0],scoreBest=Infinity;for(const h of candidates){const n=state.individuals.filter(p=>p.alive&&p.species===species&&p.habitatId===h.id).length;const cap=CAP[h.id][species];const score=n/cap+(h.id===preferred?.15:0)+(1-h.biomass)*.1;if(score<scoreBest){scoreBest=score;best=h;}}return best.id;}
function resolveTerritories(state){
 const incidents=[],dispersals=[];
 for(const h of state.habitats){for(const species of Object.keys(SPECIES)){
   const cap=(CAP[h.id]||{})[species]||0;if(!cap)continue;
   const group=state.individuals.filter(p=>p.alive&&p.species===species&&p.habitatId===h.id);
   if(group.length>cap){group.sort((a,b)=>a.condition-b.condition);const loser=group[0],next=chooseHabitat(state,species,h.id);if(next!==h.id){const from=h.id;loser.habitatId=next;loser.territoryId=next;loser.dispersingDays=4;state.stats.dispersals++;dispersals.push({id:loser.id,from,to:next});}else loser.condition=Math.max(.05,loser.condition-.025);
     const key=`${h.id}:${species}`;if(state.day-(state.conflictCooldowns[key]??-999)>=12){state.conflictCooldowns[key]=state.day;incidents.push({species,habitat:h.id});}
   }
 }}
 // Same-sex adult foxes in one den compete for dominance; weaker individuals disperse.
 for(const h of state.habitats){const males=state.individuals.filter(p=>p.alive&&p.species==='fox'&&p.sex==='male'&&p.ageDays>=SPECIES.fox.maturity&&p.habitatId===h.id);if(males.length>1){males.sort((a,b)=>b.condition-a.condition);const loser=males[males.length-1],next=chooseHabitat(state,'fox',h.id);if(next!==h.id){const from=h.id;loser.habitatId=next;loser.territoryId=next;loser.dispersingDays=5;state.stats.dispersals++;dispersals.push({id:loser.id,from,to:next});}loser.condition=Math.max(.05,loser.condition-.02);const key=`fox-dominance:${h.id}`;if(state.day-(state.conflictCooldowns[key]??-999)>=12){state.conflictCooldowns[key]=state.day;incidents.push({species:'fox',habitat:h.id});}}}
 if(incidents.length){state.stats.territoryConflicts+=incidents.length;pushEvent(state,'territory_conflict','领地竞争','食物与栖息空间出现局部压力，弱势个体正在扩散寻找新的活动范围。');}
 return {incidents,dispersals};
}
function updateVegetation(state,counts,season){
 const changes=[];
 for(const h of state.habitats){
   const local=state.individuals.filter(p=>p.alive&&p.habitatId===h.id&&p.species!=='fox').length;
   const localCap=Object.entries(CAP[h.id]||{}).filter(([k])=>k!=='fox').reduce((n,[,v])=>n+v,0)||1;
   const grazing=local/localCap;
   const seasonal=(season.growth-.72)*.006;
   const soilRecovery=(h.soil-.5)*.0015;
   const grazingCost=Math.max(0,grazing-.8)*.004;
   h.biomass=clamp(h.biomass+seasonal+soilRecovery-grazingCost,.04,1);
   h.cover=clamp(h.biomass*(.58+h.soil*.42),.02,1);
   h.seedBank=clamp(h.seedBank+(season.id==='autumn'?.018:season.id==='spring'?.006:-.003)-grazing*.001,.02,1);
   h.stageDays++;
   if(h.biomass<.08){if(h.stage!==0){h.stage=0;h.stageDays=0;h.soil=Math.max(.2,h.soil-.02);h.disturbance=25;changes.push({habitat:h.id,stage:STAGES[0],reset:true});}}
   else if(h.disturbance>0)h.disturbance--;
   else {const thresholds=[30,90,150,240];if(h.stage<4&&h.stageDays>=thresholds[h.stage]&&h.biomass>.32&&h.soil>.38){h.stage++;h.stageDays=0;changes.push({habitat:h.id,stage:STAGES[h.stage],reset:false});state.stats.successionChanges++;}}
 }
 if(changes.length)for(const c of changes)pushEvent(state,'succession',c.reset?'植被受到扰动':'栖息地演替',`${state.habitats.find(h=>h.id===c.habitat)?.name||c.habitat}${c.reset?'退化为先锋地被，正在恢复。':`逐渐演替为${c.stage}。`}`);
 return changes;
}
function dailyPredation(state,counts,multiplier=1){
 const kills=[];const foxes=state.individuals.filter(p=>p.alive&&p.species==='fox'&&p.ageDays>=SPECIES.fox.maturity);
 for(const fox of foxes){const rabbits=state.individuals.filter(p=>p.alive&&p.species==='rabbit'&&habitatConnected(fox.habitatId,p.habitatId));if(!rabbits.length)continue;const localFoxes=foxes.filter(f=>habitatConnected(fox.habitatId,f.habitatId));const ratio=rabbits.length/Math.max(1,localFoxes.length);const chance=.0028*clamp(multiplier,.2,8)*clamp(ratio,.35,2.2);if(state.rng()<chance){rabbits.sort((a,b)=>a.condition-b.condition);const prey=rabbits[0];prey.alive=false;prey.deathCause='predation';state.stats.deaths++;state.stats.predations++;fox.condition=clamp(fox.condition+.12,0,1);kills.push({prey:prey.id,predator:fox.id});}}
 if(kills.length&&state.day-state.lastPredationEventDay>=3){state.lastPredationEventDay=state.day;pushEvent(state,'predation','林间捕食','雾尾狐捕获了林地兔。捕食压力正在影响猎物数量与捕食者状态。');}
 return kills;
}
function stepDay(state,env={}){
 const previousSeason=state.season;state.day++;const season=seasonAt(state.day);state.season=season.id;
 if(previousSeason!==season.id){state.stats.seasonChanges++;pushEvent(state,'season_change','季节更替',`雾隐树海进入${season.name}季，植物生长、食物供给和动物活动节律发生变化。`);}
 const foodIndex=clamp(env.foodIndex===undefined?state.foodIndex:env.foodIndex,.05,1);state.foodIndex=foodIndex;
 const before=countBySpecies(state);const vegetationChanges=updateVegetation(state,before,season);const predationKills=dailyPredation(state,before,env.predationMultiplier??1);
 const births=[],deaths=[];
 // Individual ageing, condition, gestation and mortality.
 for(const p of state.individuals.slice()){if(!p.alive)continue;const s=SPECIES[p.species];p.ageDays+=1;if(p.cooldownDays>0)p.cooldownDays--;if(p.dispersingDays>0)p.dispersingDays--;
   const local=state.habitats.find(h=>h.id===p.habitatId);const localFood=local?.biomass??foodIndex;let support=foodIndex*.65+localFood*.35;
   const currentCounts=countBySpecies(state),preyRatio=currentCounts.rabbit/Math.max(1,currentCounts.fox);
   if(p.species==='fox')support=clamp(.30+preyRatio*.16,.18,.88);
   p.condition=clamp(p.condition+(support-.53)*.012-(p.ageDays>s.maxAge*.78?.0012:0),.02,1);
   const lifeStage=stageFor(p.species,p.ageDays);let mortality=s.mortality;if(lifeStage==='幼崽'||lifeStage==='幼年')mortality*=2.0;if(lifeStage==='老年')mortality*=3.0;
   if(p.condition<.35){p.starvationDays++;mortality+=.0025+(0.35-p.condition)*.012;}else p.starvationDays=Math.max(0,p.starvationDays-1);
   if(p.ageDays>s.maxAge)mortality+=.018;
   if(p.species==='fox'&&preyRatio<.8)mortality+=.0025;
   if(state.rng()<clamp(mortality,0,.25)){p.alive=false;p.deathCause=p.starvationDays>5?'starvation':lifeStage==='老年'?'old_age':'natural';deaths.push(p);state.stats.deaths++;if(p.deathCause==='starvation')state.stats.starvationDeaths++;}
   if(p.gestationDays>0){p.gestationDays--;if(p.gestationDays===0&&p.alive){const sCount=countBySpecies(state)[p.species],effectiveCap=Math.max(2,Math.floor(s.maxPop*(.48+.52*foodIndex))),room=Math.max(0,Math.min(s.maxPop,effectiveCap)-sCount);const n=Math.min(p.pregnancyLitter||1,room);for(let i=0;i<n;i++){const child={id:`wild-${String(state.nextId++).padStart(5,'0')}`,species:p.species,sex:state.rng()<.5?'female':'male',ageDays:0,alive:true,condition:.74+state.rng()*.15,gestationDays:0,pregnancyLitter:0,cooldownDays:s.cooldown*.55,habitatId:p.habitatId,territoryId:p.habitatId,dispersingDays:0,starvationDays:0,deathCause:null,bornDay:state.day,parentId:p.id};births.push(child);state.individuals.push(child);state.stats.births++;}if(n>0)pushEvent(state,'birth','新生命诞生',`${s.name}在${local?.name||'林地'}诞下${n}只幼崽。`);else pushEvent(state,'reproduction_limited','繁殖受限',`${s.name}的幼崽数量受到食物与栖息地容量限制。`);p.pregnancyLitter=0;}}
 }
 // Breeding: season, maturity, condition, mate availability and carrying capacity all matter.
 for(const p of state.individuals){if(!p.alive||p.sex!=='female')continue;const s=SPECIES[p.species];if(p.ageDays<s.maturity||p.ageDays>s.maxAge*.78||p.gestationDays>0||p.cooldownDays>0||!s.breed.includes(Math.floor((state.day%120)/30)))continue;if(p.condition<.48)continue;
   const hasMate=state.individuals.some(q=>q.alive&&q.species===p.species&&q.sex==='male'&&q.ageDays>=s.maturity&&habitatConnected(p.habitatId,q.habitatId));if(!hasMate)continue;
   const countsNow=countBySpecies(state),effectiveCap=Math.max(2,Math.floor(s.maxPop*(.48+.52*foodIndex)));if(countsNow[p.species]>=effectiveCap)continue;
   if(state.rng()<s.fertility){p.gestationDays=s.gestation;p.pregnancyLitter=litterSize(s,state.rng);p.cooldownDays=s.cooldown;pushEvent(state,'pregnancy','繁殖季活动',`${s.name}进入繁殖周期，开始孕育下一代。`);}
 }
 const territoryResult=resolveTerritories(state);const territoryConflicts=territoryResult.incidents;const counts=countBySpecies(state);
 for(const k of Object.keys(SPECIES)){if(counts[k]===0&&!state.extinctions.includes(k)){state.extinctions.push(k);pushEvent(state,'local_extinction','物种局部消失',`${SPECIES[k].name}在当前样板区暂时消失。`);}else if(counts[k]>0&&state.extinctions.includes(k)){state.extinctions=state.extinctions.filter(x=>x!==k);pushEvent(state,'recolonization','物种重新出现',`${SPECIES[k].name}重新出现在雾隐树海。`);}}
 state.counts=counts;state.lastDaily={day:state.day,season:season.id,counts,births:births.length,deaths:deaths.length,foodIndex,vegetationChanges,predationKills};
 return {births,deaths,season,seasonChanged:previousSeason!==season.id,territoryConflicts,dispersals:territoryResult.dispersals,vegetationChanges,predationKills,counts,events:state.events.filter(e=>e.day===state.day)};
}
function recordPredation(state,preyId,predatorId){const prey=state.individuals.find(p=>p.id===preyId&&p.alive);if(!prey)return false;prey.alive=false;prey.deathCause='predation';state.stats.deaths++;state.stats.predations++;const predator=state.individuals.find(p=>p.id===predatorId&&p.alive);if(predator)predator.condition=clamp(predator.condition+.14,0,1);state.counts=countBySpecies(state);pushEvent(state,'predation','捕食事件',`${SPECIES[prey.species].name}被捕食，捕食者与猎物种群数量随之变化。`);return true;}
function snapshot(state){const counts=countBySpecies(state),age=ageStructure(state),territories={};for(const h of state.habitats){territories[h.id]={};for(const k of Object.keys(SPECIES))territories[h.id][k]=state.individuals.filter(p=>p.alive&&p.habitatId===h.id&&p.species===k).length;}
 return {seed:state.seed,day:state.day,season:state.season,counts,ageStructure:age,territories,vegetation:state.habitats.map(h=>({id:h.id,stage:STAGES[h.stage],stageIndex:h.stage,biomass:+h.biomass.toFixed(3),cover:+h.cover.toFixed(3),soil:+h.soil.toFixed(3),stageDays:h.stageDays})),stats:{...state.stats},extinctions:[...state.extinctions],foodIndex:+state.foodIndex.toFixed(3),events:state.events.slice(0,12)};
}
function runExperiment(seed,days=360,options={}){
 const counts=options.initialCounts||{deer:5,fox:options.foxes??2,rabbit:5,bird:6};const defs=DEFAULT_HABITATS;const preferred={deer:[['meadow',9,49],['edge',-76,62]],fox:[['ruin',-64,-57],['cave',42,23]],rabbit:[['edge',-76,62],['ruin',-64,-57]],bird:[['grove',1,-68],['meadow',9,49]]};const dummies=[];let n=0;
 for(const [sp,c] of Object.entries(counts)){const spots=preferred[sp]||[['meadow',0,0]];for(let i=0;i<c;i++){const spot=spots[i%spots.length];dummies.push({id:`seed${seed}-${++n}`,species:sp,x:spot[1]+(i%3)*1.1,z:spot[2]+(i%2)*1.1});}}
 const state=createState(seed,dummies,defs.map(h=>({...h,species:h.species||Object.keys(CAP[h.id]).filter(k=>CAP[h.id][k]>0)})));
 for(let d=0;d<days;d++){let food=options.foodIndex===undefined?.82:options.foodIndex;if(options.seasonalDrought&&Math.floor((state.day%120)/30)===3)food*=.38;stepDay(state,{foodIndex:food,predationMultiplier:options.predationMultiplier??1});}
 return snapshot(state);
}
const api={SPECIES,SEASONS,STAGES,HABITAT_CAPACITY:CAP,createState,stepDay,recordPredation,snapshot,runExperiment,stageFor,seasonAt,countBySpecies,ageStructure};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.WorldEcology=api;
})(typeof window!=='undefined'?window:globalThis);
