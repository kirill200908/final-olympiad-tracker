export const TOPICS={basics:'База и реализация',search:'Поиск и жадные',dp:'Динамика',graphs:'Графы',structures:'Структуры данных',trees:'Деревья',math:'Математика',strings:'Строки',geometry:'Геометрия',other:'Другое'};
const tagMap={'implementation':'basics','brute force':'basics','constructive algorithms':'basics','greedy':'search','binary search':'search','two pointers':'search','sortings':'search','dp':'dp','graphs':'graphs','dfs and similar':'graphs','shortest paths':'graphs','flows':'graphs','graph matchings':'graphs','dsu':'structures','data structures':'structures','trees':'trees','math':'math','number theory':'math','combinatorics':'math','probabilities':'math','games':'math','bitmasks':'math','strings':'strings','string suffix structures':'strings','hashing':'strings','geometry':'geometry'};
export const DEFAULT_SETTINGS={thresholds:[293,405,476],spread:75,statsWeight:0.25};
export const today=()=>localDate(new Date());
export function localDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function topicsFor(tags=[]){return [...new Set(tags.map(t=>TOPICS[t]?t:tagMap[t]).filter(Boolean))];}
export function taskUrl(platform,id){if(platform==='cses')return `https://cses.fi/problemset/task/${id}/`;const m=/^(\d+)([A-Z]\d?)$/.exec(id);return m?`https://codeforces.com/problemset/problem/${m[1]}/${m[2]}`:'';}
function canonicalNumber(value){const normalized=value.replace(/^0+/,'');if(!normalized||normalized.length>7)throw Error('Номер задачи должен быть положительным целым числом до 9 999 999.');return normalized;}
export function parseIdentifier(value,platform){const s=value.trim();let m;if(/^https?:\/\//i.test(s)){let u;try{u=new URL(s);}catch{throw Error('Проверь ссылку на задачу.');}if(/^(www\.)?codeforces\.com$/.test(u.hostname)){m=/\/(?:problemset\/problem\/(\d+)\/([a-z]\d?)|contest\/(\d+)\/problem\/([a-z]\d?))\/?$/i.exec(u.pathname);if(!m)throw Error('Поддерживаются задачи из основного архива Codeforces.');return {platform:'cf',id:canonicalNumber(m[1]||m[3])+(m[2]||m[4]).toUpperCase()};}if(/^(www\.)?cses\.fi$/.test(u.hostname)){m=/\/problemset\/task\/(\d+)\/?$/.exec(u.pathname);if(m)return {platform:'cses',id:canonicalNumber(m[1])};}throw Error('Вставь ссылку Codeforces или CSES.');}if(platform==='cses'&&/^\d+$/.test(s))return {platform,id:canonicalNumber(s)};m=/^(\d+)\s*([a-z]\d?)$/i.exec(s);if(m)return {platform:'cf',id:canonicalNumber(m[1])+m[2].toUpperCase()};throw Error(platform==='cses'?'Введи номер CSES, например 1634.':'Введи номер, например 1900C, или полную ссылку.');}
export function validateTask(raw){
 if(!raw||typeof raw!=='object')throw Error('Некорректная запись задачи.');
 const platform=raw.platform;if(!['cf','cses'].includes(platform))throw Error('Неизвестная платформа.');
 const parsed=parseIdentifier(String(raw.id||''),platform);const {id}=parsed;if(parsed.platform!==platform)throw Error('Номер не соответствует выбранной платформе.');
 if(!['own','editorial'].includes(raw.mode))throw Error('Выбери способ решения.');
 const date=String(raw.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||localDate(new Date(date+'T12:00:00'))!==date||date>today()||date<'2000-01-01')throw Error('Укажи корректную дату решения, не позднее сегодняшней.');
 const rating=raw.rating==null||raw.rating===''?null:Number(raw.rating);if(rating!==null&&(!Number.isFinite(rating)||rating<800||rating>4000||rating%50))throw Error('Сложность должна быть от 800 до 4000 с шагом 50.');
 const minutes=raw.minutes==null||raw.minutes===''?null:Number(raw.minutes);if(minutes!==null&&(!Number.isInteger(minutes)||minutes<1||minutes>1440))throw Error('Время решения: от 1 до 1440 минут.');
 const name=String(raw.name||'').trim().slice(0,180);if(!name)throw Error('Добавь название задачи.');
 return {uid:`${platform}:${id}`,platform,id,name,mode:raw.mode,date,rating,minutes,tags:topicsFor(Array.isArray(raw.tags)?raw.tags.filter(x=>typeof x==='string'):[]),notes:String(raw.notes||'').slice(0,2000),ratingSource:raw.ratingSource==='official'&&platform==='cf'?'official':'estimate'};
}
export function validateSettings(raw={}){const thresholds=raw.thresholds||DEFAULT_SETTINGS.thresholds;const spread=Number(raw.spread??75),statsWeight=Number(raw.statsWeight??0.25);if(!Array.isArray(thresholds)||thresholds.length!==3||thresholds.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<1||x>800)||!(thresholds[0]<thresholds[1]&&thresholds[1]<thresholds[2]))throw Error('Пороги должны возрастать: III < II < I, от 1 до 800.');if(!Number.isFinite(spread)||spread<30||spread>180)throw Error('Неопределённость: от 30 до 180 баллов.');if(!Number.isFinite(statsWeight)||statsWeight<0||statsWeight>0.5)throw Error('Вес статистики: от 0 до 0.5.');return {thresholds:[...thresholds],spread,statsWeight};}
export function parseBackup(text){const data=JSON.parse(text);if(!data||data.app!=='final-tracker'||data.version!==1||!Array.isArray(data.tasks)||data.tasks.length>20000)throw Error('Это не резервная копия Финала или превышен лимит записей.');const tasks=data.tasks.map(validateTask);if(new Set(tasks.map(x=>x.uid)).size!==tasks.length)throw Error('В копии есть дубли задач.');return {tasks,settings:validateSettings(data.settings),year:[2024,2025,2026].includes(data.year)?data.year:2026};}
const sigmoid=x=>1/(1+Math.exp(-x));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function normalCDF(x){const a=Math.abs(x);const t=1/(1+0.2316419*a);const poly=t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));const c=1-Math.exp(-a*a/2)/Math.sqrt(2*Math.PI)*poly;return x<0?1-c:c;}
export function probabilityFractions(mean,sigma,thresholds){const atLeast=thresholds.map(t=>1-normalCDF((t-mean)/sigma));return [atLeast[2],atLeast[1]-atLeast[2],atLeast[0]-atLeast[1],1-atLeast[0]].map(x=>clamp(x,0,1));}
export function roundPercentages(fractions,digits=0){const scale=10**digits;const raw=fractions.map(x=>x*100*scale),out=raw.map(Math.floor);const remainder=100*scale-out.reduce((a,b)=>a+b,0);const order=raw.map((v,i)=>({i,r:v-out[i]})).sort((a,b)=>b.r-a.r);for(let j=0;j<remainder;j++)out[order[j%order.length].i]++;return out.map(x=>x/scale);}
export function probabilities(mean,sigma,thresholds){return roundPercentages(probabilityFractions(mean,sigma,thresholds));}
export function taskProbabilities(skill,task,{gap=0,statsWeight=0.25}={}){
 const bands=task.bands,range=task.range;
 const fullRating=range?.length===2?(range[0]+range[1])/2:bands.at(-1).rating;
 const logits=bands.map((b,i)=>(skill-(i===bands.length-1?fullRating:b.rating)-gap)/240);
 const expected=offset=>bands.reduce((sum,b,i)=>sum+b.points*sigmoid(logits[i]+offset),0);
 const author=expected(0),q=clamp((task.stats?.mean??50)/100,0.005,0.995);
 const empirical=100*sigmoid(Math.log(q/(1-q))+(skill-gap-1900)/350);
 const target=author*(1-statsWeight)+empirical*statsWeight;
 // One shared odds adjustment preserves nested partial-score milestones while
 // retaining the configured blend of CF difficulty and historical mean score.
 let offset=0;
 if(statsWeight>0){let low=-30,high=30;for(let i=0;i<48;i++){const mid=(low+high)/2;if(expected(mid)<target)low=mid;else high=mid;}offset=(low+high)/2;}
 const chances=logits.map(x=>sigmoid(x+offset));
 const distribution=[{score:0,p:1-chances[0]}];let score=0;
 bands.forEach((band,i)=>{score+=band.points;distribution.push({score:Math.round(score),p:chances[i]-(chances[i+1]??0)});});
 const fullProbability=chances.at(-1);
 const probabilityRange=range?.length===2?[sigmoid((skill-range[1]-gap)/240+offset),sigmoid((skill-range[0]-gap)/240+offset)]:[fullProbability,fullProbability];
 return {day:task.day,index:task.index,score:Math.round(expected(offset)),expectedScore:expected(offset),fullProbability,anyPointsProbability:chances[0],probabilityRange,distribution};
}
export function sumScoreDistributions(distributions){
 let totals=[1];
 for(const outcomes of distributions){const next=Array(totals.length+Math.max(...outcomes.map(x=>x.score))).fill(0);for(let score=0;score<totals.length;score++){if(!totals[score])continue;for(const outcome of outcomes)next[score+outcome.score]+=totals[score]*outcome.p;}totals=next;}
 return totals;
}
export function distributionFractions(distribution,sigma,thresholds){
 const fractions=[0,0,0,0];
 distribution.forEach((mass,score)=>{if(!mass)return;const outcomes=sigma>0?probabilityFractions(score,sigma,thresholds):[score>=thresholds[2]?1:0,score>=thresholds[1]&&score<thresholds[2]?1:0,score>=thresholds[0]&&score<thresholds[1]?1:0,score<thresholds[0]?1:0];outcomes.forEach((p,i)=>fractions[i]+=mass*p);});
 return fractions;
}
export function analyze(tasks,settings=DEFAULT_SETTINGS,now=new Date(),benchmarks=[]){
 const own=tasks.filter(x=>x.mode==='own');const assisted=tasks.filter(x=>x.mode==='editorial');
 const eligible=own.filter(x=>x.rating!=null&&(now-new Date(x.date+'T12:00:00'))/86400000<=365);
 const topicStats=Object.keys(TOPICS).filter(x=>x!=='other').map(key=>({key,name:TOPICS[key],own:own.filter(x=>x.tags.includes(key)).length,editorial:assisted.filter(x=>x.tags.includes(key)).length}));
 const coverage=topicStats.filter(x=>x.own>=2).length;
 if(eligible.length===0)return {available:false,own:own.length,assisted:assisted.length,eligible:eligible.length,topicStats,coverage};
 let skill=null,mean=0,sigma=0,source='tasks',taskPredictions=[],scoreDistribution=null;
 if(eligible.length>=1){const rows=eligible.map(t=>{const age=Math.max(0,(now-new Date(t.date+'T12:00:00'))/86400000);return {rating:t.rating,w:Math.pow(0.5,age/180)*(t.ratingSource==='official'?1:0.65)};}).sort((a,b)=>b.rating-a.rating).slice(0,20);const total=rows.reduce((s,x)=>s+x.w,0);const observed=rows.reduce((s,x)=>s+x.rating*x.w,0)/total;const strength=total/(total+5);skill=1100+(observed-1100)*strength;
  if(benchmarks.length){taskPredictions=benchmarks.map(t=>taskProbabilities(skill,t,{gap:t.topics.some(k=>topicStats.find(x=>x.key===k)?.own>=2)?0:100,statsWeight:settings.statsWeight??0.25}));scoreDistribution=sumScoreDistributions(taskPredictions.map(t=>t.distribution));mean=taskPredictions.reduce((s,t)=>s+t.expectedScore,0);}
  else mean=800*sigmoid((skill-1900)/450);
  sigma=settings.spread+75/Math.sqrt(total+1)+Math.max(0,5-coverage)*5;
 }
 mean=clamp(mean,0,800);sigma=Math.max(30,sigma);const fractions=scoreDistribution?distributionFractions(scoreDistribution,sigma,settings.thresholds):probabilityFractions(mean,sigma,settings.thresholds);return {available:true,mean:Math.round(mean),sigma:Math.round(sigma),skill:skill===null?null:Math.round(skill),p:roundPercentages(fractions),fractions,scoreDistribution,own:own.length,assisted:assisted.length,eligible:eligible.length,topicStats,coverage,source,taskPredictions};
}
export const FORECAST_2027_WEIGHTS=Object.freeze({2024:0.2,2025:0.3,2026:0.5});
export function forecast2027(tasks,history,settings=DEFAULT_SETTINGS,now=new Date()){
 const years=[2024,2025,2026].map(year=>history.find(y=>y.year===year));
 if(years.some(y=>!y||y.tasks?.length!==8||!Array.isArray(y.cutoffs)))throw Error('Для прогноза 2027 нужны все три финала 2024–2026 с восемью задачами и границами дипломов.');
 const scenarios=years.map(y=>({year:y.year,weight:FORECAST_2027_WEIGHTS[y.year],...analyze(tasks,{...settings,thresholds:y.cutoffs},now,y.tasks)}));
 const base=scenarios[0];
 if(!base.available)return {...base,targetYear:2027,scenarios,confidence:'Нет данных'};
 const fractions=[0,0,0,0];for(const scenario of scenarios)scenario.fractions.forEach((p,j)=>fractions[j]+=scenario.weight*p);
 return {...base,targetYear:2027,p:roundPercentages(fractions,1),fractions,mean:Math.round(scenarios.reduce((sum,s)=>sum+s.mean*s.weight,0)),scenarios,confidence:base.eligible<5?'Очень мало данных':base.eligible<15?'Мало данных':'Предварительная оценка'};
}
