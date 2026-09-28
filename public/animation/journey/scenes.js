/* 首页长片：6 个阶段的 3 分钟速览 */
function hud(T,si,t){ // 左上角徽标 + 右上角阶段进度
  const a=si<0?0:E.out(P(t,2.9,3.6));
  withA(a,()=>{
    wheel(64,62,20,{rot:T*.3});
    txt('K8S JOURNEY',96,56,{size:16,font:MONO,color:C.mute,track:3});
    const S=STAGES[si];
    txt(`${S.no} · ${S.t1} · ${S.t2}`,96,82,{size:20,weight:600,color:C.text});
    for(let i=0;i<6;i++){const x=W-330+i*54;const on=i<=si;
      ctx.save();ctx.fillStyle=on?STAGES[i].color:'rgba(0,0,0,0.08)';rr(x,54,44,6,3);ctx.fill();ctx.restore();
      txt(STAGES[i].no,x+22,86,{size:14,font:MONO,align:'center',color:i===si?C.text:C.faint});}
  });
}

const S0_TERM=[
  {t:18.9,cmd:'kind create cluster --name journey'},
  {t:20.4,out:'Creating cluster "journey" ...'},
  {t:20.8,out:' ✓ Ensuring node image (kindest/node) 🖼',color:C.green},
  {t:21.2,out:' ✓ Preparing nodes 📦 📦 📦',color:C.green},
  {t:21.6,out:' ✓ Starting control-plane 🕹️',color:C.green},
  {t:22.0,out:' ✓ Joining worker nodes 🚜',color:C.green},
  {t:22.4,out:'Set kubectl context to "kind-journey" 🎉',color:C.text,sfx:'chime'},
];
const YAML=[['apiVersion',' apps/v1'],['kind',' Deployment'],['metadata',''],['  name',' web'],['spec',''],['  replicas',' 3'],['  selector',''],['    matchLabels',' {app: web}'],['  template',''],['    metadata',''],['      labels',' {app: web}'],['    spec',''],['      containers',''],['      - name',' nginx'],['        image',' nginx:1.27']];
const PB_TASKS=['preinstall','container-engine : containerd','etcd : 3 members','kubernetes/control-plane','kubernetes/node','network_plugin : cilium','PLAY RECAP  ok=1532  failed=0 ✓'];

ANIM({id:'journey',hud,poster:7,
  start:{eyebrow:'K8S JOURNEY · 动画版',title:'从第一个 Pod\n到生产级集群',sub:'约 3 分钟 · 6 个阶段 · 含中文旁白、背景音乐与音效',docTitle:'K8s Journey · 3 分钟动画速览'},
  scenes:[

/* ---------- 0 · 片头 ---------- */
{name:'片头',dur:9,stage:-1,mood:0,nocap:true,
  vo:[[3.2,'从第一个 Pod，到生产级集群——一段从零到专业的航程。']],
  cues:[[0.1,'swell'],[1.0,'shimmer'],[3.0,'impact'],[5.6,'tick'],[5.9,'tick'],[6.2,'tick'],[7.7,'whoosh']],
  draw(t,T){
    const z=1+E.in(P(t,7.6,9))*0.6;
    ctx.save();ctx.translate(W/2,H/2);ctx.scale(z,z);ctx.translate(-W/2,-H/2);
    const fade=1-P(t,8,9);
    withA(fade,()=>{
      withA(E.out(P(t,0,2)),()=>{const g=ctx.createRadialGradient(W/2,420,0,W/2,420,560);g.addColorStop(0,'rgba(50,108,229,0.20)');g.addColorStop(.5,'rgba(121,40,202,0.07)');g.addColorStop(1,'rgba(250,250,250,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)});
      for(let i=0;i<7;i++){const a=T*.35+i*Math.PI*2/7;const pr=E.out(P(t,1.6+i*.12,2.4+i*.12));
        pod(W/2+Math.cos(a)*230,400+Math.sin(a)*230*.38,46,{state:['run','idle','gpu','run','pending','idle','run'][i],alpha:pr*.9,scale:pr});}
      wheel(W/2,400,120,{p:P(t,.9,3),rot:Math.sin(T*.5)*.15+E.out(P(t,.9,3))*Math.PI*2/7});
      ring(W/2,400,P(t,3,4.2),C.blue,420);
      txt('K8S JOURNEY',W/2,590,{size:22,font:MONO,color:C.blue,align:'center',track:10,alpha:E.out(P(t,2.8,3.6))});
      const k=E.out(P(t,3,4));
      txt('从第一个 Pod，到生产级集群',W/2,lerp(720,700,k),{size:96,weight:600,align:'center',alpha:k,track:-3});
      ['6 个阶段','37 课','约 25 小时'].forEach((s,i)=>chip(s,W/2+(i-1)*220,790,{size:22,alpha:E.out(P(t,5.6+i*.3,6+i*.3))}));
      txt('一段从零到专业的航程',W/2,880,{size:28,color:C.body,align:'center',alpha:E.out(P(t,6.6,7.3))});
    });
    ctx.restore();
  }},

/* ---------- 1 · 启程 ---------- */
{name:'00 启程',dur:25,stage:0,mood:1,
  vo:[[3.4,'故事总从一句话开始：「在我电脑上明明能跑。」'],[8.6,'容器把应用和依赖打包成镜像，到哪都一样运行。'],[13.6,'可当容器成百上千，谁来调度、重启、扩容？'],[18.6,'答案是 Kubernetes。先用 kind，在本机搭一个实验集群。']],
  cues:[[0,'whoosh'],[0.3,'boom'],[3.3,'pop'],[4.0,'ok'],[4.7,'zap'],[5.8,'error'],
    [8.9,'thud'],[9.4,'thud'],[9.9,'thud'],[10.4,'thud'],[11.0,'shimmer'],[12.0,'pop'],[12.4,'pop'],[12.8,'pop'],
    [13.7,'whoosh'],[15.2,'error'],[15.6,'tick'],[16.2,'tick'],[16.8,'tick'],[17.2,'alarmSoft'],[18.5,'whoosh'],...typeCues(S0_TERM),[22.9,'impact']],
  draw(t,T){
    stageCard(t,0);
    // A · 在我电脑上能跑
    withA(win(t,3.2,8.6),()=>{
      const lx=560,ly=520;
      panel(lx-190,ly-150,380,240,{r:14,stroke:C.hairD,lw:2});
      ctx.save();ctx.fillStyle='#e4e4e7';ctx.beginPath();ctx.moveTo(lx-230,ly+100);ctx.lineTo(lx+230,ly+100);ctx.lineTo(lx+260,ly+128);ctx.lineTo(lx-260,ly+128);ctx.closePath();ctx.fill();ctx.restore();
      txt('$ python app.py',lx-160,ly-100,{size:22,font:MONO,color:C.text});
      txt('✓ 服务已启动 :8080',lx-160,ly-60,{size:22,font:MONO,color:C.green,alpha:P(t,3.9,4.2)});
      dot(lx,ly+10,22*E.back(P(t,3.3,3.7)),C.green,24);
      txt('我的电脑',lx,ly+180,{size:26,color:C.body,align:'center'});
      const sx=1360;
      for(let i=0;i<3;i++){panel(sx-170,ly-140+i*80,340,66,{r:10});dot(sx-140,ly-107+i*80,5,i===1&&t>5.8?C.red:C.green,6);
        for(let j=0;j<6;j++) line(sx+30+j*18,ly-122+i*80,sx+30+j*18,ly-92+i*80,'rgba(0,0,0,0.12)',3)}
      txt('生产服务器',sx,ly+180,{size:26,color:C.body,align:'center'});
      arrow(lx+240,ly-20,sx-200,ly-20,E.inOut(P(t,4.6,5.5)),C.blue,3);
      travel(lx+240,ly-20,sx-200,ly-20,P(t,4.6,5.5),C.blue);
      const bad=P(t,5.8,6.1);const sh=t>5.8&&t<6.4?Math.sin(t*90)*8*(1-P(t,5.8,6.4)):0;
      withA(bad,()=>{ctx.save();ctx.translate(sh,0);
        panel(sx-260,ly+40,520,90,{r:12,fill:tint(C.red,.07),stroke:hexA(C.red,.6)});
        txt('ImportError: libssl.so.1.1',sx,ly+80,{size:22,font:MONO,color:C.red,align:'center'});
        txt('Python 3.8 ≠ 3.12 · 依赖版本冲突',sx,ly+112,{size:18,font:MONO,color:hexA(C.red,.8),align:'center'});
        ctx.restore()});
      cross(sx+190,ly-200,40,C.red,bad);
    });
    // B · 镜像分层
    withA(win(t,8.6,13.6),()=>{
      const cx=W/2,base=640;
      const layers=[['基础系统','debian:bookworm-slim',C.mute],['运行时','python:3.12',C.blue],['依赖','requirements.txt',C.cyan],['应用代码','app.py',C.green]];
      const merge=E.inOut(P(t,11,11.8));
      layers.forEach((L,i)=>{
        const k=E.out(P(t,8.8+i*.5,9.2+i*.5));if(k<=0)return;
        const y=lerp(base-i*84-300,base-i*84,E.back(P(t,8.8+i*.5,9.25+i*.5)));
        const w=lerp(560-i*20,260,merge),yy=lerp(y,base-150+i*24*(1-merge),merge);
        withA(k*(1-merge),()=>{panel(cx-w/2,yy-34,w,68,{r:12,fill:tint(L[2],.14),stroke:hexA(L[2],.8),lw:2});
          withA(1-merge,()=>{txt(L[0],cx-w/2+26,yy+9,{size:26,weight:600});txt(L[1],cx+w/2-26,yy+8,{size:20,font:MONO,color:C.body,align:'right'})})});
      });
      withA(E.out(P(t,10.8,11.3))*(1-merge),()=>{line(cx+330,base-290,cx+330,base+30,C.blue,2);txt('镜像 Image',cx+360,base-120,{size:30,weight:600,color:C.blue})});
      const bx=E.back(P(t,11.4,12));
      withA(merge,()=>{cube(cx,base-140,70*bx,C.blue);txt('容器 = 镜像 + 运行时隔离',cx,base-5,{size:26,align:'center',alpha:P(t,11.6,12)})});
      ['笔记本','服务器','公有云'].forEach((s,i)=>{const k=E.back(P(t,12+i*.4,12.35+i*.4));if(k<=0)return;
        const x=cx+(i-1)*360,y=830;
        panel(x-130,y-40,260,80,{r:40,fill:tint(C.green,.08),stroke:hexA(C.green,.5)});
        check(x-70,y,30,C.green,P(t,12.1+i*.4,12.5+i*.4));txt(s,x+10,y+10,{size:26,alpha:k});
        const q=P(t,11.9+i*.4,12.3+i*.4);if(q>0&&q<1)travel(cx,base-140,x,y-40,q,C.blue,6);
      });
    });
    // C · 容器失控
    withA(win(t,13.6,18.6),()=>{
      for(let n=0;n<4;n++){
        const x=210+n*390,y=300,w=340,h=320;
        const dead=n===2&&t>16.2;
        node(x,y,w,h,`server-${n+1}`,{state:dead?'down':'ok'});
        for(let i=0;i<12;i++){const cx=x+60+(i%4)*74,cy=y+110+Math.floor(i/4)*80;
          const k=E.back(P(t,13.7+(n*12+i)*.018,14.0+(n*12+i)*.018));
          const fail=(rnd(n*12+i)<.28&&t>15.2)||dead;
          const blink=fail?(.5+.5*Math.sin(T*14+i)):1;
          withA(k*(dead?.35:1),()=>cube(cx,cy,24*k,fail?C.red:C.blue,blink));}
      }
      ['谁来重启？','谁来扩容？','谁来调度？'].forEach((s,i)=>{const k=E.back(P(t,15.6+i*.6,16+i*.6));
        txt(s,W/2+(i-1)*360,760,{size:56*Math.max(k,0.01),weight:600,align:'center',alpha:clamp(k),color:[C.amber,C.cyan,C.violet][i]});});
    });
    // D · kind
    withA(win(t,18.6,25,.5),()=>{
      terminal(180,250,1000,470,t,S0_TERM,{size:26});
      const p=P(t,22.7,24.2);
      wheel(1510,450,150,{p,rot:E.out(p)*Math.PI*2/7+Math.sin(T*.6)*.05});
      ring(1510,450,P(t,22.9,24),C.blue,300);
      txt('Kubernetes',1510,690,{size:48,weight:600,align:'center',alpha:E.out(P(t,23.3,23.9)),track:-1});
      txt('κυβερνήτης · 希腊语「舵手」',1510,735,{size:22,color:C.body,align:'center',alpha:E.out(P(t,23.6,24.2))});
    });
  }},

/* ---------- 2 · 入门 ---------- */
{name:'01 入门',dur:26,stage:1,mood:2,
  vo:[[3.3,'声明式 API：你描述想要什么，K8s 让它成真。','声明式 API：你描述想要什么，Kubernetes 让它成真。'],[8.2,'第一个 Pod 诞生了，它是最小的调度单元。'],[12.1,'标签与命名空间，让海量对象井然有序。'],[16.1,'Deployment 守住期望副本数：一个倒下，立刻补上。'],[21.1,'再用 Service 暴露出去，流量均匀分发到每个副本。']],
  cues:[[0,'whoosh'],[0.3,'boom'],...YAML.map((_,i)=>[3.3+i*.14,'key']),[5.7,'enter'],[6.0,'zap'],[6.8,'ok'],
    [8.3,'pop'],[9.4,'chime'],[9.9,'tick'],[10.4,'tick'],[10.9,'tick'],[12.9,'tick'],[13.3,'tick'],[14.0,'shimmer'],
    [16.3,'pop'],[16.7,'pop'],[18.0,'error'],[18.6,'poof'],[19.4,'pop'],[20.0,'chime'],[21.2,'whoosh'],[22.0,'zap'],[23.5,'zap'],[25,'zap']],
  draw(t,T){
    stageCard(t,1);
    // A · YAML + apply
    withA(win(t,3.2,8.1),()=>{
      panel(170,190,760,660,{r:14});
      txt('web.yaml',200,228,{size:18,font:MONO,color:C.mute});line(170,248,930,248,C.hair,1);
      YAML.forEach(([k,v],i)=>{const a=E.out(P(t,3.3+i*.14,3.5+i*.14));
        if(i===5)withA(a,()=>{ctx.fillStyle=tint(C.amber,.14);ctx.fillRect(172,290+i*36-26,756,36)});
        txt(String(i+1).padStart(2,' '),200,290+i*36,{size:20,font:MONO,color:C.faint,alpha:a});
        txt(k+':',250,290+i*36,{size:22,font:MONO,color:C.blue,alpha:a});
        ctx.font=`500 22px ${MONO}`;const kw=ctx.measureText(k+':').width;
        txt(v,250+kw,290+i*36,{size:22,font:MONO,color:i===5?C.amber:C.text,alpha:a});});
      const k=E.back(P(t,5.5,5.9));
      chip('$ kubectl apply -f web.yaml',550,900,{size:22,alpha:clamp(k),col:C.green});
      travel(930,520,1150,520,P(t,6,6.8),C.green,9);
      const cx=1420,cy=520;
      withA(E.out(P(t,4,4.8)),()=>{
        ctx.save();ctx.strokeStyle=hexA(C.blue,.45);ctx.lineWidth=3;ctx.setLineDash([10,10]);ctx.lineDashOffset=-T*40;ctx.beginPath();ctx.arc(cx,cy,190,0,Math.PI*2);ctx.stroke();ctx.restore();
        const a=T*1.4;dot(cx+Math.cos(a)*190,cy+Math.sin(a)*190,9,C.blue);
        chip('期望状态  replicas: 3',cx,cy-190,{size:22,col:C.amber});
        chip(t>6.8?'实际状态  3 ✓':'实际状态  0',cx,cy+190,{size:22,col:t>6.8?C.green:C.mute});
        wheel(cx,cy,56,{rot:T*.6});
        txt('调谐循环 · Reconcile',cx,cy+100,{size:22,color:C.body,align:'center'});
      });
    });
    const toCol=E.inOut(P(t,21,22.2));
    const colPos=[[1400,330],[1400,510],[1400,690]];
    function place(x,y,i){return [lerp(x,colPos[i][0],toCol),lerp(y,colPos[i][1],toCol)]}
    const shrink=E.inOut(P(t,12,12.8));
    let s=lerp(230,160,shrink);s=lerp(s,120,toCol);
    // 命名空间框
    withA(win(t,13.8,21.2,.5),()=>{
      const p=E.inOut(P(t,13.8,14.6));
      ctx.save();ctx.strokeStyle=hexA(C.violet,.75);ctx.lineWidth=2.5;ctx.setLineDash([14,10]);ctx.lineDashOffset=-T*20;
      const x=440,y=270,w=1040,h=480;rr(x+w/2*(1-p),y+h/2*(1-p),w*p,h*p,24);ctx.fillStyle=hexA(C.violet,.04);ctx.fill();ctx.stroke();ctx.restore();
      chip('namespace: shop',470,270,{size:20,align:'left',col:C.violet,alpha:P(t,14.3,14.7)});
    });
    withA(win(t,8.1,26,.4),()=>{
      const born=E.back(P(t,8.3,8.8));
      const failing=t>18&&t<18.6;
      const [x0,y0]=place(960,500,1);
      if(t<18.6){
        const state=t<9.4?'pending':failing?'fail':'run';
        pod(x0,y0,s,{state,n:2,scale:born,label:t>9.4?'web-7c9d':'',sub:t<9.4?'Pending':failing?'CrashLoopBackOff':'Running',shake:failing?Math.sin(t*80)*6:0});
      }
      poof(x0,y0,P(t,18.6,19.3),C.red);
      ring(x0,y0,P(t,8.3,9.2),C.blue,200);ring(x0,y0,P(t,9.4,10.4),C.green,220);
      const ann=[['共享网络 · IP 10.244.1.7',-1],['共享存储卷',0],['一个或多个容器',1]];
      withA(win(t,9.8,12.2,.35),()=>ann.forEach(([s2,i],j)=>{const a=E.out(P(t,9.9+j*.5,10.3+j*.5));
        const ty=500+i*90;partialLine(1100,500,1260,ty,a,hexA(C.blue,.5),2);chip(s2,1280,ty,{size:22,align:'left',alpha:a})}));
      withA(win(t,12.9,21.2,.4),()=>{
        [['app=web',-110],['tier=frontend',110]].forEach(([s2,dx],i)=>{const a=E.back(P(t,12.9+i*.4,13.3+i*.4));
          partialLine(x0,y0-s*.5,x0+dx,y0-s*.5-50,clamp(a),hexA(C.amber,.6),2);
          chip(s2,x0+dx,y0-s*.5-62,{size:20,alpha:clamp(a),col:C.amber})});
      });
      [[640,500,16.3],[1280,500,16.7]].forEach(([x,y,tb],i)=>{const k=E.back(P(t,tb,tb+.45));const [px,py]=place(x,y,i===0?0:2);
        const st=t<tb+1?'pending':'run';pod(px,py,s,{state:st,n:2,scale:k,label:k>.5?['web-x2kq','web-p8fz'][i]:'',sub:st==='pending'?'Pending':'Running'})});
      if(t>19.4){const k=E.back(P(t,19.4,19.9));const [px,py]=place(960,500,1);
        pod(px,py,s,{state:t<20?'pending':'run',n:2,scale:k,label:'web-m4tn',sub:t<20?'Pending':'Running'});ring(px,py,P(t,20,21),C.green,200);}
      withA(win(t,16.1,21.2,.4),()=>{
        const actual=t<16.4?1:t<16.8?2:t<18.6?3:t<19.4?2:3;
        chip('ReplicaSet',760,850,{size:22,col:C.blue});
        chip('期望 3',960,850,{size:22,col:C.amber});
        chip(`实际 ${actual}`,1150,850,{size:22,col:actual<3?C.red:C.green});
      });
      // Service
      withA(E.out(P(t,21.2,22)),()=>{
        const sx=880,sy=510;
        panel(sx-170,sy-80,340,160,{r:20,fill:tint(C.blue,.1),stroke:C.blue,lw:2});
        txt('Service · web',sx,sy-10,{size:30,weight:600,align:'center'});
        txt('ClusterIP 10.96.0.12:80',sx,sy+30,{size:20,font:MONO,color:C.body,align:'center'});
        for(let i=0;i<5;i++){const uy=330+i*90;
          user(330,uy-2,13,C.faint);
          flow(360,uy,sx-170,sy,t-21.5,C.cyan,2,.9,i*.21,5);}
        colPos.forEach(([px,py],i)=>{line(sx+170,sy,px-70,py,hexA(C.blue,.25),2);flow(sx+170,sy,px-70,py,t-21.8,C.cyan,2,.9,i/3,5)});
        txt('用户请求',330,250,{size:22,color:C.body,align:'center'});
      });
    });
  }},

/* ---------- 3 · 进阶 ---------- */
{name:'02 进阶',dur:26,stage:2,mood:3,
  vo:[[3.3,'探针检查健康，requests 和 limits 划定资源边界。'],[8.1,'PV 与 PVC，让数据比 Pod 活得更久。'],[13.1,'有状态、定时、守护进程，各有控制器。'],[17.1,'Ingress 是统一入口，按域名和路径把流量送到对的服务。'],[22.1,'Helm 把整套 YAML 打包成可回滚的发布。']],
  cues:[[0,'whoosh'],[0.3,'boom'],[3.4,'pop'],[4.4,'beat'],[5.4,'beat'],[6.4,'beat'],[7.4,'beat'],
    [8.4,'tick'],[8.9,'tick'],[9.4,'tick'],[10.8,'error'],[11.0,'poof'],[11.5,'pop'],[12.0,'chime'],
    [13.4,'pop'],[13.8,'pop'],[14.2,'pop'],[15.2,'ok'],[15.6,'pop'],[17.2,'whoosh'],[18.4,'zap'],[19.4,'zap'],
    [22.5,'thud'],[22.9,'pop'],[23.1,'pop'],[23.3,'pop'],[23.5,'pop'],[23.7,'pop'],[23.9,'pop'],[24.8,'chime']],
  draw(t,T){
    stageCard(t,2);
    // A · 探针 + 资源
    withA(win(t,3.2,8.1),()=>{
      const px=520,py=430;
      const beat=(T*1.0)%1;const pulse=1+Math.exp(-beat*8)*.06;
      pod(px,py,220,{scale:pulse*E.back(P(t,3.4,3.9)),n:2,label:'api-6f4b',sub:'Running · Ready 2/2'});
      ctx.save();ctx.strokeStyle=C.green;ctx.lineWidth=3;ctx.shadowColor=hexA(C.green,.4);ctx.shadowBlur=10;ctx.beginPath();
      for(let x=0;x<=600;x+=4){const ph=((x/600*3)-T*1.0)%1;const u=((ph%1)+1)%1;
        let y=0;if(u>.4&&u<.45)y=-18;else if(u>.45&&u<.5)y=60;else if(u>.5&&u<.55)y=-90;else if(u>.55&&u<.6)y=20;
        const X=220+x,Y=720+y*.5*E.out(P(t,3.6,4.4));x?ctx.lineTo(X,Y):ctx.moveTo(X,Y)}
      ctx.stroke();ctx.restore();
      chip('livenessProbe  ✓',360,810,{size:20,col:C.green,alpha:P(t,4.3,4.6)});
      chip('readinessProbe ✓',680,810,{size:20,col:C.green,alpha:P(t,4.8,5.1)});
      const bars=[['CPU','requests 250m','limits 500m',.4,.8,C.cyan],['内存','requests 256Mi','limits 512Mi',.45,.85,C.violet]];
      bars.forEach(([n,rq,lm,r1,r2,col],i)=>{const y=380+i*220,x=1000,w=720;const a=E.out(P(t,4.2+i*.4,4.8+i*.4));
        withA(a,()=>{txt(n,x,y-30,{size:30,weight:600});
          const use=(.28+.22*Math.sin(T*1.6+i*2)+.1*Math.sin(T*4.1+i))*E.out(P(t,4.5,5.5));
          meter(x,y,w,34,use,col);
          line(x+w*r1,y-12,x+w*r1,y+46,C.amber,3);line(x+w*r2,y-12,x+w*r2,y+46,C.red,3);
          txt(rq,x+w*r1,y+76,{size:18,font:MONO,color:C.amber,align:'center'});txt(lm,x+w*r2,y+76,{size:18,font:MONO,color:C.red,align:'center'});});
      });
    });
    // B · 存储链
    withA(win(t,8.1,13.1),()=>{
      const y=500,xs=[330,760,1190,1600];
      const labels=[['Pod','db-client'],['PVC','data-claim · 10Gi'],['PV','pv-0042'],['StorageClass','rook-ceph-block']];
      xs.forEach((x,i)=>{if(i<3)partialLine(x+95,y,xs[i+1]-95,y,E.inOut(P(t,8.4+i*.5,8.9+i*.5)),hexA(C.cyan,.6),3,[8,8])});
      const dead=t>10.8&&t<11.5;
      if(t<10.9)pod(xs[0],y,170,{state:dead?'fail':'run',scale:E.back(P(t,8.2,8.6)),shake:dead?Math.sin(t*80)*6:0});
      poof(xs[0],y,P(t,11,11.6),C.red);
      if(t>11.5){pod(xs[0],y,170,{scale:E.back(P(t,11.5,11.9))});ring(xs[0],y,P(t,11.9,12.8),C.green,150)}
      withA(E.out(P(t,8.6,9)),()=>{panel(xs[1]-70,y-85,140,170,{r:12,fill:tint(C.cyan,.1),stroke:C.cyan,lw:2});for(let j=0;j<4;j++)line(xs[1]-40,y-40+j*28,xs[1]+40,y-40+j*28,hexA(C.cyan,.6),4)});
      cylinder(xs[2],y,150,130,C.cyan,null,E.out(P(t,9.1,9.5)));
      withA(E.out(P(t,9.6,10)),()=>{ctx.save();ctx.translate(xs[3],y);ctx.fillStyle=tint(C.cyan,.12);ctx.strokeStyle=C.cyan;ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(-80,70);ctx.lineTo(-80,-10);ctx.lineTo(-30,-40);ctx.lineTo(-30,-10);ctx.lineTo(20,-40);ctx.lineTo(20,-10);ctx.lineTo(80,-50);ctx.lineTo(80,70);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()});
      labels.forEach(([a,b],i)=>{const al=E.out(P(t,8.4+i*.5,8.8+i*.5));txt(a,xs[i],y+150,{size:30,weight:600,align:'center',alpha:al});txt(b,xs[i],y+188,{size:19,font:MONO,color:C.body,align:'center',alpha:al})});
      withA(E.back(P(t,12,12.4)),()=>chip('新 Pod 重新挂载 · 数据仍在 ✓',W/2,760,{size:24,col:C.green}));
    });
    // C · 控制器家族
    withA(win(t,13.1,17.1),()=>{
      const cols=[[380,'StatefulSet','有序 · 稳定身份'],[960,'Job / CronJob','跑完即止 · 定时触发'],[1540,'DaemonSet','每个节点一份']];
      cols.forEach(([x,n,d],i)=>{const a=E.out(P(t,13.1+i*.15,13.6+i*.15));withA(a,()=>{panel(x-260,250,520,560,{r:18});txt(n,x,320,{size:34,weight:600,align:'center'});txt(d,x,360,{size:20,color:C.body,align:'center'})})});
      [0,1,2].forEach(i=>{const k=E.back(P(t,13.4+i*.4,13.8+i*.4));pod(380,470+i*110,84,{scale:k,state:'run'});
        withA(clamp(k),()=>{txt(`db-${i}`,440,478+i*110,{size:24,font:MONO});chip(`#${i}`,560,470+i*110,{size:16,col:C.cyan})})});
      const cx=960,cy=540;withA(E.out(P(t,13.6,14)),()=>{clock(cx,cy,110,t-13.6);
        chip('schedule: "*/5 * * * *"',cx,710,{size:20,col:C.amber});
        chip(t>15.2?'backup-job  Completed ✓':'backup-job  Running…',cx,770,{size:20,col:t>15.2?C.green:C.mute})});
      [0,1,2].forEach(i=>{const y=450+i*115;withA(E.out(P(t,13.8,14.2)),()=>{panel(1350,y-45,380,90,{r:12,fill:C.soft});txt(`node-${i+1}`,1375,y+8,{size:20,font:MONO,color:C.body})});
        pod(1650,y,70,{scale:E.back(P(t,15.6,16)),state:'idle'});});
      withA(E.out(P(t,15.9,16.3)),()=>txt('log-agent',1540,790,{size:20,font:MONO,color:C.blue,align:'center'}));
    });
    // D · Ingress
    withA(win(t,17.1,22.1),()=>{
      const gx=330,gy=520;
      globe(gx,gy,100,C.blue,E.out(P(t,17.2,17.7)));
      txt('Internet',gx,gy+150,{size:26,align:'center',color:C.body,alpha:E.out(P(t,17.2,17.7))});
      const ix=820;withA(E.out(P(t,17.5,18)),()=>{panel(ix-130,gy-150,260,300,{r:22,fill:tint(C.blue,.1),stroke:C.blue,lw:2});
        txt('Ingress',ix,gy-20,{size:36,weight:600,align:'center'});txt('shop.example.com',ix,gy+24,{size:18,font:MONO,color:C.body,align:'center'});});
      const routes=[[330,'/api','api-svc',C.cyan],[710,'/','web-svc',C.blue]];
      routes.forEach(([ry,path,svc,col],i)=>{const a=E.out(P(t,18+i*.4,18.5+i*.4));withA(a,()=>{
        line(ix+130,gy,1180,ry,hexA(col,.35),2);chip(path,1000,lerp(gy,ry,.52),{size:20,col});
        panel(1180,ry-50,280,100,{r:14,fill:tint(col,.08),stroke:hexA(col,.7)});txt(svc,1320,ry+9,{size:24,font:MONO,align:'center'});
        [0,1].forEach(j=>{const py=ry-50+j*100;line(1460,ry,1600,py,hexA(col,.3),2);pod(1640,py,70,{});flow(1460,ry,1600,py,t,col,2,.9,j*.5,4)});
        flow(ix+130,gy,1180,ry,t,col,3,.8,i*.3,6);
      })});
      flow(gx+100,gy,ix-130,gy,t,C.body,4,.7,0,6);
    });
    // E · Helm
    withA(win(t,22.1,26,.5),()=>{
      const cx=W/2,cy=520;const open=E.out(P(t,22.5,23.2));
      ['Deployment','Service','Ingress','ConfigMap','PVC','HPA'].forEach((f,i)=>{const k=E.back(P(t,22.9+i*.2,23.4+i*.2));if(k<=0)return;const a=(i-2.5)*.28-Math.PI/2;
        doc(cx+Math.cos(a)*380*k,cy+60+Math.sin(a)*300*k,180,110,f,C.cyan,{alpha:clamp(k),rot:(i-2.5)*.08})});
      withA(E.out(P(t,22.2,22.6)),()=>{panel(cx-150,cy+30,300,200,{r:18,fill:tint(C.cyan,.12),stroke:C.cyan,lw:2.5});
        ctx.save();ctx.translate(cx-150,cy+30);ctx.rotate(-open*.35);rr(0,-26,300,30,8);ctx.fillStyle=hexA(C.cyan,.55);ctx.fill();ctx.restore();
        txt('⎈  chart',cx,cy+120,{size:34,weight:600,align:'center'});txt('shop-1.2.0',cx,cy+165,{size:20,font:MONO,color:C.body,align:'center'})});
      chip('$ helm upgrade --install shop ./chart -f values-prod.yaml',cx,860,{size:22,col:C.green,alpha:E.out(P(t,24.4,24.9))});
    });
  }},

/* ---------- 4 · 原理 ---------- */
{name:'03 原理',dur:26,stage:3,mood:3,
  vo:[[3.3,'跟随一个 Pod 的诞生：请求抵达 API Server，写入 etcd，','跟随一个 Pod 的诞生：请求抵达 API Server，写入 E T C D，'],[8.8,'调度器选好节点，kubelet 拉起容器——一切靠 watch 与调谐。'],[14.1,'每个 Pod 都有独立 IP，CNI 让它们跨节点直接互通。'],[20.1,'认证、授权、RBAC——最小权限，是安全的起点。']],
  cues:[[0,'whoosh'],[0.3,'boom'],[3.5,'zap'],[4.8,'zap'],[5.2,'thud'],[6.0,'zap'],[6.9,'tick'],[7.8,'zap'],[9.2,'zap'],[10.0,'pop'],[10.4,'chime'],[11.0,'zap'],[12.4,'shimmer'],
    [14.2,'whoosh'],[15.5,'zap'],[17.0,'zap'],[18.5,'zap'],[20.2,'whoosh'],[21.0,'zap'],[21.8,'ok'],[22.6,'zap'],[23.4,'lock'],[24.2,'tick']],
  draw(t,T){
    stageCard(t,3);
    // A · 控制面
    withA(win(t,3.2,14.1,.5),()=>{
      const K={kubectl:[150,520],api:[690,520],etcd:[690,730],sched:[430,320],cm:[950,320],n1:[1510,340],n2:[1510,680]};
      const steps=['① 提交','② 持久化','③ 调度','④ 监听','⑤ 启动','⑥ 回报'];
      const st=[3.5,4.8,6.0,7.8,9.2,11.0];
      const cur=st.filter(s=>t>=s).length-1;
      steps.forEach((s,i)=>chip(s,500+i*190,170,i===cur?{size:20,col:C.violet,solid:true}:{size:20,color:i<cur?C.violet:C.faint,border:i<cur?hexA(C.violet,.6):C.hair}));
      panel(280,230,830,620,{r:22,fill:hexA(C.violet,.03),stroke:hexA(C.violet,.4),dash:[10,8],shadow:false});
      txt('Control Plane',310,270,{size:20,font:MONO,color:C.violet});
      panel(K.kubectl[0]-95,K.kubectl[1]-40,190,80,{r:12});txt('kubectl',K.kubectl[0],K.kubectl[1]+8,{size:26,font:MONO,align:'center'});
      const L=(a,b,c=hexA(C.violet,.35))=>line(K[a][0],K[a][1],K[b][0],K[b][1],c,2,[6,8]);
      L('api','etcd');L('api','sched');L('api','cm');line(K.api[0]+150,K.api[1],K.n1[0]-290,K.n1[1],hexA(C.violet,.35),2,[6,8]);line(K.api[0]+150,K.api[1],K.n2[0]-290,K.n2[1],hexA(C.violet,.35),2,[6,8]);line(K.kubectl[0]+95,520,K.api[0]-150,520,hexA(C.violet,.35),2,[6,8]);
      const bx=(k,name,sub,w,hi)=>{const [x,y]=K[k];panel(x-w/2,y-48,w,96,{r:14,fill:hi?tint(C.violet,.16):'#fff',stroke:hi?C.violet:hexA(C.violet,.45),lw:hi?2.5:1.5});txt(name,x,y+2,{size:24,weight:600,align:'center'});txt(sub,x,y+30,{size:16,font:MONO,color:C.body,align:'center'})};
      bx('api','kube-apiserver','REST · 认证 · 准入',300,Math.abs(t-3.5-.7)<.5||Math.abs(t-4.8)<.4||Math.abs(t-11.6)<.4);
      bx('sched','scheduler','过滤 · 打分',240,t>6.4&&t<7.8);
      bx('cm','controller-mgr','Deployment → RS → Pod',270,t>12.4);
      cylinder(K.etcd[0],K.etcd[1],130,70,C.violet,null);txt('etcd',K.etcd[0],K.etcd[1]+10,{size:24,weight:600,align:'center'});
      if(t>5.2&&t<6)ring(K.etcd[0],K.etcd[1],P(t,5.2,6),C.violet,120);if(t>11.6&&t<12.4)ring(K.etcd[0],K.etcd[1],P(t,11.6,12.4),C.violet,120);
      ['node-1','node-2'].forEach((n,i)=>{const [x,y]=K[i?'n2':'n1'];node(x-290,y-130,580,260,n,{tag:'kubelet · containerd'});
        for(let j=0;j<2;j++)pod(x-180+j*110,y+30,80,{state:'idle',alpha:.45});});
      withA(win(t,6.4,8.4,.3),()=>{[['node-1',62],['node-2',91]].forEach(([n,v],i)=>{const y=380+i*44;
        txt(n,300,y+10,{size:16,font:MONO,color:C.body});meter(380,y-4,150,18,E.out(P(t,6.5+i*.2,7.1+i*.2))*v/100,i?C.green:C.amber);txt(String(Math.round(v*P(t,6.5,7.1))),545,y+10,{size:16,font:MONO,color:i?C.green:C.amber})})});
      travel(245,520,540,520,P(t,3.5,4.4),C.violet,9);
      travel(K.api[0],K.api[1]+48,K.etcd[0],K.etcd[1]-40,P(t,4.8,5.3),C.violet,8);
      travel(K.api[0]-100,K.api[1]-48,K.sched[0],K.sched[1]+48,P(t,6,6.5),C.cyan,8);
      travel(K.sched[0],K.sched[1]+48,K.api[0]-100,K.api[1]-48,P(t,7.2,7.7),C.cyan,8);
      travel(K.api[0]+150,K.api[1],K.n2[0]-290,K.n2[1],P(t,7.8,8.8),C.blue,9);
      travel(K.api[0]+150,K.api[1],K.n2[0]-290,K.n2[1]-20,P(t,11,11.6),C.green,9);
      if(t>9.2){const x=K.n2[0]+140,y=K.n2[1]+30;pod(x,y,110,{state:t<10.4?'pending':'run',scale:E.back(P(t,9.8,10.3)),n:2,label:'web-m4tn'});ring(x,y,P(t,10.4,11.4),C.green,150)}
      withA(E.out(P(t,12.4,13)),()=>{ctx.save();ctx.strokeStyle=hexA(C.violet,.8);ctx.lineWidth=4;ctx.setLineDash([20,14]);ctx.lineDashOffset=-T*80;ctx.beginPath();ctx.ellipse(K.api[0],K.api[1]-10,380,300,0,0,Math.PI*2);ctx.stroke();ctx.restore();
        chip('watch → diff → act · 永不停歇的调谐循环',K.api[0],900,{size:22,col:C.violet})});
    });
    // B · 网络
    withA(win(t,14.1,20.1),()=>{
      const busY=800;
      withA(E.out(P(t,14.3,15)),()=>{glow(hexA(C.cyan,.5),14,()=>line(170,busY,1750,busY,hexA(C.cyan,.75),6));
        chip('Pod 网络  10.244.0.0/16 · 扁平 · 无 NAT',W/2,busY+56,{size:22,col:C.cyan})});
      const pos=[];
      for(let n=0;n<3;n++){const x=190+n*530,y=260;const a=E.out(P(t,14.2+n*.2,14.7+n*.2));
        withA(a,()=>{line(x+240,y+420,x+240,busY,hexA(C.cyan,.5),3);node(x,y,480,420,`node-${n+1}`,{tag:'CNI · Cilium',accent:C.cyan})});
        for(let j=0;j<3;j++){const px=x+100+j*140,py=y+200;const ip=`10.244.${n+1}.${[5,12,8][j]}`;pos.push([px,py]);
          withA(a,()=>{pod(px,py,90,{state:'run'});txt(ip,px,py+95,{size:17,font:MONO,color:C.body,align:'center'})});}
      }
      const hop=(a,b,t0)=>{const [x1,y1]=pos[a],[x2,y2]=pos[b];const n1=Math.floor(a/3),n2=Math.floor(b/3);const bx1=190+n1*530+240,bx2=190+n2*530+240;
        const p=P(t,t0,t0+1.2);if(p<=0||p>=1)return;const seg=[[x1,y1],[bx1,busY],[bx2,busY],[x2,y2]];
        const s=p*3,i=Math.min(2,Math.floor(s)),f=s-i;dot(lerp(seg[i][0],seg[i+1][0],f),lerp(seg[i][1],seg[i+1][1],f),10,C.amber,20);if(p>.95)ring(x2,y2,P(t,t0+1.1,t0+1.8),C.amber,80)};
      hop(0,8,15.5);hop(4,1,17);hop(6,5,18.5);
    });
    // C · RBAC
    withA(win(t,20.1,26,.5),()=>{
      const ux=300,uy=520;
      user(ux,uy,40,C.body);
      txt('dev@team',ux,uy+120,{size:24,font:MONO,align:'center'});
      panel(620,300,560,440,{r:20,stroke:hexA(C.violet,.5)});
      txt('Role · pod-reader',650,350,{size:28,weight:600});txt('RoleBinding → dev@team',650,385,{size:18,font:MONO,color:C.body});
      [['get',1],['list',1],['watch',1],['delete',0],['create',0]].forEach(([v,ok],i)=>{const y=440+i*56;const a=E.out(P(t,20.4+i*.15,20.8+i*.15));
        withA(a,()=>{txt(`verbs: ${v}`,660,y+8,{size:24,font:MONO,color:ok?C.text:C.faint});ok?check(1110,y,30,C.green):cross(1110,y,26,C.red)})});
      const sx=1480,sy=520;const flash=Math.max(0,1-Math.abs(t-23.4)*3);
      shield(sx,sy,150,flash>0?C.red:C.violet,flash>0?.12+flash*.25:.1);
      txt('API Server',sx,sy+10,{size:28,weight:600,align:'center'});txt('AuthN · AuthZ · Admission',sx,sy+44,{size:15,font:MONO,color:C.body,align:'center'});
      const r1=P(t,21,21.8);if(r1>0)chip('GET pods',lerp(380,1350,E.inOut(r1)),440,{size:20,col:C.green,alpha:1-P(t,22.2,22.6)});
      withA(win(t,21.8,24.8,.3),()=>chip('200 OK',sx,720,{size:22,col:C.green}));
      const r2=P(t,22.6,23.4),r3=P(t,23.4,24.2);
      if(r2>0)chip('DELETE pod',r3>0?lerp(1340,1100,E.out(r3)):lerp(380,1340,E.inOut(r2)),600,{size:20,col:C.red,alpha:1-P(t,24,24.5)});
      withA(win(t,23.4,26,.3),()=>chip('403 Forbidden',sx,780,{size:22,col:C.red}));
      chip('最小权限原则 · Least Privilege',W/2,880,{size:22,col:C.violet,alpha:E.out(P(t,24.2,24.7))});
    });
  }},

/* ---------- 5 · 生产 ---------- */
{name:'04 生产',dur:28,stage:4,mood:4,
  vo:[[3.3,'生产集群从规划开始：三个控制面组成高可用，Kubespray 自动铺开。'],[10.1,'Cilium 管网络，MetalLB 分配 IP，证书自动轮换。','Cilium 管网络，Metal L B 分配 IP，证书自动轮换。'],[15.1,'Rook-Ceph 提供三副本存储，坏盘自愈。','Rook Ceph 提供三副本存储，坏盘自愈。'],[19.1,'凌晨三点节点宕机，告警响起，Pod 自动迁移。'],[24.1,'可观测性让你知道去哪里看，才敢安心入睡。']],
  cues:[[0,'whoosh'],[0.3,'boom'],[3.4,'tick'],[4.2,'tick'],[5.0,'tick'],[5.8,'tick'],[6.6,'tick'],[7.4,'tick'],[8.6,'chime'],
    [10.2,'whoosh'],[10.6,'pop'],[11.5,'pop'],[12.4,'pop'],[15.2,'whoosh'],[15.9,'zap'],[16.1,'zap'],[16.3,'zap'],[17.6,'powerDown'],[18.2,'zap'],[18.6,'ok'],
    [19.2,'whoosh'],[21.0,'powerDown'],[21.2,'alarm'],[22.5,'zap'],[22.9,'zap'],[23.3,'zap'],[23.7,'zap'],[24.6,'chime'],[25.4,'shimmer']],
  draw(t,T){
    stageCard(t,4);
    // A · 规划 + Kubespray
    withA(win(t,3.2,10.1),()=>{
      const prog=E.inOut(P(t,3.4,8.6));
      const cps=[[610,330],[960,330],[1310,330]];
      withA(E.out(P(t,3.4,3.9)),()=>{cps.forEach(([x,y])=>line(960,208,x,y-70,hexA(C.amber,.4),2,[6,6]));chip('API VIP · 高可用入口',960,190,{size:20,col:C.amber})});
      withA(P(t,4.4,5),()=>{line(cps[0][0],cps[0][1]+70,cps[1][0],cps[1][1]+70,hexA(C.amber,.45),2);line(cps[1][0],cps[1][1]+70,cps[2][0],cps[2][1]+70,hexA(C.amber,.45),2);txt('etcd Raft · 3 节点法定多数',960,470,{size:20,font:MONO,color:C.amber,align:'center'})});
      cps.forEach(([x,y],i)=>{const on=prog>.25+i*.05;node(x-150,y-70,300,140,`cp-${i+1}`,{tag:'etcd',accent:C.amber,alpha:on?1:.4});pod(x,y+30,50,{state:on?'run':'idle',alpha:on?1:.4})});
      for(let i=0;i<6;i++){const x=240+i*240,y=640,on=prog>.5+i*.06;node(x-110,y-70,220,150,`worker-${i+1}`,{tag:i>=3?'GPU':null,accent:C.violet,alpha:on?1:.4});
        for(let j=0;j<3;j++)dot(x-60+j*60,y+35,8,on?C.green:C.faint,on?8:0);}
      const bx=360,by=850,bw=1200;
      rr(bx,by,bw,14,7);ctx.fillStyle='rgba(0,0,0,0.07)';ctx.fill();
      ctx.save();rr(bx,by,bw*prog,14,7);const g=ctx.createLinearGradient(bx,0,bx+bw,0);g.addColorStop(0,'#007cf0');g.addColorStop(1,C.amber);ctx.fillStyle=g;ctx.shadowColor=hexA(C.amber,.4);ctx.shadowBlur=12;ctx.fill();ctx.restore();
      const ti=Math.min(PB_TASKS.length-1,Math.floor(P(t,3.4,8.7)*(PB_TASKS.length-1)+.001));
      txt('$ ansible-playbook -i inventory cluster.yml',bx,by-24,{size:20,font:MONO,color:C.body});
      txt(`TASK [${PB_TASKS[ti]}]`,bx+bw,by-24,{size:20,font:MONO,color:ti===PB_TASKS.length-1?C.green:C.amber,align:'right'});
    });
    // B · 网络 / LB / 证书
    withA(win(t,10.1,15.1),()=>{
      const cx=W/2,cy=520;
      const add=[[430,330,'Cilium','eBPF 网络 · 策略 · Hubble',C.amber,10.6],[1500,330,'MetalLB','LoadBalancer  192.168.10.240',C.cyan,11.5],[1500,720,'cert-manager','TLS 证书自动签发与轮换',C.green,12.4]];
      add.forEach(([x,y,n,d,col,tb])=>partialLine(x<cx?x+200:x-200,y,x<cx?cx-230:cx+230,lerp(y,cy,.5),E.out(P(t,tb,tb+.6)),hexA(col,.6),3));
      panel(cx-230,cy-150,460,300,{r:24,fill:tint(C.blue,.06),stroke:hexA(C.blue,.5)});
      wheel(cx,cy-40,60,{rot:T*.4});txt('production',cx,cy+70,{size:24,font:MONO,align:'center',color:C.body});
      for(let i=0;i<9;i++)dot(cx-160+i*40,cy+115,6,C.green,6);
      add.forEach(([x,y,n,d,col,tb])=>{const k=E.back(P(t,tb,tb+.5));if(k<=0)return;
        withA(clamp(k),()=>{panel(x-200,y-70,400,140,{r:18,fill:tint(col,.08),stroke:col,lw:2});txt(n,x,y-6,{size:34,weight:600,align:'center'});txt(d,x,y+34,{size:18,font:MONO,color:C.body,align:'center'})});});
      withA(E.out(P(t,10.8,11.3)),()=>{for(let i=0;i<7;i++){const a=Math.PI/6+i*Math.PI/3;const r=i?50:0;ctx.save();hexPath(430+Math.cos(a)*r,720+Math.sin(a)*r,28,0);ctx.strokeStyle=hexA(C.amber,.35+.35*Math.sin(T*3+i));ctx.lineWidth=2;ctx.stroke();ctx.restore()}});
    });
    // C · Ceph
    withA(win(t,15.1,19.1),()=>{
      const cx=W/2,cy=500,R=260;
      withA(E.out(P(t,15.2,15.7)),()=>{ctx.save();ctx.strokeStyle='rgba(0,0,0,0.1)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.stroke();ctx.restore();
        txt('Ceph',cx,cy+10,{size:52,weight:600,align:'center'});txt('RADOS · CRUSH',cx,cy+50,{size:20,font:MONO,color:C.body,align:'center'})});
      const osd=[];for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3;osd.push([cx+Math.cos(a)*R,cy+Math.sin(a)*R])}
      osd.forEach(([x,y],i)=>{const dead=i===3&&t>17.6;cylinder(x,y,90,60,dead?C.red:C.cyan,null,E.out(P(t,15.3+i*.08,15.7+i*.08)));txt(`osd.${i}`,x,y+75,{size:18,font:MONO,align:'center',color:dead?C.red:C.body})});
      const obj=[cx,cy-110];
      withA(win(t,15.6,19.1,.2),()=>{rr(obj[0]-40,obj[1]-24,80,48,8);ctx.fillStyle=C.amber;ctx.fill();txt('obj',obj[0],obj[1]+7,{size:18,font:MONO,align:'center',color:'#fff'})});
      [1,3,5].forEach((o,i)=>{travel(obj[0],obj[1],osd[o][0],osd[o][1],P(t,15.9+i*.2,16.6+i*.2),C.amber,8);
        if(t>16.6+i*.2&&!(o===3&&t>17.6)){rr(osd[o][0]-16,osd[o][1]-10,32,20,4);ctx.fillStyle=C.amber;ctx.fill()}});
      travel(osd[1][0],osd[1][1],osd[2][0],osd[2][1],P(t,18.2,18.7),C.green,8);
      if(t>18.7){rr(osd[2][0]-16,osd[2][1]-10,32,20,4);ctx.fillStyle=C.green;ctx.fill()}
      chip(t<17.6?'replicas: 3 ✓':t<18.7?'osd.3 down · 降级 2/3':'自愈完成 · 3/3 ✓',cx,860,{size:22,col:t<17.6?C.green:t<18.7?C.red:C.green});
    });
    // D · 运维大盘 + 故障
    withA(win(t,19.1,28,.5),()=>{
      const alarm=t>21.2&&t<24.6;
      if(alarm){ctx.save();ctx.fillStyle=hexA(C.red,.05+.04*Math.sin(T*10));ctx.fillRect(0,0,W,H);ctx.restore()}
      const charts=[['CPU 使用率',C.cyan,s=>.45+.1*Math.sin(s*3)],['请求 QPS',C.blue,s=>.6+.08*Math.sin(s*5)-(s>.4&&s<.55?.15:0)],['错误率 %',C.red,s=>.05+(s>.4&&s<.6?.55*Math.sin((s-.4)/.2*Math.PI):0)]];
      charts.forEach(([n,col,f],i)=>chart(170+i*540,170,500,230,s=>f(s)+.025*Math.sin(s*23+i*2)+.012*Math.sin(s*61+i),P(t,19.3,27.5),col,{title:n}));
      const nodes=[];for(let i=0;i<6;i++)nodes.push([170+(i%3)*540,470+Math.floor(i/3)*210]);
      nodes.forEach(([x,y],i)=>{node(x,y,500,180,`worker-${i+1}`,{state:i===2&&t>21?'down':'ok'})});
      for(let i=0;i<6;i++){for(let j=0;j<5;j++){const [nx,ny]=nodes[i];let x=nx+60+j*90,y=ny+110;let col=C.green;
        if(i===2){const mv=P(t,22.5+j*.3,23.2+j*.3);const tgt=[0,1,3,4,5][j];const [tx,ty]=nodes[tgt];const tx2=tx+60+5*80,ty2=ty+110+(j%2?-20:20);
          if(t>21&&mv<=0)col=C.red;if(mv>0){x=lerp(x,tx2,E.inOut(mv));y=lerp(y,ty2,E.inOut(mv));col=mv<1?C.amber:C.green}}
        dot(x,y,14,col,10)}}
      withA(win(t,21.1,27.8,.3),()=>{const ok=t>24.6;const col=ok?C.green:C.red;const w=900;
        panel(W/2-w/2,868,w,64,{r:32,fill:tint(col,.1),stroke:col,lw:2});
        txt(ok?'✓ 已恢复 · 12 个 Pod 完成迁移 · 服务无中断':'⚠ ALERT  NodeNotReady · worker-3 · 03:04',W/2,910,{size:26,font:MONO,align:'center',color:col})});
      chip('可用性 SLO 99.95%',W-270,120,{size:20,col:C.green,alpha:E.out(P(t,25,25.5))});
    });
  }},

/* ---------- 6 · 专家 ---------- */
{name:'05 专家',dur:26,stage:5,mood:5,
  vo:[[3.3,'GPU Operator 让每一张显卡，都能被 K8s 发现和调度。','GPU Operator 让每一张显卡，都能被 Kubernetes 发现和调度。'],[9.1,'Kueue 与 Volcano 批调度：训练任务要么全员到齐，要么一起等待。','Queue 与 Volcano 批调度：训练任务要么全员到齐，要么一起等待。'],[15.1,'分布式训练借助 RDMA 高速网络，多卡协同如一。'],[20.1,'最后，把大模型推理稳稳托管在集群之上，按需弹性伸缩。']],
  cues:[[0,'whoosh'],[0.3,'boom'],[4.0,'tick'],[5.0,'tick'],[6.0,'tick'],[7.0,'tick'],[7.6,'chime'],[9.2,'whoosh'],[10.2,'beat'],[11.2,'beat'],[12.8,'impact'],[13.8,'pop'],[14.1,'pop'],
    [15.2,'whoosh'],[16,'shimmer'],[19.2,'ok'],[20.2,'whoosh'],[22.5,'pop'],[22.8,'pop'],[24.8,'chime']],
  draw(t,T){
    stageCard(t,5);
    // A · GPU Operator
    withA(win(t,3.2,9.1),()=>{
      ['driver','container-toolkit','device-plugin','DCGM exporter'].forEach((s,i)=>{const on=t>4+i;chip(`${i+1}. ${s}`,420+i*360,210,on?{size:20,col:C.pink}:{size:20,color:C.faint});if(i<3)arrow(420+i*360+130,210,420+(i+1)*360-130,210,1,on?hexA(C.pink,.6):C.hairD,2)});
      for(let n=0;n<3;n++){const x=160+n*560,y=300;node(x,y,480,420,`gpu-node-${n+1}`,{tag:t>7.5?'nvidia.com/gpu: 8':null,accent:C.pink});
        for(let g=0;g<8;g++){const gx=x+80+(g%4)*108,gy=y+140+Math.floor(g/4)*140;const lit=P(t,6.2+(n*8+g)*.03,6.5+(n*8+g)*.03);gpu(gx,gy,72,lit>0?C.pink:C.faint,.5+.5*lit,`GPU${g}`)}}
    });
    // B · Gang 调度
    withA(win(t,9.1,15.1),()=>{
      const jobs=[['train-llm','16 GPU',C.violet],['finetune','4 GPU',C.cyan],['eval','1 GPU',C.green]];
      panel(140,230,460,600,{r:18});txt('Kueue · ClusterQueue',170,280,{size:22,font:MONO,color:C.body});
      jobs.forEach(([n,g,col],i)=>{const left=(i===0&&t>12.8)||(i>0&&t>13.8+(i-1)*.3);const y=350+i*140;
        withA(left?1-P(t,12.8+(i?1+(i-1)*.3:0),13.3+(i?1+(i-1)*.3:0)):1,()=>{panel(170,y-50,400,110,{r:14,fill:tint(col,.08),stroke:col,shadow:false});txt(n,200,y+2,{size:28,weight:600});txt(g,200,y+38,{size:20,font:MONO,color:C.body})})});
      if(t>10&&t<12.8)chip('Gang：等待 16 卡同时就绪…',370,790,{size:18,col:C.amber,alpha:.6+.4*Math.sin(T*6)});
      for(let n=0;n<3;n++){const x=700+n*370,y=240;panel(x,y,340,580,{r:16});txt(`gpu-node-${n+1}`,x+20,y+38,{size:18,font:MONO,color:C.body});
        for(let g=0;g<8;g++){const idx=n*8+g;const gx=x+95+(g%2)*150,gy=y+120+Math.floor(g/2)*120;
          const busy=rnd(idx+3)<.55&&idx<20;const free=t>11.5+rnd(idx)*1.1;
          let col=C.faint;if(busy&&!free)col=C.amber;
          if(t>12.8&&idx<16)col=C.violet;else if(t>13.8&&idx>=16&&idx<20)col=C.cyan;else if(t>14.1&&idx===20)col=C.green;
          gpu(gx,gy,64,col,1);}}
      if(t>12.8)ring(1255,530,P(t,12.8,13.8),C.violet,600);
      chip('全员到齐 · 同时启动',1255,880,{size:22,col:C.violet,alpha:E.out(P(t,12.9,13.3))});
    });
    // C · 分布式训练
    withA(win(t,15.1,20.1),()=>{
      const cx=620,cy=520,R=250,N=8;const pts=[];for(let i=0;i<N;i++){const a=-Math.PI/2+i*Math.PI*2/N;pts.push([cx+Math.cos(a)*R,cy+Math.sin(a)*R])}
      pts.forEach(([x,y],i)=>{const [x2,y2]=pts[(i+1)%N];line(x,y,x2,y2,hexA(C.violet,.4),4);flow(x,y,x2,y2,t,C.pink,1,1.6,0,6)});
      pts.forEach(([x,y],i)=>gpu(x,y,74,C.violet,E.out(P(t,15.2+i*.06,15.6+i*.06)),`rank${i}`));
      txt('AllReduce',cx,cy+6,{size:38,weight:600,align:'center'});txt('RDMA · InfiniBand',cx,cy+44,{size:18,font:MONO,color:C.body,align:'center'});
      const x0=1080,y0=260,w=700,h=460;panel(x0,y0,w,h,{r:16});txt('training loss',x0+24,y0+40,{size:20,font:MONO,color:C.body});
      const vis=P(t,15.5,19.5);ctx.save();ctx.beginPath();for(let k=0;k<=100*vis;k++){const s=k/100;const v=2.8*Math.exp(-s*3.2)+.35+.05*Math.sin(k*1.3)*(1-s*.7);const X=x0+30+s*(w-60),Y=y0+h-30-(v/3.3)*(h-90);k?ctx.lineTo(X,Y):ctx.moveTo(X,Y)}
      ctx.strokeStyle=C.pink;ctx.lineWidth=3;ctx.shadowColor=hexA(C.pink,.35);ctx.shadowBlur=10;ctx.stroke();ctx.restore();
      txt(`step ${Math.round(lerp(1200,48000,vis)).toLocaleString()}`,x0+w-24,y0+40,{size:20,font:MONO,color:C.pink,align:'right'});
    });
    // D · 推理
    withA(win(t,20.1,26,.5),()=>{
      const gx=640,gy=520;
      for(let i=0;i<6;i++){const y=250+i*100;panel(150,y-28,200,56,{r:28});txt('💬 提问…',250,y+8,{size:20,align:'center',color:C.body});flow(350,y,gx-120,gy,t-20,C.cyan,1,.7+i*.05,i*.17,6)}
      const n=t<22.5?2:4;
      for(let r=0;r<4;r++){const y=260+r*170;const k=r<2?1:E.back(P(t,22.5+(r-2)*.3,22.9+(r-2)*.3));if(k<=0)continue;
        withA(clamp(k),()=>{line(gx+120,gy,1000,y,hexA(C.pink,.3),2);flow(gx+120,gy,1000,y,t,C.pink,2,1,r*.25,5);panel(1000,y-60,380,120,{r:16,fill:tint(C.violet,.06),stroke:hexA(C.violet,.6)});txt(`vllm-${r}`,1030,y-10,{size:24,font:MONO});txt('Llama · TP=2',1030,y+26,{size:18,font:MONO,color:C.body});
          gpu(1300,y-18,40,C.violet);gpu(1300,y+30,40,C.violet)})}
      panel(gx-120,gy-110,240,220,{r:20,fill:tint(C.pink,.08),stroke:C.pink,lw:2});txt('推理网关',gx,gy-6,{size:30,weight:600,align:'center'});txt('OpenAI API',gx,gy+32,{size:18,font:MONO,color:C.body,align:'center'});
      chip(`HPA replicas: ${n}`,1190,170,{size:20,col:n>2?C.green:C.mute,alpha:E.out(P(t,20.4,20.8))});
      const ans='Kubernetes 是一个开源的容器编排平台，它负责…';const shown=ans.slice(0,Math.floor(P(t,23,25.4)*ans.length));
      withA(E.out(P(t,22.8,23.1)),()=>{panel(1430,420,380,230,{r:18});ctx.save();ctx.font=`500 24px ${SANS}`;ctx.fillStyle=C.text;
        let lineS='',ly=470;for(const ch of [...shown]){if(ctx.measureText(lineS+ch).width>320){ctx.fillText(lineS,1455,ly);lineS='';ly+=38}lineS+=ch}ctx.fillText(lineS+(Math.floor(T*3)%2?'▍':''),1455,ly);ctx.restore();
        txt('streaming tokens',1455,630,{size:16,font:MONO,color:C.mute})});
    });
  }},

/* ---------- 7 · 片尾 ---------- */
{name:'终章',dur:15,stage:-1,mood:2,outro:true,nocap:true,
  vo:[[6.8,'六个阶段，三十七节课，约二十五小时。'],[10.5,'只需一台电脑和一个终端，现在就启程。']],
  cues:[[0,'swell'],...[0,1,2,3,4,5].map(i=>[0.9+i*0.85,'ding'+i]),[6.2,'whoosh'],[6.6,'impact'],[7.4,'tick'],[7.8,'tick'],[8.2,'tick'],[10.6,'shimmer']],
  draw(t,T){
    const pts=[[220,640],[520,480],[820,600],[1110,430],[1400,560],[1700,380]];
    withA(win(t,0,6.6,.6),()=>{
      ctx.save();ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...pts[0]);
      for(let i=1;i<pts.length;i++){const [x0,y0]=pts[i-1],[x1,y1]=pts[i];ctx.bezierCurveTo((x0+x1)/2,y0,(x0+x1)/2,y1,x1,y1)}ctx.stroke();ctx.restore();
      const prog=clamp((t-.5)/5.1)*(pts.length-1);
      ctx.save();const g=ctx.createLinearGradient(220,0,1700,0);STAGES.forEach((S,i)=>g.addColorStop(i/5,S.color));ctx.strokeStyle=g;ctx.lineWidth=6;ctx.lineCap='round';ctx.shadowColor=hexA(C.blue,.3);ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(...pts[0]);
      let px=pts[0][0],py=pts[0][1];
      for(let i=1;i<pts.length;i++){const [x0,y0]=pts[i-1],[x1,y1]=pts[i];const f=clamp(prog-(i-1));if(f<=0)break;
        const N=24;for(let k=1;k<=N*f;k++){const u=k/N;const bx=(1-u)**3*x0+3*(1-u)**2*u*(x0+x1)/2+3*(1-u)*u*u*(x0+x1)/2+u**3*x1;const by=(1-u)**3*y0+3*(1-u)**2*u*y0+3*(1-u)*u*u*y1+u**3*y1;ctx.lineTo(bx,by);px=bx;py=by}}
      ctx.stroke();ctx.restore();
      STAGES.forEach((S,i)=>{const on=prog>=i-.02;const [x,y]=pts[i];
        dot(x,y,on?16:10,on?S.color:C.hairD,on?18:0);if(on)ring(x,y,P(t,.9+i*.85,1.9+i*.85),S.color,70);
        txt(`${S.no}`,x,y-44,{size:20,font:MONO,color:on?S.color:C.faint,align:'center'});txt(S.t1,x,y+58,{size:32,weight:600,align:'center',alpha:on?1:.35})});
      pod(px,py-2,58,{state:prog>=5?'run':'idle'});
    });
    withA(win(t,6.4,10.8,.5),()=>{
      wheel(W/2,300,90,{p:P(t,6.4,7.6),rot:T*.2});
      const k=E.out(P(t,6.6,7.4));txt('从第一个 Pod，到生产级集群',W/2,lerp(520,500,k),{size:88,weight:600,align:'center',alpha:k,track:-3});
      [[6,'个阶段'],[37,'节课'],[25,'小时']].forEach(([v,l],i)=>{const a=E.out(P(t,7.4+i*.4,7.8+i*.4));const x=W/2+(i-1)*360;
        txt(String(Math.round(v*E.out(P(t,7.4+i*.4,8.6+i*.4)))),x,680,{size:110,weight:700,align:'center',alpha:a,color:STAGES[i*2+1].color,track:-4});
        txt(l,x,730,{size:28,color:C.body,align:'center',alpha:a})});
    });
    withA(win(t,10.6,15.2,.6)*(1-P(t,14,15)),()=>{
      wheel(W/2,360,110,{rot:Math.sin(T*.6)*.12});
      txt('只需一台电脑和一个终端，现在就启程。',W/2,590,{size:56,weight:600,align:'center',track:-1});
      chip('k8s-journey.wutz.dev',W/2,690,{size:30,col:C.blue,solid:true,pad:18});
      txt('从第一课开始 →',W/2,790,{size:26,color:C.body,align:'center'});
      txt('Kubernetes® 是 The Linux Foundation 的注册商标',W/2,1010,{size:16,color:C.mute,align:'center'});
    });
  }},
]});
