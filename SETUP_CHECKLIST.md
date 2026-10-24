# Pal setup checklist

Everything **you** will need to do, in order. You can do items 1–4 now, while I build.
I will still walk you through each one in a "YOUR TURN" message when it is needed.

Your setup: iPhone, Mac, Canada, Google Cloud (Cloud Shell) already working, Expo project already linked to GitHub.
Budget: about $8. The old Gemini credit does not pay for Claude or Whisper, so the money below is new spend.

| # | What | Why | Time | Cost | When |
|---|------|-----|------|------|------|
| 1 | Check your **Anthropic** API key has credit (console.anthropic.com → Billing) | Claude reads the recipe, proposes swaps, reads pantry photos | 2 min | Pay as you go. About $0.02–0.05 per video, under $1 per pantry photo batch. If balance is $0, add $5 | Before Phase 8 |
| 2 | Get an **OpenAI** API key + add credit (platform.openai.com) | Whisper turns the video's audio into text | 5 min | $5 minimum top-up. Whisper costs $0.006 per minute of video, so a 1-min video is under 1 cent | Before Phase 8 |
| 3 | Get a free **USDA FoodData Central** key (fdc.nal.usda.gov/api-key-signup) | Real calorie and macro numbers per ingredient | 2 min | Free | Before Phase 8 |
| 4 | Make sure **Expo Go** is on your iPhone (App Store) | Runs the app before we build a real one | 2 min | Free | Phase 2 |
| 5 | Deploy Pal's server from **Cloud Shell** (one command I give you; you paste the 3 keys + a password I generate, typing is hidden) | Puts the server online so your phone can reach it | 10 min | Google Cloud Run free tier covers a demo (2 million requests/month free) | Phase 8 (earlier if you want to try it sooner) |
| 6 | Maybe: export **Instagram cookies** from your browser | Instagram often blocks servers that aren't logged in | 10 min | Free. Use a spare Instagram account if you can | Only if my test shows Instagram needs it |
| 7 | Open the Pal link in Expo Go and try the full loop with me | The real test | 20 min | Free | Phase 8 |
| 8 | **Decision:** Apple Developer Program for the share sheet + voice on iPhone | The iPhone share sheet and "Pal, next step" voice need a real app build, and Apple only lets paid developers install those on an iPhone | 15 min signup + up to 48 h Apple approval | **$99 USD / year** (Apple may show it in CAD; check the price on the signup page). Not required for the core demo: everything else works in Expo Go | Phase 7. I will ask before you pay anything |
| 9 | Optional, later: Instacart Developer Platform (dashboard.instacart.com) | Would let Pal create a real Instacart shopping list in one tap, instead of opening the store's search | About 1 week for a test key, then a demo review before a real key | Free | After the demo, if you want it |

## Not needed
- Node.js on your Mac: the server runs on Google Cloud, and the app is published online, so you don't need to install anything on the Mac.
- DoorDash / Costco accounts: neither has a public API for carts or prices. Pal opens their website search instead and says so.
- Google Play account: only needed for Android.
