/**
 * Redact sensitive text in a PDF by overlaying black rectangles.
 * Simple approach: draw rectangles to cover sensitive areas.
 */
export declare function redactPdf(fileBlob: Blob, hits: {
    value: string;
}[]): Promise<Blob>;
/**
 * Redact sensitive text in a DOCX by replacing matches with [REDACTED].
 * This reconstructs a simple DOCX with plain text preserved line-by-line.
 */
export declare function redactDocx(fileBlob: Blob, hits: {
    value: string;
}[]): Promise<Blob>;
/**
 * Redact sensitive text in an image using OCR bounding boxes (Tesseract.js).
 * Overlays black rectangles on words matching hits.
 */
export declare function redactImage(fileBlob: Blob, hits: {
    value: string;
}[]): Promise<Blob>;
//# sourceMappingURL=redactionUtils.d.ts.map