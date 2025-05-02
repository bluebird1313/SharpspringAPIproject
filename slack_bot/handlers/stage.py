"""
Handler for the /stage slash command and emoji reactions.
Allows users to update the stage of a lead.
"""
import logging
import re
import json
from typing import Dict, Any, Optional, Tuple

from slack_sdk.errors import SlackApiError
from ..utils.supabase_client import get_supabase
from ..utils.slack_helpers import is_thread, get_parent_message, get_lead_id_from_message

logger = logging.getLogger(__name__)

# Stage definitions with their corresponding emoji
STAGES = {
    "Contacted": "telephone",
    "Qualified": "mag",
    "Won": "white_check_mark",
    "Lost": "x"
}

async def update_lead_stage(client, body, channel_id, thread_ts, parent_msg, lead_id, stage, user_id):
    """
    Common function to update a lead's stage in both commands and reactions.
    
    Args:
        client: Slack client
        body: Request body
        channel_id: Channel ID
        thread_ts: Thread timestamp
        parent_msg: Parent message data
        lead_id: Lead ID
        stage: New stage value
        user_id: User making the change
    """
    # Get emoji for the stage
    emoji = STAGES.get(stage)
    if not emoji:
        return False, f"Invalid stage: {stage}. Valid stages are: {', '.join(STAGES.keys())}"
        
    try:
        # Get user information
        user_info = await client.users_info(user=user_id)
        user_name = user_info["user"]["real_name"]
        
        # Update lead stage in Supabase
        supabase = get_supabase()
        
        # Update lead record
        update_data = {
            "status": stage,
            "last_activity": "now()",
            "updated_by": user_id
        }
        
        supabase.table("leads").update(update_data).eq("lead_id", lead_id).execute()
        
        # Add appropriate emoji reaction to parent message
        try:
            # Check if reaction already exists
            reactions = parent_msg.get("reactions", [])
            reaction_exists = any(r.get("name") == emoji for r in reactions)
            
            if not reaction_exists:
                await client.reactions_add(
                    channel=channel_id,
                    timestamp=parent_msg["ts"],
                    name=emoji
                )
        except SlackApiError as e:
            logger.error(f"Error adding reaction: {e}")
        
        # Post confirmation message in thread
        await client.chat_postMessage(
            channel=channel_id,
            thread_ts=thread_ts,
            text=f"*Status Updated:* {stage} :{emoji}: by <@{user_id}>"
        )
        
        logger.info(f"User {user_id} ({user_name}) updated lead {lead_id} to stage: {stage}")
        return True, None
            
    except Exception as e:
        logger.exception(f"Error in update_lead_stage: {e}")
        return False, str(e)

async def handle_stage_command(ack, body, client, respond, logger):
    """
    Handle the /stage slash command:
    
    1. Verify command is used in a thread
    2. Get parent message to verify it's a lead
    3. Parse the requested stage
    4. Update lead stage in Supabase
    5. Add appropriate emoji reaction
    6. Post confirmation message
    """
    await ack()  # Acknowledge the command request
    
    try:
        # Verify this is used in a thread
        if not await is_thread(body):
            await respond(
                text="⚠️ The `/stage` command can only be used in a thread of a lead message.",
                response_type="ephemeral"
            )
            return
            
        # Get parent message to verify it's a lead thread
        parent_msg = await get_parent_message(client, body)
        
        if not parent_msg or "lead_id" not in parent_msg.get("text", ""):
            await respond(
                text="⚠️ This does not appear to be a lead thread. The `/stage` command can only be used in lead threads.",
                response_type="ephemeral"
            )
            return
            
        # Get thread and channel info
        channel_id = body["channel_id"]
        thread_ts = body.get("thread_ts") or body["message"]["thread_ts"]
        user_id = body["user_id"]
        
        # Extract the requested stage from command text
        command_text = body.get("text", "").strip()
        if not command_text:
            stages_list = "\n".join([f"• {stage} :{emoji}:" for stage, emoji in STAGES.items()])
            await respond(
                text=f"Please specify a stage. Valid options are:\n{stages_list}\n\nExample: `/stage Contacted`",
                response_type="ephemeral"
            )
            return
            
        # Find matching stage (case insensitive)
        stage = None
        for valid_stage in STAGES.keys():
            if valid_stage.lower() == command_text.lower():
                stage = valid_stage
                break
                
        if not stage:
            stages_list = "\n".join([f"• {stage} :{emoji}:" for stage, emoji in STAGES.items()])
            await respond(
                text=f"Invalid stage: '{command_text}'. Valid options are:\n{stages_list}",
                response_type="ephemeral"
            )
            return
            
        # Extract lead_id from parent message
        lead_id = await get_lead_id_from_message(parent_msg)
        if not lead_id:
            await respond(
                text="⚠️ Could not extract lead ID from the parent message.",
                response_type="ephemeral"
            )
            return
            
        # Update lead stage
        success, error = await update_lead_stage(
            client, body, channel_id, thread_ts, parent_msg, lead_id, stage, user_id
        )
        
        if not success:
            await respond(
                text=f"⚠️ An error occurred while updating the stage: {error}",
                response_type="ephemeral"
            )
            
    except Exception as e:
        logger.exception(f"Error in handle_stage_command: {e}")
        await respond(
            text=f"⚠️ An error occurred while processing your stage update: {str(e)}",
            response_type="ephemeral"
        )

async def handle_reaction_added(body, client, logger):
    """
    Handle emoji reactions that match our stage emojis:
    
    1. Verify reaction is on a lead message
    2. Check if the emoji matches a stage
    3. Update lead stage in Supabase (same logic as /stage command)
    """
    try:
        # Extract relevant information
        reaction = body["event"]["reaction"]
        user_id = body["event"]["user"]
        item = body["event"]["item"]
        channel_id = item["channel"]
        message_ts = item["ts"]
        
        # Check if reaction matches any of our stage emojis
        stage = None
        for s, emoji in STAGES.items():
            if emoji == reaction:
                stage = s
                break
                
        if not stage:
            # Not a stage emoji, ignore
            return
            
        # Get the message that was reacted to
        try:
            result = await client.conversations_history(
                channel=channel_id,
                latest=message_ts,
                inclusive=True,
                limit=1
            )
            if not result["messages"]:
                logger.error("Could not retrieve message that was reacted to")
                return
                
            message = result["messages"][0]
            
            # Check if this is a lead message
            if "lead_id" not in message.get("text", ""):
                # Not a lead message, ignore
                return
                
            # Extract lead_id from message
            lead_id = await get_lead_id_from_message(message)
            if not lead_id:
                logger.error("Could not extract lead ID from message")
                return
                
            # Get thread ts (same as message ts for parent message)
            thread_ts = message_ts
            
            # Update lead stage
            await update_lead_stage(
                client, body, channel_id, thread_ts, message, lead_id, stage, user_id
            )
                
        except SlackApiError as e:
            logger.error(f"Error fetching message details: {e}")
            
    except Exception as e:
        logger.exception(f"Error in handle_reaction_added: {e}")

def register(app):
    """Register the stage command and reaction handlers with the Slack app."""
    app.command("/stage")(handle_stage_command)
    
    # Listen for reaction_added events
    app.event("reaction_added")(handle_reaction_added) 