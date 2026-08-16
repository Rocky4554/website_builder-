"use client";

import React from "react";
import Link from "next/link";
import {
  Code,
  Clock,
  Trash2,
  ExternalLink,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Project } from "@/types";
import { formatDate } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  return (
    <Link
      href={`/project/${project.id}`}
      className="group rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/80 hover:border-indigo-500/40 p-5 transition-all duration-300 flex flex-col justify-between shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5 relative overflow-hidden"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
            <Layers className="w-4 h-4" />
          </div>
          <button
            onClick={(e) => onDelete(project.id, e)}
            title="Delete project"
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
            {project.name}
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
            {project.description || "Generated interactive web application"}
          </p>
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          <span>{formatDate(project.updated_at || project.created_at)}</span>
        </div>
        <div className="flex items-center gap-1 text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform">
          <span>Open</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  );
}
