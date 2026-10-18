import re
import json
import os
import time
from typing import List, Dict, Any, Optional, Union
import anthropic
from config import WALLET_REGEX, EMAIL_REGEX, IPV4_REGEX, HANDLE_REGEX, MODEL_NAME, LLM_CACHE_DIR

class OsintExtractor:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.client = anthropic.Anthropic(api_key=api_key) if api_key else None

    def regex_extract(self, text: str) -> Dict[str, List[str]]:
        """Fast extraction of markers using regex."""
        return {
            "wallets": list(set(re.findall(WALLET_REGEX, text))),
            "emails": list(set(re.findall(EMAIL_REGEX, text))),
            "ips": list(set(re.findall(IPV4_REGEX, text))),
            "handles": list(set(re.findall(HANDLE_REGEX, text))),
        }

    def llm_extract(self, text: str, post_id: str) -> Optional[Dict[str, Any]]:
        """Extract structured data using Claude. Caches results to disk."""
        if not self.client:
            return None

        # Check cache first
        cache_path = os.path.join(LLM_CACHE_DIR, f"{post_id}.json")
        if os.path.exists(cache_path):
            with open(cache_path, "r") as f:
                return json.load(f)

        prompt = (
            "Extract identity markers and security claims from this OSINT text. "
            "Return ONLY strict JSON with this format: "
            '{"entities": [{"type": "wallet|email|ip|handle", "value": "...", "confidence": 0.0-1.0}], '
            '"claims": ["description of what the user is claiming to do"], "summary": "brief summary"}'
            f"\n\nText: {text}"
        )

        try:
            message = self.client.messages.create(
                model=MODEL_NAME,
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )
            # Simple extraction of JSON from the response
            content = message.content[0].text
            # Basic JSON cleaning if LLM adds markdown blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            result = json.loads(content)

            # Cache result
            with open(cache_path, "w") as f:
                json.dump(result, f)

            return result
        except Exception as e:
            print(f"LLM extraction failed for {post_id}: {e}")
            return None

    def extract(self, post: Dict[str, Any]) -> Dict[str, Any]:
        """Main entry point for extracting entities from a post."""
        text = post.get("text", "") or post.get("rawText", "")
        post_id = post.get("id", "unknown")
        if post_id == "unknown" and "author" in post:
            post_id = f"{post['author']}_{int(time.time())}"


        # 1. Always do regex pass
        entities_regex = self.regex_extract(text)

        # 2. Attempt LLM pass
        llm_data = self.llm_extract(text, post_id)

        # Merge results
        final_entities = []

        # Add regex matches
        for key, values in entities_regex.items():
            for val in values:
                final_entities.append({"type": key[:-1] if key != "handles" else "handle", "value": val, "confidence": 1.0})

        # Add LLM matches (avoiding duplicates)
        if llm_data and "entities" in llm_data:
            for ent in llm_data["entities"]:
                if not any(e["value"] == ent["value"] for e in final_entities):
                    final_entities.append(ent)

        return {
            "post_id": post_id,
            "author": post.get("author"),
            "entities": final_entities,
            "claims": llm_data.get("claims", []) if llm_data else [],
            "summary": llm_data.get("summary", "") if llm_data else ""
        }

def run_extraction(posts: Union[str, List[Dict[str, Any]]], output_path: Optional[str] = None, api_key: Optional[str] = None):
    """Processes all posts and returns extracted entities.
    Accepts either a path to a JSON file or a list of post dictionaries.
    """
    if isinstance(posts, str):
        with open(posts, "r") as f:
            posts_data = json.load(f)
    else:
        posts_data = posts

    # Add IDs to posts if they don't have them
    for i, post in enumerate(posts_data):
        if "id" not in post:
            post["id"] = f"post_{i}"

    extractor = OsintExtractor(api_key=api_key)
    results = [extractor.extract(post) for post in posts_data]

    # Optional fallback for legacy support
    if output_path:
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)

    return results
