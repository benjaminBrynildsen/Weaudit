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

// 1:17 walkthrough — narration paced for ~71 seconds with 6s of head/tail
// breathing room. Grok TTS @ ~150 wpm: ~177 words target.
const NARRATION = `Welcome to Weaudit. I'll walk you through the auditor workspace.

Drop multiple statements into the bulk audit page, and the engine starts processing them automatically. Each card lights up with the merchant, processor, and the count of findings the moment its scan finishes.

Click Review to open the full-screen workspace. The PDF fills your viewport with side-cushion arrows for paging. The left sidebar lists every Non-PCI fee and downgrade the engine detected, with running totals.

Click any finding to see its details — raw line, volume, rate spread, revenue lost. The PDF stays exactly where you had it. You can delete findings the engine got wrong, or add downgrades it missed using a custom form.

When you're done, hit Mark Reviewed. You're back in the bulk queue, that audit is flagged green, and the next unreviewed one is at the top of your list.

Cohesive, fast, and built for the way auditors actually work.`;

const VOICE_ID = "eve"; // female Grok voice
const GROK_TTS_API = "https://api.x.ai/v1/tts";

async function generateNarration(): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY not set");

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const narrationPath = path.join(TMP_DIR, "narration.mp3");

  console.log(`[grok-tts] generating narration (~${NARRATION.length} chars, voice="${VOICE_ID}")…`);
  const res = await fetch(GROK_TTS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: NARRATION,
      voice_id: VOICE_ID,
      language: "en",
      output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Grok TTS error ${res.status}: ${detail}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(narrationPath, buf);
  console.log(`[grok-tts] wrote ${narrationPath} (${(buf.byteLength / 1024).toFixed(1)} KB)`);
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
