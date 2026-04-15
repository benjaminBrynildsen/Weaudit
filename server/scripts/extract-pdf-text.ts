import { parsePdf } from "./server/engine/parser";
import path from "path";

async function extract() {
  const pdfPath = path.resolve("attached_assets/PATRIOT_FLOORING_SUPPLIES_-_737191920880_December_LOCATION_1769807366701.pdf");
  const result = await parsePdf(pdfPath);

  console.log("Looking for interchange lines with BUS, PRODUCT, PRD, TR patterns:\n");
  const lines = result.fullText.split("\n").filter(l =>
    (/BUS|PRODUCT|PRD|TR\d|LEVEL/i.test(l) || /VI-|MC-/.test(l)) &&
    l.trim().length > 20
  );

  lines.slice(0, 30).forEach((line, i) => {
    console.log(`${i + 1}. ${line}`);
  });
}

extract().catch(console.error);
