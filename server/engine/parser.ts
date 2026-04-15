import fs from "fs";

// pdf-parse@2 is CJS; we require() it here rather than using ESM
// import syntax + createRequire(import.meta.url). The latter breaks
// because esbuild bundles this server to CJS (format: "cjs" in
// script/build.ts), and in CJS `import.meta.url` evaluates to
// undefined at runtime, causing createRequire(undefined) to throw.
// The native CJS `require` is already available in the bundled output.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse");

export interface ParsedPage {
  pageNum: number;
  text: string;
}

export interface ParseResult {
  fullText: string;
  pages: ParsedPage[];
  numPages: number;
}

export async function parsePdf(filePath: string): Promise<ParseResult> {
  const buffer = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(buffer);
  const parser = new PDFParse(uint8);
  await parser.load();

  const info = await parser.getInfo();
  const numPages: number = info.total || 1;

  const textResult = await parser.getText();
  const rawPages: { text: string }[] = textResult?.pages || [];

  const pages: ParsedPage[] = rawPages.map((p, i) => ({
    pageNum: i + 1,
    text: (p.text || "").trim(),
  }));

  const fullText = pages.map((p) => p.text).join("\n\f\n");

  parser.destroy();

  return {
    fullText,
    pages,
    numPages,
  };
}
