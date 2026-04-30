/**
 * Generate narration audio for the workspace walkthrough using xAI's
 * Grok TTS, then mux it (under a royalty-free music bed) into the
 * source MP4.
 *
 *   XAI_API_KEY=... npx tsx script/build-demo-narration.ts
 *
 * Output: client/public/demos/workspace-walkthrough.mp4 (replaces in
 * place; the previous silent version is overwritten).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Source clip — silent screen recording, no narration. We never
// overwrite this; both output variants are generated from it.
const SOURCE_MP4 = "/tmp/workspace-walkthrough.mp4";
const OUTPUT_ZOOM_MP4 = "/home/wolfgang/Weaudit/client/public/demos/workspace-walkthrough.mp4";
const OUTPUT_NOZOOM_MP4 = "/home/wolfgang/Weaudit/client/public/demos/workspace-walkthrough-no-zoom.mp4";
const TMP_DIR = "/tmp/weaudit-demo";

// Walkthrough narration broken into chunks so we can drop measured
// silence pauses between them. Two spots needed extra breathing room
// because the on-screen action takes longer than the words: just
// before "Click Review" (the auditor needs to see the bulk row
// finish first) and just before "When you're done, hit Mark
// Reviewed" (a beat for the workspace exit to register).
type NarrationChunk = { text: string; pauseAfter: number };
const NARRATION: NarrationChunk[] = [
  {
    text: "Welcome to Weaudit. I'll walk you through the auditor workspace.",
    pauseAfter: 400,
  },
  {
    text: "Drop multiple statements into the bulk audit page, and the engine starts processing them automatically. Each card lights up with the merchant, processor, and the count of findings the moment its scan finishes.",
    pauseAfter: 1500,
  },
  {
    text: "Click Review to open the full-screen workspace. The PDF fills your viewport with side-cushion arrows for paging. The left sidebar lists every Non-PCI fee and downgrade the engine detected, with running totals.",
    pauseAfter: 800,
  },
  {
    text: "Click any finding to see its details — raw line, volume, rate spread, revenue lost. The PDF stays exactly where you had it. You can delete findings the engine got wrong, or add downgrades it missed using a custom form.",
    pauseAfter: 1500,
  },
  {
    text: "When you're done, hit Mark Reviewed. You're back in the bulk queue, that audit is flagged green, and the next unreviewed one is at the top of your list.",
    pauseAfter: 600,
  },
  {
    text: "Cohesive, fast, and built for the way auditors actually work.",
    pauseAfter: 0,
  },
];

const VOICE_ID = "leo"; // Grok male voice
const GROK_TTS_API = "https://api.x.ai/v1/tts";

async function ttsChunk(text: string, voiceId: string, apiKey: string): Promise<Buffer> {
  const res = await fetch(GROK_TTS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      language: "en",
      output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Grok TTS error ${res.status}: ${detail}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function generateNarration(): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY not set");

  fs.mkdirSync(TMP_DIR, { recursive: true });

  // Generate each chunk individually so we can splice silence
  // between them, controlling the per-section pacing.
  console.log(`[grok-tts] voice="${VOICE_ID}", ${NARRATION.length} chunk${NARRATION.length === 1 ? "" : "s"}…`);
  const chunkFiles: string[] = [];
  for (let i = 0; i < NARRATION.length; i++) {
    const chunk = NARRATION[i];
    const buf = await ttsChunk(chunk.text, VOICE_ID, apiKey);
    const chunkMp3 = path.join(TMP_DIR, `chunk-${i}.mp3`);
    fs.writeFileSync(chunkMp3, buf);
    console.log(`  chunk ${i}: ${chunk.text.length} chars → ${(buf.byteLength / 1024).toFixed(1)} KB, pause=${chunk.pauseAfter}ms`);

    // Render each chunk's mp3 + its pause silence into a single wav
    // segment so the concat list is uniform.
    const segWav = path.join(TMP_DIR, `seg-${i}.wav`);
    if (chunk.pauseAfter > 0) {
      execFileSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", chunkMp3,
        "-f", "lavfi", "-t", (chunk.pauseAfter / 1000).toFixed(3),
        "-i", "anullsrc=r=24000:cl=mono",
        "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[a]",
        "-map", "[a]",
        "-ar", "24000", "-ac", "1",
        segWav,
      ]);
    } else {
      execFileSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", chunkMp3,
        "-ar", "24000", "-ac", "1",
        segWav,
      ]);
    }
    chunkFiles.push(segWav);
  }

  // Concat all segments into a single narration mp3.
  const concatList = path.join(TMP_DIR, "concat.txt");
  fs.writeFileSync(concatList, chunkFiles.map((f) => `file '${f}'`).join("\n"));
  const narrationPath = path.join(TMP_DIR, "narration.mp3");
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "concat", "-safe", "0",
    "-i", concatList,
    "-c:a", "libmp3lame", "-b:a", "128k",
    narrationPath,
  ]);
  console.log(`[grok-tts] wrote ${narrationPath}`);
  return narrationPath;
}

function probeDuration(file: string): number {
  const out = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ], { encoding: "utf-8" }).trim();
  return parseFloat(out);
}

/**
 * Per-narration-chunk zoom plan. Indexed to NARRATION array. Each
 * entry is the framing while that chunk is being narrated:
 *   - zoom: 1.0 = full frame, 1.4 ≈ "really up close"
 *   - cx, cy: center of the zoom in original-frame coords (0..1)
 * The video is 1920x1080. The chunk's narration audio defines the
 * time boundary; we add the 1.5s adelay so zooms line up.
 */
// Click-zoom events: each is a 3s punch-in with 0.5s ease in + out
// (= 4s total window) on a click moment. Outside any event window
// the video plays at 1.0x (full frame). Anchored to a narration
// chunk's start + an offset so the zoom lines up with when the
// auditor is actually saying the click word.
type ZoomEvent = {
  chunkIdx: number;
  offsetIntoChunk: number; // seconds after the chunk's narration starts
  peakZoom: number;
  cx: number; // 0..1, target center x in the original frame
  cy: number; // 0..1, target center y
};
const HOLD_SEC = 3.0;
const EASE_SEC = 0.5;
const ZOOM_EVENTS: ZoomEvent[] = [
  // chunk 2: "Click Review to open the full-screen workspace…"
  // Review button on the top Audit Queue row (right side, lower-mid).
  { chunkIdx: 2, offsetIntoChunk: 1.0, peakZoom: 5.0, cx: 0.85, cy: 0.62 },
  // chunk 3: "Click any finding to see its details…"
  // The recording shows the PDF view rather than the sidebar; aim at
  // the PDF content area as the closest equivalent on-screen anchor.
  { chunkIdx: 3, offsetIntoChunk: 1.0, peakZoom: 4.0, cx: 0.55, cy: 0.55 },
  // chunk 4: "When you're done, hit Mark Reviewed."
  // Top toolbar area.
  { chunkIdx: 4, offsetIntoChunk: 1.0, peakZoom: 5.0, cx: 0.50, cy: 0.10 },
];

const VIDEO_W = 1920;
const VIDEO_H = 1080;
const ADELAY_S = 1.5; // narration starts 1.5s into the video

/**
 * Build a smooth-zoom filter chain. Each ZOOM_EVENT becomes a
 * 0.5s ease-in → 3s hold → 0.5s ease-out punch-in centered on
 * (cx, cy). Outside event windows the video plays at 1.0x.
 *
 * Implementation: scale=eval=frame lets us animate the scale
 * factor per-frame; crop pulls the 1920×1080 window so it stays
 * centered on the chosen target.
 */
function buildSmoothZoomFilter(chunkSegPaths: string[]): string {
  // Resolve each event's video-relative time window.
  const chunkStartTimes: number[] = [];
  let acc = ADELAY_S;
  for (let i = 0; i < chunkSegPaths.length; i++) {
    chunkStartTimes.push(acc);
    acc += probeDuration(chunkSegPaths[i]);
  }
  type Resolved = { tStart: number; tEnd: number; peakZoom: number; cx: number; cy: number };
  const events: Resolved[] = ZOOM_EVENTS.map((ev) => {
    const tStart = chunkStartTimes[ev.chunkIdx] + ev.offsetIntoChunk;
    const tEnd = tStart + EASE_SEC + HOLD_SEC + EASE_SEC;
    return { tStart, tEnd, peakZoom: ev.peakZoom, cx: ev.cx, cy: ev.cy };
  });

  // Z(t) — current zoom factor, default 1.0.
  // Within an event:
  //   ramp up over EASE_SEC, hold for HOLD_SEC, ramp down over EASE_SEC.
  let zExpr = "1";
  for (const ev of events) {
    const t1 = ev.tStart.toFixed(3);
    const t2 = (ev.tStart + EASE_SEC).toFixed(3);
    const t3 = (ev.tStart + EASE_SEC + HOLD_SEC).toFixed(3);
    const t4 = ev.tEnd.toFixed(3);
    const z = ev.peakZoom.toFixed(3);
    zExpr =
      `if(between(t,${t1},${t2}),1+(${z}-1)*(t-${t1})/${EASE_SEC.toFixed(3)},` +
      `if(between(t,${t2},${t3}),${z},` +
      `if(between(t,${t3},${t4}),1+(${z}-1)*(${t4}-t)/${EASE_SEC.toFixed(3)},` +
      `${zExpr})))`;
  }

  // cx(t), cy(t) — pick the active event's target; 0.5 (center) elsewhere.
  let cxExpr = "0.5";
  let cyExpr = "0.5";
  for (const ev of events) {
    const t1 = ev.tStart.toFixed(3);
    const t4 = ev.tEnd.toFixed(3);
    cxExpr = `if(between(t,${t1},${t4}),${ev.cx.toFixed(4)},${cxExpr})`;
    cyExpr = `if(between(t,${t1},${t4}),${ev.cy.toFixed(4)},${cyExpr})`;
  }

  // After scale by Z, the original pixel at (cx*W, cy*H) sits at
  // (cx*W*Z, cy*H*Z). Crop a W×H window centered on it:
  //   x = cx*W*Z - W/2,  y = cy*H*Z - H/2
  // Clamp x ∈ [0, W*(Z-1)] and y ∈ [0, H*(Z-1)] so the window stays
  // inside the scaled frame.
  const W = VIDEO_W;
  const H = VIDEO_H;
  const xClamp = `max(0,min(${W}*((${zExpr})-1),(${cxExpr})*${W}*(${zExpr})-${W / 2}))`;
  const yClamp = `max(0,min(${H}*((${zExpr})-1),(${cyExpr})*${H}*(${zExpr})-${H / 2}))`;

  return (
    `[0:v]scale=w='${W}*(${zExpr})':h='${H}*(${zExpr})':eval=frame:flags=lanczos,` +
    `crop=${W}:${H}:'${xClamp}':'${yClamp}',setsar=1[zoomed]`
  );
}

function mux(narrationPath: string, musicPath: string | null, applyZoom: boolean, outputPath: string) {
  const videoDuration = probeDuration(SOURCE_MP4);
  console.log(`[mux] zoom=${applyZoom} → ${path.basename(outputPath)}`);

  const stagingOut = path.join(TMP_DIR, applyZoom ? "out.mp4" : "out-nozoom.mp4");

  // Build either the smooth event-based zoom filter, or a pass-through.
  const segPaths = NARRATION.map((_, i) => path.join(TMP_DIR, `seg-${i}.wav`));
  const zoomFilter = applyZoom
    ? buildSmoothZoomFilter(segPaths)
    : `[0:v]copy[zoomed]`;

  const dur = videoDuration.toFixed(3);
  if (musicPath) {
    execFileSync("ffmpeg", [
      "-hide_banner", "-y",
      "-i", SOURCE_MP4,
      "-i", narrationPath,
      "-stream_loop", "-1",
      "-i", musicPath,
      "-filter_complex",
      `${zoomFilter};` +
      `[1:a]adelay=1500|1500,volume=1.0,apad,atrim=0:${dur}[narr];` +
      `[2:a]volume=0.18,atrim=0:${dur},afade=t=in:st=0:d=1.5,afade=t=out:st=${(videoDuration - 2).toFixed(3)}:d=2[bed];` +
      `[narr][bed]amix=inputs=2:duration=longest:dropout_transition=0[a]`,
      "-map", "[zoomed]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-t", dur,
      "-movflags", "+faststart",
      stagingOut,
    ], { stdio: "inherit" });
  } else {
    execFileSync("ffmpeg", [
      "-hide_banner", "-y",
      "-i", SOURCE_MP4,
      "-i", narrationPath,
      "-filter_complex",
      `${zoomFilter};` +
      `[1:a]adelay=1500|1500,volume=1.0,apad,atrim=0:${dur}[a]`,
      "-map", "[zoomed]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-t", dur,
      "-movflags", "+faststart",
      stagingOut,
    ], { stdio: "inherit" });
  }

  fs.copyFileSync(stagingOut, outputPath);
  console.log(`[mux] wrote ${outputPath}`);
}

async function main() {
  const narrationPath = await generateNarration();
  // Music path is optional — if MUSIC_PATH env is set, use it.
  let musicPath: string | null = process.env.MUSIC_PATH || null;
  if (musicPath && !fs.existsSync(musicPath)) {
    console.warn(`[mux] MUSIC_PATH not found at ${musicPath}; muxing narration only.`);
    musicPath = null;
  }
  // Render both versions: with click-zoom punches, and without (pure
  // narration over the original framing). The Demos page lists both.
  mux(narrationPath, musicPath, true, OUTPUT_ZOOM_MP4);
  mux(narrationPath, musicPath, false, OUTPUT_NOZOOM_MP4);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
