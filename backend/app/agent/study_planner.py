from sqlalchemy.orm import Session

from app import models

MASTERY_THRESHOLD = 0.75


def generate_study_plan(db: Session, user_id: str) -> list[models.StudyPlanItem]:
    """
    Builds a study plan covering every syllabus topic.

    The overall diagnostic level changes pacing/order:
      easy   -> faster progression, lighter review
      medium -> balanced progression
      hard   -> foundational review and more practice

    No topic is removed based on the diagnostic level.
    """

    topics = (
        db.query(models.Topic)
        .join(models.Document)
        .filter(models.Document.user_id == user_id)
        .order_by(models.Topic.order_index)
        .all()
    )

    if not topics:
        return []

    # Get the student's latest overall diagnostic level.
    assessment = (
        db.query(models.OverallAssessment)
        .filter(models.OverallAssessment.user_id == user_id)
        .order_by(models.OverallAssessment.created_at.desc())
        .first()
    )

    level = assessment.level if assessment else "medium"

    scores_by_topic = {
        s.topic_id: s
        for s in db.query(models.MasteryScore)
        .filter(models.MasteryScore.user_id == user_id)
        .all()
    }

    # Clear existing plan and rebuild it.
    db.query(models.StudyPlanItem).filter(
        models.StudyPlanItem.user_id == user_id
    ).delete()

    # Keep every topic in the syllabus.
    # Only the ordering/reason changes according to diagnostic level.
    if level == "hard":
        ordered_topics = sorted(
            topics,
            key=lambda topic: (
                scores_by_topic.get(topic.id).score
                if scores_by_topic.get(topic.id)
                else 0.0
            ),
        )
        pacing_reason = (
            "Hard diagnostic level: begin with foundational understanding "
            "and increase practice before progressing."
        )

    elif level == "easy":
        ordered_topics = topics
        pacing_reason = (
            "Easy diagnostic level: use a faster progression with concise "
            "review before moving to deeper applications."
        )

    else:
        ordered_topics = topics
        pacing_reason = (
            "Medium diagnostic level: use balanced explanations, examples, "
            "and practice across the syllabus."
        )

    plan_items = []

    for order, topic in enumerate(ordered_topics):
        topic_mastery = scores_by_topic.get(topic.id)

        if topic_mastery and topic_mastery.score >= MASTERY_THRESHOLD:
            status = "mastered"
            reason = (
                f"Current topic mastery is {topic_mastery.score:.0%}."
            )
        elif topic_mastery:
            status = "needs_remediation"
            reason = (
                f"Current topic mastery is {topic_mastery.score:.0%}, "
                f"so additional practice is needed."
            )
        else:
            status = "pending"
            reason = "This topic has not been assessed yet."

        plan_items.append(
            models.StudyPlanItem(
                user_id=user_id,
                topic_id=topic.id,
                status=status,
                scheduled_order=order,
                reason=reason,
            )
        )

    db.add_all(plan_items)
    db.commit()

    for item in plan_items:
        db.refresh(item)

    return plan_items