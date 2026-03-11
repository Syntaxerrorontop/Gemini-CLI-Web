import json
import os
import subprocess
from project_manager import project_manager

Models = {
    1: "gemini-3.1-pro-preview", # Over the TOP SMARTEST MODEL -> planning and high compelxity Coding
    2: "gemini-3-flash-preview", # CREAT BALANCE BETWEEN SMART AND FAST -> Coding
    3: "gemini-2.5-pro", # Should not be used only fallback -> fallback plaing
    4: "gemini-2.5-flash" # shoudl not be used only fallback -> acctualy never user.
}

DEBUG = True

def debug_log(message) -> None:
    if DEBUG:
        print("DEBUG: ", message)

class Command:
    def build(prompt: str, model: int, use_json:bool=True, use_list=True, session_id:str=None, yolo:bool=False) -> str|list:
        if not use_list:
            command = f"gemini -p '{prompt}' --model '{Models[model]}' "
            if session_id:
                command += f"--resume '{session_id}' "
            if yolo:
                command += "-y "
            if use_json:
                command += "--output-format json "
        
        else:
            command = ["gemini", "-p", f"{prompt}", "--model", f"{Models[model]}"]
            if session_id:
                command.extend(["--resume", session_id])
            if yolo:
                command.append("-y")
            if use_json:
                command = command + ["--output-format", "json"]

        debug_log(f"Command: {command}")
        return command
    
    def execute(command: list, cwd: str = None) -> dict:
        try:
            # Run the command in the specified directory
            result = subprocess.run(command, capture_output=True, text=True, check=True, cwd=cwd)
            try:
                ai_response = json.loads(result.stdout)
                if "stats" in ai_response:
                    project_manager.update_stats(ai_response["stats"])
                return ai_response
            except json.JSONDecodeError:
                return {"response": result.stdout, "session_id": None, "stats": {}}
        except subprocess.CalledProcessError as e:
            debug_log(f"Process Error: {e.stderr}")
            return {"error": e.stderr, "response": None}

class InternalPrompts:
    def __init__(self) -> None:
        plan_generation = None
        system_prompt = None
        worker_prompt = None
    
class InternalSafty:
    def __init__(self) -> None:
        force_formating = None

class CustomConfig:
    def __init__(self) -> None:
        self.__config = self.load_config()

        self.safty: InternalSafty = InternalSafty()
        self.prompts: InternalPrompts = InternalPrompts()

        self.__init_config()
    
    def __get_default_config(self) -> dict:
        return {
            "prompts": {
                "plan_generation": """You are an Elite AI Software Architect and Technical Project Manager. 
Your mission is to decompose complex software requirements into a high-precision, executable roadmap. 

DEEP ANALYSIS PHASE:
1. Analyze the user's core intent and identify the optimal technology stack and architectural patterns.
2. Anticipate potential technical debt, security risks, and integration challenges.
3. Define a logical sequence of atomic, non-overlapping steps that build upon each other.

OUTPUT REQUIREMENTS:
- Your response must be a SINGLE, valid JSON object.
- Use sequential integer strings ("1", "2", ...) as keys.
- Each value must be an object with:
    - "title": A concise, professional name for the phase.
    - "goal": A highly detailed, technical instruction set for the coding agent. 
      Include specific file names, library recommendations, and logic requirements. 
      The goal must provide enough context so the agent can work autonomously.

STRICT RULE: NO conversational filler, NO markdown, NO preamble. ONLY the JSON object.

Example Structure:
{
  "1": { "title": "...", "goal": "..." },
  "2": { "title": "...", "goal": "..." }
}""",
                "system_prompt": "You are operating as a high-performance Autonomous Engineering Agent. Maintain a high-signal, professional tone.",
                "worker_prompt": """You are a World-Class Autonomous Senior Full-Stack Engineer. 
Your task is to execute the following roadmap step with absolute technical excellence:
---
TASK GOAL: {TASK_GOAL}
---

OPERATIONAL PROTOCOL:
1. **Research & Contextualization**: Before making changes, examine the existing codebase to ensure architectural consistency.
2. **Mandatory Verbosity**: You MUST announce every single tool call BEFORE you execute it. 
   Example: 'STRATEGY: I need to check the current directory structure. TOOL: Calling ls_dir...'
   Example: 'STRATEGY: Implementing the login logic. TOOL: Using write_file for auth.py...'
3. **Transparent Thought Process**: Explain your reasoning for each major decision.
4. **No Placeholders**: Write complete, production-ready code.
5. **Validation**: Ensure that your changes are logically sound.

CRITICAL COMPLETION SIGNAL:
When the task is fully completed, output EXACTLY AND ONLY this JSON at the very end:
{"success": true}

Now, begin your analysis."""
                },
            "safty": {
                "force_formating": True
            }
        }
    
    def __helper_config(self, mainkey: str, subkey: str) -> any:
        config = self.__config.get(mainkey, {})

        if not config:
            default_values = self.__get_default_config().get(mainkey)
            self.__config[mainkey] = default_values
            self.write_config(self.__config)

            return default_values.get(subkey)
        
        value = config.get(subkey, {})

        if not value:
            default_value = self.__get_default_config().get(mainkey).get(subkey)
            self.__config[mainkey][subkey] = default_value
            self.write_config(self.__config)

            return default_value
        
        return value

    
    def load_config(self) -> dict:
        path = os.path.join(os.path.dirname(__file__), "config.json")
        try:
            with open(path, 'r') as config_file:
                my_config = json.load(config_file)
        except Exception:
            debug_log("No Config found -> Default Config")
            my_config = self.__get_default_config()
            self.write_config(my_config)
        
        return my_config
     
    def write_config(self, config: dict) -> None:
        path = os.path.join(os.path.dirname(__file__), "config.json")
        with open(path, 'w') as config_file:
            json.dump(config, config_file, indent=4)
        
        debug_log("Config Saved")
    
    def __init_config(self) -> None:
        for mainkey, values in self.__get_default_config().items():
            internal_obj = getattr(self, mainkey)
            for subkey in values.keys():
                value = self.__helper_config(mainkey, subkey)
                setattr(internal_obj, subkey, value)
        
config = CustomConfig()

class AgentOrchestrator:
    def __init__(self) -> None:
        pass
    
    def generate_plan_for_project(self, project_id: str, prompt: str, model: int = 1) -> dict:
        project = project_manager.get_project(project_id)
        path = project.get("path") if project else None
        
        # Explicitly tell the AI about its workspace
        workspace_info = f"\n\nCRITICAL CONTEXT: Your current workspace/output directory is: {path if path else 'current directory'}. All files must be created or modified relative to this path."
        
        initial_prompt = config.prompts.system_prompt + config.prompts.plan_generation + workspace_info + "\n\nUser Request: " + prompt
        command = Command.build(initial_prompt, model=model)
        data = Command.execute(command, cwd=path)

        
        if "response" in data:
            try:
                # The response might be a JSON string inside the JSON wrapper
                plan_json = json.loads(data["response"]) if isinstance(data["response"], str) else data["response"]
                project_manager.set_new_plan(project_id, plan_json, data.get("session_id"))
                return {"status": "success", "plan": plan_json, "session_id": data.get("session_id")}
            except Exception as e:
                debug_log(f"Failed to parse plan JSON: {e}")
                return {"status": "error", "message": "Failed to parse plan output."}
        return {"status": "error", "message": "Execution failed"}
