"""Logic/geometry smoke test.

This execution container does not expose a real WebGL implementation. The test
therefore supplies a WebGL2 API stub to execute scene construction and gameplay
state transitions. It does NOT claim to validate GPU shader compilation or the
visual render. Run the project in desktop Chrome/Edge for visual acceptance.
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

SHIM = r'''<script>
(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  let attrib = 0;
  const methods = new Set(['createShader','shaderSource','compileShader','getShaderParameter','getShaderInfoLog','createProgram','attachShader','linkProgram','getProgramParameter','getProgramInfoLog','useProgram','getAttribLocation','getUniformLocation','enable','depthFunc','disable','createVertexArray','bindVertexArray','createBuffer','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','viewport','clearColor','clear','uniformMatrix4fv','uniform3fv','uniform1f','drawArrays']);
  const returns = {createShader:()=>({}),createProgram:()=>({}),createVertexArray:()=>({}),createBuffer:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,getShaderInfoLog:()=>'',getProgramInfoLog:()=>'',getAttribLocation:()=>attrib++,getUniformLocation:()=>({})};
  const fake = new Proxy({}, {get(_t,p){ if(p==='DEPTH_TEST'||p==='LEQUAL'||p==='ARRAY_BUFFER'||p==='STATIC_DRAW'||p==='FLOAT'||p==='TRIANGLES'||p==='VERTEX_SHADER'||p==='FRAGMENT_SHADER'||p==='COMPILE_STATUS'||p==='LINK_STATUS'||p==='COLOR_BUFFER_BIT'||p==='DEPTH_BUFFER_BIT') return 1; if(returns[p]) return returns[p]; if(methods.has(p)) return ()=>{}; return undefined; }});
  HTMLCanvasElement.prototype.getContext = function(type, opts){ if(this.id==='gameCanvas' && type==='webgl2') return fake; return original.call(this,type,opts); };
})();
</script>'''

html = (ROOT/'index.html').read_text(encoding='utf-8')
model = (ROOT/'population_ecology.js').read_text(encoding='utf-8')
js = (ROOT/'game.js').read_text(encoding='utf-8')
html = html.replace('<script src="population_ecology.js"></script>\n<script src="game.js"></script>', SHIM+'<script>'+model+'</script><script>'+js+'</script>')
errors=[]
with sync_playwright() as p:
    launch_args={'headless':True,'args':['--no-sandbox']}
    if os.environ.get('CHROMIUM'):
        launch_args['executable_path']=os.environ['CHROMIUM']
    browser=p.chromium.launch(**launch_args)
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(html, wait_until='load')
    page.wait_for_function("window.__gameDebug && window.__gameDebug.getState().meshBatches > 0", timeout=30000)
    initial=page.evaluate('window.__gameDebug.getState()')
    assert initial['version']=='0.3', initial
    assert initial['meshBatches'] >= 7, initial
    assert initial['caveBatches'] >= 3, initial
    assert initial['terrainVertices'] > 10000, initial
    assert len(page.evaluate('window.__gameDebug.landmarks')) >= 8
    page.evaluate('window.__gameDebug.start()')
    z0=page.evaluate('window.__gameDebug.getState().z')
    page.keyboard.down('KeyW'); page.wait_for_timeout(450); page.keyboard.up('KeyW')
    z1=page.evaluate('window.__gameDebug.getState().z')
    assert z1 < z0, {'z_before':z0,'z_after':z1}
    page.evaluate('window.__gameDebug.setPosition(42,23)')
    page.evaluate('window.__gameDebug.interact()')
    inside=page.evaluate('window.__gameDebug.getState()')
    assert inside['insideCave'] is True, inside
    page.evaluate('window.__gameDebug.exitCave()')
    outside=page.evaluate('window.__gameDebug.getState()')
    assert outside['insideCave'] is False, outside
    page.evaluate('window.__gameDebug.drawMap()')
    assert not errors, errors
    browser.close()
print(json.dumps({'result':'PASS','test_scope':'JavaScript scene construction and gameplay logic with WebGL2 API stub','gpu_rendering':'NOT TESTED: WebGL is unavailable in this execution container','outside_mesh_batches':initial['meshBatches'],'cave_mesh_batches':initial['caveBatches'],'terrain_vertex_count':initial['terrainVertices'],'landmarks':8,'keyboard_movement':'PASS','cave_enter_exit':'PASS','map_render_logic':'PASS','browser_errors':errors},ensure_ascii=False,indent=2))
