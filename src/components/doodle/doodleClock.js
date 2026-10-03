const durations={'01':[180,180,180,180,180,180],'02':[240,240,240,240,240,240],'03':[180,180,180,180,180,180],'04':[600,250,250,250,250,300]};
const clocks=new Map();
function clock(id){if(!clocks.has(id))clocks.set(id,{index:0,listeners:new Set(),timer:null});return clocks.get(id);}
export function subscribe(id,notify){
  const c=clock(id);c.listeners.add(notify);
  const run=()=>{c.timer=setTimeout(()=>{c.index=(c.index+1)%6;c.listeners.forEach(fn=>fn());run();},durations[id][c.index]);};
  if(c.timer===null)run();
  return()=>{c.listeners.delete(notify);if(!c.listeners.size){clearTimeout(c.timer);c.timer=null;}};
}
export const frame=id=>clock(id).index;
