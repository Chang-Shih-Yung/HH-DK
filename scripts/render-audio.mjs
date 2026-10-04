// Render the original HH:DK eight-bar composition as a seamless mono PCM loop.
// Convert the output to AAC with afconvert (macOS) or ffmpeg before deployment.
import { writeFile } from 'node:fs/promises';
const rate = 44100, eighth = 60 / 76 / 2;
const chords = [[55,59,62,66],[54,57,61,64],[52,55,59,62],[57,62,64,67],[55,59,62,66],[54,57,61,64],[59,62,66,69],[57,61,64,69]];
const bass = [43,42,40,45,43,42,47,45];
const melody = [78,0,81,0,83,0,81,78,76,0,74,0,69,0,0,0,71,0,74,0,76,0,78,0,76,0,0,0,74,0,76,0,78,0,81,0,83,0,86,83,81,0,0,78,0,76,0,0,74,0,78,0,76,0,74,0,69,0,0,0,0,0,0,0];
const samples = new Float32Array(Math.round(eighth * 64 * rate));
function note(midi, at, attack, length, level, warm=false) {
  const freq = 440 * 2 ** ((midi - 69) / 12), start = Math.round(at * rate), count = Math.round(length * rate);
  for (let i=0;i<count;i++) {
    const t=i/rate, env=t<attack ? t/attack : Math.exp(-8*(t-attack)/(length-attack));
    const phase=2*Math.PI*freq*t;
    const wave=Math.sin(phase)+(warm ? Math.sin(phase*3)*.11 : Math.sin(phase*2)*.08*Math.exp(-t*7));
    samples[(start+i)%samples.length]+=wave*env*level;
  }
}
for(let i=0;i<64;i++) {
  const bar=Math.floor(i/8), at=i*eighth;
  if(i%8===0) {
    for(const midi of chords[bar]) note(midi,at,.5,eighth*8.6,.065,true);
    note(bass[bar],at,.03,eighth*6,.18);
  }
  if(i%8===4) note(bass[bar],at,.03,eighth*3,.11);
  if(melody[i]) {
    note(melody[i],at,.006,1.5,.2);
    note(melody[i],at+eighth*1.5,.006,1.5,.06);
    note(melody[i],at+eighth*3,.006,1.5,.018);
  }
}
const wav=Buffer.alloc(44+samples.length*2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8);
wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
wav.writeUInt32LE(rate,24); wav.writeUInt32LE(rate*2,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34);
wav.write('data',36); wav.writeUInt32LE(samples.length*2,40);
for(let i=0;i<samples.length;i++) wav.writeInt16LE(Math.round(Math.tanh(samples[i]*1.6)*.85*32767),44+i*2);
await writeFile(process.argv[2] ?? '/tmp/hhdk-street-loop.wav',wav);
