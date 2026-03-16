import os
import asyncio
from dotenv import load_dotenv # pyre-ignore[21]
from livekit import agents # pyre-ignore[21]
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm, AgentSession, Agent, RoomInputOptions # pyre-ignore[21]
from livekit.plugins import google, noise_cancellation # pyre-ignore[21]

load_dotenv()

AGENT_INSTRUCTIONS = (
    "You are an expert Indian Legal AI Assistant named 'Naya'. "
    "Your job is to provide structured legal guidance on procedures, rights, laws, FIRs, IPC sections, and court procedures. "
    "CRITICAL INSTRUCTION: You must strictly detect the language the user is speaking "
    "(whether it is English, Hindi, Tamil, Telugu, Kannada, or Malayalam) "
    "and you MUST respond exactly in that same language. Do not mix languages unless explaining a specific legal term. "
    "Keep your answers concise, spoken-friendly, and helpful."
)

AGENT_RESPONSES = "Answer the user's questions clearly and concisely as a helpful legal assistant."

class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=AGENT_INSTRUCTIONS) # pyre-ignore[28]

async def entrypoint(ctx: agents.JobContext):
    
    # Connect to room (implicitly via start/connect, but good practice to await explicitly with AutoSubscribe)
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # Initialize Google Gemini Realtime Model session
    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-2.0-flash-exp",
            voice="Puck",
            temperature=0.8,
            instructions=AGENT_INSTRUCTIONS,
        )
    )

    # Start the session with Noise Cancellation
    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    # Await initial hello response equivalent
    await session.generate_reply(
        instructions=AGENT_RESPONSES
    )

if __name__ == "__main__":
    print("Starting COMPLETELY FREE Cloud Multilingual Gemini Realtime Assistant Agent...")
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
