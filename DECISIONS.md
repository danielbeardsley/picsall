# Design decisions

Choices made while building Picsall that could reasonably have gone another
way. Each one says why it was made and what would be a good reason to revisit it.

## How the scan works

### Transparent canvas stacked on the live video
The `<video>` plays full screen, with a canvas on top that starts transparent.
Each camera frame copies only the newly scanned lines onto the canvas. The canvas is
both the display and the final picture, so there's no per-frame redraw of the
whole screen and no separate compositing step.
**Revisit if** we want effects on the live part (filters, say), which would
need everything drawn into one canvas or WebGL.

### Two clocks: camera frames capture, animation frames animate
Each new camera frame (`requestVideoFrameCallback`) works out how many lines
should be done by now and stamps the missing ones. Capturing per camera frame,
rather than per screen refresh, means each stamp is a different moment, which is
what makes blending work (below). Animation frames move the scan line smoothly
and end the scan exactly on time, so the total time is honoured even if the
camera stalls. If no camera frame arrives for 250ms they capture anyway.
Browsers without frame callbacks capture on every animation frame instead,
which still works, but blends between some identical frames.

### Fast scans: steps, and blending them away
A camera delivers 30 or 60 distinct moments a second, so each frame has to fill a
band of lines, and anything moving shows a step at each band's edge. For 1080
lines the step is 36 lines on a 1s scan at 30fps, 7 at 5s, and under one line
from about 36s. (An earlier version of this file said 18 for 1s at 30fps, which
was per screen refresh, not per camera frame.)

Three things shrink the steps:

- **Asking for 60fps** halves them on cameras that can do it (see below).
- **Blending:** each new band also reaches back over lines already captured and
  fades in across them, from transparent to solid. With the fade spanning
  exactly the previous band, every line becomes a mix of the two camera frames
  nearest its moment, and the steps disappear. In a test with a smooth brightness
  ramp, the biggest jump between neighbouring lines fell from 8 levels to 2-3,
  and the hard step edges went from 29 to 0.
- **The smoothness setting** picks how many bands back the fade reaches:
  Sharp 0, which is the original hard slices, Smooth 1 (the default), Softer 2,
  and Dreamy 3, which smears like motion blur.

The fade spans the bands' real start lines, not a fixed width, so it stays
seamless when the frame rate wobbles or drops in low light.

**Limits:** blending adds no new information. A fast-moving edge becomes a
soft, ghosted staircase, with two faint copies cross-fading, rather than a clean
diagonal. Only generating in-between frames from estimated motion (optical flow)
could fix that, and it was judged too big and too likely to warp faces.
On slow scans, Smooth half-blends each line with the one before it. That's barely
visible, but strictly speaking the line is no longer a single moment.
**Revisit if** Smooth looks wrong as the default, or Dreamy isn't dreamy enough.
Wider levels are just more stops in `SMOOTHNESS_STOPS` in `settings.js`.

### Stamps go through a full-size offscreen canvas
Each stamp is drawn from video to an offscreen canvas, where the fade is masked
in, then onto the picture. A canvas only as big as the band would use less
memory, but measured in headless Chromium it made no difference to frame
pacing, so the simpler version stayed. Neither has been profiled on a real
phone.
**Revisit if** scans stutter on low-end phones.

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
Much smaller than PNG for camera images, with no obvious loss at
normal viewing. The quality is `JPEG_QUALITY` in `scanner.js`.
**Revisit if** the fine line detail ever looks smeared.

### Asks for 1920x1080 at 60fps
A request, not a guarantee; the camera gives its closest match. 60fps halves the
steps on fast scans. Because the browser weighs resolution and frame rate
together, a camera offering only 1080p at 30fps or 720p at 60fps should keep
1080p at 30. With Chromium's fake camera, 60fps came through at full 1080p. Real
cameras haven't been tested, and decoding 60fps costs more power on phones.
Higher resolution would cost little during the scan, because each frame only
copies a thin band, but it would make the live preview heavier and take more
storage.
**Revisit if** you want bigger prints, or a phone runs hot or drops frames.

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
The throwaway scripts used synthetic camera clips, a brightness ramp and a
moving bar, to measure each line's capture moment directly from the canvas.
Headless Chromium on this machine stalls for up to about 1.4s now and then at
1080p, with or without the blending change, so frame pacing numbers from it
are noise, not a benchmark.
**Revisit if** the scanner starts changing often, since a committed browser test
using Chromium's fake camera flags would be worthwhile then.

### Plain download link, no share sheet
Download is an `<a download>`. On iPhones this saves to Files rather than Photos.
**Revisit if** phones are the main device. The Web Share API would offer "Save
Image".
