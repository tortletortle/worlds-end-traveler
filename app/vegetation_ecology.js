/*
 * Alvira spatial vegetation ecology V0.4
 * Deterministic, spatially explicit vegetation model for the Mistwood prototype.
 * This is a stylized game simulation, not a calibrated ecological forecast.
 * Time unit: one ecology day = 300 seconds of game simulation.
 */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const SEASON={
 spring:{name:'春',growth:1.30,rain:.022,evap:.014,leaf:.86,grassColor:[.25,.48,.25],shrubColor:[.20,.39,.23]},
 summer:{name:'夏',growth:1.12,rain:.012,evap:.023,leaf:1.00,grassColor:[.24,.43,.20],shrubColor:[.16,.34,.19]},
 autumn:{name:'秋',growth:.70,rain:.024,evap:.011,leaf:.54,grassColor:[.47,.39,.19],shrubColor:[.49,.30,.16]},
 winter:{name:'冬',growth:.22,rain:.010,evap:.006,leaf:.13,grassColor:[.38,.40,.34],shrubColor:[.34,.35,.32]}
};
const GRID={min:-112,max:112,spacing:14};
const SPECIES={broadleaf:{name:'阔叶树',maxAge:2600,shade:.58},pine:{name:'针叶树',maxAge:3400,shade:.30},birch:{name:'白桦',maxAge:1050,shade:.22},willow:{name:'溪柳',maxAge:1250,shade:.48},cedar:{name:'古杉',maxAge:4200,shade:.88}};
function chooseSeedlingSpecies(c,rng){const m=c.moisture,o=c.openness;const w={broadleaf:.30,pine:m<.42?.42:.20,birch:o>.68?.30:.12,willow:m>.72?.28:.015,cedar:o<.58?.30:.08};const total=Object.values(w).reduce((a,b)=>a+b,0);let r=rng()*total;for(const k of Object.keys(w)){r-=w[k];if(r<=0)return k;}return 'broadleaf';}
const STAGES=['先锋地被','草地','灌丛','幼林','成熟森林'];
function indexFor(x,z){const ix=clamp(Math.floor((x-GRID.min)/GRID.spacing),0,15),iz=clamp(Math.floor((z-GRID.min)/GRID.spacing),0,15);return iz*16+ix;}
function createState(seed=1,treeSeeds=[],options={}){
 const rng=mulberry32(seed>>>0),cells=[];
 for(let iz=0;iz<16;iz++)for(let ix=0;ix<16;ix++){
  const x=GRID.min+(ix+.5)*GRID.spacing,z=GRID.min+(iz+.5)*GRID.spacing;
  const moisture=clamp(.57+.15*Math.sin(x*.025)+.12*Math.cos(z*.031)+rng()*.08,.28,.92);
  cells.push({id:`cell-${iz*16+ix}`,ix,iz,x,z,moisture,nutrients:.48+rng()*.34,grass:.42+rng()*.26,shrub:.16+rng()*.18,seedBank:options.seedBank??(.42+rng()*.28),litter:.08+rng()*.08,canopy:0,openness:1,disturbance:0,seedlings:[],trampling:0,herbivory:0,stage:1});
 }
 const trees=(treeSeeds||[]).map((t,i)=>({id:`tree-${i+1}`,x:t.x,z:t.z,species:t.species||'broadleaf',seed:t.seed??i,ageDays:Math.floor(220+rng()*1450),size:t.scale??(.72+rng()*.7),health:.72+rng()*.27,alive:true,snagDays:0,fruit:0,cell:indexFor(t.x,t.z)}));
 const state={seed:seed>>>0,rng,day:0,season:'spring',cells,trees,stats:{treeDeaths:0,treeRecruitment:0,seedGermination:0,seedDispersal:0,grazingEvents:0,browseEvents:0,tramplingEvents:0,leafFall:0,leafDropMass:0,plantConsumption:0,droughtStressDays:0},events:[],tracks:{},initial:{trees:trees.length},climate:{drought:1,grazing:1,trampling:1,seedRain:1,treeMortality:1},lastSeason:'spring'};
 recalcCanopy(state);return state;
}
function recalcCanopy(state){
 for(const c of state.cells)c.canopy=0;
 for(const t of state.trees){if(!t.alive)continue;const c=state.cells[t.cell];if(c)c.canopy+=Math.PI*Math.pow(2.5*t.size,2)/(GRID.spacing*GRID.spacing);}
 for(const c of state.cells){c.canopy=clamp(c.canopy,0,.94);c.openness=clamp(1-c.canopy*.78,.22,1);c.stage=c.canopy>.50?4:c.canopy>.30?3:c.shrub>.48?2:c.grass>.36?1:0;}
}
function addEvent(state,type,title,description){const e={day:state.day,type,title,description};state.events.unshift(e);if(state.events.length>60)state.events.length=60;return e;}
function localCellLoads(state,animals,env){
 const loads=state.cells.map(()=>({deer:0,rabbit:0,bird:0,fox:0,seed:0,tram:0}));
 for(const a of animals||[]){if(!a||a.alive===false||!Number.isFinite(a.x)||!Number.isFinite(a.z))continue;const ci=indexFor(a.x,a.z),cx=ci%16,cz=Math.floor(ci/16);const base=a.species==='deer'?1.2:a.species==='rabbit'?.82:a.species==='bird'?.22:.08;const factor=env.grazing??state.climate.grazing??1;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const ix=cx+dx,iz=cz+dz;if(ix<0||ix>=16||iz<0||iz>=16)continue;const cell=state.cells[iz*16+ix],dist=Math.hypot(cell.x-a.x,cell.z-a.z),w=Math.exp(-(dist*dist)/(2*11*11));const l=loads[cell.id.split('-')[1]];if(!l)continue;l[a.species]=(l[a.species]||0)+base*w*factor;l.tram+=((a.species==='deer'?.42:a.species==='rabbit'?.17:.08)*w*(env.trampling??state.climate.trampling??1));}
  if(a.species==='bird'||a.species==='deer')loads[ci].seed+=a.species==='bird'?.18:.055;
 }
 return loads;
}
function stepDay(state,env={}){
 state.day++;const season=env.season||['spring','summer','autumn','winter'][Math.floor(((state.day%120)+120)%120/30)];state.season=season;const climate={...state.climate,...(env.climate||{})};state.climate=climate;const s=SEASON[season]||SEASON.spring;
 const animals=env.animals||[],loads=localCellLoads(state,animals,{...climate,...env});
 let totalGrazed=0,totalBrowse=0,totalTrample=0,seedDispersed=0,germinated=0,recruited=0,dead=0,leafDrop=0;
 // Seed dispersal: birds and deer carry viable seeds between nearby cells.
 for(let i=0;i<state.cells.length;i++){
  const c=state.cells[i],l=loads[i],rain=s.rain*(climate.drought??1),growth=s.growth;
  const drainage=Math.max(0,c.moisture-.62)*.055;
  c.moisture=clamp(c.moisture+rain-s.evap*(season==='summer'?1.15:1)+(c.soilRetention||.0015)-.004*(1-c.canopy)-drainage,.04,.92);
  c.nutrients=clamp(c.nutrients+.0007*c.litter-.00035*(c.grass+c.shrub),.15,.95);
  const light=c.openness,water=c.moisture,nutr=c.nutrients;
  const graze=(l.deer||0)*.007+(l.rabbit||0)*.011+(l.bird||0)*.0015;
  const browse=(l.deer||0)*.0025+(l.rabbit||0)*.0065;
  const tram=(l.tram||0)*.006;
  const grassGrow=.019*growth*water*light*(.55+nutr*.45)*(1-c.grass);
  const shrubGrow=.008*growth*water*light*(.45+nutr*.55)*(1-c.shrub);
  const oldGrass=c.grass,oldShrub=c.shrub;
  c.grass=clamp(c.grass+grassGrow-graze-tram*.42,.015,1);
  c.shrub=clamp(c.shrub+shrubGrow-browse-tram*.18,.01,1);
  totalGrazed+=Math.max(0,oldGrass-c.grass);totalBrowse+=Math.max(0,oldShrub-c.shrub);totalTrample+=tram;
  c.trampling=clamp(c.trampling+tram*.7-.006,0,1);c.herbivory=clamp(c.herbivory+(graze+browse)*.5-.004,0,1);
  c.disturbance=clamp(c.disturbance+tram*.25-.002,0,1);
  // Litter falls during autumn and decays faster in warm, wet conditions.
  if(season==='autumn'){const drop=(c.canopy*.006+c.shrub*.0015);c.litter=clamp(c.litter+drop,0,1);leafDrop+=drop;}
  c.litter=clamp(c.litter-(.0018*water*growth+.0004),0,1);
  // Seasonal seed rain from mature trees and animal-mediated dispersal.
  if(season==='autumn')c.seedBank=clamp(c.seedBank+.0012*(1+c.canopy),0,1);
  const seedLoad=l.seed*(climate.seedRain??1);
  if(seedLoad>0&&state.rng()<Math.min(.75,seedLoad*.075)){
   const nx=clamp(c.ix+Math.floor(state.rng()*3)-1,0,15),nz=clamp(c.iz+Math.floor(state.rng()*3)-1,0,15),target=state.cells[nz*16+nx];target.seedBank=clamp(target.seedBank+.018,0,1);seedDispersed++;
  }
  // Seed germination and sapling cohorts. Heavy browsing and shade reduce establishment.
  const germRate=(season==='spring'?.035:season==='summer'?.012:.002)*c.seedBank*water*light*(1-c.trampling*.7);
  if(c.seedlings.length<12&&state.rng()<germRate){c.seedlings.push({age:0,health:.68+state.rng()*.28,species:chooseSeedlingSpecies(c,state.rng)});c.seedBank=Math.max(0,c.seedBank-.018);germinated++;state.stats.seedGermination++;}
  for(let j=c.seedlings.length-1;j>=0;j--){const q=c.seedlings[j];q.age++;q.health=clamp(q.health+.003*growth*water*light-(browse*.45+tram*.65)-Math.max(0,.25-water)*.018,.01,1);if(q.health<.12){c.seedlings.splice(j,1);continue;}
   if(q.age>=180&&q.health>.48&&c.canopy<.78&&state.trees.filter(t=>t.alive&&t.cell===i).length<5&&state.rng()<.075){const x=c.x+(state.rng()-.5)*GRID.spacing*.72,z=c.z+(state.rng()-.5)*GRID.spacing*.72;state.trees.push({id:`tree-${state.trees.length+1}`,x,z,species:q.species,seed:Math.floor(state.rng()*1000),ageDays:180,size:.24,health:q.health,alive:true,snagDays:0,fruit:0,cell:i});c.seedlings.splice(j,1);recruited++;state.stats.treeRecruitment++;}
  }
  // Herbivores visibly alter understory: grazing and browsing reduce available plant mass.
  if(graze>.002||browse>.002){state.stats.grazingEvents++;if(browse>.002)state.stats.browseEvents++;}
  if(tram>.003)state.stats.tramplingEvents++;
 }
 // Tree growth, stress, senescence, mortality and canopy gaps.
 for(const t of state.trees){if(!t.alive){t.snagDays++;continue;}const c=state.cells[t.cell],water=c.moisture,stress=Math.max(0,.27-water);const growth=.00062*s.growth*water*c.nutrients*(.45+c.openness*.55);t.size=clamp(t.size+growth,.18,1.8);t.ageDays++;
  t.health=clamp(t.health+.0008*(water-.48)+.00035*(c.nutrients-.5)-stress*.006-(c.trampling*.0008),.02,1);
  if(season==='autumn'&&t.ageDays>120&&state.rng()<.13)t.fruit=clamp(t.fruit+.04,0,1);else t.fruit=clamp(t.fruit-.012,0,1);
  const mortality=(.000035+Math.max(0,.24-water)*.0018+Math.max(0,t.ageDays-SPECIES[t.species].maxAge)*.00002)*(climate.treeMortality??1);
  if(t.health<.16||state.rng()<mortality){t.alive=false;t.snagDays=0;dead++;state.stats.treeDeaths++;c.litter=clamp(c.litter+.08,0,1);c.disturbance=clamp(c.disturbance+.22,0,1);}
  if(season==='autumn'&&t.ageDays>150&&t.health>.38)c.seedBank=clamp(c.seedBank+.0011*t.size*(t.species==='pine'?.72:1),0,1);
 }
 state.stats.seedDispersal+=seedDispersed;state.stats.leafFall+=season==='autumn'?1:0;state.stats.leafDropMass+=leafDrop;state.stats.plantConsumption+=totalGrazed+totalBrowse;state.stats.droughtStressDays+=state.cells.filter(c=>c.moisture<.22).length;
 recalcCanopy(state);
 const prev=state.lastSeason;if(prev!==season){if(prev==='summer'&&season==='autumn')addEvent(state,'leaf_fall','秋叶渐落','阔叶树开始落叶，林下逐渐积起一层柔软的枯叶。');else if(season==='spring')addEvent(state,'bud_burst','春芽萌发','气温回升，草本植物与树木新芽开始生长。');else if(season==='winter')addEvent(state,'winter_dormancy','冬季休眠','草木生长放缓，阔叶树进入落叶休眠期。');else if(season==='summer')addEvent(state,'canopy_full','林冠繁茂','树冠展开，林下光照减少，森林进入生长旺季。');state.lastSeason=season;}
 if(dead)addEvent(state,'tree_mortality','林木自然更新',`${dead}棵树木因衰老或环境压力死亡，林地形成新的林窗。`);
 if(recruited)addEvent(state,'tree_recruitment','幼树扎根',`${recruited}株幼树成功度过更新阶段，开始进入林木层。`);
 if(seedDispersed>=4)addEvent(state,'seed_dispersal','种子传播','鸟类与兽类将种子带到新的林地，扩大了植物更新范围。');
 if(totalGrazed+totalBrowse>.12)addEvent(state,'herbivory','动物取食','草食动物啃食草本与灌木，改变了林下植被结构。');
 return {day:state.day,season,seedDispersed,germinated,recruited,deadTrees:dead,grazed:totalGrazed,browsed:totalBrowse,trampled:totalTrample,leafDropMass:leafDrop,events:state.events.filter(e=>e.day===state.day)};
}
function cellAt(state,x,z){return state.cells[indexFor(x,z)];}
function consume(state,x,z,type,amount=0.01){const c=cellAt(state,x,z);if(!c)return 0;let used=0;if(type==='grass'){used=Math.min(c.grass,amount);c.grass-=used;}else if(type==='berries'||type==='shrub'){used=Math.min(c.shrub,amount);c.shrub-=used;}else if(type==='seeds'){used=Math.min(c.seedBank,amount);c.seedBank-=used;}state.stats.plantConsumption+=used;return used;}
function trample(state,x,z,amount=.01){const c=cellAt(state,x,z);if(!c)return false;c.trampling=clamp(c.trampling+amount,0,1);c.grass=clamp(c.grass-amount*.5,.01,1);c.disturbance=clamp(c.disturbance+amount*.3,0,1);for(const q of c.seedlings)q.health=clamp(q.health-amount*.12,.01,1);state.stats.tramplingEvents++;return true;}
function setClimate(state,patch){Object.assign(state.climate,patch||{});return {...state.climate};}
function snapshot(state){
 const live=state.trees.filter(t=>t.alive),seedlings=state.cells.reduce((n,c)=>n+c.seedlings.length,0),avg=k=>state.cells.reduce((n,c)=>n+c[k],0)/state.cells.length;
 const species={broadleaf:live.filter(t=>t.species==='broadleaf').length,pine:live.filter(t=>t.species==='pine').length};
 return {seed:state.seed,day:state.day,season:state.season,trees:live.length,deadSnags:state.trees.filter(t=>!t.alive&&t.snagDays<180).length,treeSpecies:species,seedlings,meanGrass:+avg('grass').toFixed(4),meanShrub:+avg('shrub').toFixed(4),meanSeedBank:+avg('seedBank').toFixed(4),meanMoisture:+avg('moisture').toFixed(4),meanCanopy:+avg('canopy').toFixed(4),meanLitter:+avg('litter').toFixed(4),meanOpenness:+avg('openness').toFixed(4),cells:state.cells.map(c=>({id:c.id,x:c.x,z:c.z,grass:+c.grass.toFixed(3),shrub:+c.shrub.toFixed(3),seedBank:+c.seedBank.toFixed(3),moisture:+c.moisture.toFixed(3),canopy:+c.canopy.toFixed(3),openness:+c.openness.toFixed(3),litter:+c.litter.toFixed(3),trampling:+c.trampling.toFixed(3),herbivory:+c.herbivory.toFixed(3),disturbance:+c.disturbance.toFixed(3),seedlings:c.seedlings.length,stage:STAGES[c.stage]})),stats:{...state.stats},events:state.events.slice(0,12)};
}
function generateExperimentTrees(seed,count=180){const rng=mulberry32(seed),out=[];for(let i=0;i<count;i++){const x=-108+rng()*216,z=-108+rng()*216;out.push({x,z,scale:.72+rng()*.78,seed:Math.floor(rng()*1000),species:rng()<.18?'pine':'broadleaf'});}return out;}
function runExperiment(seed,days=480,options={}){
 const treeSeeds=generateExperimentTrees(seed^0x5f3759df,options.treeCount??180),state=createState(seed,treeSeeds,{seedBank:options.seedBank??.56});
 const animalCounts={deer:options.deer??5,fox:options.fox??2,rabbit:options.rabbit??5,bird:options.bird??6};const animals=[];let n=0;const spots={deer:[-20,30],fox:[-60,-50],rabbit:[-70,50],bird:[0,-60]};
 for(const [species,count] of Object.entries(animalCounts))for(let i=0;i<count;i++){const p=spots[species];animals.push({id:`${species}-${++n}`,species,x:p[0]+(i%3)*3,z:p[1]+(i%2)*3,alive:true,state:'roam'});}
 const seasonAt=d=>['spring','summer','autumn','winter'][Math.floor(((d%120)+120)%120/30)];
 for(let d=0;d<days;d++){
  const season=seasonAt(state.day+1),climate={};
  if(options.drought&&season==='summer')climate.drought=.34;
  if(options.heavyGrazing)climate.grazing=2.8;
  if(options.lowSeedRain)climate.seedRain=.12;
  if(options.disturbance)climate.treeMortality=3.5;
  if(options.trampling)climate.trampling=2.5;
  stepDay(state,{season,animals,climate});
 }
 return snapshot(state);
}
const api={SEASON,SPECIES,STAGES,GRID,createState,stepDay,consume,trample,setClimate,snapshot,cellAt,runExperiment,generateExperimentTrees,indexFor};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.WorldVegetation=api;
})(typeof window!=='undefined'?window:globalThis);
