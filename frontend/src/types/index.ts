export interface Project {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
  files?: ProjectFile[];
}

export interface ProjectFile {
  id?: string;
  project_id?: string;
  path: string;
  content: string;
  updated_at?: string;
}

export interface Message {
  id?: string;
  project_id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
  statusNode?: "planner" | "architect" | "coder";
  plan?: {
    app_name?: string;
    features?: string[];
    tech_stack?: string[];
  };
  isStreaming?: boolean;
}

export type DeviceMode = "desktop" | "tablet" | "mobile";
export type BuilderMode = "auto" | "plan";

export interface GenerationEvent {
  type: "status" | "file" | "complete" | "error" | "plan";
  node?: "planner" | "architect" | "coder";
  path?: string;
  content?: string;
  message?: string;
  plan?: any;
}
