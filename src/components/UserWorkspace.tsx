import { FormEvent, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Bookmark,
  Compass,
  LogOut,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  Flame,
  Zap,
  Award,
  ArrowLeft,
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { usePaperGenerationStore } from '../store/paperGenerationStore'
import { useUserStore } from '../store/userStore'
import PaperGenerationHistory from './PaperGenerationHistory'

type AuthMode = 'login' | 'register'
type UserTab = 'innovations' | 'papers' | 'bookmarks'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

const tabUnderlineVariants = {
  innovations: { x: '0%' },
  papers: { x: '100%' },
  bookmarks: { x: '200%' },
}

export default function UserWorkspace() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { viewConfig, bookmarks } = useAppStore()
  const { favorites, papers, fetchFavorites, fetchPapers } = usePaperGenerationStore()
  const {
    users,
    currentUserId,
    userData,
    register,
    login,
    logout,
    syncFromSystem,
    updateManifesto,
    removeInnovation,
    removePaper,
    removeBookmark,
  } = useUserStore()

  const [mode, setMode] = useState<AuthMode>('login')
  const [tab, setTab] = useState<UserTab>('innovations')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [users, currentUserId],
  )
  const currentData = useMemo(
    () =>
      currentUserId
        ? userData[currentUserId] ?? {
            innovations: [],
            papers: [],
            bookmarks: [],
            manifesto: '',
          }
        : null,
    [currentUserId, userData],
  )

  const handleAuthSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const result =
      mode === 'register' ? register(name, email, password) : login(email, password)
    if (!result.ok) {
      setError(result.error)
      return
    }

    void fetchFavorites()
    void fetchPapers()
    setPassword('')
  }

  const handleSync = () => {
    syncFromSystem(favorites, papers, bookmarks)
  }

  // Generate avatar initials
  const getInitials = (nameStr: string) => {
    return nameStr
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Generate a consistent color from name
  const getAvatarColor = (nameStr: string) => {
    const colors = [
      '#6366f1',
      '#3b82f6',
      '#10b981',
      '#f43f5e',
      '#f59e0b',
      '#8b5cf6',
    ]
    let hash = 0
    for (let i = 0; i < nameStr.length; i++) {
      hash = nameStr.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-3xl border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-default)',
            }}
          >
            <div className="relative grid gap-10 p-8 lg:grid-cols-2 lg:p-12">
              {/* Left: branding */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex flex-col justify-center"
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--accent-dim)',
                    borderColor: 'var(--accent-border)',
                    color: 'var(--accent-light)',
                  }}
                >
                  <Sparkles size={14} className="animate-pulse" />
                  Personal Research Workspace
                </motion.div>
                <h1
                  className="text-4xl font-extrabold tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('workspace.loginTitle')}
                  <span style={{ color: 'var(--accent-light)' }}>{t('workspace.loginHighlight')}</span>
                </h1>
                <p
                  className="mt-4 max-w-md text-base leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('workspace.loginDesc')}
                </p>

                <div className="mt-8 space-y-3">
                  {[
                    { icon: Zap, text: t('workspace.syncHint') },
                    { icon: Award, text: t('workspace.manifesto') },
                    { icon: Compass, text: t('workspace.noBookmarks') },
                  ].map((feature, idx) => (
                    <motion.div
                      key={feature.text}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + idx * 0.1 }}
                      className="flex items-center gap-3 text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: 'var(--accent-dim)',
                          color: 'var(--accent-light)',
                        }}
                      >
                        <feature.icon size={14} />
                      </div>
                      {feature.text}
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Right: form */}
              <motion.form
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                onSubmit={handleAuthSubmit}
                className="space-y-5"
              >
                {/* Tab switcher */}
                <div
                  className="flex rounded-2xl p-1.5 text-sm"
                  style={{ backgroundColor: 'var(--bg-surface)' }}
                >
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="relative flex-1 rounded-xl px-4 py-2.5 font-medium transition-all duration-300"
                    style={{
                      color:
                        mode === 'login'
                          ? 'var(--text-primary)'
                          : 'var(--text-tertiary)',
                    }}
                  >
                    {mode === 'login' && (
                      <motion.div
                        layoutId="authTabBg"
                        className="absolute inset-0 rounded-xl"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    <span className="relative z-10">{t('workspace.login')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="relative flex-1 rounded-xl px-4 py-2.5 font-medium transition-all duration-300"
                    style={{
                      color:
                        mode === 'register'
                          ? 'var(--text-primary)'
                          : 'var(--text-tertiary)',
                    }}
                  >
                    {mode === 'register' && (
                      <motion.div
                        layoutId="authTabBg"
                        className="absolute inset-0 rounded-xl"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    <span className="relative z-10">{t('workspace.register')}</span>
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {mode === 'register' && (
                    <motion.div
                      key="name-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <label
                        className="mb-1.5 block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('workspace.name')}
                      </label>
                      <div className="relative">
                        <UserRound
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                          style={{
                            color:
                              focusedField === 'name'
                                ? 'var(--accent-light)'
                                : 'var(--text-muted)',
                          }}
                        />
                        <input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          onFocus={() => setFocusedField('name')}
                          onBlur={() => setFocusedField(null)}
                          placeholder={t('workspace.namePlaceholder')}
                          className="w-full rounded-xl border px-4 py-3 pl-11 text-sm outline-none transition-all duration-300"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label
                    className="mb-1.5 block text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('workspace.email')}
                  </label>
                  <div className="relative">
                    <div
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold transition-colors"
                      style={{
                        color:
                          focusedField === 'email'
                            ? 'var(--accent-light)'
                            : 'var(--text-muted)',
                      }}
                    >
                      @
                    </div>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="name@example.com"
                      type="email"
                      className="w-full rounded-xl border px-4 py-3 pl-11 text-sm outline-none transition-all duration-300"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="mb-1.5 block text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('workspace.password')}
                  </label>
                  <div className="relative">
                    <div
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold transition-colors"
                      style={{
                        color:
                          focusedField === 'password'
                            ? 'var(--accent-light)'
                            : 'var(--text-muted)',
                      }}
                    >
                      **
                    </div>
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="至少 6 位字符"
                      type="password"
                      className="w-full rounded-xl border px-4 py-3 pl-11 text-sm outline-none transition-all duration-300"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      className="rounded-xl border px-4 py-3 text-sm"
                      style={{
                        backgroundColor: 'var(--error-dim)',
                        borderColor: 'rgba(239, 68, 68, 0.2)',
                        color: 'var(--error)',
                      }}
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition-shadow"
                  style={{
                    backgroundColor: 'var(--accent)',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  {mode === 'register' ? t('workspace.createAccount') : t('workspace.loginSubmit')}
                </motion.button>
              </motion.form>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl border"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-default)',
          }}
        >
          {/* Header */}
          <div className="border-b p-6 sm:p-8 lg:p-10" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex items-center gap-5">
                <button
                  onClick={() => navigate('/app')}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                  title={t('tools.backToApp')}
                >
                  <ArrowLeft size={20} />
                </button>
                {/* Avatar */}
                <motion.div
                  whileHover={{ scale: 1.05, rotate: 2 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-bold text-white"
                  style={{
                    backgroundColor: getAvatarColor(currentUser.name),
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  {getInitials(currentUser.name)}
                </motion.div>
                <div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--accent-dim)',
                      borderColor: 'var(--accent-border)',
                      color: 'var(--accent-light)',
                    }}
                  >
                    <Flame size={12} />
                    {t('workspace.currentUser')}
                  </motion.div>
                  <h2
                    className="text-2xl font-bold tracking-tight"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {currentUser.name}
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {currentUser.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSync}
                  className="group inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: 'var(--accent-dim)',
                    borderColor: 'var(--accent-border)',
                    color: 'var(--accent-light)',
                  }}
                >
                  <Sparkles size={14} className="transition-transform group-hover:rotate-12" />
                  {t('workspace.syncData')}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={logout}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <LogOut size={14} />
                  {t('workspace.logout')}
                </motion.button>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            {/* Stats */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <StatCard
                title={t('workspace.savedInnovations')}
                value={currentData?.innovations.length ?? 0}
                icon={Star}
                color="var(--warning)"
                iconColor="var(--warning)"
              />
              <StatCard
                title={t('workspace.savedPapers')}
                value={currentData?.papers.length ?? 0}
                icon={BookOpen}
                color="var(--success)"
                iconColor="var(--success)"
              />
              <StatCard
                title={t('workspace.bookmarks')}
                value={currentData?.bookmarks.length ?? 0}
                icon={Bookmark}
                color="var(--accent)"
                iconColor="var(--accent-light)"
              />
              <StatCard
                title={t('workspace.systemFavorites')}
                value={favorites.length}
                icon={Compass}
                color="var(--info)"
                iconColor="var(--info)"
              />
            </motion.div>

            {/* Manifesto */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <label
                className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('workspace.manifesto')}
              </label>
              <div className="relative">
                <textarea
                  value={currentData?.manifesto ?? ''}
                  onChange={(event) => updateManifesto(event.target.value)}
                  rows={3}
                  placeholder={t('workspace.manifestoPlaceholder')}
                  className="w-full resize-none rounded-xl border px-4 py-3.5 text-sm outline-none transition-all duration-300"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
                <div className="absolute bottom-3 right-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {(currentData?.manifesto ?? '').length} chars
                </div>
              </div>
            </motion.div>

            {/* Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-6"
            >
              <div
                className="relative inline-flex rounded-2xl p-1.5"
                style={{ backgroundColor: 'var(--bg-surface)' }}
              >
                {(
                  [
                    { id: 'innovations', label: t('workspace.innovations'), icon: Star },
                    { id: 'papers', label: t('workspace.papers'), icon: BookOpen },
                    { id: 'bookmarks', label: t('workspace.bookmarks'), icon: Bookmark },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className="relative z-10 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors duration-300"
                    style={{
                      color:
                        tab === item.id
                          ? 'var(--text-primary)'
                          : 'var(--text-tertiary)',
                    }}
                  >
                    <item.icon size={14} />
                    {item.label}
                  </button>
                ))}
                {/* Sliding indicator */}
                <motion.div
                  className="absolute bottom-1.5 top-1.5 rounded-xl"
                  style={{
                    width: '33.333%',
                    backgroundColor: 'var(--bg-elevated)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                  animate={{
                    x:
                      tab === 'innovations' ? '0%' : tab === 'papers' ? '100%' : '200%',
                  }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              </div>
            </motion.div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-3"
              >
                {tab === 'innovations' &&
                  (currentData?.innovations.length ? (
                    currentData.innovations.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <ItemCard
                          title={item.name}
                          subtitle={`${item.noveltyScore.toFixed(2)} 新颖度 · ${item.feasibilityScore.toFixed(2)} 可行性`}
                          description={item.description}
                          onRemove={() => removeInnovation(item.id)}
                          badge={
                            item.noveltyScore > 0.8
                              ? { text: '高新颖', color: 'var(--warning)', bg: 'var(--warning-dim)', border: 'rgba(245, 158, 11, 0.2)' }
                              : undefined
                          }
                        />
                      </motion.div>
                    ))
                  ) : (
                    <EmptyState
                      label={t('workspace.noInnovations')}
                    />
                  ))}

                {tab === 'papers' && (
                  <PaperGenerationHistory
                    records={
                      currentData?.papers.map((item) => ({
                        id: item.id,
                        taskId: item.taskId,
                        title: item.title,
                        venue: item.venue,
                        status: item.status as any,
                        createdAt: new Date(item.savedAt).toISOString(),
                        updatedAt: new Date(item.updatedAt).toISOString(),
                        version: 1,
                        stages: [],
                      })) || []
                    }
                    onView={(id) => console.log('View paper', id)}
                    onDelete={(id) => removePaper(id)}
                  />
                )}

                {tab === 'bookmarks' &&
                  (currentData?.bookmarks.length ? (
                    currentData.bookmarks.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <ItemCard
                          title={`${item.nodeType} · ${item.nodeId}`}
                          subtitle={`颜色: ${item.color}`}
                          description={item.note || '无备注'}
                          onRemove={() => removeBookmark(item.id)}
                          badge={
                            item.color
                              ? { text: item.color, color: 'var(--text-secondary)', bg: 'var(--bg-hover)', border: 'var(--border-default)' }
                              : undefined
                          }
                        />
                      </motion.div>
                    ))
                  ) : (
                    <EmptyState
                      label="暂无用户图谱书签数据，点击“同步系统数据”即可导入。"
                    />
                  ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  iconColor,
}: {
  title: string
  value: number
  icon: typeof Sparkles
  color: string
  iconColor: string
}) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="group relative overflow-hidden rounded-2xl border p-5 transition-shadow hover:shadow-lg"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="relative">
        <div
          className="mb-3 inline-flex rounded-xl p-2.5"
          style={{
            backgroundColor: 'var(--bg-hover)',
            color: iconColor,
          }}
        >
          <Icon size={18} />
        </div>
        <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
          {title}
        </p>
        <p
          className="mt-1 text-3xl font-extrabold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {value}
        </p>
      </div>
    </motion.div>
  )
}

function ItemCard({
  title,
  subtitle,
  description,
  onRemove,
  badge,
}: {
  title: string
  subtitle: string
  description: string
  onRemove: () => void
  badge?: { text: string; color: string; bg: string; border: string }
}) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.005 }}
      transition={{ type: 'spring', stiffness: 400 }}
      className="group relative overflow-hidden rounded-2xl border p-5 transition-shadow hover:shadow-md"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              className="truncate text-base font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h3>
            {badge && (
              <span
                className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: badge.bg,
                  color: badge.color,
                  borderColor: badge.border,
                }}
              >
                {badge.text}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {subtitle}
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {description}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onRemove}
          className="shrink-0 rounded-xl p-2.5 opacity-0 transition-all duration-200 group-hover:opacity-100"
          style={{
            color: 'var(--text-muted)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--error-dim)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--error)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
          }}
        >
          <Trash2 size={16} />
        </motion.button>
      </div>
    </motion.div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border px-6 py-12 text-center"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-tertiary)',
      }}
    >
      <div className="mb-3 flex justify-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: 'var(--bg-hover)',
            color: 'var(--text-muted)',
          }}
        >
          <Compass size={24} />
        </div>
      </div>
      <p className="text-sm">{label}</p>
    </motion.div>
  )
}
