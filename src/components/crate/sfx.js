import { SOUNDS, loadSample, playSample } from '@/lib/samples';

// 효과음 (Crate 보기 · 페이지 넘김). 소리를 켠 뒤에만 오디오가 만들어짐
//  flip: 상자에서 판 한 장을 넘기는 소리 — 녹음한 파일(public/sounds/flip.mp3, 2026-11-22). 파일을 아직 못 받았으면 예전 합성음
//  slide: 판이 미끄러져 나오는 소리 (페이지 넘김) · 그 밖: 툭 내려앉는 소리 — 합성음
export function createSfx() {
  let ac = null, enabled = false, flip = null, lastFlip = 0;
  return {
    async setEnabled(value) {
      enabled = value;
      if (value) {
        const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
        ac ||= new C(); await ac.resume();
        loadSample(ac, SOUNDS.flip).then((s) => { flip = s; });   // 켜는 순간에 받아 둠
      }
    },
    play(type) {
      if (!enabled || !ac || ac.state !== 'running') return;
      if (type === 'flip') {
        // 빠르게 넘길 때 소리가 겹쳐 뭉개지지 않게 간격을 두고, 넘길 때마다 빠르기 · 크기를 조금씩 다르게 (같은 소리가 반복되면 기계음처럼 들림)
        const now = performance.now();
        if (now - lastFlip < 90) return;
        lastFlip = now;
        if (playSample(ac, flip, { rate: 0.94 + Math.random() * 0.16, gain: 0.42 + Math.random() * 0.16 })) return;
      }
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
