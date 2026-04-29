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

const SOURCE_MP4 = "/home/wolfgang/Weaudit/client/public/demos/workspace-walkthrough.mp4";
const OUTPUT_MP4 = SOURCE_MP4; // overwrite in place at the end
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
type ZoomKey = { zoom: number; cx: number; cy: number };
const ZOOM_PLAN: ZoomKey[] = [
  { zoom: 1.0, cx: 0.5, cy: 0.5 },   // 0: "Welcome to Weaudit." — overview
  { zoom: 1.12, cx: 0.5, cy: 0.5 },  // 1: bulk audit page — slight push-in
  { zoom: 1.40, cx: 0.78, cy: 0.55 },// 2: "Click Review" — bulk card right side
  { zoom: 1.35, cx: 0.18, cy: 0.55 },// 3: "Click any finding" — sidebar / left
  { zoom: 1.50, cx: 0.88, cy: 0.12 },// 4: "Mark Reviewed" — top-right toolbar
  { zoom: 1.05, cx: 0.5, cy: 0.5 },  // 5: outro — slowly pull back
];
// Tail framing for the silent stretch after the last narration chunk
// (the source video is 1:17, narration ends ~1:08-ish).
const TAIL_FRAME: ZoomKey = { zoom: 1.0, cx: 0.5, cy: 0.5 };

const VIDEO_W = 1920;
const VIDEO_H = 1080;
const ADELAY_S = 1.5; // narration starts 1.5s into the video

function buildZoomFilter(chunkSegPaths: string[], videoDuration: number): string {
  // Boundary times (video-relative) where the zoom switches.
  const cuts: { t: number; key: ZoomKey }[] = [{ t: 0, key: { zoom: 1.0, cx: 0.5, cy: 0.5 } }];
  let acc = ADELAY_S;
  for (let i = 0; i < chunkSegPaths.length; i++) {
    cuts.push({ t: acc, key: ZOOM_PLAN[i] ?? TAIL_FRAME });
    acc += probeDuration(chunkSegPaths[i]);
  }
  cuts.push({ t: acc, key: TAIL_FRAME });

  // Build piecewise step expressions for crop_w / crop_h / crop_x / crop_y.
  // Hard cuts; smoothing left for a future pass to keep the filter
  // graph readable.
  const ifChain = (pickAt: (k: ZoomKey) => number, fallback: number): string => {
    let expr = `${fallback}`;
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i].t.toFixed(3);
      const b = cuts[i + 1].t.toFixed(3);
      const v = pickAt(cuts[i].key).toFixed(4);
      expr = `if(between(t,${a},${b}),${v},${expr})`;
    }
    return expr;
  };

  const cwExpr = ifChain((k) => VIDEO_W / k.zoom, VIDEO_W);
  const chExpr = ifChain((k) => VIDEO_H / k.zoom, VIDEO_H);
  // Center the crop on (cx, cy), then clamp so the window stays inside the frame.
  const cxExpr = ifChain((k) => {
    const cw = VIDEO_W / k.zoom;
    return Math.max(0, Math.min(VIDEO_W - cw, k.cx * VIDEO_W - cw / 2));
  }, 0);
  const cyExpr = ifChain((k) => {
    const ch = VIDEO_H / k.zoom;
    return Math.max(0, Math.min(VIDEO_H - ch, k.cy * VIDEO_H - ch / 2));
  }, 0);

  // crop produces a smaller frame; scale puts it back to 1920x1080.
  return `crop=w='${cwExpr}':h='${chExpr}':x='${cxExpr}':y='${cyExpr}',scale=${VIDEO_W}:${VIDEO_H}:flags=lanczos,setsar=1`;
}

function mux(narrationPath: string, musicPath: string | null) {
  const videoDuration = probeDuration(SOURCE_MP4);
  console.log(`[mux] video duration: ${videoDuration.toFixed(2)}s`);

  const stagingOut = path.join(TMP_DIR, "out.mp4");

  // Build the per-narration-chunk zoom filter so the video pushes in
  // on the click moments instead of staying flat.
  const segPaths = NARRATION.map((_, i) => path.join(TMP_DIR, `seg-${i}.wav`));
  const zoomFilter = buildZoomFilter(segPaths, videoDuration);

  const dur = videoDuration.toFixed(3);
  if (musicPath) {
    execFileSync("ffmpeg", [
      "-hide_banner", "-y",
      "-i", SOURCE_MP4,
      "-i", narrationPath,
      "-stream_loop", "-1",
      "-i", musicPath,
      "-filter_complex",
      `[0:v]${zoomFilter}[v];` +
      `[1:a]adelay=1500|1500,volume=1.0,apad,atrim=0:${dur}[narr];` +
      `[2:a]volume=0.18,atrim=0:${dur},afade=t=in:st=0:d=1.5,afade=t=out:st=${(videoDuration - 2).toFixed(3)}:d=2[bed];` +
      `[narr][bed]amix=inputs=2:duration=longest:dropout_transition=0[a]`,
      "-map", "[v]", "-map", "[a]",
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
      `[0:v]${zoomFilter}[v];` +
      `[1:a]adelay=1500|1500,volume=1.0,apad,atrim=0:${dur}[a]`,
      "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-t", dur,
      "-movflags", "+faststart",
      stagingOut,
    ], { stdio: "inherit" });
  }

  fs.copyFileSync(stagingOut, OUTPUT_MP4);
  console.log(`[mux] wrote ${OUTPUT_MP4}`);
}

async function main() {
  const narrationPath = await generateNarration();
  // Music path is optional — if MUSIC_PATH env is set, use it.
  const musicPath = process.env.MUSIC_PATH || null;
  if (musicPath && !fs.existsSync(musicPath)) {
    console.warn(`[mux] MUSIC_PATH not found at ${musicPath}; muxing narration only.`);
    mux(narrationPath, null);
  } else {
    mux(narrationPath, musicPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
