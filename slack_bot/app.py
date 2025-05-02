import os, asyncio, logging
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.slack_bot"))

from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.aiohttp import AsyncSocketModeHandler
from slack_bolt.adapter.fastapi import SlackRequestHandler
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request, BackgroundTasks
import uvicorn
import json

from handlers import new_lead, claim, stage, reminders, escalate

# Initialize the Slack app
app = AsyncApp(token=os.environ["SLACK_BOT_TOKEN"], signing_secret=os.environ["SLACK_SIGNING_SECRET"])

# Initialize FastAPI
fastapi_app = FastAPI()
handler = SlackRequestHandler(app)

# Get the leads channel from environment variable or use default
LEADS_CHANNEL = os.environ.get("LEADS_CHANNEL", "#leads-inbox")

# ── Register handlers
new_lead.register(app)
claim.register(app)
stage.register(app)
escalate.register(app)

# ── Background reminders
scheduler = AsyncIOScheduler()
scheduler.add_job(reminders.send_idle_pings, "interval", hours=1, args=[app])
scheduler.start()

# ── FastAPI webhook endpoint for SharpSpring
@fastapi_app.post("/sharpspring")
async def sharpspring_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook endpoint for SharpSpring.
    
    Receives lead data from SharpSpring and posts it to the leads-inbox channel.
    This allows you to skip Zapier and go directly from SharpSpring to your bot.
    """
    try:
        # Parse the incoming webhook data
        data = await request.json()
        logging.info(f"Received SharpSpring webhook: {data}")
        
        # Format the lead data for Slack
        lead_data = {
            "lead_id": str(data.get("id")),
            "first_name": data.get("first_name", ""),
            "last_name": data.get("last_name", ""),
            "name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
            "email": data.get("email", ""),
            "phone": data.get("phone", ""),
            "product": data.get("product_interest", ""),
            "source": data.get("lead_source", "")
        }
        
        # Use the channel from environment variable
        leads_inbox_channel = LEADS_CHANNEL
        
        # Process asynchronously to respond to webhook quickly
        background_tasks.add_task(
            app.client.chat_postMessage,
            channel=leads_inbox_channel,
            text=json.dumps(lead_data)
        )
        
        return {"status": "success", "message": "Lead received and being processed"}
        
    except Exception as e:
        logging.exception(f"Error processing SharpSpring webhook: {e}")
        return {"status": "error", "message": str(e)}

@fastapi_app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}

# For handling Slack events via FastAPI
@fastapi_app.post("/slack/events")
async def slack_events(request: Request):
    return await handler.handle(request)

# Socket Mode handler for development without public URL
async def start_socket_mode():
    handler = AsyncSocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    await handler.start_async()

# Main entry point
async def main():
    if os.environ.get("USE_SOCKET_MODE", "true").lower() == "true":
        # Use Socket Mode for development
        await start_socket_mode()
    else:
        # Use FastAPI for production with webhook
        port = int(os.environ.get("PORT", 8000))
        config = uvicorn.Config(fastapi_app, host="0.0.0.0", port=port)
        server = uvicorn.Server(config)
        await server.serve()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main()) 