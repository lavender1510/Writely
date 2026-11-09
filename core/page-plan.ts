/** Layout-only plan. Inputs are measured line/row fragments, never PM mutations. */
export interface Fragment {from:number;to:number;height:number;breakBefore?:boolean;capacity?:number}
export interface PlannedPage {from:number;to:number;used:number;capacity:number;fragments:Fragment[];overflow:boolean}
export function planPages(fragments:readonly Fragment[],initialCapacity:number):PlannedPage[]{
  if(!Number.isFinite(initialCapacity)||initialCapacity<=0)throw new Error('Die Seitenhöhe ist ungültig.');
  let capacity=initialCapacity;const pages:PlannedPage[]=[];
  let page:PlannedPage|undefined,previous=-1;
  for(const f of fragments){
    if(!Number.isFinite(f.height)||f.height<0||!Number.isInteger(f.from)||!Number.isInteger(f.to)||f.from<previous||f.to<f.from||f.capacity!==undefined&&(!Number.isFinite(f.capacity)||f.capacity<=0))throw new Error('Ein Layoutfragment ist ungültig.');
    previous=f.to;
    const newSection=f.capacity!==undefined&&f.capacity!==capacity;
    if(f.capacity!==undefined)capacity=f.capacity;
    if(!page||f.breakBefore||newSection||page.fragments.length>0&&page.used+f.height>capacity){page={from:f.from,to:f.to,used:0,capacity,fragments:[],overflow:false};pages.push(page);}
    page.fragments.push({...f});page.to=f.to;page.used+=f.height;page.overflow||=page.used>capacity;
  }
  return pages;
}
/** Half-open position intervals; shared boundaries belong to the following page. */
export function pageAtPosition(pages:readonly PlannedPage[],position:number):number|null{
  let low=0,high=pages.length-1;
  while(low<=high){const mid=(low+high)>>>1,p=pages[mid];if(position<p.from)high=mid-1;else if(position>=p.to&&mid<pages.length-1)low=mid+1;else return position<=p.to?mid:null;}
  return null;
}
