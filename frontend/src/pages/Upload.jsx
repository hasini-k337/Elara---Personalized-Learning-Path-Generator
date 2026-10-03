import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'

const STATUS_COPY = {
  processing: { label: 'Parsing and building your knowledge graph…', tone: 'badge-pending' },
  ready: { label: 'Ready — topics extracted', tone: 'badge-mastered' },
  failed: { label: 'Ingestion failed', tone: 'badge-review' },
}

export default function Upload() {
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [documentType, setDocumentType] = useState('syllabus')
  const [status, setStatus] = useState(null) // { document_id, status }
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const pollRef = useRef(null)
  const navigate = useNavigate()

  const pollStatus = useCallback((documentId) => {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.syllabusStatus(documentId)
        setStatus(res)
        if (res.status === 'ready' || res.status === 'failed') {
          clearInterval(pollRef.current)
        }
      } catch {
        clearInterval(pollRef.current)
      }
    }, 1500)
  }, [])

  const onUpload = async () => {
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const res = await api.uploadSyllabus(file, documentType)
      setStatus({ document_id: res.document_id, status: res.status })
      pollStatus(res.document_id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  const onStartDiagnostic = () => {
    if (!status?.document_id) return
    navigate('/diagnostic')
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">Add course material</h1>

      <p className="text-[var(--color-ink-soft)] mb-8">
        Upload your syllabus to build the learning path, or add lecture notes and
        course material to give Elara grounded study content.
      </p>

      <div className="card p-4 mb-6">
        <p className="font-medium mb-3">What are you uploading?</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDocumentType('syllabus')}
            className={`text-left p-4 rounded-lg border transition-colors ${
              documentType === 'syllabus'
                ? 'border-[var(--color-indigo)] bg-[var(--color-indigo-tint)]'
                : 'border-[var(--color-border)]'
            }`}
         >
            <p className="font-medium">Syllabus</p>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1">
              Builds your topics, diagnostic quiz, and study plan.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setDocumentType('course_material')}
            className={`text-left p-4 rounded-lg border transition-colors ${
              documentType === 'course_material'
                ? 'border-[var(--color-indigo)] bg-[var(--color-indigo-tint)]'
                : 'border-[var(--color-border)]'
            }`}
          >
            <p className="font-medium">Course material</p>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1">
            Adds lecture notes or textbook material to Elara's knowledge base.
            </p>
          </button>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`card p-10 flex flex-col items-center gap-4 text-center transition-colors ${
          dragOver ? 'border-[var(--color-indigo)] bg-[var(--color-indigo-tint)]' : ''
        }`}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-indigo)" strokeWidth="1.5">
          <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <p className="font-medium">Drag a file here, or</p>
          <label className="btn-secondary inline-block mt-2 px-4 py-2 cursor-pointer">
            Browse files
            <input
              type="file"
              accept=".pdf,.json,.txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {file && <p className="text-sm font-[var(--font-mono)] text-[var(--color-ink-soft)]">{file.name}</p>}
      </div>

      {error && <p className="text-sm text-[var(--color-rust)] mt-4">{error}</p>}

      <button onClick={onUpload} disabled={!file || uploading} className="btn-primary w-full py-2.5 mt-6">
        {uploading ? 'Uploading…' : 'Upload and ingest'}
      </button>

      {status && (
        <div className="card p-5 mt-6 flex items-center justify-between">
          <div>
            <p className="font-medium">
              {documentType === 'syllabus'
                ? 'Syllabus ingestion'
                : 'Course material ingestion'}
            </p>

            <span
              className={`inline-block mt-1 text-xs font-medium px-2 py-1 rounded-full ${
                STATUS_COPY[status.status]?.tone ?? 'badge-pending'
              }`}
            >
              {status.status === 'ready'
                ? documentType === 'syllabus'
                  ? 'Ready — topics extracted'
                  : 'Added to Elara’s knowledge base'
                : STATUS_COPY[status.status]?.label ?? status.status}
            </span>
          </div>

          {status.status === 'ready' && documentType === 'syllabus' && (
            <button
              onClick={onStartDiagnostic}
              className="btn-primary px-4 py-2 text-sm"
            >
              Start diagnostic quiz →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
