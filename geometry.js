export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function moveRectangle(rect,dx,dy,width,depth){return {...rect,x:clamp(rect.x+dx,0,width-rect.w),y:clamp(rect.y+dy,0,depth-rect.h)};}
export function resizeRectangle(rect,corner,dx,dy,width,depth){
 let left=rect.x,right=rect.x+rect.w,bottom=rect.y,top=rect.y+rect.h;
 if(corner.includes('w'))left=clamp(left+dx,0,right-.05);else right=clamp(right+dx,left+.05,width);
 if(corner.includes('s'))bottom=clamp(bottom+dy,0,top-.05);else top=clamp(top+dy,bottom+.05,depth);
 return {x:left,y:bottom,w:Math.max(.05,right-left),h:Math.max(.05,top-bottom)};
}
export function corners(o){return [['sw',o.x,o.y],['se',o.x+o.w,o.y],['nw',o.x,o.y+o.h],['ne',o.x+o.w,o.y+o.h]];}
