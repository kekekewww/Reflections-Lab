// Independent synthetic reference. No candidate, product, browser or runner imports.
// All arithmetic expectations use BigInt fractions. round64 implements nearest/ties-even.
const abs = n => n < 0n ? -n : n;
const gcd = (a, b) => { a=abs(a); b=abs(b); while (b) [a,b]=[b,a%b]; return a; };
export function q(n, d=1n) {
  if (Array.isArray(n)) return q(n[0],n[1]);
  if (typeof n === 'string' && n.includes('/')) { const p=n.split('/'); if(p.length!==2) throw Error('RATIONAL'); return q(BigInt(p[0]),BigInt(p[1])); }
  if (typeof n === 'number' && !Number.isSafeInteger(n)) throw Error('INTEGER_REQUIRED');
  n=BigInt(n); d=BigInt(d); if(!d) throw Error('ZERO_DENOMINATOR');
  if(d<0n) { n=-n; d=-d; } const g=gcd(n,d); return [n/g,d/g];
}
export const literal = a => { a=q(a); return a[1]===1n ? String(a[0]) : `${a[0]}/${a[1]}`; };
export const add = (a,b) => { a=q(a); b=q(b); return q(a[0]*b[1]+b[0]*a[1],a[1]*b[1]); };
export const sub = (a,b) => { a=q(a); b=q(b); return q(a[0]*b[1]-b[0]*a[1],a[1]*b[1]); };
export const mul = (a,b) => { a=q(a); b=q(b); return q(a[0]*b[0],a[1]*b[1]); };
export const div = (a,b) => { a=q(a); b=q(b); return q(a[0]*b[1],a[1]*b[0]); };
export const cmp = (a,b) => { a=q(a); b=q(b); const c=a[0]*b[1]-b[0]*a[1]; return c<0n?-1:c>0n?1:0; };
const min=(a,b)=>cmp(a,b)<=0?a:b, max=(a,b)=>cmp(a,b)>=0?a:b;
export function bits(value) { const v=new DataView(new ArrayBuffer(8)); v.setFloat64(0,value,false); return v.getBigUint64(0,false).toString(16).padStart(16,'0'); }
export function fromBits(hex) { const v=new DataView(new ArrayBuffer(8)); v.setBigUint64(0,BigInt(`0x${hex}`),false); return v.getFloat64(0,false); }
export function exactNumber(value) {
  if(typeof value!=='number'||!Number.isFinite(value)) throw Error('NONFINITE_INPUT');
  const raw=BigInt(`0x${bits(value)}`), sign=raw>>63n ? -1n:1n;
  const exponent=Number((raw>>52n)&2047n), fraction=raw&((1n<<52n)-1n);
  const mantissa=exponent ? fraction+(1n<<52n):fraction, shift=exponent ? exponent-1075:-1074;
  return shift>=0 ? q(sign*(mantissa<<BigInt(shift))) : q(sign*mantissa,1n<<BigInt(-shift));
}
const integerRoundEven = (n,d) => { const quotient=n/d, remainder=n%d, twice=2n*remainder; return quotient+(twice>d || (twice===d && quotient%2n) ? 1n:0n); };
export function round64(value) {
  let [n,d]=q(value); if(!n) return 0;
  const sign=n<0n?1n<<63n:0n; n=abs(n);
  let e=n.toString(2).length-d.toString(2).length;
  if(e>=0 ? n<(d<<BigInt(e)) : (n<<BigInt(-e))<d) e--;
  let encoded;
  if(e < -1022) encoded=integerRoundEven(n<<1074n,d);
  else {
    const shift=52-e;
    let significand=shift>=0 ? integerRoundEven(n<<BigInt(shift),d) : integerRoundEven(n,d<<BigInt(-shift));
    if(significand===(1n<<53n)) { significand>>=1n; e++; }
    if(e>1023) encoded=2047n<<52n;
    else encoded=(BigInt(e+1023)<<52n)+(significand-(1n<<52n));
  }
  return fromBits((sign|encoded).toString(16).padStart(16,'0'));
}
export function softwareOperation(op,a,b) {
  const left=exactNumber(a),right=exactNumber(b);
  const operations={add,sub,mul,div}; if(!operations[op]) throw Error('OPERATION');
  const value=round64(operations[op](left,right));
  if(!Number.isFinite(value)) throw Error('ORDERED_OVERFLOW');
  return value;
}

// A coverage-count sweep over exact endpoints: independent of the candidate's
// sort-and-merge routine, task clipping loop, and frameIndex traversal.
// Touching cells form one connected component. Isolated points have measure zero.
export function sweepUnion(intervals, left, right) {
  left=q(left); right=q(right); if(cmp(left,right)>=0) throw Error('NONPOSITIVE_WINDOW');
  const events=new Map();
  const change=(point,delta)=> { const key=literal(point), previous=events.get(key); events.set(key,{point:q(point),delta:delta+(previous?.delta??0)}); };
  for(const [a,b] of intervals) {
    if(cmp(a,b)>0) throw Error('REVERSED_TASK');
    const start=max(q(a),left),stop=min(q(b),right);
    if(cmp(start,stop)<0) { change(start,1); change(stop,-1); }
  }
  const ordered=[...events.values()].sort((a,b)=>cmp(a.point,b.point));
  const union=[]; let active=0,open=null;
  for(const event of ordered) {
    const before=active; active+=event.delta;
    if(before===0 && active>0) open=event.point;
    if(before>0 && active===0) { union.push([open,event.point]); open=null; }
  }
  if(active!==0) throw Error('SWEEP_UNBALANCED'); return union;
}
export function occupancyExact(bins,union) {
  return bins.slice(0,-1).map((left,i)=>union.reduce((sum,[a,b])=>add(sum,max(q(0),sub(min(b,bins[i+1]),max(a,left)))),q(0)));
}
function validate(input) {
  if(!input || !Array.isArray(input.rawRaf) || !Array.isArray(input.tasks)) throw Error('INPUT_SHAPE');
  if(input.rawRaf.length>90000||input.tasks.length>200000) throw Error('INPUT_CAP');
  for(const value of [input.origin,input.duration,input.finish,input.begin,input.end,...input.rawRaf]) exactNumber(value);
  if(input.duration<=0 || input.finish<=input.origin || input.end<=input.begin) throw Error('NONPOSITIVE_WINDOW');
  if(softwareOperation('sub',input.finish,input.origin)!==input.duration) throw Error('DURATION_MISMATCH');
  softwareOperation('sub',input.end,input.begin);
  for(let i=0;i<input.rawRaf.length;i++) if((i&&input.rawRaf[i]<=input.rawRaf[i-1])||input.rawRaf[i]<input.origin||input.rawRaf[i]>input.finish) throw Error('RAW_ORDER_OR_WINDOW');
  for(const task of input.tasks) {
    if(!task || typeof task.ts!=='number' || typeof task.dur!=='number') throw Error('TASK_SHAPE');
    exactNumber(task.ts); exactNumber(task.dur); if(task.dur<0) throw Error('NEGATIVE_DURATION');
    softwareOperation('add',task.ts,task.dur); // validate BEFORE window filtering
  }
}
export function independentReference(input) {
  validate(input);
  if(input.rawRaf.length>256||input.tasks.length>512) throw Error('SMALL_ORACLE_CAP');
  const performanceBins=[input.origin,...input.rawRaf.filter(t=>t>input.origin&&t<input.finish),input.finish];
  const nativeExact=performanceBins.map(t=>add(exactNumber(input.begin),mul(div(sub(exactNumber(t),exactNumber(input.origin)),exactNumber(input.duration)),sub(exactNumber(input.end),exactNumber(input.begin)))));
  const nativeOrdered=performanceBins.map(t=>softwareOperation('add',input.begin,softwareOperation('mul',softwareOperation('div',softwareOperation('sub',t,input.origin),input.duration),softwareOperation('sub',input.end,input.begin))));
  const mathematicalTasks=input.tasks.map(t=>[exactNumber(t.ts),add(exactNumber(t.ts),exactNumber(t.dur))]);
  const binaryTasks=input.tasks.map(t=>[exactNumber(t.ts),exactNumber(softwareOperation('add',t.ts,t.dur))]);
  const exactUnion=sweepUnion(mathematicalTasks,exactNumber(input.begin),exactNumber(input.end));
  const binaryUnion=sweepUnion(binaryTasks,exactNumber(input.begin),exactNumber(input.end));
  const exactUs=occupancyExact(nativeExact,exactUnion);
  // Rounded subtraction, per connected component /1000, then left-to-right add.
  // Use the independent sweep components, never elementary cell sums here.
  const orderedMs=nativeOrdered.slice(0,-1).map((left,i)=> {
    let total=0;
    for(const [a,b] of binaryUnion) {
      const lo=max(a,exactNumber(left)),hi=min(b,exactNumber(nativeOrdered[i+1]));
      if(cmp(lo,hi)<0) total=softwareOperation('add',total,softwareOperation('div',softwareOperation('sub',round64(hi),round64(lo)),1000));
    }
    return total;
  });
  const selected=binaryTasks.filter(([a,b])=>cmp(b,exactNumber(input.begin))>=0&&cmp(a,exactNumber(input.end))<=0).map(([a,b])=>[max(a,exactNumber(input.begin)),min(b,exactNumber(input.end))]).sort((a,b)=>cmp(a[0],b[0]));
  // Preserve the original coverage predicate: the stop of last-starting task,
  // not the union's farthest stop. Do not silently fix that historical behavior.
  const complete=selected.length>0&&softwareOperation('sub',round64(selected[0][0]),input.begin)<=50000&&softwareOperation('sub',input.end,round64(selected.at(-1)[1]))<=50000;
  return {
    mathematical:{native:nativeExact.map(literal),union:exactUnion.map(pair=>pair.map(literal)),occupancyUs:exactUs.map(literal),occupancyMs:exactUs.map(x=>literal(div(x,1000)))},
    ordered:{native:nativeOrdered,nativeBits:nativeOrdered.map(bits),union:binaryUnion.map(pair=>pair.map(round64)),occupancyMs:orderedMs,occupancyBits:orderedMs.map(bits),complete,reportedMs:complete?orderedMs:[],selectedTasks:selected.length}
  };
}
export function validateNumericInput(input) { validate(input); return true; }
