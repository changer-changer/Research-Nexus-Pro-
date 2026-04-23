import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface MarkdownReaderProps {
  content: string
  darkMode?: boolean
}

export default function MarkdownReader({ content, darkMode }: MarkdownReaderProps) {
  const toc = useMemo(() => {
    const headings: Array<{ level: number; text: string; id: string }> = []
    const lines = content.split('\n')
    lines.forEach((line) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const text = match[2].trim()
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
        headings.push({ level, text, id })
      }
    })
    return headings
  }, [content])

  const theme = darkMode ? vscDarkPlus : oneLight

  return (
    <div className="flex h-full overflow-hidden">
      {/* TOC Sidebar */}
      {toc.length > 0 && (
        <div
          className="w-56 shrink-0 overflow-y-auto border-r px-3 py-4 hidden lg:block"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <h4
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            Contents
          </h4>
          <nav className="space-y-1">
            {toc.map((h, i) => (
              <a
                key={i}
                href={`#${h.id}`}
                className="block text-sm truncate py-0.5 hover:opacity-80 transition-opacity"
                style={{
                  paddingLeft: `${(h.level - 1) * 12}px`,
                  color: 'var(--text-secondary)',
                }}
                onClick={(e) => {
                  e.preventDefault()
                  const el = document.getElementById(h.id)
                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                {h.text}
              </a>
            ))}
          </nav>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto prose prose-sm" style={{ color: 'var(--text-primary)' }}>
          <ReactMarkdown
            components={{
              h1: ({ children, ...props }) => {
                const id = String(children).toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
                return (
                  <h1 id={id} className="text-2xl font-bold mt-2 mb-4" {...props}>
                    {children}
                  </h1>
                )
              },
              h2: ({ children, ...props }) => {
                const id = String(children).toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
                return (
                  <h2 id={id} className="text-xl font-semibold mt-6 mb-3" {...props}>
                    {children}
                  </h2>
                )
              },
              h3: ({ children, ...props }) => {
                const id = String(children).toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
                return (
                  <h3 id={id} className="text-lg font-medium mt-4 mb-2" {...props}>
                    {children}
                  </h3>
                )
              },
              code({ className, children, ref, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                const language = match ? match[1] : ''
                const isInline = !className
                if (isInline) {
                  return (
                    <code
                      className="px-1.5 py-0.5 rounded text-sm"
                      style={{
                        background: 'var(--bg-hover)',
                        color: 'var(--accent)',
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  )
                }
                return (
                  <SyntaxHighlighter
                    language={language || 'text'}
                    style={theme as any}
                    PreTag="div"
                    className="rounded-lg text-sm my-3"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                )
              },
              p: ({ children, ...props }) => (
                <p className="my-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }} {...props}>
                  {children}
                </p>
              ),
              ul: ({ children, ...props }) => (
                <ul className="my-3 ml-5 list-disc" {...props}>{children}</ul>
              ),
              ol: ({ children, ...props }) => (
                <ol className="my-3 ml-5 list-decimal" {...props}>{children}</ol>
              ),
              li: ({ children, ...props }) => (
                <li className="my-1" style={{ color: 'var(--text-secondary)' }} {...props}>{children}</li>
              ),
              blockquote: ({ children, ...props }) => (
                <blockquote
                  className="my-3 pl-4 border-l-2 italic"
                  style={{ borderColor: 'var(--accent)', color: 'var(--text-muted)' }}
                  {...props}
                >
                  {children}
                </blockquote>
              ),
              a: ({ children, ...props }) => (
                <a className="underline hover:opacity-80" style={{ color: 'var(--accent)' }} {...props}>
                  {children}
                </a>
              ),
              hr: () => <hr className="my-6" style={{ borderColor: 'var(--border-subtle)' }} />,
              table: ({ children, ...props }) => (
                <div className="overflow-x-auto my-4">
                  <table className="w-full text-sm border-collapse" {...props}>
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children, ...props }) => (
                <thead style={{ background: 'var(--bg-hover)' }} {...props}>{children}</thead>
              ),
              th: ({ children, ...props }) => (
                <th className="px-3 py-2 text-left font-semibold border-b" style={{ borderColor: 'var(--border-subtle)' }} {...props}>
                  {children}
                </th>
              ),
              td: ({ children, ...props }) => (
                <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }} {...props}>
                  {children}
                </td>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
