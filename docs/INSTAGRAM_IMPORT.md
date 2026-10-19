# Getting saved reels into Pal

Pal never sees an Instagram password. These are the ways in, easiest-to-defend first.

## Option 1: Instagram's own export (main path)
Instagram builds a file of your saved posts for you. About 2 minutes of tapping, then a wait for the email (usually minutes, sometimes hours).

1. Instagram > Settings > Accounts Center > Your information and permissions > Download your information.
2. Download or transfer information > pick your Instagram account > Some of your information.
3. Tick **Saved** only > Next > Download to device.
4. Date range: All time. Format: **JSON**. Media quality: Low. Create files.
5. When the email arrives, download the zip. Inside is `your_instagram_activity/saved/saved_posts.json` (exact path to be confirmed against the real file). In the app, Pal asks you for that file (or the whole zip).

Why it's the main path: it's Instagram's official tool, it's your own data, and judges score security and ethics.

## Option 2: Share button (one reel at a time)
In Instagram, tap Share on a reel > Pal. Built in Gate E.

## Option 3: Paste a link
Copy a reel's link in Instagram and paste it into Pal. This is the fallback when the share button doesn't work.

## Option 4 (undecided): "Copy my saved links" button on desktop
On a computer, you open instagram.com > your profile > Saved, and click a bookmark button we provide. It reads the reel links already showing on your screen and copies them, and you paste them into Pal. No password leaves your browser, and it's instant.

Risk: Instagram's terms prohibit collecting information "in automated ways" without permission. A script that scrolls the page for you is clearly automation; a button that only reads what you scrolled to yourself is a grey area. Vicente decides whether to build this. See DECISIONS.md.
