"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  RotateCw,
  ExternalLink,
  Terminal,
  ChevronUp,
  ChevronDown,
  Trash2,
  Lock,
  Globe,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { DeviceMode, ProjectFile } from "@/types";
import { buildPreviewDoc } from "@/lib/preview-runtime";

interface ConsoleLog {
  id: string;
  level: "log" | "warn" | "error" | "info";
  message: string;
  time: string;
}

interface PreviewPanelProps {
  files: ProjectFile[];
  deviceMode: DeviceMode;
  onRefresh: () => void;
  refreshTrigger: number;
}

export function PreviewPanel({
  files,
  deviceMode,
  onRefresh,
  refreshTrigger,
}: PreviewPanelProps) {
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Compile the sandboxed HTML document whenever files or refresh changes
  const previewDoc = buildPreviewDoc(files);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "CONSOLE_LOG") {
        setConsoleLogs((prev) => [
          ...prev.slice(-100),
          {
            id: `${Date.now()}-${Math.random()}`,
            level: event.data.level || "log",
            message: event.data.message || "",
            time: event.data.time || new Date().toLocaleTimeString(),
          },
        ]);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const getDeviceDimensions = () => {
    switch (deviceMode) {
      case "mobile":
        return "w-[375px] h-[667px] shadow-2xl rounded-[32px] border-8 border-slate-900";
      case "tablet":
        return "w-[768px] h-[850px] max-h-[92%] shadow-2xl rounded-[24px] border-8 border-slate-900";
      case "desktop":
      default:
        return "w-full h-full";
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] select-none relative overflow-hidden">
      {/* Top Address Bar Simulation */}
      <div className="h-9 border-b border-slate-800/80 bg-slate-950/80 px-3 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <button
            onClick={onRefresh}
            title="Reload Preview"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Browser URL chip */}
        <div className="flex-1 max-w-sm mx-auto flex items-center justify-center gap-1.5 px-3 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span className="truncate">localhost:3000/preview</span>
        </div>

        {/* Console Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsConsoleOpen(!isConsoleOpen)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
              isConsoleOpen
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Console</span>
            {consoleLogs.length > 0 && (
              <span className="px-1 rounded-full bg-indigo-950 text-indigo-300 text-[9px]">
                {consoleLogs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Frame Preview Container */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#090d16]/50">
        <div
          className={`transition-all duration-300 bg-white overflow-hidden relative ${getDeviceDimensions()}`}
        >
          <iframe
            key={refreshTrigger}
            ref={iframeRef}
            srcDoc={previewDoc}
            title="Generated App Live Preview"
            sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
            className="w-full h-full border-0 bg-white"
          />
        </div>
      </div>

      {/* Collapsible Console Drawer */}
      {isConsoleOpen && (
        <div className="h-48 border-t border-slate-800 bg-slate-950 flex flex-col shrink-0 z-20">
          <div className="h-7 border-b border-slate-800/80 px-3 flex items-center justify-between text-[11px] bg-slate-900/80">
            <div className="flex items-center gap-2 font-semibold text-slate-300">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Developer Console</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setConsoleLogs([])}
                title="Clear console"
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setIsConsoleOpen(false)}
                title="Close console"
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-1 select-text">
            {consoleLogs.length === 0 ? (
              <div className="text-slate-500 italic p-2">
                No logs recorded yet. Interactive logs and runtime errors will display here.
              </div>
            ) : (
              consoleLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 py-0.5 px-1.5 rounded ${
                    log.level === "error"
                      ? "text-rose-400 bg-rose-950/20"
                      : log.level === "warn"
                      ? "text-amber-400 bg-amber-950/20"
                      : "text-slate-300"
                  }`}
                >
                  <span className="text-slate-600 shrink-0">{log.time}</span>
                  <span className="break-all whitespace-pre-wrap">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
