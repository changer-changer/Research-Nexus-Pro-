import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FavoriteItem, Paper } from '../types/paperGeneration'
import type { Bookmark } from './appStore'

export interface UserProfile {
  id: string
  name: string
  email: string
  password: string
  createdAt: number
  lastLoginAt: number
}

export interface StoredInnovation {
  id: string
  innovationId: string
  name: string
  description: string
  noveltyScore: number
  feasibilityScore: number
  notes: string
  savedAt: number
}

export interface StoredPaper {
  id: string
  paperId: string
  taskId: string
  title: string
  venue: string
  status: string
  updatedAt: number
  savedAt: number
}

export interface StoredBookmark {
  id: string
  nodeType: Bookmark['nodeType']
  nodeId: string
  note: string
  color: string
  savedAt: number
}

export interface UserKnowledgeData {
  innovations: StoredInnovation[]
  papers: StoredPaper[]
  bookmarks: StoredBookmark[]
  manifesto: string
}

interface UserStoreState {
  users: UserProfile[]
  currentUserId: string | null
  userData: Record<string, UserKnowledgeData>
  register: (name: string, email: string, password: string) => { ok: true } | { ok: false; error: string }
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string }
  logout: () => void
  updateManifesto: (manifesto: string) => void
  syncFromSystem: (favorites: FavoriteItem[], papers: Paper[], bookmarks: Bookmark[]) => void
  removeInnovation: (id: string) => void
  removePaper: (id: string) => void
  removeBookmark: (id: string) => void
}

const defaultKnowledgeData = (): UserKnowledgeData => ({
  innovations: [],
  papers: [],
  bookmarks: [],
  manifesto:
    '以问题为中心，以证据为边界，以跨域创新为驱动。我们追求可验证、可复现、可扩展的科研设计。',
})

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

const getCurrentData = (state: UserStoreState): UserKnowledgeData => {
  if (!state.currentUserId) return defaultKnowledgeData()
  return state.userData[state.currentUserId] ?? defaultKnowledgeData()
}

export const useUserStore = create<UserStoreState>()(
  persist(
    (set, get) => ({
      users: [],
      currentUserId: null,
      userData: {},

      register: (name, email, password) => {
        const normalizedEmail = normalizeEmail(email)
        const trimmedName = name.trim()
        const trimmedPassword = password.trim()

        if (!trimmedName || !normalizedEmail || !trimmedPassword) {
          return { ok: false, error: '请完整填写姓名、邮箱和密码。' }
        }
        if (trimmedPassword.length < 6) {
          return { ok: false, error: '密码至少需要 6 位。' }
        }

        const state = get()
        if (state.users.some((user) => normalizeEmail(user.email) === normalizedEmail)) {
          return { ok: false, error: '该邮箱已注册，请直接登录。' }
        }

        const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const timestamp = Date.now()
        const newUser: UserProfile = {
          id: userId,
          name: trimmedName,
          email: normalizedEmail,
          password: trimmedPassword,
          createdAt: timestamp,
          lastLoginAt: timestamp,
        }

        set({
          users: [...state.users, newUser],
          currentUserId: userId,
          userData: {
            ...state.userData,
            [userId]: defaultKnowledgeData(),
          },
        })
        return { ok: true }
      },

      login: (email, password) => {
        const normalizedEmail = normalizeEmail(email)
        const state = get()
        const user = state.users.find(
          (candidate) =>
            normalizeEmail(candidate.email) === normalizedEmail &&
            candidate.password === password,
        )

        if (!user) {
          return { ok: false, error: '邮箱或密码错误。' }
        }

        const updatedUsers = state.users.map((candidate) =>
          candidate.id === user.id ? { ...candidate, lastLoginAt: Date.now() } : candidate,
        )

        set({
          users: updatedUsers,
          currentUserId: user.id,
          userData: {
            ...state.userData,
            [user.id]: state.userData[user.id] ?? defaultKnowledgeData(),
          },
        })

        return { ok: true }
      },

      logout: () => {
        set({ currentUserId: null })
      },

      updateManifesto: (manifesto) => {
        const state = get()
        if (!state.currentUserId) return
        const currentData = state.userData[state.currentUserId] ?? defaultKnowledgeData()
        set({
          userData: {
            ...state.userData,
            [state.currentUserId]: {
              ...currentData,
              manifesto,
            },
          },
        })
      },

      syncFromSystem: (favorites, papers, bookmarks) => {
        const state = get()
        if (!state.currentUserId) return

        const currentData = state.userData[state.currentUserId] ?? defaultKnowledgeData()
        const innovationMap = new Map(currentData.innovations.map((item) => [item.innovationId, item]))
        const paperMap = new Map(currentData.papers.map((item) => [item.paperId, item]))
        const bookmarkMap = new Map(currentData.bookmarks.map((item) => [item.id, item]))

        favorites.forEach((favorite) => {
          innovationMap.set(favorite.innovation.id, {
            id: innovationMap.get(favorite.innovation.id)?.id ?? `uin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            innovationId: favorite.innovation.id,
            name: favorite.innovation.name,
            description: favorite.innovation.description,
            noveltyScore: favorite.innovation.noveltyScore,
            feasibilityScore: favorite.innovation.feasibilityScore,
            notes: favorite.notes || '',
            savedAt: Date.now(),
          })
        })

        papers.forEach((paper) => {
          paperMap.set(paper.id, {
            id: paperMap.get(paper.id)?.id ?? `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            paperId: paper.id,
            taskId: paper.taskId,
            title: paper.title,
            venue: paper.venue,
            status: paper.status,
            updatedAt: new Date(paper.updatedAt).getTime(),
            savedAt: Date.now(),
          })
        })

        bookmarks.forEach((bookmark) => {
          bookmarkMap.set(bookmark.id, {
            id: bookmark.id,
            nodeType: bookmark.nodeType,
            nodeId: bookmark.nodeId,
            note: bookmark.note,
            color: bookmark.color,
            savedAt: Date.now(),
          })
        })

        set({
          userData: {
            ...state.userData,
            [state.currentUserId]: {
              ...currentData,
              innovations: Array.from(innovationMap.values()).sort((a, b) => b.savedAt - a.savedAt),
              papers: Array.from(paperMap.values()).sort((a, b) => b.savedAt - a.savedAt),
              bookmarks: Array.from(bookmarkMap.values()).sort((a, b) => b.savedAt - a.savedAt),
            },
          },
        })
      },

      removeInnovation: (id) => {
        const state = get()
        if (!state.currentUserId) return
        const currentData = getCurrentData(state)
        set({
          userData: {
            ...state.userData,
            [state.currentUserId]: {
              ...currentData,
              innovations: currentData.innovations.filter((item) => item.id !== id),
            },
          },
        })
      },

      removePaper: (id) => {
        const state = get()
        if (!state.currentUserId) return
        const currentData = getCurrentData(state)
        set({
          userData: {
            ...state.userData,
            [state.currentUserId]: {
              ...currentData,
              papers: currentData.papers.filter((item) => item.id !== id),
            },
          },
        })
      },

      removeBookmark: (id) => {
        const state = get()
        if (!state.currentUserId) return
        const currentData = getCurrentData(state)
        set({
          userData: {
            ...state.userData,
            [state.currentUserId]: {
              ...currentData,
              bookmarks: currentData.bookmarks.filter((item) => item.id !== id),
            },
          },
        })
      },
    }),
    {
      name: 'research-nexus-user-store-v1',
      partialize: (state) => ({
        users: state.users,
        currentUserId: state.currentUserId,
        userData: state.userData,
      }),
    },
  ),
)
