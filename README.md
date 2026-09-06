# Yu-Gi-Oh! Duel Links Combo Simulator

A browser-based simulator for building, recording, and sharing Yu-Gi-Oh! Duel Links combos.

**Live demo:** https://joseph-pq.github.io/yugioh-simulator

<div align="center">

[![react](https://img.shields.io/badge/-React_19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![typescript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![vite](https://img.shields.io/badge/-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
<br>
[![tailwindcss](https://img.shields.io/badge/-Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![dnd-kit](https://img.shields.io/badge/-dnd--kit-FF6B6B?logo=drag&logoColor=white)](https://dndkit.com/)
[![license](https://img.shields.io/badge/License-MIT-green.svg?labelColor=gray)](LICENSE)

</div>

## Features

- Build a deck and set up the duel board
- Record combo sequences step by step
- Play back and share combos via URL

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173.

### Optional online sharing

The simulator works entirely locally without an account. To enable signed-in short links, copy `.env.example` to `.env.local` and set the public Supabase URL and publishable key. Apply the migrations and deploy `supabase/functions/combos` to the same project, then configure Google and Discord OAuth redirect URLs for both `http://localhost:5173` and `https://joseph-pq.github.io/yugioh-simulator/`.

Set `RATE_LIMIT_SALT` only as a Supabase Edge Function secret before deployment. Deploy the function with `npx supabase functions deploy combos --no-verify-jwt`: public reads need to reach the function, and the function itself verifies a valid JWT before every mutation. Never place service-role keys, secret keys, OAuth client secrets, or the rate-limit salt in Vite environment variables. The function reads Supabase's built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server secrets.

## License

[MIT](LICENSE)

## Disclaimer

This is an **unofficial fan project** with no affiliation to, endorsement by, or association with Konami Digital Entertainment, Yu-Gi-Oh!, or Duel Links.

- Yu-Gi-Oh! and all related names, card artwork, and trademarks are the property of **Konami Digital Entertainment Co., Ltd.** and/or **Kazuki Takahashi**.
- Card data and images are provided by the community-run [YGOProDeck API](https://ygoprodeck.com/api-guide/) and are used solely for non-commercial, educational fan purposes.
- This project does not distribute, sell, or profit from any Konami-owned assets.
