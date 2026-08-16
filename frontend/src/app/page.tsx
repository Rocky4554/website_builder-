"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Plus,
  Search,
  Layers,
  ArrowRight,
  Loader2,
  Code2,
  Cpu,
  MonitorPlay,
  Zap,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StarterTemplates } from "@/components/dashboard/StarterTemplates";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { Project } from "@/types";
import { fetchProjects, createProject, deleteProject } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickPrompt, setQuickPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const loadProjects = async () => {
    try {
      setLoading(true);
      const list = await fetchProjects();
      setProjects(list);
    } catch (err) {
      console.error("Error loading projects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateAndStart = async (name: string, initialPrompt: string) => {
    try {
      setIsCreating(true);
      const proj = await createProject(name, initialPrompt);
      if (initialPrompt && typeof window !== "undefined") {
        sessionStorage.setItem(`auto_prompt_${proj.id}`, initialPrompt);
      }
      router.push(`/project/${proj.id}`);
    } catch (err) {
      console.error("Create project error:", err);
      setIsCreating(false);
    }
  };

  const handleQuickPromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPrompt.trim()) return;
    const name = quickPrompt.slice(0, 30).trim() + " App";
    handleCreateAndStart(name, quickPrompt.trim());
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#080c16] text-slate-100 flex flex-col">
      <DashboardHeader
        onNewProject={() => setShowModal(true)}
        projectCount={projects.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-10">
        {/* Hero Section with Quick Prompt Generator */}
        <section className="relative rounded-3xl p-8 md:p-12 overflow-hidden border border-slate-800 bg-gradient-to-b from-indigo-950/40 via-slate-900/60 to-slate-950/80 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>Multi-Agent LangGraph Engine Powered by Groq</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Describe your idea. <br />
              <span className="text-gradient">Watch it build & run live.</span>
            </h1>

            <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl">
              Turn natural language prompts into complete, interactive web applications with instant in-browser live preview, Monaco code editing, and multi-agent architectural planning.
            </p>

            {/* Quick Prompt Input */}
            <form onSubmit={handleQuickPromptSubmit} className="pt-2">
              <div className="flex flex-col sm:flex-row items-center gap-2 p-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 focus-within:border-indigo-500 shadow-2xl transition-all">
                <input
                  type="text"
                  value={quickPrompt}
                  onChange={(e) => setQuickPrompt(e.target.value)}
                  placeholder="e.g. Build a futuristic crypto market dashboard with live charts..."
                  className="w-full px-4 py-3 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!quickPrompt.trim() || isCreating}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Generate App</span>
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Starter Templates Section */}
        <section>
          <StarterTemplates
            onSelectTemplate={(name, prompt) => handleCreateAndStart(name, prompt)}
          />
        </section>

        {/* Projects List Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Your Projects
              </h2>
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium">
                {projects.length}
              </span>
            </div>

            {/* Search filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {loading ? (
            <div className="h-40 flex items-center justify-center text-slate-500 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Loading projects...</span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-400 mx-auto">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">
                {searchQuery ? "No matching projects" : "No projects created yet"}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select one of the starter templates above or type a custom prompt to create your first web app.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={handleDeleteProject}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Create New Project
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Modern E-Commerce Store"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Initial Prompt / Description (Optional)
                </label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Describe what features you want the AI to generate..."
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-slate-400 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!newProjectName.trim() || isCreating}
                onClick={() =>
                  handleCreateAndStart(newProjectName.trim(), newProjectDesc.trim())
                }
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
              >
                {isCreating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Create & Open</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
