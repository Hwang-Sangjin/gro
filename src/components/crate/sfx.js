export function createSfx() {
  let ac = null, enabled = false;
  return {
    async setEnabled(value) {
      enabled = value;
      if (value) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; ac ||= new C(); await ac.resume(); }
    },
    play(type) {
      if (!enabled || !ac || ac.state !== 'running') return;
      // slide: 판이 미끄러져 나오는 소리 (Shelf · 페이지 넘김) / flip: 상자에서 판 한 장을 넘기는 짧은 종이 소리 (Crate) / 그 밖: 툭 내려앉는 소리
      const d=type==='slide'?.38:type==='flip'?.13:.16,buffer=ac.createBuffer(1,Math.ceil(ac.sampleRate*d),ac.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
      const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain(),t=ac.currentTime;source.buffer=buffer;
      if(type==='slide'){filter.type='bandpass';filter.frequency.value=1900;filter.Q.value=.6;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.05,t+.14);gain.gain.linearRampToValueAtTime(0,t+d);}
      else if(type==='flip'){filter.type='bandpass';filter.frequency.value=2600+Math.random()*700;filter.Q.value=.9;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.085,t+.012);gain.gain.exponentialRampToValueAtTime(.001,t+d);}
      else{filter.type='lowpass';filter.frequency.value=360;gain.gain.setValueAtTime(.5,t);gain.gain.exponentialRampToValueAtTime(.001,t+d);}
      source.connect(filter).connect(gain).connect(ac.destination);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start();
    },
    dispose(){ enabled=false;ac?.close();ac=null; },
  };
}
