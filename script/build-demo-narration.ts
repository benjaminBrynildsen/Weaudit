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

function mux(narrationPath: string, musicPath: string | null) {
  const videoDuration = probeDuration(SOURCE_MP4);
  console.log(`[mux] video duration: ${videoDuration.toFixed(2)}s`);

  const stagingOut = path.join(TMP_DIR, "out.mp4");

  // Build the filter graph. Narration plays at full volume; music
  // sidechains to 0.18× under it (gentle bed). If no music supplied,
  // narration is the only audio track.
  // Narration is shorter than the video; pad it (apad) to the video's
  // exact duration so the encoder doesn't cut the video short. Music,
  // when present, gets clipped to that same duration.
  const dur = videoDuration.toFixed(3);
  if (musicPath) {
    execFileSync("ffmpeg", [
      "-hide_banner", "-y",
      "-i", SOURCE_MP4,
      "-i", narrationPath,
      "-stream_loop", "-1",
      "-i", musicPath,
      "-filter_complex",
      `[1:a]adelay=1500|1500,volume=1.0,apad,atrim=0:${dur}[narr];` +
      `[2:a]volume=0.18,atrim=0:${dur},afade=t=in:st=0:d=1.5,afade=t=out:st=${(videoDuration - 2).toFixed(3)}:d=2[bed];` +
      `[narr][bed]amix=inputs=2:duration=longest:dropout_transition=0[a]`,
      "-map", "0:v", "-map", "[a]",
      "-c:v", "copy",
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
      "-filter_complex", `[1:a]adelay=1500|1500,volume=1.0,apad,atrim=0:${dur}[a]`,
      "-map", "0:v", "-map", "[a]",
      "-c:v", "copy",
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
