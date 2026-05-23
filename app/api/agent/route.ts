import { NextResponse } from 'next/server';
import { getUserProfile, getUserTransactions } from '../../../lib/memory/profile-store';
import { getSession, updateSessionHistory } from '../../../lib/memory/session-store';
import { AgentContext } from '../../../lib/types';
import { runAgentLoop } from '../../../lib/orchestrator/react-loop';
import { ReasoningLogger } from '../../../lib/orchestrator/reasoning-logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, message, sessionId } = body;

    if (!userId || !message || !sessionId) {
      return NextResponse.json({ error: 'Missing userId, message, or sessionId' }, { status: 400 });
    }

    const profile = getUserProfile(userId);
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const txns = getUserTransactions(userId);
    const session = getSession(sessionId);

    // Initial context
    const context: AgentContext = {
      userId,
      userProfile: profile,
      transactions: txns,
      conversationHistory: session.conversationHistory,
      sessionId
    };

    updateSessionHistory(sessionId, [{ role: "user", content: message }]);
    
    // We update context to latest
    context.conversationHistory = session.conversationHistory;

    const logger = new ReasoningLogger();
    
    // Execute orchestrator
    const response = await runAgentLoop(message, context, logger, 5);

    // Update history with assistant final response
    updateSessionHistory(sessionId, [{ role: "assistant", content: response.message }]);

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("Agent Route Error:", err);
    return NextResponse.json({ error: err.message || "Internal agent error" }, { status: 500 });
  }
}
