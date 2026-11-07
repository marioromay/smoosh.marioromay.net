const audio=document.querySelector('#audio'),button=document.querySelector('#playButton'),stopButton=document.querySelector('#stopButton'),seek=document.querySelector('#seek'),current=document.querySelector('#current'),duration=document.querySelector('#duration'),status=document.querySelector('#status'),trackState=document.querySelector('#trackState'),panel=document.querySelector('.listening');const KEY='smoosh-preview-position';const format=s=>Number.isFinite(s)?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'0:00';function sync(){if(!Number.isFinite(audio.duration)||!audio.duration)return;const p=100*audio.currentTime/audio.duration;seek.value=p;seek.style.setProperty('--progress',p+'%');current.textContent=format(audio.currentTime)}function playing(on){panel.classList.toggle('playing',on);button.setAttribute('aria-label',on?'Stop playback':'Start playback');button.setAttribute('aria-pressed',String(on));button.classList.toggle('active',on);status.textContent=on?'NOW PLAYING':'READY WHEN YOU ARE';trackState.textContent=on?'LISTENING':'PRESS PLAY TO BEGIN'}audio.addEventListener('play',()=>playing(true));audio.addEventListener('pause',()=>playing(false));audio.addEventListener('loadedmetadata',()=>{duration.textContent=format(audio.duration);try{const t=Number(sessionStorage.getItem(KEY));if(Number.isFinite(t)&&t>0&&t<audio.duration-3)audio.currentTime=t}catch(e){}sync()});audio.addEventListener('timeupdate',()=>{sync();try{sessionStorage.setItem(KEY,String(audio.currentTime))}catch(e){}});audio.addEventListener('ended',()=>{playing(false);audio.currentTime=0;try{sessionStorage.removeItem(KEY)}catch(e){}sync()});seek.addEventListener('input',()=>{if(!audio.duration)return;audio.currentTime=audio.duration*Number(seek.value)/100;sync()});if('mediaSession'in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:'Smoosh',artist:'A private listening'});navigator.mediaSession.setActionHandler('play',()=>audio.play());navigator.mediaSession.setActionHandler('pause',()=>audio.pause());navigator.mediaSession.setActionHandler('seekto',e=>{if(e.seekTime!=null)audio.currentTime=e.seekTime})}

/* Real recording waveform. No synthetic oscilloscope trace. */
const scope=document.querySelector('#scope'),scopeShell=scope.parentElement;
let scopePeaks=null;
function scopeDraw(){
 const rect=scope.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
 if(!rect.width||!rect.height)return;
 const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
 if(scope.width!==w||scope.height!==h){scope.width=w;scope.height=h}
 const g=scope.getContext('2d');g.clearRect(0,0,w,h);
 const mid=h/2,amp=h*.42;
 g.strokeStyle='rgba(238,69,55,.18)';g.beginPath();g.moveTo(0,mid);g.lineTo(w,mid);g.stroke();
 if(!scopePeaks)return;
 const count=scopePeaks.length;
 g.strokeStyle='#ee4537';g.lineWidth=Math.max(.85,dpr*.75);g.beginPath();
 for(let i=0;i<count;i++){
  const x=(i+.5)*w/count,level=Math.max(.003,scopePeaks[i])*amp;
  g.moveTo(x,mid-level);g.lineTo(x,mid+level);
 }
 g.stroke();
}
function paintWave(){const p=audio.duration?100*audio.currentTime/audio.duration:0;scopeShell.style.setProperty('--progress',p+'%')}
audio.addEventListener('timeupdate',paintWave);audio.addEventListener('loadedmetadata',paintWave);audio.addEventListener('seeked',paintWave);seek.addEventListener('input',paintWave);
window.addEventListener('resize',scopeDraw);scopeDraw();paintWave();
/* SL-1200 motor: slow pitch-down stop and matching pitch-up start. */
let motorFrame=0,motorMode='idle';
const MOTOR_MS=1450,MIN_RATE=.12;
audio.preservesPitch=false;
if('mozPreservesPitch' in audio)audio.mozPreservesPitch=false;
if('webkitPreservesPitch' in audio)audio.webkitPreservesPitch=false;
function cancelMotor(){if(motorFrame)cancelAnimationFrame(motorFrame);motorFrame=0;motorMode='idle'}
function rampMotor(target){
 const from=audio.paused?MIN_RATE:Math.max(MIN_RATE,audio.playbackRate);
 const to=target==='start'?1:MIN_RATE;
 cancelMotor();
 const durationMs=Math.max(250,MOTOR_MS*Math.abs(to-from)/(1-MIN_RATE));
 motorMode=target;
 const started=performance.now();
 if(target==='start'){
  audio.playbackRate=from;
  audio.play().catch(()=>{cancelMotor();audio.playbackRate=1;status.textContent='PLAYBACK UNAVAILABLE'});
  status.textContent='SPINNING UP';trackState.textContent='STARTING';
 }else{
  status.textContent='SLOWING DOWN';trackState.textContent='STOPPING';
 }
 function frame(now){
  if(motorMode!==target)return;
  const t=Math.min(1,(now-started)/durationMs);
  const eased=t*t*(3-2*t);
  audio.playbackRate=from+(to-from)*eased;
  if(t<1&&!audio.paused)motorFrame=requestAnimationFrame(frame);
  else{
   cancelMotor();
   if(target==='stop'){audio.pause();audio.playbackRate=1;playing(false)}
   else{audio.playbackRate=1;playing(true)}
  }
 }
 motorFrame=requestAnimationFrame(frame);
}
button.addEventListener('click',()=>{if(motorMode!=='start'){loadScrubAudio().then(()=>ctx?.resume().catch(()=>{}));rampMotor('start')}});
stopButton.addEventListener('click',()=>{if(motorMode!=='stop'&&!audio.paused)rampMotor('stop')});

/* Audible vinyl-style scrubbing. Decode the track only after user interaction;
   play short directional grains while the original transport is paused. */
const vinyl=document.querySelector('#vinyl');
let ctx=null,forwardBuffer=null,reverseBuffer=null,decodePromise=null,grain=null,grainGain=null;
let scrubState=null,lastGrainAt=0;
function loadScrubAudio(){
 if(decodePromise)return decodePromise;
 decodePromise=(async()=>{
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)throw Error('Web Audio unavailable');
  ctx=new AudioContextClass();
  // Decoding is allowed before a gesture; resume the audio output only on interaction.
  const response=await fetch(audio.currentSrc||audio.querySelector('source')?.src||'/Smoosh.mp3');
  if(!response.ok)throw Error('Audio unavailable');
  forwardBuffer=await ctx.decodeAudioData(await response.arrayBuffer());
  const samples=forwardBuffer.getChannelData(0),N=1000,step=Math.max(1,Math.floor(samples.length/N));scopePeaks=new Float32Array(N);for(let i=0;i<N;i++){let peak=0;const end=Math.min(samples.length,(i+1)*step),stride=Math.max(1,Math.floor(step/140));for(let k=i*step;k<end;k+=stride)peak=Math.max(peak,Math.abs(samples[k]));scopePeaks[i]=peak}scopeDraw();
  reverseBuffer=ctx.createBuffer(forwardBuffer.numberOfChannels,forwardBuffer.length,forwardBuffer.sampleRate);
  for(let channel=0;channel<forwardBuffer.numberOfChannels;channel++){
   const from=forwardBuffer.getChannelData(channel),to=reverseBuffer.getChannelData(channel);
   for(let i=0,n=from.length;i<n;i++)to[i]=from[n-1-i];
  }
 })().catch(()=>{decodePromise=null;forwardBuffer=null;reverseBuffer=null});
 return decodePromise;
}
function stopGrain(){
 if(grain){try{grain.stop()}catch(e){}grain.disconnect();grain=null}
 if(grainGain){grainGain.disconnect();grainGain=null}
}
function scrubSound(time,velocity){
 if(!ctx||!forwardBuffer||!reverseBuffer||!scrubState)return;
 if(ctx.state==='suspended')ctx.resume().catch(()=>{});
 const now=performance.now();
 if(now-lastGrainAt<35)return;
 lastGrainAt=now;
 stopGrain();
 const speed=Math.max(.35,Math.min(3.5,Math.abs(velocity)||.45));
 const backwards=velocity<0;
 const buffer=backwards?reverseBuffer:forwardBuffer;
 const duration=Math.min(.16,.11*speed);
 const offset=backwards?Math.max(0,forwardBuffer.duration-time):time;
 const start=Math.min(Math.max(0,offset),Math.max(0,buffer.duration-duration*speed));
 grain=ctx.createBufferSource();
 grain.buffer=buffer;grain.playbackRate.value=speed;
 grainGain=ctx.createGain();
 const at=ctx.currentTime;
 grainGain.gain.setValueAtTime(.0001,at);
 grainGain.gain.linearRampToValueAtTime(.6,at+.012);
 grainGain.gain.setValueAtTime(.6,at+Math.max(.018,duration-.025));
 grainGain.gain.linearRampToValueAtTime(.0001,at+duration);
 grain.connect(grainGain).connect(ctx.destination);
 grain.start(at,start,duration*speed);
 grain.stop(at+duration+.01);
}
function beginScrub(kind,e){
 if(e.button!==0||scrubState||motorMode!=='idle')return;
 const wasPlaying=!audio.paused;
 scrubState={kind,id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),velocity:0,wasPlaying,start:audio.currentTime,moved:false};
 cancelMotor();
 audio.pause();
 loadScrubAudio().then(()=>{if(scrubState)ctx?.resume().catch(()=>{})});
 e.currentTarget.setPointerCapture(e.pointerId);
}
function moveScrub(e){
 const s=scrubState;
 if(!s||e.pointerId!==s.id)return;
 const dx=e.clientX-s.x,dy=e.clientY-s.y;
 const now=performance.now(),dt=Math.max(8,now-s.time);
 if(s.kind==='vinyl'){
  if(!s.moved&&Math.abs(dx)<5)return;
  s.moved=true;
  vinyl.classList.add('scratching');
  const width=Math.max(1,vinyl.getBoundingClientRect().width);
  vinyl.style.setProperty('--scratch-angle',(dx/width*180)+'deg');
  if(Number.isFinite(audio.duration)&&audio.duration>0)
   audio.currentTime=Math.max(0,Math.min(audio.duration,s.start+dx/width*audio.duration*.6));
 }else{
  s.moved=true;
  if(Number.isFinite(audio.duration)&&audio.duration>0){
   const rect=seek.getBoundingClientRect();
   audio.currentTime=Math.max(0,Math.min(audio.duration,(e.clientX-rect.left)/rect.width*audio.duration));
  }
 }
 const direction=dx===0?0:Math.sign(dx);
 s.velocity=direction*Math.max(.35,Math.min(3.5,Math.abs(e.movementX||dx)/dt*12));
 s.x=e.clientX;s.y=e.clientY;s.time=now;s.start=audio.currentTime;
 sync();paintWave();
 if(direction!==0)scrubSound(audio.currentTime,s.velocity);
}
function finishScrub(e){
 const s=scrubState;
 if(!s||e.pointerId!==s.id)return;
 scrubState=null;stopGrain();
 vinyl.classList.remove('scratching');vinyl.style.removeProperty('--scratch-angle');
 if(s.wasPlaying)audio.play().catch(()=>{});
 else playing(false);
}
vinyl.addEventListener('pointerdown',e=>beginScrub('vinyl',e));
vinyl.addEventListener('pointermove',moveScrub);
vinyl.addEventListener('pointerup',finishScrub);
vinyl.addEventListener('pointercancel',finishScrub);
seek.addEventListener('pointerdown',e=>beginScrub('wave',e));
seek.addEventListener('pointermove',moveScrub);
seek.addEventListener('pointerup',finishScrub);
seek.addEventListener('pointercancel',finishScrub);

/* Restore scope progress after all transport transitions. */
audio.addEventListener('play',()=>{stopButton.classList.remove('active')});
audio.addEventListener('pause',()=>{button.classList.remove('active')});

/* Begin waveform decoding as soon as the authenticated page loads.
   No playback or AudioContext resume occurs until user interaction. */
loadScrubAudio();

/* Read along: word-aligned phrase starts from the recording. */
const readToggle=document.querySelector('#readToggle'),transcript=document.querySelector('#transcript');
const cueData=[[1.04,"Sonya... to the world... is Sonya."],[4.2,"She goes about... being Sonya."],[7.28,"Then somewhere along the way..."],[9.24,"she meets... Mr. Mario."],[12.12,"And to Mr. Mario..."],[13.82,"she became Smoosh."],[16.94,"At first... Smoosh was a name."],[20.1,"Then Mr. Mario noticed... something else."],[23.38,"A Smoosh phenomenon."],[26.62,"Certain conditions... seem to bring out Smoosh."],[29.76,"It happens when they share..."],[31.42,"a certain frequency."],[32.92,"Two tempos... tempoing independently..."],[36.16,"until one catches the other..."],[39.32,"discovering synchronicity."],[42.5,"And somewhere... between the notes..."],[45.78,"Smoosh appears."],[49.24,"Sonya slows down."],[52.08,"Her voice gets softer."],[55.44,"Sonya gets sweeter."],[58.58,"Mr. Mario catches her glance..."],[61.96,"Sonya blushes..."],[65.019,"and her eyes give it away."],[68.3,"That special smile emerges."],[71.44,"Sonya has a smile... Smoosh has one too."],[77.76,"Mr. Mario knows... the difference."],[81.08,"Sonya... to the world."],[84.32,"Smoosh... to Mr. Mario."],[87.3,"When their hands... are handing together..."],[90.62,"two temperatures meet."],[92.2,"His runs warm..."],[94,"hers... a little cooler."],[97.22,"Warm meets cool... and cool meets warm..."],[103.36,"temperatures begin tempering."],[106.7,"Optimal balance... has been dialed in."],[109.8,"Her hand keeps him cool."],[113.02,"Her smile gives him calm."],[116.16,"Her eyes set him free."],[119.56,"COOL... CALM... FREE."],[125.78,"Sometimes her other hand..."],[129.08,"gently pets his mitt."],[132.22,"A small gesture... accenting the moment."],[137.08,"Mitt... Sonya's word for Mr. Mario's hands."],[141.74,"And the mitts... they fit."],[148.22,"A custom fit... no alterations required."],[154.7,"The first kiss... saisons were consumed."],[160.96,"Mr. Mario asked... for permission."],[164.28,"Sonya... agreed."],[167.64,"As if one meaning wasn't enough..."],[170.62,"Smoosh became a verb."],[173.86,"To smoosh... to kiss."],[180.16,"But to Smoosh Smoosh... is more than a kiss."],[186.82,"Tender... sweet... pure."],[196.26,"Every time."],[199.42,"During a Smoosh Smoosh event..."],[202.7,"the rest of the world... takes five."],[205.82,"It's like finding... a pocket of light."],[208.98,"Except this pocket... you don't capture."],[212.14,"You stay... in the pocket."],[215.34,"But wherever it happens..."],[218.72,"they share that frequency."],[221.8,"And there... between the notes..."],[224.94,"there she is... Smoosh."]];

const lineWrap=document.querySelector('#transcriptLines');
const readAction=readToggle.querySelector('.read-toggle-action');
const cueEls=cueData.map(([t,text])=>{
 const el=document.createElement('button');el.type='button';el.className='transcript-line';el.textContent=text;
 el.setAttribute('aria-label','Seek to: '+text);
 el.addEventListener('click',()=>{audio.currentTime=Math.min(audio.duration||231,t);sync();paintWave();followText(true)});
 lineWrap.appendChild(el);return el;
});
let currentCue=-1,userScrolledAt=0,autoScrolling=false;
readToggle.addEventListener('click',()=>{
 const open=readToggle.getAttribute('aria-expanded')!=='true';
 readToggle.setAttribute('aria-expanded',String(open));transcript.hidden=!open;
 readAction.firstChild.textContent=open?'HIDE LYRICS ':'SHOW LYRICS ';
 if(open)followText(true);
});
lineWrap.addEventListener('wheel',()=>{userScrolledAt=Date.now()},{passive:true});
lineWrap.addEventListener('touchstart',()=>{userScrolledAt=Date.now()},{passive:true});
lineWrap.addEventListener('pointerdown',()=>{userScrolledAt=Date.now()},{passive:true});
lineWrap.addEventListener('keydown',()=>{userScrolledAt=Date.now()});
function followText(force=false){
 if(transcript.hidden)return;
 let i=0;for(let k=1;k<cueData.length;k++){if(cueData[k][0]>audio.currentTime)break;i=k}
 if(i===currentCue&&!force)return;
 if(currentCue>=0){cueEls[currentCue].classList.remove('active');cueEls[currentCue].removeAttribute('aria-current')}
 currentCue=i;
 cueEls.forEach((el,k)=>el.classList.toggle('past',k<i));
 const el=cueEls[i];el.classList.add('active');el.setAttribute('aria-current','true');
 if(force||Date.now()-userScrolledAt>4500){
  const top=el.offsetTop-lineWrap.offsetTop-(lineWrap.clientHeight-el.offsetHeight)/2;
  lineWrap.scrollTo({top:Math.max(0,top),behavior:force||window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
}
audio.addEventListener('timeupdate',()=>followText());
audio.addEventListener('seeked',()=>followText(true));
