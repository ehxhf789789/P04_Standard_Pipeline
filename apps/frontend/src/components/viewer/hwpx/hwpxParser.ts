/**
 * HWPX Parser - Extracts structured content from HWPX XML
 * Ported from P01_Notology with simplifications for web viewer
 */

import {
  HWPUNIT_PER_PIXEL,
  HwpxSection,
  HwpxContentItem,
  HwpxParagraph,
  HwpxTextRun,
  HwpxTable,
  HwpxTableRow,
  HwpxTableCell,
  HwpxImage,
} from "./types";

function hu(val: string | null | undefined): number {
  if (!val) return 0;
  return Math.round(parseInt(val, 10) / HWPUNIT_PER_PIXEL);
}

function getAttr(el: Element, name: string): string | null {
  // Try with and without namespace prefix
  return el.getAttribute(name) || el.getAttributeNS(null, name);
}

function findChild(el: Element, localName: string): Element | null {
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
    const tag = child.localName || child.tagName.split(":").pop() || "";
    if (tag === localName) return child;
  }
  return null;
}

function findChildren(el: Element, localName: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
    const tag = child.localName || child.tagName.split(":").pop() || "";
    if (tag === localName) result.push(child);
  }
  return result;
}

function findDescendants(el: Element, localName: string): Element[] {
  const result: Element[] = [];
  const all = el.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    const tag = all[i].localName || all[i].tagName.split(":").pop() || "";
    if (tag === localName) result.push(all[i]);
  }
  return result;
}

export function parseSectionXml(xml: string): HwpxSection {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const root = doc.documentElement;

  // Page dimensions
  let pageWidth = 595; // A4 default
  let pageHeight = 842;
  let marginTop = 56;
  let marginBottom = 56;
  let marginLeft = 56;
  let marginRight = 56;

  // Try to find page properties
  const pagePr = findDescendants(root, "pagePr")[0] || findDescendants(root, "secPr")[0];
  if (pagePr) {
    const landscape = getAttr(pagePr, "landscape") === "1";
    const w = hu(getAttr(pagePr, "width") || getAttr(pagePr, "w"));
    const h = hu(getAttr(pagePr, "height") || getAttr(pagePr, "h"));
    if (w > 0) pageWidth = w;
    if (h > 0) pageHeight = h;
    if (landscape && pageWidth < pageHeight) {
      [pageWidth, pageHeight] = [pageHeight, pageWidth];
    }
  }

  const marginEl = findDescendants(root, "pageMargin")[0] || findDescendants(root, "margin")[0];
  if (marginEl) {
    const t = hu(getAttr(marginEl, "top") || getAttr(marginEl, "t"));
    const b = hu(getAttr(marginEl, "bottom") || getAttr(marginEl, "b"));
    const l = hu(getAttr(marginEl, "left") || getAttr(marginEl, "l"));
    const r = hu(getAttr(marginEl, "right") || getAttr(marginEl, "r"));
    if (t > 0) marginTop = t;
    if (b > 0) marginBottom = b;
    if (l > 0) marginLeft = l;
    if (r > 0) marginRight = r;
  }

  // Parse content
  const content = parseContentItems(root);

  return {
    pageWidth, pageHeight,
    marginTop, marginBottom, marginLeft, marginRight,
    content,
  };
}

function parseContentItems(parent: Element): HwpxContentItem[] {
  const items: HwpxContentItem[] = [];

  // Find all paragraph elements
  const paragraphs = findChildren(parent, "p");
  if (paragraphs.length === 0) {
    // Try body > p
    const body = findChild(parent, "body");
    if (body) {
      paragraphs.push(...findChildren(body, "p"));
    }
  }

  for (const pEl of paragraphs) {
    // Check for table inside paragraph
    const tableEl = findChild(pEl, "tbl") || findDescendants(pEl, "tbl")[0];
    if (tableEl) {
      const table = parseTable(tableEl);
      if (table) items.push(table);
      continue;
    }

    // Check for image
    const picEl = findDescendants(pEl, "pic")[0] || findDescendants(pEl, "img")[0] || findDescendants(pEl, "drawingImg")[0];
    if (picEl) {
      const img = parseImage(picEl);
      if (img) items.push(img);
      // Still parse text in same paragraph
    }

    // Parse paragraph
    const para = parseParagraph(pEl);
    if (para && (para.runs.length > 0 || para.pageBreak)) {
      items.push(para);
    }
  }

  // Fallback: if no structured paragraphs, try all text runs directly
  if (items.length === 0) {
    const allRuns = findDescendants(parent, "run");
    if (allRuns.length > 0) {
      const runs: HwpxTextRun[] = [];
      for (const runEl of allRuns) {
        const tEl = findChild(runEl, "t");
        if (tEl && tEl.textContent?.trim()) {
          const text = tEl.textContent.trim();
          if (!text.startsWith("^") && !text.startsWith("(^")) {
            const charPr = findChild(runEl, "charPr") || findDescendants(runEl, "charPr")[0];
            runs.push(parseTextRun(text, charPr));
          }
        }
      }
      if (runs.length > 0) {
        // Group into paragraphs by line breaks
        let currentRuns: HwpxTextRun[] = [];
        for (const run of runs) {
          if (run.text.includes("\n")) {
            const parts = run.text.split("\n");
            for (let i = 0; i < parts.length; i++) {
              if (parts[i].trim()) {
                currentRuns.push({ ...run, text: parts[i].trim() });
              }
              if (i < parts.length - 1 && currentRuns.length > 0) {
                items.push({ type: "paragraph", runs: currentRuns });
                currentRuns = [];
              }
            }
          } else {
            currentRuns.push(run);
          }
        }
        if (currentRuns.length > 0) {
          items.push({ type: "paragraph", runs: currentRuns });
        }
      }
    }
  }

  // Second fallback: all t tags
  if (items.length === 0) {
    const tElements = findDescendants(parent, "t");
    const runs: HwpxTextRun[] = [];
    for (const t of tElements) {
      const text = t.textContent?.trim();
      if (text && text.length > 0 && !text.startsWith("^") && !/^\(\^/.test(text)) {
        runs.push({ text });
      }
    }
    // Group every 1-3 runs into a paragraph
    for (let i = 0; i < runs.length; i++) {
      items.push({ type: "paragraph", runs: [runs[i]] });
    }
  }

  return items;
}

function parseParagraph(pEl: Element): HwpxParagraph {
  const runs: HwpxTextRun[] = [];
  let alignment: HwpxParagraph["alignment"] = "left";
  let lineSpacing: number | undefined;
  let indent: number | undefined;
  let marginTop: number | undefined;
  let marginBottom: number | undefined;
  let pageBreak = false;

  // Paragraph properties
  const paraPr = findChild(pEl, "paraPr") || findDescendants(pEl, "paraPr")[0];
  if (paraPr) {
    const align = getAttr(paraPr, "align") || getAttr(paraPr, "alignment");
    if (align) {
      const alignMap: Record<string, HwpxParagraph["alignment"]> = {
        left: "left", center: "center", right: "right",
        justify: "justify", both: "justify", distribute: "distribute",
      };
      alignment = alignMap[align.toLowerCase()] || "left";
    }

    const spacing = findChild(paraPr, "spacing") || findDescendants(paraPr, "lineSpacing")[0];
    if (spacing) {
      const ls = getAttr(spacing, "line") || getAttr(spacing, "val");
      if (ls) lineSpacing = parseInt(ls, 10);
      const before = getAttr(spacing, "before");
      const after = getAttr(spacing, "after");
      if (before) marginTop = hu(before);
      if (after) marginBottom = hu(after);
    }

    const ind = findChild(paraPr, "indent");
    if (ind) {
      const left = getAttr(ind, "left") || getAttr(ind, "start");
      if (left) indent = hu(left);
    }
  }

  // Check for page break
  if (getAttr(pEl, "pageBreak") === "1" || getAttr(pEl, "break") === "page") {
    pageBreak = true;
  }

  // Parse runs
  const runElements = findChildren(pEl, "run");
  for (const runEl of runElements) {
    const tEl = findChild(runEl, "t");
    if (!tEl || !tEl.textContent) continue;

    const text = tEl.textContent;
    if (text.trim().startsWith("^") || /^\(\^/.test(text.trim())) continue;

    const charPr = findChild(runEl, "charPr") || findDescendants(runEl, "charPr")[0];
    runs.push(parseTextRun(text, charPr));
  }

  // If no runs found via run elements, try direct t tags
  if (runs.length === 0) {
    const tElements = findDescendants(pEl, "t");
    for (const t of tElements) {
      const text = t.textContent?.trim();
      if (text && !text.startsWith("^") && !/^\(\^/.test(text)) {
        // Check parent for char properties
        const parent = t.parentElement;
        const charPr = parent ? (findChild(parent, "charPr") || findDescendants(parent, "charPr")[0]) : null;
        runs.push(parseTextRun(text, charPr));
      }
    }
  }

  return {
    type: "paragraph",
    runs,
    alignment,
    lineSpacing,
    indent,
    marginTop,
    marginBottom,
    pageBreak,
  };
}

function parseTextRun(text: string, charPr: Element | null): HwpxTextRun {
  const run: HwpxTextRun = { text };

  if (!charPr) return run;

  if (getAttr(charPr, "bold") === "1" || getAttr(charPr, "b") === "1") run.bold = true;
  if (getAttr(charPr, "italic") === "1" || getAttr(charPr, "i") === "1") run.italic = true;
  if (getAttr(charPr, "underline") === "1" || getAttr(charPr, "u")) run.underline = true;
  if (getAttr(charPr, "strikeout") === "1" || getAttr(charPr, "strike")) run.strikethrough = true;
  if (getAttr(charPr, "supscript") === "1" || getAttr(charPr, "vertAlign") === "superscript") run.superscript = true;
  if (getAttr(charPr, "subscript") === "1" || getAttr(charPr, "vertAlign") === "subscript") run.subscript = true;

  const sz = getAttr(charPr, "sz") || getAttr(charPr, "size");
  if (sz) run.fontSize = parseInt(sz, 10) / 100;

  const fontFace = findChild(charPr, "fontRef") || findChild(charPr, "face");
  if (fontFace) {
    const face = getAttr(fontFace, "hangul") || getAttr(fontFace, "latin") || getAttr(fontFace, "val");
    if (face) run.fontFamily = face;
  }

  const color = getAttr(charPr, "color") || getAttr(charPr, "textColor");
  if (color && color !== "000000" && color !== "#000000") {
    run.color = color.startsWith("#") ? color : `#${color}`;
  }

  return run;
}

function parseTable(tblEl: Element): HwpxTable | null {
  const rows: HwpxTableRow[] = [];
  const trElements = findChildren(tblEl, "tr") || findDescendants(tblEl, "row");

  for (const trEl of trElements) {
    const cells: HwpxTableCell[] = [];
    const tcElements = findChildren(trEl, "tc") || findChildren(trEl, "cell");

    for (const tcEl of tcElements) {
      const content: HwpxParagraph[] = [];
      const pElements = findDescendants(tcEl, "p");

      for (const pEl of pElements) {
        const para = parseParagraph(pEl);
        if (para.runs.length > 0) content.push(para);
      }

      const colspan = parseInt(getAttr(tcEl, "colSpan") || getAttr(tcEl, "gridSpan") || "1", 10);
      const rowspan = parseInt(getAttr(tcEl, "rowSpan") || "1", 10);

      // Cell properties
      const cellPr = findChild(tcEl, "cellPr") || findDescendants(tcEl, "tcPr")[0];
      let backgroundColor: string | undefined;
      if (cellPr) {
        const fill = findChild(cellPr, "fillBrush") || findDescendants(cellPr, "shd")[0];
        if (fill) {
          const bgColor = getAttr(fill, "winColor") || getAttr(fill, "fill") || getAttr(fill, "color");
          if (bgColor && bgColor !== "ffffff" && bgColor !== "auto") {
            backgroundColor = bgColor.startsWith("#") ? bgColor : `#${bgColor}`;
          }
        }
      }

      cells.push({ content, colspan, rowspan, backgroundColor });
    }

    if (cells.length > 0) rows.push({ cells });
  }

  if (rows.length === 0) return null;

  // Column widths
  const colWidths: number[] = [];
  const colGroup = findDescendants(tblEl, "gridCol") || findDescendants(tblEl, "colSz");
  for (const col of colGroup) {
    const w = hu(getAttr(col, "w") || getAttr(col, "width") || getAttr(col, "val"));
    if (w > 0) colWidths.push(w);
  }

  return { type: "table", rows, colWidths: colWidths.length > 0 ? colWidths : undefined };
}

function parseImage(picEl: Element): HwpxImage | null {
  // Try to find image reference
  const imgEl = findDescendants(picEl, "img")[0] || findDescendants(picEl, "imageRect")[0] || picEl;
  const binItem = findDescendants(picEl, "binItem")[0] || findDescendants(picEl, "binItemIDRef")[0];

  let imageId = getAttr(imgEl, "binaryItemIDRef") || getAttr(binItem, "id") || getAttr(picEl, "id") || "";
  if (!imageId) return null;

  // Size
  const sz = findDescendants(picEl, "sz")[0] || findDescendants(picEl, "size")[0];
  let width: number | undefined;
  let height: number | undefined;
  if (sz) {
    width = hu(getAttr(sz, "width") || getAttr(sz, "cx"));
    height = hu(getAttr(sz, "height") || getAttr(sz, "cy"));
  }

  return {
    type: "image",
    src: imageId, // Will be resolved later
    width,
    height,
  };
}
