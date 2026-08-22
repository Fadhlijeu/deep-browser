"""
Workspace storage and artifact management for Deep-Browser.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import aiofiles


class WorkspaceManager:
    def __init__(self, base_dir: str = "workspace"):
        self.base_path = Path(base_dir)
        self.tasks_dir = self.base_path / "tasks"
        self.sessions_dir = self.base_path / "sessions"
        self.artifacts_dir = self.base_path / "artifacts"
        self.screenshots_dir = self.base_path / "screenshots"
        self.downloads_dir = self.base_path / "downloads"
        self.logs_dir = self.base_path / "logs"
        self._ensure_dirs()

    def _ensure_dirs(self):
        for directory in [
            self.tasks_dir,
            self.sessions_dir,
            self.artifacts_dir,
            self.screenshots_dir,
            self.downloads_dir,
            self.logs_dir,
        ]:
            directory.mkdir(parents=True, exist_ok=True)

    async def save_task_record(self, task_id: str, task_data: Dict[str, Any]) -> str:
        file_path = self.tasks_dir / f"{task_id}.json"
        async with aiofiles.open(file_path, mode="w", encoding="utf-8") as f:
            await f.write(json.dumps(task_data, indent=2, default=str))
        return str(file_path)

    async def load_task_record(self, task_id: str) -> Optional[Dict[str, Any]]:
        file_path = self.tasks_dir / f"{task_id}.json"
        if not file_path.exists():
            return None
        async with aiofiles.open(file_path, mode="r", encoding="utf-8") as f:
            content = await f.read()
            return json.loads(content)

    def list_tasks(self) -> List[str]:
        return [f.stem for f in self.tasks_dir.glob("*.json")]

    async def save_artifact(self, task_id: str, name: str, content: str | bytes) -> str:
        task_artifact_dir = self.artifacts_dir / task_id
        task_artifact_dir.mkdir(parents=True, exist_ok=True)
        file_path = task_artifact_dir / name
        mode = "wb" if isinstance(content, bytes) else "w"
        async with aiofiles.open(file_path, mode=mode) as f:
            await f.write(content)
        return str(file_path)
