import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'

export default function DiagnosticQuiz() {
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    api
      .generateDiagnosticQuiz(10)
      .then((res) => {
        if (!cancelled) setQuiz(res)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Could not generate the diagnostic quiz.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const selectAnswer = (questionIndex, optionIndex) => {
    if (result) return

    setAnswers((current) => ({
      ...current,
      [questionIndex]: optionIndex,
    }))
  }

  const allAnswered =
    quiz &&
    quiz.questions.every((_, index) => answers[index] !== undefined)

  const onSubmit = async () => {
    if (!quiz || !allAnswered) return

    setSubmitting(true)
    setError(null)

    try {
      const orderedAnswers = quiz.questions.map((_, index) => answers[index])

      const res = await api.submitDiagnosticQuiz(
        quiz.quiz_id,
        orderedAnswers
      )

      setResult(res)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not submit the diagnostic quiz.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const onContinue = async () => {
    setPlanLoading(true)
    setError(null)

    try {
      await api.generateStudyPlan()
      navigate('/')
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not generate your study plan.'
      )
      setPlanLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-[var(--color-ink-soft)]">
        Building your overall diagnostic quiz…
      </div>
    )
  }

  if (error && !quiz) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <p className="text-[var(--color-rust)]">{error}</p>
      </div>
    )
  }

  if (result) {
    const percentage = Math.round(result.score * 100)

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Overall diagnostic complete
          </p>

          <h1 className="text-4xl font-semibold mt-2">
            {percentage}%
          </h1>

          <p className="mt-3 text-lg">
            Starting level:{' '}
            <span className="font-semibold capitalize">
              {result.level}
            </span>
          </p>

          <p className="text-sm text-[var(--color-ink-soft)] mt-4">
            Your study plan will cover the complete syllabus, with pacing
            and depth adapted to your starting level.
          </p>

          {error && (
            <p className="text-sm text-[var(--color-rust)] mt-4">
              {error}
            </p>
          )}

          <button
            onClick={onContinue}
            disabled={planLoading}
            className="btn-primary px-5 py-2.5 mt-6"
          >
            {planLoading
              ? 'Building your study plan…'
              : 'Continue to study plan →'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <p className="text-sm text-[var(--color-indigo)] font-medium">
          Step 1 of your learning path
        </p>

        <h1 className="text-3xl font-semibold mt-1">
          Overall diagnostic quiz
        </h1>

        <p className="text-[var(--color-ink-soft)] mt-2">
          This short assessment checks your understanding across the
          uploaded syllabus so Elara can adapt your starting level.
        </p>
      </div>

      <div className="space-y-6">
        {quiz.questions.map((question, questionIndex) => (
          <div key={questionIndex} className="card p-6">
            <p className="font-medium">
              {questionIndex + 1}. {question.question}
            </p>

            <div className="mt-4 space-y-2">
              {question.options.map((option, optionIndex) => {
                const selected =
                  answers[questionIndex] === optionIndex

                return (
                  <button
                    key={optionIndex}
                    type="button"
                    onClick={() =>
                      selectAnswer(questionIndex, optionIndex)
                    }
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      selected
                        ? 'border-[var(--color-indigo)] bg-[var(--color-indigo-tint)]'
                        : 'border-[var(--color-border)] hover:bg-[var(--color-paper)]'
                    }`}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-[var(--color-rust)] mt-4">
          {error}
        </p>
      )}

      <button
        onClick={onSubmit}
        disabled={!allAnswered || submitting}
        className="btn-primary w-full py-2.5 mt-6"
      >
        {submitting ? 'Calculating your level…' : 'Submit diagnostic'}
      </button>
    </div>
  )
}