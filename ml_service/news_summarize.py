import os
import requests
from dotenv import load_dotenv

load_dotenv()

class NewsSummarizer:

    def __init__(self, model="mistralai/Mistral-7B-Instruct-v0.2"):

        self.hf_token = os.getenv("HUGGING")
        self.model = model

        # Using Together AI provider via HuggingFace Router (OpenAI-compatible)
        self.api_url = "https://router.huggingface.co/together/v1/chat/completions"

        self.headers = {
            "Authorization": f"Bearer {self.hf_token}",
            "Content-Type": "application/json"
        }

        if not self.hf_token:
            print("Warning: HUGGING token missing")

    # ----------------------------------

    def _call_hf(self, prompt):

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a professional Wall Street equity research analyst."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 500,
            "temperature": 0.2
        }

        try:
            r = requests.post(self.api_url, headers=self.headers, json=payload, timeout=60)
            r.raise_for_status()
            
            response = r.json()
            return response["choices"][0]["message"]["content"]
            
        except Exception as e:
            print(f"API Request Failed: {e}")
            if 'r' in locals() and r:
                print(f"Response: {r.text}")
            return f"Error generating summary: {str(e)}"

    # ----------------------------------

    def generate_summary(self, grouped_articles):

        context_str = ""

        for cat, articles in grouped_articles.items():

            if not articles:
                continue

            context_str += f"\n### {cat}\n"

            for a in articles[:3]:
                title = a.get('title','')
                context_str += f"- {title}\n"

        if not context_str:
            return "No material news."

        prompt = f"""Create a structured stock research note.

Rules:
- Professional tone
- Bullet points only
- No fluff
- No repetition
- Only factual drivers

Return EXACT format:

### Key News & Market Drivers

**Earnings & Financials**
- bullets

**Operations & Deliveries**
- bullets

**Innovation / AI / Growth**
- bullets

**Regulation & Legal**
- bullets

**Competition & Market Pressure**
- bullets

### Analyst View
2 sentence outlook.

News:
{context_str}
"""

        return self._call_hf(prompt)

if __name__ == "__main__":
    pass
