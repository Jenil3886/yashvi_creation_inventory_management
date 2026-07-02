import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onClose }) => {
  const scannerId = 'yc-reader-element';
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        const qrScanner = new Html5Qrcode(scannerId);
        qrScannerRef.current = qrScanner;

        await qrScanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (width, height) => {
              // Portrait scanning window optimized for linear barcodes
              const boxWidth = Math.min(width * 0.75, 280);
              const boxHeight = Math.min(height * 0.25, 120);
              return { width: boxWidth, height: boxHeight };
            },
          },
          (decodedText) => {
            onScanSuccess(decodedText);
            // Auto close scanner on success
            qrScanner
              .stop()
              .then(() => onClose())
              .catch(console.error);
          },
          () => {
            // Ignore scan failure frame-by-frame logs
          },
        );
      } catch (err) {
        console.error('Camera capture init error:', err);
      }
    };

    startScanner();

    return () => {
      if (qrScannerRef.current && qrScannerRef.current.isScanning) {
        qrScannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScanSuccess, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950 text-white">
      {/* Header bar */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Camera className="text-brand-400" />
          <h2 className="text-sm font-semibold">Scan Product Barcode / SKU</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Viewport wrapper */}
      <div className="flex-1 flex items-center justify-center p-4 relative bg-slate-950">
        <div
          id={scannerId}
          className="w-full max-w-sm rounded-lg overflow-hidden border border-brand-500 bg-slate-900"
        />

        {/* Framing Guides Overlay */}
        <div className="absolute w-[280px] h-[120px] pointer-events-none rounded-lg border-2 border-brand-400/80 animate-pulse-subtle flex items-center justify-center shadow-[0_0_0_9999px_rgba(9,13,22,0.6)]">
          {/* Corner brackets */}
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-brand-400" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-brand-400" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-brand-400" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-brand-400" />

          {/* Central red scanning line */}
          <div className="w-full h-[1px] bg-red-500" />
        </div>
      </div>

      {/* Instructions Footer */}
      <div className="p-6 bg-slate-900 text-center text-xs text-slate-400 border-t border-slate-800">
        Position the product barcode within the box bounds. Ensure good lighting for quick
        detection.
      </div>
    </div>
  );
};

export default BarcodeScanner;
