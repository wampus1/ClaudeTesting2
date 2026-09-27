// Hand-drawn SVG item icons (64×64) and NPC portraits (100×120), chosen by
// keywords in the name/type the narrator gives. Woodcut style: dark outlines, flat fills.

const INK = '#140e0a';
const O = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

const C = {
  iron: '#8d9091', ironDark: '#5b5e60', ironLight: '#c8cac6',
  rust: '#8f4a24', rustIron: '#8a7266',
  wood: '#6e4828', woodDark: '#4a2e17', woodLight: '#90633a',
  leather: '#5c3b22', leatherLight: '#7c5535',
  cloth: '#6f665a', clothDark: '#4f4940', sack: '#9a8a66',
  bone: '#d9cdb2', boneDark: '#ad9f80',
  bronze: '#a8742e', bronzeLight: '#d6a452', bronzeDark: '#6e4a1c',
  gold: '#d9b24a', copper: '#b8733a', copperLight: '#d8955a',
  flame: '#ffb03a', flameCore: '#fff0a0',
  glass: '#4d6f6a', glassLight: '#bfe0d6',
  verdigris: '#4f9a86',
  paper: '#d4c29a', paperDark: '#b39f74', inkLine: '#6b5a3a',
  bread: '#b07a3c', breadLight: '#d69d56', breadDark: '#7a4f22',
  blood: '#8e2a1e',
};

const svg = (body, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
// A thick dark stroke under a coloured stroke gives stroked shapes an outline.
const line = (d, color, width) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width + 3}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const glow = (cx, cy, r, color) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity=".13"/><circle cx="${cx}" cy="${cy}" r="${r * 0.7}" fill="${color}" opacity=".13"/>`;

function bladeColor(name) {
  if (/\bbone\b|\bshin\b|femur/.test(name)) return C.bone;
  if (/rust|pitted|corrod/.test(name)) return C.rustIron;
  if (/bronze|copper/.test(name)) return C.bronze;
  if (/obsidian|black|glass/.test(name)) return '#2e2a33';
  return C.iron;
}

const ICONS = {
  sword: (n) => svg(`
    <path d="M25 39 L52 8 L57 7 L56 12 L29 43 Z" fill="${bladeColor(n)}" ${O}/>
    <path d="M28 40 L53 11" stroke="${C.ironLight}" stroke-width="1.3" opacity=".8"/>
    ${/rust/.test(n) ? `<circle cx="40" cy="24" r="1.8" fill="${C.rust}"/><circle cx="46" cy="18" r="1.2" fill="${C.rust}"/><circle cx="34" cy="32" r="1.4" fill="${C.rust}"/>` : ''}
    <path d="M17 37 L21 33 L35 47 L31 51 Z" fill="${C.bronzeDark}" ${O}/>
    ${line('M25 45 L15 55', C.leather, 4)}
    <path d="M22 46 L20 50 M19 49 L17 53" stroke="${INK}" stroke-width="1"/>
    <circle cx="12" cy="58" r="4" fill="${C.bronze}" ${O}/>`),

  dagger: (n) => svg(`
    <path d="M28 37 L28 15 L32 5 L36 15 L36 37 Z" fill="${bladeColor(n)}" ${O}/>
    <path d="M32 9 L32 35" stroke="${C.ironLight}" stroke-width="1.2" opacity=".7"/>
    ${/rust/.test(n) ? `<circle cx="30.5" cy="26" r="1.3" fill="${C.rust}"/><circle cx="33.5" cy="31" r="1" fill="${C.rust}"/>` : ''}
    <rect x="21" y="37" width="22" height="5" rx="1.5" fill="${/bone/.test(n) ? C.boneDark : C.bronzeDark}" ${O}/>
    <rect x="29" y="42" width="6" height="13" fill="${/shiv|rag|tine/.test(n) ? C.cloth : C.leather}" ${O}/>
    <path d="M29 45 L35 47 M29 49 L35 51" stroke="${INK}" stroke-width="1"/>
    <circle cx="32" cy="58" r="3.5" fill="${/bone/.test(n) ? C.bone : C.bronze}" ${O}/>`),

  axe: (n) => svg(`
    ${line('M18 60 L42 14', C.wood, 4)}
    <path d="M36 11 L41 8 C48 5 57 9 59 17 C60 23 58 29 55 32 C52 27 47 25 42 26 L38 21 Z" fill="${bladeColor(n)}" ${O}/>
    <path d="M56 13 C59 19 58 25 55 30" stroke="${C.ironLight}" stroke-width="1.5" fill="none"/>
    <path d="M36 11 L31 14 L35 21 L38 21" fill="${C.ironDark}" ${O}/>
    <path d="M24 49 L27 50 M22 53 L25 54" stroke="${C.woodDark}" stroke-width="1.5"/>`),

  club: () => svg(`
    <path d="M12 54 L17 59 L41 34 C47 29 53 20 49 13 C45 6 35 8 32 15 L30 22 Z" fill="${C.wood}" ${O}/>
    <path d="M35 16 C37 11 43 10 46 13" stroke="${C.woodLight}" stroke-width="2" fill="none"/>
    <ellipse cx="38" cy="26" rx="2.5" ry="1.8" fill="${C.woodDark}"/>
    <ellipse cx="27" cy="40" rx="2" ry="1.5" fill="${C.woodDark}"/>
    <path d="M44 22 L52 26" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M44 22 L52 26" stroke="${C.iron}" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="44" cy="22" r="2" fill="${C.ironDark}" ${O}/>`),

  hammer: () => svg(`
    ${line('M14 58 L38 26', C.wood, 4)}
    <path d="M26 14 L36 6 L56 26 L46 34 Z" fill="${C.iron}" ${O}/>
    <path d="M30 13 L36 8 L40 12" stroke="${C.ironLight}" stroke-width="1.5" fill="none"/>`),

  mace: () => svg(`
    ${line('M14 58 L36 30', C.wood, 4)}
    <circle cx="42" cy="22" r="11" fill="${C.iron}" ${O}/>
    <path d="M42 6 L42 11 M42 33 L42 38 M26 22 L31 22 M53 22 L58 22 M31 11 L34 14 M50 30 L53 33 M53 11 L50 14 M34 30 L31 33" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M36 18 C38 14 42 13 45 14" stroke="${C.ironLight}" stroke-width="1.5" fill="none"/>`),

  spear: (n) => svg(`
    ${line('M8 60 L46 18', /staff|pole|stick/.test(n) ? C.woodDark : C.wood, 3.5)}
    ${/staff|pole|stick/.test(n)
      ? `<circle cx="47" cy="17" r="5" fill="${C.woodDark}" ${O}/>`
      : `<path d="M44 20 L50 8 L60 4 L56 14 L46 22 Z" fill="${bladeColor(n)}" ${O}/><path d="M42 22 L46 26" stroke="${INK}" stroke-width="4"/>`}`),

  chain: () => {
    let links = '';
    for (let i = 0; i < 4; i++) {
      const cx = 16 + i * 11;
      const cy = 48 - i * 11;
      const r = i % 2 ? 'rx="8" ry="3.5"' : 'rx="8" ry="5.5"';
      links += `<ellipse cx="${cx}" cy="${cy}" ${r} transform="rotate(-45 ${cx} ${cy})" fill="none" stroke="${INK}" stroke-width="6"/><ellipse cx="${cx}" cy="${cy}" ${r} transform="rotate(-45 ${cx} ${cy})" fill="none" stroke="${C.iron}" stroke-width="3"/>`;
    }
    return svg(`${links}<circle cx="22" cy="44" r="1.3" fill="${C.rust}"/><circle cx="43" cy="21" r="1.1" fill="${C.rust}"/>`);
  },

  rope: () => svg(`
    <ellipse cx="30" cy="36" rx="22" ry="16" fill="${C.sack}" ${O}/>
    <ellipse cx="30" cy="36" rx="22" ry="16" fill="none" stroke="#6e5a36" stroke-width="2" stroke-dasharray="3 3"/>
    <ellipse cx="30" cy="36" rx="15" ry="10.5" fill="#b3a078" ${O}/>
    <ellipse cx="30" cy="36" rx="15" ry="10.5" fill="none" stroke="#6e5a36" stroke-width="2" stroke-dasharray="3 3"/>
    <ellipse cx="30" cy="36" rx="8" ry="5" fill="${INK}"/>
    ${line('M50 42 C56 46 58 52 54 58', C.sack, 4)}
    <path d="M54 58 L52 61 M54 58 L57 60" stroke="#6e5a36" stroke-width="1.5"/>`),

  helm: (n) => {
    const leather = /leather|skullcap|cap\b/.test(n);
    const fill = leather ? C.leather : C.iron;
    return svg(`
      <path d="M12 42 C12 21 22 11 32 11 C42 11 52 21 52 42 L52 49 L44 49 L44 39 L20 39 L20 49 L12 49 Z" fill="${fill}" ${O}/>
      ${leather ? '' : `<path d="M29 26 L35 26 L35 49 L29 49 Z" fill="${C.ironDark}" ${O}/>`}
      <path d="M13 37 L51 37" stroke="${leather ? C.leatherLight : C.ironDark}" stroke-width="3"/>
      ${leather ? `<path d="M32 12 L32 36" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 2"/>` : `<circle cx="17" cy="37" r="1.3" fill="${C.ironLight}"/><circle cx="25" cy="37" r="1.3" fill="${C.ironLight}"/><circle cx="39" cy="37" r="1.3" fill="${C.ironLight}"/><circle cx="47" cy="37" r="1.3" fill="${C.ironLight}"/>`}
      <path d="M19 28 C19 21 24 16 29 15" stroke="${leather ? C.leatherLight : C.ironLight}" stroke-width="2" fill="none"/>
      ${/dent|pot/.test(n) ? `<path d="M40 16 C37 19 38 22 41 25" stroke="${INK}" stroke-width="1.4" fill="none"/>` : ''}`);
  },

  hood: (n) => svg(`
    <path d="M13 57 C11 40 16 18 32 9 C48 18 53 40 51 57 C44 53 20 53 13 57 Z" fill="${/grey|gray|wool/.test(n) ? '#77716a' : C.cloth}" ${O}/>
    <path d="M22 41 C22 28 26 20 32 18 C38 20 42 28 42 41 C38 45 26 45 22 41 Z" fill="${INK}"/>
    <path d="M18 53 C20 45 20 41 22 36 M46 53 C44 45 44 41 42 36 M32 10 L32 17" stroke="${C.clothDark}" fill="none" stroke-width="1.5"/>
    ${/moth|holes|ragged|torn/.test(n) ? `<circle cx="18" cy="30" r="1.5" fill="${INK}"/><circle cx="45" cy="47" r="1.8" fill="${INK}"/><circle cx="40" cy="14" r="1.2" fill="${INK}"/>` : ''}`),

  tunic: (n) => {
    let fill = C.cloth;
    if (/sack|burlap|prison/.test(n)) fill = C.sack;
    else if (/leather|jerkin|hide|brigandine/.test(n)) fill = C.leather;
    else if (/gambeson|quilt|padded|linen/.test(n)) fill = '#b3a684';
    else if (/mail|chain|hauberk|plate|cuirass|iron/.test(n)) fill = C.iron;
    else if (/cloak|robe|cape/.test(n)) fill = '#4c4a3e';
    const quilt = /gambeson|quilt|padded/.test(n);
    const mail = /mail|chain|hauberk/.test(n);
    return svg(`
      <path d="M22 10 L27 15 L37 15 L42 10 L55 18 L51 30 L46 27 L46 56 L18 56 L18 27 L13 30 L9 18 Z" fill="${fill}" ${O}/>
      <path d="M27 15 C29 21 35 21 37 15" fill="none" stroke="${INK}" stroke-width="2"/>
      ${quilt ? `<path d="M18 34 L46 34 M18 42 L46 42 M18 50 L46 50 M26 22 L26 56 M38 22 L38 56" stroke="#7d7258" stroke-width="1.2"/>` : ''}
      ${mail ? `<path d="M20 30 h24 M20 36 h24 M20 42 h24 M20 48 h24" stroke="${C.ironDark}" stroke-width="2.5" stroke-dasharray="1.5 1.5"/>` : ''}
      ${!quilt && !mail ? `<path d="M22 40 L30 40 L30 48 L22 48 Z" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="1.5 1.5"/><path d="M40 24 L40 34" stroke="${INK}" stroke-width="1" opacity=".5"/>` : ''}
      <path d="M18 56 L21 52 L24 56 L28 53 L31 56" fill="none" stroke="${INK}" stroke-width="1" opacity=".6"/>`);
  },

  boot: (n) => {
    const fill = /clog|wood/.test(n) ? C.woodLight : /rag|wrap/.test(n) ? C.cloth : C.leather;
    return svg(`
      <path d="M20 8 L36 8 L37 38 C44 40 52 42 54 46 C56 50 55 54 52 55 L18 55 C16 55 15 52 16 48 L18 36 Z" fill="${fill}" ${O}/>
      <path d="M16 50 L54 50" stroke="${INK}" stroke-width="2"/>
      ${/rag|wrap/.test(n)
        ? `<path d="M19 14 L37 18 M18 22 L37 26 M18 30 L37 34 M17 40 L44 44" stroke="${C.clothDark}" stroke-width="1.5"/>`
        : `<path d="M20 13 L36 13" stroke="${INK}" stroke-width="1.5"/><path d="M27 18 L33 22 M33 18 L27 22 M27 25 L33 29 M33 25 L27 29" stroke="${INK}" stroke-width="1.2"/>`}
      ${/crack/.test(n) ? `<path d="M44 44 L47 47 L45 49" stroke="${INK}" stroke-width="1.2" fill="none"/>` : ''}`);
  },

  ring: (n) => {
    const metal = /gold/.test(n) ? C.gold : /silver/.test(n) ? '#c0c4c8' : /pewter|iron|tin/.test(n) ? '#9a9a8e' : C.gold;
    return svg(`
      <ellipse cx="32" cy="39" rx="17" ry="15" fill="none" stroke="${INK}" stroke-width="9"/>
      <ellipse cx="32" cy="39" rx="17" ry="15" fill="none" stroke="${metal}" stroke-width="5"/>
      <path d="M19 32 C21 27 25 25 29 24" stroke="#fff" stroke-width="1.5" fill="none" opacity=".5"/>
      <path d="M26 21 L32 13 L38 21 L32 27 Z" fill="${/dead|black|onyx/.test(n) ? '#2a2630' : C.blood}" ${O}/>
      <path d="M29 20 L32 16" stroke="#fff" stroke-width="1" opacity=".6"/>`);
  },

  amulet: (n) => svg(`
    <path d="M14 5 C14 26 24 33 32 34 C40 33 50 26 50 5" fill="none" stroke="${INK}" stroke-width="4"/>
    <path d="M14 5 C14 26 24 33 32 34 C40 33 50 26 50 5" fill="none" stroke="${C.bronzeLight}" stroke-width="2" stroke-dasharray="2.5 1.5"/>
    <circle cx="32" cy="45" r="13" fill="${/tarnish|silver/.test(n) ? '#8e8f86' : C.bronze}" ${O}/>
    <circle cx="32" cy="45" r="9" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".6"/>
    <path d="M32 39 L32 51 M28 43 L36 43" stroke="${INK}" stroke-width="2"/>
    <path d="M24 40 C25 37 28 35 31 35" stroke="#fff" stroke-width="1.2" fill="none" opacity=".4"/>`),

  bread: (n) => svg(`
    <path d="M8 42 C6 30 18 20 32 20 C46 20 58 30 56 42 C55 48 48 50 32 50 C16 50 9 48 8 42 Z" fill="${C.bread}" ${O}/>
    <path d="M14 35 C17 28 24 24 32 24 C40 24 47 28 50 35 C42 31 22 31 14 35 Z" fill="${C.breadLight}"/>
    <path d="M20 30 L24 39 M30 27 L33 37 M40 28 L42 38" stroke="${C.breadDark}" stroke-width="2" stroke-linecap="round"/>
    ${/stale|mould|mold|rotten/.test(n) ? `<circle cx="47" cy="41" r="2.2" fill="#6f7d4c"/><circle cx="16" cy="43" r="1.6" fill="#6f7d4c"/><circle cx="44" cy="45" r="1.2" fill="#6f7d4c"/>` : ''}`),

  meat: () => svg(`
    <path d="M8 36 C6 26 17 18 29 18 C43 18 52 24 52 36 C52 46 42 52 29 52 C17 52 9 46 8 36 Z" fill="#9a4a3a" ${O}/>
    <path d="M13 36 C13 28 21 23 29 23 C39 23 46 28 46 36" fill="none" stroke="#e2cdb0" stroke-width="3"/>
    <path d="M20 40 L26 44 M32 38 L38 42" stroke="#6e2c20" stroke-width="1.5"/>
    ${line('M50 30 L58 24', C.bone, 3)}
    <circle cx="58" cy="22" r="2.6" fill="${C.bone}" ${O}/><circle cx="60" cy="26" r="2.6" fill="${C.bone}" ${O}/>`),

  mushroom: () => svg(`
    ${glow(32, 28, 26, '#b8e08a')}
    <path d="M27 33 L25 55 C29 57 35 57 39 55 L37 33 Z" fill="${C.bone}" ${O}/>
    <path d="M8 36 C8 20 20 10 32 10 C44 10 56 20 56 36 C46 31 18 31 8 36 Z" fill="#8c9c68" ${O}/>
    <circle cx="22" cy="22" r="2.4" fill="#d2e6b0"/><circle cx="36" cy="17" r="2" fill="#d2e6b0"/><circle cx="45" cy="26" r="2.6" fill="#d2e6b0"/><circle cx="30" cy="27" r="1.5" fill="#d2e6b0"/>
    <path d="M30 40 L30 50" stroke="${C.boneDark}" stroke-width="1.2"/>`),

  bottle: (n) => {
    const liquid = /poison|venom/.test(n) ? '#5a8a3a' : /potion|elixir|tonic|draught|wine|blood/.test(n) ? '#8a2a3a' : /ale|beer|mead/.test(n) ? '#b8862e' : '#3b6f8f';
    return svg(`
      <path d="M27 7 L37 7 L37 19 C48 23 54 31 54 41 C54 52 44 58 32 58 C20 58 10 52 10 41 C10 31 16 23 27 19 Z" fill="${C.glass}" ${O}/>
      <path d="M11.5 43 C18 39 46 39 52.5 43 C52 52 44 56.5 32 56.5 C20 56.5 12 52 11.5 43 Z" fill="${liquid}"/>
      <rect x="26" y="3" width="12" height="6" rx="1.5" fill="${C.woodLight}" ${O}/>
      <path d="M18 36 C18 31 21 27 25 25" stroke="${C.glassLight}" stroke-width="2" fill="none" opacity=".8"/>`);
  },

  waterskin: () => svg(`
    <path d="M26 8 L38 8 L36 17 C50 19 56 31 54 43 C52 54 42 58 32 58 C22 58 12 54 10 43 C8 31 14 19 28 17 Z" fill="${C.leather}" ${O}/>
    <rect x="26" y="4" width="12" height="6" rx="1.5" fill="${C.woodLight}" ${O}/>
    <path d="M12 38 C20 42 44 42 52 38" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 2" fill="none"/>
    <path d="M18 28 C21 24 25 22 29 21" stroke="${C.leatherLight}" stroke-width="2" fill="none"/>
    <path d="M40 22 L44 14" stroke="${INK}" stroke-width="1.2"/>`),

  candle: (n) => {
    const lit = /\b(lit|burning|lighted|flickering)\b/.test(n);
    const top = /stub|stump|nub/.test(n) ? 38 : 22;
    return svg(`
      ${lit ? glow(32, top - 10, 18, C.flame) : ''}
      <ellipse cx="32" cy="54" rx="18" ry="5.5" fill="#6f6250" ${O}/>
      <ellipse cx="32" cy="52.5" rx="12" ry="3" fill="#8a7a62"/>
      <path d="M24 52 L24 ${top + 2} C26 ${top} 27 ${top + 3} 29 ${top + 2} C31 ${top + 1} 32 ${top + 4} 34 ${top + 2} C36 ${top} 38 ${top + 1} 40 ${top + 2} L40 52 Z" fill="#e3d8ba" ${O}/>
      <path d="M26.5 ${top + 3} L26.5 ${top + 11} M37 ${top + 3} L37 ${top + 7}" stroke="#c8ba94" stroke-width="3" stroke-linecap="round"/>
      <path d="M25.5 ${top + 6} L25.5 51" stroke="#fff" stroke-width="1.2" opacity=".35"/>
      <path d="M32 ${top + 2} C32 ${top - 1} 33 ${top - 3} 32 ${top - 5}" stroke="${INK}" stroke-width="1.6" fill="none"/>
      ${lit ? `<path d="M32 ${top - 20} C36 ${top - 14} 38 ${top - 10} 36 ${top - 6} C35 ${top - 4} 29 ${top - 4} 28 ${top - 6} C26 ${top - 10} 28 ${top - 14} 32 ${top - 20} Z" fill="${C.flame}"/><path d="M32 ${top - 14} C34 ${top - 11} 34 ${top - 8} 33 ${top - 6} C32 ${top - 5} 31 ${top - 5} 31 ${top - 6} C30 ${top - 8} 30 ${top - 11} 32 ${top - 14} Z" fill="${C.flameCore}"/>` : ''}`);
  },

  torch: () => svg(`
    ${glow(32, 16, 22, C.flame)}
    <path d="M30 61 L34 61 L36 28 L28 28 Z" fill="${C.wood}" ${O}/>
    <rect x="25" y="22" width="14" height="10" rx="2" fill="#7d6f58" ${O}/>
    <path d="M26 26 L38 28 M26 30 L38 32" stroke="${INK}" stroke-width="1"/>
    <path d="M32 2 C38 8 42 14 40 20 C39 23 25 23 24 20 C22 14 26 10 30 12 C29 8 30 5 32 2 Z" fill="${C.flame}"/>
    <path d="M32 10 C35 14 36 18 34 20 C33 21 31 21 30 20 C29 17 30 13 32 10 Z" fill="${C.flameCore}"/>`),

  lantern: () => svg(`
    ${glow(32, 34, 24, C.flame)}
    <path d="M24 12 C24 3 40 3 40 12" fill="none" stroke="${INK}" stroke-width="3"/>
    <path d="M18 17 L46 17 L41 11 L23 11 Z" fill="${C.ironDark}" ${O}/>
    <rect x="20" y="17" width="24" height="31" fill="#e7a846" ${O}/>
    <path d="M32 26 C35 30 36 34 34 37 C33 38 31 38 30 37 C28 34 29 30 32 26 Z" fill="${C.flameCore}"/>
    <path d="M20 17 L20 48 M44 17 L44 48 M32 17 L32 22 M32 42 L32 48 M20 32 L25 32 M39 32 L44 32" stroke="${INK}" stroke-width="2.5"/>
    <rect x="17" y="48" width="30" height="7" rx="1" fill="${C.ironDark}" ${O}/>`),

  key: (n) => svg(`
    <circle cx="18" cy="21" r="10" fill="none" stroke="${INK}" stroke-width="7.5"/>
    <circle cx="18" cy="21" r="10" fill="none" stroke="${/tarnish|bronze|brass|old/.test(n) ? C.bronze : C.iron}" stroke-width="4"/>
    ${line('M25 28 L52 55', /tarnish|bronze|brass|old/.test(n) ? C.bronze : C.iron, 4)}
    ${line('M45 48 L39 54 M51 54 L46 59', /tarnish|bronze|brass|old/.test(n) ? C.bronze : C.iron, 3.5)}
    <path d="M12 16 C14 13 17 12 20 12" stroke="#fff" stroke-width="1.2" fill="none" opacity=".4"/>`),

  lockpick: () => svg(`
    <circle cx="15" cy="49" r="6" fill="none" stroke="${INK}" stroke-width="5"/>
    <circle cx="15" cy="49" r="6" fill="none" stroke="${C.iron}" stroke-width="2.5"/>
    ${line('M20 44 L46 18 L52 19 L50 13', C.rustIron, 2)}
    ${line('M24 48 L50 22 L55 26', C.iron, 1.8)}`),

  scroll: (n) => svg(`
    <rect x="16" y="13" width="32" height="38" fill="${C.paper}" ${O}/>
    <rect x="12" y="8" width="40" height="8" rx="4" fill="${C.paperDark}" ${O}/>
    <rect x="12" y="48" width="40" height="8" rx="4" fill="${C.paperDark}" ${O}/>
    ${/map|chart/.test(n)
      ? `<path d="M20 24 C26 20 30 30 36 26 C40 23 42 30 44 28 M22 38 L28 34 L33 40 L42 36" stroke="${C.inkLine}" stroke-width="1.4" fill="none"/><path d="M36 40 L40 44 M40 40 L36 44" stroke="${C.blood}" stroke-width="1.6"/>`
      : `<path d="M21 22 L43 22 M21 27 L40 27 M21 32 L43 32 M21 37 L37 37 M21 42 L41 42" stroke="${C.inkLine}" stroke-width="1.4"/>`}
    <circle cx="44" cy="46" r="3.5" fill="${C.blood}" ${O}/>`),

  book: () => svg(`
    <rect x="46" y="12" width="7" height="44" fill="${C.paper}" ${O}/>
    <path d="M47 18 L52 18 M47 26 L52 26 M47 34 L52 34 M47 42 L52 42 M47 50 L52 50" stroke="${C.paperDark}" stroke-width="1"/>
    <rect x="12" y="9" width="36" height="48" rx="2" fill="#5a2a1e" ${O}/>
    <path d="M16 9 L16 57" stroke="${INK}" stroke-width="2"/>
    <rect x="22" y="20" width="18" height="24" fill="none" stroke="${C.bronze}" stroke-width="1.5"/>
    <circle cx="31" cy="32" r="4" fill="${C.bronze}"/>
    <rect x="44" y="30" width="7" height="6" rx="1" fill="${C.bronze}" ${O}/>`),

  coins: (n) => {
    const face = /gold/.test(n) ? C.gold : /silver/.test(n) ? '#c0c4c8' : C.copper;
    let stack = '';
    for (let i = 0; i < 4; i++) stack += `<ellipse cx="26" cy="${50 - i * 6}" rx="16" ry="6" fill="${face}" ${O}/>`;
    return svg(`${stack}
      <ellipse cx="26" cy="32" rx="10" ry="3.4" fill="none" stroke="${INK}" stroke-width="1" opacity=".5"/>
      <ellipse cx="48" cy="45" rx="8.5" ry="11" fill="${face}" ${O}/>
      <ellipse cx="48" cy="45" rx="5" ry="7" fill="none" stroke="${INK}" stroke-width="1" opacity=".5"/>
      <path d="M44 38 C45 36 47 35 49 35" stroke="#fff" stroke-width="1.2" fill="none" opacity=".5"/>`);
  },

  gem: (n) => {
    const color = /ruby|blood|red/.test(n) ? '#a3202a' : /emerald|green|jade/.test(n) ? '#2f8a4a' : /sapphire|blue/.test(n) ? '#2a4fa0' : /amethyst|violet|purple/.test(n) ? '#6a2a8a' : /amber|topaz|yellow/.test(n) ? '#c98a1e' : '#2f8a8a';
    return svg(`
      ${glow(32, 36, 24, color)}
      <path d="M20 18 L44 18 L55 30 L32 57 L9 30 Z" fill="${color}" ${O}/>
      <path d="M9 30 L55 30 M20 18 L26 30 L32 57 M44 18 L38 30 L32 57 M26 30 L32 18 L38 30" stroke="${INK}" stroke-width="1.2" fill="none"/>
      <path d="M20 18 L26 30 L9 30 Z" fill="#fff" opacity=".28"/>
      <path d="M26 30 L32 18 L38 30 Z" fill="#fff" opacity=".15"/>`);
  },

  skull: () => svg(`
    <path d="M32 8 C18 8 10 18 10 30 C10 38 14 42 18 44 L18 52 C18 55 22 57 26 57 L38 57 C42 57 46 55 46 52 L46 44 C50 42 54 38 54 30 C54 18 46 8 32 8 Z" fill="${C.bone}" ${O}/>
    <ellipse cx="23" cy="31" rx="6" ry="7" fill="${INK}"/><ellipse cx="41" cy="31" rx="6" ry="7" fill="${INK}"/>
    <path d="M32 38 L29 44 L35 44 Z" fill="${INK}"/>
    <path d="M24 49 L24 55 M28 49 L28 56 M32 49 L32 56 M36 49 L36 56 M40 49 L40 55" stroke="${INK}" stroke-width="1.5"/>
    <path d="M37 9 L35 15 L39 19" stroke="${INK}" fill="none" stroke-width="1.2"/>
    <path d="M14 26 C15 19 20 14 26 12" stroke="#fff" stroke-width="1.5" fill="none" opacity=".35"/>`),

  bone: () => svg(`
    <g fill="${INK}"><circle cx="14" cy="45" r="7.5"/><circle cx="19" cy="50" r="7.5"/><circle cx="45" cy="14" r="7.5"/><circle cx="50" cy="19" r="7.5"/></g>
    <path d="M17 47 L47 17" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>
    <g fill="${C.bone}"><circle cx="14" cy="45" r="5.5"/><circle cx="19" cy="50" r="5.5"/><circle cx="45" cy="14" r="5.5"/><circle cx="50" cy="19" r="5.5"/></g>
    <path d="M17 47 L47 17" stroke="${C.bone}" stroke-width="7" stroke-linecap="round"/>
    <path d="M22 40 L40 22" stroke="#fff" stroke-width="1.2" opacity=".4"/>`),

  bandage: () => svg(`
    <path d="M38 44 L57 53 L54 60 L34 51 Z" fill="${C.bone}" ${O}/>
    <circle cx="27" cy="34" r="17" fill="${C.bone}" ${O}/>
    <path d="M27 23 A11 11 0 1 1 16 34" fill="none" stroke="${C.boneDark}" stroke-width="1.5"/>
    <circle cx="27" cy="34" r="6" fill="${C.boneDark}" ${O}/>
    <circle cx="48" cy="54" r="2.4" fill="${C.blood}" opacity=".8"/><circle cx="18" cy="44" r="1.6" fill="${C.blood}" opacity=".6"/>`),

  herb: () => svg(`
    ${line('M32 60 L32 30', '#4f6a33', 2.5)}
    <path d="M32 44 C22 44 14 36 14 26 C24 26 32 34 32 44 Z" fill="#6f8f45" ${O}/>
    <path d="M32 38 C42 38 50 30 50 20 C40 20 32 28 32 38 Z" fill="#7e9e52" ${O}/>
    <path d="M32 30 C26 26 26 14 32 6 C38 14 38 26 32 30 Z" fill="#8aa85c" ${O}/>
    <path d="M28 58 L36 58" stroke="${C.sack}" stroke-width="4"/>`),

  mask: () => svg(`
    ${glow(32, 32, 30, C.gold)}
    <path d="M13 17 C13 7 51 7 51 17 C53 34 46 53 32 58 C18 53 11 34 13 17 Z" fill="${C.bronze}" ${O}/>
    <path d="M16 18 C18 12 26 10 32 10" stroke="${C.bronzeLight}" stroke-width="2" fill="none"/>
    <path d="M19 28 C22 25 26 25 29 28 C26 31 22 31 19 28 Z" fill="${INK}"/>
    <path d="M35 28 C38 25 42 25 45 28 C42 31 38 31 35 28 Z" fill="${INK}"/>
    <path d="M24 31 L23 46 M40 31 L41 46" stroke="${C.verdigris}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M32 26 L32 38 L29 41" stroke="${C.bronzeDark}" stroke-width="1.5" fill="none"/>
    <path d="M27 47 C30 49 34 49 37 47" stroke="${INK}" stroke-width="1.8" fill="none"/>
    <path d="M26 15 L28 19 M32 14 L32 19 M38 15 L36 19" stroke="${C.bronzeDark}" stroke-width="1.5"/>
    <circle cx="17" cy="38" r="2.2" fill="${C.verdigris}" opacity=".8"/><circle cx="47" cy="22" r="1.6" fill="${C.verdigris}" opacity=".8"/>`, 'artifact'),

  idol: () => svg(`
    ${glow(32, 30, 28, C.gold)}
    <rect x="18" y="50" width="28" height="8" rx="1" fill="${C.bronzeDark}" ${O}/>
    <path d="M24 50 L21 31 C21 25 26 23 32 23 C38 23 43 25 43 31 L40 50 Z" fill="${C.bronze}" ${O}/>
    <circle cx="32" cy="15" r="9" fill="${C.bronze}" ${O}/>
    <circle cx="29" cy="14" r="1.6" fill="#ffd36a"/><circle cx="35" cy="14" r="1.6" fill="#ffd36a"/>
    <path d="M24 34 C28 38 36 38 40 34 M26 42 L38 42" stroke="${C.bronzeDark}" stroke-width="1.8" fill="none"/>
    <path d="M25 11 C26 8 29 6 32 6" stroke="${C.bronzeLight}" stroke-width="1.6" fill="none"/>`, 'artifact'),

  orb: () => svg(`
    ${glow(32, 34, 30, '#8fe0d0')}
    <circle cx="32" cy="34" r="19" fill="#34434e" ${O}/>
    <path d="M22 26 L28 30 L24 38 M36 22 L40 30 L46 28 M30 44 L36 40 L40 46" stroke="#9fe8d8" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <circle cx="28" cy="30" r="1.4" fill="#d8fff4"/><circle cx="40" cy="30" r="1.4" fill="#d8fff4"/><circle cx="36" cy="40" r="1.4" fill="#d8fff4"/>
    <path d="M19 30 C20 24 25 19 31 18" stroke="#fff" stroke-width="1.6" fill="none" opacity=".35"/>`, 'artifact'),

  disc: () => svg(`
    ${glow(32, 32, 30, C.gold)}
    <circle cx="32" cy="32" r="23" fill="${C.bronze}" ${O}/>
    <circle cx="32" cy="32" r="17" fill="none" stroke="${C.bronzeDark}" stroke-width="1.5"/>
    <circle cx="32" cy="32" r="3" fill="${C.bronzeDark}"/>
    <path d="M22 24 L28 20 L34 25 L42 22 M24 40 L30 44 L38 41" stroke="#f6e3a0" stroke-width="1.2" fill="none"/>
    <g fill="#fff5c8"><circle cx="22" cy="24" r="1.5"/><circle cx="28" cy="20" r="1.2"/><circle cx="34" cy="25" r="1.4"/><circle cx="42" cy="22" r="1.6"/><circle cx="24" cy="40" r="1.3"/><circle cx="30" cy="44" r="1.5"/><circle cx="38" cy="41" r="1.2"/></g>
    <path d="M14 26 C16 18 22 12 30 10" stroke="${C.bronzeLight}" stroke-width="2" fill="none"/>
    <circle cx="46" cy="44" r="2" fill="${C.verdigris}" opacity=".8"/>`, 'artifact'),

  casket: () => svg(`
    ${glow(32, 36, 28, C.gold)}
    <rect x="10" y="27" width="44" height="27" rx="2" fill="${C.bronzeDark}" ${O}/>
    <path d="M10 27 C10 14 54 14 54 27 Z" fill="${C.bronze}" ${O}/>
    <path d="M20 17 L20 54 M44 17 L44 54" stroke="${C.bronzeLight}" stroke-width="2.5"/>
    <rect x="28" y="30" width="8" height="10" rx="1" fill="${C.gold}" ${O}/>
    <circle cx="32" cy="34" r="1.3" fill="${INK}"/>
    <path d="M14 22 C18 18 24 16 30 16" stroke="${C.bronzeLight}" stroke-width="1.5" fill="none"/>
    <circle cx="48" cy="46" r="2" fill="${C.verdigris}" opacity=".8"/>`, 'artifact'),

  shield: () => svg(`
    <path d="M12 12 L52 12 L52 30 C52 44 42 54 32 59 C22 54 12 44 12 30 Z" fill="${C.wood}" ${O}/>
    <path d="M22 12 L22 50 M32 12 L32 59 M42 12 L42 50" stroke="${C.woodDark}" stroke-width="1.5"/>
    <path d="M15 15 L49 15 L49 30 C49 42 41 51 32 55 C23 51 15 42 15 30 Z" fill="none" stroke="${C.ironDark}" stroke-width="2.5"/>
    <circle cx="32" cy="31" r="6" fill="${C.iron}" ${O}/>`),

  flint: () => svg(`
    <path d="M8 42 L16 29 L29 27 L36 35 L32 48 L17 50 Z" fill="#4c4c54" ${O}/>
    <path d="M16 29 L22 38 L36 35 M22 38 L17 50" stroke="#6d6d78" stroke-width="1.2" fill="none"/>
    <rect x="34" y="12" width="24" height="12" rx="6" fill="${C.iron}" ${O}/>
    <rect x="40" y="16" width="12" height="4" rx="2" fill="${INK}"/>
    <path d="M34 28 L30 24 M38 30 L38 26 M30 32 L26 30" stroke="${C.flame}" stroke-width="1.8" stroke-linecap="round"/>`),

  pick: () => svg(`
    ${line('M14 58 L39 20', C.wood, 4)}
    <path d="M14 20 C24 10 44 9 58 20 L56 24 C44 16 30 16 17 24 Z" fill="${C.iron}" ${O}/>
    <path d="M33 13 L41 13 L42 20 L33 20 Z" fill="${C.ironDark}" ${O}/>`),

  chalk: () => svg(`
    <path d="M18 46 L40 24 L48 32 L26 54 Z" fill="#e8e2d2" ${O}/>
    <path d="M40 24 L44 20 L52 28 L48 32 Z" fill="#cfc7b0" ${O}/>
    <path d="M10 60 C16 56 20 60 26 58" stroke="#e8e2d2" stroke-width="2" fill="none" stroke-linecap="round"/>`),

  sack: (n) => svg(`
    <path d="M22 20 C14 28 10 40 12 48 C14 56 24 58 32 58 C40 58 50 56 52 48 C54 40 50 28 42 20 Z" fill="${/purse|pouch/.test(n) ? C.leather : C.sack}" ${O}/>
    <path d="M24 13 L40 13 L42 20 L22 20 Z" fill="${/purse|pouch/.test(n) ? C.leather : C.sack}" ${O}/>
    ${line('M21 20 L43 20', C.woodDark, 2)}
    <path d="M18 34 C20 30 24 27 28 26" stroke="#fff" stroke-width="1.5" fill="none" opacity=".25"/>
    <path d="M36 40 L44 40 L44 48 L36 48 Z" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="1.5 1.5"/>`),
};

// Keyword → icon, checked in order against the item's name, then its type.
const ICON_RULES = [
  [/\b(mask|visage)\b/, 'mask'],
  [/\b(idol|statue|statuette|effigy|figurine|totem)\b/, 'idol'],
  [/\b(orb|humming stone|sphere|egg)\b/, 'orb'],
  [/\b(star-disc|disc|disk|astrolabe|star-chart|tablet|plaque)\b/, 'disc'],
  [/\b(reliquary|casket|chest|box|urn|coffer)\b/, 'casket'],
  [/\b(chalk)\b/, 'chalk'],
  [/\b(mushroom|fungus|toadstool|puffball)\b/, 'mushroom'],
  [/\b(sword|blade|sabre|saber|falchion|scimitar|longsword)\b/, 'sword'],
  [/\b(dagger|knife|shiv|shank|dirk|stiletto|tine|razor|scalpel)\b/, 'dagger'],
  [/\b(axe|hatchet|cleaver)\b/, 'axe'],
  [/\b(hammer|maul|mallet)\b/, 'hammer'],
  [/\b(mace|morningstar|flail)\b/, 'mace'],
  [/\b(club|cudgel|bludgeon|table leg|branch|cosh|truncheon)\b/, 'club'],
  [/\b(spear|pike|staff|pole|javelin|trident|halberd|stick|pitchfork)\b/, 'spear'],
  [/\b(chain|shackles?|manacles?|fetters?)\b/, 'chain'],
  [/\b(rope|cord|twine|line)\b/, 'rope'],
  [/\b(shield|buckler)\b/, 'shield'],
  [/\b(helm|helmet|skullcap|cap|coif|bascinet)\b/, 'helm'],
  [/\b(hood|cowl|hat)\b/, 'hood'],
  [/\b(boots?|shoes?|clogs?|sandals?|wraps|feet)\b/, 'boot'],
  [/\b(ring|band|signet)\b/, 'ring'],
  [/\b(amulet|medallion|pendant|necklace|charm|talisman|locket|holy symbol|icon)\b/, 'amulet'],
  [/\b(tunic|jerkin|gambeson|armou?r|mail|hauberk|cuirass|shirt|rags|robe|cloak|coat|vest|brigandine|clothes)\b/, 'tunic'],
  [/\b(bread|loaf|biscuit|hardtack|cake|crust|heel)\b/, 'bread'],
  [/\b(pork|meat|jerky|sausage|ham|flesh|haunch|mutton|fish)\b/, 'meat'],
  [/\b(waterskin|wineskin|skin)\b/, 'waterskin'],
  [/\b(potion|flask|vial|bottle|elixir|tonic|draught|jar|phial|wine|ale)\b/, 'bottle'],
  [/\b(candle|taper)\b/, 'candle'],
  [/\b(torch|brand)\b/, 'torch'],
  [/\b(lantern|lamp)\b/, 'lantern'],
  [/\b(lockpick|pick-lock|picklock|wire)\b/, 'lockpick'],
  [/\b(key|keys)\b/, 'key'],
  [/\b(map|scroll|letter|parchment|page|note|chart|deed|writ)\b/, 'scroll'],
  [/\b(book|tome|journal|ledger|grimoire|codex|diary)\b/, 'book'],
  [/\b(coins?|coppers?|silver|gold|crowns?|pennies|money)\b/, 'coins'],
  [/\b(gem|jewel|crystal|ruby|emerald|sapphire|amethyst|topaz|diamond|shard)\b/, 'gem'],
  [/\b(skull)\b/, 'skull'],
  [/\b(bone|femur|rib|tooth|teeth|knucklebone)\b/, 'bone'],
  [/\b(bandages?|linen|salve|poultice|dressing)\b/, 'bandage'],
  [/\b(herbs?|leaf|leaves|moss|root|weed)\b/, 'herb'],
  [/\b(flint|tinderbox|striker|steel)\b/, 'flint'],
  [/\b(pickaxe|pick|shovel|spade|crowbar|chisel|trowel|tool)\b/, 'pick'],
  [/\b(sack|bag|pouch|purse|satchel|pack)\b/, 'sack'],
];

const TYPE_FALLBACK = {
  weapon: 'dagger', armor: 'tunic', clothing: 'tunic', tool: 'pick', light: 'candle', food: 'bread',
  drink: 'bottle', medicine: 'bandage', key: 'key', valuable: 'gem', artifact: 'mask', junk: 'sack',
};

export function itemIconKey(item) {
  const name = String(item?.name || '').toLowerCase();
  const type = String(item?.type || '').toLowerCase().trim();
  const isArtifact = type === 'artifact';
  for (const [re, key] of ICON_RULES) {
    if (!re.test(name)) continue;
    // Artifacts keep an artifact-looking icon even if the name mentions something mundane.
    if (isArtifact && !['mask', 'idol', 'orb', 'disc', 'casket', 'gem', 'skull', 'book', 'scroll', 'ring', 'amulet', 'key', 'sword', 'dagger'].includes(key)) continue;
    return key;
  }
  return TYPE_FALLBACK[type] || 'sack';
}

export function itemIcon(item) {
  const key = itemIconKey(item);
  return ICONS[key](String(item?.name || '').toLowerCase());
}

/* ---------------------------------------------------------------- portraits */

const EYE = { peaceful: '#a6e07a', neutral: '#f2cf5a', hostile: '#ff5a36' };
const SKIN = ['#c7a17d', '#a67a55', '#86593a', '#6b472c', '#d4b08e', '#b8906a'];
const HAIR = ['#2a1d14', '#4a3222', '#6b6258', '#8a6a3a', '#1a1410', '#9a9288', '#5a2a18'];
const CLOTH = ['#4a3f33', '#3d3b31', '#5a4632', '#48302a', '#37332e', '#3c4038'];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

const P = (body) => `<svg class="portrait" viewBox="0 0 100 120" aria-hidden="true">${body}</svg>`;
const eyeGlow = (x, y, color, r = 2.2) => `<circle cx="${x}" cy="${y}" r="${r * 3}" fill="${color}" opacity=".18"/><circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;

function human(v, eye) {
  const beard = /beard/.test(v.text);
  const scar = /scar/.test(v.text) || v.h % 5 === 1;
  const bald = /\bbald|shaven|shorn/.test(v.text);
  return P(`
    <path d="M8 121 C10 97 26 87 50 87 C74 87 90 97 92 121 Z" fill="${v.cloth}" ${O}/>
    <path d="M30 96 C36 104 44 108 50 108 C56 108 64 104 70 96" fill="none" stroke="${INK}" stroke-width="1.5" opacity=".5"/>
    <path d="M42 72 L42 89 L58 89 L58 72 Z" fill="${v.skin}" ${O}/>
    <path d="M30 50 C30 30 40 22 50 22 C60 22 70 30 70 50 C70 67 62 81 50 81 C38 81 30 67 30 50 Z" fill="${v.skin}" ${O}/>
    <path d="M30 50 C30 66 38 81 50 81 C43 77 37 67 36 53 Z" fill="#000" opacity=".22"/>
    ${bald ? '' : `<path d="M28 49 C25 30 36 17 50 17 C64 17 75 28 72 49 C69 39 64 34 58 32 C52 36 42 36 36 34 C32 38 30 42 28 49 Z" fill="${v.hair}" ${O}/>`}
    ${beard ? `<path d="M33 60 C35 76 43 85 50 85 C57 85 65 76 67 60 C62 69 38 69 33 60 Z" fill="${v.hair}" ${O}/>` : ''}
    <path d="M38 47 L46 48 M54 48 L62 47" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="42" cy="53" rx="3" ry="2.2" fill="${INK}"/><ellipse cx="58" cy="53" rx="3" ry="2.2" fill="${INK}"/>
    <circle cx="43" cy="52.5" r=".9" fill="${eye}"/><circle cx="59" cy="52.5" r=".9" fill="${eye}"/>
    <path d="M50 54 L47 63 L52 64" fill="none" stroke="${INK}" stroke-width="1.5"/>
    <path d="M44 ${beard ? 71 : 70} C48 71.5 52 71.5 56 ${beard ? 71 : 70}" stroke="${INK}" stroke-width="1.6" fill="none"/>
    ${scar ? `<path d="M60 44 L66 62" stroke="#7a2a22" stroke-width="1.6"/>` : ''}
    <circle cx="36" cy="64" r="3" fill="#2a1d14" opacity=".25"/><circle cx="62" cy="42" r="2" fill="#2a1d14" opacity=".2"/>`);
}

function hooded(v, eye) {
  return P(`
    <path d="M6 121 C8 93 22 81 36 77 L64 77 C78 81 92 93 94 121 Z" fill="${v.cloth}" ${O}/>
    <path d="M22 85 C18 51 30 14 50 12 C70 14 82 51 78 85 C68 77 32 77 22 85 Z" fill="${v.cloth}" ${O}/>
    <path d="M34 71 C32 49 40 33 50 31 C60 33 68 49 66 71 C60 77 40 77 34 71 Z" fill="#0a0806"/>
    <path d="M41 67 C43 73 57 73 59 67 C55 71 45 71 41 67 Z" fill="${v.skin}" opacity=".55"/>
    ${eyeGlow(43, 53, eye, 1.8)}${eyeGlow(57, 53, eye, 1.8)}
    <path d="M28 82 C30 70 30 60 34 50 M72 82 C70 70 70 60 66 50 M50 13 L50 30" stroke="#000" stroke-width="1.6" fill="none" opacity=".35"/>
    <path d="M40 100 L44 121 M62 98 L58 121" stroke="#000" stroke-width="1.5" opacity=".3"/>`);
}

function guard(v, eye) {
  return P(`
    <path d="M8 121 C10 97 26 87 50 87 C74 87 90 97 92 121 Z" fill="${C.ironDark}" ${O}/>
    <path d="M14 106 h72 M11 114 h78 M18 98 h64" stroke="${C.iron}" stroke-width="2.5" stroke-dasharray="1.8 1.8"/>
    <path d="M36 92 L64 92 L60 121 L40 121 Z" fill="#6a2a22" ${O}/>
    <path d="M42 72 L42 89 L58 89 L58 72 Z" fill="${v.skin}" ${O}/>
    <path d="M31 52 C31 32 40 24 50 24 C60 24 69 32 69 52 C69 68 61 81 50 81 C39 81 31 68 31 52 Z" fill="${v.skin}" ${O}/>
    ${/clean-shaven|beardless/.test(v.text) ? '' : `<path d="M33 60 C35 76 43 84 50 84 C57 84 65 76 67 60 C62 68 38 68 33 60 Z" fill="${v.hair}" opacity="${/beard/.test(v.text) ? 1 : 0.55}"/>`}
    <path d="M27 49 C27 27 38 16 50 16 C62 16 73 27 73 49 L73 52 L27 52 Z" fill="${C.iron}" ${O}/>
    <path d="M27 47 L73 47" stroke="${C.ironDark}" stroke-width="3"/>
    <rect x="47.5" y="45" width="5" height="19" rx="1" fill="${C.ironDark}" ${O}/>
    <path d="M34 36 C35 28 41 22 47 21" stroke="${C.ironLight}" stroke-width="2" fill="none"/>
    <circle cx="33" cy="47" r="1.3" fill="${C.ironLight}"/><circle cx="67" cy="47" r="1.3" fill="${C.ironLight}"/>
    <ellipse cx="42" cy="56" rx="3" ry="2" fill="${INK}"/><ellipse cx="58" cy="56" rx="3" ry="2" fill="${INK}"/>
    <circle cx="43" cy="55.5" r=".9" fill="${eye}"/><circle cx="59" cy="55.5" r=".9" fill="${eye}"/>
    <path d="M45 72 C48 73 52 73 55 72" stroke="${INK}" stroke-width="1.6" fill="none"/>`);
}

function goblin(v, eye) {
  const skin = ['#7a8a5a', '#6f7a66', '#8a8a6a', '#5f7050'][v.h % 4];
  return P(`
    <path d="M14 121 C16 99 30 89 50 89 C70 89 84 99 86 121 Z" fill="#4a3a2a" ${O}/>
    <path d="M22 108 L28 121 M76 106 L70 121 M40 94 L44 104 L50 96 L56 104 L60 94" stroke="${INK}" stroke-width="1.5" fill="none" opacity=".6"/>
    <path d="M36 50 L6 30 L14 44 L34 64 Z" fill="${skin}" ${O}/><path d="M34 52 L14 38 L30 58 Z" fill="#000" opacity=".25"/>
    <path d="M64 50 L94 30 L86 44 L66 64 Z" fill="${skin}" ${O}/><path d="M66 52 L86 38 L70 58 Z" fill="#000" opacity=".25"/>
    <path d="M32 56 C32 38 40 29 50 29 C60 29 68 38 68 56 C68 72 60 83 50 83 C40 83 32 72 32 56 Z" fill="${skin}" ${O}/>
    <path d="M32 56 C32 70 40 83 50 83 C44 79 38 70 37 58 Z" fill="#000" opacity=".2"/>
    <path d="M36 45 L46 49 M64 45 L54 49" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    ${/one-eyed|one eye|milky/.test(v.text)
      ? `${eyeGlow(42, 53, eye, 3)}<path d="M53 50 L62 56 M62 50 L53 56" stroke="${INK}" stroke-width="2"/><ellipse cx="58" cy="53" rx="4" ry="3.2" fill="#d8d4c8" opacity=".8"/>`
      : `${eyeGlow(42, 53, eye, 3)}${eyeGlow(58, 53, eye, 3)}`}
    <path d="M42 53 L42 53.1 M58 53 L58 53.1" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M49 55 C55 61 58 66 51 68" fill="${skin}" ${O}/>
    <path d="M37 72 C43 79 57 79 63 72 C57 74 43 74 37 72 Z" fill="${INK}"/>
    <path d="M40 73 L42 77 L44 73.6 M47 74 L49 78 L51 74 M55 73.6 L57 77 L59 73" fill="${C.bone}" stroke="${C.bone}" stroke-width="1"/>
    <circle cx="61" cy="64" r="1.6" fill="#000" opacity=".3"/><circle cx="38" cy="40" r="1.2" fill="#000" opacity=".3"/>`);
}

function rat(v, eye) {
  const blind = /blind|eyeless|no eyes/.test(v.text);
  const hide = /hairless|pale|fat/.test(v.text) ? '#c9a08a' : '#6a5a4c';
  return P(`
    <path d="M6 121 C10 93 30 81 50 81 C70 81 90 93 94 121 Z" fill="${hide}" ${O}/>
    <circle cx="28" cy="36" r="13" fill="${hide}" ${O}/><circle cx="28" cy="36" r="7" fill="#b87a7a" opacity=".8"/>
    <circle cx="72" cy="36" r="13" fill="${hide}" ${O}/><circle cx="72" cy="36" r="7" fill="#b87a7a" opacity=".8"/>
    <path d="M27 58 C27 40 38 31 50 31 C62 31 73 40 73 58 C73 72 60 93 50 98 C40 93 27 72 27 58 Z" fill="${hide}" ${O}/>
    <path d="M27 58 C27 72 40 93 50 98 C45 90 35 74 33 60 Z" fill="#000" opacity=".2"/>
    ${blind
      ? `<path d="M36 55 C39 52 43 52 46 55 M54 55 C57 52 61 52 64 55" stroke="${INK}" stroke-width="2" fill="none"/><path d="M38 56 L39 58 M42 56.5 L42 58.5 M58 56.5 L58 58.5 M62 56 L61 58" stroke="${INK}" stroke-width="1"/>`
      : `${eyeGlow(41, 55, eye, 2.8)}${eyeGlow(59, 55, eye, 2.8)}`}
    <ellipse cx="50" cy="93" rx="5.5" ry="4" fill="#7a3a3a" ${O}/>
    <rect x="46.5" y="98" width="3.2" height="7" fill="${C.bone}" ${O}/><rect x="50.3" y="98" width="3.2" height="7" fill="${C.bone}" ${O}/>
    <path d="M44 90 L20 84 M44 93 L18 94 M44 96 L22 104 M56 90 L80 84 M56 93 L82 94 M56 96 L78 104" stroke="${INK}" stroke-width="1" opacity=".7"/>`);
}

function undead(v, eye) {
  return P(`
    <path d="M10 121 C12 97 28 88 50 88 C72 88 88 97 90 121 Z" fill="#35302a" ${O}/>
    <path d="M30 96 L26 121 M42 94 L40 121 M58 94 L60 121 M70 96 L74 121" stroke="#1c1814" stroke-width="3"/>
    <path d="M44 76 L44 90 M50 76 L50 90 M56 76 L56 90" stroke="${C.boneDark}" stroke-width="3"/>
    <path d="M50 16 C34 16 25 27 25 42 C25 52 30 57 34 59 L34 70 C34 74 39 77 44 77 L56 77 C61 77 66 74 66 70 L66 59 C70 57 75 52 75 42 C75 27 66 16 50 16 Z" fill="${C.bone}" ${O}/>
    <ellipse cx="40" cy="44" rx="7" ry="8" fill="${INK}"/><ellipse cx="60" cy="44" rx="7" ry="8" fill="${INK}"/>
    ${eyeGlow(40, 45, eye, 2)}${eyeGlow(60, 45, eye, 2)}
    <path d="M50 52 L46 60 L54 60 Z" fill="${INK}"/>
    <path d="M40 67 L40 75 M45 67 L45 76 M50 67 L50 76 M55 67 L55 76 M60 67 L60 75" stroke="${INK}" stroke-width="1.5"/>
    <path d="M56 18 L53 26 L58 31" stroke="${INK}" fill="none" stroke-width="1.3"/>
    <path d="M30 36 C31 28 37 22 44 20" stroke="#fff" stroke-width="1.5" fill="none" opacity=".3"/>`);
}

function ghoul(v, eye) {
  return P(`
    <path d="M14 121 C18 100 32 92 50 92 C68 92 82 100 86 121 Z" fill="#8a8f86" ${O}/>
    <path d="M30 102 C36 106 40 110 42 121 M70 102 C64 106 60 110 58 121 M38 96 L62 96" stroke="${INK}" stroke-width="1.4" fill="none" opacity=".5"/>
    <path d="M36 40 C36 21 42 13 50 13 C58 13 64 21 64 40 L62 70 C60 87 56 97 50 99 C44 97 40 87 38 70 Z" fill="#9aa096" ${O}/>
    <path d="M36 40 L38 70 C40 87 44 97 50 99 C46 90 42 76 42 60 Z" fill="#000" opacity=".22"/>
    <path d="M36 22 L30 44 M42 16 L38 36 M60 18 L66 40" stroke="#2a2a26" stroke-width="1.5" opacity=".8"/>
    <ellipse cx="43" cy="44" rx="5" ry="6.5" fill="#1a1c18"/><ellipse cx="57" cy="44" rx="5" ry="6.5" fill="#1a1c18"/>
    ${eyeGlow(43, 45, eye, 1.6)}${eyeGlow(57, 45, eye, 1.6)}
    <path d="M40 58 C42 62 44 64 46 64 M60 58 C58 62 56 64 54 64" stroke="${INK}" stroke-width="1.2" fill="none" opacity=".6"/>
    <ellipse cx="50" cy="80" rx="7" ry="13" fill="${INK}"/>
    <path d="M45 70 L46 74 L47.5 70.5 M50 69.5 L51 74 L52 69.5 M53 70.5 L54.5 74 L55 70.5 M45.5 90 L47 86 L48.5 90.5 M51.5 90.5 L53 86 L54.5 90" fill="${C.bone}" stroke="${C.bone}" stroke-width="1"/>`);
}

function spider(v, eye) {
  let legs = '';
  const LEGS = [[58, 22, 30, 8, 50], [62, 14, 50, 4, 74], [66, 16, 74, 6, 100], [70, 26, 92, 16, 119]];
  for (const [sy, kx, ky, fx, fy] of LEGS) {
    for (const [a, b, c] of [[44, kx, fx], [56, 100 - kx, 100 - fx]]) {
      const d = `M${a} ${sy} L${b} ${ky} L${c} ${fy}`;
      legs += `<path d="${d}" stroke="${INK}" stroke-width="5" fill="none" stroke-linejoin="round"/><path d="${d}" stroke="#3a3130" stroke-width="2.6" fill="none" stroke-linejoin="round"/>`;
    }
  }
  return P(`${legs}
    <ellipse cx="50" cy="96" rx="24" ry="22" fill="#2e2624" ${O}/>
    <path d="M40 86 L50 94 L60 86 M42 102 L50 108 L58 102" stroke="#6a2a22" stroke-width="2.5" fill="none"/>
    <ellipse cx="50" cy="62" rx="16" ry="14" fill="#3a3130" ${O}/>
    ${eyeGlow(44, 58, eye, 2.4)}${eyeGlow(56, 58, eye, 2.4)}${eyeGlow(40, 52, eye, 1.4)}${eyeGlow(60, 52, eye, 1.4)}${eyeGlow(47, 51, eye, 1.2)}${eyeGlow(53, 51, eye, 1.2)}
    <path d="M45 72 C44 78 46 80 48 78 M55 72 C56 78 54 80 52 78" stroke="${C.bone}" stroke-width="2" fill="none"/>`);
}

function hound(v, eye) {
  const fur = ['#4a4038', '#5a4a3a', '#3a3632', '#6a5a4a'][v.h % 4];
  return P(`
    <path d="M8 121 C12 95 30 85 50 85 C70 85 88 95 92 121 Z" fill="${fur}" ${O}/>
    <path d="M30 40 L24 10 L42 30 Z" fill="${fur}" ${O}/><path d="M70 40 L76 10 L58 30 Z" fill="${fur}" ${O}/>
    <path d="M28 52 C28 34 38 26 50 26 C62 26 72 34 72 52 C72 62 66 68 62 72 L58 94 C56 98 44 98 42 94 L38 72 C34 68 28 62 28 52 Z" fill="${fur}" ${O}/>
    <path d="M40 60 C42 70 44 84 46 92 L54 92 C56 84 58 70 60 60 C56 64 44 64 40 60 Z" fill="#000" opacity=".18"/>
    <path d="M34 46 L44 50 M66 46 L56 50" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    ${eyeGlow(41, 53, eye, 2.6)}${eyeGlow(59, 53, eye, 2.6)}
    <ellipse cx="50" cy="90" rx="6" ry="4.5" fill="${INK}"/>
    <path d="M42 96 L44 101 L46 97 M54 97 L56 101 L58 96" fill="${C.bone}" stroke="${C.bone}" stroke-width="1"/>`);
}

const PORTRAIT_RULES = [
  [/\b(guard|warden|soldier|jailer|gaoler|sergeant|knight|captain|turnkey|sentry|watchman)\b/, guard],
  [/\b(goblin|grubber|imp|kobold|gremlin|hob)\b/, goblin],
  [/\b(rat|rats|rodent|vermin)\b/, rat],
  [/\b(skeleton|undead|revenant|bones|lich|wight|corpse|dead man|draugr)\b/, undead],
  [/\b(ghoul|horror|wretch|fiend|abomination|zombie|ghast|thing|eater|devourer)\b/, ghoul],
  [/\b(spider|crawler|centipede|insect|beetle|tick|arachnid|weaver)\b/, spider],
  [/\b(hound|dog|wolf|beast|cur|jackal|bat)\b/, hound],
  [/\b(hooded|cloaked|cultist|priest|monk|trader|merchant|stranger|figure|witch|hermit|pilgrim|peddler|fence|shadow)\b/, hooded],
];

export function npcPortrait(npc, alignment) {
  const name = String(npc?.name || '').toLowerCase();
  const type = String(npc?.type || '').toLowerCase();
  const desc = String(npc?.description || '').toLowerCase();
  const h = hash(name);
  const v = {
    h,
    text: `${name} ${type} ${desc}`,
    skin: SKIN[h % SKIN.length],
    hair: /\b(grey|gray|white|silver|old|aged|elderly)\b|grey-|gray-|white-/.test(`${name} ${desc}`) ? '#9a958c' : /\b(red|ginger|copper)-?haired|\bred beard/.test(desc) ? '#8a3a1a' : HAIR[(h >>> 3) % HAIR.length],
    cloth: CLOTH[(h >>> 6) % CLOTH.length],
  };
  const eye = EYE[alignment] || EYE.neutral;
  const primary = `${name} ${type}`;
  for (const [re, draw] of PORTRAIT_RULES) if (re.test(primary)) return draw(v, eye);
  for (const [re, draw] of PORTRAIT_RULES) if (re.test(desc)) return draw(v, eye);
  return human(v, eye);
}
