"use client";

import { useEffect, useState } from "react";

import { Card, CardBody, CardHeader } from "@heroui/react";
import { useTranslations } from "next-intl";
import QRCode from "react-qr-code";

import { isElectron } from "@lib/isElectron";

const METADATA_TIMEOUT_MS = 8000;
const SHA256_FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function validMetadata(data, hostname) {
  if (data?.schemaVersion !== 1 || data.hostname !== hostname) return false;

  const requiredFields = ["subject", "displayName", "sha256", "notBefore", "notAfter"];
  if (!requiredFields.every((field) => typeof data[field] === "string" && data[field].trim())) return false;

  const issuedAt = Date.parse(data.notBefore);
  const expiresAt = Date.parse(data.notAfter);
  return SHA256_FINGERPRINT.test(data.sha256) &&
    Number.isFinite(issuedAt) && Number.isFinite(expiresAt) && issuedAt < expiresAt;
}

export function SecureConnection() {
  const t = useTranslations("settings.secureConnection");
  const [state, setState] = useState(null);

  useEffect(() => {
    if (isElectron || !window.location.hostname.endsWith(".local")) return;
    const controller = new AbortController();
    const hostname = window.location.hostname;
    const timeout = window.setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
    let mounted = true;

    async function load() {
      try {
        const response = await fetch("/trust/metadata.json", {
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal,
        });
        if (response.status === 404) return;
        if (!response.ok) throw new Error("Trust metadata unavailable");
        const metadata = await response.json();
        if (!validMetadata(metadata, hostname)) throw new Error("Invalid trust metadata");
        if (mounted) setState({ metadata, hostname, https: window.location.protocol === "https:" });
      } catch {
        if (mounted) setState({ error: true });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    load();
    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (!state) return null;

  return (
    <Card shadow="none" className="rounded-lg p-6 shadow-lg">
      <CardHeader className="flex flex-col items-start gap-2 pb-2">
        <h2 className="text-lg font-semibold text-green-900 sm:text-xl xl:text-2xl">{t("title")}</h2>
        <p className="text-sm text-gray-500">{t("subtitle")}</p>
      </CardHeader>
      <CardBody className="gap-4 pt-4">
        {state.error ? <p role="status">{t("unavailable")}</p> : (
          <>
            <p>{t(state.https ? "httpsSession" : "httpSession")}</p>
            <p className="text-sm text-gray-600">{t("sessionHint")}</p>
            <dl className="text-sm">
              <dt className="font-semibold">{state.metadata.displayName}</dt>
              <dd className="break-words">{state.metadata.subject}</dd>
              <dt className="mt-3 font-semibold">{t("issued")}</dt>
              <dd>{new Date(state.metadata.notBefore).toLocaleDateString()}</dd>
              <dt className="mt-3 font-semibold">{t("expires")}</dt>
              <dd>{new Date(state.metadata.notAfter).toLocaleDateString()}</dd>
              <dt className="mt-3 font-semibold">SHA-256</dt>
              <dd className="mt-1 break-all font-mono text-xs select-all">{state.metadata.sha256}</dd>
            </dl>
            <div className="mx-auto w-full max-w-56 rounded-xl border border-gray-200 bg-white p-4">
              <QRCode
                aria-label={t("qrLabel")}
                value={`http://${state.hostname}/trust/`}
                size={224}
                fgColor="#14532D"
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </div>
            <p className="text-sm text-gray-600">{t("qrHint")}</p>
            <a href="/trust/" target="_blank" rel="noreferrer" className="text-green-800 underline">
              {t("instructions")}
            </a>
          </>
        )}
      </CardBody>
    </Card>
  );
}
