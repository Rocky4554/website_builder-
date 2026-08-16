"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  FileCode,
  FolderTree,
  Plus,
  Trash2,
  Copy,
  Check,
  Code2,
  FileText,
  FileJson,
  Braces,
  X,
  WrapText,
} from "lucide-react";
import { ProjectFile } from "@/types";
import { getFileLanguage } from "@/lib/utils";

// Dynamically import Monaco Editor to avoid SSR issues
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface CodeEditorPanelProps {
  files: ProjectFile[];
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
  onUpdateFileContent: (path: string, content: string) => void;
  onAddFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
}

export function CodeEditorPanel({
  files,
  activeFilePath,
  onSelectFile,
  onUpdateFileContent,
  onAddFile,
  onDeleteFile,
}: CodeEditorPanelProps) {
  const [copied, setCopied] = useState(false);
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [wordWrap, setWordWrap] = useState<"on" | "off">("on");

  const activeFile =
    files.find((f) => f.path === activeFilePath) || files[0] || null;

  const handleCopy = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    onAddFile(newFileName.trim());
    setNewFileName("");
    setIsAddingFile(false);
  };

  const getIconForFile = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "html":
      case "htm":
        return <FileCode className="w-3.5 h-3.5 text-orange-400" />;
      case "css":
        return <Braces className="w-3.5 h-3.5 text-sky-400" />;
      case "js":
      case "jsx":
        return <Code2 className="w-3.5 h-3.5 text-amber-400" />;
      case "ts":
      case "tsx":
        return <Code2 className="w-3.5 h-3.5 text-blue-400" />;
      case "json":
        return <FileJson className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="flex h-full bg-slate-950/80 border-r border-slate-800/80 select-none">
      {/* File Tree Explorer Column */}
      <div className="w-48 border-r border-slate-800/80 flex flex-col bg-slate-950/90 shrink-0">
        <div className="p-2.5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
            <span>Files</span>
          </div>
          <button
            onClick={() => setIsAddingFile(true)}
            title="New File"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* New file input */}
        {isAddingFile && (
          <form onSubmit={handleCreateFile} className="p-2 border-b border-slate-800">
            <input
              type="text"
              autoFocus
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onBlur={() => {
                if (!newFileName.trim()) setIsAddingFile(false);
              }}
              placeholder="e.g. script.js"
              className="w-full px-2 py-1 text-xs rounded bg-slate-900 border border-indigo-500/50 text-slate-200 focus:outline-none"
            />
          </form>
        )}

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-xs">
          {files.map((file) => {
            const isActive = activeFile?.path === file.path;
            return (
              <div
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300 font-medium border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {getIconForFile(file.path)}
                  <span className="truncate">{file.path}</span>
                </div>

                {files.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(file.path);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 transition-opacity"
                    title="Delete File"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor Main Section */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        {/* Tabs Bar */}
        <div className="h-9 border-b border-slate-800/80 bg-slate-950/90 flex items-center justify-between px-2">
          <div className="flex items-center gap-1 overflow-x-auto h-full scrollbar-none">
            {files.map((file) => {
              const isActive = activeFile?.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => onSelectFile(file.path)}
                  className={`h-7 px-3 rounded-t-md text-xs flex items-center gap-1.5 border-t-2 transition-all ${
                    isActive
                      ? "bg-[#1e1e1e] text-slate-200 border-indigo-500 font-medium"
                      : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/40"
                  }`}
                >
                  {getIconForFile(file.path)}
                  <span>{file.path}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setWordWrap(wordWrap === "on" ? "off" : "on")}
              title={`Toggle Word Wrap (${wordWrap})`}
              className={`p-1 rounded text-xs transition-colors ${
                wordWrap === "on"
                  ? "text-indigo-400 bg-indigo-500/10"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCopy}
              title="Copy File Content"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Monaco Editor Container */}
        <div className="flex-1 relative">
          {activeFile ? (
            <Editor
              height="100%"
              path={activeFile.path}
              defaultLanguage={getFileLanguage(activeFile.path)}
              language={getFileLanguage(activeFile.path)}
              value={activeFile.content}
              theme="vs-dark"
              onChange={(value) => {
                if (value !== undefined) {
                  onUpdateFileContent(activeFile.path, value);
                }
              }}
              options={{
                fontSize: 13,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: wordWrap,
                automaticLayout: true,
                tabSize: 2,
                smoothScrolling: true,
                padding: { top: 12, bottom: 12 },
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              No file selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
