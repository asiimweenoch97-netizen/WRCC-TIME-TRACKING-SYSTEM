/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Eraser, PenTool, Type, CheckCircle2, RotateCcw } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
}

interface SignaturePadProps {
  id: string;
  onSave: (dataUrl: string | null) => void;
  label?: string;
  userName?: string;
  userEmail?: string;
}

export type SignatureMode = "draw" | "type";

export default function SignaturePad({
  id,
  onSave,
  label,
  userName = "Media Crew Member",
}: SignaturePadProps) {
  const [activeMode, setActiveMode] = useState<SignatureMode>("draw");

  // Freehand Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const canvasDimensionsRef = useRef({ width: 0, height: 0 });

  // Cursive Typed Signature State
  const [typedName, setTypedName] = useState(userName);
  const [fontFamily, setFontFamily] = useState<"cursive" | "serif" | "monospace">("cursive");

  // Generate crisp exported signature with high resolution & white background
  const exportDrawnSignature = useCallback((): string | null => {
    if (strokesRef.current.length === 0) {
      return null;
    }

    const { width, height } = canvasDimensionsRef.current;
    if (width === 0 || height === 0) return null;

    // Standardized export canvas (600 x 200) for uniform, crisp records
    const exportWidth = 600;
    const exportHeight = 200;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const expCtx = exportCanvas.getContext("2d");
    if (!expCtx) return null;

    // Solid clean white background
    expCtx.fillStyle = "#ffffff";
    expCtx.fillRect(0, 0, exportWidth, exportHeight);

    // Subtle signature guide line in exported image
    expCtx.strokeStyle = "#e2e8f0";
    expCtx.lineWidth = 1;
    expCtx.setLineDash([4, 4]);
    expCtx.beginPath();
    expCtx.moveTo(40, exportHeight - 40);
    expCtx.lineTo(exportWidth - 40, exportHeight - 40);
    expCtx.stroke();
    expCtx.setLineDash([]);

    // Watermark caption
    expCtx.font = "bold 9px sans-serif";
    expCtx.fillStyle = "#94a3b8";
    expCtx.fillText("DIGITAL VERIFICATION SIGNATURE", 42, exportHeight - 24);

    // Scale strokes to fit export canvas
    const scaleX = exportWidth / width;
    const scaleY = exportHeight / height;

    expCtx.strokeStyle = "#0f172a";
    expCtx.fillStyle = "#0f172a";
    expCtx.lineWidth = 3;
    expCtx.lineCap = "round";
    expCtx.lineJoin = "round";

    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue;

      if (stroke.points.length === 1) {
        // Draw single dot
        const pt = stroke.points[0];
        expCtx.beginPath();
        expCtx.arc(pt.x * scaleX, pt.y * scaleY, 2, 0, Math.PI * 2);
        expCtx.fill();
        continue;
      }

      expCtx.beginPath();
      expCtx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
      for (let i = 1; i < stroke.points.length; i++) {
        expCtx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
      }
      expCtx.stroke();
    }

    return exportCanvas.toDataURL("image/png");
  }, []);

  // Redraw all strokes on the interactive canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvasDimensionsRef.current;
    if (width === 0 || height === 0) return;

    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue;

      if (stroke.points.length === 1) {
        const pt = stroke.points[0];
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, []);

  // Setup canvas size with DPI awareness and observe size changes
  useEffect(() => {
    if (activeMode !== "draw") return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height || 180);

      if (width === 0 || height === 0) return;

      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      // If dimensions changed and we had previous strokes, scale points proportionally
      const oldWidth = canvasDimensionsRef.current.width;
      const oldHeight = canvasDimensionsRef.current.height;

      if (oldWidth > 0 && oldHeight > 0 && (oldWidth !== width || oldHeight !== height)) {
        const sx = width / oldWidth;
        const sy = height / oldHeight;
        strokesRef.current = strokesRef.current.map((stroke) => ({
          points: stroke.points.map((p) => ({ x: p.x * sx, y: p.y * sy })),
        }));
      }

      canvasDimensionsRef.current = { width, height };
      redrawCanvas();
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeMode, redrawCanvas]);

  // Pointer event coordinate extractor
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  };

  // Pointer Down (Mouse, Touch, Stylus)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Fallback if pointer capture is not supported
    }

    const pt = getCoordinates(e);
    isDrawingRef.current = true;
    currentStrokeRef.current = [pt];

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#0f172a";
      ctx.fillStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Draw instantaneous dot for taps/clicks
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pt = getCoordinates(e);
    const lastPt = currentStrokeRef.current[currentStrokeRef.current.length - 1];

    if (lastPt) {
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(lastPt.x, lastPt.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }

    currentStrokeRef.current.push(pt);
  };

  // Pointer Up & Cancel
  const handlePointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture release is not applicable
    }

    isDrawingRef.current = false;

    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push({ points: [...currentStrokeRef.current] });
      currentStrokeRef.current = [];
      setHasDrawnSignature(true);

      const exported = exportDrawnSignature();
      onSave(exported);
    }
  };

  // Clear Signature
  const handleClear = () => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setHasDrawnSignature(false);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasDimensionsRef.current.width, canvasDimensionsRef.current.height);
      }
    }

    onSave(null);
  };

  // Undo Last Stroke
  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();

    if (strokesRef.current.length === 0) {
      setHasDrawnSignature(false);
      redrawCanvas();
      onSave(null);
    } else {
      redrawCanvas();
      const exported = exportDrawnSignature();
      onSave(exported);
    }
  };

  // Generate Cursive Signature Canvas for Type Mode
  const generateTypedSignatureCanvas = useCallback(
    (nameText: string, fontStyle: string) => {
      if (!nameText.trim()) {
        onSave(null);
        return;
      }

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 600;
      tempCanvas.height = 180;
      const ctx = tempCanvas.getContext("2d");
      if (!ctx) return;

      // Clean white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 600, 180);

      // Signature baseline
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(60, 130);
      ctx.lineTo(540, 130);
      ctx.stroke();

      // Written name
      ctx.fillStyle = "#0f172a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (fontStyle === "cursive") {
        ctx.font = "italic 40px 'Brush Script MT', 'Dancing Script', 'Caveat', 'Segoe Script', cursive";
      } else if (fontStyle === "serif") {
        ctx.font = "italic 32px Georgia, 'Times New Roman', serif";
      } else {
        ctx.font = "bold 26px 'Courier New', monospace";
      }

      ctx.fillText(nameText, 300, 80);

      // Metadata watermark
      ctx.font = "bold 9px sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        `DIGITAL CREW SIGNATURE • ${userName} • ${new Date().toLocaleDateString()}`,
        300,
        152
      );

      const dataUrl = tempCanvas.toDataURL("image/png");
      onSave(dataUrl);
    },
    [onSave, userName]
  );

  const handleTypedNameChange = (val: string) => {
    setTypedName(val);
    generateTypedSignatureCanvas(val, fontFamily);
  };

  const handleFontChange = (style: "cursive" | "serif" | "monospace") => {
    setFontFamily(style);
    generateTypedSignatureCanvas(typedName, style);
  };

  const switchMode = (mode: SignatureMode) => {
    setActiveMode(mode);
    if (mode === "type") {
      generateTypedSignatureCanvas(typedName, fontFamily);
    } else {
      if (strokesRef.current.length === 0) {
        onSave(null);
      } else {
        const exported = exportDrawnSignature();
        onSave(exported);
      }
    }
  };

  return (
    <div className="w-full space-y-3">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <PenTool className="w-4 h-4 text-amber-600" />
            {label} <span className="text-red-500">*</span>
          </label>
          <span className="text-[11px] text-slate-500 font-medium">
            {activeMode === "draw"
              ? hasDrawnSignature
                ? "Signature ready"
                : "Finger, stylus, or mouse"
              : "Autopen cursive"}
          </span>
        </div>
      )}

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
        <button
          type="button"
          onClick={() => switchMode("draw")}
          className={`min-h-[40px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMode === "draw"
              ? "bg-amber-600 text-white shadow-xs font-bold"
              : "text-slate-700 hover:bg-slate-200"
          }`}
        >
          <PenTool className="w-4 h-4 shrink-0" />
          <span>Draw Signature</span>
        </button>

        <button
          type="button"
          onClick={() => switchMode("type")}
          className={`min-h-[40px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMode === "type"
              ? "bg-amber-600 text-white shadow-xs font-bold"
              : "text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Type className="w-4 h-4 shrink-0" />
          <span>Type Cursive Script</span>
        </button>
      </div>

      {/* MODE 1: Freehand Draw Canvas */}
      {activeMode === "draw" && (
        <div className="space-y-2">
          <div
            ref={containerRef}
            className="relative w-full h-44 sm:h-48 border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs transition-colors focus-within:border-amber-600"
            style={{ touchAction: "none" }}
          >
            {/* Background Signature Baseline Guide */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-end px-6 pb-9 select-none">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-xs font-serif font-bold text-slate-400">✕</span>
                <div className="flex-1 border-b border-dashed border-slate-300"></div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Sign on line above
                </span>
              </div>
            </div>

            {/* Instruction placeholder when canvas is untouched */}
            {!hasDrawnSignature && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none">
                <span className="text-xs text-slate-400 font-medium bg-white/80 px-3 py-1 rounded-full border border-slate-200/60 shadow-xs">
                  Draw your signature here with touch, stylus, or mouse
                </span>
              </div>
            )}

            {/* Interactive Drawing Canvas */}
            <canvas
              id={id}
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              className="absolute inset-0 w-full h-full cursor-crosshair touch-none select-none"
              style={{ touchAction: "none" }}
            />

            {/* In-canvas tool buttons */}
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
              {hasDrawnSignature && (
                <button
                  type="button"
                  onClick={handleUndo}
                  title="Undo last stroke"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white/95 hover:text-slate-900 border border-slate-300 rounded-lg shadow-xs hover:bg-slate-100 transition-colors cursor-pointer min-h-[32px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClear}
                title="Clear signature"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white/95 hover:text-red-600 border border-slate-300 rounded-lg shadow-xs hover:bg-slate-100 transition-colors cursor-pointer min-h-[32px]"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Status banner */}
          <div className="flex items-center justify-between text-xs px-1 text-slate-500">
            <span className="flex items-center gap-1 font-medium">
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  hasDrawnSignature ? "text-emerald-600" : "text-slate-300"
                }`}
              />
              <span className={hasDrawnSignature ? "text-emerald-700 font-semibold" : ""}>
                {hasDrawnSignature ? "Digital signature recorded" : "Signature required"}
              </span>
            </span>
            <span className="text-[11px] text-slate-400">
              Smooth vector ink • High resolution
            </span>
          </div>
        </div>
      )}

      {/* MODE 2: Cursive Script */}
      {activeMode === "type" && (
        <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Type Name to Render Cursive Signature
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleFontChange("cursive")}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                  fontFamily === "cursive"
                    ? "bg-amber-600 text-white"
                    : "bg-white text-slate-700 border border-slate-300"
                }`}
              >
                Cursive
              </button>
              <button
                type="button"
                onClick={() => handleFontChange("serif")}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                  fontFamily === "serif"
                    ? "bg-amber-600 text-white"
                    : "bg-white text-slate-700 border border-slate-300"
                }`}
              >
                Serif
              </button>
              <button
                type="button"
                onClick={() => handleFontChange("monospace")}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                  fontFamily === "monospace"
                    ? "bg-amber-600 text-white"
                    : "bg-white text-slate-700 border border-slate-300"
                }`}
              >
                Mono
              </button>
            </div>
          </div>

          <input
            type="text"
            value={typedName}
            onChange={(e) => handleTypedNameChange(e.target.value)}
            placeholder="Type your name..."
            className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 text-base sm:text-sm focus:border-amber-600 focus:outline-none shadow-xs"
          />

          <div className="p-4 bg-white border border-slate-300 rounded-xl text-center min-h-[90px] flex flex-col justify-center items-center shadow-xs relative">
            <div className="w-full max-w-md border-b border-dashed border-slate-300 pb-1 mb-1">
              <span
                className={`text-2xl sm:text-3xl text-slate-900 block ${
                  fontFamily === "cursive"
                    ? "font-serif italic"
                    : fontFamily === "serif"
                    ? "font-serif"
                    : "font-mono"
                }`}
              >
                {typedName || "Enter your name"}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
              Digital Signature Image Output • {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Your visual signature image will be attached to your clock-in and clock-out logs.</span>
      </div>
    </div>
  );
}
