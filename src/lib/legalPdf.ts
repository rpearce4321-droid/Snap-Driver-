import { jsPDF } from "jspdf";

export type LegalSection = {
  title: string;
  body: string[];
};

type LegalPdfConfig = {
  title: string;
  fileName: string;
  lastUpdated: string;
  sections: LegalSection[];
  disclaimer?: string;
};

export function downloadLegalPdf(config: LegalPdfConfig) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;

  let y = margin;

  const ensureRoom = (height: number) => {
    if (y + height <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  const addLines = (lines: string[], font: "normal" | "bold", size: number, spacing = 6) => {
    doc.setFont("times", font);
    doc.setFontSize(size);
    const lineHeight = size + 3;
    lines.forEach((line) => {
      ensureRoom(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    });
    y += spacing;
  };

  addLines([config.title], "bold", 20, 8);
  addLines([`Last updated: ${config.lastUpdated}`], "normal", 11, 10);

  config.sections.forEach((section) => {
    addLines([section.title], "bold", 12, 4);
    section.body.forEach((paragraph) => {
      const lines = doc.splitTextToSize(paragraph, maxWidth);
      addLines(lines, "normal", 11, 8);
    });
  });

  if (config.disclaimer) {
    addLines(["Disclaimer"], "bold", 12, 4);
    const lines = doc.splitTextToSize(config.disclaimer, maxWidth);
    addLines(lines, "normal", 10, 0);
  }

  doc.save(config.fileName);
}
