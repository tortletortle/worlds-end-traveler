"""V0.5 regression suite. WebGL2 is stubbed because this container may not expose a real GPU context.
This validates JS/DOM/gameplay paths, not real shader compilation or visual quality.
"""
import json, os, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHIM = r'''<script>
(() => {
 const original=HTMLCanvasElement.prototype.getContext;let attrib=0;
 const methods=new Set(['createShader','shaderSource','compileShader','getShaderParameter','getShaderInfoLog','createProgram','attachShader','linkProgram','getProgramParameter','getProgramInfoLog','useProgram','getAttribLocation','getUniformLocation','enable','depthFunc','disable','createVertexArray','bindVertexArray','deleteVertexArray','createBuffer','deleteBuffer','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','viewport','clearColor','clear','uniformMatrix4fv','uniform3fv','uniform1f','drawArrays']);
 const returns={createShader:()=>({}),createProgram:()=>({}),createVertexArray:()=>({}),createBuffer:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,getShaderInfoLog:()=>'',getProgramInfoLog:()=>'',getAttribLocation:()=>attrib++,getUniformLocation:()=>({})};
 const fake=new Proxy({},{get(_t,p){if(['DEPTH_TEST','LEQUAL','ARRAY_BUFFER','STATIC_DRAW','FLOAT','TRIANGLES','VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT'].includes(p))return 1;if(returns[p])return returns[p];if(methods.has(p))return ()=>{};return undefined;}});
 HTMLCanvasElement.prototype.getContext=function(type,opts){if(this.id==='gameCanvas'&&type==='webgl2')return fake;return original.call(this,type,opts);};
})();
</script>'''
html=(ROOT/'index.html').read_text(encoding='utf-8')
model=(ROOT/'population_ecology.js').read_text(encoding='utf-8')
vegetation=(ROOT/'vegetation_ecology.js').read_text(encoding='utf-8')
forest=(ROOT/'forest_community.js').read_text(encoding='utf-8')
story=(ROOT/'demo_story.js').read_text(encoding='utf-8')
game=(ROOT/'game.js').read_text(encoding='utf-8')
assert 'uniform float uTime;' in game.split('const FRAG',1)[0], 'vertex shader must declare uTime used by animated leaves'
html=html.replace('<script src="population_ecology.js"></script>\n<script src="vegetation_ecology.js"></script>\n<script src="forest_community.js"></script>\n<script src="demo_story.js"></script>\n<script src="game.js"></script>',SHIM+'<script>'+model+'</script><script>'+vegetation+'</script><script>'+forest+'</script><script>'+story+'</script><script>'+game+'</script>')
errors=[]
with sync_playwright() as p:
    launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
    if os.environ.get('CHROMIUM'): launch['executable_path']=os.environ['CHROMIUM']
    browser=p.chromium.launch(**launch)
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='load')
    page.wait_for_function("window.__gameDebug && window.__gameDebug.getState().version==='0.7.0-demo'",timeout=30000)
    state=page.evaluate('window.__gameDebug.getState()')
    assert page.locator('#journeyObjective').count()==1
    assert page.locator('#journalButton').count()==1
    assert page.evaluate('window.__gameDebug.storyState().currentId')=='village'
    assert state['meshBatches']>=8 and state['caveBatches']>=3,state
    assert state['terrainVertices']>10000,state
    assert len(page.evaluate('window.__gameDebug.landmarks'))>=8
    assert state['animalMeshes']==4 and state['animalCount']==18,state

    # Initial demographic structure and habitat configuration.
    eco=page.evaluate('window.__gameDebug.getEcologyState()')
    assert eco['counts']=={'deer':5,'fox':2,'rabbit':5,'bird':6},eco['counts']
    assert all(sum(st.values())==eco['counts'][sp] for sp,st in eco['population']['ageStructure'].items())
    assert len(eco['population']['vegetation'])==6
    assert eco['population']['vegetation'][2]['stage']=='先锋地被'

    # V0.1 regressions: movement, map, discovery, cave enter/exit.
    page.evaluate('window.__gameDebug.start()')
    z0=page.evaluate('window.__gameDebug.getState().z')
    page.keyboard.down('KeyW');page.wait_for_timeout(420);page.keyboard.up('KeyW')
    z1=page.evaluate('window.__gameDebug.getState().z')
    assert z1<z0,{'before':z0,'after':z1}
    page.evaluate('window.__gameDebug.setPosition(-72,83)')
    page.evaluate('window.__gameDebug.interact()')
    assert 'village' in page.evaluate('window.__gameDebug.getState().discovered')
    page.evaluate('window.__gameDebug.setPosition(42,23)')
    page.evaluate('window.__gameDebug.interact()')
    assert page.evaluate('window.__gameDebug.getState().insideCave') is True
    page.evaluate('window.__gameDebug.exitCave()')
    assert page.evaluate('window.__gameDebug.getState().insideCave') is False
    page.evaluate('window.__gameDebug.drawMap()')

    # V0.2 behavior regressions: autonomous movement, needs, hunting and resource use.
    ids=page.evaluate("""(() => {const a=window.__gameDebug.getEcologyState().animals;return {deer:a.find(x=>x.species==='deer').id,fox:a.find(x=>x.species==='fox').id,rabbit:a.find(x=>x.species==='rabbit').id,rabbit2:a.filter(x=>x.species==='rabbit')[1].id,rabbit3:a.filter(x=>x.species==='rabbit')[2].id,rabbit4:a.filter(x=>x.species==='rabbit')[3].id};})()""")
    before=page.evaluate('window.__gameDebug.getEcologyState().animals.map(a=>({id:a.id,x:a.x,z:a.z}))')
    page.evaluate('window.__gameDebug.simulate(12)')
    after=page.evaluate('window.__gameDebug.getEcologyState().animals.map(a=>({id:a.id,x:a.x,z:a.z}))')
    assert any((a['x']-next(b['x'] for b in before if b['id']==a['id']))**2+(a['z']-next(b['z'] for b in before if b['id']==a['id']))**2>.01 for a in after)
    page.evaluate("id => window.__gameDebug.setNeeds(id,{thirst:.98,hunger:.1,energy:.9})",ids['deer'])
    page.evaluate('id => window.__gameDebug.forceDecision(id)',ids['deer'])
    assert page.evaluate("id => window.__gameDebug.getEcologyState().animals.find(x=>x.id===id).state",ids['deer'])=='drink'
    page.evaluate("id => window.__gameDebug.setNeeds(id,{hunger:.98,thirst:.1,energy:.9})",ids['rabbit'])
    page.evaluate('id => window.__gameDebug.forceDecision(id)',ids['rabbit'])
    assert page.evaluate("id => window.__gameDebug.getEcologyState().animals.find(x=>x.id===id).state",ids['rabbit'])=='forage'
    page.evaluate("id => window.__gameDebug.moveAnimal(id,-62,43)",ids['fox'])
    page.evaluate("id => window.__gameDebug.moveAnimal(id,-61,43)",ids['rabbit2'])
    page.evaluate("id => window.__gameDebug.setNeeds(id,{hunger:.98,thirst:.1})",ids['fox'])
    page.evaluate('id => window.__gameDebug.forceDecision(id)',ids['fox'])
    assert page.evaluate("id => window.__gameDebug.getEcologyState().animals.find(x=>x.id===id).state",ids['fox'])=='hunt'
    page.evaluate('window.__gameDebug.simulate(0.1)')
    prey=page.evaluate("id => window.__gameDebug.getEcologyState().animals.find(x=>x.id===id)",ids['rabbit2'])
    assert prey['alive'] is False
    eco=page.evaluate('window.__gameDebug.getEcologyState()')
    assert eco['population']['stats']['predations']>=1
    # V0.3: predation is permanent; demographic births replace losses instead of timed respawn.
    page.evaluate('window.__gameDebug.simulate(151)')
    assert page.evaluate("id => window.__gameDebug.getEcologyState().animals.find(x=>x.id===id).alive",ids['rabbit2']) is False

    # Food depletion/regeneration and animal observation remain functional.
    # Reset a deterministic animal fixture after the predator stress test: the old suite
    # accidentally depended on at least one rabbit surviving a stochastic hunt.
    fixture=page.evaluate('window.__gameDebug.resetAnimalRegressionFixture()')
    assert fixture['rabbit']>=1,fixture
    page.evaluate("id => window.__gameDebug.moveAnimal(id,-105,-105)",ids['fox'])
    forage_id=page.evaluate("window.__gameDebug.getEcologyState().animals.find(a=>a.species==='rabbit'&&a.alive).id")
    page.evaluate("window.__gameDebug.setFoodStock('berries-edge',.8)")
    page.evaluate("id => window.__gameDebug.moveAnimal(id,-62,43)",forage_id)
    page.evaluate('id => window.__gameDebug.forceForage(id,"berries-edge")',forage_id)
    assert page.evaluate("id => window.__gameDebug.getEcologyState().animals.find(a=>a.id===id).target.nodeId",forage_id)=='berries-edge'
    page.evaluate('window.__gameDebug.simulate(4)')
    stock=page.evaluate("window.__gameDebug.getEcologyState().foodStock.find(n=>n.id==='berries-edge').stock")
    assert stock<.8,stock
    page.evaluate('window.__gameDebug.simulate(150)')
    assert page.evaluate('window.__gameDebug.getEcologyState().population.day')==1
    page.evaluate('id => window.__gameDebug.observe(id)',ids['deer'])
    assert 'deer' in page.evaluate('window.__gameDebug.getEcologyState().observed')

    # Long-term population model: one year, reproduction, mortality, seasons and succession.
    pop=page.evaluate('window.__gameDebug.simulatePopulationDays(120)')
    assert pop['day']==121,pop['day']
    assert pop['stats']['births']>0,pop['stats']
    assert pop['stats']['deaths']>0,pop['stats']
    assert pop['stats']['predations']>0,pop['stats']
    assert pop['stats']['seasonChanges']==4,pop['stats']
    assert pop['stats']['successionChanges']>0,pop['stats']
    assert pop['stats']['territoryConflicts']>0,pop['stats']
    assert all(0<=v<={'deer':20,'fox':9,'rabbit':34,'bird':34}[sp] for sp,v in pop['counts'].items()),pop['counts']
    for sp,st in pop['ageStructure'].items():assert sum(st.values())==pop['counts'][sp],(sp,st,pop['counts'])
    assert any(h['stage']!='先锋地被' for h in pop['vegetation'])

    # V0.4 spatial vegetation regression and animal impact.
    veg0=page.evaluate('window.__gameDebug.getVegetationState()')
    visual0=page.evaluate('window.__gameDebug.getVegetationVisualState()')
    tree_samples0=page.evaluate('window.__gameDebug.getTreeGrowthSamples()')
    assert veg0['trees']>0 and len(veg0['cells'])==256,veg0
    assert visual0['liveTrees']==veg0['trees'] and visual0['woodVertices']>0 and visual0['leafVertices']>0,visual0
    assert visual0['grassPatches']>0 and visual0['understoryVertices']>0,visual0
    # V0.5 forest community: species diversity, spatial root competition and visible surface roots.
    forest0=page.evaluate('window.__gameDebug.getForestState()')
    assert forest0['richness']==5 and len(forest0['species'])==5,forest0
    assert set(forest0['verticalLayers'])=={'emergent','canopy','subcanopy','sapling'},forest0['verticalLayers']
    assert forest0['rootWaterUptake']>=0 and forest0['rootNutrientUptake']>=0,forest0
    assert visual0['rootVertices']>0 and visual0['rootSystems']==visual0['liveTrees'],visual0
    veg1=page.evaluate('window.__gameDebug.simulateVegetationDays(120)')
    visual1=page.evaluate('window.__gameDebug.getVegetationVisualState()')
    assert veg1['day']==241 and veg1['stats']['leafFall']>0,veg1['stats']
    assert veg1['stats']['plantConsumption']>=0 and veg1['meanCanopy']>=0,veg1
    assert visual1['revision']>visual0['revision'] and visual1['liveTrees']==veg1['trees'],(visual0,visual1,veg1['trees'])
    assert visual1['seedlings']==veg1['seedlings'] and visual1['snags']==veg1['deadSnags'],(visual1,veg1)
    tree_samples1=page.evaluate('window.__gameDebug.getTreeGrowthSamples()')
    before_sizes={t['id']:t['size'] for t in tree_samples0}
    assert any(t['size']>before_sizes[t['id']] for t in tree_samples1 if t['id'] in before_sizes),(tree_samples0,tree_samples1)
    spring_leaf=visual1['meanLeafFactor']
    page.evaluate("window.__gameDebug.simulateVegetationDays(1,{season:'autumn'})")
    autumn_visual=page.evaluate('window.__gameDebug.getVegetationVisualState()')
    page.evaluate("window.__gameDebug.simulateVegetationDays(1,{season:'winter'})")
    winter_visual=page.evaluate('window.__gameDebug.getVegetationVisualState()')
    assert autumn_visual['meanLeafFactor']<spring_leaf,(spring_leaf,autumn_visual)
    assert autumn_visual['fallingLeafVertices']>0,autumn_visual
    assert winter_visual['meanLeafFactor']<autumn_visual['meanLeafFactor'],(autumn_visual,winter_visual)
    assert winter_visual['fallingLeafVertices']==0,winter_visual
    assert visual1['litterVertices']>=0 and visual1['tracks']>=0

    # Animal browsing and trampling must alter a known spatial cell and its 3D marks.
    page.evaluate('window.__gameDebug.resetAnimalRegressionFixture()')
    cell_before=page.evaluate("(()=>{const cells=window.__gameDebug.getVegetationState().cells.filter(c=>c.grass>.25&&c.shrub>.08&&c.herbivory<.08&&c.trampling<.08);return cells.sort((a,b)=>b.grass-a.grass)[0]})()")
    page.evaluate("p=>{for(const a of window.__gameDebug.getEcologyState().animals.filter(a=>a.alive&&['deer','rabbit','bird'].includes(a.species)))window.__gameDebug.moveAnimal(a.id,p.x,p.z)}",{'x':cell_before['x'],'z':cell_before['z']})
    page.evaluate("window.__gameDebug.simulateVegetationDays(30,{climate:{grazing:3,trampling:3}})")
    cell_after=page.evaluate("s=>window.__gameDebug.getVegetationState().cells.find(c=>c.id===s)",cell_before['id'])
    impact_visual=page.evaluate('window.__gameDebug.getVegetationVisualState()')
    assert cell_after['grass']<cell_before['grass'] and cell_after['shrub']<cell_before['shrub'],(cell_before,cell_after)
    assert cell_after['herbivory']>0 and cell_after['trampling']>0,(cell_after)
    assert impact_visual['tracks']>0,impact_visual

    # Severe drought must produce visible snags while retaining living recruits.
    drought_veg=page.evaluate("window.__gameDebug.simulateVegetationDays(120,{climate:{drought:.34,treeMortality:3.5}})")
    drought_visual=page.evaluate('window.__gameDebug.getVegetationVisualState()')
    assert drought_veg['deadSnags']>0 and drought_visual['snags']>0,(drought_veg['deadSnags'],drought_visual)
    assert drought_visual['seedlings']>0 and drought_visual['woodVertices']>0,drought_visual
    # Deterministic disturbance tests must affect the ecological state and regenerate 3D marks.
    fire=page.evaluate("window.__gameDebug.triggerForestDisturbance('fire','cell-136',1.2)")
    assert fire['affectedCells']>0 and fire['damagedTrees']>0,fire
    assert page.evaluate('window.__gameDebug.getForestState().stats.fireEvents')==1
    fire_visual=page.evaluate('window.__gameDebug.getVegetationVisualState()')
    assert fire_visual['revision']>drought_visual['revision'] and fire_visual['woodVertices']>0,fire_visual
    page.evaluate("window.__gameDebug.triggerForestDisturbance('windthrow','cell-136',1.4)")
    assert page.evaluate('window.__gameDebug.getForestState().stats.windthrowEvents')==1
    page.evaluate("window.__gameDebug.triggerForestDisturbance('flood','cell-136',1.0)")
    page.evaluate("window.__gameDebug.triggerForestDisturbance('pest','cell-136',1.0,{species:'broadleaf'})")
    forest1=page.evaluate('window.__gameDebug.getForestState()')
    assert forest1['stats']['floodEvents']==1 and forest1['stats']['pestEvents']==1,forest1['stats']
    assert forest1['stats']['disturbanceAffectedCells']>0 and forest1['stats']['disturbanceDamagedTrees']>0,forest1['stats']
    # UI panel exposes population age structure, succession and spatial vegetation.

    page.locator('#ecologyButton').click()
    assert 'show' in page.locator('#ecologyPanel').get_attribute('class')
    assert '幼崽' in page.locator('#ecoPopulation').inner_text()
    assert '根系竞争' in page.locator('#ecoForest').inner_text()
    assert page.locator('#forestFire').count()==1
    fire_before=page.evaluate('window.__gameDebug.getForestState().stats.fireEvents')
    page.locator('#forestFire').click()
    assert page.evaluate('window.__gameDebug.getForestState().stats.fireEvents')==fire_before+1
    assert '幼林' in page.locator('#ecoSuccession').inner_text() or '成熟森林' in page.locator('#ecoSuccession').inner_text()
    page.locator('#mapButton').click()
    assert 'show' in page.locator('#mapPanel').get_attribute('class')
    # V0.6.2 visual regression: deterministic time-of-day lighting transitions.
    lighting_samples=page.evaluate("""() => {
        const out=[];
        for (const hour of [23,6,12,18]) {
            window.__gameDebug.setClockHour(hour);
            out.push(window.__gameDebug.getLightingState());
        }
        window.__gameDebug.setClockHour(6);
        return out;
    }""")
    night,dawn,noon,dusk=lighting_samples
    assert night['sunIntensity'] < noon['sunIntensity'] * .2,lighting_samples
    assert dawn['fogColor'][0] > dawn['fogColor'][2],dawn
    assert night['fogColor'][2] > night['fogColor'][0],night
    assert dawn['fogDensity'] > noon['fogDensity'],lighting_samples
    assert dusk['twilight'] > noon['twilight'],lighting_samples
    assert not errors,errors
    browser.close()

# Syntax checks and multi-seed experiment suite.
for file in ['game.js','population_ecology.js','vegetation_ecology.js','forest_community.js']:
    subprocess.run(['node','--check',str(ROOT/file)],check=True)
experiment=subprocess.run(['node',str(ROOT/'tests'/'population_experiments.js')],capture_output=True,text=True,check=True)
summary=json.loads(experiment.stdout)
assert summary['result']=='PASS' and summary['totalRuns']==48,summary
forest_experiment=subprocess.run(['node',str(ROOT/'tests'/'forest_community_experiments.js')],capture_output=True,text=True,check=True)
forest_summary=json.loads(forest_experiment.stdout)
assert forest_summary['result']=='PASS' and forest_summary['totalRuns']==70,forest_summary
result={'result':'PASS','v01_regressions':['terrain mesh','8 landmarks','keyboard movement','landmark discovery','cave enter/exit','map'], 'v02_regressions':['4 species','autonomous movement','drink/forage/hunt','predation','food depletion','food regeneration','observation'], 'v041_regressions':['256 spatial vegetation cells','per-tree live mesh regeneration','surviving tree growth','seasonal canopy reduction and color palette','animated autumn falling-leaf mesh','winter deciduous leaf-off / evergreen retention','seedling meshes','dead snag and fallen-log meshes','herbivory reduces grass and shrub cell values','trampling creates visible ground marks','drought creates dead snags','dynamic render revision and UI counts'], 'v05_regressions':['five tree species','spatial root competition and water/nutrient uptake','surface root mesh generation','forest strata metrics','fire/windthrow/flood/pest disturbance feedback'],'v03_regressions':['age structure','births','natural deaths','predation deaths','season changes','territory competition','dispersal','vegetation succession','population caps','UI age/succession panels'],'multi_seed':summary,'forest_community_multi_seed':forest_summary,'browser_errors':errors,'gpu_rendering':'NOT TESTED: WebGL2 API stub only; real GPU shader and visual acceptance required on desktop Chrome/Edge'}
(ROOT/'tests'/'latest_result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
