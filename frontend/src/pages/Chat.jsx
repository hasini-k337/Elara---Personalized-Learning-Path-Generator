import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { api } from '../lib/api'
import { speak, stopSpeaking } from '../lib/speech'

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [tutorMode, setTutorMode] = useState(false)
  const [listening, setListening] = useState(false)

  const recognitionRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    api
      .chatHistory()
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      stopSpeaking()
    }
  }, [])

  const send = async (e) => {
    e.preventDefault()

    const text = input.trim()

    if (!text || sending) return

    setInput('')

    setMessages((m) => [
      ...m,
      {
        role: 'user',
        content: text,
        citations: [],
      },
    ])

    setSending(true)

    try {
      const res = await api.sendChatMessage(text)

      setMessages((m) => [...m, res])

      if (tutorMode && res.role === 'assistant') {
        speak(res.content)
      }
    } catch {
      const errorMessage = {
        role: 'assistant',
        content: "I couldn't reach the tutor just now — please try again.",
        citations: [],
      }

      setMessages((m) => [...m, errorMessage])

      if (tutorMode) {
        speak(errorMessage.content)
      }
    } finally {
      setSending(false)
    }
  }

  const toggleListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser.')
      return
    }

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()

    recognition.lang = 'en-IN'
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onstart = () => {
      setListening(true)
    }

    recognition.onresult = (event) => {
      let transcript = ''

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        transcript += event.results[i][0].transcript
      }

      setInput(transcript)
    }

    recognition.onerror = () => {
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">
            Tutor chat
          </h1>

          <p className="text-[var(--color-ink-soft)] text-sm">
            Ask about your course topics or homework — Elara can explain
            concepts, work through problems, and guide you step by step.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setTutorMode((enabled) => {
                if (enabled) {
                  stopSpeaking()
                }

                return !enabled
              })
            }}
            className="text-sm border rounded-lg px-3 py-2"
          >
            {tutorMode ? '🔊 Tutor On' : '🔈 Tutor Off'}
          </button>

          <button
            type="button"
            onClick={stopSpeaking}
            className="text-sm border rounded-lg px-3 py-2"
          >
            ⏹ Stop
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
        {loadingHistory && (
          <p className="text-sm text-[var(--color-ink-soft)]">
            Loading conversation…
          </p>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div className="card p-6 text-center text-[var(--color-ink-soft)] text-sm">
            No messages yet — ask Elara about a course topic or homework
            problem.
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === 'user'
                ? 'justify-end'
                : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                m.role === 'user'
                  ? 'bg-[var(--color-indigo)] text-white'
                  : 'card'
              }`}
            >
              {m.role === 'user' ? (
                <p className="whitespace-pre-wrap">
                  {m.content}
                </p>
              ) : (
                <div
                  className="
                    prose prose-sm max-w-none
                    prose-headings:font-semibold
                    prose-headings:text-[var(--color-ink)]
                    prose-p:text-[var(--color-ink)]
                    prose-li:text-[var(--color-ink)]
                    prose-strong:text-[var(--color-ink)]
                    prose-code:text-[var(--color-indigo)]
                    prose-code:before:content-none
                    prose-code:after:content-none
                    prose-pre:bg-[var(--color-ink)]
                    prose-pre:text-white
                    prose-table:text-sm
                    prose-th:bg-[var(--color-gold-tint)]
                    prose-th:text-left
                    prose-th:px-3
                    prose-th:py-2
                    prose-td:px-3
                    prose-td:py-2
                    prose-td:border
                    prose-th:border
                    prose-blockquote:border-l-[var(--color-indigo)]
                  "
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content || ''}
                  </ReactMarkdown>
                </div>
              )}

              {m.role === 'assistant' && (
                <button
                  type="button"
                  onClick={() => speak(m.content)}
                  className="text-sm mt-3 underline"
                >
                  🔊 Listen
                </button>
              )}

              {m.citations?.length > 0 && (
                <div className="mt-3 pt-2 border-t border-black/10 flex flex-wrap gap-1">
                  {m.citations.map((c, ci) => (
                    <span
                      key={ci}
                      className="text-xs font-[var(--font-mono)] bg-[var(--color-gold-tint)] text-[var(--color-gold)] px-1.5 py-0.5 rounded"
                    >
                      [{ci + 1}]{' '}
                      {typeof c === 'string'
                        ? c
                        : c.source || 'source'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="card px-4 py-2.5 text-sm text-[var(--color-ink-soft)]">
              Thinking…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="flex gap-2 mt-4"
      >
        <input
          className="input-field flex-1"
          placeholder="Ask a homework question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <button
          type="button"
          onClick={toggleListening}
          className={`text-sm border rounded-lg px-3 py-2 ${
            listening
              ? 'bg-red-50 text-red-600 border-red-200'
              : ''
          }`}
          title={
            listening
              ? 'Stop voice input'
              : 'Use microphone'
          }
        >
          {listening ? '⏹' : '🎙️'}
        </button>

        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="btn-primary px-5"
        >
          Send
        </button>
      </form>
    </div>
  )
}
