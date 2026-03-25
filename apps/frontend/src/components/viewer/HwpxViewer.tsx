"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  url: string;
  L: boolean;
}

interface HwpxParagraph {
  text: string;
  style?: string;
  bold?: boolean;
  fontSize?: number;
}

export function HwpxViewer({ url, L }: Props) {
  const [paragraphs, setParagraphs] = useState<HwpxParagraph[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const JSZip = (await import("jszip")).default;
        const resp = await fetch(url);
        const buf = await resp.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);

        const paras: HwpxParagraph[] = [];

        // Find section XML files
        const sectionFiles = Object.keys(zip.files)
          .filter((n) => n.match(/Contents\/section\d+\.xml/i) || n.match(/content.*\.xml/i))
          .sort();

        // Also try header for styles
        for (const filename of sectionFiles.length > 0 ? sectionFiles : Object.keys(zip.files).filter((n) => n.endsWith(".xml"))) {
          const file = zip.files[filename];
          if (!file || file.dir) continue;

          const xml = await file.async("text");
          const parser = new DOMParser();
          const doc = parser.parseFromString(xml, "text/xml");

          // Try to find text elements with various namespace patterns
          // HWPX uses hp:t or just t tags inside run elements
          const allElements = doc.getElementsByTagName("*");

          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            const tagName = el.localName || el.tagName.split(":").pop() || "";

            // Paragraph-level element
            if (tagName === "p" || tagName === "para") {
              const runs: string[] = [];
              const runElements = el.getElementsByTagName("*");
              let isBold = false;
              let fontSize = 0;

              for (let j = 0; j < runElements.length; j++) {
                const run = runElements[j];
                const runTag = run.localName || run.tagName.split(":").pop() || "";

                if (runTag === "t" || runTag === "text") {
                  const text = run.textContent || "";
                  if (text.trim() && !text.startsWith("^")) {
                    runs.push(text);
                  }
                }
                if (runTag === "charPr" || runTag === "charPrIDRef") {
                  isBold = run.getAttribute("bold") === "1" || run.getAttribute("b") === "1";
                  const sizeAttr = run.getAttribute("sz") || run.getAttribute("size");
                  if (sizeAttr) fontSize = parseInt(sizeAttr) / 100;
                }
              }

              if (runs.length > 0) {
                paras.push({
                  text: runs.join(""),
                  bold: isBold,
                  fontSize: fontSize || undefined,
                });
              }
            }
          }

          // Fallback: if no paragraphs found, extract all text nodes
          if (paras.length === 0) {
            const tElements = doc.querySelectorAll("t");
            tElements.forEach((t) => {
              const text = t.textContent?.trim();
              if (text && text.length > 0 && !text.startsWith("^") && !text.startsWith("(^")) {
                paras.push({ text });
              }
            });
          }

          // Second fallback: all text content
          if (paras.length === 0) {
            const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              const text = walker.currentNode.textContent?.trim();
              if (text && text.length > 1 && !text.startsWith("^") && !text.startsWith("(^") && !/^[\d.]+$/.test(text)) {
                paras.push({ text });
              }
            }
          }
        }

        // Also try PrvText.txt for preview text
        if (paras.length === 0) {
          const prvText = zip.files["Preview/PrvText.txt"] || zip.files["preview/PrvText.txt"];
          if (prvText) {
            const text = await prvText.async("text");
            text.split("\n").forEach((line) => {
              if (line.trim()) paras.push({ text: line.trim() });
            });
          }
        }

        setParagraphs(paras);
      } catch (e: any) {
        setError(e.message || "Failed to load HWPX");
      } finally {
        setLoading(false);
      }
    })();
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-xs text-muted-foreground">{L ? "HWPX 렌더링 중..." : "Rendering HWPX..."}</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-600 p-3">{L ? "HWPX 렌더링 실패:" : "HWPX render failed:"} {error}</p>;
  }

  if (paragraphs.length === 0) {
    return <p className="text-xs text-muted-foreground p-3">{L ? "표시할 내용이 없습니다" : "No content to display"}</p>;
  }

  return (
    <div className="bg-white border rounded-md shadow-inner overflow-y-auto" style={{ maxHeight: "500px" }}>
      <div className="p-6 max-w-[700px] mx-auto space-y-1" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="leading-relaxed"
            style={{
              fontSize: p.fontSize ? `${p.fontSize}pt` : "10.5pt",
              fontWeight: p.bold ? "bold" : "normal",
              lineHeight: 1.8,
            }}
          >
            {p.text}
          </p>
        ))}
      </div>
    </div>
  );
}
