import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_ANON_KEY"]
        _client = create_client(url, key)
    return _client


def fetch_items(context: str | None = None, item_type: str | None = None) -> list[dict]:
    client = get_client()
    query = client.table("items").select("*").order("created_at", desc=True)
    if context:
        query = query.eq("context", context)
    if item_type:
        query = query.eq("type", item_type)
    return query.execute().data


def save_memo_with_items(raw_text: str, items: list[dict]) -> None:
    client = get_client()
    memo = client.table("memos").insert({"raw_text": raw_text}).execute().data[0]
    if items:
        rows = [
            {
                "memo_id": memo["id"],
                "context": item["context"],
                "type": item["type"],
                "content": item["content"],
                "due_date": item.get("due_date"),
            }
            for item in items
        ]
        client.table("items").insert(rows).execute()


def toggle_item(item_id: str, is_done: bool) -> None:
    get_client().table("items").update({"is_done": is_done}).eq("id", item_id).execute()
