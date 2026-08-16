"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Monitor,
  Tablet,
  Smartphone,
  Download,
  ExternalLink,
  RotateCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { DeviceMode, Project, ProjectFile } from "@/types";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface HeaderProps {
  project: Project | null;
  files: ProjectFile[];
  deviceMode: DeviceMode;
  setDeviceMode: (mode: DeviceMode) => void;
  isGenerating: boolean;
  onRefreshPreview: () => void;
  onPopoutPreview: () => void;
}

export function Header({
  project,
  files,
  deviceMode,
  setDeviceMode,
  isGenerating,
  onRefreshPreview,
  onPopoutPreview,
}: HeaderProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportZip = async () => {
    if (!files || files.length === 0) return;
    setIsExporting(true);
    try {
      const zip = new JSZip();
      files.forEach((f) => {
        zip.file(f.path, f.content);
      });
      const content = await zip.generateAsync({ type: "blob" });
      const filename = `${(project?.name || "website-builder-app")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")}.zip`;
      saveAs(content, filename);
    } catch (err) {
      console.error("Export zip error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Brand & Back Navigation */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>

        <div className="h-4 w-px bg-slate-800" />

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-100 max-w-[200px] sm:max-w-xs truncate">
              {project?.name || "Untitled Project"}
            </h1>
          </div>
        </div>

        {/* Live Status indicator */}
        {isGenerating ? (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 animate-pulse font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            AI Generating...
          </span>
        ) : files.length > 0 ? (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Ready ({files.length} files)
          </span>
        ) : null}
      </div>

      {/* Center: Responsive Viewport Switcher */}
      <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-0.5">
        <button
          onClick={() => setDeviceMode("desktop")}
          title="Desktop (100%)"
          className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
            deviceMode === "desktop"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Desktop</span>
        </button>
        <button
          onClick={() => setDeviceMode("tablet")}
          title="Tablet (768px)"
          className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
            deviceMode === "tablet"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Tablet className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Tablet</span>
        </button>
        <button
          onClick={() => setDeviceMode("mobile")}
          title="Mobile (375px)"
          className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
            deviceMode === "mobile"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Mobile</span>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRefreshPreview}
          title="Refresh Preview"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        <button
          onClick={onPopoutPreview}
          title="Open preview in new tab"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs"
        >
          <ExternalLink className="w-4 h-4" />
        </button>

        <button
          onClick={handleExportZip}
          disabled={isExporting || files.length === 0}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-slate-200 transition-all border border-slate-700/60 flex items-center gap-1.5 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export ZIP</span>
        </button>
      </div>
    </header>
  );
}
