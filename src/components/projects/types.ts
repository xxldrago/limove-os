export interface Credential {
  id: number;
  serviceName: string;
  login: string | null;
  passwordEnc: string;
  url: string | null;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DomainRecord {
  id: number;
  projectId: number | null;
  name: string;
  value: string;
  expiresAt: string;
  reminderDays: number;
  notes: string | null;
  createdAt: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: number | null;
  dueDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  id: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: number;
  createdAt: string;
}

export interface InvoiceRecord {
  id: number;
  invoiceNumber: string | null;
  description: string;
  amount: string;
  projectId: number | null;
  status: string; // PENDING | PAID | CANCELLED
  paymentMethod: string | null; // CASH | BANK_TRANSFER
  paidById: number | null;
  dueDate: string | null;
  invoiceFile: string | null;
  receiptFile: string | null;
  paidDate: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdById: number;
  createdAt: string;
}

export interface SiteMonitorSummary {
  id: number;
  name: string;
  url: string;
  lastStatus: number | null;
  isError: boolean;
  checkedAt: string;
  isActive: boolean;
}

/** A project exactly as the server renders it (Dates already -> ISO strings). */
export interface SerializedProject extends ProjectData {
  createdAt: string;
  updatedAt: string;
}

export interface ProjectData {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  credentials: Credential[];
  domains: DomainRecord[];
  tasks: Task[];
  notes: Note[];
  files: ProjectFile[];
  siteMonitors: SiteMonitorSummary[];
  siteStatus: "UP" | "DOWN" | "UNKNOWN";
  invoices: InvoiceRecord[];
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  taskCounts: {
    BACKLOG: number;
    TODO: number;
    IN_PROGRESS: number;
    REVIEW: number;
    DONE: number;
  };
}

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активен",
  PAUSED: "На паузе",
  ARCHIVED: "Архив",
};

export const EXPECTED_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"];
