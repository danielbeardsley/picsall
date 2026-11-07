# Picsall

A camera that takes its time. Instead of grabbing the whole picture at once,
Picsall captures it one scan line at a time while you watch. Everything behind
the line is frozen and everything ahead of it is still live, so anything that
moves during the scan gets stretched, squashed, or duplicated. Try walking
along with the line, or moving your hand as it passes.

Plain HTML, CSS, and JS modules. No build step and no runtime dependencies.

## Run it

Browsers only allow the camera on `https://` or `localhost`, and JS modules
don't load from `file://`, so it has to be served:

```sh
npm start        # or: python3 -m http.server 8000
```

Then open <http://localhost:8000>.

**On a phone**, `http://<your-computer's-ip>:8000` won't work because it isn't
https. Host it somewhere with https instead (GitHub Pages works, since these
are all static files) or use an https tunnel.

## Use it

- Pick a **direction** with the arrows and a **speed** with the slider
  (1 to 60 seconds for the whole picture).
- Press the **shutter**, or the space bar. The self-timer button sets the delay
  before the scan starts, and it can be turned off.
- Press the **stop** button or Esc to abandon a picture.
- The last **5 pictures** appear as thumbnails and stay after a reload. Open one
  to download or delete it.

## Code map

| File | What it does |
| --- | --- |
| `js/main.js` | Wires everything together and owns the app state |
| `js/scanner.js` | The scan itself: copies lines from the video to the canvas |
| `js/scan-geometry.js` | Pure maths for crops, bands, and timing |
| `js/camera.js` | Camera stream, switching cameras, error messages |
| `js/controls.js`, `js/settings.js` | Settings controls and remembering them |
| `js/gallery.js`, `js/photo-store.js` | Recent pictures and their storage |
| `js/viewer.js` | Full-screen picture viewer |
| `js/countdown.js`, `js/wake-lock.js` | Self-timer numbers, keeping the screen on |

`npm test` runs the unit tests with Node's built-in test runner.

Design choices you might want to change are recorded in
[DECISIONS.md](DECISIONS.md).
