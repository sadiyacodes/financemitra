import fs from 'fs';
import path from 'path';
import { UserProfile, Transaction } from '../types';

let usersCache: UserProfile[] | null = null;
let transactionsCache: Transaction[] | null = null;

export function loadUsers(): UserProfile[] {
  if (usersCache) return usersCache;
  const filePath = path.join(process.cwd(), 'data', 'users.json');
  if (fs.existsSync(filePath)) {
    usersCache = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } else {
    usersCache = [];
  }
  return usersCache!;
}

export function loadTransactions(): Transaction[] {
  if (transactionsCache) return transactionsCache;
  const filePath = path.join(process.cwd(), 'data', 'transactions.json');
  if (fs.existsSync(filePath)) {
    transactionsCache = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } else {
    transactionsCache = [];
  }
  return transactionsCache!;
}

export function getUserProfile(userId: string): UserProfile | undefined {
  const users = loadUsers();
  return users.find(u => u.id === userId);
}

export function updateUserProfile(userId: string, updates: Partial<UserProfile>): UserProfile | undefined {
  const users = loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...updates };
    usersCache = users; // update in-memory
    return users[idx];
  }
  return undefined;
}

export function getUserTransactions(userId: string): Transaction[] {
  const allTxns = loadTransactions();
  return allTxns.filter(t => t.user_id === userId);
}
