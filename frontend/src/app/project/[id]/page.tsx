"use client";

import React, { useState, useEffect, use } from "react";
import { useParams, useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { Header } from "@/components/workspace/Header";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { CodeEditorPanel } from "@/components/workspace/CodeEditorPanel";
import { PreviewPanel } from "@/components/workspace/PreviewPanel";
import {
  Project,
  ProjectFile,
  Message,
  DeviceMode,
  BuilderMode,
  GenerationEvent,
} from "@/types";
import {
  fetchProject,
  fetchProjectFiles,
  fetchMessages,
  streamProjectGeneration,
  saveLocalFiles,
  saveLocalMessages,
} from "@/lib/api";

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.id as string) || "";

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [builderMode, setBuilderMode] = useState<BuilderMode>("auto");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<any | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load project files and messages on mount
  useEffect(() => {
    if (!projectId) return;

    const loadData = async () => {
      try {
        const proj = await fetchProject(projectId);
        setProject(proj);

        const fileList = await fetchProjectFiles(projectId);
        setFiles(fileList);
        if (fileList.length > 0) {
          setActiveFilePath(fileList[0].path);
        }

        const msgList = await fetchMessages(projectId);
        setMessages(msgList);

        // Check if there was an initial prompt set from dashboard
        const autoPrompt = sessionStorage.getItem(`auto_prompt_${projectId}`);
        if (autoPrompt) {
          sessionStorage.removeItem(`auto_prompt_${projectId}`);
          handleSendMessage(autoPrompt);
        }
      } catch (err) {
        console.error("Error loading project workspace:", err);
      }
    };

    loadData();
  }, [projectId]);

  // Handle sending new prompt to AI multi-agent
  const handleSendMessage = (promptText: string) => {
    if (isGenerating) return;

    // Add user message to UI
    const userMsg: Message = {
      role: "user",
      content: promptText,
      created_at: new Date().toISOString(),
    };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    saveLocalMessages(projectId, updatedMsgs);

    setIsGenerating(true);
    setActiveNode("planner");
    setPendingPlan(null);

    let incomingFiles = [...files];

    // Connect to WebSocket / stream generator
    streamProjectGeneration(
      projectId,
      promptText,
      (event: GenerationEvent) => {
        if (event.type === "status" && event.node) {
          setActiveNode(event.node);
        } else if (event.type === "file" && event.path && event.content !== undefined) {
          // File arrived or updated
          const existingIdx = incomingFiles.findIndex((f) => f.path === event.path);
          if (existingIdx !== -1) {
            incomingFiles[existingIdx] = {
              ...incomingFiles[existingIdx],
              content: event.content,
            };
          } else {
            incomingFiles.push({
              path: event.path,
              content: event.content,
            });
          }
          setFiles([...incomingFiles]);
          saveLocalFiles(projectId, incomingFiles);
          setActiveFilePath(event.path);
          setRefreshTrigger((prev) => prev + 1);
        } else if (event.type === "complete") {
          setIsGenerating(false);
          setActiveNode(null);
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
          const assistantMsg: Message = {
            role: "assistant",
            content: `✨ Application built successfully with ${incomingFiles.length} files. You can preview it live or keep chatting to make edits!`,
            created_at: new Date().toISOString(),
          };
          const finalMsgs = [...updatedMsgs, assistantMsg];
          setMessages(finalMsgs);
          saveLocalMessages(projectId, finalMsgs);
        } else if (event.type === "error") {
          setIsGenerating(false);
          setActiveNode(null);
          const errorMsg: Message = {
            role: "assistant",
            content: `⚠️ Generation error: ${event.message || "Something went wrong during generation."}`,
            created_at: new Date().toISOString(),
          };
          const finalMsgs = [...updatedMsgs, errorMsg];
          setMessages(finalMsgs);
          saveLocalMessages(projectId, finalMsgs);
        }
      },
      () => {
        setIsGenerating(false);
        setActiveNode(null);
      }
    );
  };

  const handleUpdateFileContent = (path: string, content: string) => {
    setFiles((prev) => {
      const updated = prev.map((f) => (f.path === path ? { ...f, content } : f));
      saveLocalFiles(projectId, updated);
      return updated;
    });
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleAddFile = (path: string) => {
    if (files.some((f) => f.path === path)) return;
    const newFiles = [...files, { path, content: "" }];
    setFiles(newFiles);
    setActiveFilePath(path);
    saveLocalFiles(projectId, newFiles);
  };

  const handleDeleteFile = (path: string) => {
    const newFiles = files.filter((f) => f.path !== path);
    setFiles(newFiles);
    if (activeFilePath === path) {
      setActiveFilePath(newFiles[0]?.path || null);
    }
    saveLocalFiles(projectId, newFiles);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handlePopoutPreview = () => {
    const htmlFile = files.find((f) => f.path.toLowerCase().endsWith(".html")) || files[0];
    if (!htmlFile) return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(htmlFile.content);
      win.document.close();
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#080c16] text-slate-100 overflow-hidden">
      {/* Top Header */}
      <Header
        project={project}
        files={files}
        deviceMode={deviceMode}
        setDeviceMode={setDeviceMode}
        isGenerating={isGenerating}
        onRefreshPreview={() => setRefreshTrigger((prev) => prev + 1)}
        onPopoutPreview={handlePopoutPreview}
      />

      {/* 3-Panel Main Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Chat Panel (30%) */}
        <div className="w-80 md:w-96 flex-shrink-0 h-full">
          <ChatPanel
            messages={messages}
            isGenerating={isGenerating}
            activeNode={activeNode}
            builderMode={builderMode}
            setBuilderMode={setBuilderMode}
            onSendMessage={handleSendMessage}
            pendingPlan={pendingPlan}
            onApprovePlan={() => {
              setPendingPlan(null);
            }}
            onRejectPlan={() => {
              setPendingPlan(null);
              setIsGenerating(false);
            }}
          />
        </div>

        {/* Middle: Code Editor & File Tree (35%) */}
        <div className="w-[35%] flex-shrink-0 h-full">
          <CodeEditorPanel
            files={files}
            activeFilePath={activeFilePath}
            onSelectFile={setActiveFilePath}
            onUpdateFileContent={handleUpdateFileContent}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
          />
        </div>

        {/* Right: Live Interactive Preview Panel (35%+) */}
        <div className="flex-1 h-full min-w-0">
          <PreviewPanel
            files={files}
            deviceMode={deviceMode}
            onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>
    </div>
  );
}
