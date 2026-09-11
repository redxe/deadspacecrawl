export interface Song {
  id: string
  name: string
  detail: string
  code: string
}

export const builtInSongs: readonly Song[] = [
  {
    id: 'orbital', name: 'Orbital Bloom', detail: '76 BPM / weightless ambient',
    code: `setcps(76/240)
const dynamics = sine.range(.78,1).slow(8).mul("<.5 .72 .9 .48 1 .58>/16")
const harmony = note("<[c3,g3,b3,e4] [b2,g3,a3,d4] [a2,e3,g3,c4] [f2,c3,e3,a3] [c3,g3,d4,e4] [e3,g3,b3,d4] [f3,a3,c4,e4] [g2,d3,g3,b3] [a2,e3,a3,c4] [f2,c3,f3,a3] [d3,a3,c4,f4] [g2,d3,g3,b3] [e3,b3,d4,g4] [a2,e3,g3,c4] [f2,c3,f3,a3] [g2,d3,g3,b3]>/2")
const melody = note("<[c5 g5 e5 b5] [b4 d5 g5 a5] [a4 e5 c5 g5] [a4 c5 e5 g5] [e5 g5 d6 b5] [g5 b5 e5 d5] [a5 g5 e5 c5] [g5 d5 b4 d5]>/2")
stack(
  harmony.s("triangle").attack(1.2).clip(.88).release(1.4).gain(dynamics.mul(.13))
    .lpf(sine.range(550,1450).slow(48)).room(.65).pan(sine.range(.27,.4).slow(32)),
  harmony.arp("1 2 3 2").s("sine").attack(.18).release(.65)
    .gain(dynamics.mul(.08)).room(.5).pan(sine.range(.62,.8).slow(24))
    .mask("<0 1 1 0 1 1>/16"),
  melody.s("sine").lastOf(16, phrase => phrase.rev()).release(.75)
    .gain(dynamics.mul(".13 .08 .1 .07")).delay(.3).room(.5)
    .pan(sine.range(.22,.78).slow(24)).mask("<1 1 1 0 1 1>/16"),
  note("<c2 g1 a1 f1 c2 e2 f2 g1 a1 f1 d2 g1 e2 a1 f1 g1>/2")
    .s("sine").attack(.2).clip(.9).release(1).gain(dynamics.mul(.26)).pan(.5),
  harmony.arp("<[~ 3 ~ 2] [~ 2 ~ 1]>/4").s("triangle").attack(.3).release(1)
    .gain(dynamics.mul(.065)).lpf(2200).room(.7).pan(.82).mask("<0 0 1 1 1 0>/16"),
  note("<g6 e6 d6 b5 a5 c6 e6 g6>/4").s("sine").attack(.3).release(1.6)
    .gain(dynamics.mul(.04)).room(.7).pan(sine.range(.12,.88).slow(48))
    .mask("<0 0 1 1 1 0>/16"),
  harmony.arp("0 ~ 2 ~").s("triangle").attack(.5).release(1).lpf(700)
    .gain(dynamics.mul(.08)).pan(.55).room(.55).mask("<0 0 0 1 0 0>/16"),
  s("pink").slow(4).attack(2).release(1.5).hpf(2600).lpf(5000)
    .gain(dynamics.mul(sine.range(.004,.018).slow(16)))
    .pan(sine.range(.15,.85).slow(48)).mask("<1 0 1 1 1 0>/16").room(.5)
).ribbon(0,96)`,
  },
  {
    id: 'night-transit', name: 'Night Transit', detail: '112 BPM / pulsing arpeggios',
    code: `setcps(112/240)
const dynamics = sine.range(.85,1).slow(4).mul("<.58 .82 1 .48 .95 .62>/16")
const harmony = note("<[a3,c4,e4,g4] [a3,c4,e4,b4] [f3,a3,c4,e4] [g3,b3,d4,g4] [a3,c4,e4,g4] [c4,e4,g4,b4] [f3,a3,c4,e4] [e3,g3,b3,e4]>")
const roots = note("<a2 a2 f2 g2 a2 c3 f2 e2>")
stack(
  roots.struct("< [x ~ x x ~ x x ~] [x ~ x ~ x x ~ x] >/8")
    .s("sawtooth").lpf(sine.range(280,1050).slow(48)).release(.16)
    .gain(dynamics.mul(.19)).pan(.5).lastOf(16, phrase => phrase.ply(2))
    .mask("<1 1 1 0 1 1>/16"),
  note("<[a4 e5 c5 e5 a4 g5 e5 c5] [a4 c5 e5 b5 g5 e5 c5 e5] [f4 c5 a4 e5 f5 e5 c5 a4] [g4 d5 b4 g5 e5 d5 b4 g4] [a4 e5 g5 c6 b5 g5 e5 c5] [c5 g5 e5 b5 c6 b5 g5 e5] [f4 a4 c5 e5 f5 c5 a4 e5] [e4 b4 g4 e5 b5 g5 e5 b4]>")
    .s("triangle").iter(4).lastOf(16, phrase => phrase.rev()).release(.18)
    .lpf(sine.range(900,3400).slow(48)).delay(.28).room(.3).gain(dynamics.mul(.13))
    .pan(sine.range(.2,.65).slow(24)).mask("<1 1 1 0 1 0>/16"),
  harmony.s("triangle").attack(.55).clip(.85).release(.65).lpf(1000)
    .gain(dynamics.mul(.07)).room(.55).pan(.72).mask("<0 1 1 1 1 1>/16"),
  harmony.arp("<[2 ~ 3 ~] [1 ~ 2 3]>/4").s("sine").attack(.04).release(.45)
    .gain(dynamics.mul(.1)).delay(.25).pan(sine.range(.65,.85).slow(16))
    .mask("<0 0 1 1 1 1>/16"),
  harmony.arp("0 ~ 1 ~ 2 ~ 1 ~").s("triangle").attack(.2).release(.6)
    .lpf(1300).gain(dynamics.mul(.09)).room(.6).pan(.28).mask("<0 0 0 1 0 1>/16"),
  roots.s("sine").attack(.15).release(.6).gain(dynamics.mul(.2)).pan(.5)
    .mask("<0 0 0 1 0 0>/16"),
  note("c2*4").s("sine").attack(.001).release(.09).gain(dynamics.mul(.4)).pan(.5)
    .mask("<0 1 1 0 1 1>/16"),
  s("white*8").hpf(8000).attack(.001).release(.025)
    .gain(dynamics.mul(".035 .018 .05 .022")).lastOf(8, phrase => phrase.ply(2))
    .pan(".22 .72 .32 .82").mask("<0 1 1 0 1 0>/16"),
  s("~ pink ~ pink").hpf(1800).lpf(6500).release(.09).gain(dynamics.mul(.075))
    .lastOf(16, phrase => phrase.ply(2)).pan(.55).mask("<0 1 1 0 1 0>/16"),
  s("pink").euclidRot(3,8,1).hpf(4200).release(.06).gain(dynamics.mul(.03))
    .pan(sine.range(.12,.88).slow(8)).mask("<0 0 1 0 1 0>/16")
).ribbon(0,96)`,
  },
  {
    id: 'glass-engine', name: 'Glass Engine', detail: '128 BPM / luminous machinery',
    code: `setcps(128/240)
const dynamics = sine.range(.82,1).slow(8).mul("<.55 .8 .95 .5 1 .6>/16")
const harmony = note("<[d4,f4,a4,e5] [f4,a4,c5,g5] [bb3,d4,f4,a4] [c4,e4,g4,c5] [d4,f4,a4,c5] [a3,c4,e4,g4] [bb3,d4,f4,a4] [c4,e4,g4,b4]>")
stack(
  note("<[d5 a5 f5 e5 d5 c6 a5 f5] [f5 c6 a5 g5 f5 e5 c5 a4] [bb4 f5 d5 a5 bb5 a5 f5 d5] [c5 g5 e5 d5 c6 g5 e5 c5] [d5 f5 a5 c6 a5 e5 f5 d5] [a4 c5 e5 g5 a5 g5 e5 c5] [bb4 d5 f5 a5 f5 d5 bb4 a4] [c5 e5 g5 b5 g5 e5 d5 c5]>")
    .s("sine").iter(4).lastOf(16, phrase => phrase.rev()).release(.2)
    .delay(.3).gain(dynamics.mul(.14)).pan(sine.range(.16,.68).slow(12))
    .mask("<1 1 1 0 1 1>/16"),
  note("<d2 f2 bb1 c2 d2 a1 bb1 c2>").struct("<[x x ~ x x ~ x ~] [x ~ x x ~ x ~ x]>/8")
    .s("square").lpf(sine.range(230,780).slow(48)).release(.14)
    .gain(dynamics.mul(.13)).pan(.5),
  note("c2 ~ c2 [~ c2]").s("sine").release(.085).gain(dynamics.mul(.4)).pan(.5)
    .lastOf(16, phrase => phrase.ply(2)).mask("<0 1 1 0 1 0>/16"),
  s("~ white ~ white").hpf(1800).release(.08).gain(dynamics.mul(.075)).pan(.52)
    .lastOf(8, phrase => phrase.ply(2)).mask("<0 1 1 0 1 0>/16"),
  harmony.s("triangle").attack(.5).clip(.85).release(.65)
    .lpf(sine.range(650,1900).slow(48)).gain(dynamics.mul(.075)).room(.55).pan(.72),
  s("white").euclidRot(5,16,2).hpf(9500).release(.018).gain(dynamics.mul(.032))
    .pan(".15 .78 .32 .88").mask("<0 1 1 0 1 0>/16"),
  harmony.arp("<[3 ~ 2 ~] [1 ~ 3 2]>/4").s("triangle").attack(.04).release(.4)
    .lpf(2600).delay(.3).gain(dynamics.mul(.085)).pan(sine.range(.65,.87).slow(24))
    .mask("<0 0 1 1 1 1>/16"),
  harmony.arp("0 1 ~ 2 3 ~ 2 ~").s("sine").attack(.15).release(.5)
    .gain(dynamics.mul(.11)).room(.65).pan(.25).mask("<0 0 0 1 0 0>/16"),
  s("pink").euclidRot(3,8,3).hpf(3200).lpf(5800).release(.035)
    .gain(dynamics.mul(.045)).pan(sine.range(.1,.9).slow(16)).mask("<0 0 1 0 1 0>/16")
).ribbon(0,96)`,
  },
  {
    id: 'soft-return', name: 'Soft Return', detail: '74 BPM / minor-key elegy',
    code: `setcps(74/240)
const harmony = note("<[50,57,62,65] [48,57,60,65] [48,55,60,64] [46,53,58,62] [46,55,58,62] [45,53,57,62] [45,52,57,60] [50,57,62,65]>/2")
const roots = note("<38 36 36 34 34 33 33 38>/2")
const breath = sine.range(.82,1).slow(8)
const dynamics = breath.mul("<.58 .78 .92 .46 1 .62>/16")
stack(
  harmony.struct("<x [x ~ ~ x ~ ~ ~ ~]>/2").s("triangle")
    .attack(.06).clip(.82).release(.35).lpf(sine.range(650,1150).slow(32))
    .gain(dynamics.mul(.12)).room(.35).pan(.38),
  harmony.arp("<[3 ~ 2 ~] [2 ~ 1 ~] [3 ~ ~ 2] [1 ~ 2 ~]>/2")
    .s("sine").attack(.025).clip(.75).release(.35).gain(dynamics.mul(.14))
    .room(.4).pan(sine.range(.48,.62).slow(32)),
  roots.struct("x ~ ~ ~ x ~ ~ ~").s("sine").attack(.04).clip(.7).release(.3)
    .gain(dynamics.mul(.24)).pan(.5),
  harmony.arp("<[1 2 ~ 3 ~ 2 1 ~] [2 ~ 3 ~ 1 2 ~ ~]>/4")
    .s("triangle").attack(.04).clip(.65).release(.22).lpf(1500)
    .gain(dynamics.mul(.065)).room(.3).pan(sine.range(.18,.34).slow(16))
    .mask("<0 1 1 0 1 0>/16"),
  harmony.arp("<[~ 3 ~ ~] [~ ~ 2 ~]>/4").s("sine")
    .attack(.2).clip(.6).release(.4).gain(dynamics.mul(.07)).room(.5)
    .pan(sine.range(.68,.82).slow(16)).mask("<0 0 1 1 1 0>/16"),
  harmony.s("sine").attack(.8).clip(.78).release(.45).lpf(800)
    .gain(dynamics.mul(.04)).pan(.66).room(.5).mask("<0 1 1 0 1 1>/16"),
  roots.struct("x ~ ~ ~ ~ ~ x ~").s("sine").attack(.001).clip(.2)
    .release(.075).gain(dynamics.mul(.27)).pan(.5).mask("<0 1 1 0 1 0>/16"),
  s("~ pink ~ pink").hpf(1800).lpf(4200).release(.065)
    .gain(dynamics.mul(.045)).pan(.56).mask("<0 1 1 0 1 0>/16"),
  s("pink*8").hpf(6200).release(.022).gain(dynamics.mul(".012 .006 .016 .008"))
    .pan(".25 .7 .35 .75").mask("<0 0 1 0 1 0>/16")
).swingBy(.1,4).ribbon(0,96)`,
  },
  {
    id: 'signal-dawn', name: 'Signal Dawn', detail: '120 BPM / ascending synthwave',
    code: `setcps(120/240)
const dynamics = sine.range(.86,1).slow(8).mul("<.52 .78 .92 .45 1 .6>/16")
const harmony = note("<[c4,e4,g4,b4] [g3,b3,d4,a4] [a3,c4,e4,g4] [f3,a3,c4,e4] [c4,e4,g4,d5] [e4,g4,b4,d5] [f3,a3,c4,g4] [g3,b3,d4,f4]>")
stack(
  note("<c3 g2 a2 f2 c3 e3 f2 g2>").struct("x*8").s("sawtooth")
    .lpf(sine.range(300,1500).slow(48)).release(.12).gain(dynamics.mul(".14 .095")).pan(.5)
    .mask("<0 1 1 0 1 1>/16"),
  harmony.s("triangle").attack(.35).clip(.85).release(.65).room(.5)
    .gain(dynamics.mul(.11)).pan(sine.range(.27,.4).slow(32))
    .lpf(sine.range(800,2300).slow(48)),
  note("<[c5 e5 g5 b5 a5 g5 e5 d5] [b4 d5 g5 a5 g5 d5 b4 a4] [a4 c5 e5 g5 e5 c5 b4 a4] [a4 c5 f5 g5 e5 c5 a4 g4] [c5 g5 b5 d6 b5 g5 e5 d5] [e5 g5 b5 d6 e6 d6 b5 g5] [f5 c6 a5 g5 f5 e5 c5 a4] [g4 b4 d5 f5 g5 f5 d5 b4]>")
    .s("square").lastOf(16, phrase => phrase.rev()).lpf(sine.range(1000,3200).slow(48))
    .release(.15).delay(.26).gain(dynamics.mul(.055))
    .pan(sine.range(.35,.78).slow(24)).mask("<1 1 1 0 1 1>/16"),
  note("c2*4").s("sine").release(.09).gain(dynamics.mul(.36)).pan(.5)
    .mask("<0 1 1 0 1 0>/16"),
  s("white*8").hpf(9000).release(.02).gain(dynamics.mul(".018 .04"))
    .lastOf(8, phrase => phrase.ply(2)).pan(".25 .72 .18 .8")
    .mask("<0 1 1 0 1 0>/16"),
  s("~ white ~ white").hpf(1600).lpf(7000).release(.1).room(.25)
    .gain(dynamics.mul(.07)).lastOf(16, phrase => phrase.ply(2)).pan(.52)
    .mask("<0 1 1 0 1 0>/16"),
  harmony.arp("<[2 ~ 3 1] [3 ~ 2 ~]>/4").s("sine").attack(.12).release(.5)
    .delay(.25).room(.5).gain(dynamics.mul(.12)).pan(sine.range(.7,.88).slow(32))
    .mask("<0 0 1 1 1 1>/16"),
  harmony.arp("0 ~ 1 ~ 2 ~ 3 ~").s("triangle").attack(.15).release(.55)
    .lpf(1500).room(.6).gain(dynamics.mul(.08)).pan(.2).mask("<0 0 0 1 1 0>/16"),
  note("<c2 g1 a1 f1 c2 e2 f2 g1>").s("sine").attack(.12).release(.7)
    .gain(dynamics.mul(.22)).pan(.5).mask("<1 0 0 1 0 1>/16"),
  s("pink").slow(2).attack(.7).release(.4).hpf(3600).lpf(7000)
    .gain(dynamics.mul(.018)).pan(sine.range(.15,.85).slow(16))
    .mask("<0 0 1 1 1 0>/16")
).ribbon(0,96)`,
  },
]

export interface MusicState {
  songs: Song[]
  selected: string
  volume: number
  enabled: boolean
}

export const musicStorageKey = 'signal-archive.music.v1'

export function validateSong(name: string, code: string): string | undefined {
  if (!name.trim() || name.trim().length > 80) return 'Use a song name between 1 and 80 characters.'
  if (!code.trim() || code.length > 20000) return 'Use between 1 and 20,000 characters of Strudel code.'
}

export function loadMusicState(): MusicState {
  const defaults: MusicState = { songs: [], selected: builtInSongs[0]!.id, volume: 0.25, enabled: true }
  try {
    const value = JSON.parse(localStorage.getItem(musicStorageKey) ?? 'null')
    if (!value || typeof value !== 'object') return defaults
    const ids = new Set(builtInSongs.map(song => song.id))
    const songs: Song[] = []
    if (Array.isArray(value.songs)) {
      for (const song of value.songs.slice(0, 30)) {
        if (!song || typeof song.id !== 'string' || !song.id.startsWith('custom-') || ids.has(song.id)) continue
        if (typeof song.name !== 'string' || typeof song.code !== 'string' || validateSong(song.name, song.code)) continue
        ids.add(song.id)
        songs.push({ id: song.id, name: song.name.trim(), code: song.code, detail: 'LOCAL COMPOSITION' })
      }
    }
    return {
      songs,
      selected: ids.has(value.selected) ? value.selected : defaults.selected,
      volume: typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : defaults.volume,
      enabled: typeof value.enabled === 'boolean' ? value.enabled : defaults.enabled,
    }
  } catch { return defaults }
}

export function saveMusicState(state: MusicState): boolean {
  try {
    localStorage.setItem(musicStorageKey, JSON.stringify(state))
    return true
  } catch { return false }
}