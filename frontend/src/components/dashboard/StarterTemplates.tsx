"use client";

import React from "react";
import { Sparkles, Layout, Calculator, CheckSquare, LineChart, ShoppingBag } from "lucide-react";

interface StarterTemplatesProps {
  onSelectTemplate: (name: string, prompt: string) => void;
}

const TEMPLATES = [
  {
    id: "saas-landing",
    title: "AI SaaS Landing Page",
    description: "Modern dark glassmorphic landing page with pricing calculator, FAQ accordion, and lead capture form.",
    icon: <Layout className="w-5 h-5 text-indigo-400" />,
    gradient: "from-indigo-900/40 via-purple-900/20 to-transparent",
    prompt: "Build a modern, high-converting AI SaaS Landing Page with hero section, animated statistics, feature grid, interactive pricing tiers toggle (monthly/annual), and email newsletter signup.",
  },
  {
    id: "calculator",
    title: "Scientific Calculator",
    description: "Vibrant neo-brutalist calculator with keyboard support, calculation history tape, and scientific operations.",
    icon: <Calculator className="w-5 h-5 text-pink-400" />,
    gradient: "from-pink-900/40 via-purple-900/20 to-transparent",
    prompt: "Build a colourful modern calculator with scientific functions (sin, cos, log, power), memory functions, a sliding calculation history tape, and responsive keypad with sound effects.",
  },
  {
    id: "todo-flow",
    title: "Kanban & Task Flow",
    description: "Dark-themed interactive task tracker with priority tags, progress bar, search filter, and localStorage persistence.",
    icon: <CheckSquare className="w-5 h-5 text-emerald-400" />,
    gradient: "from-emerald-900/40 via-teal-900/20 to-transparent",
    prompt: "Build an interactive dark mode task manager and kanban board with todo/in-progress/done columns, priority filters, search, statistics chart, and localStorage saving.",
  },
  {
    id: "crypto-dashboard",
    title: "Crypto Market Dashboard",
    description: "Real-time lookalike crypto tracker with live price charts, portfolio simulator, and asset converter.",
    icon: <LineChart className="w-5 h-5 text-cyan-400" />,
    gradient: "from-cyan-900/40 via-blue-900/20 to-transparent",
    prompt: "Build a futuristic crypto dashboard with live price ticker charts, portfolio value tracker, recent transactions table, and currency swap calculator.",
  },
];

export function StarterTemplates({ onSelectTemplate }: StarterTemplatesProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Starter Templates
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TEMPLATES.map((tmpl) => (
          <div
            key={tmpl.id}
            onClick={() => onSelectTemplate(tmpl.title, tmpl.prompt)}
            className="group relative rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/80 hover:border-indigo-500/40 p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${tmpl.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            
            <div className="relative space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center group-hover:scale-110 transition-transform">
                {tmpl.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                  {tmpl.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                  {tmpl.description}
                </p>
              </div>
            </div>

            <div className="relative mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
              <span>Generate App</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
