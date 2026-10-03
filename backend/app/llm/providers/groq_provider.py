from groq import Groq

from app.llm.base import LLMProvider
from app.llm.local_embeddings import embed_texts


class GroqProvider(LLMProvider):

    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise ValueError(
                "GROQ_API_KEY is missing. Add it to backend/.env"
            )

        self.client = Groq(api_key=api_key)
        self.model = model


    def complete(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.3,
        max_tokens: int = 1500,
        json_mode: bool = False,
    ) -> str:

        kwargs = {}

        if json_mode:
            kwargs["response_format"] = {
                "type": "json_object"
            }

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )

        return response.choices[0].message.content or ""


    def embed(self, texts: list[str]) -> list[list[float]]:
        # keep our free local embeddings
        return embed_texts(texts)