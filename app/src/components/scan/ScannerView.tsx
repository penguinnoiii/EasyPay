"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrowserQRCodeReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

interface ScannerViewProps {
  onDecoded: (payload: string) => void;
  error?: string | null;
}

export function ScannerView({ onDecoded, error }: ScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const reader = new BrowserQRCodeReader();
    let stopped = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the error banner when the user hits "Try again"
    setCameraError(null);

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err, controls) => {
        controlsRef.current = controls;
        if (result && !stopped) {
          stopped = true;
          controls.stop();
          onDecoded(result.getText());
        }
      })
      .catch((err: unknown) => {
        setCameraError(err instanceof Error ? err.message : "Could not access the camera.");
      });

    return () => {
      stopped = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-black">
      <div className="relative h-full w-full max-w-md overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-64 w-64 rounded-2xl border-2 border-white/70" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5 px-6 text-center">
        <p className="text-sm text-zinc-300">Point the camera at a PromptPay QR code.</p>
        <p className="text-xs text-zinc-500">สแกน QR พร้อมเพย์</p>
      </div>
      {(cameraError || error) && (
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <p className="text-sm text-red-400">{cameraError ?? error}</p>
          <div className="flex gap-4">
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white"
            >
              Try again
            </button>
            <Link href="/" className="flex items-center text-sm text-zinc-400 underline">
              Back to home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
