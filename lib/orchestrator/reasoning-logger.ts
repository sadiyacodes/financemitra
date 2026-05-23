import { ReasoningStep } from "../types";

export class ReasoningLogger {
  private steps: ReasoningStep[] = [];
  private stepCount = 0;

  getLog(): ReasoningStep[] {
    return this.steps;
  }

  log(step: Omit<ReasoningStep, 'stepNumber' | 'timestamp'>): void {
    this.stepCount++;
    this.steps.push({
      ...step,
      stepNumber: this.stepCount,
      timestamp: new Date().toISOString()
    });
  }

  getSummary(sessionId: string, userName: string): string {
    let output = `┌─ FinanceMitra Reasoning Log ──────────────────────────────────────────┐\n`;
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    // pad string helper
    const pad = (str: string, len: number) => {
      if (str.length > len) return str.substring(0, len-3) + "...";
      return str + " ".repeat(len - str.length);
    };

    output += `│ Session: ${pad(sessionId, 8)} · User: ${pad(userName, 12)} · ${time}                         │\n`;
    output += `├───────────────────────────────────────────────────────────────────────┤\n`;

    for (let i = 0; i < this.steps.length; i++) {
      const s = this.steps[i];
      if (s.toolCalled) {
        // ACT step
        let toolInputStr = s.toolInput ? JSON.stringify(s.toolInput) : "";
        if (toolInputStr === "{}") toolInputStr = "";
        const callDesc = toolInputStr ? `${s.toolCalled} (${toolInputStr})` : s.toolCalled;
        
        output += `│ Step ${s.stepNumber} · ACT → ${pad(callDesc, 55)}│\n`;
        if (s.toolOutput) {
          const lines = s.toolOutput.split("\n");
          for (const line of lines) {
             output += `│ Result: ${pad(line, 62)}│\n`;
          }
        }
      } else {
        // THINK step
        output += `│ Step ${s.stepNumber} · THINK                                                        │\n`;
        const lines = s.thought.split("\n");
        for (let j = 0; j < lines.length; j++) {
           const prefix = j === 0 ? "Thought:" : "        ";
           output += `│ ${prefix} ${pad(lines[j], 61)}│\n`;
        }
        if (i === this.steps.length - 1 && !s.toolCalled) {
          output += `│ Decision: Final answer                                                 │\n`;
        } else if (i < this.steps.length - 1 && this.steps[i+1].toolCalled) {
          output += `│ Decision: Call ${pad(this.steps[i+1].toolCalled as string, 55)}│\n`;
        }
      }

      if (i < this.steps.length - 1) {
        output += `├───────────────────────────────────────────────────────────────────────┤\n`;
      }
    }

    output += `└───────────────────────────────────────────────────────────────────────┘`;
    return output;
  }

  clear(): void {
    this.steps = [];
    this.stepCount = 0;
  }
}
