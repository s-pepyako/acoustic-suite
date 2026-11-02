import {simulate} from './model.js';
self.onmessage=({data})=>{try{const result=simulate(data.project??data,value=>self.postMessage({type:'progress',value}),data.detail??data.project?.detail??data.detail);self.postMessage({type:'result',result},[result.amplitude.buffer,result.solid.buffer]);}catch(e){self.postMessage({type:'error',message:e.message});}};
