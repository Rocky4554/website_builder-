import { Project, ProjectFile, Message, GenerationEvent } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8001/api/ai";
const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE || "ws://localhost:8001/api/ai";
const AUTH_TOKEN = "dev-token";

export async function fetchProjects(): Promise<Project[]> {
  try {
    const res = await fetch(`${API_BASE}/projects`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    if (!res.ok) throw new Error("Failed to fetch projects");
    return await res.json();
  } catch (err) {
    console.warn("Backend unavailable, loading local storage projects", err);
    return getLocalProjects();
  }
}

export async function createProject(name: string, description?: string): Promise<Project> {
  try {
    const res = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error("Failed to create project");
    return await res.json();
  } catch (err) {
    console.warn("Backend unavailable, creating local project", err);
    return createLocalProject(name, description);
  }
}

export async function fetchProject(id: string): Promise<Project> {
  try {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    if (!res.ok) throw new Error("Failed to fetch project");
    return await res.json();
  } catch (err) {
    console.warn("Backend unavailable, fetching local project", err);
    const local = getLocalProject(id);
    if (!local) throw new Error("Project not found");
    return local;
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    if (!res.ok) throw new Error("Failed to delete project");
  } catch (err) {
    deleteLocalProject(id);
  }
}

export async function fetchMessages(projectId: string): Promise<Message[]> {
  try {
    const res = await fetch(`${API_BASE}/projects/${projectId}/messages`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    if (!res.ok) throw new Error("Failed to fetch messages");
    return await res.json();
  } catch (err) {
    return getLocalMessages(projectId);
  }
}

export async function fetchProjectFiles(projectId: string): Promise<ProjectFile[]> {
  try {
    const res = await fetch(`${API_BASE}/projects/${projectId}/files`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    if (!res.ok) throw new Error("Failed to fetch files");
    const metaList = await res.json();
    const fullFiles: ProjectFile[] = [];
    for (const f of metaList) {
      const fres = await fetch(`${API_BASE}/projects/${projectId}/files/${f.id}`, {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      });
      if (fres.ok) {
        fullFiles.push(await fres.json());
      }
    }
    return fullFiles;
  } catch (err) {
    return getLocalFiles(projectId);
  }
}

/**
 * Connect to generation stream over WebSocket.
 */
export function streamProjectGeneration(
  projectId: string,
  prompt: string,
  onEvent: (event: GenerationEvent) => void,
  onClose?: () => void
): () => void {
  const wsUrl = `${WS_BASE}/projects/${projectId}/generate`;
  let ws: WebSocket | null = null;
  let isClosed = false;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws?.send(
        JSON.stringify({
          token: AUTH_TOKEN,
          prompt: prompt,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as GenerationEvent;
        onEvent(data);
      } catch (e) {
        console.error("Malformed event:", event.data);
      }
    };

    ws.onerror = (err) => {
      console.warn("WebSocket error:", err);
      // Fallback local simulated generation for demo if backend is offline
      simulateOfflineGeneration(projectId, prompt, onEvent);
    };

    ws.onclose = () => {
      if (!isClosed) {
        onClose?.();
      }
    };
  } catch (e) {
    console.warn("Could not initiate WebSocket:", e);
    simulateOfflineGeneration(projectId, prompt, onEvent);
  }

  return () => {
    isClosed = true;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  };
}

// --- Local Storage Fallback Helpers ---

const STORAGE_KEY = "wb_projects_cache";
const FILES_STORAGE_KEY = "wb_files_cache";
const MSG_STORAGE_KEY = "wb_msgs_cache";

function getLocalProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultStarterProjects();
    return JSON.parse(raw);
  } catch {
    return getDefaultStarterProjects();
  }
}

function createLocalProject(name: string, description?: string): Project {
  const newProj: Project = {
    id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    description: description || "Interactive web application",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    files: [],
  };
  const projects = getLocalProjects();
  projects.unshift(newProj);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  return newProj;
}

function getLocalProject(id: string): Project | null {
  const projects = getLocalProjects();
  return projects.find((p) => p.id === id) || null;
}

function deleteLocalProject(id: string) {
  const projects = getLocalProjects().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function getLocalFiles(projectId: string): ProjectFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${FILES_STORAGE_KEY}_${projectId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalFiles(projectId: string, files: ProjectFile[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${FILES_STORAGE_KEY}_${projectId}`, JSON.stringify(files));
}

function getLocalMessages(projectId: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${MSG_STORAGE_KEY}_${projectId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalMessages(projectId: string, msgs: Message[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${MSG_STORAGE_KEY}_${projectId}`, JSON.stringify(msgs));
}

function getDefaultStarterProjects(): Project[] {
  return [
    {
      id: "demo-calculator",
      name: "Neo-Brutalist Calculator",
      description: "A responsive vibrant calculator with scientific functions and history log",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: "demo-todo",
      name: "Kanban & Task Flow",
      description: "Dark-themed interactive task tracker with drag-and-drop and statistics",
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ];
}

function simulateOfflineGeneration(
  projectId: string,
  prompt: string,
  onEvent: (event: GenerationEvent) => void
) {
  onEvent({ type: "status", node: "planner" });
  setTimeout(() => {
    onEvent({ type: "status", node: "architect" });
  }, 1000);

  setTimeout(() => {
    onEvent({ type: "status", node: "coder" });
    const htmlContent = generateSampleHtml(prompt);
    const cssContent = generateSampleCss();
    const jsContent = generateSampleJs(prompt);

    onEvent({ type: "file", path: "index.html", content: htmlContent });
    setTimeout(() => {
      onEvent({ type: "file", path: "styles.css", content: cssContent });
      setTimeout(() => {
        onEvent({ type: "file", path: "app.js", content: jsContent });
        setTimeout(() => {
          onEvent({ type: "complete" });
        }, 500);
      }, 500);
    }, 500);
  }, 2000);
}

function generateSampleHtml(prompt: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${prompt.slice(0, 30)} - Generated App</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
  <!-- Top Navigation -->
  <header class="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
        <i class="fa-solid fa-sparkles text-white text-sm"></i>
      </div>
      <div>
        <h1 class="text-base font-bold tracking-tight text-white flex items-center gap-2">
          ${prompt.slice(0, 35)}
          <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium border border-indigo-500/30">Live</span>
        </h1>
        <p class="text-xs text-slate-400">AI Generated interactive preview</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button id="themeToggle" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors border border-slate-700/60">
        <i class="fa-solid fa-moon mr-1.5"></i> Theme
      </button>
      <button id="actionBtn" class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5">
        <i class="fa-solid fa-plus"></i> New Item
      </button>
    </div>
  </header>

  <!-- Main Content Area -->
  <main class="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-6">
    <!-- Hero / Stats Section -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="glass-card p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm relative overflow-hidden">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Items</div>
        <div id="statTotal" class="text-3xl font-extrabold text-white mt-1">4</div>
        <div class="text-xs text-emerald-400 mt-2 flex items-center gap-1">
          <i class="fa-solid fa-arrow-trend-up"></i> +12% active this session
        </div>
      </div>
      <div class="glass-card p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm relative overflow-hidden">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed</div>
        <div id="statCompleted" class="text-3xl font-extrabold text-indigo-400 mt-1">2</div>
        <div class="text-xs text-slate-400 mt-2">50% completion rate</div>
      </div>
      <div class="glass-card p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm relative overflow-hidden">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">System Status</div>
        <div class="text-3xl font-extrabold text-emerald-400 mt-1 flex items-center gap-2">
          <span>Active</span>
          <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <div class="text-xs text-slate-400 mt-2">All components responding</div>
      </div>
    </div>

    <!-- Interactive Workspace Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Input Panel -->
      <div class="glass-card p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4">
        <h2 class="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <i class="fa-solid fa-sliders text-indigo-400"></i> Control Panel
        </h2>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Item Title</label>
          <input id="itemInput" type="text" placeholder="Enter item name..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors">
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
          <select id="categorySelect" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors">
            <option value="Feature">🚀 Feature</option>
            <option value="Bug">🐛 Bug Fix</option>
            <option value="Design">🎨 Design</option>
            <option value="Core">⚡ Core</option>
          </select>
        </div>
        <button id="addBtn" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold text-white text-sm shadow-lg shadow-indigo-500/25 transition-all active:scale-95">
          Add Entry
        </button>
      </div>

      <!-- Items List -->
      <div class="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <i class="fa-solid fa-list-check text-purple-400"></i> Active Items
          </h2>
          <span id="itemsCounter" class="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 font-medium">4 items</span>
        </div>
        <div id="itemsList" class="space-y-2.5">
          <!-- Dynamic Items inserted here -->
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
    Generated with Website Builder AI &bull; Interactive Web Preview
  </footer>

  <script src="app.js"></script>
</body>
</html>`;
}

function generateSampleCss() {
  return `/* Custom styling for generated project */
.glass-card {
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  transition: all 0.2s ease-in-out;
}
.glass-card:hover {
  border-color: rgba(99, 102, 241, 0.4);
}
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #0f172a;
}
::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #475569;
}`;
}

function generateSampleJs(prompt: string) {
  return `// Interactive JavaScript logic
document.addEventListener('DOMContentLoaded', () => {
  const items = [
    { id: 1, text: 'Initialize project structure', category: 'Core', done: true },
    { id: 2, text: 'Design dark glassmorphism layout', category: 'Design', done: true },
    { id: 3, text: 'Implement dynamic event handlers', category: 'Feature', done: false },
    { id: 4, text: 'Test responsive mobile viewport', category: 'Feature', done: false },
  ];

  const listContainer = document.getElementById('itemsList');
  const input = document.getElementById('itemInput');
  const categorySelect = document.getElementById('categorySelect');
  const addBtn = document.getElementById('addBtn');
  const statTotal = document.getElementById('statTotal');
  const statCompleted = document.getElementById('statCompleted');
  const itemsCounter = document.getElementById('itemsCounter');

  function render() {
    listContainer.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = \`flex items-center justify-between p-3.5 rounded-xl border transition-all \${
        item.done ? 'bg-slate-950/60 border-slate-800/40 opacity-75' : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
      }\`;
      
      el.innerHTML = \`
        <div class="flex items-center gap-3">
          <button class="toggle-btn w-5 h-5 rounded-lg border \${
            item.done ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-600 hover:border-indigo-400'
          } flex items-center justify-center text-xs transition-colors">
            \${item.done ? '<i class="fa-solid fa-check"></i>' : ''}
          </button>
          <span class="\${item.done ? 'line-through text-slate-400' : 'text-slate-200 font-medium'} text-sm">\${item.text}</span>
          <span class="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-mono">\${item.category}</span>
        </div>
        <button class="delete-btn text-slate-500 hover:text-rose-400 transition-colors p-1.5">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      \`;

      el.querySelector('.toggle-btn').addEventListener('click', () => {
        item.done = !item.done;
        updateStats();
        render();
      });

      el.querySelector('.delete-btn').addEventListener('click', () => {
        const idx = items.findIndex(i => i.id === item.id);
        if (idx !== -1) {
          items.splice(idx, 1);
          updateStats();
          render();
        }
      });

      listContainer.appendChild(el);
    });

    updateStats();
  }

  function updateStats() {
    const total = items.length;
    const completed = items.filter(i => i.done).length;
    statTotal.textContent = total;
    statCompleted.textContent = completed;
    itemsCounter.textContent = \`\${total} item\${total === 1 ? '' : 's'}\`;
  }

  function addItem() {
    const text = input.value.trim();
    if (!text) return;
    items.push({
      id: Date.now(),
      text,
      category: categorySelect.value,
      done: false
    });
    input.value = '';
    render();
  }

  addBtn.addEventListener('click', addItem);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addItem();
  });

  render();
  console.log("App mounted successfully for prompt:", "${prompt}");
});`;
}
