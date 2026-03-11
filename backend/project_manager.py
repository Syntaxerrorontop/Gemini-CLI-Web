import json
import os
import uuid
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(__file__), "projects_db.json")

class ProjectManager:
    def __init__(self):
        self.db = self._load_db()

    def _load_db(self):
        if not os.path.exists(DB_FILE):
            default_db = {
                "projects": {},
                "global_stats": {
                    "total_tokens": 0,
                    "total_requests": 0,
                    "models": {}
                }
            }
            self._save_db(default_db)
            return default_db
        try:
            with open(DB_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return {"projects": {}, "global_stats": {"total_tokens": 0, "total_requests": 0, "models": {}}}

    def _save_db(self, db_data=None):
        if db_data is None:
            db_data = self.db
        with open(DB_FILE, 'w') as f:
            json.dump(db_data, f, indent=4)

    def create_project(self, name, description, path):
        project_id = str(uuid.uuid4())
        
        project = {
            "id": project_id,
            "name": name,
            "description": description,
            "path": os.path.abspath(path),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "plan": None,
            "plan_history": [],
            "prompts": [],
            "session_id": None,
            "status": "created", # created, planned, executing, done
            "current_step": 0
        }
        self.db["projects"][project_id] = project
        self._save_db()
        return project

    def add_prompt(self, project_id, prompt):
        project = self.get_project(project_id)
        if project:
            if "prompts" not in project: project["prompts"] = []
            project["prompts"].append({"text": prompt, "timestamp": datetime.now().isoformat()})
            self._save_db()

    def set_new_plan(self, project_id, plan, session_id):
        project = self.get_project(project_id)
        if not project:
            return None
        
        # Move current plan to history if it exists
        if project.get("plan"):
            history_entry = {
                "id": str(uuid.uuid4())[:8],
                "plan": project["plan"],
                "archived_at": datetime.now().isoformat(),
                "completed_steps": project.get("current_step", 0),
                "session_id": project.get("session_id")
            }
            if "plan_history" not in project:
                project["plan_history"] = []
            project["plan_history"].append(history_entry)

        # Update with new plan and reset progress
        project["plan"] = plan
        project["session_id"] = session_id
        project["current_step"] = 0
        project["status"] = "planned"
        project["updated_at"] = datetime.now().isoformat()
        
        self.db["projects"][project_id] = project
        self._save_db()
        return project

    def restore_plan(self, project_id, history_id):
        project = self.get_project(project_id)
        if not project or "plan_history" not in project:
            return None
        
        # Find the plan in history
        for i, entry in enumerate(project["plan_history"]):
            if entry["id"] == history_id:
                # Swap current and history
                old_plan = project["plan"]
                old_steps = project["current_step"]
                old_session = project["session_id"]

                project["plan"] = entry["plan"]
                project["current_step"] = entry["completed_steps"]
                project["session_id"] = entry.get("session_id")
                
                # Update the history entry with what was current
                project["plan_history"][i] = {
                    "id": history_id,
                    "plan": old_plan,
                    "archived_at": datetime.now().isoformat(),
                    "completed_steps": old_steps,
                    "session_id": old_session
                }
                
                project["updated_at"] = datetime.now().isoformat()
                project["status"] = "planned"
                self._save_db()
                return project
        return None

    def get_projects(self):
        # Return sorted by updated_at descending
        projects = list(self.db["projects"].values())
        return sorted(projects, key=lambda x: x["updated_at"], reverse=True)

    def get_project(self, project_id):
        return self.db["projects"].get(project_id)

    def update_project(self, project_id, updates):
        if project_id in self.db["projects"]:
            self.db["projects"][project_id].update(updates)
            self.db["projects"][project_id]["updated_at"] = datetime.now().isoformat()
            self._save_db()
            return self.db["projects"][project_id]
        return None

    def delete_project(self, project_id):
        if project_id in self.db["projects"]:
            del self.db["projects"][project_id]
            self._save_db()
            return True
        return False

    def update_stats(self, new_stats):
        if not new_stats or "models" not in new_stats:
            return

        for model_name, model_data in new_stats["models"].items():
            if model_name not in self.db["global_stats"]["models"]:
                self.db["global_stats"]["models"][model_name] = {
                    "requests": 0,
                    "tokens": 0
                }
            
            # Update specific model stats
            api_stats = model_data.get("api", {})
            token_stats = model_data.get("tokens", {})
            
            req_count = api_stats.get("totalRequests", 0)
            tok_count = token_stats.get("total", 0)

            self.db["global_stats"]["models"][model_name]["requests"] += req_count
            self.db["global_stats"]["models"][model_name]["tokens"] += tok_count
            
            # Update global totals
            self.db["global_stats"]["total_requests"] += req_count
            self.db["global_stats"]["total_tokens"] += tok_count

        self._save_db()

    def get_global_stats(self):
        return self.db.get("global_stats", {})

project_manager = ProjectManager()
