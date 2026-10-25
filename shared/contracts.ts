export type Role = 'teacher' | 'ta' | 'student';
export interface Identity {
  id: string;
  name: string;
  role: Role;
  demo: boolean;
}
export interface Settings {
  studentAI: boolean;
  hintPolicy: 'conceptual' | 'step';
  taAI: boolean;
  opensAt: string;
  closesAt: string;
}
interface BaseBlock {
  id: string;
  title: string;
}
export type PublicBlock =
  | (BaseBlock & { type: 'markdown'; text: string })
  | (BaseBlock & { type: 'code'; code: string; language: string })
  | (BaseBlock & { type: 'image'; url: string; alt: string })
  | (BaseBlock & { type: 'answer'; input: 'text' | 'number'; units: string })
  | (BaseBlock & {
      type: 'checkpoint';
      mode: 'automatic' | 'ta';
      answerIds: string[];
      required: boolean;
    });
export interface PublicLab {
  id: string;
  labId: string;
  title: string;
  blocks: PublicBlock[];
  settings: Settings;
  publishedAt: string;
}
export interface Answer {
  blockId: string;
  value: string;
  units: string;
  submittedAt: string;
}
export interface Completion {
  blockId: string;
  method: 'automatic' | 'ta';
  verifiedAt: string;
}
export type RequestState = 'waiting' | 'claimed' | 'resolved' | 'cancelled';
export interface QueueRequest {
  id: string;
  studentId: string;
  studentName: string;
  demo: boolean;
  type: 'help' | 'checkoff';
  blockId: string;
  description: string;
  state: RequestState;
  claimedBy: string | null;
  createdAt: string;
}
export interface StudentProgress {
  student: Identity;
  currentBlockId: string | null;
  answers: Answer[];
  completions: Completion[];
  requests: QueueRequest[];
}
export interface StudentState {
  lab: PublicLab;
  progress: StudentProgress;
}
export interface StaffState {
  lab: PublicLab;
  students: StudentProgress[];
  requests: QueueRequest[];
  instructorContext: Record<string, string>;
  stats: {
    total: number;
    completed: number;
    checkpoints: { id: string; title: string; verified: number; total: number }[];
  };
}
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  mock: boolean;
}
export interface AssistantReply {
  text: string;
  mock: boolean;
  model: string;
}
export interface PublicationLink {
  id: string;
  title: string;
  publishedAt: string;
}
