// HWPX Document Types

export const HWPUNIT_PER_PIXEL = 28;

export interface HwpxDocument {
  sections: HwpxSection[];
  images: Map<string, string>; // id -> base64 data URL
}

export interface HwpxSection {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  content: HwpxContentItem[];
  header?: HwpxContentItem[];
  footer?: HwpxContentItem[];
}

export type HwpxContentItem =
  | HwpxParagraph
  | HwpxTable
  | HwpxImage;

export interface HwpxParagraph {
  type: "paragraph";
  runs: HwpxTextRun[];
  alignment?: "left" | "center" | "right" | "justify" | "distribute";
  lineSpacing?: number;
  marginTop?: number;
  marginBottom?: number;
  indent?: number;
  bulletText?: string;
  pageBreak?: boolean;
}

export interface HwpxTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  superscript?: boolean;
  subscript?: boolean;
}

export interface HwpxTable {
  type: "table";
  rows: HwpxTableRow[];
  colWidths?: number[];
  caption?: string;
}

export interface HwpxTableRow {
  cells: HwpxTableCell[];
}

export interface HwpxTableCell {
  content: HwpxParagraph[];
  colspan?: number;
  rowspan?: number;
  borderTop?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderRight?: string;
  backgroundColor?: string;
  verticalAlign?: "top" | "middle" | "bottom";
}

export interface HwpxImage {
  type: "image";
  src: string;
  width?: number;
  height?: number;
  caption?: string;
  alignment?: "left" | "center" | "right";
}
