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
  refreshTokens?: RefreshToken[];
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
  creatorId: number;

  // Relations
  creator?: User;
  members?: TeamMember[];
  projects?: Project[];
}

/* ---------------------------
   TeamMember
   --------------------------- */
export interface TeamMember {
  id: number;
  teamId: number;
  userId: number | null; // optional until signup
  email: string;
  name: string | null;
  role: string;
  addedAt: ISODateString;
  addedById: number | null;

  // Relations
  team?: Team;
  user?: User | null;
  addedBy?: User | null;
}

/* ---------------------------
   RefreshToken
   --------------------------- */
export interface RefreshToken {
  id: number;
  tokenHash: string;
  userId: number;
  createdAt: ISODateString;
  expiresAt: ISODateString;

  // Relations
  user?: User;
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
