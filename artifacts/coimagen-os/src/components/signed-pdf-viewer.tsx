import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

// Signed contract PDF shown inline on the page (Camila, 2026-09-25) — a
// plain <iframe> on the DocuSeal file URL, no viewer library. Verified the
// DocuSeal file is served `Content-Disposition: inline` with no
// X-Frame-Options/CSP, and os.coimagenmedia.com sets no frame-src, so the
// browser's own PDF viewer can render it framed.
//
// Mobile browsers are the known exception: Android Chrome has no in-page
// PDF viewer (pdfViewerEnabled === false → blank frame), and iOS Safari
// renders only the first page of a framed PDF, unscrollable. On those, the
// open-in-new-tab button is shown instead of a broken frame. It's also
// always shown under the frame as a fallback everywhere else.
function canEmbedPdf(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { pdfViewerEnabled?: boolean };
  if (nav.pdfViewerEnabled === false) return false;
  const ua = nav.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  return !isIOS && !isAndroid;
}

export interface SignedPdfViewerLabels {
  frameTitle: string;
  openInNewTab: string;
  mobileHint: string;
}

export function SignedPdfViewer({ url, labels }: { url: string; labels: SignedPdfViewerLabels }) {
  const embed = canEmbedPdf();

  const openButton = (
    <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
        {labels.openInNewTab}
      </a>
    </Button>
  );

  if (!embed) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/20 p-4 flex flex-col items-center gap-3 text-center">
        <FileText className="h-8 w-8 text-primary/60" />
        <p className="text-xs text-muted-foreground">{labels.mobileHint}</p>
        {openButton}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <iframe
        src={`${url}#view=FitH`}
        title={labels.frameTitle}
        className="w-full h-[75vh] min-h-[480px] rounded-lg border border-border/50 bg-white"
      />
      <div className="flex justify-end">{openButton}</div>
    </div>
  );
}
