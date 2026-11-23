/* The Wanderer at World's End - Mistwood V0.4.1
 * Standalone WebGL2 exploration prototype with spatial population and vegetation rendering.
 * No external libraries or network requests.
 */
(() => {
'use strict';
const canvas = document.getElementById('gameCanvas');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance' });
const $ = id => document.getElementById(id);
if (!gl) {
  $('startScreen').innerHTML = '<div class="startCard"><h1>无法启动三维场景</h1><p>当前浏览器未提供 WebGL 2.0。请使用较新版本的 Chrome、Edge 或 Firefox，并确认浏览器硬件加速已启用。</p></div>';
  return;
}

const VERT = `#version 300 es
precision highp float;
in vec3 aPosition; in vec3 aNormal; in vec3 aColor; in float aEffect;
uniform mat4 uViewProj; uniform vec3 uOffset; uniform float uYaw; uniform float uScale; uniform float uTime;
out vec3 vNormal; out vec3 vColor; out vec3 vWorld; out float vEffect;
void main(){ float c=cos(uYaw),s=sin(uYaw); vec3 q=aPosition*uScale; if(aEffect>2.5){float fall=mod(uTime*0.55+aPosition.x*0.13+aPosition.z*0.09,3.2);q.y-=fall;q.x+=sin(uTime*1.35+aPosition.z)*0.18;q.z+=cos(uTime*1.12+aPosition.x)*0.14;} vec3 p=vec3(q.x*c+q.z*s,q.y,-q.x*s+q.z*c); vec3 n=vec3(aNormal.x*c+aNormal.z*s,aNormal.y,-aNormal.x*s+aNormal.z*c); vNormal=n; vColor=aColor; vWorld=p+uOffset; vEffect=aEffect; gl_Position=uViewProj*vec4(vWorld,1.0); }
`;
const FRAG = `#version 300 es
precision highp float;
in vec3 vNormal; in vec3 vColor; in vec3 vWorld; in float vEffect;
uniform vec3 uLightDir; uniform vec3 uFogColor; uniform vec3 uCamera; uniform float uFogDensity; uniform float uTime; uniform vec3 uTint; uniform float uTintMix;
out vec4 outColor;
void main(){
  vec3 n=normalize(vNormal); float diffuse=max(dot(n,normalize(uLightDir)),0.0);
  float hemi=0.5+0.5*n.y; vec3 lit=vColor*(0.42+0.52*diffuse+0.10*hemi); lit*=mix(vec3(1.0),uTint,uTintMix);
  if(vEffect>0.5 && vEffect<1.5){ float wave=sin(vWorld.x*0.72+uTime*1.4)*0.045+cos(vWorld.z*0.55-uTime*1.1)*0.035; lit=mix(lit,vec3(0.18,0.49,0.52),0.26+wave); lit+=vec3(0.025,0.075,0.085)*(0.5+0.5*sin(vWorld.x*1.7+vWorld.z*1.1+uTime*2.0)); }
  if(vEffect>1.5){ float pulse=0.82+0.18*sin(uTime*2.2+vWorld.y); lit+=vColor*0.48*pulse; }
  float d=length(vWorld-uCamera); float fog=1.0-exp(-pow(d*uFogDensity,1.55));
  vec3 col=mix(lit,uFogColor,clamp(fog,0.0,0.86)); outColor=vec4(col,1.0);
}`;
function compile(type, src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const e=gl.getShaderInfoLog(s);throw new Error('Shader compile failed: '+e);}return s;}
const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERT));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);
const loc={pos:gl.getAttribLocation(program,'aPosition'),normal:gl.getAttribLocation(program,'aNormal'),color:gl.getAttribLocation(program,'aColor'),effect:gl.getAttribLocation(program,'aEffect'),vp:gl.getUniformLocation(program,'uViewProj'),light:gl.getUniformLocation(program,'uLightDir'),fog:gl.getUniformLocation(program,'uFogColor'),camera:gl.getUniformLocation(program,'uCamera'),density:gl.getUniformLocation(program,'uFogDensity'),time:gl.getUniformLocation(program,'uTime'),offset:gl.getUniformLocation(program,'uOffset'),yaw:gl.getUniformLocation(program,'uYaw'),scale:gl.getUniformLocation(program,'uScale'),tint:gl.getUniformLocation(program,'uTint'),tintMix:gl.getUniformLocation(program,'uTintMix')};
gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function normalize(v){const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
function lookAt(eye,center,up){const z=normalize(sub(eye,center)),x=normalize(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}

class Builder{
 constructor(){this.p=[];this.n=[];this.c=[];this.e=[];}
 vertex(p,n,c,e=0){this.p.push(p[0],p[1],p[2]);this.n.push(n[0],n[1],n[2]);this.c.push(c[0],c[1],c[2]);this.e.push(e);}
 tri(a,b,c,color,e=0,n=null){let nn=n||normalize(cross(sub(b,a),sub(c,a)));this.vertex(a,nn,color,e);this.vertex(b,nn,color,e);this.vertex(c,nn,color,e);}
 quad(a,b,c,d,color,e=0,n=null){let nn=n||normalize(cross(sub(b,a),sub(c,a)));this.vertex(a,nn,color,e);this.vertex(b,nn,color,e);this.vertex(c,nn,color,e);this.vertex(a,nn,color,e);this.vertex(c,nn,color,e);this.vertex(d,nn,color,e);}
 box(x,y,z,sx,sy,sz,color){let x0=x-sx/2,x1=x+sx/2,y0=y-sy/2,y1=y+sy/2,z0=z-sz/2,z1=z+sz/2;this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],color,0,[0,0,1]);this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],color,0,[0,0,-1]);this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],color,0,[-1,0,0]);this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],color,0,[1,0,0]);this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],color,0,[0,1,0]);this.quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],color,0,[0,-1,0]);}
 sphere(cx,cy,cz,rx,ry,rz,color,e=0,lat=7,lon=10){for(let i=0;i<lat;i++){let a0=Math.PI*i/lat-Math.PI/2,a1=Math.PI*(i+1)/lat-Math.PI/2;for(let j=0;j<lon;j++){let b0=2*Math.PI*j/lon,b1=2*Math.PI*(j+1)/lon;const pt=(a,b)=>[cx+rx*Math.cos(a)*Math.cos(b),cy+ry*Math.sin(a),cz+rz*Math.cos(a)*Math.sin(b)];let p00=pt(a0,b0),p01=pt(a0,b1),p10=pt(a1,b0),p11=pt(a1,b1);let norm=p=>normalize([(p[0]-cx)/(rx*rx),(p[1]-cy)/(ry*ry),(p[2]-cz)/(rz*rz)]);this.vertex(p00,norm(p00),color,e);this.vertex(p10,norm(p10),color,e);this.vertex(p11,norm(p11),color,e);this.vertex(p00,norm(p00),color,e);this.vertex(p11,norm(p11),color,e);this.vertex(p01,norm(p01),color,e);}}}
 cylinder(a,b,r1,r2,color,segments=8){const axis=normalize(sub(b,a));let ref=Math.abs(axis[1])<.9?[0,1,0]:[1,0,0];let u=normalize(cross(axis,ref)),v=normalize(cross(axis,u));for(let i=0;i<segments;i++){let t0=i*2*Math.PI/segments,t1=(i+1)*2*Math.PI/segments;let q=(t,r)=>[Math.cos(t)*u[0]*r+Math.sin(t)*v[0]*r,Math.cos(t)*u[1]*r+Math.sin(t)*v[1]*r,Math.cos(t)*u[2]*r+Math.sin(t)*v[2]*r];let p0=q(t0,r1),p1=q(t1,r1),p2=q(t1,r2),p3=q(t0,r2);let A=[a[0]+p0[0],a[1]+p0[1],a[2]+p0[2]],B=[a[0]+p1[0],a[1]+p1[1],a[2]+p1[2]],C=[b[0]+p2[0],b[1]+p2[1],b[2]+p2[2]],D=[b[0]+p3[0],b[1]+p3[1],b[2]+p3[2]];let n0=normalize([p0[0]+p3[0],p0[1]+p3[1],p0[2]+p3[2]]);this.quad(A,B,C,D,color,0,n0);}}
 pyramid(x,y,z,sx,sy,sz,color){let p0=[x-sx/2,y,z-sz/2],p1=[x+sx/2,y,z-sz/2],p2=[x+sx/2,y,z+sz/2],p3=[x-sx/2,y,z+sz/2],top=[x,y+sy,z];this.quad(p0,p1,p2,p3,color,0,[0,-1,0]);this.tri(p0,p1,top,color);this.tri(p1,p2,top,color);this.tri(p2,p3,top,color);this.tri(p3,p0,top,color);}
 ribbon(points,width,color,e=0,yoff=.12){for(let i=0;i<points.length-1;i++){let a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l;let aa=[a[0]+nx*width/2,heightAt(a[0],a[1])+yoff,a[1]+nz*width/2],ab=[a[0]-nx*width/2,heightAt(a[0],a[1])+yoff,a[1]-nz*width/2],ba=[b[0]+nx*width/2,heightAt(b[0],b[1])+yoff,b[1]+nz*width/2],bb=[b[0]-nx*width/2,heightAt(b[0],b[1])+yoff,b[1]-nz*width/2];this.quad(aa,ab,bb,ba,color,e,[0,1,0]);}}
 mesh(){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buffers=[];const bind=(data,loc,size)=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);buffers.push(b);};bind(this.p,loc.pos,3);bind(this.n,loc.normal,3);bind(this.c,loc.color,3);bind(this.e,loc.effect,1);gl.bindVertexArray(null);return {vao,count:this.p.length/3,buffers};}
}

const upperRiver=[[-58,-112],[-55,-94],[-49,-76],[-42,-59],[-34,-42],[-27,-24],[-21,-8],[-18,0]];
const lowerRiver=[[-18,14],[-12,30],[-4,46],[8,62],[23,77],[40,92],[59,111]];
const trails=[
 [[-88,77],[-74,62],[-58,52],[-43,40],[-29,27],[-18,18]],
 [[-18,18],[-8,4],[7,-9],[24,-23],[43,-38],[58,-52]],
 [[-18,18],[-11,0],[-5,-22],[0,-44],[1,-68]],
 [[-18,18],[-34,5],[-47,-12],[-57,-33],[-65,-59]],
 [[-18,18],[0,22],[18,25],[31,25],[42,23]]
];
function segDistance(px,pz,a,b){let vx=b[0]-a[0],vz=b[1]-a[1],wx=px-a[0],wz=pz-a[1],t=clamp((wx*vx+wz*vz)/(vx*vx+vz*vz||1),0,1);return Math.hypot(px-(a[0]+t*vx),pz-(a[1]+t*vz));}
function polyDistance(x,z,paths){let d=1e9;for(const p of paths)for(let i=0;i<p.length-1;i++)d=Math.min(d,segDistance(x,z,p[i],p[i+1]));return d;}
function heightAt(x,z){
 const riverD=polyDistance(x,z,[upperRiver,lowerRiver]);
 const waves=1.15*Math.sin(x*.047)*Math.cos(z*.036)+.72*Math.sin((x+z)*.071)+.55*Math.cos(x*.093-z*.04);
 const northPlateau=10.5*(1-smooth(-3,16,z));
 const easternRidge=5.5*Math.exp(-Math.pow((x-76)/23,2)-Math.pow((z-10)/70,2));
 const westernHill=3.8*Math.exp(-Math.pow((x+84)/25,2)-Math.pow((z+28)/42,2));
 const caveHill=4.6*Math.exp(-Math.pow((x-43)/23,2)-Math.pow((z-24)/27,2));
 const farHills=2.6*Math.exp(-Math.pow((x+12)/40,2)-Math.pow((z+100)/23,2));
 const riverCut=2.0*Math.exp(-(riverD*riverD)/34);
 const cliff=10.5*(1-smooth(1,15,z));
 return 1.2+waves+northPlateau+easternRidge+westernHill+caveHill+farHills-riverCut+cliff;
}
function makeTerrain(b){const N=124,step=240/N,start=-120;const verts=[];for(let j=0;j<=N;j++){for(let i=0;i<=N;i++){let x=start+i*step,z=start+j*step,y=heightAt(x,z);verts.push([x,y,z]);}}
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){let a=verts[j*(N+1)+i],b0=verts[j*(N+1)+i+1],c=verts[(j+1)*(N+1)+i+1],d=verts[(j+1)*(N+1)+i];for(const p of [a,c,b0,a,d,c]){let eps=.7,dx=(heightAt(p[0]+eps,p[2])-heightAt(p[0]-eps,p[2]))/(2*eps),dz=(heightAt(p[0],p[2]+eps)-heightAt(p[0],p[2]-eps))/(2*eps),n=normalize([-dx,1,-dz]);let h=p[1],color=h>15?[.36,.43,.38]:h>10?[.27,.38,.29]:h>5?[.22,.34,.24]:[.19,.31,.22];let river=polyDistance(p[0],p[2],[upperRiver,lowerRiver]);if(river<6)color=[.23,.31,.25];let slope=1-n[1];if(slope>.24)color=[.31,.33,.29];b.vertex(p,n,color);}}
}
function addTree(wood,leaf,x,z,scale=1,seed=1){const y=heightAt(x,z);let h=(8+seed%5)*scale,r=.35*scale;wood.cylinder([x,y,z],[x,y+h,z],r*1.25,r*.48,[.25,.18,.12],7);for(let k=0;k<4;k++){let ang=(seed*.71+k*2.4),by=y+h*(.42+k*.1),ex=x+Math.cos(ang)*h*.25,ez=z+Math.sin(ang)*h*.25;wood.cylinder([x,by,z],[ex,by+h*.24,ez],r*.42,r*.16,[.28,.20,.13],6);}let c1=[.14,.30,.18],c2=[.19,.38,.21],c3=[.23,.42,.24];leaf.sphere(x,y+h*.82,z,2.5*scale,3.2*scale,2.4*scale,c1,0,7,9);leaf.sphere(x-1.6*scale,y+h*.76,z+.7*scale,2.2*scale,2.4*scale,2.2*scale,c2,0,7,9);leaf.sphere(x+1.5*scale,y+h*.88,z-.6*scale,2.3*scale,2.8*scale,2.2*scale,c3,0,7,9);leaf.sphere(x+.3*scale,y+h*1.04,z+.3*scale,1.9*scale,2.2*scale,1.8*scale,c2,0,7,9);}
function addPine(wood,leaf,x,z,scale=1){let y=heightAt(x,z),h=10*scale;wood.cylinder([x,y,z],[x,y+h,z],.32*scale,.12*scale,[.27,.22,.16],7);for(let k=0;k<4;k++)leaf.sphere(x,y+h*(.38+k*.16),z,2.4*scale*(1-k*.12),2.5*scale,2.4*scale*(1-k*.12),[.13+.015*k,.29+.018*k,.19+.01*k],0,6,8);}
function addRock(b,x,z,s=1,color=[.35,.38,.34]){let y=heightAt(x,z);b.sphere(x,y+s*.55,z,s*1.25,s*.85,s,color,0,5,7);b.sphere(x+s*.65,y+s*.42,z-s*.2,s*.7,s*.65,s*.75,[color[0]*.93,color[1]*.94,color[2]*.92],0,5,7);}
function addHouse(b,x,z,scale=1,rotation=0){let y=heightAt(x,z),w=5*scale,d=4*scale,h=3.2*scale;b.box(x,y+h/2,z,w,h,d,[.39,.34,.26]);b.pyramid(x,y+h,z,w*1.22,2.7*scale,d*1.3,[.22,.19,.16]);b.box(x,y+.95*scale,z+d*.51,w*.2,1.9*scale,.12*scale,[.17,.12,.09]);b.box(x-w*.28,y+1.35*scale,z+d*.51,.75*scale,1.0*scale,.14*scale,[.15,.24,.23]);}
function addSign(b,x,z){let y=heightAt(x,z);b.cylinder([x,y,z],[x,y+1.8,z],.12,.10,[.31,.23,.14],6);b.box(x,y+1.45,z,1.7,.62,.16,[.35,.28,.18]);}
function addGiantTree(wood,leaf){let x=58,z=-52,y=heightAt(x,z);wood.cylinder([x,y,z],[x,y+27,z],4.2,2.7,[.25,.18,.12],14);for(let i=0;i<8;i++){let a=i*Math.PI/4,ex=x+Math.cos(a)*7,ez=z+Math.sin(a)*7;wood.cylinder([x,y+2,z],[ex,y+1.1,ez],1.25,.2,[.29,.20,.13],8);}for(let i=0;i<7;i++){let a=i*2.399,by=y+13+(i%3)*2.1,ex=x+Math.cos(a)*10,ez=z+Math.sin(a)*10;wood.cylinder([x,by,z],[ex,by+7,ez],1.15,.38,[.26,.18,.12],9);leaf.sphere(ex,by+8,ez,7.5,6.3,7.5,[.13,.31,.18],0,9,12);}leaf.sphere(x,y+28,z,11,9,10,[.13,.32,.18],0,10,14);leaf.sphere(x-7,y+25,z+3,8,7,8,[.17,.38,.22],0,9,12);leaf.sphere(x+7,y+26,z-3,8,7,8,[.19,.40,.23],0,9,12);leaf.sphere(x,y+34,z,7,6,7,[.22,.43,.25],0,8,11);}
function addBridge(wood,rocks){let x=-45,z=-59,y=heightAt(x,z)+1.1;wood.box(x,y,z,15,.7,4,[.42,.34,.23]);for(let i=-6;i<=6;i+=3){wood.box(x+i,y+1.1,z-1.65,.18,2.2,.18,[.28,.24,.18]);wood.box(x+i,y+1.1,z+1.65,.18,2.2,.18,[.28,.24,.18]);}wood.box(x,y+2.05,z-1.65,15,.18,.18,[.32,.26,.18]);wood.box(x,y+2.05,z+1.65,15,.18,.18,[.32,.26,.18]);for(let i=-1;i<=1;i++)addRock(rocks,x+i*5,z+3,1.2,[.38,.39,.34]);}
function addWater(b,points,width){b.ribbon(points,width,[.12,.37,.42],1,.48);}
function addWaterfall(b,rockBuilder){const x=-18,z=7,top=heightAt(-18,0)+.45,bottom=heightAt(-18,14)+.55;for(let i=0;i<4;i++){let x0=x-3.3+i*1.65,x1=x0+1.55;b.quad([x0,bottom,z],[x1,bottom,z],[x1,top,z],[x0,top,z],[.21,.55,.59],1,[0,0,1]);}for(let i=0;i<7;i++){let xx=x-5+i*1.65;addRock(rockBuilder,xx,13,.9,[.38,.42,.38]);}}
const world={};let outsideMeshes=[],caveMeshes=[];let treeColliders=[];
function buildCave(){const floor=new Builder(),wall=new Builder(),crystal=new Builder();floor.box(0,-.45,-2,11,.8,36,[.20,.22,.20]);
 // vaulted tunnel shell, open at the entrance (positive Z)
 for(let j=0;j<24;j++){let z0=-20+j*1.35,z1=z0+1.35;for(let i=0;i<18;i++){let t0=Math.PI*i/18,t1=Math.PI*(i+1)/18;let p=(t,z)=>[Math.cos(t)*5.2,Math.sin(t)*5.2+0.15,z];let a=p(t0,z0),b=p(t1,z0),c=p(t1,z1),d=p(t0,z1);wall.quad(a,b,c,d,[.22,.24,.22]);}}
 wall.box(-5.15,1,-2,.65,2.2,35,[.25,.26,.23]);wall.box(5.15,1,-2,.65,2.2,35,[.24,.25,.22]);wall.box(0,5.15,-20,10.5,10,.7,[.17,.19,.18]);
 for(let i=0;i<18;i++){let x=-4.2+(i%6)*1.65,z=-16+Math.floor(i/6)*10,y=-.1;wall.sphere(x,y,z,.8+(i%3)*.25,1.0,.9,[.29,.30,.27],0,5,7);}
 for(let i=0;i<9;i++){let x=-3.8+(i%3)*3.5,z=-15+Math.floor(i/3)*9;crystal.cylinder([x,-.05,z],[x+.2,1.2+(i%4)*.45,z+.1],.32,.03,[.22,.58,.58],6);crystal.sphere(x+.2,1.2+(i%4)*.45,z+.1,.3,.45,.3,[.26,.72,.70],2,5,7);}
 floor.sphere(0,-.05,-8,2.8,.12,3.8,[.12,.25,.27],1,8,10);
 caveMeshes=[floor.mesh(),wall.mesh(),crystal.mesh()];}
function buildWorld(){const terrain=new Builder(),path=new Builder(),water=new Builder(),wood=new Builder(),leaf=new Builder(),rocks=new Builder(),structures=new Builder(),glow=new Builder();
 makeTerrain(terrain);
 for(const t of trails)path.ribbon(t,3.1,[.39,.31,.20],0,.22);
 addWater(water,upperRiver,5.0);addWater(water,lowerRiver,5.0);addWaterfall(water,rocks);
 // Lower waterfall basin and scattered stones
 water.sphere(-17.5,heightAt(-17.5,16)+.58,15,7,.28,5,[.12,.38,.43],1,9,12);
 // Forest: seeded, deterministic, and kept away from trails and landmarks
 let seed=271828;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const keepouts=[[-86,77,17],[-18,18,12],[58,-52,17],[1,-68,12],[-65,-59,13],[42,23,11],[-45,-59,10]];
 for(let i=0;i<230;i++){let x=-112+rand()*224,z=-112+rand()*224;if(polyDistance(x,z,trails)<6||polyDistance(x,z,[upperRiver,lowerRiver])<8)continue;if(keepouts.some(k=>Math.hypot(x-k[0],z-k[1])<k[2]))continue;let s=.72+rand()*.78;/* Tree geometry is rendered from WorldVegetation state in V0.4.1; keep only initial collision/seed metadata here. */treeColliders.push([x,z,1.15*s]);}
 // Village of林息村
 const houses=[[-91,77,1.05],[-82,84,.9],[-73,75,.82],[-88,65,.8],[-76,64,.85]];houses.forEach(h=>addHouse(structures,h[0],h[1],h[2]));
 // Small gardens, fences, well and village sign
 let vy=heightAt(-82,76);structures.box(-81,vy+.3,72,7,.6,.5,[.34,.29,.20]);structures.cylinder([-82,vy,80],[-82,vy+1.6,80],.7,.7,[.35,.39,.34],10);structures.box(-82,vy+1.65,80,1.8,.2,1.8,[.28,.25,.19]);addSign(structures,-72,83);
 // Ancient bridge crossing the upper river
 addBridge(structures,rocks);
 // Waterfall cliff framing
 for(let i=0;i<12;i++){let xx=-26+(i%6)*3.1,zz=3+Math.floor(i/6)*7;addRock(rocks,xx,zz,1.6+(i%3)*.5,[.34,.39,.35]);}
 // Giant mother tree and exposed roots
 addGiantTree(wood,leaf);treeColliders.push([58,-52,6]);
 // Whisper grove: ring of standing stones and a glowing root altar
 const gx=1,gz=-68,gy=heightAt(gx,gz);for(let i=0;i<9;i++){let a=i*2*Math.PI/9,rx=gx+Math.cos(a)*9,rz=gz+Math.sin(a)*9;wood.cylinder([rx, heightAt(rx,rz),rz],[rx,heightAt(rx,rz)+2.6+(i%3)*.7,rz],.48,.32,[.34,.39,.34],7);}
 structures.box(gx,gy+.35,gz,4,.7,3,[.35,.34,.25]);glow.sphere(gx,gy+1.5,gz,1.0,.35,.8,[.24,.57,.49],2,7,9);
 // Ruined city: broken walls, pillars, stairs and a courtyard
 const rx=-65,rz=-59,ry=heightAt(rx,rz);structures.box(rx,ry+1.2,rz,18,2.4,.8,[.42,.42,.34]);structures.box(rx-8,ry+1.1,rz+8,.8,2.2,13,[.39,.40,.33]);structures.box(rx+7,ry+.8,rz+8,.8,1.6,13,[.4,.4,.34]);for(let i=0;i<5;i++){let xx=rx-6+i*3;structures.cylinder([xx,ry,rz-5],[xx,ry+4+(i%2),rz-5],.55,.42,[.49,.48,.39],8);}for(let i=0;i<5;i++)structures.box(rx+1,ry+.18+i*.32,rz+12+i*1.5,5,.35,1.4,[.38,.37,.31]);
 // Cave entrance facade on the eastern hillside; E enters the interior scene
 const cx=42,cz=23,cy=heightAt(cx,cz)+.1;structures.quad([cx-3.1,cy,cz],[cx+3.1,cy,cz],[cx+2.6,cy+5.2,cz],[cx-2.6,cy+5.2,cz],[.025,.035,.032],0,[0,0,1]);for(let i=0;i<9;i++){let a=Math.PI*i/8,xx=cx+Math.cos(a)*3.4,yy=cy+Math.sin(a)*5.3;rocks.sphere(xx,yy,cz,.85,.9,.8,[.31,.33,.30],0,5,7);}addRock(rocks,cx-3.5,cz,.9);addRock(rocks,cx+3.5,cz,.9);
 // Small landmark cairns, fallen columns and luminous mushrooms
 for(let i=0;i<14;i++){let x=-30+rand()*58,z=-35+rand()*58;if(polyDistance(x,z,trails)<5)continue;addRock(rocks,x,z,.5+rand()*.8,[.32,.36,.31]);}
 for(let i=0;i<26;i++){let x=-48+rand()*90,z=-88+rand()*48;if(polyDistance(x,z,trails)<5)continue;let y=heightAt(x,z);glow.sphere(x,y+.25,z,.18,.32,.18,[.25,.54,.38],2,5,7);}
 // Visible far ridge silhouettes
 for(let i=0;i<16;i++){let x=-110+i*14,z=-112+(i%3)*5,y=heightAt(x,z);rocks.sphere(x,y+7+(i%4)*2,z,10+(i%3)*3,11+(i%4)*2,9,[.31,.37,.34],0,6,8);}
 world.outside=[terrain.mesh(),path.mesh(),water.mesh(),rocks.mesh(),structures.mesh(),wood.mesh(),leaf.mesh(),glow.mesh()];
 buildCave();
}

const landmarks=[
 {id:'village',name:'林息村',x:-82,z:76,range:10,desc:'森林边缘的小村庄。木屋之间晾晒着药草，村民把通往树海深处的石路称为雾桥古道。'},
 {id:'bridge',name:'雾桥古道',x:-45,z:-59,range:9,desc:'古老石桥横跨白冠河的一条支流。桥面磨损严重，石栏上留着不属于现今文字的刻痕。'},
 {id:'waterfall',name:'白冠瀑布',x:-18,z:7,range:12,desc:'河流在这里跌落断层。瀑布背后的岩壁似乎存在一条天然裂隙，水声掩盖了洞内的回响。'},
 {id:'shallows',name:'鹿踪浅滩',x:8,z:48,range:10,desc:'河床在这里变浅，石块间留下了成串的蹄印。清晨常有鹿群来饮水。'},
 {id:'cave',name:'根脉洞穴',x:42,z:23,range:10,desc:'山坡上的黑色洞口向地下延伸。入口岩石带有细密的青色晶脉。'},
 {id:'grove',name:'低语林庭',x:1,z:-68,range:11,desc:'九根古老石柱围绕着一座树根祭坛。风穿过石柱时，会产生近似低语的共鸣。'},
 {id:'ruins',name:'树海断城',x:-65,z:-59,range:12,desc:'古代街道已被树根抬离地面。残存的柱廊说明这里曾经是一座规模不小的城市。'},
 {id:'mother',name:'千冠母树',x:58,z:-52,range:14,desc:'树冠高出周围林海。树干表面有数百年累积的纹理，粗大的根系向四周延伸，像一座沉睡的山。'}
];

buildWorld();

// V0.2 wildlife: compact low-poly meshes are instanced by translation/yaw.
function buildAnimalModels(){
 const deer=new Builder();
 deer.sphere(0,1.18,0,1.05,.58,.62,[.47,.32,.19],0,7,10);
 deer.sphere(0,1.28,.42,.56,.68,.48,[.53,.37,.22],0,7,9);
 deer.cylinder([0,1.45,.42],[0,2.05,.68],.31,.22,[.48,.33,.19],7);
 deer.sphere(0,2.12,.78,.38,.34,.42,[.57,.41,.25],0,7,9);
 deer.sphere(0,2.02,1.12,.23,.17,.25,[.69,.53,.37],0,6,8);
 deer.sphere(-.34,2.18,.78,.12,.12,.23,[.42,.29,.19],0,5,7);deer.sphere(.34,2.18,.78,.12,.12,.23,[.42,.29,.19],0,5,7);
 deer.cylinder([-.16,2.32,.76],[-.35,2.82,.73],.11,.07,[.38,.27,.17],6);deer.cylinder([-.35,2.63,.73],[-.66,2.77,.77],.07,.035,[.38,.27,.17],5);deer.cylinder([-.35,2.63,.73],[-.28,2.91,.77],.06,.03,[.38,.27,.17],5);
 deer.cylinder([.16,2.32,.76],[.35,2.82,.73],.11,.07,[.38,.27,.17],6);deer.cylinder([.35,2.63,.73],[.66,2.77,.77],.07,.035,[.38,.27,.17],5);deer.cylinder([.35,2.63,.73],[.28,2.91,.77],.06,.03,[.38,.27,.17],5);
 for(const x of [-.62,.62])for(const z of [-.38,.42]){deer.cylinder([x,1.0,z],[x*1.08,.12,z],.13,.075,[.39,.27,.16],6);deer.box(x*1.08,.08,z,.25,.16,.28,[.19,.16,.12]);}
 deer.sphere(0,1.38,-.68,.22,.2,.36,[.43,.29,.17],0,5,7);
 const fox=new Builder();
 fox.sphere(0,.82,0,.88,.42,.48,[.72,.32,.13],0,7,9);fox.sphere(0,1.05,.37,.42,.52,.38,[.78,.39,.17],0,7,9);
 fox.sphere(0,1.18,.68,.34,.31,.36,[.83,.48,.22],0,6,8);fox.sphere(0,1.08,.97,.22,.16,.25,[.88,.78,.62],0,5,7);
 fox.pyramid(-.22,1.35,.61,.23,.55,.22,[.66,.27,.12]);fox.pyramid(.22,1.35,.61,.23,.55,.22,[.66,.27,.12]);
 fox.sphere(0,.85,-.77,.32,.29,.92,[.82,.43,.18],0,6,8);fox.sphere(0,.85,-1.48,.28,.26,.38,[.88,.82,.69],0,6,8);
 for(const x of [-.48,.48])for(const z of [-.28,.35])fox.cylinder([x,.62,z],[x,.08,z],.11,.065,[.48,.25,.13],6);
 const rabbit=new Builder();
 rabbit.sphere(0,.58,0,.48,.36,.55,[.55,.48,.39],0,6,8);rabbit.sphere(0,.72,.43,.31,.3,.31,[.62,.55,.45],0,6,8);
 rabbit.cylinder([-.14,.88,.5],[-.2,1.52,.55],.105,.075,[.62,.54,.44],6);rabbit.cylinder([.14,.88,.5],[.2,1.48,.55],.105,.075,[.62,.54,.44],6);
 rabbit.sphere(0,.42,-.52,.2,.2,.22,[.83,.78,.68],0,5,6);rabbit.sphere(-.12,.78,.68,.055,.06,.055,[.08,.07,.06],0,5,6);rabbit.sphere(.12,.78,.68,.055,.06,.055,[.08,.07,.06],0,5,6);
 for(const x of [-.27,.27])rabbit.cylinder([x,.38,-.22],[x,.08,-.28],.09,.055,[.43,.37,.30],5);
 const bird=new Builder();
 bird.sphere(0,.48,0,.43,.3,.62,[.25,.43,.39],0,6,8);bird.sphere(0,.56,.5,.22,.22,.26,[.32,.52,.46],0,5,7);
 bird.pyramid(0,.5,.72,.15,.12,.34,[.78,.62,.32]);
 bird.sphere(-.42,.49,-.03,.48,.10,.36,[.18,.34,.32],0,5,7);bird.sphere(.42,.49,-.03,.48,.10,.36,[.18,.34,.32],0,5,7);
 bird.cylinder([-.16,.27,-.1],[-.18,.03,-.1],.045,.03,[.29,.24,.17],5);bird.cylinder([.16,.27,-.1],[.18,.03,-.1],.045,.03,[.29,.24,.17],5);
 return {deer:deer.mesh(),fox:fox.mesh(),rabbit:rabbit.mesh(),bird:bird.mesh()};
}
const animalModels=buildAnimalModels();
const speciesInfo={
 deer:{name:'苔角鹿',kind:'草食动物',speed:2.25,alert:10,hungerRate:.0038,thirstRate:.0055,food:'grass',habitats:['鹿踪草甸','林缘草地','断城苔地'],color:'#d7b77d'},
 fox:{name:'雾尾狐',kind:'杂食 / 捕食者',speed:2.65,alert:7,hungerRate:.0055,thirstRate:.0065,food:'prey',habitats:['断城苔地','林缘灌丛','根脉洞口'],color:'#e18b50'},
 rabbit:{name:'林地兔',kind:'草食动物',speed:3.15,alert:8,hungerRate:.0052,thirstRate:.006,food:'berries',habitats:['林缘草地','鹿踪草甸','断城苔地'],color:'#c9c0aa'},
 bird:{name:'雾翎鸟',kind:'杂食 / 群居',speed:3.4,alert:12,hungerRate:.004,thirstRate:.005,food:'seeds',habitats:['低语林庭','鹿踪草甸','母树冠层'],color:'#79aaa0'}
};
const habitats=[
 {id:'meadow',name:'鹿踪草甸',x:9,z:49,r:20,species:['deer','rabbit','bird']},
 {id:'edge',name:'林缘草地',x:-76,z:62,r:19,species:['deer','rabbit','fox']},
 {id:'ruin',name:'断城苔地',x:-64,z:-57,r:18,species:['fox','rabbit','bird']},
 {id:'grove',name:'低语林庭',x:1,z:-68,r:17,species:['bird','deer']},
 {id:'mother',name:'母树根圃',x:58,z:-52,r:18,species:['deer','bird','fox']},
 {id:'cave',name:'根脉洞口',x:42,z:23,r:15,species:['fox','rabbit']}
];
const foodNodes=[
 {id:'grass-meadow',x:8,z:49,type:'grass',stock:1,max:1,rate:.0022},
 {id:'grass-edge',x:-77,z:64,type:'grass',stock:.9,max:1,rate:.0018},
 {id:'grass-ruin',x:-65,z:-55,type:'grass',stock:.8,max:1,rate:.0015},
 {id:'grass-mother',x:52,z:-45,type:'grass',stock:.85,max:1,rate:.0018},
 {id:'berries-edge',x:-62,z:43,type:'berries',stock:1,max:1,rate:.0025},
 {id:'berries-grove',x:-8,z:-61,type:'berries',stock:.75,max:1,rate:.002},
 {id:'seeds-meadow',x:19,z:38,type:'seeds',stock:1,max:1,rate:.003},
 {id:'seeds-ruin',x:-45,z:-47,type:'seeds',stock:.8,max:1,rate:.002}
];
const waterNodes=[
 {id:'water-shallows',name:'鹿踪浅滩',x:8,z:48,r:5},
 {id:'water-fall',name:'白冠瀑布水潭',x:-18,z:16,r:5},
 {id:'water-riverbend',name:'白冠河湾',x:-49,z:-76,r:5},
 {id:'water-upper',name:'林间泉眼',x:42,z:87,r:4}
];
const restNodes=[
 {id:'rest-grove',x:1,z:-68,type:'shade'},
 {id:'rest-mother',x:58,z:-52,type:'canopy'},
 {id:'rest-edge',x:-76,z:62,type:'burrow'},
 {id:'rest-fox',x:-43,z:-29,type:'den'},
 {id:'rest-cave',x:42,z:23,type:'den'}
];
let animalSerial=0;
function makeAnimal(species,x,z,yaw=0,population=null){const a={id:population?.id||'wild-'+(++animalSerial),species,x,z,yaw,state:population?'rest':'idle',target:null,hunger:population?.ageDays<3?.16:.28+Math.random()*.18,thirst:.2+Math.random()*.2,energy:.9,decision:Math.random()*1.5,alertTimer:0,alive:true,respawn:0,age:0,habitat:null,huntTarget:null,permanentDeath:false,population:population||null};if(population){a.sex=population.sex;a.ageDays=population.ageDays;a.lifeStage=WorldEcology.stageFor(species,population.ageDays);a.decision=1.1;}return a;}
const animals=[];
[[6,45],[10,50],[14,44],[1,51],[-2,43]].forEach((p,i)=>animals.push(makeAnimal('deer',p[0],p[1],i*.4)));
[[-42,-25],[-54,-35]].forEach((p,i)=>animals.push(makeAnimal('fox',p[0],p[1],i*1.2)));
[[-78,50],[-67,58],[-58,43],[-49,53],[-73,31]].forEach((p,i)=>animals.push(makeAnimal('rabbit',p[0],p[1],i*.7)));
[[20,35],[25,39],[30,34],[36,41],[42,35],[14,30]].forEach((p,i)=>animals.push(makeAnimal('bird',p[0],p[1],i*.5)));
const ecology={time:0,dayAccumulator:0,events:[],observed:new Set(),cooldowns:{},uiTimer:0,eventSerial:0,lastMigrationPhase:'',predationCount:0};
const populationState=WorldEcology.createState(20261118,animals,habitats);
// Spatial vegetation state shares the same animal coordinates and seasonal clock.
const motherTreeCollider=treeColliders[treeColliders.length-1]; // the landmark tree remains a fixed world monument
const vegetationTreeSeeds=treeColliders.slice(0,-1).map((t,i)=>({x:t[0],z:t[1],scale:clamp(t[2]/1.15,.55,1.7),species:i%5===0?'pine':'broadleaf',seed:i}));
const vegetationState=WorldVegetation.createState(20261118,vegetationTreeSeeds);
const forestCommunity=WorldForest.createState(vegetationState,20261119);
let vegetationLastResult=null;
let vegetationMeshes={wood:null,leaves:null,roots:null,understory:null,litter:null};
let vegetationVisualRevision=0;
let vegetationVisualCounts={liveTrees:0,seedlings:0,snags:0,shrubs:0,grassPatches:0,tracks:0,rootSystems:0,forestRichness:0};

// Build render meshes from the spatial ecology state. The forest is no longer a static batch.
function seasonVegetationPalette(season){
 const palettes={spring:{leaf:[.18,.39,.22],leaf2:[.25,.48,.27],grass:[.23,.43,.22],shrub:[.19,.38,.22]},summer:{leaf:[.12,.32,.17],leaf2:[.18,.40,.22],grass:[.22,.39,.18],shrub:[.15,.32,.18]},autumn:{leaf:[.66,.36,.13],leaf2:[.79,.49,.18],grass:[.48,.40,.20],shrub:[.54,.32,.16]},winter:{leaf:[.40,.34,.25],leaf2:[.48,.40,.29],grass:[.35,.38,.32],shrub:[.36,.34,.28]}};return palettes[season]||palettes.spring;
}
function addDynamicTree(wood,leaves,falling,t,season){
 const x=t.x,z=t.z,y=heightAt(x,z),scale=clamp(t.size,.16,1.85),seed=t.seed||0;
 const h=(8+(Math.abs(seed)%5))*scale, trunkR=Math.max(.055,.34*scale), health=clamp(t.health,.05,1), species=t.species||'broadleaf';
 const pine=species==='pine'||species==='cedar',willow=species==='willow',birch=species==='birch';
 const bark=birch?[.70,.67,.53]:willow?[.30,.23,.16]:health<.3?[.30,.24,.16]:[.25,.18,.12];
 wood.cylinder([x,y,z],[x,y+h,z],trunkR*1.25,trunkR*.48,bark,7);
 for(let k=0;k<5;k++){
  const a=(seed*.71+k*2.399),by=y+h*(.38+k*.105),len=h*(.18+(k%2)*.035),ex=x+Math.cos(a)*len,ez=z+Math.sin(a)*len;
  const ey=willow?by+len*.18:by+len*.52;
  wood.cylinder([x,by,z],[ex,ey,ez],Math.max(.035,trunkR*.43),Math.max(.018,trunkR*.13),bark,5);
 }
 let leafFactor=pine?.94:(season==='autumn'?.52:season==='winter'?.10:season==='spring'?.88:1);leafFactor*=.28+.72*health;
 if(leafFactor>.035){
  const pal=seasonVegetationPalette(season);
  let c1=species==='pine'?[.13,.31,.19]:species==='cedar'?[.10,.27,.17]:species==='willow'?[.27,.43,.23]:species==='birch'?[.31,.48,.24]:pal.leaf;
  let c2=species==='pine'?[.16,.36,.21]:species==='cedar'?[.14,.33,.20]:species==='willow'?[.38,.53,.29]:species==='birch'?[.42,.57,.30]:pal.leaf2;
  if(health<.32){c1=[.39,.29,.16];c2=[.48,.34,.17];}
  if(pine){const tiers=species==='cedar'?5:4;for(let k=0;k<tiers;k++){const f=.36+k*.135,r=(species==='cedar'?2.9:2.45-k*.28)*scale;leaves.sphere(x,y+h*f,z,r*leafFactor,Math.max(.25,1.7*scale),r*leafFactor,k%2?c2:c1,0,5,7);}}
  else if(willow){for(let k=0;k<6;k++){const a=seed*.37+k*1.047,rr=2.0*scale,fx=x+Math.cos(a)*rr,fz=z+Math.sin(a)*rr;leaves.sphere(fx,y+h*.76-(k%2)*.6,fz,1.05*scale*leafFactor,2.15*scale*leafFactor,1.05*scale*leafFactor,k%2?c2:c1,0,5,7);}}
  else {const r=leafFactor,canopyScale=birch?.78:1;leaves.sphere(x,y+h*.82,z,2.5*scale*r*canopyScale,3.0*scale*r*canopyScale,2.4*scale*r*canopyScale,c1,0,6,8);leaves.sphere(x-1.45*scale*r,y+h*.77,z+.65*scale*r,2.0*scale*r*canopyScale,2.25*scale*r*canopyScale,2.0*scale*r*canopyScale,c2,0,6,8);leaves.sphere(x+1.45*scale*r,y+h*.88,z-.55*scale*r,2.1*scale*r*canopyScale,2.45*scale*r*canopyScale,2.0*scale*r*canopyScale,c1,0,6,8);leaves.sphere(x+.2*scale*r,y+h*1.03,z+.25*scale*r,1.75*scale*r*canopyScale,1.95*scale*r*canopyScale,1.7*scale*r*canopyScale,c2,0,6,8);}
 }
 if(!pine&&season==='autumn'&&health>.22){const fallColor=health<.45?[.50,.29,.12]:[.75,.43,.15];for(let k=0;k<2+(Math.abs(seed)%2);k++){const a=seed*.37+k*2.399,fx=x+Math.cos(a)*2.0*scale,fz=z+Math.sin(a)*1.7*scale,fy=y+h*.83+2.7+(k%2)*.5;falling.quad([fx-.18,fy,fz-.07],[fx,fy+.03,fz-.16],[fx+.18,fy,fz+.08],[fx-.02,fy-.01,fz+.16],fallColor,3,[0,1,0]);}}
 return leafFactor;
}
function addSurfaceRoots(rootBuilder,t){
 const x=t.x,z=t.z,y=heightAt(x,z)+.10,s=clamp(t.size,.18,1.8),radius=clamp(t.rootRadius||(.7+s*1.1),.8,5.5),count=5+(Math.abs(t.seed||0)%3),baseR=.055+.045*s;
 for(let k=0;k<count;k++){const a=(t.seed||0)*.71+k*Math.PI*2/count,reach=radius*(.72+.22*Math.sin(k*2.1));const ex=x+Math.cos(a)*reach,ez=z+Math.sin(a)*reach,ey=heightAt(ex,ez)+.045;const mx=x+Math.cos(a)*reach*.52,mz=z+Math.sin(a)*reach*.52,my=heightAt(mx,mz)+.08;rootBuilder.cylinder([x,y,z],[mx,my,mz],baseR,baseR*.68,[.25,.18,.12],5);rootBuilder.cylinder([mx,my,mz],[ex,ey,ez],baseR*.68,.018,[.27,.20,.13],5);}
}
function addDeadTree(wood,t){
 const x=t.x,z=t.z,y=heightAt(x,z),s=clamp(t.size,.2,1.8),r=.30*s;
 const deadBark=t.burned?[.12,.105,.075]:[.29,.23,.16];if(!t.fallen&&(t.snagDays||0)<75){wood.cylinder([x,y,z],[x,y+5.2*s,z],r*1.2,r*.34,deadBark,6);wood.cylinder([x,y+3.3*s,z],[x+1.2*s,y+5.5*s,z+.55*s],r*.45,.035,deadBark,5);wood.cylinder([x,y+2.4*s,z],[x-1.05*s,y+3.8*s,z-.4*s],r*.42,.03,deadBark,5);}
 else {wood.cylinder([x,y+.48*s,z],[x+4.6*s,y+.16*s,z+1.2*s],r*1.1,r*.72,deadBark,7);wood.cylinder([x+2.2*s,y+.3*s,z+.6*s],[x+2.8*s,y+1.2*s,z+.2*s],r*.36,.025,deadBark,5);}
}
function addSeedlingMesh(wood,leaves,x,z,y,seedling,season,cellId,index){
 const age=clamp(seedling.age/180,0,1),health=clamp(seedling.health,.05,1),h=(.42+age*1.65)*(.65+.35*health),r=.045+age*.055;
 wood.cylinder([x,y,z],[x,y+h,z],r,.025,[.30,.23,.15],5);
 const green=season==='autumn'?[.55,.38,.17]:season==='winter'?[.35,.37,.27]:[.20,.42,.23];
 if(seedling.species==='pine'){for(let k=0;k<3;k++)leaves.sphere(x,y+h*(.42+k*.23),z,(.22+age*.22)*(1-k*.12),.24+age*.12,(.22+age*.22)*(1-k*.12),[.13,.32,.19],0,4,6);}
 else leaves.sphere(x,y+h*.78,z,.20+age*.38,.19+age*.22,.20+age*.34,green,0,4,6);
}
// V0.6 visual pass: procedural fern rosettes add a distinct understory silhouette.
function addFernCluster(builder,x,z,y,scale,seed,season){
 const autumn=season==='autumn',winter=season==='winter';
 const greens=autumn?[[.48,.35,.16],[.62,.43,.20]]:winter?[[.28,.34,.24],[.36,.42,.29]]:[[.12,.34,.16],[.20,.46,.22],[.29,.53,.25]];
 const fronds=7+(Math.abs(seed)%4);
 for(let f=0;f<fronds;f++){const a=f*Math.PI*2/fronds+(seed%17)*.13,len=scale*(1.05+((f*7+seed)%5)*.11),rise=scale*(.42+((f*3+seed)%4)*.09),dx=Math.cos(a),dz=Math.sin(a),px=-dz,pz=dx;let prev=[x,y+.04,z];
  for(let k=1;k<=6;k++){const t=k/6,point=[x+dx*len*t,y+.04+rise*Math.sin(t*Math.PI*.78),z+dz*len*t],width=scale*(.22*Math.sin(Math.PI*t))*(1-.22*t),col=greens[(f+k)%greens.length];if(k>1){const back=[prev[0]-px*width*.5,prev[1],prev[2]-pz*width*.5],front=[prev[0]+px*width*.5,prev[1],prev[2]+pz*width*.5];builder.tri(back,front,[point[0],point[1]+.025,point[2]],col,0,[0,1,0]);}if(k<6)for(const sign of [-1,1]){const bx=point[0]+px*width*.95*sign,bz=point[2]+pz*width*.95*sign;builder.tri(point,[bx,point[1]+.025,bz],[bx+dx*scale*.12+px*width*.2*sign,point[1]+.045,bz+dz*scale*.12+pz*width*.2*sign],col,0,[0,1,0]);}prev=point;}
  builder.cylinder([x,y+.04,z],[x+dx*len*.72,y+rise*.55,z+dz*len*.72],.018*scale,.006*scale,[.24,.29,.13],4);
 }
}
function refreshVegetationMeshes(){
 const season=vegetationState.season||populationState.season?.id||'spring',pal=seasonVegetationPalette(season);
 const wood=new Builder(),leaves=new Builder(),falling=new Builder(),roots=new Builder(),under=new Builder(),litter=new Builder();
 let liveTrees=0,seedlings=0,snags=0,shrubs=0,grassPatches=0,tracks=0,ferns=0,sizeTotal=0,healthTotal=0,leafFactorTotal=0;
 for(const t of vegetationState.trees){if(t.alive){leafFactorTotal+=addDynamicTree(wood,leaves,falling,t,season);addSurfaceRoots(roots,t);sizeTotal+=t.size;healthTotal+=t.health;liveTrees++;}else if((t.snagDays||0)<180){addDeadTree(wood,t);snags++;}}
 for(let ci=0;ci<vegetationState.cells.length;ci++){const c=vegetationState.cells[ci],y=heightAt(c.x,c.z)+.055;
  if(c.grass>.025){const g=clamp(c.grass,0,1);under.sphere(c.x,y,c.z,5.8*g,.055+g*.045,5.8*g,pal.grass,0,3,6);grassPatches++;if(g>.38&&((ci*17)%5!==0)){const n=1+(ci%3);for(let fi=0;fi<n;fi++){const a=ci*2.399+fi*2.1,rr=1+fi*.85,fx=c.x+Math.cos(a)*rr,fz=c.z+Math.sin(a)*rr;addFernCluster(under,fx,fz,heightAt(fx,fz)+.08,.72+g*.62,ci*13+fi,season);ferns++;}}}
  if(c.shrub>.06){const sh=clamp(c.shrub,0,1),n=sh>.58?3:2;for(let j=0;j<n;j++){const a=(ci*2.399+j*2.1),rr=2.0+sh*2.6,xx=c.x+Math.cos(a)*rr,zz=c.z+Math.sin(a)*rr;under.sphere(xx,heightAt(xx,zz)+.55*sh,zz,.55+1.05*sh,.45+.65*sh,.55+1.05*sh,pal.shrub,0,4,6);shrubs++;}}
  if(c.disturbance>.16){const kind=c.disturbanceType||'trample',col=kind==='fire'?[.105,.095,.068]:kind==='flood'?[.39,.34,.24]:kind==='windthrow'?[.30,.22,.13]:kind==='pest'?[.32,.25,.15]:[.28,.23,.15];under.sphere(c.x-.7,y+.035,c.z+.6,1.4+3.2*c.disturbance,.035,1.3+3.0*c.disturbance,col,0,4,7);}
  if(c.trampling>.055||c.herbivory>.10){const mark=Math.max(c.trampling,c.herbivory*.55);under.sphere(c.x+.8,y+.025,c.z-.7,1.1+2.3*mark,.025,1.0+1.8*mark,[.28,.23,.15],0,3,5);if(c.trampling>.12){for(let k=0;k<Math.min(4,Math.floor(c.trampling*8));k++){const a=k*2.4,xx=c.x+Math.cos(a)*1.6,zz=c.z+Math.sin(a)*1.6;under.sphere(xx,heightAt(xx,zz)+.09,zz,.18,.035,.27,[.24,.20,.13],0,3,5);tracks++;}}}
  if(c.litter>.10){const count=Math.min(7,Math.floor(c.litter*8));for(let k=0;k<count;k++){const a=(ci*7+k*2.399),rr=1.0+(k%3)*.75,xx=c.x+Math.cos(a)*rr,zz=c.z+Math.sin(a)*rr,yy=heightAt(xx,zz)+.10;litter.quad([xx-.18,yy,zz-.08],[xx,yy+.018,zz-.16],[xx+.19,yy,zz+.08],[xx-.02,yy,zz+.16],season==='autumn'?[.55,.31,.12]:[.34,.28,.17],0,[0,1,0]);}}
  const visible=c.seedlings.slice(0,12);for(let j=0;j<visible.length;j++){const q=visible[j],a=(ci*12.9898+j*78.233),xx=c.x+Math.sin(a)*4.2,zz=c.z+Math.cos(a*1.37)*4.2;addSeedlingMesh(wood,leaves,xx,zz,heightAt(xx,zz)+.04,q,season,ci,j);seedlings++;}
 }
 const nextMeshes={wood:wood.mesh(),leaves:leaves.mesh(),roots:roots.mesh(),falling:falling.mesh(),understory:under.mesh(),litter:litter.mesh()};
 for(const old of Object.values(vegetationMeshes)){if(old?.vao)gl.deleteVertexArray(old.vao);for(const b of old?.buffers||[])gl.deleteBuffer(b);}
 vegetationMeshes=nextMeshes;
 vegetationVisualCounts={liveTrees,seedlings,snags,shrubs,grassPatches,ferns,tracks,rootSystems:liveTrees,forestRichness:WorldForest.snapshot(vegetationState,forestCommunity).richness,season,meanTreeSize:liveTrees?sizeTotal/liveTrees:0,meanTreeHealth:liveTrees?healthTotal/liveTrees:0,meanLeafFactor:liveTrees?leafFactorTotal/liveTrees:0};vegetationVisualRevision++;
 // Collision now follows living trees, so recruits become physical parts of the forest.
 treeColliders.length=0;for(const t of vegetationState.trees)if(t.alive)treeColliders.push([t.x,t.z,Math.max(.32,1.15*t.size)]);if(motherTreeCollider)treeColliders.push(motherTreeCollider);
}
refreshVegetationMeshes();
for(const n of foodNodes)n.baseRate=n.rate;
const stateNames={idle:'停留观察',forage:'觅食',drink:'饮水',migrate:'迁徙',rest:'休息',flee:'逃逸',hunt:'追踪猎物',perch:'栖枝'};
function dayHour(){return (6+ecology.time*.08)%24;}
function dayPhase(){const h=dayHour();return h<5||h>=20?'夜晚':h<8?'清晨':h<17?'白昼':'黄昏';}
function nearestNode(a,nodes,filter=()=>true){let best=null,score=1e9;for(const n of nodes){if(!filter(n))continue;const d=Math.hypot(a.x-n.x,a.z-n.z);const v=d+(n.stock!==undefined?(1-n.stock)*18:0);if(v<score){score=v;best=n;}}return best;}
function nearestHabitat(a){let best=habitats.find(h=>h.species.includes(a.species)),bd=1e9;for(const h of habitats){if(!h.species.includes(a.species))continue;const d=Math.hypot(a.x-h.x,a.z-h.z);if(d<bd){best=h;bd=d;}}return best;}
function ecoEvent(type,title,description,quiet=false){const now=ecology.time,last=ecology.cooldowns[type]??-1e9;if(now-last<24)return null;ecology.cooldowns[type]=now;const ev={id:++ecology.eventSerial,type,title,description,time:now,phase:dayPhase()};ecology.events.unshift(ev);ecology.events=ecology.events.slice(0,12);if(started&&!player.insideCave&&!quiet)setToast(title,description);return ev;}
function setAnimalState(a,state,target=null){if(a.state!==state){const old=a.state;a.state=state;if(state==='migrate'&&a.species==='deer')ecoEvent('deer_migration','鹿群开始迁徙','苔角鹿正在离开当前觅食地，沿林间通道前往新的栖息区域。');if(state==='hunt'&&a.species==='fox')ecoEvent('fox_hunt','林间捕猎','一只雾尾狐放慢脚步，开始追踪附近的林地兔。');if(state==='drink'&&a.species==='deer')ecoEvent('deer_drink','鹿群来到水边','几只苔角鹿在浅滩附近停下，轮流低头饮水。',true);if(state==='flee'&&a.species==='bird')ecoEvent('bird_flight','鸟群惊飞','树冠上的雾翎鸟突然振翅，飞向更深的林地。');}
 a.target=target;}
function selectRoutine(a){const h=dayHour(),night=h<5||h>=20,dusk=h>=17&&h<20;
 if(a.species==='deer'){if(night||dusk){const n=nearestNode(a,restNodes,n=>n.id==='rest-mother'||n.id==='rest-grove');setAnimalState(a,'migrate',{x:n.x,z:n.z,kind:'rest'});}else{const n=nearestNode(a,foodNodes,n=>n.type==='grass'&&n.stock>.12);if(n)setAnimalState(a,'migrate',{x:n.x,z:n.z,kind:'food',node:n});else{const r=nearestNode(a,restNodes);setAnimalState(a,'rest',{x:r.x,z:r.z,kind:'rest'});}}}
 else if(a.species==='bird'){if(night){const n=nearestNode(a,restNodes,n=>n.id==='rest-grove'||n.id==='rest-mother');setAnimalState(a,'migrate',{x:n.x,z:n.z,kind:'perch'});}else{const n=nearestNode(a,foodNodes,n=>n.type==='seeds'&&n.stock>.12);if(n)setAnimalState(a,'migrate',{x:n.x,z:n.z,kind:'food',node:n});else{const r=nearestNode(a,restNodes);setAnimalState(a,'perch',{x:r.x,z:r.z,kind:'perch'});}}}
 else if(a.species==='fox'&&night){const n=nearestNode(a,restNodes,n=>n.id==='rest-fox'||n.id==='rest-cave');setAnimalState(a,'rest',{x:n.x,z:n.z,kind:'rest'});}
}
function decideAnimal(a){if(!a.alive)return;
 const info=speciesInfo[a.species];
 if(a.alertTimer>0){setAnimalState(a,'flee',a.target);return;}
 if(a.thirst>.62){const n=nearestNode(a,waterNodes);setAnimalState(a,'drink',{x:n.x+(a.id.charCodeAt(5)%3-1)*1.2,z:n.z+2.2,kind:'water',node:n});return;}
 if(a.species==='fox'&&a.hunger>.43){let prey=null,bd=24;for(const r of animals){if(r.species!=='rabbit'||!r.alive)continue;const d=Math.hypot(a.x-r.x,a.z-r.z);if(d<bd){bd=d;prey=r;}}if(prey){a.huntTarget=prey.id;setAnimalState(a,'hunt',{x:prey.x,z:prey.z,kind:'prey',animal:prey});return;}}
 if(a.hunger>.48){let n=nearestNode(a,foodNodes,node=>node.type===info.food&&node.stock>.12);if(n){setAnimalState(a,'forage',{x:n.x,z:n.z,kind:'food',node:n});return;}}
 if(a.energy<.24){let n=nearestNode(a,restNodes);setAnimalState(a,'rest',{x:n.x,z:n.z,kind:'rest',node:n});return;}
 if(a.species==='deer'||a.species==='bird'){selectRoutine(a);return;}
 const h=nearestHabitat(a);a.habitat=h?.name||'林地';setAnimalState(a,a.species==='bird'?'perch':'idle',{x:h.x+(Math.sin(a.age)*h.r*.35),z:h.z+(Math.cos(a.age)*h.r*.35),kind:'roam'});
}
function fleeFrom(a,x,z){const dx=a.x-x,dz=a.z-z,l=Math.hypot(dx,dz)||1;const d=speciesInfo[a.species].alert+5;setAnimalState(a,'flee',{x:clamp(a.x+dx/l*d,-112,112),z:clamp(a.z+dz/l*d,-112,112),kind:'escape'});a.alertTimer=4.5+Math.random()*2;}
const ECO_DAY_SECONDS=300;
function foodIndexNow(){const stock=foodNodes.reduce((v,n)=>v+n.stock/Math.max(.001,n.max),0)/foodNodes.length;const veg=populationState.habitats.reduce((v,h)=>v+h.biomass,0)/populationState.habitats.length;return clamp(stock*.56+veg*.44,.12,1);}
function applySeasonalFoodRates(season){for(const n of foodNodes)n.rate=n.baseRate*(season.food[n.type]??1);}
function syncPopulationDay(result){
 for(const p of result.deaths){const a=animals.find(v=>v.id===p.id);if(a){a.alive=false;a.permanentDeath=true;a.deathCause=p.deathCause;a.state='dead';a.target=null;}}
 for(const k of result.predationKills||[]){const a=animals.find(v=>v.id===k.prey);if(a){a.alive=false;a.permanentDeath=true;a.deathCause='predation';a.state='dead';a.target=null;}}
 for(const p of result.births){const h=habitats.find(v=>v.id===p.habitatId)||habitats[0];const x=h.x+(Math.random()-.5)*h.r*.28,z=h.z+(Math.random()-.5)*h.r*.28;const child=makeAnimal(p.species,x,z,Math.random()*Math.PI*2,p);child.hunger=.12;child.thirst=.12;child.energy=.96;animals.push(child);}
 for(const d of result.dispersals||[]){const a=animals.find(v=>v.id===d.id&&v.alive),h=habitats.find(v=>v.id===d.to);if(a&&h)setAnimalState(a,'migrate',{x:h.x+(Math.random()-.5)*h.r*.25,z:h.z+(Math.random()-.5)*h.r*.25,kind:'territory'});}
 for(const e of result.events||[])ecoEvent(e.type,e.title,e.description,true);
 if(result.seasonChanged){const names={spring:'春季',summer:'夏季',autumn:'秋季',winter:'冬季'};setToast('季节更替 · '+names[result.season.id],'雾隐树海的植物生长、食物供给和动物活动节律正在改变。');}
}
function advancePopulationDays(days,foodIndex=null,refreshVisual=true){let last=null;for(let i=0;i<days;i++){last=WorldEcology.stepDay(populationState,{foodIndex:foodIndex===null?foodIndexNow():foodIndex});syncPopulationDay(last);applySeasonalFoodRates(last.season);vegetationLastResult=WorldVegetation.stepDay(vegetationState,{season:last.season.id,animals:animals.filter(a=>a.alive).map(a=>({species:a.species,x:a.x,z:a.z,alive:a.alive})),climate:{drought:populationState.season.id==='summer'?.82:1}});WorldForest.stepDay(vegetationState,forestCommunity,{season:last.season.id,allowNaturalDisturbance:true});}if(refreshVisual&&days>0)refreshVegetationMeshes();return WorldEcology.snapshot(populationState);}
function stepEcology(dt){if(dt<=0)return;ecology.time+=dt;ecology.dayAccumulator+=dt;let ecologyDayChanged=false;while(ecology.dayAccumulator>=ECO_DAY_SECONDS){ecology.dayAccumulator-=ECO_DAY_SECONDS;advancePopulationDays(1,null,false);ecologyDayChanged=true;}if(ecologyDayChanged)refreshVegetationMeshes();
 for(const n of foodNodes)n.stock=Math.min(n.max,n.stock+n.rate*dt);
 // Population-level perception: nearby player and predator-prey interactions.
 if(!player.insideCave){for(const a of animals){if(!a.alive)continue;const d=Math.hypot(a.x-player.x,a.z-player.z);if(d<speciesInfo[a.species].alert&&a.alertTimer<=0){fleeFrom(a,player.x,player.z);if(a.species==='bird')ecoEvent('bird_flight','鸟群惊飞','你的脚步惊动了附近的雾翎鸟，它们掠过树冠飞向林深处。');}}}
 // Predator scent / prey response: rabbits detect nearby foxes even when the player is absent.
 for(const fox of animals){if(fox.species!=='fox'||!fox.alive)continue;for(const rabbit of animals){if(rabbit.species!=='rabbit'||!rabbit.alive||rabbit.alertTimer>0)continue;const d=Math.hypot(fox.x-rabbit.x,fox.z-rabbit.z);if(d<10)fleeFrom(rabbit,fox.x,fox.z);}}
 for(const a of animals){if(!a.alive){if(a.permanentDeath)continue;a.respawn-=dt;if(a.respawn<=0){a.alive=true;a.hunger=.35;a.thirst=.3;a.energy=.8;const h=nearestHabitat(a);a.x=h.x+(Math.random()-.5)*h.r*.7;a.z=h.z+(Math.random()-.5)*h.r*.7;a.state='idle';a.target=null;}continue;}
  const info=speciesInfo[a.species];a.age+=dt;a.hunger=Math.min(1,a.hunger+info.hungerRate*dt);a.thirst=Math.min(1,a.thirst+info.thirstRate*dt);a.energy=Math.max(0,a.energy-.0015*dt);
  if(a.alertTimer>0){a.alertTimer=Math.max(0,a.alertTimer-dt);if(a.alertTimer===0)a.decision=0;}
  a.decision-=dt;
  if(a.species==='fox'&&a.state==='hunt'&&a.huntTarget){const prey=animals.find(r=>r.id===a.huntTarget&&r.alive);if(!prey){a.huntTarget=null;a.decision=0;}else{a.target={x:prey.x,z:prey.z,kind:'prey',animal:prey};if(Math.hypot(a.x-prey.x,a.z-prey.z)<1.65){WorldEcology.recordPredation(populationState,prey.id,a.id);prey.alive=false;prey.permanentDeath=true;prey.deathCause='predation';prey.state='dead';prey.target=null;a.huntTarget=null;a.hunger=Math.max(0,a.hunger-.55);ecology.predationCount++;ecoEvent('predation','捕食事件','一只雾尾狐成功捕获林地兔。猎物死亡会影响种群数量，后续由繁殖补充。');a.decision=0;}}}
  if(a.decision<=0){decideAnimal(a);a.decision=1.4+(a.id.charCodeAt(a.id.length-1)%7)*.23;}
  if(!a.target)continue;
  const dx=a.target.x-a.x,dz=a.target.z-a.z,d=Math.hypot(dx,dz);
  if((a.state==='drink'||a.state==='forage'||a.state==='rest'||a.state==='perch')&&d<2.0){
   if(a.state==='drink'){a.thirst=Math.max(0,a.thirst-.24*dt);a.energy=Math.min(1,a.energy+.025*dt);}
   if(a.state==='forage'){if(a.target.node&&a.target.node.stock>.02){a.hunger=Math.max(0,a.hunger-.17*dt);a.target.node.stock=Math.max(0,a.target.node.stock-.055*dt);}else{a.target=null;a.decision=0;}}
   if(a.state==='rest'||a.state==='perch'){a.energy=Math.min(1,a.energy+.12*dt);a.hunger=Math.min(1,a.hunger+.001*dt);}
   if(a.state==='drink'&&a.thirst<.22){a.target=null;a.decision=0;}
   if(a.state==='forage'&&a.hunger<.18){a.target=null;a.decision=0;}
   if((a.state==='rest'||a.state==='perch')&&a.energy>.88){a.target=null;a.decision=0;}
   continue;
  }
  if(d<1.6&&a.state==='migrate'){if(a.target.kind==='food')setAnimalState(a,'forage',{x:a.target.x,z:a.target.z,kind:'food',node:a.target.node});else if(a.target.kind==='perch')setAnimalState(a,'perch',a.target);else setAnimalState(a,'rest',a.target);continue;}
  const speed=info.speed*(a.state==='flee'?1.55:a.state==='hunt'?1.22:a.state==='migrate'?1.08:1);
  const step=Math.min(d,speed*dt);if(d>.01){let nx=a.x+dx/d*step,nz=a.z+dz/d*step;
   // Lightweight trunk avoidance: attempt a lateral slide before abandoning the target.
   const radius=a.species==='deer'?.58:a.species==='fox'?.42:a.species==='rabbit'?.28:.22;
   const blockedAt=(x,z)=>treeColliders.some(c=>Math.hypot(x-c[0],z-c[1])<c[2]+radius);
   if(blockedAt(nx,nz)){const sideX=-dz/d*step*1.7,sideZ=dx/d*step*1.7;const candidates=[[nx+sideX,nz+sideZ],[nx-sideX,nz-sideZ]];const free=candidates.find(c=>!blockedAt(c[0],c[1]));if(free){nx=free[0];nz=free[1];}else{a.target=null;a.decision=0;continue;}}
   // Avoid steep cliff edges and keep wildlife inside the playable forest region.
   const candidateY=heightAt(nx,nz);if(candidateY<heightAt(a.x,a.z)-2.8){a.target=null;a.decision=0;}else{a.x=clamp(nx,-108,108);a.z=clamp(nz,-108,108);a.yaw=Math.atan2(dx,dz);a.energy=Math.max(0,a.energy-.012*dt);}
  }
 }
 ecology.uiTimer-=dt;if(ecology.uiTimer<=0){updateEcologyUI();ecology.uiTimer=.8;}
}
function animalCounts(){const out={deer:0,fox:0,rabbit:0,bird:0};for(const a of animals)if(a.alive)out[a.species]++;return out;}
function stateCounts(){const out={};for(const a of animals)if(a.alive)out[a.state]=(out[a.state]||0)+1;return out;}
function updateEcologyUI(){const counts=animalCounts(),summary=$('ecoSummary');if(!summary)return;const pop=WorldEcology.snapshot(populationState),seasonNames={spring:'春季',summer:'夏季',autumn:'秋季',winter:'冬季'};summary.innerHTML=`<div class="ecoCounts"><span>苔角鹿 <b>${counts.deer}</b></span><span>雾尾狐 <b>${counts.fox}</b></span><span>林地兔 <b>${counts.rabbit}</b></span><span>雾翎鸟 <b>${counts.bird}</b></span></div><p>当前时段：<b>${dayPhase()}</b> · ${seasonNames[pop.season]} · 第 ${pop.day} 个生态日</p><p>已观察物种：${ecology.observed.size}/4 · 觅食点：${foodNodes.filter(n=>n.stock>.2).length}/${foodNodes.length} · 水源：${waterNodes.length}</p>`;
 const age=$('ecoPopulation');if(age){age.innerHTML=Object.entries(pop.ageStructure).map(([sp,st])=>`<div class="ecoAgeRow"><b>${speciesInfo[sp].name}</b><span>幼崽 ${st['幼崽']} · 幼年 ${st['幼年']} · 亚成年 ${st['亚成年']} · 成年 ${st['成年']} · 老年 ${st['老年']}</span></div>`).join('')+`<div class="ecoStatLine">出生 ${pop.stats.births} · 死亡 ${pop.stats.deaths} · 捕食 ${pop.stats.predations}<br>领地冲突 ${pop.stats.territoryConflicts} · 扩散 ${pop.stats.dispersals}</div>`;}
 const succession=$('ecoSuccession');if(succession){succession.innerHTML=pop.vegetation.map(h=>`<div class="ecoHabitatRow"><span>${habitats.find(v=>v.id===h.id)?.name||h.id}</span><b>${h.stage}</b><i><em style="width:${Math.round(h.biomass*100)}%"></em></i></div>`).join('');}
 const veg=$('ecoVegetation');if(veg){const v=WorldVegetation.snapshot(vegetationState);veg.innerHTML=`<div class="ecoStatLine">活树 ${v.trees} · 幼树 ${v.seedlings} · 枯木 ${v.deadSnags}<br>平均林冠 ${Math.round(v.meanCanopy*100)}% · 林下草本 ${Math.round(v.meanGrass*100)}% · 灌丛 ${Math.round(v.meanShrub*100)}%<br>落叶量 ${v.stats.leafDropMass.toFixed(2)} · 动物取食 ${v.stats.plantConsumption.toFixed(2)}<br>三维可见：活树 ${vegetationVisualCounts.liveTrees} · 幼苗 ${vegetationVisualCounts.seedlings} · 枯木 ${vegetationVisualCounts.snags}<br>灌丛簇 ${vegetationVisualCounts.shrubs} · 草地块 ${vegetationVisualCounts.grassPatches} · 踩踏痕迹 ${vegetationVisualCounts.tracks}<br>飘落叶片顶点 ${vegetationMeshes.falling?.count||0} · 三维植被更新编号 ${vegetationVisualRevision}</div>`+v.cells.filter(c=>c.stage==='幼林'||c.stage==='成熟森林').slice(0,3).map(c=>`<div class="ecoFoot">${c.id} · ${c.stage} · 林冠 ${Math.round(c.canopy*100)}%</div>`).join('');}
 const forest=$('ecoForest');if(forest){const f=WorldForest.snapshot(vegetationState,forestCommunity);forest.innerHTML=`<div class="ecoStatLine">树种丰富度 ${f.richness}/5 · 根系竞争 ${Math.round(f.meanRootCompetition*100)}%<br>根系吸水 ${f.rootWaterUptake.toFixed(2)} · 根系养分吸收 ${f.rootNutrientUptake.toFixed(2)}<br>林地覆盖：${Object.entries(f.layers).map(([k,v])=>`${k} ${v}`).join(' · ')||'形成中'}<br>垂直层次：${Object.entries(f.verticalLayers).map(([k,v])=>`${({emergent:'突出层',canopy:'林冠层',subcanopy:'亚林冠层',sapling:'幼树层'})[k]} ${v}`).join(' · ')}<br>扰动：火灾 ${f.stats.fireEvents} · 风倒 ${f.stats.windthrowEvents} · 洪水 ${f.stats.floodEvents} · 病虫害 ${f.stats.pestEvents}<br>根系网格顶点 ${vegetationMeshes.roots?.count||0}</div>`;}
 const list=$('ecoEventList');if(list){const merged=[...ecology.events.map(e=>({sort:e.time||0,title:e.title,phase:e.phase||'旅途事件',description:e.description})),...forestCommunity.events.map(e=>({sort:(e.day||0)*ECO_DAY_SECONDS,title:e.title,phase:`森林 · 第 ${e.day} 日`,description:e.description}))].sort((a,b)=>b.sort-a.sort).slice(0,6);list.innerHTML=merged.map(e=>`<div class="ecoEvent"><b>${e.title}</b><small>${e.phase} · ${e.description}</small></div>`).join('')||'<div class="ecoEmpty">暂时没有新的生态事件。沿着林间小径安静观察。</div>';}
 if(showMap)drawMap();const clock=$('ecoClock');if(clock)clock.textContent=`阿尔维拉时间 · ${String(Math.floor(dayHour())).padStart(2,'0')}:${String(Math.floor((dayHour()%1)*60)).padStart(2,'0')} · ${dayPhase()}`;
}
function nearAnimal(){if(player.insideCave)return null;let best=null,bd=1e9;for(const a of animals){if(!a.alive)continue;const d=Math.hypot(player.x-a.x,player.z-a.z);const range=a.species==='bird'?5.8:4.8;if(d<range&&d<bd){best=a;bd=d;}}return best;}
function observeAnimal(a){const info=speciesInfo[a.species];ecology.observed.add(a.species);const habitat=habitats.find(h=>h.id===a.population?.habitatId)||nearestHabitat(a);const state=stateNames[a.state]||a.state;const stage=a.population?WorldEcology.stageFor(a.species,a.population.ageDays):'成年';const sex=a.population?(a.population.sex==='female'?'雌性':'雄性'):'未知';setToast('观察 · '+info.name,`${info.kind} · ${sex} · ${stage}。当前行为：${state}。活动栖息地：${habitat?.name||'雾隐树海'}。${a.species==='deer'?'它们会沿草甸与林下水源迁徙。':a.species==='fox'?'它们会追踪小型猎物，并在隐蔽处休息。':a.species==='rabbit'?'它们依赖灌丛、草籽和地下洞穴躲避危险。':'它们会在树冠与水边之间集群活动。'}`);updateEcologyUI();}
function drawAnimals(){gl.uniform3fv(loc.offset,[0,0,0]);gl.uniform1f(loc.yaw,0);gl.uniform1f(loc.tintMix,0);for(const a of animals){if(!a.alive)continue;const m=animalModels[a.species];const flying=a.species==='bird'&&(a.state==='flee'||a.state==='migrate');const altitude=flying?2.3+.35*Math.sin(elapsed*7+a.age):.08;const wingBank=a.species==='bird'&&flying?Math.sin(elapsed*5+a.age)*.12:0;const stage=a.population?WorldEcology.stageFor(a.species,a.population.ageDays):'成年';const scale=stage==='幼崽'?.36:stage==='幼年'?.58:stage==='亚成年'?.82:stage==='老年'?.94:1;gl.uniform3fv(loc.offset,[a.x,heightAt(a.x,a.z)+altitude,a.z]);gl.uniform1f(loc.yaw,a.yaw+wingBank);gl.uniform1f(loc.scale,scale);gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.count);}gl.uniform3fv(loc.offset,[0,0,0]);gl.uniform1f(loc.yaw,0);gl.uniform1f(loc.scale,1);gl.bindVertexArray(null);}

const player={x:-96,z:91,yaw:.22,pitch:-.08,vy:0,onGround:true,insideCave:false,returnPos:null};
const keys={};let started=false,mouseLocked=false,last=performance.now(),elapsed=0,discovered=new Set(),activeLandmark=null,toastTimer=0,showMap=false;
const eyeHeight=1.72;
function playerGround(){return player.insideCave?0:heightAt(player.x,player.z);}
function nearLandmark(){if(player.insideCave)return null;let best=null,bd=1e9;for(const p of landmarks){let d=Math.hypot(player.x-p.x,player.z-p.z);if(d<p.range&&d<bd){best=p;bd=d;}}return best;}
function setToast(title,text){const el=$('toast');el.innerHTML='<strong>'+title+'</strong>'+text;el.classList.add('show');toastTimer=4.5;}
function updateLocation(){if(player.insideCave){$('locationName').textContent='根脉洞穴';$('locationSub').textContent='雾隐树海地下 · 晶脉深处';return;}let p=nearLandmark();let name='雾隐树海';if(Math.hypot(player.x+82,player.z-76)<22)name='林息村外围';else if(player.z<-45&&player.x<-30)name='树海断城一带';else if(player.z<-48&&player.x>-15&&player.x<20)name='低语林庭一带';else if(player.z<-25&&player.x>35)name='千冠母树一带';else if(player.z>0&&player.z<35&&player.x>25)name='东侧山坡';else if(player.z>35&&player.z<70)name='鹿踪浅滩一带';else if(player.z<20&&player.z>-20)name='白冠瀑布上游';$('locationName').textContent=p?p.name:name;$('locationSub').textContent='雾隐树海 · '+(discovered.size)+' / '+landmarks.length+' 处地标已记录';}
function interact(){if(player.insideCave){if(player.z>7){player.insideCave=false;player.x=42;player.z=31;player.yaw=Math.PI;setToast('离开根脉洞穴','你重新回到雾隐树海的山坡。');}else setToast('晶脉深处','青色晶体在岩壁中微微发亮，洞穴深处仍有未探索的岔道。');return;}
 const animal=nearAnimal();if(animal){observeAnimal(animal);return;}
 const p=nearLandmark();if(!p){setToast('静静观察','这里暂时没有明显的地标。试着靠近瀑布、古树或石柱，留意环境中的细节。');return;}
 if(p.id==='cave'){discovered.add('cave');player.returnPos={x:player.x,z:player.z,yaw:player.yaw};player.insideCave=true;player.x=0;player.z=0;player.yaw=0;player.pitch=0;setToast('进入根脉洞穴','洞内的空气潮湿而寒冷。按 E 靠近入口可以返回地表。');return;}
 if(!discovered.has(p.id)){discovered.add(p.id);setToast('发现新地点 · '+p.name,p.desc);}else setToast(p.name,p.desc);updateLocation();drawMap();}
function toggleMap(){showMap=!showMap;$('mapPanel').classList.toggle('show',showMap);if(showMap){$('ecologyPanel').classList.remove('show');drawMap();}}
function drawMap(){const c=$('mapCanvas'),ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#172a25';ctx.fillRect(0,0,w,h);const X=x=>(x+120)/240*w,Z=z=>(z+120)/240*h;
 // contour-like subtle grid
 ctx.strokeStyle='rgba(188,211,187,.08)';ctx.lineWidth=1;for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(i*w/8,0);ctx.lineTo(i*w/8,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*h/8);ctx.lineTo(w,i*h/8);ctx.stroke();}
 const river=(arr)=>{ctx.beginPath();arr.forEach((p,i)=>i?ctx.lineTo(X(p[0]),Z(p[1])):ctx.moveTo(X(p[0]),Z(p[1])));ctx.strokeStyle='#63aeb2';ctx.lineWidth=6;ctx.lineCap='round';ctx.stroke();};river(upperRiver);river(lowerRiver);
 for(const t of trails){ctx.beginPath();t.forEach((p,i)=>i?ctx.lineTo(X(p[0]),Z(p[1])):ctx.moveTo(X(p[0]),Z(p[1])));ctx.strokeStyle='rgba(207,178,123,.7)';ctx.lineWidth=3;ctx.stroke();}
 for(const p of landmarks){let found=discovered.has(p.id);ctx.beginPath();ctx.arc(X(p.x),Z(p.z),found?7:5,0,Math.PI*2);ctx.fillStyle=found?'#e5c889':'rgba(210,224,204,.4)';ctx.fill();ctx.strokeStyle=found?'#f7e4b7':'rgba(220,230,215,.55)';ctx.lineWidth=2;ctx.stroke();}
 for(const a of animals){if(!a.alive)continue;ctx.beginPath();ctx.arc(X(a.x),Z(a.z),4,0,Math.PI*2);ctx.fillStyle=speciesInfo[a.species].color;ctx.fill();ctx.strokeStyle='rgba(10,20,16,.8)';ctx.lineWidth=1;ctx.stroke();}
 if(!player.insideCave){ctx.beginPath();ctx.arc(X(player.x),Z(player.z),8,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#263d33';ctx.lineWidth=3;ctx.stroke();}
 ctx.fillStyle='rgba(225,238,223,.75)';ctx.font='16px sans-serif';ctx.fillText('N',w-25,24);}
function updatePrompt(){const hint=$('bottomHint');if(player.insideCave){hint.textContent=player.z>7?'按 E 离开洞穴':'按 E 观察晶脉';hint.classList.add('show');return;}const a=nearAnimal();if(a){hint.textContent='按 E 观察 · '+speciesInfo[a.species].name+'（'+(stateNames[a.state]||a.state)+'）';hint.classList.add('show');return;}let p=nearLandmark();if(p){hint.textContent='按 E 观察 · '+p.name;hint.classList.add('show');}else hint.classList.remove('show');}

function resize(){const dpr=Math.min(window.devicePixelRatio||1,1.8),w=Math.floor(canvas.clientWidth*dpr),h=Math.floor(canvas.clientHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}}
function drawMeshes(meshes,seasonTint=null){gl.uniform3fv(loc.offset,[0,0,0]);gl.uniform1f(loc.yaw,0);gl.uniform1f(loc.scale,1);for(let i=0;i<meshes.length;i++){const m=meshes[i];if(seasonTint&&i===6){gl.uniform3fv(loc.tint,seasonTint.color);gl.uniform1f(loc.tintMix,seasonTint.mix);}else gl.uniform1f(loc.tintMix,0);gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.count);}gl.uniform1f(loc.tintMix,0);gl.bindVertexArray(null);}
function render(now){resize();const dt=Math.min((now-last)/1000,.04);last=now;elapsed+=dt;update(dt);gl.clearColor(.43,.57,.58,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const eye=[player.x,playerGround()+eyeHeight+(player.insideCave?0:(player.jumpY||0)),player.z];const cp=Math.cos(player.pitch),front=[Math.sin(player.yaw)*cp,Math.sin(player.pitch),-Math.cos(player.yaw)*cp];const view=lookAt(eye,[eye[0]+front[0],eye[1]+front[1],eye[2]+front[2]],[0,1,0]);const proj=perspective(Math.PI/3,canvas.width/canvas.height,.1,360);gl.useProgram(program);gl.uniformMatrix4fv(loc.vp,false,multiply(proj,view));gl.uniform3fv(loc.light,normalize([-.45,.85,.32]));gl.uniform3fv(loc.fog,player.insideCave?[.035,.055,.052]:[.47,.59,.57]);gl.uniform3fv(loc.camera,eye);gl.uniform1f(loc.density,player.insideCave?.018:.0062);gl.uniform1f(loc.time,elapsed);
 if(player.insideCave)drawMeshes(caveMeshes);else{const season=populationState.season,tints={spring:{color:[.84,1.08,.82],mix:.16},summer:{color:[1,1,1],mix:0},autumn:{color:[1.18,.76,.43],mix:.24},winter:{color:[.76,.88,.96],mix:.22}};drawMeshes(world.outside,tints[season]);if(vegetationMeshes.understory)drawMeshes([vegetationMeshes.understory]);if(vegetationMeshes.litter)drawMeshes([vegetationMeshes.litter]);if(vegetationMeshes.roots)drawMeshes([vegetationMeshes.roots]);if(vegetationMeshes.wood)drawMeshes([vegetationMeshes.wood]);if(vegetationMeshes.leaves)drawMeshes([vegetationMeshes.leaves]);if(vegetationMeshes.falling)drawMeshes([vegetationMeshes.falling]);drawAnimals();}
 requestAnimationFrame(render);}
function update(dt){if(!started)return;stepEcology(dt);const forward=(keys.KeyW?1:0)-(keys.KeyS?1:0),side=(keys.KeyD?1:0)-(keys.KeyA?1:0);let speed=(keys.ShiftLeft||keys.ShiftRight)?10:5.2;if(player.insideCave)speed=3.2;let dx=(Math.sin(player.yaw)*forward+Math.cos(player.yaw)*side),dz=(-Math.cos(player.yaw)*forward+Math.sin(player.yaw)*side),len=Math.hypot(dx,dz);if(len>0){dx/=len;dz/=len;let nx=player.x+dx*speed*dt,nz=player.z+dz*speed*dt;if(player.insideCave){player.x=clamp(nx,-4.1,4.1);player.z=clamp(nz,-18,12);}else{nx=clamp(nx,-116,116);nz=clamp(nz,-116,116);let blocked=false;for(const c of treeColliders){if(Math.hypot(nx-c[0],nz-c[1])<c[2]+.55){blocked=true;break;}}if(!blocked){player.x=nx;player.z=nz;}}}
 if(!player.insideCave){if(keys.Space&&player.onGround){player.vy=6.1;player.onGround=false;}if(!player.onGround){player.vy-=18*dt;let floor=heightAt(player.x,player.z);player.jumpY=(player.jumpY||0)+player.vy*dt;if(player.jumpY<=0){player.jumpY=0;player.vy=0;player.onGround=true;}}else player.jumpY=0;}
 updatePrompt();updateLocation();if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}}

canvas.addEventListener('click',()=>{if(started&&!player.insideCave&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();});document.addEventListener('pointerlockchange',()=>{mouseLocked=document.pointerLockElement===canvas;});document.addEventListener('mousemove',e=>{if(mouseLocked&&started){player.yaw-=e.movementX*.0022;player.pitch=clamp(player.pitch-e.movementY*.0018,-1.35,1.35);}});
document.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.code==='KeyE'&&!e.repeat&&started)interact();if(e.code==='KeyM'&&!e.repeat)toggleMap();if(e.code==='KeyI'&&!e.repeat)toggleEcology();if(e.code==='Escape')document.exitPointerLock?.();if(e.code==='ArrowLeft')player.yaw+=.055;if(e.code==='ArrowRight')player.yaw-=.055;if(e.code==='ArrowUp')player.pitch=clamp(player.pitch+.04,-1.35,1.35);if(e.code==='ArrowDown')player.pitch=clamp(player.pitch-.04,-1.35,1.35);});document.addEventListener('keyup',e=>{keys[e.code]=false;});
$('startButton').addEventListener('click',()=>{started=true;$('startScreen').style.display='none';canvas.focus();canvas.requestPointerLock?.();setToast('旅程开始','沿着林间古道前行。你可以随时偏离道路，探索自己的发现。');});$('mapButton').addEventListener('click',toggleMap);$('ecologyButton').addEventListener('click',toggleEcology);$('helpButton').addEventListener('click',()=>setToast('旅行者手册','WASD 移动 · 鼠标转向 · Shift 奔跑 · Space 跳跃 · E 观察动物/地标 · M 地图 · I 生态记录。动物会觅食、饮水、迁徙、休息并躲避威胁。'));
function toggleEcology(){const panel=$('ecologyPanel');panel.classList.toggle('show');if(panel.classList.contains('show')){showMap=false;$('mapPanel').classList.remove('show');}updateEcologyUI();}
function advanceEcologyExperiment(days){ecology.dayAccumulator=0;ecology.time+=days*ECO_DAY_SECONDS;advancePopulationDays(days,null,false);refreshVegetationMeshes();updateEcologyUI();setToast('生态时间已推进',`森林向前演替了 ${days} 个生态日。请观察幼苗、林冠、枯木和动物取食痕迹的变化。`);}
function triggerDisturbanceFromPlayer(type,intensity=1){const ci=WorldVegetation.indexFor(player.x,player.z),cell=vegetationState.cells[ci];const result=WorldForest.applyDisturbance(vegetationState,forestCommunity,type,cell.id,intensity,type==='pest'?{species:'broadleaf'}:{});refreshVegetationMeshes();updateEcologyUI();setToast('自然扰动 · '+({fire:'林地火情',windthrow:'强风倒木',flood:'河水漫溢',pest:'病虫害扩散'}[type]||type),`影响 ${result.affectedCells} 个植被单元，受损树木 ${result.damagedTrees} 棵，死亡 / 倒伏 ${result.killedTrees} 棵。`);return result;}
$('forestFire')?.addEventListener('click',()=>triggerDisturbanceFromPlayer('fire',1.35));
$('forestWind')?.addEventListener('click',()=>triggerDisturbanceFromPlayer('windthrow',1.55));
$('forestFlood')?.addEventListener('click',()=>triggerDisturbanceFromPlayer('flood',1.1));
$('forestPest')?.addEventListener('click',()=>triggerDisturbanceFromPlayer('pest',1.2));
$('advance30')?.addEventListener('click',()=>advanceEcologyExperiment(30));
$('advance120')?.addEventListener('click',()=>advanceEcologyExperiment(120));

// Diagnostic surface: retains V0.1 checks and adds deterministic ecology controls.
window.__gameDebug={version:'0.5.0',renderer:'WebGL2',landmarks:landmarks.map(p=>p.name),getState:()=>({version:'0.5.0',started,insideCave:player.insideCave,x:player.x,z:player.z,discovered:[...discovered],meshBatches:world.outside.length,caveBatches:caveMeshes.length,terrainVertices:world.outside[0].count,totalVertices:[...world.outside,...caveMeshes].reduce((n,m)=>n+m.count,0),animalMeshes:Object.keys(animalModels).length,animalCount:animals.filter(a=>a.alive).length}),getVegetationState:()=>WorldVegetation.snapshot(vegetationState),getForestState:()=>WorldForest.snapshot(vegetationState,forestCommunity),triggerForestDisturbance:(type,cellId='cell-136',intensity=1,options={})=>{const r=WorldForest.applyDisturbance(vegetationState,forestCommunity,type,cellId,intensity,options);refreshVegetationMeshes();updateEcologyUI();return r;},getVegetationVisualState:()=>({...vegetationVisualCounts,revision:vegetationVisualRevision,woodVertices:vegetationMeshes.wood?.count||0,leafVertices:vegetationMeshes.leaves?.count||0,fallingLeafVertices:vegetationMeshes.falling?.count||0,understoryVertices:vegetationMeshes.understory?.count||0,litterVertices:vegetationMeshes.litter?.count||0,rootVertices:vegetationMeshes.roots?.count||0}),getTreeGrowthSamples:()=>vegetationState.trees.filter(t=>t.alive).slice(0,24).map(t=>({id:t.id,species:t.species,size:t.size,ageDays:t.ageDays,health:t.health,rootRadius:t.rootRadius,rootDepth:t.rootDepth,rootBiomass:t.rootBiomass,verticalLayer:t.verticalLayer})),getEcologyState:()=>({time:ecology.time,phase:dayPhase(),counts:animalCounts(),states:stateCounts(),animals:animals.map(a=>({id:a.id,species:a.species,x:a.x,z:a.z,state:a.state,hunger:a.hunger,thirst:a.thirst,energy:a.energy,alive:a.alive,ageDays:a.population?.ageDays??0,sex:a.population?.sex??null,lifeStage:a.population?WorldEcology.stageFor(a.species,a.population.ageDays):'成年',habitatId:a.population?.habitatId??null,target:a.target?{x:a.target.x,z:a.target.z,kind:a.target.kind,nodeId:a.target.node?.id||null}:null})),events:ecology.events.map(e=>({...e})),foodStock:foodNodes.map(n=>({id:n.id,stock:n.stock,rate:n.rate})),habitats:habitats.map(h=>h.name),waterSources:waterNodes.length,observed:[...ecology.observed],predationCount:ecology.predationCount,population:WorldEcology.snapshot(populationState)}),start:()=>{started=true;$('startScreen').style.display='none';},setPosition:(x,z)=>{player.x=x;player.z=z;},interact,enterCave:()=>{player.insideCave=true;player.x=0;player.z=0;},exitCave:()=>{player.insideCave=false;player.x=42;player.z=31;},drawMap,simulate:(seconds)=>{let left=seconds;while(left>0){const dt=Math.min(.1,left);stepEcology(dt);left-=dt;}},simulatePopulationDays:(days,foodIndex=null)=>{ecology.dayAccumulator=0;for(let i=0;i<days;i++){ecology.time+=ECO_DAY_SECONDS;advancePopulationDays(1,foodIndex,false);}refreshVegetationMeshes();updateEcologyUI();return WorldEcology.snapshot(populationState);},simulateVegetationDays:(days,options={})=>{for(let i=0;i<days;i++){vegetationLastResult=WorldVegetation.stepDay(vegetationState,{...options,animals:animals.filter(a=>a.alive).map(a=>({species:a.species,x:a.x,z:a.z,alive:a.alive}))});WorldForest.stepDay(vegetationState,forestCommunity,{allowNaturalDisturbance:!!options.allowNaturalDisturbance});}refreshVegetationMeshes();updateEcologyUI();return WorldVegetation.snapshot(vegetationState);},simulateEcologyDays:(days)=>{ecology.dayAccumulator=0;ecology.time+=days*ECO_DAY_SECONDS;const out=advancePopulationDays(days,null,false);refreshVegetationMeshes();updateEcologyUI();return {population:out,vegetation:WorldVegetation.snapshot(vegetationState),forest:WorldForest.snapshot(vegetationState,forestCommunity),visual:{...vegetationVisualCounts,revision:vegetationVisualRevision}};},resetAnimalRegressionFixture:()=>{const spots={deer:[[6,45],[10,50],[14,44],[1,51],[-2,43]],fox:[[-42,-25],[-54,-35]],rabbit:[[-78,50],[-67,58],[-58,43],[-49,53],[-73,31]],bird:[[20,35],[25,39],[30,34],[36,41],[42,35],[14,30]]};for(const [sp,positions] of Object.entries(spots)){const group=animals.filter(a=>a.species===sp);for(let i=0;i<positions.length;i++){let a=group[i];if(!a){a=makeAnimal(sp,positions[i][0],positions[i][1]);animals.push(a);}a.x=positions[i][0];a.z=positions[i][1];a.alive=true;a.permanentDeath=false;a.deathCause=null;a.respawn=0;a.hunger=.22;a.thirst=.2;a.energy=.95;a.alertTimer=0;a.target=null;a.huntTarget=null;a.state='idle';a.decision=0;}}return animalCounts();},setNeeds:(id,needs)=>{const a=animals.find(x=>x.id===id);if(a)Object.assign(a,needs);},moveAnimal:(id,x,z)=>{const a=animals.find(v=>v.id===id);if(a){a.x=x;a.z=z;a.target=null;a.decision=0;}},forceDecision:(id)=>{const a=animals.find(x=>x.id===id);if(a)decideAnimal(a);},forceMigration:(species='deer')=>{const a=animals.find(x=>x.species===species&&x.alive);if(a){a.thirst=Math.min(a.thirst,.2);a.hunger=Math.min(a.hunger,.2);a.alertTimer=0;const n=nearestNode(a,foodNodes,node=>node.type===speciesInfo[species].food);setAnimalState(a,'migrate',{x:n.x,z:n.z,kind:'food',node:n});a.decision=4;return a.id;}return null;},triggerEvent:(type='test',title='生态事件测试',description='测试事件已记录。')=>ecoEvent(type,title,description,true),observe:(id)=>{const a=animals.find(x=>x.id===id);if(a)observeAnimal(a);},setFoodStock:(id,stock)=>{const n=foodNodes.find(x=>x.id===id);if(n)n.stock=clamp(stock,0,n.max);},forceForage:(id,nodeId)=>{const a=animals.find(x=>x.id===id&&x.alive),n=foodNodes.find(x=>x.id===nodeId);if(a&&n){a.alertTimer=0;a.hunger=.98;a.thirst=.1;setAnimalState(a,'forage',{x:n.x,z:n.z,kind:'food',node:n});return true;}return false;},clearAnimalAlert:(id)=>{const a=animals.find(x=>x.id===id);if(a)a.alertTimer=0;},toggleEcology};
updateLocation();drawMap();updateEcologyUI();requestAnimationFrame(render);
})();
