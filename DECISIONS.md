# Design decisions

Choices made while building Picsall that could reasonably have gone another
way. Each one says why it was made and what would be a good reason to revisit it.

## How the scan works

### Transparent canvas stacked on the live video
The `<video>` plays full screen, with a canvas on top that starts transparent.
Each frame copies only the newly scanned lines onto the canvas. The canvas is
both the display and the final picture, so there's no per-frame redraw of the
whole screen and no separate compositing step.
**Revisit if** we want effects on the live part (filters, say), which would
need everything drawn into one canvas or WebGL.

### Driven by `requestAnimationFrame` and the clock
Each animation frame works out how many lines should be done by now, and copies
whatever is missing from the current video frame. Tying the scan to the clock
means the total time is always honoured, even if the frame rate dips.
`requestVideoFrameCallback` would run once per new camera frame, but it isn't
universal and the scan line would move at camera rate rather than screen rate.

### Fast scans capture bands, not single lines
A camera gives about 30 different frames a second, so a scan can only have about
30 distinct moments per second. A 1 second scan of 1080 lines copies around 18
lines per animation frame, which shows up as visible steps on fast-moving
subjects. Slow scans really are one line at a time: 18 lines a second at 60s.
**Revisit if** the steps on fast scans look bad. Blending between frames could
smooth them, at the cost of the crisp slit-scan look.

### Linear speed
The line moves at a constant rate.
**Revisit if** easing or speed changes mid-scan sound fun.

### Four straight directions
Down, up, left, and right. `DIRECTIONS` in `scan-geometry.js` describes these as
an axis plus a reversed flag, which suits straight wipes only.
**Revisit if** we want a radial, clock-hand, or centre-out wipe. Those would
mean replacing `bandRect` with something that draws a shape, likely using a
canvas clip path.

## Picture format

### The saved picture is exactly what's on screen
The video is shown with `object-fit: cover`, and the scan covers only that
visible crop. So a phone held upright saves a tall picture, and a browser window
of an unusual shape saves that shape. It also means the line travels from screen
edge to screen edge, rather than disappearing into a cropped-off area.
The cost is that the parts of the camera frame outside the crop are lost.
**Revisit if** you'd prefer the full sensor frame, which would need letterboxing
the view.

### Selfies are saved mirrored
Selfie cameras and webcams show a mirror image, and the saved file matches it,
so a picture looks like what you watched. This differs from most phone cameras,
which un-mirror on save, and it means text in a selfie comes out backwards. Rear
cameras aren't mirrored. Desktop webcams don't report a facing direction, so
they're treated as selfie cameras.
**Revisit if** backwards text bothers you. A mirror toggle would fit here.

### JPEG at 0.92 quality
About a tenth of the size of PNG for camera images, with no visible loss at
normal viewing. The quality is `JPEG_QUALITY` in `scanner.js`.
**Revisit if** the fine line detail ever looks smeared.

### Asks for 1920x1080
A request, not a guarantee; the camera gives its closest match. Higher would cost
little during the scan, because each frame only copies a thin band, but it would
make the live preview heavier on older phones and take more storage.
**Revisit if** you want bigger prints.

## Capture flow

### The speed slider runs 1 to 60 seconds, unevenly
Stops are 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, and 60 seconds, so the short end
gets fine control. The default is 5. Rabbit is fast and turtle is slow, so
moving right means slower.

### Added a self-timer (not in the original ask)
Default 3 seconds, can be set to off, 3, 5, or 10. With a scan like this you
usually want to press the button and then get into position, particularly with
a laptop on a table.

### Controls disappear during a capture
Only a small stop button stays, which doubles as a progress ring, so the view is
as close to full screen as possible. The button isn't part of the picture.

### Stopping discards the picture
Stop or Esc throws away the partial scan, rather than saving a half-finished
image with a transparent or black remainder.
**Revisit if** half-pictures turn out to be interesting. Keeping them would need
a decision about what fills the unscanned part.

### Taps within half a second of starting don't stop the capture
Otherwise a double-tap on the shutter, common with kids, starts and instantly
cancels. Esc isn't affected.

### Scans stop if the app is hidden or the camera changes shape
Animation frames pause in a hidden tab, and rotating a phone changes the shape
of the camera frame, so neither can produce a sensible picture. The scan is
abandoned with a message.
**Revisit if** you want to rotate the phone during a scan on purpose, as a
creative effect. Locking the orientation would be a start.

### The result opens straight away
When a scan finishes it's saved to the recent pictures and opened in the viewer,
ready to download. Saving is automatic, so nothing is lost by going back to the
camera, and downloading is an explicit choice.

## Storage

### Pictures persist in IndexedDB, on this device only
"Most recent 5" could have meant just this session, but losing pictures on a
reload seemed worse. Blobs go straight into IndexedDB, falling back to memory if
it's unavailable. Nothing leaves the device. The limit is `MAX_PHOTOS` in
`photo-store.js`.

### The oldest picture is dropped silently
Taking a sixth picture removes the oldest with no warning, even if it was never
downloaded.
**Revisit if** kids lose pictures they cared about. Pinning a favourite or
warning on undownloaded pictures would both work.

### Delete has no confirmation
Added so there's a way to remove a picture from the device. There's no "are you
sure", because only five are kept and it's a low-stakes toy.
**Revisit if** small fingers delete too many good ones.

## Project setup

### No framework, bundler, or runtime dependencies
Native modules cover everything here, and it can be hosted anywhere as static
files. `package.json` only exists to name the `start` and `test` scripts.

### Only the logic has committed tests
`npm test` covers the scan maths, settings, and store. Anything needing a real
camera was verified by a throwaway browser script, not committed, because it
would add Playwright as a dependency.
**Revisit if** the scanner starts changing often, since a committed browser test
using Chromium's fake camera flags would be worthwhile then.

### Plain download link, no share sheet
Download is an `<a download>`. On iPhones this saves to Files rather than Photos.
**Revisit if** phones are the main device. The Web Share API would offer "Save
Image".
