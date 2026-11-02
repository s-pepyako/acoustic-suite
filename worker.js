import {simulate} from './model.js';
self.onmessage=({data})=>{try{const result=simulate(data,value=>self.postMessage({type:'progress',value}));self.postMessage({type:'result',result},[result.amplitude.buffer,result.solid.buffer]);}catch(e){self.postMessage({type:'error',message:e.message});}};
