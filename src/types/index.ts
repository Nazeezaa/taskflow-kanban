// TaskFlow is a Trello-backed KPI dashboard. Type definitions for the few
// shared frontend types we still need.

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
