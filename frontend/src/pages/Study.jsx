import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api, ApiError } from '../lib/api'
import { speak, stopSpeaking } from '../lib/speech'

export default function Study() {
  const { topicId } = useParams()
  const [params] = useSearchParams()
  const topicTitle = params.get('title') || 'this topic'

  const [study, setStudy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tutorMode, setTutorMode] = useState(false)

  useEffect(() => {
    let cancelled = false

    api
      .generateStudy(topicId)
      .then((res) => {
        if (!cancelled) setStudy(res)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Could not load the study material.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      stopSpeaking()
    }
  }, [topicId])

  useEffect(() => {
    if (tutorMode && study?.content) {
      speak(study.content)
    } else {
      stopSpeaking()
    }

    return () => stopSpeaking()
  }, [tutorMode, study])

  const toggleTutorMode = () => {
    setTutorMode((enabled) => {
      if (enabled) stopSpeaking()
      return !enabled
    })
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-[var(--color-ink-soft)]">
        Preparing your study material…
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <p className="text-[var(--color-rust)]">{error}</p>
        <Link
          to="/"
          className="text-sm text-[var(--color-indigo)] mt-4 inline-block"
        >
          ? Back to dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link
          to="/"
          className="text-sm text-[var(--color-indigo)]"
        >
          ? Back to dashboard
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTutorMode}
            className="btn-secondary text-sm px-3 py-2"
          >
            {tutorMode ? '?? Tutor On' : '?? Tutor Off'}
          </button>

          {tutorMode && (
            <button
              type="button"
              onClick={stopSpeaking}
              className="btn-secondary text-sm px-3 py-2"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      <h1 className="text-3xl font-semibold mb-2">
        Study: {study?.topic_title || topicTitle}
      </h1>

      <p className="text-[var(--color-ink-soft)] mb-8">
        Learn the topic with a structured Elara lesson.
      </p>

      <section className="card p-6 sm:p-8 mb-6">
        <div
          className="
            text-[var(--color-ink-soft)]
            leading-7
            [&>h1]:text-2xl
            [&>h1]:font-semibold
            [&>h1]:text-[var(--color-ink)]
            [&>h1]:mb-5
            [&>h2]:text-xl
            [&>h2]:font-semibold
            [&>h2]:text-[var(--color-ink)]
            [&>h2]:mt-8
            [&>h2]:mb-4
            [&>h3]:text-lg
            [&>h3]:font-semibold
            [&>h3]:text-[var(--color-ink)]
            [&>h3]:mt-6
            [&>h3]:mb-3
            [&>p]:mb-4
            [&>ul]:mb-5
            [&>ul]:pl-6
            [&>ul]:list-disc
            [&>ol]:mb-5
            [&>ol]:pl-6
            [&>ol]:list-decimal
            [&_li]:mb-2
            [&_strong]:font-semibold
            [&_strong]:text-[var(--color-ink)]
            [&_code]:rounded
            [&_code]:bg-[var(--color-paper)]
            [&_code]:px-1.5
            [&_code]:py-0.5
            [&_code]:text-sm
            [&_code]:font-mono
            [&_pre]:my-5
            [&_pre]:overflow-x-auto
            [&_pre]:rounded-lg
            [&_pre]:bg-[var(--color-ink)]
            [&_pre]:p-4
            [&_pre]:text-sm
            [&_pre]:leading-6
            [&_pre_code]:bg-transparent
            [&_pre_code]:p-0
            [&_pre_code]:text-inherit
            [&_table]:w-full
            [&_table]:my-6
            [&_table]:border-collapse
            [&_th]:border
            [&_th]:border-[var(--color-border)]
            [&_th]:bg-[var(--color-paper)]
            [&_th]:px-3
            [&_th]:py-2
            [&_th]:text-left
            [&_th]:font-semibold
            [&_th]:text-[var(--color-ink)]
            [&_td]:border
            [&_td]:border-[var(--color-border)]
            [&_td]:px-3
            [&_td]:py-2
            [&_td]:align-top
            [&_blockquote]:my-5
            [&_blockquote]:border-l-4
            [&_blockquote]:border-[var(--color-indigo-soft)]
            [&_blockquote]:pl-4
            [&_hr]:my-7
            [&_hr]:border-[var(--color-border)]
          "
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {study?.content || ''}
          </ReactMarkdown>
        </div>
      </section>

      {study?.citations?.length > 0 && (
        <section className="card p-6">
          <h2 className="text-lg font-semibold mb-4">
            Course material used
          </h2>

          <div className="flex flex-col gap-4">
            {study.citations.map((citation, index) => (
              <div
                key={index}
                className="border-l-2 border-[var(--color-indigo-soft)] pl-4"
              >
                <p className="text-xs font-medium text-[var(--color-indigo)] mb-1">
                  Source {citation.source_index}
                </p>

                <p className="text-sm text-[var(--color-ink-soft)]">
                  {citation.excerpt}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
