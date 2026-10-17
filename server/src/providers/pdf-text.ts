import { ProviderError } from "./quota.js";
export interface PdfPageText {
  page: number;
  text: string;
}

// PDF parsing is deterministic document processing; no model runs locally.
export async function extractPdfPages(buffer: Buffer): Promise<PdfPageText[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    verbosity: 0,
  });
  try {
    const document = await task.promise;
    if (document.numPages > 25)
      throw new ProviderError("PDFs are limited to 25 pages.");
    const pages: PdfPageText[] = [];
    let characters = 0;
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
        )
        .join("")
        .trim();
      if (text.replace(/\s/g, "").length < 20)
        throw new ProviderError(
          "Groq needs selectable PDF text. This PDF has a scanned, blank, or unreadable page; supply a text-based PDF or paste the business answers. No assessment was published.",
          false,
          "GROQ_PDF_TEXT_REQUIRED",
          0,
          false,
          "groq",
        );
      characters += text.length;
      if (characters > 100000)
        throw new ProviderError(
          "This PDF is too long for the Groq fallback. Split it into shorter documents.",
          false,
          "GROQ_INPUT_TOO_LARGE",
          0,
          false,
          "groq",
        );
      pages.push({ page: number, text });
    }
    return pages;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      "The PDF text could not be read safely for Groq. Upload an unlocked text-based PDF or paste the answers.",
      false,
      "GROQ_PDF_TEXT_REQUIRED",
      0,
      false,
      "groq",
    );
  } finally {
    await task.destroy();
  }
}
