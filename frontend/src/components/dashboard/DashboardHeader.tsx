"use client";

import React from "react";
import { Sparkles, Plus, Layers, Globe, Code2 } from "lucide-react";

interface DashboardHeaderProps {
  onNewProject: () => void;
  projectCount: number;
}

export function DashboardHeader({
  onNewProject,
  projectCount,
}: DashboardHeaderProps) {
  return (
    <div className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-white tracking-tight">
                Lovable<span className="text-indigo-400">.builder</span>
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-medium">
                AI Multi-Agent
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Prompt to full interactive web applications with real-time live preview
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onNewProject}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold text-xs text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>
    </div>
  );
}
