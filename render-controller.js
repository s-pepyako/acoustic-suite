// Coalesce edits, reject stale results, and refine only after a quiet interval.
export class RenderController{
 constructor({createWorker,onResult,onStatus,onBusy,onError,previewDelay=50,refineDelay=350}){Object.assign(this,{createWorker,onResult,onStatus,onBusy,onError,previewDelay,refineDelay});this.live=false;this.revision=0;this.job=null;this.timer=null;}
 stop(){clearTimeout(this.timer);this.timer=null;this.job?.worker.terminate();this.job=null;this.onBusy(false);}
 setLive(enabled,project){this.live=enabled;this.stop();if(enabled)this.change(project);}
 change(project){this.latest=structuredClone(project);this.revision++;clearTimeout(this.timer);if(this.job?.stage==='detail')this.stop();if(this.live){this.onStatus('Updating field...');if(!this.job)this.schedule('preview',this.previewDelay);}else{this.stop();this.onStatus('Settings changed - calculate field');}}
 schedule(stage,delay){clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=null;this.start(stage);},delay);}
 manual(project){this.stop();this.latest=structuredClone(project);this.revision++;this.start('detail');}
 start(stage){
  if(this.job||!this.latest)return;const revision=this.revision,project=structuredClone(this.latest),detail=stage==='preview'?32:project.detail,worker=this.createWorker();const job={worker,stage,revision};this.job=job;this.onBusy(true);this.onStatus(stage==='preview'?'Live preview...':'Refining field...');
  const end=()=>{if(this.job!==job)return false;worker.terminate();this.job=null;this.onBusy(false);return true;};
  const error=message=>{if(!end())return;if(revision!==this.revision){if(this.live)this.schedule('preview',0);return;}if(stage==='preview'){this.schedule('detail',this.refineDelay);return;}this.onError(message);};
  worker.onerror=e=>error(e.message||'Worker failed');
  worker.onmessage=({data})=>{
   if(this.job!==job)return;
   if(data.type==='progress'){if(revision===this.revision)this.onStatus(`${stage==='preview'?'Preview':'Refining'} - ${Math.round(data.value*100)}%`);return;}
   if(data.type==='error'){error(data.message);return;}
   if(!end())return;
   if(revision!==this.revision){if(this.live)this.schedule('preview',0);return;}
   this.onResult(data.result,stage,project);
   if(stage==='preview'&&this.live)this.schedule('detail',this.refineDelay);
  };
  worker.postMessage({project,detail});
 }
}
