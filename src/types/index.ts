export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface Comment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: number;
  isCover?: boolean;
  createdAt: string;
}

export interface CardActivity {
  id: string;
  type: 'created' | 'moved' | 'completed' | 'comment' | 'assigned' | 'label';
  fromListId?: string;
  fromListTitle?: string;
  toListId?: string;
  toListTitle?: string;
  detail?: string;
  timestamp: string;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  listId: string;
  position: number;
  labels: Label[];
  dueDate?: string;
  startDate?: string;
  coverImage?: string;
  coverColor?: string;
  checklists: Checklist[];
  comments: Comment[];
  attachments: Attachment[];
  members: Member[];
  activities: CardActivity[];
  isWatching: boolean;
  archived: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface List {
  id: string;
  title: string;
  boardId: string;
  position: number;
  icon?: string;
  color?: string;
  cards: Card[];
}

export interface Board {
  id: string;
  title: string;
  backgroundImage?: string;
  backgroundColor?: string;
  lists: List[];
  labels: Label[];
  members: Member[];
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  color: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
