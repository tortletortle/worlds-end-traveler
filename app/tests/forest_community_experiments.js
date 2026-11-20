'use strict';
const V=require('../vegetation_ecology.js');
const F=require('../forest_community.js');
const seeds=[17,29,43,61,79,101,127,149,173,199];
const scenarios=['baseline','no_root_uptake','drought','fire','windthrow','flood','pest'];
function animals(){const a=[];for(let i=0;i<16;i++)a.push({id:`a${i}`,species:i<5?'deer':i<10?'rabbit':i<14?'bird':'fox',x:-48+(i%4)*23,z:-52+Math.floor(i/4)*32,alive:true});return a;}
function run(seed,scenario){const trees=V.generateExperimentTrees(seed^0x5f3759df,180),veg=V.createState(seed,trees),forest=F.createState(veg,seed^0x1a2b3c4d),fauna=animals();
 for(let d=0;d<360;d++){
  const season=['spring','summer','autumn','winter'][Math.floor(((d+1)%120)/30)],climate={};
  if(scenario==='flood'&&d===90){} // applied explicitly below
  if(scenario==='drought'&&season==='summer')climate.drought=.34;
  if(scenario==='heavy_grazing')climate.grazing=3.1;
  V.stepDay(veg,{season,animals:fauna,climate});
  F.stepDay(veg,forest,{season,allowNaturalDisturbance:false,disableRootUptake:scenario==='no_root_uptake'});
  if(d===110&&['fire','windthrow','flood','pest'].includes(scenario))F.applyDisturbance(veg,forest,scenario==='windthrow'?'windthrow':scenario, 'cell-136',1.25,scenario==='pest'?{species:'broadleaf'}:{});
 }
 return {vegetation:V.snapshot(veg),forest:F.snapshot(veg,forest)};
}
const rows=[];
for(const scenario of scenarios)for(const seed of seeds){const r=run(seed,scenario);rows.push({scenario,seed,trees:r.vegetation.trees,seedlings:r.vegetation.seedlings,canopy:r.vegetation.meanCanopy,grass:r.vegetation.meanGrass,moisture:r.vegetation.meanMoisture,richness:r.forest.richness,rootPressure:r.forest.meanRootPressure,rootWaterUptake:r.forest.rootWaterUptake,rootStressDays:r.forest.stats.rootStressDays,fireEvents:r.forest.stats.fireEvents,windthrowEvents:r.forest.stats.windthrowEvents,floodEvents:r.forest.stats.floodEvents,pestEvents:r.forest.stats.pestEvents,disturbanceDeaths:r.forest.stats.disturbanceDeaths,disturbanceDamagedTrees:r.forest.stats.disturbanceDamagedTrees,droughtStressDays:r.vegetation.stats.droughtStressDays,treeDeaths:r.vegetation.stats.treeDeaths});}
const base=rows.filter(r=>r.scenario==='baseline'),mean=(a,k)=>a.reduce((n,r)=>n+r[k],0)/a.length;
const deterministicA=run(17,'baseline'),deterministicB=run(17,'baseline');
const noRoots=rows.filter(r=>r.scenario==='no_root_uptake'),drought=rows.filter(r=>r.scenario==='drought'),fire=rows.filter(r=>r.scenario==='fire'),wind=rows.filter(r=>r.scenario==='windthrow'),flood=rows.filter(r=>r.scenario==='flood'),pest=rows.filter(r=>r.scenario==='pest');
const pairedRootEffect=seeds.every(seed=>{const b=base.find(r=>r.seed===seed),n=noRoots.find(r=>r.seed===seed);return b.rootWaterUptake>0&&n.rootWaterUptake===0&&b.moisture<n.moisture;});
const checks={
 allRunsFinite:rows.every(r=>['trees','seedlings','canopy','grass','moisture','richness','rootPressure','rootWaterUptake'].every(k=>Number.isFinite(r[k]))),
 sameSeedDeterministic:JSON.stringify(deterministicA)===JSON.stringify(deterministicB),
 rootSystemsPresent:base.every(r=>r.rootPressure>=0&&r.rootWaterUptake>0),
 rootUptakeCausalEffect:mean(base,'rootWaterUptake')>0&&mean(noRoots,'rootWaterUptake')===0&&mean(base,'moisture')<mean(noRoots,'moisture')&&pairedRootEffect,
 droughtAmplifiesRootStress:mean(drought,'moisture')<mean(base,'moisture')&&mean(drought,'droughtStressDays')>mean(base,'droughtStressDays')&&mean(drought,'treeDeaths')>mean(base,'treeDeaths'),
 fiveTreeSpeciesPresent:base.every(r=>r.richness===5),
 boundedVegetation:rows.every(r=>r.canopy>=0&&r.canopy<=.94&&r.grass>=0&&r.grass<=1&&r.moisture>=.04&&r.moisture<=.92),
 fireDisturbanceApplied:fire.every(r=>r.fireEvents===1),
 windthrowDisturbanceApplied:wind.every(r=>r.windthrowEvents===1),
 floodDisturbanceApplied:flood.every(r=>r.floodEvents===1),
 pestDisturbanceApplied:pest.every(r=>r.pestEvents===1),
 disturbanceCausesTreeDamage:fire.every(r=>r.disturbanceDamagedTrees>0)&&wind.every(r=>r.disturbanceDamagedTrees>0)&&flood.every(r=>r.disturbanceDamagedTrees>0)&&pest.every(r=>r.disturbanceDamagedTrees>0),
 baselineNoForcedDisturbance:base.every(r=>r.fireEvents+r.windthrowEvents+r.floodEvents+r.pestEvents===0)&&drought.every(r=>r.fireEvents+r.windthrowEvents+r.floodEvents+r.pestEvents===0),
 noRootScenarioHasNoUptake:noRoots.every(r=>r.rootWaterUptake===0)
};
const result={result:Object.values(checks).every(Boolean)?'PASS':'FAIL',totalRuns:rows.length,days:360,seeds,scenarios,checks,summary:scenarios.map(s=>{const a=rows.filter(r=>r.scenario===s);return {scenario:s,trees:+mean(a,'trees').toFixed(2),seedlings:+mean(a,'seedlings').toFixed(2),canopy:+mean(a,'canopy').toFixed(4),grass:+mean(a,'grass').toFixed(4),moisture:+mean(a,'moisture').toFixed(4),speciesRichness:+mean(a,'richness').toFixed(2),rootPressure:+mean(a,'rootPressure').toFixed(4),rootWaterUptake:+mean(a,'rootWaterUptake').toFixed(4),rootStressDays:+mean(a,'rootStressDays').toFixed(2),disturbanceDeaths:+mean(a,'disturbanceDeaths').toFixed(2),droughtStressDays:+mean(a,'droughtStressDays').toFixed(2),treeDeaths:+mean(a,'treeDeaths').toFixed(2),disturbanceDamagedTrees:+mean(a,'disturbanceDamagedTrees').toFixed(2)}}),runs:rows};
console.log(JSON.stringify(result,null,2));if(result.result!=='PASS')process.exit(1);
