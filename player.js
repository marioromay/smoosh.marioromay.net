const audio=document.querySelector('#audio'),button=document.querySelector('#playButton'),seek=document.querySelector('#seek'),current=document.querySelector('#current'),duration=document.querySelector('#duration'),status=document.querySelector('#status'),trackState=document.querySelector('#trackState'),panel=document.querySelector('.listening');const KEY='smoosh-preview-position';const format=s=>Number.isFinite(s)?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'0:00';function sync(){if(!Number.isFinite(audio.duration)||!audio.duration)return;const p=100*audio.currentTime/audio.duration;seek.value=p;seek.style.setProperty('--progress',p+'%');current.textContent=format(audio.currentTime)}function playing(on){panel.classList.toggle('playing',on);button.setAttribute('aria-label',on?'Stop playback':'Start playback');button.setAttribute('aria-pressed',String(on));status.textContent=on?'NOW PLAYING':'READY WHEN YOU ARE';trackState.textContent=on?'LISTENING':'PRESS PLAY TO BEGIN'}audio.addEventListener('play',()=>playing(true));audio.addEventListener('pause',()=>playing(false));audio.addEventListener('loadedmetadata',()=>{duration.textContent=format(audio.duration);try{const t=Number(sessionStorage.getItem(KEY));if(Number.isFinite(t)&&t>0&&t<audio.duration-3)audio.currentTime=t}catch(e){}sync()});audio.addEventListener('timeupdate',()=>{sync();try{sessionStorage.setItem(KEY,String(audio.currentTime))}catch(e){}});audio.addEventListener('ended',()=>{playing(false);audio.currentTime=0;try{sessionStorage.removeItem(KEY)}catch(e){}sync()});seek.addEventListener('input',()=>{if(!audio.duration)return;audio.currentTime=audio.duration*Number(seek.value)/100;sync()});if('mediaSession'in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:'Smoosh',artist:'A private listening'});navigator.mediaSession.setActionHandler('play',()=>audio.play());navigator.mediaSession.setActionHandler('pause',()=>audio.pause());navigator.mediaSession.setActionHandler('seekto',e=>{if(e.seekTime!=null)audio.currentTime=e.seekTime})}
const waveform=document.querySelector('#waveform');const BAR_COUNT=96;const bars=[];for(let i=0;i<BAR_COUNT;i++){const bar=document.createElement('i');const wave=Math.abs(Math.sin(i*.29)*Math.cos(i*.071)+.3*Math.sin(i*.83));const envelope=.55+.45*Math.sin(Math.PI*i/BAR_COUNT);const height=8+Math.round(Math.min(1,wave)*envelope*47);bar.style.setProperty('--height',height+'px');waveform.appendChild(bar);bars.push(bar)}function paintWave(){const fraction=audio.duration?audio.currentTime/audio.duration:0;const index=Math.max(0,Math.min(BAR_COUNT-1,Math.floor(fraction*BAR_COUNT)));for(let i=0;i<bars.length;i++){bars[i].classList.toggle('heard',i<index);bars[i].classList.toggle('current-bar',i===index)}}audio.addEventListener('timeupdate',paintWave);audio.addEventListener('loadedmetadata',paintWave);audio.addEventListener('seeked',paintWave);seek.addEventListener('input',paintWave);paintWave();


/* SL-1200-inspired brake: slow the transport and pitch together. */
let brakeFrame=0,braking=false;
audio.preservesPitch=false;
if('mozPreservesPitch' in audio)audio.mozPreservesPitch=false;
if('webkitPreservesPitch' in audio)audio.webkitPreservesPitch=false;
function cancelBrake(){if(brakeFrame)cancelAnimationFrame(brakeFrame);brakeFrame=0;braking=false;audio.playbackRate=1}
function brakeStop(){
 if(braking)return;
 if(audio.paused){cancelBrake();return}
 braking=true;status.textContent='SLOWING DOWN';trackState.textContent='STOPPING';
 const started=performance.now(),durationMs=1450;
 function frame(now){
  if(!braking)return;
  const t=Math.min(1,(now-started)/durationMs);
  audio.playbackRate=Math.max(.12,1-.88*(t*t*(3-2*t)));
  if(t<1&&!audio.paused)brakeFrame=requestAnimationFrame(frame);
  else{audio.pause();cancelBrake();playing(false)}
 }
 brakeFrame=requestAnimationFrame(frame);
}
const transport=button;
transport.addEventListener('click',async()=>{
 if(braking){cancelBrake();try{await audio.play()}catch(e){status.textContent='PLAYBACK UNAVAILABLE'}return}
 if(audio.paused){cancelBrake();try{await audio.play()}catch(e){status.textContent='PLAYBACK UNAVAILABLE'}}
 else brakeStop();
});
const vinyl=document.querySelector('#vinyl');
let scratch=null;
vinyl.addEventListener('pointerdown',e=>{
 if(e.button!==0||braking)return;
 scratch={id:e.pointerId,x:e.clientX,y:e.clientY,start:audio.currentTime,wasPlaying:!audio.paused,moved:false};
 vinyl.setPointerCapture(e.pointerId);
});
vinyl.addEventListener('pointermove',e=>{
 if(!scratch||e.pointerId!==scratch.id)return;
 const dx=e.clientX-scratch.x,dy=e.clientY-scratch.y;
 if(!scratch.moved&&Math.abs(dx)>9&&Math.abs(dx)>Math.abs(dy)){scratch.moved=true;if(scratch.wasPlaying)audio.pause();vinyl.classList.add('scratching')}
 if(!scratch.moved)return;
 const width=Math.max(1,vinyl.getBoundingClientRect().width);
 vinyl.style.setProperty('--scratch-angle',(dx/width*180)+'deg');
 if(Number.isFinite(audio.duration)&&audio.duration>0){audio.currentTime=Math.max(0,Math.min(audio.duration,scratch.start+dx/width*audio.duration*.6));sync();paintWave()}
});
function endScratch(e){if(!scratch||e.pointerId!==scratch.id)return;const s=scratch;scratch=null;if(s.moved){vinyl.classList.remove('scratching');vinyl.style.removeProperty('--scratch-angle');if(s.wasPlaying)audio.play().catch(()=>{})}}
vinyl.addEventListener('pointerup',endScratch);vinyl.addEventListener('pointercancel',endScratch);
