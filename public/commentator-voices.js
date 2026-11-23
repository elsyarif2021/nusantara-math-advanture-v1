export const voiceProfiles = [
  {value:'original',label:'Asli'},
  {value:'warm',label:'Hangat · suara lebih rendah'},
  {value:'bright',label:'Cerah · suara lebih tinggi'}
];

export const voiceTones = [
  {value:'calm',label:'Tenang · tempo lebih pelan',rate:.88},
  {value:'natural',label:'Natural · tempo normal',rate:1},
  {value:'energetic',label:'Semangat · tempo lebih cepat',rate:1.15}
];

export function commentatorClip(clip,profile,tone) {
  const voice = voiceProfiles.find(item => item.value === profile);
  const style = voiceTones.find(item => item.value === tone);
  const suffix = !voice || voice.value === 'original' ? '' : '-'+voice.value;
  return {source:'/feedback-'+clip+suffix+'.mp3',rate:style?.rate ?? 1};
}
