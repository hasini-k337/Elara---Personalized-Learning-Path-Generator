from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.security import get_current_user
from app.database import get_db
from app.llm.factory import get_llm_provider

router = APIRouter(prefix="/study", tags=["study"])


@router.post("/generate", response_model=schemas.StudyOut)
def generate_study(
    payload: schemas.StudyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    topic = (
        db.query(models.Topic)
        .filter(models.Topic.id == payload.topic_id)
        .first()
    )

    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    llm = get_llm_provider()

    prompt = f"""
Create a complete, student-friendly study lesson for the syllabus topic:

"{topic.title}"

This is a teaching lesson, not a list of instructions.

The student should be able to study the topic directly from your response.

Organize the lesson using exactly these six sections:

1. Overview
Give a clear introduction to the topic and explain why it matters.

2. Core Concepts
Teach the main concepts the student needs to understand.
Explain important relationships between the concepts.

3. Definitions
Give clear, concise definitions of the important terms.

4. Mathematical Notation and Formulas
Include relevant notation, formulas, rules, or equations when they are applicable.
Explain what the symbols mean and how the formulas are used.

5. Step-by-Step Explanation
Teach the main process, algorithm, method, or reasoning step by step.
Do not merely tell the student to study or practice it.

6. Worked Examples / Code
Give at least one concrete worked example when the topic supports one.
Show the reasoning or intermediate steps.
If the topic is programming-related, include a relevant code example when appropriate.

IMPORTANT CONTENT RULES:
- The syllabus topic defines what the student is expected to learn.
- Generate accurate educational content that actually teaches the topic.
- You may use established academic knowledge to explain the topic.
- Do not invent facts about this student's personal course, instructor, assessment, or institution.
- Do not say that information is unavailable simply because the uploaded syllabus does not contain a textbook-level explanation.
- Do not produce placeholder statements such as:
  "The material does not provide..."
  "No definitions are given..."
  "No formulas are available..."
  "The student should refer to..."
- Do not turn the lesson into instructions about how to study.
- Do not ask the student to upload notes before teaching the topic.
- Keep explanations appropriate for a university-level computer science student.
- Use clear headings, readable explanations, and examples.
- Prefer concrete teaching over meta-commentary.
- If a mathematical or programming concept is involved, make the explanation technically precise.
- Do not fabricate course-specific requirements or claim that an example came from the student's uploaded material.
"""

    try:
        answer = llm.complete(
            [
                {
                    "role": "system",
                    "content": (
                        "You are Elara, a university-level adaptive tutor. "
                        "Your job in Study Mode is to generate accurate, "
                        "structured teaching material for the requested syllabus topic. "
                        "Teach the concept directly and clearly."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.2,
            max_tokens=4500,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return schemas.StudyOut(
        topic_id=topic.id,
        topic_title=topic.title,
        content=answer,
        citations=[],
    )
