const fs = require('fs');
const path = require('path');
const E = require('../population_ecology.js');

const SEEDS = Array.from({length:12}, (_,i)=>20261118+i*37);
const DAYS = 360; // three 120-day Alvira years
const SCENARIOS = [
  {id:'baseline',label:'基准生态',options:{}},
  {id:'winter_drought',label:'冬季干旱',options:{seasonalDrought:true}},
  {id:'predator_pressure',label:'高捕食者压力',options:{foxes:6,predationMultiplier:4.5}},
  {id:'chronic_scarcity',label:'长期食物短缺',options:{foodIndex:.25}}
];
const mean = a => a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);
const sd = a => {const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)));};
const results=[];
for(const scenario of SCENARIOS){
  const runs=SEEDS.map(seed=>({seed,result:E.runExperiment(seed,DAYS,scenario.options)}));
  const species={};
  for(const sp of Object.keys(E.SPECIES)){
    const vals=runs.map(r=>r.result.counts[sp]);
    species[sp]={mean:+mean(vals).toFixed(2),sd:+sd(vals).toFixed(2),min:Math.min(...vals),max:Math.max(...vals),extinctions:vals.filter(v=>v===0).length};
  }
  const sumStats={};
  for(const k of ['births','deaths','predations','territoryConflicts','dispersals','seasonChanges','successionChanges','starvationDeaths']){
    const vals=runs.map(r=>r.result.stats[k]);sumStats[k]={mean:+mean(vals).toFixed(2),sd:+sd(vals).toFixed(2)};
  }
  const succession={};
  for(const h of ['meadow','edge','ruin','grove','mother','cave']){
    const vals=runs.map(r=>r.result.vegetation.find(v=>v.id===h).stage);
    succession[h]=Object.fromEntries([...new Set(vals)].map(stage=>[stage,vals.filter(v=>v===stage).length]));
  }
  results.push({scenario:scenario.id,label:scenario.label,days:DAYS,seeds:SEEDS.length,species,stats:sumStats,extinctSpeciesSeedCount:runs.filter(r=>r.result.extinctions.length>0).length,succession,seedResults:runs.map(r=>({seed:r.seed,counts:r.result.counts,extinctions:r.result.extinctions,stats:r.result.stats,stages:r.result.vegetation.map(v=>({id:v.id,stage:v.stage,biomass:v.biomass}))}))});
}
const repeatA=E.runExperiment(SEEDS[0],DAYS,{}),repeatB=E.runExperiment(SEEDS[0],DAYS,{});
const reproducible=JSON.stringify(repeatA)===JSON.stringify(repeatB);
const byId=Object.fromEntries(results.map(r=>[r.scenario,r]));
const baseline=byId.baseline, drought=byId.winter_drought, predator=byId.predator_pressure, scarcity=byId.chronic_scarcity;
const meanTotal=r=>Object.values(r.species).reduce((v,s)=>v+s.mean,0);
const checks={
  sameSeedReproducible:reproducible,
  baselineNoExtinction:baseline.extinctSpeciesSeedCount===0,
  baselineHasBirthsAndDeaths:baseline.stats.births.mean>0&&baseline.stats.deaths.mean>0,
  seasonsAdvanceTwelveTimes:baseline.stats.seasonChanges.mean===12,
  vegetationSuccessionObserved:baseline.stats.successionChanges.mean>0,
  predatorPressureRaisesPredation:predator.stats.predations.mean>baseline.stats.predations.mean,
  predatorPressureReducesRabbitMean:predator.species.rabbit.mean<baseline.species.rabbit.mean,
  droughtReducesFoxMean:drought.species.fox.mean<baseline.species.fox.mean,
  chronicScarcityReducesTotalPopulation:meanTotal(scarcity)<meanTotal(baseline),
  allFinalCountsWithinSpeciesCaps:results.every(r=>Object.entries(r.species).every(([sp,v])=>v.max<=E.SPECIES[sp].maxPop))
};
const report={model:'Alvira Population Ecology V0.3',worldYearDays:120,simulatedDaysPerRun:DAYS,simulatedWorldYears:DAYS/120,seeds:SEEDS,scenarioCount:SCENARIOS.length,totalRuns:SEEDS.length*SCENARIOS.length,reproducibleSameSeed:reproducible,validationChecks:checks,scenarios:results};
const outDir=path.join(__dirname,'..','experiments');fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'multi_seed_results.json'),JSON.stringify(report,null,2));
const rows=['scenario,seed,deer,fox,rabbit,bird,births,deaths,predations,territory_conflicts,dispersals,extinctions'];
for(const r of results)for(const s of r.seedResults)rows.push([r.scenario,s.seed,s.counts.deer,s.counts.fox,s.counts.rabbit,s.counts.bird,s.stats.births,s.stats.deaths,s.stats.predations,s.stats.territoryConflicts,s.stats.dispersals,s.extinctions.join(';')].join(','));
fs.writeFileSync(path.join(outDir,'multi_seed_runs.csv'),rows.join('\n'));
let md=`# V0.3 多随机种子生态实验报告\n\n- 模拟年长度：120 个生态日\n- 单次运行：${DAYS} 天（${DAYS/120} 个世界年）\n- 随机种子：${SEEDS.length}\n- 情景：${SCENARIOS.length}\n- 总运行次数：${report.totalRuns}\n- 同种子可复现性：${reproducible?'通过':'失败'}\n\n> 这是游戏参数下的 stylized simulation，不是现实物种预测。每个情景的种群数为 12 个独立随机种子的终值。\n\n`;
for(const r of results){
 md+=`## ${r.label}（${r.scenario}）\n\n| 物种 | 终值均值 | 标准差 | 最小值 | 最大值 | 灭绝种子数 |\n|---|---:|---:|---:|---:|---:|\n`;
 for(const [sp,v] of Object.entries(r.species))md+=`| ${E.SPECIES[sp].name} | ${v.mean} | ${v.sd} | ${v.min} | ${v.max} | ${v.extinctions}/${SEEDS.length} |\n`;
 md+=`\n平均出生 ${r.stats.births.mean}，死亡 ${r.stats.deaths.mean}，捕食 ${r.stats.predations.mean}，领地冲突 ${r.stats.territoryConflicts.mean}，领地扩散 ${r.stats.dispersals.mean}，栖息地演替阶段变化 ${r.stats.successionChanges.mean}。\n\n`;
}
md+=`## 自动验证检查\n\n`+Object.entries(checks).map(([k,v])=>`- ${v?'PASS':'FAIL'} — ${k}`).join('\n')+`\n\n## 解释边界\n\n- 多随机种子结果用于识别模型对随机初始条件的敏感性，不证明现实生态系统稳定。\n- 高捕食者压力与食物短缺是参数扰动情景，不是经过实地数据校准的生态压力等级。\n- 植被演替目前是栖息地状态模型；游戏内以季节色调、资源供给和观察面板反馈，尚未逐棵重建树木网格。\n- 领地扩散为栖息地间的抽象迁移；尚未实现完整空间个体追踪、遗传、疾病或年龄相关行为差异。\n`;
fs.writeFileSync(path.join(outDir,'MULTI_SEED_REPORT.md'),md);
console.log(JSON.stringify({result:Object.values(checks).every(Boolean)?'PASS':'FAIL',totalRuns:report.totalRuns,days:DAYS,validationChecks:checks,scenarios:results.map(r=>({scenario:r.scenario,species:r.species,births:r.stats.births.mean,deaths:r.stats.deaths.mean,predations:r.stats.predations.mean,territoryConflicts:r.stats.territoryConflicts.mean,extinctSpeciesSeedCount:r.extinctSpeciesSeedCount}))},null,2));
if(Object.values(checks).some(v=>!v))process.exitCode=1;
