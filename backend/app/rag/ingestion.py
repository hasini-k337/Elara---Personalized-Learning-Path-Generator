import uuid

from sqlalchemy.orm import Session

from app import models
from app.llm.factory import get_llm_provider
from app.rag.chunking import extract_text, chunk_text
from app.rag.topic_extraction import extract_knowledge_graph
from app.rag.vector_store import add_chunks


def ingest_document(
    db: Session,
    document: models.Document,
    file_path: str,
    user_id: str,
):
    """
    Runs the full ingestion pipeline:
    parse -> chunk -> topic extraction -> vectorization.
    """

    try:
        raw_text = extract_text(file_path, document.filename)
        chunks = chunk_text(raw_text)

        llm = get_llm_provider()

        # Only syllabi define the dashboard's topic structure.
        if document.document_type == "syllabus":
            topic_tree = extract_knowledge_graph(llm, raw_text)
            order = 0

            for topic_data in topic_tree:
                parent_topic = models.Topic(
                    document_id=document.id,
                    title=topic_data.get("title", "Untitled Topic"),
                    difficulty=topic_data.get("difficulty", "medium"),
                    order_index=order,
                )

                db.add(parent_topic)
                db.flush()
                order += 1

                for sub in topic_data.get("subtopics", []):
                    child = models.Topic(
                        document_id=document.id,
                        parent_id=parent_topic.id,
                        title=sub.get("title", "Untitled Subtopic"),
                        difficulty=sub.get("difficulty", "medium"),
                        order_index=order,
                    )

                    db.add(child)
                    order += 1

            db.commit()

        # Store chunks in Chroma for RAG retrieval.
        if chunks:
            embeddings = llm.embed(chunks)
            ids = [str(uuid.uuid4()) for _ in chunks]

            metadatas = [
                {
                    "document_id": document.id,
                    "user_id": user_id,
                    "document_type": document.document_type,
                    "chunk_index": i,
                }
                for i in range(len(chunks))
            ]

            add_chunks(
                ids=ids,
                documents=chunks,
                embeddings=embeddings,
                metadatas=metadatas,
            )

        document.status = "ready"
        db.add(document)
        db.commit()

    except Exception as exc:
        document.status = "failed"
        db.add(document)
        db.commit()
        raise exc