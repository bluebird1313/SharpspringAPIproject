"""
Handler for the /claim slash command.
Allows users to claim ownership of a lead in a thread.
"""
import logging
from typing import Dict, Any

from slack_sdk.errors import SlackApiError
from ..utils.supabase_client import get_supabase
from ..utils.slack_helpers import is_thread, get_parent_message

logger = logging.getLogger(__name__)

async def handle_claim_command(ack, body, client, respond, logger):
    """
    Handle the /claim slash command:
    
    1. Verify command is used in a thread
    2. Get parent message to verify it's a lead
    3. Update lead ownership in Supabase
    4. Add 🤝 reaction
    5. Post confirmation message
    """
    await ack()  # Acknowledge the command request
    
    try:
        # Verify this is used in a thread
        if not await is_thread(body):
            await respond(
                text="⚠️ The `/claim` command can only be used in a thread of a lead message.",
                response_type="ephemeral"
            )
            return
            
        # Get parent message to verify it's a lead thread
        parent_msg = await get_parent_message(client, body)
        
        if not parent_msg or "lead_id" not in parent_msg.get("text", ""):
            await respond(
                text="⚠️ This does not appear to be a lead thread. The `/claim` command can only be used in lead threads.",
                response_type="ephemeral"
            )
            return
            
        # Get user information
        user_id = body["user_id"]
        user_info = await client.users_info(user=user_id)
        user_name = user_info["user"]["real_name"]
        
        # Get thread and channel info
        channel_id = body["channel_id"]
        thread_ts = body.get("thread_ts") or body["message"]["thread_ts"]
        
        # Extract lead_id from parent message
        # This is a simplistic approach - in production you would parse the JSON properly
        import json
        try:
            lead_data = json.loads(parent_msg.get("text", "{}"))
            lead_id = lead_data.get("lead_id")
        except json.JSONDecodeError:
            # Fallback extraction if JSON parsing fails
            import re
            text = parent_msg.get("text", "")
            match = re.search(r'"lead_id"\s*:\s*"([^"]+)"', text)
            if match:
                lead_id = match.group(1)
            else:
                await respond(
                    text="⚠️ Could not extract lead ID from the parent message.",
                    response_type="ephemeral"
                )
                return
        
        # Update lead ownership in Supabase
        supabase = get_supabase()
        
        # Update lead record
        update_data = {
            "owner": user_id,
            "owner_name": user_name,
            "last_activity": "now()",
            "status": "Claimed"
        }
        
        # TODO: Error handling for database operations
        supabase.table("leads").update(update_data).eq("lead_id", lead_id).execute()
        
        # Add 🤝 reaction to parent message
        try:
            await client.reactions_add(
                channel=channel_id,
                timestamp=parent_msg["ts"],
                name="handshake"
            )
        except SlackApiError as e:
            logger.error(f"Error adding reaction: {e}")
        
        # Post confirmation message in thread
        await client.chat_postMessage(
            channel=channel_id,
            thread_ts=thread_ts,
            text=f"🤝 <@{user_id}> has claimed this lead! They are now responsible for follow-up."
        )
        
        logger.info(f"User {user_id} ({user_name}) claimed lead {lead_id}")
            
    except Exception as e:
        logger.exception(f"Error in handle_claim_command: {e}")
        await respond(
            text=f"⚠️ An error occurred while processing your claim: {str(e)}",
            response_type="ephemeral"
        )

def register(app):
    """Register the claim command handler with the Slack app."""
    app.command("/claim")(handle_claim_command) 