import { useEffect, useState } from "react";
import { Alert, Button, Stack } from "@mui/material";
import { api } from "../lib/api";
import { useI18n } from "../i18n/useI18n";
import { downloadBlob as downloadFile } from "../lib/records";
export default function PdfActions({
  url,
  name = "document.pdf",
  params = {},
}) {
  const { t, language } = useI18n(),
    [snapshot, setSnapshot] = useState(null),
    [shareError, setShareError] = useState(""),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false),
    key = JSON.stringify(params),
    requestKey = JSON.stringify({ url, key, name, language, retry }),
    current = snapshot?.key === requestKey,
    file = current ? snapshot.file : null,
    error = (current ? snapshot.error : "") || shareError;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api
      .get(url, {
        params: { ...JSON.parse(key), locale: language },
        responseType: "blob",
        signal: controller.signal,
      })
      .then((r) => {
        if (active)
          setSnapshot({
            key: requestKey,
            file: new File([r.data], name, { type: "application/pdf" }),
            error: "",
          });
      })
      .catch(() => {
        if (active)
          setSnapshot({
            key: requestKey,
            file: null,
            error: t("Could not prepare PDF."),
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [url, key, name, language, retry, requestKey, t]);
  async function share() {
    if (!file || busy) return;
    setBusy(true);
    try {
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: name });
      else downloadFile(file, name);
    } catch (e) {
      if (e.name !== "AbortError") {
        setShareError(t("Sharing is unavailable. Download the PDF instead."));
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack spacing={1} className="no-print">
      {error && (
        <Alert
          severity="warning"
          action={
            <Button onClick={() => setRetry((n) => n + 1)}>{t("Retry")}</Button>
          }
        >
          {error}
        </Alert>
      )}
      <Stack direction="row" spacing={1}>
        <Button
          disabled={!file || busy}
          onClick={() => downloadFile(file, name)}
        >
          {file ? t("Download PDF") : t("Preparing PDF...")}
        </Button>
        <Button disabled={!file || busy} onClick={share}>
          {t("Share PDF")}
        </Button>
      </Stack>
    </Stack>
  );
}
