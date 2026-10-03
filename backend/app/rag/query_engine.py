import re

from app.llm.base import LLMProvider
from app.rag.vector_store import query_chunks

SYNTHESIS_SYSTEM_PROMPT = """You are Elara, a university-level tutor helping a student with
coursework and homework.

Use the provided source excerpts to determine the course topic, terminology, scope, and
relevant context.

IMPORTANT:
- If the sources contain detailed teaching material, answer primarily from those sources.
- If the sources are syllabus material and they only mention the topic without explaining it
  in detail, DO NOT refuse to help.
- When a syllabus establishes that a topic is part of the student's course, use established
  academic knowledge to explain that topic accurately and help the student solve homework.
- Clearly distinguish general academic explanation from facts specifically stated in the
  uploaded material.
- Do not invent course-specific requirements, instructor preferences, grading rules, or
  assignment instructions.
- For homework questions, explain the reasoning step by step and provide examples when useful.
- For programming questions, provide correct code when appropriate and explain it.
- Use the uploaded syllabus as the course-scope source, even when the syllabus does not contain
  textbook-level explanations.
- Never say "the material does not provide enough information" merely because the syllabus
  does not contain a detailed explanation.
- If the question is completely unrelated to the uploaded course material, say that it is
  outside the available course scope rather than inventing a connection.
- Give a complete answer from beginning to end.
- Do not leave unfinished sections, placeholder text, or incomplete numbered steps.
- Do not stop midway through an algorithm or example.
- For step-by-step homework explanations, complete every step and the final result.
- Prefer a concise complete explanation over a long explanation that gets cut off.
- Tutor Mode must support teaching, guided problem solving, and checking student work.
- When the student provides their own solution, evaluate the reasoning, calculations,
  representations, code, and final answer rather than simply generating a new solution.
- Identify which parts of the student's work are correct before explaining mistakes.
- When a mistake is found, point to the specific step or reasoning where it occurs and
  explain why it is incorrect.
- Do not automatically replace the student's entire solution with a model-generated answer.
- When the student's approach is correct, confirm it and explain why it works.
- When the student asks for help but has not attempted the problem, guide them through
  the reasoning step by step.
- For homework, prefer teaching the reasoning process over simply giving the final answer.
- - If the student asks whether their answer is correct, explicitly assess the submitted
  work as correct, partially correct, or containing an error, and justify the assessment.
"""

# Chroma cosine distance is useful when a real semantic embedding model is used.
# Our current offline embedding is keyword-based, so lexical overlap is also checked.
CONFIDENCE_DISTANCE_THRESHOLD = 0.55

_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "for",
    "from", "give", "how", "i", "in", "is", "it", "me", "of", "on", "or",
    "please", "show", "that", "the", "this", "to", "using", "what", "when",
    "where", "which", "with", "you", "your", "explain", "teach"
}


def _meaningful_tokens(text: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return {token for token in tokens if token not in _STOPWORDS and len(token) > 2}


def _lexical_relevance(question: str, documents: list[str]) -> bool:
    """
    Accept retrieval when the source contains enough meaningful terms
    from the student's question.

    This is intentionally conservative so the offline keyword retriever
    does not turn unrelated material into a grounded answer.
    """
    query_terms = _meaningful_tokens(question)

    if not query_terms:
        return False

    for document in documents:
        document_terms = _meaningful_tokens(document)
        overlap = query_terms & document_terms

        if len(query_terms) <= 2 and len(overlap) >= 1:
            return True

        if len(overlap) >= 2:
            return True

    return False


def answer_content_question(
    llm: LLMProvider,
    user_id: str,
    question: str,
    top_k: int = 5,
    max_tokens: int = 3000,
    document_type: str | None = None,
) -> dict:
    query_embedding = llm.embed([question])[0]
    results = query_chunks(
        query_embedding,
        user_id=user_id,
        top_k=top_k,
        document_type=document_type,
    )

    documents = results.get("documents", [[]])[0]
    distances = results.get("distances", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]

    strong_vector_match = bool(
        documents
        and distances
        and min(distances) <= CONFIDENCE_DISTANCE_THRESHOLD
    )

    strong_lexical_match = _lexical_relevance(question, documents)

    if not documents or not (strong_vector_match or strong_lexical_match):
        return {
            "content": (
                "I don't have enough grounded material on that yet - try uploading the "
                "relevant syllabus/notes section, or rephrase the question."
            ),
            "citations": [],
        }

    context_block = "\n\n---\n\n".join(
        f"[Source {i+1}] {doc}" for i, doc in enumerate(documents)
    )

    messages = [
        {"role": "system", "content": SYNTHESIS_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Sources:\n{context_block}\n\nQuestion: {question}",
        },
    ]

    answer = llm.complete(
        messages,
        temperature=0.2,
        max_tokens=3000,
    )

    citations = [
        {
            "source_index": i + 1,
            "excerpt": doc[:200],
            "metadata": meta,
        }
        for i, (doc, meta) in enumerate(zip(documents, metadatas))
    ]

    return {
        "content": answer,
        "citations": citations,
    }

