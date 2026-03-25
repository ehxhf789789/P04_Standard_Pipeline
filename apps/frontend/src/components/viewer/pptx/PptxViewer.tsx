"use client";

import React, { useState, useEffect } from "react";
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";

interface Slide {
  index: number;
  texts: SlideText[];
  images: string[]; // base64 data URLs
  notes?: string;
  background?: string;
}

interface SlideText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  alignment?: string;
}

interface Props {
  url: string;
}

export function PptxDocViewer({ url }: Props) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.7);
  const [slideWidth, setSlideWidth] = useState(960);
  const [slideHeight, setSlideHeight] = useState(540);

  useEffect(() => {
    loadPptx();
  }, [url]);

  const loadPptx = async () => {
    try {
      const JSZip = (await import("jszip")).default;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);

      // Parse presentation.xml for slide size
      const presXml = zip.files["ppt/presentation.xml"];
      if (presXml) {
        const xml = await presXml.async("text");
        const doc = new DOMParser().parseFromString(xml, "text/xml");
        const sldSz = doc.querySelector("sldSz");
        if (sldSz) {
          const cx = parseInt(sldSz.getAttribute("cx") || "0", 10);
          const cy = parseInt(sldSz.getAttribute("cy") || "0", 10);
          if (cx > 0) setSlideWidth(Math.round(cx / 12700));
          if (cy > 0) setSlideHeight(Math.round(cy / 12700));
        }
      }

      // Extract images
      const images = new Map<string, string>();
      for (const [path, file] of Object.entries(zip.files)) {
        if (path.startsWith("ppt/media/") && !file.dir) {
          const ext = path.split(".").pop()?.toLowerCase() || "png";
          const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", emf: "image/emf", wmf: "image/wmf" }[ext] || "image/png";
          const data = await file.async("base64");
          const name = path.split("/").pop() || "";
          images.set(name, `data:${mime};base64,${data}`);
        }
      }

      // Parse slides
      const slideFiles = Object.keys(zip.files)
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => {
          const na = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
          const nb = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
          return na - nb;
        });

      const parsedSlides: Slide[] = [];

      for (let si = 0; si < slideFiles.length; si++) {
        const xml = await zip.files[slideFiles[si]].async("text");
        const doc = new DOMParser().parseFromString(xml, "text/xml");
        const texts: SlideText[] = [];
        const slideImages: string[] = [];

        // Parse all shape trees
        const spElements = doc.querySelectorAll("sp");
        spElements.forEach((sp) => {
          // Position
          const off = sp.querySelector("off");
          const ext = sp.querySelector("ext");
          const x = off ? Math.round(parseInt(off.getAttribute("x") || "0") / 12700) : 0;
          const y = off ? Math.round(parseInt(off.getAttribute("y") || "0") / 12700) : 0;
          const w = ext ? Math.round(parseInt(ext.getAttribute("cx") || "0") / 12700) : 200;
          const h = ext ? Math.round(parseInt(ext.getAttribute("cy") || "0") / 12700) : 50;

          // Text
          const paragraphs = sp.querySelectorAll("p");
          let fullText = "";
          let fontSize = 18;
          let bold = false;
          let italic = false;
          let color = "";
          let alignment = "left";

          paragraphs.forEach((p) => {
            const pPr = p.querySelector("pPr");
            if (pPr) {
              const algn = pPr.getAttribute("algn");
              if (algn === "ctr") alignment = "center";
              else if (algn === "r") alignment = "right";
            }

            const runs = p.querySelectorAll("r");
            runs.forEach((r) => {
              const rPr = r.querySelector("rPr");
              if (rPr) {
                const sz = rPr.getAttribute("sz");
                if (sz) fontSize = Math.round(parseInt(sz) / 100);
                bold = rPr.getAttribute("b") === "1";
                italic = rPr.getAttribute("i") === "1";
                const solidFill = rPr.querySelector("solidFill");
                if (solidFill) {
                  const srgb = solidFill.querySelector("srgbClr");
                  if (srgb) color = `#${srgb.getAttribute("val")}`;
                }
              }
              const t = r.querySelector("t");
              if (t?.textContent) fullText += t.textContent;
            });
            fullText += "\n";
          });

          if (fullText.trim()) {
            texts.push({ text: fullText.trim(), x, y, width: w, height: h, fontSize, bold, italic, color: color || "#333", alignment });
          }
        });

        // Parse image references
        const picElements = doc.querySelectorAll("pic");
        picElements.forEach((pic) => {
          const blipFill = pic.querySelector("blipFill");
          if (blipFill) {
            const blip = blipFill.querySelector("blip");
            if (blip) {
              const embed = blip.getAttribute("r:embed") || blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
              // Resolve relationship to image file
              // For simplicity, try to match by index
            }
          }
        });

        // Parse notes
        let notes = "";
        const notesFile = zip.files[`ppt/notesSlides/notesSlide${si + 1}.xml`];
        if (notesFile) {
          const notesXml = await notesFile.async("text");
          const notesDoc = new DOMParser().parseFromString(notesXml, "text/xml");
          const noteTexts = notesDoc.querySelectorAll("t");
          const parts: string[] = [];
          noteTexts.forEach((t) => { if (t.textContent?.trim()) parts.push(t.textContent.trim()); });
          notes = parts.join(" ");
        }

        parsedSlides.push({ index: si, texts, images: slideImages, notes });
      }

      setSlides(parsedSlides);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 bg-slate-100 rounded-lg">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading PPTX...</span>
      </div>
    );
  }

  if (error || slides.length === 0) {
    return <div className="text-sm text-red-600 p-4 bg-red-50 rounded-lg">{error || "No slides"}</div>;
  }

  const slide = slides[currentSlide];

  return (
    <div className="rounded-lg border overflow-hidden bg-slate-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-orange-600 text-white px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium">PPTX Viewer</span>
          <span className="text-orange-200">{slides.length} slides</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentSlide((s) => Math.max(0, s - 1))} disabled={currentSlide === 0} className="p-1 hover:bg-orange-500 rounded disabled:opacity-30">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono">{currentSlide + 1} / {slides.length}</span>
          <button onClick={() => setCurrentSlide((s) => Math.min(slides.length - 1, s + 1))} disabled={currentSlide === slides.length - 1} className="p-1 hover:bg-orange-500 rounded disabled:opacity-30">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <span className="mx-1 text-orange-300">|</span>
          <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} className="p-1 hover:bg-orange-500 rounded"><ZoomOut className="h-3.5 w-3.5" /></button>
          <span className="font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="p-1 hover:bg-orange-500 rounded"><ZoomIn className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Slide thumbnails */}
      <div className="flex gap-1 p-2 bg-slate-700 overflow-x-auto">
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            className={`flex-shrink-0 w-16 h-10 rounded text-[7px] font-medium flex items-center justify-center ${
              currentSlide === i ? "bg-orange-500 text-white ring-2 ring-orange-300" : "bg-slate-600 text-slate-300 hover:bg-slate-500"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Slide */}
      <div className="overflow-auto p-4 flex justify-center" style={{ maxHeight: "500px" }}>
        <div
          className="relative bg-white shadow-2xl rounded"
          style={{
            width: `${slideWidth * zoom}px`,
            height: `${slideHeight * zoom}px`,
            overflow: "hidden",
          }}
        >
          <div style={{ zoom, width: slideWidth, height: slideHeight, position: "relative" }}>
            {slide.texts.map((t, ti) => (
              <div
                key={ti}
                style={{
                  position: "absolute",
                  left: `${t.x}px`,
                  top: `${t.y}px`,
                  width: `${t.width}px`,
                  maxHeight: `${t.height}px`,
                  overflow: "hidden",
                  fontSize: `${t.fontSize || 14}px`,
                  fontWeight: t.bold ? "bold" : "normal",
                  fontStyle: t.italic ? "italic" : "normal",
                  color: t.color || "#333",
                  textAlign: t.alignment as any || "left",
                  lineHeight: 1.3,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {t.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      {slide.notes && (
        <div className="bg-slate-700 text-slate-300 px-3 py-2 text-[10px] border-t border-slate-600">
          <span className="font-semibold text-slate-400 mr-2">Notes:</span>{slide.notes}
        </div>
      )}
    </div>
  );
}
