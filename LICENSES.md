# Third-party licenses

Everything third-party used in CAMP LAB videos or this repo: name, source, license, where it is used.
Add a row before using anything new (font, music, sound effect, icon, image, data, library).

| Item | Source | License | Used for |
|---|---|---|---|
| Inter (font) | https://github.com/rsms/inter (files via @fontsource/inter) | SIL Open Font License 1.1 — `public/fonts/Inter-OFL.txt` | All on-screen text |
| Remotion | https://www.remotion.dev | Remotion License — free for individuals and companies up to 3 employees; larger companies need a company license (check https://www.remotion.dev/license) | Rendering |
| React, zod, tsx, TypeScript, dotenv | npm | MIT / Apache-2.0 | Code |
| three.js 0.186.1, @react-three/fiber 9.8.2, @types/three | npm (https://threejs.org, https://github.com/pmndrs/react-three-fiber) | MIT | 3D scenes via @remotion/three (covered by the Remotion row) |
| ElevenLabs voice `VU16byTywsWv5JpI8rbc` | https://elevenlabs.io | ElevenLabs Terms — **commercial use requires a paid plan**; confirm the voice's terms in the Voice Library | Narration |
| Sound effects and ambiences in `public/sfx/` | Synthesized from code in this repo (`scripts/sfx.ts`, `npm run sfx`); no third-party samples | Original work, no third-party license | Episode sound design (`sfx` in each `script.json`) |

## Checklist before publishing

- [ ] ElevenLabs plan allows commercial use of the generated audio
- [ ] Any background music in `public/music/` is listed above with its license
- [ ] Any sound effects, icons or images are listed above
