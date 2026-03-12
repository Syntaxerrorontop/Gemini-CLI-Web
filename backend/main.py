from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import subprocess
import json
import os
import pty
from project_manager import project_manager
from importand_workflows import AgentOrchestrator, config, Models, Command

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

class AgentRequest(BaseModel):
    prompt: str
    mode: str # planning, ideas

@app.get("/api/projects")
def get_projects():
    return project_manager.get_projects()

@app.post("/api/projects")
def create_project(data: ProjectCreate):
    return project_manager.create_project(data.name, data.description, data.path)

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    if project_manager.delete_project(project_id):
        return {"status": "success"}
    return {"status": "error", "message": "Project not found"}

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

@app.post("/api/projects/{project_id}/agent")
def run_specialized_agent(project_id: str, data: AgentRequest):
    project = project_manager.get_project(project_id)
    if not project: return {"error": "Project not found"}
    project_manager.add_prompt(project_id, data.prompt)
    
    current_config = config.load_config()
    path = project.get("path")
    
    if data.mode == "planning":
        workspace_info = f"\n\nCRITICAL CONTEXT: Your current workspace/output directory is: {path if path else 'current directory'}. All files must be created or modified relative to this path."
        prompt = current_config["prompts"]["plan_generation"] + workspace_info + f"\n\nUser Request: {data.prompt}"
        cmd = Command.build(prompt, model=1)
        res = Command.execute(cmd, cwd=path)
        if "response" in res:
            try:
                plan_json = json.loads(res["response"]) if isinstance(res["response"], str) else res["response"]
                project_manager.set_new_plan(project_id, plan_json, res.get("session_id"))
                return {"status": "success", "data": plan_json}
            except: pass
        return {"status": "error", "message": "Failed to generate plan"}
    
    elif data.mode == "ideas":
        prompt = current_config["prompts"]["feature_ideas_prompt"] + f"\n\nProject: {project['name']}\nUser Input: {data.prompt}"
        cmd = Command.build(prompt, model=1, use_json=False)
        res = Command.execute(cmd, cwd=path)
        return {"status": "success", "data": res.get("response")}
        
    return {"status": "error", "message": "Invalid mode for this endpoint"}

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
        if not path or path == "/": path = os.path.expanduser("~")
        items = []
        parent = os.path.dirname(path)
        for entry in os.scandir(path):
            if not entry.name.startswith('.'):
                items.append({"name": entry.name, "path": entry.path, "is_dir": entry.is_dir()})
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        return {"current_path": path, "parent_path": parent, "items": items}
    except Exception as e: return {"error": str(e)}

@app.get("/api/fs/read")
def read_file_content(path: str):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {"content": content}
    except Exception as e: return {"error": str(e)}

@app.get("/api/stats")
def get_stats():
    return project_manager.get_global_stats()

@app.websocket("/ws/execute/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    await websocket.accept()
    auto_continue = websocket.query_params.get("auto_continue") == "true"
    mode = websocket.query_params.get("mode", "roadmap")
    direct_prompt = websocket.query_params.get("direct_prompt", "")
    
    async def run_agent_process(prompt_text, session, start_msg, work_dir):
        await websocket.send_text(start_msg)
        cmd = ["gemini", "-p", prompt_text, "--model", Models[2], "-y"]
        if session: cmd.extend(["--resume", session])

        master, slave = pty.openpty()
        process = subprocess.Popen(cmd, stdin=slave, stdout=slave, stderr=subprocess.STDOUT, close_fds=True, cwd=work_dir)
        os.close(slave)
        
        output_buffer = ""
        loop = asyncio.get_event_loop()

        async def read_output():
            nonlocal output_buffer
            while True:
                try:
                    data = await loop.run_in_executor(None, os.read, master, 1024)
                    if not data: break
                    text = data.decode('utf-8', errors='replace')
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
        await loop.run_in_executor(None, process.wait)
        rtask.cancel()
        itask.cancel()
        os.close(master)
        return output_buffer

    while True:
        project = project_manager.get_project(project_id)
        if not project: break
        session_id = project.get("session_id")
        current_config = config.load_config()
        path = project.get("path", "current directory")
        path_context = f"\n\nWORKSPACE: Your working directory is {path if path else 'current directory'}."

        if mode == "roadmap":
            if not project.get("plan"):
                await websocket.send_text("Error: Plan not found.")
                break
            plan = project.get("plan", {})
            current_step_idx = project.get("current_step", 0)
            steps_keys = sorted([k for k in plan.keys() if k.isdigit()], key=int)
            if current_step_idx >= len(steps_keys):
                 await websocket.send_text("\n[System] 🎉 ALL PLAN STEPS COMPLETED SUCCESSFULLY!\n")
                 break
            step_key = steps_keys[current_step_idx]
            step_data = plan[step_key]
            task_goal = f"{step_data.get('title', '')} - {step_data.get('goal', '')}"
            worker_prompt = current_config["prompts"]["worker_prompt"].replace("{TASK_GOAL}", task_goal) + path_context
            start_msg = f"\n[System] >>> STARTING STEP {step_key}: {step_data.get('title')}\n"
        
        elif mode == "debugging":
            worker_prompt = current_config["prompts"]["debugging_prompt"] + f"\n\nDIRECT TASK/ERROR: {direct_prompt}" + path_context
            start_msg = "\n[System] >>> STARTING DIRECT DEBUGGING SESSION\n"
            auto_continue = False

        # 1. RUN CODER / DEBUGGER
        out_buf = await run_agent_process(worker_prompt, session_id, start_msg, path)
        success = '{"success": true}' in out_buf or '{"success":true}' in out_buf
        
        # 2. AUTO-RECOVERY
        if not success and current_config.get("features", {}).get("enable_recovery", False):
            await websocket.send_text("\n[System] ⚠️ Agent failed to report success. Triggering AUTO-RECOVERY...\n")
            error_log = out_buf[-2000:]
            recovery_prompt = current_config["prompts"]["recovery_prompt"].replace("{ERROR_LOG}", error_log) + path_context
            out_buf = await run_agent_process(recovery_prompt, session_id, "[System] >>> RECOVERY AGENT ACTIVE\n", path)
            success = '{"success": true}' in out_buf or '{"success":true}' in out_buf

        if not success:
            await websocket.send_text(f"\n[System] ❌ Step failed. Stopping.\n")
            break

        # 3. REVIEWER
        if current_config.get("features", {}).get("enable_reviewer", False) and mode == "roadmap":
            await websocket.send_text("\n[System] 🔍 Step marked successful. Triggering REVIEWER AGENT...\n")
            rev_prompt = current_config["prompts"]["reviewer_prompt"].replace("{TASK_GOAL}", task_goal) + path_context
            rev_buf = await run_agent_process(rev_prompt, session_id, "[System] >>> REVIEWER AGENT ACTIVE\n", path)
            if '{"approved": true}' not in rev_buf.replace(" ", ""):
                await websocket.send_text("\n[System] ❌ Reviewer rejected changes.\n")
                break
            await websocket.send_text("\n[System] ✅ Reviewer APPROVED!\n")

        if mode == "roadmap":
            new_step = current_step_idx + 1
            project_manager.update_project(project_id, {"current_step": new_step})
            await websocket.send_text("[DB_UPDATE]")
            await websocket.send_text(f"\n[System] ✅ Step {step_key} fully completed!\n")
        
        if not auto_continue: break

    await websocket.send_text("\n[System] Session ended.\n")
    await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
