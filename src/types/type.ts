// types/schema-types.ts
// Auto-generated frontend-friendly TypeScript types derived from your Prisma schema.
// - Date/DateTime fields are represented as `string` (ISO).
// - Relation fields are optional because API responses may not include them.
// - Adjust any sensitive fields (password, tokenHash) usage carefully on the client.

export type ISODateString = string;

export enum Priority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum Severity {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum NotificationType {
  TASK_ASSIGNED = "TASK_ASSIGNED",
  TASK_UPDATED = "TASK_UPDATED",
  COMMENT_ADDED = "COMMENT_ADDED",
  MENTIONED = "MENTIONED",
  SYSTEM = "SYSTEM",
}

/* ---------------------------
   User
   Note: password and refreshTokens are included because they exist
   in the schema — avoid shipping them to frontend responses.
   --------------------------- */
export interface User {
  id: number;
  email: string;
  name: string;
  password: string;
  createdAt: ISODateString;

  // Relations (optional)
  memberships?: TeamMember[];
  tasksAssignedBy?: Task[]; // tasks this user assigned
  tasksAssignedTo?: Task[]; // tasks assigned to this user
  createdTeams?: Team[]; // teams user created
  projects?: Project[];
  createdMembers?: TeamMember[]; // team members added by this user
  activities?: Activity[];
}

/* ---------------------------
   Team
   --------------------------- */
export interface Team {
  id: number;
  name: string;
  about: string;
  createdAt: ISODateString;
  creatorId: string;

  // Relations
  creator?: User;
  members?: TeamMember[];
  projects?: Project[];
}
export enum TeamRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}
/* ---------------------------
   TeamMember
   --------------------------- */
export interface TeamMember {
  id: number;
  teamId: number;
  userId: string | null; // optional until signup
  email: string;
  name: string | null;
  role: TeamRole;
  addedAt: ISODateString;
  addedById: string | null;

  // Relations
  team?: Team;
  user?: User | null;
  addedBy?: User | null;
}

/* ---------------------------
   Project
   --------------------------- */
export interface Project {
  id: number;
  name: string;
  description: string;
  createdAt: ISODateString;

  teamId: number | null;
  creatorId: number | null;

  // Relations
  team?: Team | null;
  creator?: User | null;
  tasks?: Task[];
  status?: TaskStatus[]; // statuses for the project
  lists?: List[];
}

/* ---------------------------
   List
   --------------------------- */
export interface List {
  id: number;
  name: string;
  projectId: number;
  createdAt: ISODateString;

  // Relations
  project?: Project;
  tasks?: Task[];
}

/* ---------------------------
   Task
   --------------------------- */
export interface Task {
  id: number | string;
  name: string;
  description: string | null;
  createdAt: ISODateString;

  priority: Priority;
  dueDate: ISODateString | null;

  parentTaskId: number | null;
  projectId: number;
  listId: number | null;

  assignedById: number | null;
  assigneeId: number | null;

  // TaskStatus relation
  statusId: number | string | null;

  // Relations (optional)
  parentTask?: Task | null;
  subTasks?: Task[];
  project?: Project;
  list?: List | null;
  assignedBy?: User | null;
  assignee?: User | null;
  activities?: Activity[];
  status?: TaskStatus | null;
}

/* ---------------------------
   TaskStatus
   --------------------------- */
export interface TaskStatus {
  id: number;
  name: string;
  color: string | null;
  sortOrder: number | null;
  createdAt: ISODateString;

  projectId: number;

  // Relations
  project?: Project;
  tasks?: Task[];
}
export type ActivityKind = "COMMENT" | "TASK_UPDATE" | "SYSTEM" | "NOTE" | "WORKLOG";

export interface Activity {
  id: number;
  kind: ActivityKind;
  description: string | null;
  metadata: unknown | null;
  createdAt: string; // ISO string (Prisma returns Date but API -> JSON string)

  taskId: number | null;
  userId: number | null;

  parentId: number | null;
  user?: User;
}

export interface Notification {
  id: number;
  userId: string;
  type: NotificationType;
  severity: Severity;
  title: string;
  message: string | null;
  link: string | null;
  isRead: boolean;
  metadata: unknown | null;
  createdAt: ISODateString;
  readAt: ISODateString | null;
}

export enum SubscriptionStatus {
  TRIALING = "TRIALING",
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELED = "CANCELED",
  INCOMPLETE = "INCOMPLETE",
  EXPIRED = "EXPIRED",
}

export interface TeamSubscription {
  id: string;
  teamId: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  priceId: string | null;
  status: SubscriptionStatus;
  trialEndsAt: ISODateString | null;
  currentPeriodStart: ISODateString | null;
  currentPeriodEnd: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface StripePrice {
  id: string;
  nickname: string | null;
  currency: string;
  unitAmount: number | null;
  recurring: { interval: string; intervalCount: number } | null;
  product: { id: string; name: string; description: string | null } | null;
}

/* ---------------------------
   Convenience: Auth slice / UI-related types
   (based on your usage in ProtectedRoutes)
   --------------------------- */

export interface AuthState {
  userProject: Project | undefined;
  userTeam: Team | undefined;
  // you can extend this with user, token, etc.
}

export enum ViewMode {
  KANBAN = "kanban",
  LIST = "list",
  CALENDAR = "calendar",
  SWIMLANE = "swimlane",
  TIMELINE = "timeline",
  REPORT = "report",
}
export const ViewModeLabel: Record<ViewMode, string> = {
  [ViewMode.KANBAN]: "Kanban",
  [ViewMode.LIST]: "List",
  [ViewMode.CALENDAR]: "Calendar",
  [ViewMode.SWIMLANE]: "Swimlane",
  [ViewMode.TIMELINE]: "Timeline",
  [ViewMode.REPORT]: "Report",
};
