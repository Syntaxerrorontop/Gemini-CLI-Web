from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import subprocess
import json
import os
import pty
from project_manager import project_manager
from importand_workflows import AgentOrchestrator, config, Models

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = AgentOrchestrator()

class ProjectCreate(BaseModel):
    name: str
    description: str
    path: str

class PlanRequest(BaseModel):
    prompt: str

@app.get("/api/projects")
def get_projects():
    return project_manager.get_projects()

@app.post("/api/projects")
def create_project(data: ProjectCreate):
    return project_manager.create_project(data.name, data.description, data.path)

@app.get("/api/config")
def get_config():
    return config.load_config()

@app.post("/api/config")
def update_config(new_config: dict):
    config.write_config(new_config)
    return {"status": "success"}

@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    return project_manager.get_project(project_id)

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    if project_manager.delete_project(project_id):
        return {"status": "success"}
    return {"status": "error", "message": "Project not found"}

@app.post("/api/projects/{project_id}/plan")
def generate_plan(project_id: str, data: PlanRequest):
    project_manager.add_prompt(project_id, data.prompt)
    result = orchestrator.generate_plan_for_project(project_id, data.prompt)
    return result

@app.post("/api/projects/{project_id}/restore-plan/{history_id}")
def restore_plan(project_id: str, history_id: str):
    result = project_manager.restore_plan(project_id, history_id)
    if result: return {"status": "success", "project": result}
    return {"status": "error", "message": "Failed to restore plan"}

@app.put("/api/projects/{project_id}/step/{step_idx}")
def set_current_step(project_id: str, step_idx: int):
    result = project_manager.update_project(project_id, {"current_step": step_idx})
    if result: return {"status": "success", "project": result}
    return {"status": "error", "message": "Failed to update step"}

@app.put("/api/projects/{project_id}/plan")
def update_plan(project_id: str, plan_data: dict):
    return project_manager.update_project(project_id, {"plan": plan_data, "status": "planned"})

@app.get("/api/fs/list")
def list_dirs(path: str = "/"):
    try:
        # Use home directory as default if path is empty or root
        if not path or path == "/":
            path = os.path.expanduser("~")
            
        items = []
        # Get parent dir
        parent = os.path.dirname(path)
        
        for entry in os.scandir(path):
            if entry.is_dir() and not entry.name.startswith('.'):
                items.append({
                    "name": entry.name,
                    "path": entry.path,
                    "is_dir": True
                })
        
        # Sort alphabetically
        items.sort(key=lambda x: x["name"].lower())
        
        return {
            "current_path": path,
            "parent_path": parent,
            "items": items
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/stats")
def get_stats():
    return project_manager.get_global_stats()

@app.websocket("/ws/execute/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    await websocket.accept()
    auto_continue = websocket.query_params.get("auto_continue") == "true"
    
    while True:
        project = project_manager.get_project(project_id)
        if not project or not project.get("plan"):
            await websocket.send_text("Error: Project or plan not found.")
            break

        plan = project.get("plan", {})
        session_id = project.get("session_id")
        current_step_idx = project.get("current_step", 0)
        steps_keys = sorted([k for k in plan.keys() if k.isdigit()], key=int)
        
        if current_step_idx >= len(steps_keys):
             await websocket.send_text("\n[System] 🎉 ALL PLAN STEPS COMPLETED SUCCESSFULLY!\n")
             break

        step_key = steps_keys[current_step_idx]
        step_data = plan[step_key]
        
        # Load latest config for each step to allow dynamic prompt updates
        current_config = config.load_config()
        path = project.get("path", "current directory")
        task_goal = f"{step_data.get('title', '')} - {step_data.get('goal', '')}"
        
        # Inject the path context into the worker prompt
        path_context = f"\n\nWORKSPACE: Your working directory is {path if path else 'current directory'}. All actions must happen within this folder."
        worker_prompt = current_config["prompts"]["worker_prompt"].replace("{TASK_GOAL}", task_goal) + path_context
        
        await websocket.send_text(f"\n[System] >>> STARTING STEP {step_key}/{len(steps_keys)}: {step_data.get('title')}\n")
        
        cmd = ["gemini", "-p", worker_prompt, "--model", Models[2], "-y"]
        if session_id:
            cmd.extend(["--resume", session_id])

        master, slave = pty.openpty()
        # Start the process in the project's directory
        process = subprocess.Popen(cmd, stdin=slave, stdout=slave, stderr=subprocess.STDOUT, close_fds=True, cwd=path)
        os.close(slave)
        output_buffer = ""

        async def read_output():
            nonlocal output_buffer
            loop = asyncio.get_event_loop()
            while True:
                try:
                    data = await loop.run_in_executor(None, os.read, master, 1024)
                    if not data: break
                    text = data.decode('utf-8')
                    output_buffer += text
                    await websocket.send_text(text)
                except: break

        async def read_input():
            while True:
                try:
                    data = await websocket.receive_text()
                    os.write(master, data.encode('utf-8'))
                except: break

        rtask = asyncio.create_task(read_output())
        itask = asyncio.create_task(read_input())
        await asyncio.get_event_loop().run_in_executor(None, process.wait)
        rtask.cancel()
        itask.cancel()
        os.close(master)

        if '{"success": true}' in output_buffer or '{"success":true}' in output_buffer:
            new_step = current_step_idx + 1
            project_manager.update_project(project_id, {"current_step": new_step})
            await websocket.send_text("[DB_UPDATE]")
            await websocket.send_text(f"\n[System] ✅ Step {step_key} successful!\n")
            if not auto_continue: break
        else:
            await websocket.send_text(f"\n[System] ❌ Step {step_key} failed success signal.\n")
            break

    await websocket.send_text("\n[System] Session ended.\n")
    await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
