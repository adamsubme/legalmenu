#!/usr/bin/env python3
"""
Archive Done tasks from Task Board.
Pages go to Notion trash (recoverable 30 days).

Usage:
  python3 archive-done-tasks.py              # dry run
  python3 archive-done-tasks.py --execute    # actually archive
"""

import json
import os
import subprocess
import sys
import time

TASK_BOARD_ID = "08a013bae265417f806eec29e9bf8d11"
NOTION_KEY = os.environ.get("NOTION_API_KEY") or os.environ.get("NOTION_KEY", "")

if not NOTION_KEY:
    print("ERROR: Set NOTION_API_KEY env var.")
    sys.exit(1)

DRY_RUN = "--execute" not in sys.argv


def notion(method, url, body=None):
    import urllib.request
    import urllib.error
    
    headers = {
        "Authorization": f"Bearer {NOTION_KEY}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
    
    req_body = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=req_body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            try:
                return json.loads(resp.read().decode())
            except json.JSONDecodeError:
                return {"error": "Invalid JSON response from Notion"}
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode())
        except json.JSONDecodeError:
            return {"error": f"HTTP {e.code}: Invalid JSON response"}
    except Exception as e:
        return {"error": str(e)}


def get_done_tasks():
    all_tasks, cursor = [], None
    while True:
        payload = {"filter": {"property": "Status", "select": {"equals": "Done"}}, "page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        data = notion("POST", f"https://api.notion.com/v1/databases/{TASK_BOARD_ID}/query", payload)
        if "results" not in data:
            print(f"ERROR: {data.get('message', data)}")
            return all_tasks
        all_tasks.extend(data["results"])
        if data.get("has_more"):
            cursor = data["next_cursor"]
        else:
            return all_tasks


def main():
    print("=" * 60)
    print("  Task Board Archiver — Done Tasks")
    print("=" * 60)
    print(f"  MODE: {'DRY RUN (add --execute to archive)' if DRY_RUN else 'EXECUTE'}\n")

    tasks = get_done_tasks()
    print(f"Found {len(tasks)} Done tasks.\n")
    if not tasks:
        print("Nothing to archive.")
        return

    archived = failed = 0
    for t in tasks:
        props = t.get("properties", {})
        title_arr = props.get("Task", {}).get("title", [])
        title = title_arr[0].get("plain_text", "?") if title_arr else "?"
        sprint = (props.get("Sprint", {}).get("select") or {}).get("name", "—")
        ai = (props.get("AI Assignee", {}).get("select") or {}).get("name", "—")

        if DRY_RUN:
            print(f"  [DRY] [{sprint}] {title} (AI: {ai})")
            archived += 1
        else:
            try:
                notion("PATCH", f"https://api.notion.com/v1/pages/{t['id']}", {"archived": True})
                print(f"  ✅ [{sprint}] {title}")
                archived += 1
                time.sleep(0.35)
            except Exception as e:
                print(f"  ❌ {title} — {e}")
                failed += 1

    print(f"\n{'=' * 60}")
    print(f"  Archived: {archived} | Failed: {failed}")
    if DRY_RUN:
        print(f"\n  Run with --execute to archive these {archived} tasks.")
    else:
        print(f"  Task Board is now leaner. Pages in Notion trash (30 days).")
    print("=" * 60)


if __name__ == "__main__":
    main()
