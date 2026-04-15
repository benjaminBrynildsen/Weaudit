import fs from "fs";

// pdf-parse@2 is CJS. Prefer the native CJS require (present when
// esbuild bundles this server to CJS); fall back to module.createRequire
// via eval so this file still works when imported under tsx/ESM (e.g.
// validate-audit.ts). The eval keeps esbuild from rewriting the import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
// PDFParse is resolved lazily. In the bundled CJS server, the native
// `require` is used. Under tsx/ESM (e.g. validation scripts), we fall
// back to a dynamic import so the module loads without pulling in
// createRequire + import.meta.url (which esbuild rewrites away when
// bundling to CJS).
let _PDFParse: any;
async function loadPDFParse(): Promise<any> {
  if (_PDFParse) return _PDFParse;
  if (typeof require !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _PDFParse = require("pdf-parse").PDFParse;
  } else {
    const mod = await import("pdf-parse");
    _PDFParse = (mod as any).PDFParse ?? (mod as any).default?.PDFParse;
  }
  return _PDFParse;
}

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
  const PDFParse = await loadPDFParse();
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
