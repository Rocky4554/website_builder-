"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Zap,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Layers,
  Check,
  Bot,
  User,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { BuilderMode, Message } from "@/types";

interface ChatPanelProps {
  messages: Message[];
  isGenerating: boolean;
  activeNode: string | null;
  builderMode: BuilderMode;
  setBuilderMode: (mode: BuilderMode) => void;
  onSendMessage: (prompt: string) => void;
  pendingPlan: any | null;
  onApprovePlan: () => void;
  onRejectPlan: () => void;
}

const QUICK_PROMPTS = [
  "Add sleek Dark Mode toggle with animations",
  "Add interactive statistics charts and cards",
  "Make it mobile responsive with clean glassmorphism",
  "Add export to CSV and search filter functionality",
];

export function ChatPanel({
  messages,
  isGenerating,
  activeNode,
  builderMode,
  setBuilderMode,
  onSendMessage,
  pendingPlan,
  onApprovePlan,
  onRejectPlan,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeNode, pendingPlan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/60 border-r border-slate-800/80 w-full select-text">
      {/* Top Panel Controls */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Agent Chat
          </span>
        </div>

        {/* Auto vs Plan Mode Switcher */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setBuilderMode("auto")}
            title="Auto Mode: AI plans and builds in one shot"
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all ${
              builderMode === "auto"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3 h-3 text-amber-300" />
            <span>Auto</span>
          </button>
          <button
            onClick={() => setBuilderMode("plan")}
            title="Plan Mode: Review AI plan before building"
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all ${
              builderMode === "plan"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ClipboardList className="w-3 h-3 text-indigo-300" />
            <span>Plan</span>
          </button>
        </div>
      </div>

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                What would you like to build?
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Enter your prompt below. The AI multi-agent team will plan, architect, and write the full interactive code.
              </p>
            </div>

            <div className="w-full pt-2 space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Try asking for:
              </div>
              <div className="grid grid-cols-1 gap-1.5 text-left">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(prompt);
                    }}
                    className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 hover:border-indigo-500/40 text-slate-300 transition-all text-xs flex items-center gap-2 group"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-400 group-hover:text-indigo-300" />
                    <span className="truncate">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col gap-1.5 ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
                {msg.role === "user" ? (
                  <>
                    <span>You</span>
                    <User className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-indigo-400" />
                    <span className="text-indigo-300 font-medium">Lovable AI</span>
                  </>
                )}
              </div>

              <div
                className={`p-3.5 rounded-2xl max-w-[92%] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20"
                    : "bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-none"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Plan summary badge if present */}
                {msg.plan && (
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-indigo-500/20 space-y-2">
                    <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{msg.plan.app_name || "Application Plan"}</span>
                    </div>
                    {msg.plan.features && (
                      <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                        {msg.plan.features.map((feat: string, fidx: number) => (
                          <li key={fidx}>{feat}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Live Multi-agent Generation Status Tracker */}
        {isGenerating && (
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-indigo-500/30 space-y-3 animate-pulse">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                Agents Active
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                {activeNode?.toUpperCase() || "PROCESSING"}
              </span>
            </div>

            {/* Step progression indicators */}
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div
                className={`p-2 rounded-lg border text-center transition-all ${
                  activeNode === "planner"
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold"
                    : activeNode === "architect" || activeNode === "coder"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                📋 Planner
              </div>
              <div
                className={`p-2 rounded-lg border text-center transition-all ${
                  activeNode === "architect"
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold"
                    : activeNode === "coder"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                🏗️ Architect
              </div>
              <div
                className={`p-2 rounded-lg border text-center transition-all ${
                  activeNode === "coder"
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold animate-pulse"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                💻 Coder
              </div>
            </div>
          </div>
        )}

        {/* Plan Mode Approval Gate */}
        {pendingPlan && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-indigo-500/50 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
              <ClipboardList className="w-4 h-4" />
              <span>Plan Review Required</span>
            </div>
            <p className="text-xs text-slate-300">
              The AI architect proposed the plan above. Ready to build files?
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onApprovePlan}
                className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/25 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                Approve & Build
              </button>
              <button
                onClick={onRejectPlan}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/90">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={
              isGenerating
                ? "Generating your application..."
                : "Ask AI to generate or edit anything (e.g. 'Add a search bar and dark theme')..."
            }
            disabled={isGenerating}
            rows={3}
            className="w-full resize-none rounded-2xl bg-slate-900/90 border border-slate-800 focus:border-indigo-500 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition-all disabled:opacity-50"
          />

          <div className="absolute right-2.5 bottom-3 flex items-center gap-1.5">
            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center"
            >
              {isGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </form>
        <div className="text-[10px] text-slate-500 text-center mt-1.5">
          Press <kbd className="bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Enter</kbd> to send, <kbd className="bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Shift+Enter</kbd> for new line
        </div>
      </div>
    </div>
  );
}
