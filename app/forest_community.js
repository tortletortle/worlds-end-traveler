/*
 * Alvira Forest Community V0.5
 * Spatial root competition, forest strata, multi-species succession and disturbance.
 * Stylized game simulation; parameters are not calibrated field ecology.
 */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const TRAITS={
 broadleaf:{name:'阔叶树',shadeTolerance:.58,droughtTolerance:.46,waterDemand:.78,rootSpread:2.25,rootDepth:1.9,fireResistance:.34,windResistance:.48,maxAge:2600,layer:'canopy',role:'中期演替'},
 pine:{name:'针叶树',shadeTolerance:.30,droughtTolerance:.82,waterDemand:.38,rootSpread:2.55,rootDepth:2.8,fireResistance:.64,windResistance:.72,maxAge:3400,layer:'canopy',role:'先锋树种'},
 birch:{name:'白桦',shadeTolerance:.22,droughtTolerance:.42,waterDemand:.56,rootSpread:1.9,rootDepth:1.45,fireResistance:.25,windResistance:.32,maxAge:1050,layer:'canopy',role:'先锋树种'},
 willow:{name:'溪柳',shadeTolerance:.48,droughtTolerance:.16,waterDemand:.98,rootSpread:2.75,rootDepth:1.55,fireResistance:.18,windResistance:.28,maxAge:1250,layer:'canopy',role:'河岸树种'},
 cedar:{name:'古杉',shadeTolerance:.88,droughtTolerance:.70,waterDemand:.44,rootSpread:2.15,rootDepth:3.35,fireResistance:.58,windResistance:.86,maxAge:4200,layer:'canopy',role:'晚期演替'}
};
const SPECIES=Object.keys(TRAITS);
function chooseSpecies(cell,rng){
 const moisture=cell.moisture||.5,open=cell.openness??1;
 const weights={broadleaf:.30,pine:.20,birch:.14,willow:moisture>.72?.24:.025,cedar:open<.58?.26:.12};
 if(moisture<.42){weights.pine+=.22;weights.willow=0;weights.birch+=.05;}
 if(open>.72){weights.birch+=.20;weights.pine+=.10;weights.cedar*=.25;}
 const total=Object.values(weights).reduce((a,b)=>a+b,0);let r=rng()*total;
 for(const s of SPECIES){r-=weights[s];if(r<=0)return s;}return 'broadleaf';
}
function ensureTree(tree,cell,rng){
 if(!TRAITS[tree.species])tree.species=chooseSpecies(cell,rng);
 const tr=TRAITS[tree.species];
 if(!Number.isFinite(tree.rootBiomass))tree.rootBiomass=.16+.42*tree.size;
 if(!Number.isFinite(tree.rootDepth))tree.rootDepth=.35+tr.rootDepth*Math.max(.25,tree.size);
 if(!Number.isFinite(tree.rootRadius))tree.rootRadius=.6+tr.rootSpread*Math.max(.25,tree.size);
 if(!Number.isFinite(tree.rootHealth))tree.rootHealth=tree.health??.8;
 tree.communityReady=true;
}
function createState(vegetation,seed=1){
 const rng=mulberry32(seed>>>0),state={seed:seed>>>0,rng,day:vegetation.day||0,stats:{rootCompetitionDays:0,rootStressDays:0,rootWaterUptake:0,rootNutrientUptake:0,fireEvents:0,windthrowEvents:0,floodEvents:0,pestEvents:0,disturbanceDeaths:0,speciesTransitions:0,canopyGapDays:0,seedlingCompetitionDeaths:0,disturbanceAffectedCells:0,disturbanceDamagedTrees:0,disturbanceKilledTrees:0},events:[],cells:[],lastDisturbanceDay:-9999};
 for(const c of vegetation.cells){c.rootPressure=0;c.rootWaterDemand=0;c.rootNutrientDemand=0;c.rootCompetition=0;c.forestLayer='understory';state.cells.push({id:c.id,rootPressure:0,rootCompetition:0,layer:'understory',speciesRichness:0,liveTreeCount:0,canopyCover:c.canopy||0});}
 for(let i=0;i<vegetation.trees.length;i++){const t=vegetation.trees[i],cell=vegetation.cells[t.cell]||vegetation.cells[0];t.species=chooseSpecies(cell,rng);ensureTree(t,cell,rng);}
 updateLayers(vegetation,state);return state;
}
function event(state,type,title,description){const e={day:state.day,type,title,description};state.events.unshift(e);if(state.events.length>40)state.events.length=40;return e;}
function updateRootCompetition(vegetation,state,uptakeEnabled=true){
 const grid=vegetation.cells,spacing=14,min=-112;
 for(const c of grid){c.rootPressure=0;c.rootWaterDemand=0;c.rootNutrientDemand=0;}
 let totalWater=0,totalNutrients=0,stressed=0;
 for(const t of vegetation.trees){if(!t.alive)continue;const c0=grid[t.cell]||grid[0];ensureTree(t,c0,state.rng);const tr=TRAITS[t.species];
  const targetBiomass=.12+.62*Math.pow(Math.max(.2,t.size),1.22);t.rootBiomass=clamp(t.rootBiomass+(targetBiomass-t.rootBiomass)*.012,.05,1.8);
  t.rootRadius=clamp(.55+tr.rootSpread*Math.sqrt(t.rootBiomass),.8,5.8);t.rootDepth=clamp(.35+tr.rootDepth*Math.sqrt(t.rootBiomass),.4,5.2);
  const ix=Math.floor((t.x-min)/spacing),iz=Math.floor((t.z-min)/spacing),reach=1;
  for(let dz=-reach;dz<=reach;dz++)for(let dx=-reach;dx<=reach;dx++){const x=ix+dx,z=iz+dz;if(x<0||x>=16||z<0||z>=16)continue;const c=grid[z*16+x],d=Math.hypot(c.x-t.x,c.z-t.z);if(d>t.rootRadius+9)continue;const w=Math.exp(-(d*d)/(2*t.rootRadius*t.rootRadius));const pressure=t.rootBiomass*w;c.rootPressure+=pressure;c.rootWaterDemand+=pressure*tr.waterDemand;c.rootNutrientDemand+=pressure*(.45+.35*tr.rootDepth/5.2);}
 }
 for(let i=0;i<grid.length;i++){const c=grid[i],p=state.cells[i];p.rootPressure=c.rootPressure;p.rootCompetition=clamp((c.rootPressure-.10)/.72,0,1);c.rootCompetition=p.rootCompetition;
  const waterUse=uptakeEnabled?Math.min(.0035,c.rootWaterDemand*.00072):0,nutrientUse=uptakeEnabled?Math.min(.0018,c.rootNutrientDemand*.00014):0;
  c.moisture=clamp(c.moisture-waterUse,.04,.92);c.nutrients=clamp(c.nutrients-nutrientUse,.15,.95);totalWater+=waterUse;totalNutrients+=nutrientUse;
  if(p.rootCompetition>.35){stressed++;c.rootStressDays=(c.rootStressDays||0)+1;}
 }
 for(const t of vegetation.trees){if(!t.alive)continue;const c=grid[t.cell],tr=TRAITS[t.species],competition=state.cells[t.cell]?.rootCompetition||0;const moistureStress=Math.max(0,.3-c.moisture)*(1-tr.droughtTolerance);const rootStress=Math.max(0,competition-.35);t.rootHealth=clamp(t.rootHealth+.00012*(c.moisture-.5)-moistureStress*.0008-rootStress*.00018,.05,1);t.health=clamp(t.health-rootStress*.000055-moistureStress*.000035,.02,1);if(rootStress>.35)state.stats.rootCompetitionDays++;}
 state.stats.rootWaterUptake+=totalWater;state.stats.rootNutrientUptake+=totalNutrients;state.stats.rootStressDays+=stressed;
 return {waterUptake:totalWater,nutrientUptake:totalNutrients,stressedCells:stressed};
}
function updateSeedlings(vegetation,state){
 for(let i=0;i<vegetation.cells.length;i++){const c=vegetation.cells[i],fc=state.cells[i];
  for(let j=c.seedlings.length-1;j>=0;j--){const q=c.seedlings[j];if(!q.communitySpeciesAssigned){q.species=chooseSpecies(c,state.rng);q.communitySpeciesAssigned=true;q.rootDepth=.12;q.rootBiomass=.02;}
   const tr=TRAITS[q.species]||TRAITS.broadleaf;const lightNeed=1-tr.shadeTolerance;const lightStress=Math.max(0,lightNeed-c.openness);const rootStress=fc.rootCompetition;
   q.rootDepth=clamp((q.rootDepth||.12)+.0015,.12,1.8);q.rootBiomass=clamp((q.rootBiomass||.02)+.0008,.02,.55);
   q.health=clamp(q.health-lightStress*.0008-rootStress*.00055+Math.max(0,c.moisture-.38)*.00012,.01,1);
   if(q.health<.11){c.seedlings.splice(j,1);state.stats.seedlingCompetitionDeaths++; }
  }
 }
}
function updateLayers(vegetation,state){
 const counts={},vertical={emergent:0,canopy:0,subcanopy:0,sapling:0},byCell=Array.from({length:vegetation.cells.length},()=>[]);
 for(const t of vegetation.trees)if(t.alive){if(byCell[t.cell])byCell[t.cell].push(t);t.verticalLayer=t.size>1.45?'emergent':t.size>.92?'canopy':t.size>.48?'subcanopy':'sapling';vertical[t.verticalLayer]++;}
 for(let i=0;i<vegetation.cells.length;i++){const c=vegetation.cells[i],fc=state.cells[i],local=byCell[i],species=new Set(local.map(t=>t.species));fc.liveTreeCount=local.length;fc.speciesRichness=species.size;fc.canopyCover=c.canopy;fc.layer=c.canopy>.55?'闭合林冠':c.canopy>.28?'疏林冠':local.some(t=>t.size>.45)?'林下幼林':'林缘 / 灌丛';c.forestLayer=fc.layer;counts[fc.layer]=(counts[fc.layer]||0)+1;}
 state.layers=counts;state.verticalLayers=vertical;
}
function applyDisturbance(vegetation,state,type,cellId='cell-136',intensity=1,options={}){
 const center=vegetation.cells.findIndex(c=>c.id===cellId);if(center<0)throw new Error(`Unknown vegetation cell: ${cellId}`);const cc=vegetation.cells[center],cx=cc.ix,cz=cc.iz,r=clamp(intensity,.1,2.5);let damaged=0,killed=0,affected=0;
 const affectedCells=[];for(const c of vegetation.cells){const d=Math.hypot(c.ix-cx,c.iz-cz);if(d<=(type==='fire'?2:type==='flood'?1:1.5)){affectedCells.push(c);affected++;}}
 if(type==='fire'){
  state.stats.fireEvents++;
  for(const c of affectedCells){const dry=1-c.moisture,fuel=clamp(c.litter*.55+c.grass*.35+c.shrub*.3,.08,1);const burn=clamp(r*(.25+dry*.65)*fuel,0,1);c.grass=clamp(c.grass*(1-.9*burn),.01,1);c.shrub=clamp(c.shrub*(1-.94*burn),.01,1);c.litter*=1-.96*burn;c.seedBank*=1-.58*burn;c.disturbance=clamp(c.disturbance+.65*burn,0,1);c.disturbanceType='fire';c.nutrients=clamp(c.nutrients+.035*burn,.15,.95);for(let j=c.seedlings.length-1;j>=0;j--)if(state.rng()<burn*.82)c.seedlings.splice(j,1);}
  for(const t of vegetation.trees){if(!t.alive)continue;const d=Math.hypot(t.x-cc.x,t.z-cc.z);if(d>32)continue;const tr=TRAITS[t.species]||TRAITS.broadleaf,exposure=clamp(1-d/36,.1,1),damage=r*exposure*(1-tr.fireResistance)*.38;t.health=clamp(t.health-damage,.02,1);damaged++;if(t.health<.19||state.rng()<damage*.32){t.alive=false;t.snagDays=0;t.fallen=false;t.burned=true;killed++;state.stats.disturbanceDeaths++;}}
  event(state,'fire','林地火情','干燥枯落物与林下植被助长了局部火势，形成林窗与养分脉冲。');
 } else if(type==='windthrow'){
  state.stats.windthrowEvents++;
  for(const t of vegetation.trees){if(!t.alive)continue;const d=Math.hypot(t.x-cc.x,t.z-cc.z);if(d>30)continue;const tr=TRAITS[t.species]||TRAITS.broadleaf,exposure=clamp(1-d/34,.05,1),risk=r*exposure*(1-tr.windResistance)*(.35+.65*t.size);if(state.rng()<risk*.72){t.alive=false;t.snagDays=80;t.fallen=true;t.health=0;killed++;state.stats.disturbanceDeaths++;}else{t.health=clamp(t.health-risk*.22,.02,1);damaged++;}}
  for(const c of affectedCells){c.disturbance=clamp(c.disturbance+.45*r,0,1);c.disturbanceType='windthrow';c.seedBank=clamp(c.seedBank+.025*r,0,1);}
  event(state,'windthrow','强风倒木','强风撕开林冠，倒木留下新的林窗与腐殖质来源。');
 } else if(type==='flood'){
  state.stats.floodEvents++;
  for(const c of affectedCells){c.moisture=clamp(c.moisture+.16*r,.04,.92);c.nutrients=clamp(c.nutrients+.018*r,.15,.95);c.disturbance=clamp(c.disturbance+.25*r,0,1);c.disturbanceType='flood';for(let j=c.seedlings.length-1;j>=0;j--)if(state.rng()<.12*r)c.seedlings.splice(j,1);}
  for(const t of vegetation.trees){if(!t.alive)continue;const d=Math.hypot(t.x-cc.x,t.z-cc.z);if(d<20){const tr=TRAITS[t.species]||TRAITS.broadleaf;t.health=clamp(t.health-.018*r*(1-tr.droughtTolerance*.25),.02,1);damaged++;}}
  event(state,'flood','河水漫过林地','洪水带来水分与沉积养分，也冲刷了部分幼苗。');
 } else if(type==='pest'){
  state.stats.pestEvents++;
  const target=options.species||'broadleaf';
  for(const t of vegetation.trees){if(!t.alive||t.species!==target)continue;const d=Math.hypot(t.x-cc.x,t.z-cc.z);if(d>36)continue;const exposure=clamp(1-d/42,.1,1),damage=.12*r*exposure;t.health=clamp(t.health-damage,.02,1);damaged++;if(t.health<.16&&state.rng()<.35){t.alive=false;t.snagDays=0;t.fallen=false;killed++;state.stats.disturbanceDeaths++;}}
  for(const c of affectedCells){c.disturbance=clamp(c.disturbance+.18*r,0,1);c.disturbanceType='pest';c.nutrients=clamp(c.nutrients+.006*r,.15,.95);}
  event(state,'pest','病虫害扩散',`${TRAITS[target]?.name||target}局部受病虫害影响，林冠出现稀疏斑块。`);
 } else throw new Error(`Unsupported disturbance type: ${type}`);
 state.lastDisturbanceDay=state.day;state.stats.disturbanceAffectedCells+=affected;state.stats.disturbanceDamagedTrees+=damaged;state.stats.disturbanceKilledTrees+=killed;
 return {type,affectedCells:affected,damagedTrees:damaged,killedTrees:killed,day:state.day};
}
function stepDay(vegetation,state,env={}){
 state.day=vegetation.day;for(const t of vegetation.trees)if(!t.communityReady)ensureTree(t,vegetation.cells[t.cell]||vegetation.cells[0],state.rng);
 const roots=updateRootCompetition(vegetation,state,!env.disableRootUptake);updateSeedlings(vegetation,state);
 // Rare deterministic natural disturbances; explicit scenario calls remain available for tests.
 if(env.allowNaturalDisturbance&&state.rng()<.00032){const types=['windthrow','flood','pest','fire'];const type=types[Math.floor(state.rng()*types.length)];const cell=vegetation.cells[Math.floor(state.rng()*vegetation.cells.length)];applyDisturbance(vegetation,state,type,cell.id,.55+state.rng()*.65);}
 updateLayers(vegetation,state);
 const richness=new Set(vegetation.trees.filter(t=>t.alive).map(t=>t.species)).size;
 return {day:state.day,roots,richness,layers:{...state.layers},verticalLayers:{...(state.verticalLayers||{})},stats:{...state.stats}};
}
function snapshot(vegetation,state){const live=vegetation.trees.filter(t=>t.alive),species={};for(const t of live)species[t.species]=(species[t.species]||0)+1;const avg=k=>state.cells.reduce((n,c)=>n+(c[k]||0),0)/state.cells.length;return {seed:state.seed,day:state.day,liveTrees:live.length,species,richness:Object.keys(species).length,meanRootPressure:+avg('rootPressure').toFixed(4),meanRootCompetition:+avg('rootCompetition').toFixed(4),rootWaterUptake:+state.stats.rootWaterUptake.toFixed(4),rootNutrientUptake:+state.stats.rootNutrientUptake.toFixed(4),layers:{...state.layers},verticalLayers:{...(state.verticalLayers||{})},stats:{...state.stats},events:state.events.slice(0,12)};}
const api={TRAITS,createState,stepDay,applyDisturbance,snapshot,chooseSpecies};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.WorldForest=api;
})(typeof window!=='undefined'?window:globalThis);
