// Fixed independent literals. Inputs are exact binary64 values; units ms/raw, us/native.
const task=(ts,stop)=>({ts,dur:stop-ts});
const common={origin:0,duration:4,finish:4,rawRaf:[0,1,2,3,4],begin:0.5,end:1000.5};
const fixture=(id,intervals,native,us,ms,union,rationale,overrides={},complete=true)=>({id,input:{...structuredClone(common),...overrides,tasks:intervals.map(([a,b])=>task(a,b))},expected:{native,occupancyMs:ms,complete},mathematical:{native:native.map(String),union,occupancyUs:us,occupancyMs:us.map(x=>({0:'0',250:'1/4',125:'1/8','1/4':'1/4000'}[x]??'EXPLICIT_OVERRIDE_REQUIRED'))},rationale});
const edges=[0.5,250.5,500.5,750.5,1000.5];
export const NUMERIC_FIXTURES=[
 fixture('empty',[],edges,['0','0','0','0'],[0,0,0,0],[],'No tasks: zero potential occupancy, complete=false, reported occupancy empty.',{},false),
 fixture('fractional-full',[[0.5,1000.5]],edges,['250','250','250','250'],[.25,.25,.25,.25],[['1/2','2001/2']],'Half-us anchors and both exact raw endpoints; one component covers each bin.'),
 fixture('outside-touch-only',[[-249.5,.5],[1000.5,1250.5]],edges,['0','0','0','0'],[0,0,0,0],[],'Tasks touching only either original edge contribute zero duration.'),
 fixture('nested-duplicate-zero',[[.5,500.5],[125.5,375.5],[.5,500.5],[250.5,250.5]],edges,['250','250','0','0'],[.25,.25,0,0],[['1/2','1001/2']],'Duplicates, nesting and a point cannot add energy/time to interval union.'),
 fixture('overlap',[[.5,250.5],[125.5,375.5]],edges,['250','125','0','0'],[.25,.125,0,0],[['1/2','751/2']],'An overlap is counted once, including the exact interior bin edge.'),
 fixture('touching',[[.5,125.5],[125.5,250.5]],edges,['250','0','0','0'],[.25,0,0,0],[['1/2','501/2']],'Touching positive intervals form one connected component before /1000.'),
 fixture('two-sided-clip',[[-124.5,125.5],[875.5,1125.5]],edges,['125','0','0','125'],[.125,0,0,.125],[['1/2','251/2'],['1751/2','2001/2']],'Clip tasks to the original native anchors; both outside tails disappear.'),
 fixture('sub-microsecond',[[.25,.5],[.75,1]],[.25,.5,.75,1,1.25],['1/4','0','1/4','0'],[.00025,0,.00025,0],[['1/4','1/2'],['3/4','1']],'Quarter-us components exercise fractional endpoints and one division rounding.',{begin:.25,end:1.25}),
 {id:'mapping-order-divergence',input:{origin:0,duration:10,finish:10,rawRaf:[0,1,10],begin:0,end:3,tasks:[task(0,3)]},expected:{native:[0,.30000000000000004,3],occupancyMs:[.00030000000000000003,.0027],complete:true},mathematical:{native:['0','3/10','3'],union:[['0','3']],occupancyUs:['3/10','27/10'],occupancyMs:['3/10000','27/10000']},rationale:'Ordered (1/10)*3 is 0.30000000000000004; exact rational 3/10 rounds to 0.3. Compare each to its own reference.'},
 {id:'per-component-division-order',input:{origin:0,duration:1,finish:1,rawRaf:[0,1],begin:0,end:1000,tasks:[task(0,100),task(200,400)]},expected:{native:[0,1000],occupancyMs:[.30000000000000004],complete:true},mathematical:{native:['0','1000'],union:[['0','100'],['200','400']],occupancyUs:['300'],occupancyMs:['3/10']},rationale:'0.1+0.2 is 0.30000000000000004; combined300/1000 is0.3 and is forbidden reassociation.'},
 {id:'fractional-origin-dyadic-ratio',input:{origin:100.25,duration:4,finish:104.25,rawRaf:[100.25,101.25,102.25,103.25,104.25],begin:1000.5,end:9000.5,tasks:[task(.5,3000.5),task(1500.5,2000.5),task(3000.5,4000.5),task(3500.5,5000.5),task(8000.5,9500.5)]},expected:{native:[1000.5,3000.5,5000.5,7000.5,9000.5],occupancyMs:[2,2,0,1],complete:true},mathematical:{native:['2001/2','6001/2','10001/2','14001/2','18001/2'],union:[['2001/2','10001/2'],['16001/2','18001/2']],occupancyUs:['2000','2000','0','1000'],occupancyMs:['2','2','0','1']},rationale:'Fractional origin, raw values and native anchors; dyadic ratio makes every mapping step exact.'},
 {id:'original-coverage-exact-50000',input:{origin:0,duration:1,finish:1,rawRaf:[],begin:0,end:100100,tasks:[task(50000,50100)]},expected:{native:[0,100100],occupancyMs:[.1],complete:true},mathematical:{native:['0','100100'],union:[['50000','50100']],occupancyUs:['100'],occupancyMs:['1/10']},rationale:'Both coverage distances are exactly50000us, inclusive in unchanged original predicate.'},
 {id:'original-coverage-outside-50000',input:{origin:0,duration:1,finish:1,rawRaf:[],begin:0,end:100100.5,tasks:[task(50000.25,50100.25)]},expected:{native:[0,100100.5],occupancyMs:[.1],complete:false},mathematical:{native:['0','200201/2'],union:[['200001/4','200401/4']],occupancyUs:['100'],occupancyMs:['1/10']},rationale:'Both coverage distances50000.25us: potential occupancy0.1ms but reported array must remain empty.'},
 {id:'original-coverage-subtraction-rounding',input:{origin:0,duration:1,finish:1,rawRaf:[],begin:-(2**-40),end:50100,tasks:[task(50000,50100)]},expected:{native:[-(2**-40),50100],occupancyMs:[.1],complete:true},mathematical:{native:['-1/1099511627776','50100'],union:[['50000','50100']],occupancyUs:['100'],occupancyMs:['1/10']},rationale:'Exact leading distance50000+2^-40 exceeds50000, but original binary64 subtraction rounds to50000 and passes. Preserve that ordered predicate.'},
];
// Convert binary-exact literal native numbers to canonical rational strings in the
// standard fixtures only. These explicit literals are independent of the oracle.
for(const f of NUMERIC_FIXTURES.slice(0,8)) f.mathematical.native=f.expected.native.map(x=>({'0.25':'1/4','0.75':'3/4','1':'1','1.25':'5/4','0.5':'1/2','250.5':'501/2','500.5':'1001/2','750.5':'1501/2','1000.5':'2001/2'}[String(x)]??String(x)));
const base=()=>({origin:0,duration:4,finish:4,rawRaf:[1,2,3],begin:0,end:4000,tasks:[task(0,4000)]});
const bad=(id,change,error,rationale)=>{const input=base();change(input);return{id,input,expectedError:error,rationale};};
export const ERROR_FIXTURES=[
 bad('raw-NaN',x=>x.rawRaf[0]=NaN,'NONFINITE_INPUT','NaN cannot become a missing/filtered frame.'),
 bad('raw-Infinity',x=>x.rawRaf[0]=Infinity,'NONFINITE_INPUT','Infinity cannot become an outside frame that vanishes.'),
 bad('begin-Infinity',x=>x.begin=-Infinity,'NONFINITE_INPUT','Original native anchors must be finite.'),
 bad('task-NaN',x=>x.tasks.push({ts:NaN,dur:1}),'NONFINITE_INPUT','Malformed task cannot hide behind a good task.'),
 bad('task-Infinity',x=>x.tasks.push({ts:1,dur:Infinity}),'NONFINITE_INPUT','All task durations validated before clipping.'),
 bad('outside-negative-duration',x=>x.tasks.push({ts:-1e12,dur:-1}),'NEGATIVE_DURATION','Outside malformed candidate cannot be discarded first.'),
 bad('finite-task-end-overflow',x=>x.tasks.push({ts:Number.MAX_VALUE,dur:Number.MAX_VALUE}),'ORDERED_OVERFLOW','Finite ts,dur with infinite ordered sum remains invalid.'),
 bad('finite-anchor-span-overflow',x=>{x.begin=-Number.MAX_VALUE;x.end=Number.MAX_VALUE;},'ORDERED_OVERFLOW','Exact midpoint is0 mathematically; original end-begin overflows. No rational repair.'),
 bad('zero-duration-window',x=>{x.duration=0;x.finish=0;},'NONPOSITIVE_WINDOW','Window duration must be positive.'),
 bad('reversed-native-window',x=>x.end=-1,'NONPOSITIVE_WINDOW','Native anchors retain original order.'),
 bad('duplicate-raw',x=>x.rawRaf=[1,1],'RAW_ORDER_OR_WINDOW','Duplicate raw value cannot create zero-width extra bin.'),
 bad('reversed-raw',x=>x.rawRaf=[2,1],'RAW_ORDER_OR_WINDOW','Original raw order is required; no sort repair.'),
 bad('raw-one-ulp-outside',x=>x.rawRaf=[4.000000000000001],'RAW_ORDER_OR_WINDOW','One-ulp future raw retained as a failure; no epsilon/round/shift.'),
 bad('duration-mismatch',x=>x.duration=3,'DURATION_MISMATCH','Do not change duration to fit anchors.'),
 bad('task-string',x=>x.tasks.push({ts:1,dur:'1'}),'TASK_SHAPE','No numeric string coercion.'),
];
export function candidateNumericAdapterInput(fixture) {
 const {origin,duration,finish,rawRaf,begin,end,tasks}=structuredClone(fixture.input);
 return {ui:{startedAtPerformanceMs:origin,sampleMilliseconds:duration,collectionWindow:{endPerformanceMs:finish},frame:rawRaf.map(timestamp=>({timestamp}))},validated:{qualified:true,begin,end,validatedTasks:tasks.map(t=>({...t,pid:7,tid:9}))}};
}
export const FULL_CAP_SPEC=Object.freeze({id:'closed-form-90000-raw-200000-task',rawFrames:90000,tasks:200000,origin:0,duration:131072,finish:131072,begin:0,end:131072000,expectedBins:90002,expectedOccupancies:90001,expectedFirst90000OccupanciesMs:1,expectedLastOccupancyMs:41072,expectedUnion:[[0,131072000]],complete:true,rationale:'i/2^17 and nativeSpan=1000*2^17 are exactly representable. Every original ordered mapping equals1000*i exactly.200000 duplicate full-window tasks form one component.'});
export function fullCapFixture(rawFrames=90000,tasks=200000) {
 return {id:FULL_CAP_SPEC.id,input:{origin:0,duration:131072,finish:131072,rawRaf:Array.from({length:rawFrames},(_,i)=>i+1),begin:0,end:131072000,tasks:Array.from({length:tasks},()=>({ts:0,dur:131072000}))}};
}
