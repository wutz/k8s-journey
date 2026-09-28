/* ============================================================
   K8s Journey 动画引擎（亮色主题）
   Canvas 逐帧渲染 + Web Audio 实时合成配乐与音效 + 预生成的中文旁白
   所有画面都是时间 t 的纯函数，可任意拖动进度。

   每部动画是 /animation/<id>/scenes.js，调用 ANIM({...}) 注册；
   旁白由 scripts/animation/gen_vo.mjs 生成到 /animation/<id>/vo.json 与 vo/*.mp3。
   本文件顶层不访问 DOM，便于在 Node 里加载以读取场景与旁白文案。
   ============================================================ */
const W = 1920, H = 1080;
let ctx = null;

const C = {
  bg:'#fafafa', blue:'#326CE5', blueL:'#4f86f0', blueD:'#2556c4', cyan:'#0a93b8', teal:'#0f9d8a',
  green:'#17a34a', amber:'#d98a06', red:'#e5383b', violet:'#7928ca', pink:'#e0157a',
  text:'#171717', body:'#4d4d4d', mute:'#8f8f8f', faint:'#b4b4b4', hair:'#e6e6e6', hairD:'#d4d4d4',
  panel:'#ffffff', soft:'#f4f4f5'
};
const SANS = 'Geist,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';
const MONO = '"Geist Mono","SF Mono",Menlo,Consolas,"PingFang SC",monospace';

/* ---------- 数学与缓动 ---------- */
const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;
const P = (t,a,b)=>clamp((t-a)/(b-a));
const E = {
  out:t=>1-Math.pow(1-t,3),
  inOut:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
  back:t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)},
  in:t=>t*t*t
};
const win = (t,a,b,f=0.4)=>Math.min(E.out(P(t,a,a+f)), 1-E.in(P(t,b-f,b))); // 窗口淡入淡出
const rnd = s=>{const x=Math.sin(s*127.1+311.7)*43758.5453;return x-Math.floor(x)};
function hexA(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
// 与白色混合后的不透明浅色，用于亮色主题下的底色
function tint(hex,a=.1){const n=parseInt(hex.slice(1),16);const m=v=>Math.round(255+(v-255)*a);return `rgb(${m(n>>16&255)},${m(n>>8&255)},${m(n&255)})`}

/* ---------- 绘图基础 ---------- */
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function txt(s,x,y,o={}){
  const {size=30,color=C.text,weight=500,align='left',font=SANS,alpha=1,base='alphabetic',track=0}=o;
  if(alpha<=0) return;
  ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=color;
  ctx.font=`${weight} ${size}px ${font}`;ctx.textAlign=align;ctx.textBaseline=base;
  if(track) ctx.letterSpacing=track+'px';
  ctx.fillText(s,x,y);ctx.restore();
}
function textW(s,size=30,o={}){ctx.save();ctx.font=`${o.weight||500} ${size}px ${o.font||SANS}`;const w=ctx.measureText(s).width;ctx.restore();return w}
// 自动换行（中英混排按字符断行），返回行数
function wrap(s,x,y,maxW,o={}){
  const {size=28,lh=size*1.5}=o;ctx.save();ctx.font=`${o.weight||500} ${size}px ${o.font||SANS}`;
  const lines=[];let cur='';for(const ch of [...s]){if(ch==='\n'){lines.push(cur);cur='';continue}if(ctx.measureText(cur+ch).width>maxW&&cur){lines.push(cur);cur=ch.trim()?ch:''}else cur+=ch}
  if(cur)lines.push(cur);ctx.restore();lines.forEach((l,i)=>txt(l,x,y+i*lh,o));return lines.length;
}
function withA(a,fn){if(a<=0.001)return;ctx.save();ctx.globalAlpha*=a;fn();ctx.restore()}
function glow(color,blur,fn){ctx.save();ctx.shadowColor=color;ctx.shadowBlur=blur;fn();ctx.restore()}
function line(x1,y1,x2,y2,color,w=2,dash){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=w;ctx.lineCap='round';if(dash)ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore()}
function partialLine(x1,y1,x2,y2,p,color,w=2,dash){if(p<=0)return;line(x1,y1,lerp(x1,x2,p),lerp(y1,y2,p),color,w,dash)}
function arrowHead(x,y,ang,color,s=12){ctx.save();ctx.fillStyle=color;ctx.translate(x,y);ctx.rotate(ang);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-s,-s*.55);ctx.lineTo(-s,s*.55);ctx.closePath();ctx.fill();ctx.restore()}
function arrow(x1,y1,x2,y2,p,color,w=2.5,dash){if(p<=0)return;const x=lerp(x1,x2,p),y=lerp(y1,y2,p);line(x1,y1,x,y,color,w,dash);arrowHead(x,y,Math.atan2(y2-y1,x2-x1),color,8+w*1.6)}
function curve(x1,y1,x2,y2,bend,p,color,w=2.5,o={}){ // 二次曲线箭头，bend 为法向偏移
  if(p<=0)return;const mx=(x1+x2)/2,my=(y1+y2)/2,dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1;const cx=mx-dy/L*bend,cy=my+dx/L*bend;
  const N=40,n=Math.max(1,Math.floor(N*p));ctx.save();ctx.strokeStyle=color;ctx.lineWidth=w;ctx.lineCap='round';if(o.dash)ctx.setLineDash(o.dash);ctx.beginPath();
  let px=x1,py=y1,qx=x1,qy=y1;for(let k=0;k<=n;k++){const u=k/N*(p*N/n);const bx=(1-u)**2*x1+2*(1-u)*u*cx+u*u*x2,by=(1-u)**2*y1+2*(1-u)*u*cy+u*u*y2;qx=px;qy=py;px=bx;py=by;k?ctx.lineTo(bx,by):ctx.moveTo(bx,by)}
  ctx.stroke();ctx.restore();if(o.head!==false)arrowHead(px,py,Math.atan2(py-qy,px-qx),color,8+w*1.6);
}
function dot(x,y,r,color,blur=10){glow(hexA(color.startsWith('#')?color:'#326CE5',.45),blur,()=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);ctx.fill()})}
function panel(x,y,w,h,o={}){
  const {r=16,fill=C.panel,stroke=C.hair,lw=1.5,dash,shadow=true}=o;
  ctx.save();rr(x,y,w,h,r);
  if(shadow){ctx.shadowColor='rgba(0,0,0,0.07)';ctx.shadowBlur=22;ctx.shadowOffsetY=6}
  ctx.fillStyle=fill;ctx.fill();ctx.shadowColor='transparent';
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;if(dash)ctx.setLineDash(dash);ctx.stroke()}ctx.restore();
}
function chip(s,x,y,o={}){ // 圆角标签；给 col 时自动配浅色底和描边
  const {size=20,col,font=MONO,align='center',alpha=1,pad=12,weight=500,solid=false}=o;
  if(alpha<=0)return 0;
  const color=o.color||(solid?'#fff':col||C.text),bg=o.bg||(solid?col:col?tint(col,.1):'#ffffff'),border=o.border||(col?hexA(col,solid?1:.45):C.hair);
  ctx.save();ctx.globalAlpha*=alpha;ctx.font=`${weight} ${size}px ${font}`;
  const w=ctx.measureText(s).width+pad*2,h=size+pad*1.1;
  const x0=align==='center'?x-w/2:align==='right'?x-w:x;
  rr(x0,y-h/2,w,h,h/2);ctx.shadowColor='rgba(0,0,0,0.05)';ctx.shadowBlur=10;ctx.shadowOffsetY=2;ctx.fillStyle=bg;ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle=border;ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s,x0+w/2,y+1);ctx.restore();
  return w;
}
function hexPath(x,y,r,rot=Math.PI/6){ctx.beginPath();for(let i=0;i<6;i++){const a=rot+i*Math.PI/3;const px=x+r*Math.cos(a),py=y+r*Math.sin(a);i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath()}
function cube(x,y,s,color,a=1){ // 等轴测小立方体 = 容器
  withA(a,()=>{
    const h=s*.5;
    ctx.lineJoin='round';
    ctx.fillStyle=hexA(color,.95);ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s,y-h);ctx.lineTo(x,y);ctx.lineTo(x-s,y-h);ctx.closePath();ctx.fill();
    ctx.fillStyle=hexA(color,.62);ctx.beginPath();ctx.moveTo(x-s,y-h);ctx.lineTo(x,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s,y+h);ctx.closePath();ctx.fill();
    ctx.fillStyle=hexA(color,.38);ctx.beginPath();ctx.moveTo(x+s,y-h);ctx.lineTo(x,y);ctx.lineTo(x,y+s);ctx.lineTo(x+s,y+h);ctx.closePath();ctx.fill();
  });
}
const STATE = {run:C.green,pending:C.amber,fail:C.red,idle:C.blueL,gpu:C.violet};
function pod(x,y,s,o={}){ // 六边形 Pod；state 可为 run/pending/fail/idle/gpu 或任意颜色
  const {state='run',label,alpha=1,scale=1,n=1,sub,shake=0}=o;
  if(alpha<=0.001||scale<=0.001)return;
  const col=STATE[state]||state;
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x+shake,y);ctx.scale(scale,scale);
  glow(hexA(col,.35),s*.2,()=>{hexPath(0,0,s/2);ctx.fillStyle=tint(col,.1);ctx.fill()});
  hexPath(0,0,s/2);ctx.strokeStyle=col;ctx.lineWidth=Math.max(2,s*.025);ctx.stroke();
  const cs=s*(n>1?.14:.19);
  if(n===1) cube(0,s*.02,cs,col);
  else {cube(-cs*1.05,s*.04,cs,col);cube(cs*1.05,s*.04,cs,col)}
  ctx.restore();
  if(label) txt(label,x,y+s*.5*scale+Math.max(22,s*.16),{size:Math.max(16,s*.11),font:MONO,color:C.text,align:'center',alpha});
  if(sub) txt(sub,x,y+s*.5*scale+Math.max(46,s*.3),{size:Math.max(14,s*.085),font:MONO,color:col,align:'center',alpha});
}
function wheel(x,y,r,o={}){ // Kubernetes 舵轮标志
  const {rot=0,p=1,alpha=1,color=C.blue}=o;
  if(alpha<=0||p<=0)return;
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);
  const k=E.out(clamp(p*1.6));
  ctx.scale(lerp(.6,1,k),lerp(.6,1,k));
  glow(hexA(color,.35),r*.4,()=>{ctx.beginPath();for(let i=0;i<7;i++){const a=-Math.PI/2+i*2*Math.PI/7;const px=r*Math.cos(a),py=r*Math.sin(a);i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fillStyle=color;ctx.globalAlpha*=k;ctx.fill()});
  ctx.rotate(rot);
  ctx.strokeStyle='#fff';ctx.fillStyle='#fff';ctx.lineCap='round';
  const q=E.inOut(P(p,.25,1));
  ctx.lineWidth=r*.1;ctx.beginPath();ctx.arc(0,0,r*.42,-Math.PI/2,-Math.PI/2+Math.PI*2*q);ctx.stroke();
  ctx.lineWidth=r*.085;
  for(let i=0;i<7;i++){const a=-Math.PI/2+i*2*Math.PI/7;const sp=P(q,i/9,i/9+.35);if(sp<=0)continue;
    ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.14,Math.sin(a)*r*.14);ctx.lineTo(Math.cos(a)*r*lerp(.14,.74,sp),Math.sin(a)*r*lerp(.14,.74,sp));ctx.stroke();}
  ctx.beginPath();ctx.arc(0,0,r*.13*q,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function node(x,y,w,h,name,o={}){ // 服务器节点（x,y 为左上角）
  const {alpha=1,state='ok',tag,accent=C.blue}=o;
  withA(alpha,()=>{
    const bad=state==='down';
    panel(x,y,w,h,{r:14,fill:bad?tint(C.red,.06):'#ffffff',stroke:bad?hexA(C.red,.7):C.hair});
    ctx.save();ctx.fillStyle=bad?tint(C.red,.12):'#f6f6f7';rr(x+1,y+1,w-2,39,[13,13,0,0]);ctx.fill();ctx.restore();
    line(x,y+40,x+w,y+40,bad?hexA(C.red,.3):C.hair,1);
    dot(x+22,y+20,5,bad?C.red:C.green,6);
    txt(name,x+38,y+27,{size:18,font:MONO,color:bad?C.red:C.text});
    if(tag) chip(tag,x+w-12,y+20,{size:14,align:'right',col:accent,pad:8});
  });
}
function cylinder(x,y,w,h,color,label,alpha=1){
  withA(alpha,()=>{
    const ry=w*.16;
    ctx.fillStyle=tint(color,.12);ctx.strokeStyle=color;ctx.lineWidth=2.5;
    ctx.beginPath();ctx.ellipse(x,y-h/2,w/2,ry,0,Math.PI,0,false);ctx.lineTo(x+w/2,y+h/2);ctx.ellipse(x,y+h/2,w/2,ry,0,0,Math.PI,false);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(x,y-h/2,w/2,ry,0,0,Math.PI*2);ctx.fillStyle=tint(color,.28);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(x,y,w/2,ry,0,0,Math.PI,false);ctx.globalAlpha*=.45;ctx.stroke();
    if(label) txt(label,x,y+h/2+ry+30,{size:20,font:MONO,align:'center',color:C.text});
  });
}
function travel(x1,y1,x2,y2,p,color,r=7){ // 数据包
  if(p<=0||p>=1)return;
  const e=E.inOut(p);const x=lerp(x1,x2,e),y=lerp(y1,y2,e);
  for(let i=1;i<6;i++){const q=E.inOut(clamp(p-i*.025));withA(.2*(6-i)/5,()=>dot(lerp(x1,x2,q),lerp(y1,y2,q),r*(1-i*.12),color,0))}
  dot(x,y,r,color,14);
}
function travelPath(pts,p,color,r=8){ // 沿折线移动的数据包
  if(p<=0||p>=1)return;const segs=[];let tot=0;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);segs.push(d);tot+=d}
  let rem=E.inOut(p)*tot;for(let i=0;i<segs.length;i++){if(rem<=segs[i]||i===segs.length-1){const f=segs[i]?Math.min(1,rem/segs[i]):1;dot(lerp(pts[i][0],pts[i+1][0],f),lerp(pts[i][1],pts[i+1][1],f),r,color,14);return}rem-=segs[i]}
}
function poof(x,y,t,color){ // 消散粒子，t: 0→1
  if(t<=0||t>=1)return;
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2+rnd(i)*.5;const d=E.out(t)*(60+rnd(i+9)*50);
    withA(1-t,()=>dot(x+Math.cos(a)*d,y+Math.sin(a)*d,4*(1-t)+1,color,6));}
}
function ring(x,y,t,color,maxR=120){ // 扩散波纹
  if(t<=0||t>=1)return;
  ctx.save();ctx.strokeStyle=color;ctx.globalAlpha*=(1-t)*.7;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,E.out(t)*maxR,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function check(x,y,s,color,p=1){ if(p<=0)return;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=s*.16;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();const pts=[[-.4,0],[-.1,.3],[.45,-.35]];
  const L=[Math.hypot(.3,.3),Math.hypot(.55,.65)];const tot=L[0]+L[1];let rem=p*tot;
  ctx.moveTo(x+pts[0][0]*s,y+pts[0][1]*s);
  for(let i=0;i<2&&rem>0;i++){const f=Math.min(1,rem/L[i]);rem-=L[i];ctx.lineTo(x+lerp(pts[i][0],pts[i+1][0],f)*s,y+lerp(pts[i][1],pts[i+1][1],f)*s)}
  ctx.stroke();ctx.restore();
}
function cross(x,y,s,color,a=1){withA(a,()=>{line(x-s/2,y-s/2,x+s/2,y+s/2,color,s*.16);line(x+s/2,y-s/2,x-s/2,y+s/2,color,s*.16)})}
function terminal(x,y,w,h,t,lines,o={}){ // lines: [{t, cmd} | {t, out, color}]，t 为场景内时间
  const {title='~/k8s-journey — zsh',size=24,alpha=1,cps=30}=o;
  withA(alpha,()=>{
    panel(x,y,w,h,{r:14,fill:'#ffffff',stroke:C.hair});
    ['#ff5f57','#febc2e','#28c840'].forEach((c,i)=>dot(x+26+i*22,y+24,6.5,c,0));
    txt(title,x+w/2,y+31,{size:16,font:MONO,color:C.mute,align:'center'});
    line(x,y+48,x+w,y+48,C.hair,1);
    let ly=y+92;
    for(const L of lines){
      if(t<L.t)break;
      if(L.cmd){
        const n=Math.floor((t-L.t)*cps);const s=L.cmd.slice(0,n);
        txt('❯',x+28,ly,{size,font:MONO,color:C.blue});
        txt(s,x+58,ly,{size,font:MONO,color:C.text});
        if(n<L.cmd.length||(Math.floor(t*2.2)%2===0&&L===lastShown(lines,t))){
          ctx.font=`500 ${size}px ${MONO}`;const cw=ctx.measureText(s).width;
          ctx.fillStyle=hexA(C.text,.7);ctx.fillRect(x+60+cw,ly-size+4,size*.55,size);
        }
      } else txt(L.out,x+28,ly,{size:size*.88,font:MONO,color:L.color||C.body,alpha:E.out(P(t,L.t,L.t+.25))});
      ly+=size*1.6;
    }
  });
}
function lastShown(lines,t){let l=null;for(const L of lines)if(t>=L.t)l=L;return l}
function typeCues(lines,cps=30){const cues=[];for(const L of lines){if(L.cmd){for(let i=0;i<L.cmd.length;i+=2)cues.push([L.t+i/cps,'key']);cues.push([L.t+L.cmd.length/cps+.15,'enter'])}else if(L.sfx)cues.push([L.t,L.sfx])}return cues}
function flow(x1,y1,x2,y2,t,color,count=4,speed=.8,off=0,r=5){ // 连续流动的小点
  for(let i=0;i<count;i++){const p=((t*speed+i/count+off)%1+1)%1;withA(Math.sin(p*Math.PI),()=>dot(lerp(x1,x2,p),lerp(y1,y2,p),r,color,8))}
}

/* ---------- 扩展图元 ---------- */
// 代码 / YAML 面板：rows 为字符串数组，逐行在 t0 起每 step 秒出现；hi 为高亮行号数组
function code(x,y,w,rows,t,t0,o={}){
  const {title='web.yaml',size=22,step=.12,hi=[],hiColor=C.amber,lh=size*1.62,alpha=1}=o;
  const h=o.h||rows.length*lh+90;
  withA(alpha,()=>{
    panel(x,y,w,h,{r:14});
    txt(title,x+28,y+36,{size:17,font:MONO,color:C.mute});line(x,y+56,x+w,y+56,C.hair,1);
    rows.forEach((row,i)=>{const a=E.out(P(t,t0+i*step,t0+i*step+.25));if(a<=0)return;const ly=y+96+i*lh;
      if(hi.includes(i)){ctx.save();ctx.globalAlpha*=a;ctx.fillStyle=tint(hiColor,.14);ctx.fillRect(x+2,ly-size*.95,w-4,lh);ctx.restore()}
      txt(String(i+1).padStart(2,' '),x+22,ly,{size:size*.82,font:MONO,color:C.faint,alpha:a});
      const m=row.match(/^(\s*-?\s*)([\w.\/-]+:)(.*)$/);
      if(m&&!row.trim().startsWith('#')){ctx.font=`500 ${size}px ${MONO}`;const x1=x+68+ctx.measureText(m[1]).width;
        txt(m[1],x+68,ly,{size,font:MONO,color:C.mute,alpha:a});txt(m[2],x1,ly,{size,font:MONO,color:C.blue,alpha:a});
        ctx.font=`500 ${size}px ${MONO}`;txt(m[3],x1+ctx.measureText(m[2]).width,ly,{size,font:MONO,color:hi.includes(i)?o.hiText||C.text:C.text,alpha:a})}
      else txt(row,x+68,ly,{size,font:MONO,color:row.trim().startsWith('#')?C.mute:C.text,alpha:a});
    });
  });
  return h;
}
function box(x,y,w,h,title,sub,col=C.blue,o={}){ // 组件框（x,y 为中心）
  const {alpha=1,hi=false,size=26,fill}=o;
  withA(alpha,()=>{panel(x-w/2,y-h/2,w,h,{r:o.r||14,fill:fill||(hi?tint(col,.14):'#fff'),stroke:hi?col:hexA(col,.45),lw:hi?2.5:1.5});
    txt(title,x,y+(sub?-2:size*.36),{size,weight:600,align:'center'});if(sub)txt(sub,x,y+size*1.15,{size:Math.round(size*.64),font:MONO,color:C.mute,align:'center'})});
}
function user(x,y,s=40,color=C.body,a=1){withA(a,()=>{ctx.save();ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y-s,s,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x,y+s*1.75,s*1.75,Math.PI,0);ctx.fill();ctx.restore()})}
function shield(x,y,s,color,fillA=.12){ctx.save();ctx.translate(x,y);ctx.scale(s/150,s/150);ctx.beginPath();ctx.moveTo(0,-150);ctx.quadraticCurveTo(110,-110,130,-100);ctx.quadraticCurveTo(130,80,0,160);ctx.quadraticCurveTo(-130,80,-130,-100);ctx.quadraticCurveTo(-110,-110,0,-150);ctx.closePath();
  ctx.fillStyle=tint(color,fillA);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=3*150/s;ctx.shadowColor=hexA(color,.35);ctx.shadowBlur=16;ctx.stroke();ctx.restore()}
function gpu(x,y,s,col,a=1,lbl){withA(a,()=>{ctx.save();rr(x-s/2,y-s/2,s,s,6);ctx.fillStyle=tint(col,.16);ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2;if(col!==C.faint){ctx.shadowColor=hexA(col,.4);ctx.shadowBlur=10}ctx.stroke();ctx.restore();
  for(let k=0;k<3;k++){line(x-s/2-6,y-s/4+k*s/4,x-s/2,y-s/4+k*s/4,hexA(col,.6),2);line(x+s/2,y-s/4+k*s/4,x+s/2+6,y-s/4+k*s/4,hexA(col,.6),2)}if(lbl)txt(lbl,x,y+6,{size:14,font:MONO,align:'center',color:col})})}
function globe(x,y,r,color=C.blue,a=1){withA(a,()=>{ctx.save();ctx.strokeStyle=hexA(color,.85);ctx.lineWidth=2.5;ctx.fillStyle=tint(color,.06);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.ellipse(x,y,r*.45,r,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x+r,y);ctx.stroke();ctx.beginPath();ctx.ellipse(x,y,r,r*.4,0,0,Math.PI*2);ctx.stroke();ctx.restore()})}
function cloud(x,y,s,color=C.blue,a=1){withA(a,()=>{ctx.save();ctx.fillStyle=tint(color,.1);ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.beginPath();
  ctx.arc(x-s*.45,y+s*.1,s*.38,Math.PI*.5,Math.PI*1.5);ctx.arc(x-s*.05,y-s*.22,s*.48,Math.PI,Math.PI*1.9);ctx.arc(x+s*.5,y+s*.05,s*.33,Math.PI*1.35,Math.PI*.5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()})}
function lock(x,y,s,color,open=0){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=s*.13;ctx.lineCap='round';ctx.beginPath();ctx.arc(x,y-s*.25-open*s*.25,s*.32,Math.PI,0);ctx.lineTo(x+s*.32,y-s*.05-open*s*.25);ctx.moveTo(x-s*.32,y-s*.25-open*s*.25);ctx.lineTo(x-s*.32,y-s*.05);ctx.stroke();
  rr(x-s*.5,y-s*.08,s,s*.75,s*.12);ctx.fillStyle=color;ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y+s*.26,s*.1,0,Math.PI*2);ctx.fill();ctx.restore()}
function clock(x,y,r,t,color=C.cyan){ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle=C.body;ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  for(let i=0;i<12;i++){const a=i*Math.PI/6;line(x+Math.cos(a)*r*.84,y+Math.sin(a)*r*.84,x+Math.cos(a)*r*.95,y+Math.sin(a)*r*.95,C.faint,3)}
  const a=-Math.PI/2+t*2.2;line(x,y,x+Math.cos(a)*r*.72,y+Math.sin(a)*r*.72,color,5);line(x,y,x+Math.cos(a/12-Math.PI/2*0)*r*.5,y+Math.sin(a/12)*r*.5,C.text,6);ctx.restore()}
function doc(x,y,w,h,title,color=C.blue,o={}){ // 文件卡片（x,y 为中心）
  withA(o.alpha??1,()=>{ctx.save();ctx.translate(x,y);if(o.rot)ctx.rotate(o.rot);panel(-w/2,-h/2,w,h,{r:10,stroke:hexA(color,.5)});
    ctx.fillStyle=tint(color,.18);ctx.beginPath();ctx.moveTo(w/2-26,-h/2);ctx.lineTo(w/2,-h/2+26);ctx.lineTo(w/2-26,-h/2+26);ctx.closePath();ctx.fill();
    txt(o.ext||'.yaml',-w/2+16,-h/2+28,{size:15,font:MONO,color:C.faint});txt(title,0,o.sub?8:h*.18,{size:o.size||22,font:MONO,align:'center'});if(o.sub)txt(o.sub,0,36,{size:15,font:MONO,color:C.mute,align:'center'});ctx.restore()})}
function meter(x,y,w,h,frac,color,o={}){ // 水平进度 / 用量条（x,y 为左上角）
  ctx.save();rr(x,y,w,h,h/2);ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fill();if(frac>0){rr(x,y,Math.max(h,w*clamp(frac)),h,h/2);ctx.fillStyle=o.fill||color;ctx.shadowColor=hexA(color,.35);ctx.shadowBlur=10;ctx.fill()}ctx.restore();
  if(o.label)txt(o.label,x,y-14,{size:o.size||20,color:C.body});if(o.value)txt(o.value,x+w,y-14,{size:o.size||20,font:MONO,color,align:'right'});
}
function chart(x,y,w,h,f,vis,color,o={}){ // 折线图面板：f(s) 返回 0..1，vis 为已绘制比例
  panel(x,y,w,h,{r:14});if(o.title)txt(o.title,x+20,y+36,{size:20,color:C.body});
  if(o.threshold!=null){const ty=y+h-20-o.threshold*(h-80);line(x+20,ty,x+w-20,ty,hexA(C.red,.5),2,[8,8])}
  ctx.save();ctx.beginPath();const N=80;for(let k=0;k<=N;k++){const s=k/N*vis;const v=f(s);const X=x+20+s*(w-40),Y=y+h-20-clamp(v)*(h-80);k?ctx.lineTo(X,Y):ctx.moveTo(X,Y)}
  ctx.strokeStyle=color;ctx.lineWidth=3;ctx.lineJoin='round';ctx.shadowColor=hexA(color,.3);ctx.shadowBlur=8;ctx.stroke();ctx.restore();
}
function bubble(s,x,y,o={}){ // 对话气泡（x,y 为气泡底部尖角位置）
  const {size=24,col=C.text,alpha=1}=o;withA(alpha,()=>{ctx.font=`500 ${size}px ${o.font||SANS}`;const w=ctx.measureText(s).width+40,h=size+30;
    panel(x-w/2,y-h-14,w,h,{r:14,stroke:o.border||C.hair});ctx.save();ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(x-10,y-15);ctx.lineTo(x,y);ctx.lineTo(x+10,y-15);ctx.fill();ctx.restore();
    txt(s,x,y-14-h/2+size*.36,{size,align:'center',color:col,font:o.font})})}
function callout(x1,y1,x2,y2,s,a,col=C.blue,o={}){ // 从 (x1,y1) 引线到标签 (x2,y2)
  if(a<=0)return;partialLine(x1,y1,x2,y2,E.out(a),hexA(col,.5),2);dot(x1,y1,4,col,0);chip(s,x2,y2,{size:o.size||20,col,align:o.align||(x2>=x1?'left':'right'),alpha:E.out(P(a,.5,1)),font:o.font})}
function typeText(s,x,y,t,t0,o={}){ // 逐字出现的文字
  const n=Math.floor(Math.max(0,t-t0)*(o.cps||24));txt([...s].slice(0,n).join(''),x,y,o);return n>=[...s].length}
function countUp(v,t,a,b){return Math.round(v*E.out(P(t,a,b)))}

/* ---------- 通用场景元素 ---------- */
function background(T){
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
  // 渐变光斑（同首页 hero 的 mesh）
  const blobs=[[.2,.3,C.blue,.10],[.58,.18,'#50e3c2',.10],[.82,.48,C.violet,.07],[.62,.85,'#f9cb28',.07]];
  blobs.forEach(([bx,by,col,a],i)=>{const x=W*bx+Math.sin(T*.13+i*2)*60,y=H*by+Math.cos(T*.11+i)*40;const g=ctx.createRadialGradient(x,y,0,x,y,W*.32);g.addColorStop(0,hexA(col,a));g.addColorStop(1,hexA(col,0));ctx.fillStyle=g;ctx.fillRect(0,0,W,H)});
  // 网格（边缘淡出）
  ctx.save();ctx.strokeStyle='rgba(0,0,0,0.045)';ctx.lineWidth=1;
  const off=(T*6)%60;ctx.beginPath();
  for(let x=-60+off;x<W;x+=60){ctx.moveTo(x,0);ctx.lineTo(x,H)}
  for(let y=0;y<H;y+=60){ctx.moveTo(0,y);ctx.lineTo(W,y)}
  ctx.stroke();ctx.restore();
  const m=ctx.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*1.05);m.addColorStop(0,'rgba(250,250,250,0)');m.addColorStop(1,'rgba(250,250,250,0.92)');ctx.fillStyle=m;ctx.fillRect(0,0,W,H);
  // 漂浮粒子
  for(let i=0;i<50;i++){
    const sp=8+rnd(i)*22;const x=(rnd(i+1)*W+T*sp)%W;const y=(rnd(i+2)*H+Math.sin(T*.3+i)*20+H)%H;
    const a=.12+rnd(i+3)*.22;withA(a*(.6+.4*Math.sin(T*1.3+i)),()=>{ctx.fillStyle=i%4===0?C.violet:C.blue;ctx.fillRect(x,y,2.5,2.5)});
  }
}

const STAGES=[
  {no:'00',lv:'PREREQUISITES',t1:'启程',t2:'搞懂容器，搭好实验环境',goal:'理解容器与 K8s 解决的问题，跑起第一个本地集群',color:C.teal},
  {no:'01',lv:'BEGINNER',t1:'入门',t2:'掌握核心对象',goal:'用 YAML 声明式部署一个无状态 Web 应用并对外暴露',color:C.blue},
  {no:'02',lv:'INTERMEDIATE',t1:'进阶',t2:'让应用可靠地跑起来',goal:'健康检查、资源、存储、调度与入口，用 Helm 管理发布',color:C.cyan},
  {no:'03',lv:'ADVANCED',t1:'原理',t2:'深入内部机制',goal:'看懂控制面、网络、安全与扩展——讲得出「为什么」',color:C.violet},
  {no:'04',lv:'PRODUCTION',t1:'生产',t2:'部署和运维真实集群',goal:'规划、部署、长期运维高可用集群，出问题知道去哪看',color:C.amber},
  {no:'05',lv:'EXPERT',t1:'专家',t2:'构建 AI 与平台级能力',goal:'在 K8s 上构建 GPU / AI 与多租户平台',color:C.pink},
];
function captionDraw(t,caps){
  for(const c of caps){
    const a=win(t,c.a,c.b,.35);if(a<=0)continue;
    withA(a,()=>{
      ctx.font=`500 36px ${SANS}`;const w=ctx.measureText(c.s).width+64;
      const y=H-96+lerp(10,0,E.out(P(t,c.a,c.a+.4)));
      ctx.save();rr(W/2-w/2,y-34,w,68,34);ctx.shadowColor='rgba(0,0,0,0.10)';ctx.shadowBlur=24;ctx.shadowOffsetY=6;ctx.fillStyle='rgba(255,255,255,0.94)';ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle=C.hair;ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
      txt(c.s,W/2,y+12,{size:36,align:'center',color:C.text});
    });
  }
}
function heading(s,x,y,t,a0,o={}){ // 场景内小标题 + 眉题
  const a=o.b?win(t,a0,o.b):E.out(P(t,a0,a0+.5));
  if(o.eyebrow) txt(o.eyebrow,x,y-44-((o.size||44)-44)*1.2,{size:18,font:MONO,color:o.color||C.blue,track:4,alpha:a,align:o.align||'left'});
  txt(s,x,y+lerp(12,0,E.out(P(t,a0,a0+.6))),{size:o.size||44,weight:600,alpha:a,align:o.align||'left',track:-1});
}
// 章节开场卡（首页长片用）0 ~ 3.3s
function stageCard(t,si){
  const S=STAGES[si];const a=win(t,0,3.3,.5);if(a<=0)return;
  withA(a,()=>{
    const k=E.out(P(t,0,.9));
    ctx.save();ctx.font=`700 520px ${SANS}`;ctx.textAlign='center';ctx.strokeStyle=hexA(S.color,.16);ctx.lineWidth=2;
    ctx.strokeText(S.no,W/2+lerp(80,0,k),H/2+185);ctx.restore();
    txt(`STAGE ${S.no}  ·  ${S.lv}`,W/2,H/2-120,{size:22,font:MONO,color:S.color,align:'center',track:6,alpha:E.out(P(t,.1,.6))});
    const k2=E.out(P(t,.25,1));
    txt(`${S.t1} · ${S.t2}`,W/2,H/2+lerp(40,10,k2),{size:92,weight:600,align:'center',alpha:k2,track:-2});
    const lw=E.inOut(P(t,.6,1.4))*420;line(W/2-lw,H/2+60,W/2+lw,H/2+60,hexA(S.color,.7),2);
    txt(S.goal,W/2,H/2+120,{size:30,color:C.body,align:'center',alpha:E.out(P(t,.9,1.5))});
  });
}

/* ---------- 单课动画的片头 / 片尾 ---------- */
// 片头：阶段 + 课次眉题、课题、摘要、要点标签。tags 可选
function lessonIntro(o={}){
  const dur=o.dur||8;
  return {name:'片头',dur,kind:'intro',mood:o.mood??1,nocap:true,vo:o.vo||[],
    cues:[[0.1,'swell'],[0.9,'shimmer'],[1.6,'impact'],...(o.tags||[]).map((_,i)=>[3.4+i*.25,'tick']),[dur-1.2,'whoosh'],...(o.cues||[])],
    draw(t,T){
      const M=ANIM_DEF.meta,S=STAGES[M.stage];
      const z=1+E.in(P(t,dur-1.3,dur))*0.5;
      ctx.save();ctx.translate(W/2,H/2);ctx.scale(z,z);ctx.translate(-W/2,-H/2);
      withA(1-P(t,dur-.9,dur),()=>{
        withA(E.out(P(t,0,1.6)),()=>{const g=ctx.createRadialGradient(W/2,300,0,W/2,300,560);g.addColorStop(0,hexA(S.color,.16));g.addColorStop(1,hexA(S.color,0));ctx.fillStyle=g;ctx.fillRect(0,0,W,H)});
        const k0=E.out(P(t,0,1));
        ctx.save();ctx.font=`700 480px ${SANS}`;ctx.textAlign='center';ctx.strokeStyle=hexA(S.color,.12);ctx.lineWidth=2;ctx.globalAlpha*=k0;
        ctx.strokeText(String(M.lesson).padStart(2,'0'),W/2+lerp(80,0,k0),H/2+170);ctx.restore();
        for(let i=0;i<6;i++){const a=T*.35+i*Math.PI/3;const pr=E.out(P(t,1.1+i*.1,1.8+i*.1));
          pod(W/2+Math.cos(a)*170,290+Math.sin(a)*170*.36,36,{state:['run','idle','run','pending','run','idle'][i],alpha:pr*.85,scale:pr});}
        wheel(W/2,290,80,{p:P(t,.4,2.2),color:S.color,rot:Math.sin(T*.5)*.12+E.out(P(t,.4,2.2))*Math.PI*2/7});
        ring(W/2,290,P(t,1.6,2.8),S.color,320);
        txt(`STAGE ${S.no} · ${S.t1}  ·  第 ${M.lesson} / ${M.of} 课`,W/2,470,{size:24,font:MONO,color:S.color,align:'center',track:4,alpha:E.out(P(t,1.4,2))});
        const k=E.out(P(t,1.6,2.5));
        txt(M.title,W/2,lerp(600,580,k),{size:M.title.length>16?76:88,weight:600,align:'center',alpha:k,track:-2.5});
        const lw=E.inOut(P(t,2.2,3))*380;line(W/2-lw,630,W/2+lw,630,hexA(S.color,.6),2);
        withA(E.out(P(t,2.6,3.3)),()=>wrap(M.summary,W/2,700,1300,{size:30,color:C.body,align:'center',lh:46}));
        const tags=o.tags||[];let tw=0;tags.forEach(s=>tw+=textW(s,22,{font:MONO})+24+18);let x=W/2-tw/2+9;
        tags.forEach((s,i)=>{const w=textW(s,22,{font:MONO})+24;chip(s,x+w/2,850,{size:22,col:S.color,alpha:E.out(P(t,3.4+i*.25,3.8+i*.25))});x+=w+18});
      });
      ctx.restore();
      if(o.draw)o.draw(t,T);
    }};
}
// 片尾：本课要点清单 + 下一课
function lessonOutro(o={}){
  const dur=o.dur||10,pts=o.points||[];
  return {name:'小结',dur,kind:'outro',mood:o.mood??2,vo:o.vo||[],
    cues:[[0,'whoosh'],...pts.map((_,i)=>[1+i*.7,'ding'+Math.min(5,i)]),[dur-2.6,'shimmer'],...(o.cues||[])],
    draw(t,T){
      const M=ANIM_DEF.meta,S=STAGES[M.stage];
      withA(1-P(t,dur-.8,dur),()=>{
        heading('本课小结',W/2,222,t,.2,{eyebrow:'RECAP · '+M.title,color:S.color,align:'center',size:56});
        const x0=W/2-560;
        pts.forEach((s,i)=>{const a=E.out(P(t,1+i*.7,1.5+i*.7));if(a<=0)return;const y=320+i*108;
          withA(a,()=>{panel(x0+lerp(40,0,a),y,1120,84,{r:18});
            ctx.save();ctx.fillStyle=tint(S.color,.14);ctx.beginPath();ctx.arc(x0+56+lerp(40,0,a),y+42,24,0,Math.PI*2);ctx.fill();ctx.restore();
            check(x0+56+lerp(40,0,a),y+42,26,S.color,P(t,1.2+i*.7,1.6+i*.7));
            txt(s,x0+104+lerp(40,0,a),y+52,{size:30,weight:500})});});
        const ny=320+pts.length*108+50;
        withA(E.out(P(t,dur-3,dur-2.4)),()=>{
          if(M.next)chip(`下一课 →  ${M.next}`,W/2,ny,{size:24,font:SANS,col:S.color,pad:18});
          else chip('全部课程完成 🎉',W/2,ny,{size:24,font:SANS,col:S.color,pad:18});
        });
      });
      if(o.draw)o.draw(t,T);
    }};
}

/* ---------- 注册与时间轴 ---------- */
let ANIM_DEF=null,SCENES=[],TOTAL=0,VO=[],CUES=[],VO_DATA=[];
function ANIM(def){ANIM_DEF=def;SCENES=def.scenes;let acc=0;for(const s of SCENES){s.start=acc;acc+=s.dur}TOTAL=acc}
// 场景中声明的旁白：scene.vo = [[场景内开始秒数, 字幕文案, 读法覆盖?], ...]
function voLines(){const L=[];SCENES.forEach((S,s)=>(S.vo||[]).forEach(([a,text,spoken])=>L.push({s,a,text,spoken})));return L}
function buildTimeline(data){
  VO_DATA=data||[];VO=[];let prevEnd=-1;
  // 旁白：按场景排期，前一句未说完时顺延
  VO_DATA.forEach((v,i)=>{const S=SCENES[v.s];if(!S)return;const t=Math.max(S.start+v.a,prevEnd+.08);VO.push({t,d:v.d,i,text:v.text,s:v.s});prevEnd=t+v.d});
  SCENES.forEach((S,si)=>{const L=VO.filter(v=>v.s===si);
    S.caps=S.nocap?[]:L.map((v,k)=>{const a=v.t-S.start;const lim=k+1<L.length?L[k+1].t-S.start-.05:S.dur-.1;return{a,b:Math.min(a+v.d+.4,lim),s:v.text}})});
  CUES=[];SCENES.forEach(s=>(s.cues||[]).forEach(([t,n])=>CUES.push({t:s.start+t,n})));CUES.sort((a,b)=>a.t-b.t);
}
function sceneAt(T){for(let i=SCENES.length-1;i>=0;i--)if(T>=SCENES[i].start)return i;return 0}

// 单课默认 HUD：左上角课程信息，右上角本课进度
function lessonHud(T,si,t){
  const M=ANIM_DEF.meta,S=STAGES[M.stage];const a=E.out(P(t,.3,1));
  const content=SCENES.map((s,i)=>i).filter(i=>!SCENES[i].kind);
  withA(a,()=>{
    wheel(64,62,20,{rot:T*.3,color:S.color});
    txt(`K8S JOURNEY · STAGE ${S.no} ${S.t1} · 第 ${M.lesson} 课`,96,56,{size:16,font:MONO,color:C.mute,track:2});
    txt(M.title,96,84,{size:22,weight:600,color:C.text});
    const n=content.length,seg=Math.min(54,300/n);
    content.forEach((ci,k)=>{const x=W-60-(n-k)*seg;const on=ci<=si;
      ctx.save();ctx.fillStyle=on?S.color:'rgba(0,0,0,0.08)';rr(x,54,seg-10,6,3);ctx.fill();ctx.restore();
      txt(String(k+1).padStart(2,'0'),x+(seg-10)/2,86,{size:14,font:MONO,align:'center',color:ci===si?C.text:C.faint});});
  });
}

function render(T){
  T=clamp(T,0,TOTAL-0.001);
  const si=sceneAt(T),S=SCENES[si],t=T-S.start;
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.letterSpacing='0px';
  background(T);
  S.draw(t,T);
  if(!S.kind&&S.stage!==-1)(ANIM_DEF.hud||lessonHud)(T,ANIM_DEF.hud?S.stage:si,t);
  captionDraw(t,S.caps||[]);
  // 转场：场景首尾短暂淡到底色
  const d=Math.min(P(t,0,.45),1-P(t,S.dur-.45,S.dur));
  if(d<1){ctx.fillStyle=`rgba(250,250,250,${1-E.out(d)})`;ctx.fillRect(0,0,W,H)}
}

/* ============================================================
   音频：配乐 + 音效（Web Audio 实时合成）
   ============================================================ */
let AC=null,master,verb,session=null,recDest=null,noiseBuf;
const BPM=96,BEAT=60/BPM,STEP=BEAT/4,BAR=BEAT*4;
const mtof=m=>440*Math.pow(2,(m-69)/12);
const CH={Am:{b:45,p:[57,60,64,71]},F:{b:41,p:[57,60,65,69]},C:{b:48,p:[55,60,64,67]},G:{b:43,p:[55,59,62,67]},
  Dm:{b:50,p:[57,62,65,69]},Em:{b:40,p:[55,59,64,67]},Fmaj7:{b:41,p:[53,57,60,64]},Bb:{b:46,p:[53,58,62,65]}};
const PROG=[['Fmaj7','G','Am','Am'],['Am','F','C','G'],['Am','F','C','G'],['F','C','G','Am'],['Dm','Bb','F','C'],['Am','F','C','G'],['F','G','Am','C'],['F','G','Am','C']];

function initAudio(){
  if(AC)return;
  AC=new (window.AudioContext||window.webkitAudioContext)();
  master=AC.createGain();master.gain.value=.9;
  const comp=AC.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.attack.value=.005;comp.release.value=.2;
  master.connect(comp);comp.connect(AC.destination);
  recDest=AC.createMediaStreamDestination();comp.connect(recDest);
  // 混响
  verb=AC.createConvolver();const len=AC.sampleRate*3.2,ir=AC.createBuffer(2,len,AC.sampleRate);
  for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2)}
  verb.buffer=ir;const vg=AC.createGain();vg.gain.value=.5;verb.connect(vg);vg.connect(master);
  noiseBuf=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate);const nd=noiseBuf.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  decodeVO();
}
let voBufs=[],voOn=true,voRaw=[];
function fetchVO(base){ // 页面加载时就开始下载旁白音频
  voRaw=VO_DATA.map(v=>fetch(`${base}/vo/${v.f}`).then(r=>{if(!r.ok)throw new Error(v.f+' '+r.status);return r.arrayBuffer()}));
}
function decodeVO(){ // 异步解码；未解码完成的句子在调度时稍后重试
  return Promise.all(voRaw.map((p,i)=>p.then(buf=>new Promise((res,rej)=>AC.decodeAudioData(buf.slice(0),b=>{voBufs[i]=b;res(b)},rej)))));
}
function newSession(){ // 每次播放/跳转建立新的总线，暂停时整体淡出切断
  if(session)endSession(session);
  const g=AC.createGain();g.gain.value=muted?0:1;g.connect(master);
  const wet=AC.createGain();wet.gain.value=muted?0:1;wet.connect(verb); // 混响发送也受会话音量控制，暂停/静音时不漏声
  const mus=AC.createGain();mus.gain.value=.5;mus.connect(g);
  const sfx=AC.createGain();sfx.gain.value=.75;sfx.connect(g);
  const send=AC.createGain();send.gain.value=.35;send.connect(wet);
  const vo=AC.createGain();vo.gain.value=voOn?.95:0;vo.connect(g);
  const vsend=AC.createGain();vsend.gain.value=.06;vo.connect(vsend);vsend.connect(wet);
  mus.connect(send);sfx.connect(send);
  session={gain:g,wet,mus,sfx,send,vo};return session;
}
function sessionLevel(S,v,tc){for(const n of[S.gain,S.wet])n.gain.setTargetAtTime(v,AC.currentTime,tc)}
function endSession(S){sessionLevel(S,0,.02);setTimeout(()=>{S.gain.disconnect();S.wet.disconnect()},400)}
function env(g,t0,a,peak,dec,sus=0){g.gain.setValueAtTime(0.0001,t0);g.gain.linearRampToValueAtTime(peak,t0+a);g.gain.exponentialRampToValueAtTime(Math.max(sus,0.0001),t0+a+dec)}
function osc(type,f,t0,dur,out,{a=.005,peak=.3,dec,det=0,slideTo,slideT}={}){
  const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t0);o.detune.value=det;
  if(slideTo)o.frequency.exponentialRampToValueAtTime(slideTo,t0+(slideT||dur));
  env(g,t0,a,peak,dec||dur);o.connect(g);g.connect(out);o.start(t0);o.stop(t0+(dec||dur)+a+.05);return o;
}
function noise(t0,dur,out,{type='bandpass',f=1000,q=1,peak=.3,a=.005,fTo}={}){
  const s=AC.createBufferSource();s.buffer=noiseBuf;const fl=AC.createBiquadFilter();fl.type=type;fl.frequency.setValueAtTime(f,t0);fl.Q.value=q;
  if(fTo)fl.frequency.exponentialRampToValueAtTime(fTo,t0+dur);const g=AC.createGain();env(g,t0,a,peak,dur);
  s.connect(fl);fl.connect(g);g.connect(out);s.start(t0,Math.random());s.stop(t0+dur+a+.05);
}
function makeLP(out,f){const l=AC.createBiquadFilter();l.type='lowpass';l.frequency.value=f;l.connect(out);return l}

/* 配乐 —— 按 16 分音符网格调度，强度随场景 mood（0~5）递进 */
function musicStep(step,when,S){
  const out=S.mus;const tl=step*STEP;if(tl>=TOTAL+BAR)return;
  const si=sceneAt(Math.min(tl,TOTAL-.01)),sc=SCENES[si];let mood=sc.mood??2;const lt=tl-sc.start;
  if(sc.outro&&lt>11)mood=0;
  const bar=Math.floor(step/16),s16=step%16;
  const ch=CH[PROG[si%PROG.length][bar%4]];
  const endFade=tl>TOTAL-3?clamp((TOTAL-tl)/3):1;
  // Pad
  if(s16===0&&tl<TOTAL){
    const fc=[700,900,1100,1400,1600,1900][mood];const dur=BAR+.6;
    const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(fc*.7,when);lp.frequency.linearRampToValueAtTime(fc,when+BAR*.5);lp.frequency.linearRampToValueAtTime(fc*.7,when+dur);lp.Q.value=.7;
    const g=AC.createGain();g.gain.setValueAtTime(0.0001,when);g.gain.linearRampToValueAtTime(.075*endFade,when+.5);g.gain.setValueAtTime(.075*endFade,when+BAR-.1);g.gain.linearRampToValueAtTime(0.0001,when+dur+.4);
    lp.connect(g);g.connect(out);
    ch.p.forEach(m=>{[-8,8].forEach(d=>{const o=AC.createOscillator();o.type='sawtooth';o.frequency.value=mtof(m);o.detune.value=d;o.connect(lp);o.start(when);o.stop(when+dur+.5)})});
    const sub=AC.createOscillator();sub.type='sine';sub.frequency.value=mtof(ch.b);const sg=AC.createGain();sg.gain.value=mood>=2?0:.08*endFade;sub.connect(sg);sg.connect(out);sub.start(when);sub.stop(when+dur);
  }
  if(tl>=TOTAL)return;
  // 琶音
  if(mood>=1){
    const every=mood>=3?1:2;
    if(s16%every===0){const pat=[0,1,2,3,2,1,3,2];const idx=pat[(s16/every)%8];const m=ch.p[idx]+12+(mood>=5&&s16%8===6?12:0);
      osc('triangle',mtof(m),when,.3,out,{peak:.06*endFade*(s16%4===0?1.2:.8),dec:.28});
      if(mood>=4)osc('square',mtof(m),when,.12,out,{peak:.012*endFade,dec:.1});}
  }
  // 贝斯
  if(mood>=2&&s16%4===0){const m=ch.b+(s16===8&&mood>=4?12:0);
    osc('sawtooth',mtof(m),when,.5,makeLP(out,420),{peak:.14*endFade,dec:BEAT*.9});osc('sine',mtof(m-12),when,.5,out,{peak:.12*endFade,dec:BEAT*.9});}
  // 鼓
  if(mood>=3){const four=mood>=4;
    if(s16%(four?4:8)===0){osc('sine',150,when,.35,out,{peak:.5*endFade,dec:.32,slideTo:45,slideT:.18});}
    if(mood>=4&&(s16===4||s16===12))noise(when,.18,out,{f:1800,q:.8,peak:.16*endFade});
    if(mood>=4&&s16%4===2)noise(when,.05,out,{type:'highpass',f:8000,peak:.06*endFade});
    if(mood>=5&&s16%2===1)noise(when,.03,out,{type:'highpass',f:9500,peak:.025*endFade});
  }
}

/* 音效库 */
const SFX={
  key:(w,o)=>{noise(w,.03,o,{type:'highpass',f:3000,peak:.05});osc('square',1800+Math.random()*400,w,.015,o,{peak:.012,dec:.015})},
  enter:(w,o)=>{noise(w,.06,o,{f:1200,q:2,peak:.12});osc('sine',520,w,.08,o,{peak:.06,dec:.08})},
  pop:(w,o)=>{osc('sine',380,w,.16,o,{peak:.3,dec:.16,slideTo:980,slideT:.07});osc('triangle',1200,w+.03,.08,o,{peak:.05,dec:.08})},
  poof:(w,o)=>{noise(w,.4,o,{f:2400,fTo:300,q:1,peak:.18})},
  tick:(w,o)=>{noise(w,.04,o,{f:2600,q:6,peak:.25});osc('sine',1600,w,.05,o,{peak:.05,dec:.05})},
  ok:(w,o)=>{osc('sine',880,w,.25,o,{peak:.12,dec:.25});osc('sine',1320,w+.08,.35,o,{peak:.1,dec:.35})},
  chime:(w,o)=>{[76,83,88].forEach((m,i)=>{osc('sine',mtof(m),w+i*.07,1.2,o,{peak:.1,dec:1.2});osc('triangle',mtof(m+12),w+i*.07,.4,o,{peak:.02,dec:.4})})},
  error:(w,o)=>{const l=makeLP(o,900);osc('square',110,w,.35,l,{peak:.14,dec:.35});osc('square',116,w,.35,l,{peak:.14,dec:.35});osc('sawtooth',220,w+.18,.2,l,{peak:.06,dec:.2})},
  alarmSoft:(w,o)=>{[0,.3].forEach((d,i)=>osc('triangle',i?660:880,w+d,.25,o,{peak:.08,dec:.25}))},
  alarm:(w,o)=>{for(let i=0;i<6;i++)osc('triangle',i%2?660:880,w+i*.28,.26,o,{peak:.1,a:.02,dec:.26})},
  thud:(w,o)=>{osc('sine',140,w,.3,o,{peak:.4,dec:.28,slideTo:50,slideT:.2});noise(w,.05,o,{type:'lowpass',f:900,peak:.15})},
  impact:(w,o)=>{osc('sine',90,w,1.4,o,{peak:.55,dec:1.3,slideTo:32,slideT:.8});noise(w,1.2,o,{type:'lowpass',f:3000,fTo:200,peak:.25});[57,64,69].forEach(m=>osc('sawtooth',mtof(m),w,1.6,makeLP(o,1200),{peak:.04,dec:1.6}))},
  boom:(w,o)=>{osc('sine',70,w,.9,o,{peak:.35,dec:.9,slideTo:35,slideT:.5})},
  whoosh:(w,o)=>{noise(w,.7,o,{f:300,fTo:4000,q:1.2,a:.3,peak:.14})},
  swell:(w,o)=>{noise(w,2.2,o,{f:200,fTo:2500,q:.8,a:1.9,peak:.12});osc('sine',mtof(45),w,2.5,o,{a:1.8,peak:.1,dec:.7})},
  shimmer:(w,o)=>{const pent=[81,83,86,88,91,93,95,98];for(let i=0;i<10;i++)osc('sine',mtof(pent[(i*3)%8]),w+i*.06,.6,o,{peak:.035,dec:.6})},
  zap:(w,o)=>{osc('sine',600,w,.2,o,{peak:.1,dec:.2,slideTo:1500,slideT:.15});osc('triangle',1200,w,.12,o,{peak:.03,dec:.12,slideTo:2600,slideT:.1})},
  lock:(w,o)=>{noise(w,.03,o,{f:3500,q:4,peak:.3});noise(w+.09,.05,o,{f:1800,q:4,peak:.3});osc('square',180,w+.09,.1,makeLP(o,800),{peak:.1,dec:.1})},
  beat:(w,o)=>{osc('sine',65,w,.18,o,{peak:.35,dec:.16});osc('sine',60,w+.2,.2,o,{peak:.25,dec:.18})},
  powerDown:(w,o)=>{osc('sawtooth',440,w,.9,makeLP(o,1500),{peak:.1,dec:.9,slideTo:40,slideT:.9})},
};
for(let i=0;i<6;i++)SFX['ding'+i]=(w,o)=>{const m=[72,74,76,79,81,84][i];osc('sine',mtof(m),w,1.3,o,{peak:.13,dec:1.3});osc('triangle',mtof(m+12),w,.3,o,{peak:.025,dec:.3})};

/* ============================================================
   播放控制 / 时钟同步 / UI（boot 时才接触 DOM）
   ============================================================ */
let playing=false,T0=0,anchorA=0,anchorP=0,nextStep=0,nextCue=0,nextVo=0,muted=false,schedTimer=null,recorder=null;
let cv,ppBtn,fill,timeEl,track,bar,flashEl,flashReady=false,muteBtn,voBtn,startEl;
// anchorA 对应 T0：now() = T0 + (AC.currentTime - anchorA)
function now(){if(!playing)return T0;return AC?T0+(AC.currentTime-anchorA):T0+(performance.now()-anchorP)/1000}
function play(){
  if(playing)return;if(T0>=TOTAL-.05)T0=0;
  playing=true;
  if(AC){if(AC.state==='suspended')AC.resume();anchorA=AC.currentTime+.06;newSession();
    nextStep=Math.ceil(T0/STEP);nextCue=CUES.findIndex(c=>c.t>=T0);if(nextCue<0)nextCue=CUES.length;
    nextVo=VO.findIndex(v=>v.t+v.d>T0+.3);if(nextVo<0)nextVo=VO.length;
    schedTimer=setInterval(schedule,25);schedule();}
  else anchorP=performance.now();
  ppBtn.textContent='❚❚';flashState();
}
function pause(){if(!playing)return;T0=now();playing=false;clearInterval(schedTimer);if(session){endSession(session);session=null}ppBtn.textContent='▶';flashState()}
function seek(t){const was=playing;pause();T0=clamp(t,0,TOTAL);if(was)play();else frame()}
function schedule(){
  if(!playing||!session)return;
  const horizon=now()+.2;
  while(nextStep*STEP<horizon){const tl=nextStep*STEP;if(tl>=0)musicStep(nextStep,anchorA+(tl-T0),session);nextStep++;}
  while(nextCue<CUES.length&&CUES[nextCue].t<horizon){const c=CUES[nextCue++];const w=anchorA+(c.t-T0);if(w>=AC.currentTime-.02&&SFX[c.n])SFX[c.n](Math.max(w,AC.currentTime),session.sfx)}
  while(nextVo<VO.length&&VO[nextVo].t<horizon){const v=VO[nextVo],buf=voBufs[v.i];const w=anchorA+(v.t-T0),off=Math.max(0,AC.currentTime-w);
    if(!buf){if(off<v.d-.5)break;nextVo++;continue} // 尚未解码：句子还没过就下轮再试
    nextVo++;if(off>=v.d-.3)continue;
    const src=AC.createBufferSource();src.buffer=buf;src.connect(session.vo);const at=Math.max(w,AC.currentTime);src.start(at,off);
    // 旁白时压低配乐（ducking）
    if(voOn){const m=session.mus.gain;m.setTargetAtTime(.2,Math.max(at-.25,AC.currentTime),.12);m.setTargetAtTime(.5,at+v.d-off+.1,.45)}}
}
function frame(){
  let T=now();
  if(playing&&T>=TOTAL){T=TOTAL;pause();T0=TOTAL;if(recorder)setTimeout(stopRec,1200)}
  render(Math.min(T,TOTAL-.001));
  fill.style.width=(T/TOTAL*100)+'%';
  timeEl.textContent=`${fmt(T)} / ${fmt(TOTAL)}`;
  const si=sceneAt(Math.min(T,TOTAL-.01));document.querySelectorAll('.ch').forEach((e,i)=>e.classList.toggle('on',i===si));
}
function loop(){frame();requestAnimationFrame(loop)}
const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
function flashState(){if(!flashReady)return;flashEl.querySelector('svg').innerHTML=playing?'<path d="M8 5v14l11-7z" fill="#171717"/>':'<rect x="6" y="5" width="4" height="14" rx="1" fill="#171717"/><rect x="14" y="5" width="4" height="14" rx="1" fill="#171717"/>';
  flashEl.classList.remove('go');void flashEl.offsetWidth;flashEl.classList.add('go')}
function toggleMute(){muted=!muted;if(session)sessionLevel(session,muted?0:1,.03);muteBtn.textContent=muted?'🔇 静音':'🔊 声音'}
function toggleVO(){voOn=!voOn;if(session){session.vo.gain.setTargetAtTime(voOn?.95:0,AC.currentTime,.05);if(!voOn)session.mus.gain.setTargetAtTime(.5,AC.currentTime,.2)}voBtn.textContent=voOn?'🎙 旁白':'🎙 旁白关';voBtn.style.opacity=voOn?1:.55}

/* 导出视频：canvas 画面 + 混音输出 → MediaRecorder */
function startRec(){
  initAudio();
  const types=['video/mp4;codecs=avc1.640028,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
  const mime=types.find(m=>window.MediaRecorder&&MediaRecorder.isTypeSupported(m));
  if(!mime){alert('当前浏览器不支持录制，请使用最新版 Chrome / Edge / Safari。');return}
  const stream=new MediaStream([...cv.captureStream(60).getVideoTracks(),...recDest.stream.getAudioTracks()]);
  const chunks=[];recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:12e6,audioBitsPerSecond:192e3});
  recorder.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  recorder.onstop=()=>{const blob=new Blob(chunks,{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`k8s-journey-${ANIM_DEF.id}.${mime.includes('mp4')?'mp4':'webm'}`;a.click();document.getElementById('rec').style.display='none';recorder=null};
  if(muted)toggleMute();
  seek(0);pause();T0=0;recorder.start(500);document.getElementById('rec').style.display='block';setTimeout(play,300);
}
function stopRec(){if(recorder&&recorder.state!=='inactive')recorder.stop()}

// 自检：逐帧渲染 + 离线合成全部音频 + 旁白与场景文案 / 时长 / 字幕宽度核对
function scan(base){
  const errs=[];
  for(let T=0;T<TOTAL;T+=0.1){try{render(T)}catch(e){errs.push(T.toFixed(1)+' '+e.message);if(errs.length>5)break}}
  try{const off=new OfflineAudioContext(2,44100*4,44100);AC=off;master=AC.createGain();master.connect(AC.destination);verb=AC.createGain();verb.connect(master);
    noiseBuf=AC.createBuffer(1,44100,44100);const S=newSession();
    for(let st=0;st*STEP<TOTAL+BAR;st++)musicStep(st,0.01,S);for(const k in SFX)SFX[k](0.01,S.sfx);
    for(const c of CUES)if(!SFX[c.n])errs.push('unknown sfx '+c.n);}catch(e){errs.push('audio '+e.message)}
  const L=voLines();
  if(L.length!==VO_DATA.length||L.some((l,i)=>l.text!==VO_DATA[i].text||l.s!==VO_DATA[i].s||Math.abs(l.a-VO_DATA[i].a)>.001))errs.push('vo stale: 请运行 node scripts/animation/gen_vo.mjs '+ANIM_DEF.id);
  VO.forEach((v,k)=>{if(k&&v.t<VO[k-1].t+VO[k-1].d)errs.push('vo overlap '+k);if(v.t+v.d>TOTAL)errs.push('vo past end '+k);
    const S=SCENES[v.s];if(v.t+v.d>S.start+S.dur+.3)errs.push(`vo spill ${k}（场景 ${v.s} 放不下，${(v.t+v.d-S.start-S.dur).toFixed(1)}s）`)});
  ctx.font=`500 36px ${SANS}`;L.forEach((l,k)=>{const w=ctx.measureText(l.text).width;if(w>1700)errs.push(`caption too wide ${k} (${Math.round(w)}px)`)});
  if(!ANIM_DEF.hud&&!ANIM_DEF.meta)errs.push('missing meta');
  return decodeVO().then(bs=>{bs.forEach((b,k)=>{if(Math.abs(b.duration-VO_DATA[k].d)>.35)errs.push(`vo dur ${k} ${b.duration.toFixed(2)}`)})},e=>errs.push('vo decode '+e))
    .then(()=>errs);
}

async function boot(id){
  const base=`/animation/${id}`;
  cv=document.getElementById('c');ctx=cv.getContext('2d');
  try{const r=await fetch(`${base}/vo.json`);if(r.ok)VO_DATA=await r.json()}catch(e){}
  buildTimeline(VO_DATA);fetchVO(base);
  const D=ANIM_DEF,M=D.meta;
  // 开始页文案
  const st=D.start||{};
  const S=M?STAGES[M.stage]:null;
  document.title=st.docTitle||(M?`${M.title} · 动画 · K8s Journey`:document.title);
  document.getElementById('eyebrow').textContent=st.eyebrow||`STAGE ${S.no} · ${S.t1} · 第 ${M.lesson} 课 · 动画`;
  document.getElementById('h1').innerHTML=(st.title||M.title).split('\n').map(s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))).join('<br>');
  const mins=TOTAL<90?`约 ${Math.round(TOTAL/10)*10} 秒`:`约 ${Math.round(TOTAL/30)/2} 分钟`;
  document.getElementById('sub').textContent=st.sub||`${mins} · 含中文旁白、背景音乐与音效`;
  if(S)document.documentElement.style.setProperty('--accent',S.color);

  ppBtn=document.getElementById('pp');fill=document.getElementById('fill');timeEl=document.getElementById('time');track=document.getElementById('track');bar=document.getElementById('bar');
  const chWrap=document.getElementById('chapters');
  SCENES.forEach(s=>{const b=document.createElement('button');b.className='ch';b.textContent=s.name;b.onclick=()=>seek(s.start+.01);chWrap.appendChild(b);
    if(s.start>0){const k=document.createElement('div');k.className='tick';k.style.left=(s.start/TOTAL*100)+'%';track.appendChild(k)}});
  track.onclick=e=>{const r=track.getBoundingClientRect();seek((e.clientX-r.left)/r.width*TOTAL)};
  ppBtn.onclick=()=>playing?pause():play();
  // 点击画面：暂停 / 继续，并在中央短暂显示状态图标
  flashEl=document.getElementById('flash');
  cv.addEventListener('click',()=>{if(!AC||recorder)return;flashReady=true;playing?pause():play()});
  document.getElementById('back').onclick=()=>seek(now()-5);
  document.getElementById('fwd').onclick=()=>seek(now()+5);
  muteBtn=document.getElementById('mute');muteBtn.onclick=toggleMute;
  voBtn=document.getElementById('voBtn');voBtn.onclick=toggleVO;
  document.getElementById('fs').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
  startEl=document.getElementById('start');
  document.addEventListener('keydown',e=>{if(startEl.style.display!=='none'&&!AC)return;
    if(e.code==='Space'){e.preventDefault();flashReady=true;playing?pause():play()}else if(e.code==='ArrowLeft')seek(now()-5);else if(e.code==='ArrowRight')seek(now()+5);
    else if(e.key==='m'||e.key==='M')toggleMute();else if(e.key==='v'||e.key==='V')toggleVO();else if(e.key==='f'||e.key==='F')document.getElementById('fs').click()});
  let hideT;document.addEventListener('mousemove',()=>{bar.classList.add('show');clearTimeout(hideT);hideT=setTimeout(()=>bar.classList.remove('show'),2200)});
  document.getElementById('exp').onclick=()=>{if(recorder){stopRec();return}startRec()};
  // 独立打开（非 iframe 嵌入）时显示返回课程站的链接
  const home=document.getElementById('home');
  if(M)home.href=`/learn/${D.id}`,home.textContent='← 回到课文';
  if(window.top===window.self){if(location.protocol!=='file:')home.style.display='flex'}else document.getElementById('goRec').style.display='none';
  function begin(rec){initAudio();if(AC.state==='suspended')AC.resume();home.style.display='none';startEl.style.opacity=0;setTimeout(()=>startEl.style.display='none',600);if(rec)startRec();else{T0=0;play()}}
  document.getElementById('go').onclick=()=>begin(false);
  document.getElementById('goRec').onclick=()=>begin(true);

  // 预览参数：?t=秒 直接定格到某一帧（便于检查）；?scan=1 自检
  const qp=new URLSearchParams(location.search);
  await (document.fonts?document.fonts.ready:Promise.resolve());
  if(qp.has('scan')){startEl.style.display='none';const errs=await scan(base);document.body.setAttribute('data-scan',errs.length?errs.join(' | '):'OK');return}
  if(qp.has('t')){startEl.style.display='none';home.style.display='none';T0=+qp.get('t');render(T0);if(qp.has('still'))return}
  // ?autoplay=1：课程页点击封面后嵌入，直接开播；浏览器不允许自动出声时退回开始页
  if(qp.has('autoplay')){begin(false);setTimeout(()=>{if(AC.state!=='running'){pause();seek(0);startEl.style.display='';startEl.style.opacity=1}},500)}
  loop();
}

if(typeof module!=='undefined')module.exports={get def(){return ANIM_DEF},get scenes(){return SCENES},get total(){return TOTAL},voLines};
