import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { useGetContractSignedDocuments, getGetContractSignedDocumentsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

// Signed contract PDF shown inline on the page (Camila, 2026-09-25) — a
// plain <iframe> on the DocuSeal file URL, no viewer library. Verified the
// DocuSeal file is served `Content-Disposition: inline` with no
// X-Frame-Options/CSP, and os.coimagenmedia.com sets no frame-src, so the
// browser's own PDF viewer can render it framed.
//
// The URL is fetched fresh from GET /contracts/:id/signed-documents every
// time the viewer mounts: DocuSeal file URLs are signed tokens that stop
// working after a while, so the one stored on the contract row returns 403
// "Not authorized" once it's old — that's what broke the first
// version of this viewer.
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

// Shared by the viewer and the CEO page's audit-log link, so both reuse one
// request. Refetched on every mount, so the URL is always freshly issued.
export function useFreshSignedDocuments(contractId: number) {
  return useGetContractSignedDocuments(contractId, {
    query: {
      queryKey: getGetContractSignedDocumentsQueryKey(contractId),
      staleTime: 5 * 60 * 1000,
      refetchOnMount: "always",
      refetchOnWindowFocus: false,
      retry: 1,
    },
  });
}

export interface SignedPdfViewerLabels {
  frameTitle: string;
  openInNewTab: string;
  mobileHint: string;
  loading: string;
  error: string;
}

export function SignedPdfViewer({ contractId, labels }: { contractId: number; labels: SignedPdfViewerLabels }) {
  const embed = canEmbedPdf();
  const { data, isLoading, isError } = useFreshSignedDocuments(contractId);
  const url = data?.signedDocumentUrl ?? null;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/50 p-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />{labels.loading}
      </div>
    );
  }

  if (isError || !url) {
    return (
      <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-xs text-red-400 text-center">
        {labels.error}
      </div>
    );
  }

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
