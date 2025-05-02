"""
Handler for the /escalate slash command.
Creates a private channel for high-priority leads and copies thread content.
"""
import logging
import re
import asyncio
from typing import Dict, Any, List, Optional

from slack_sdk.errors import SlackApiError
from ..utils.supabase_client import get_supabase
from ..utils.slack_helpers import is_thread, get_parent_message, get_lead_id_from_message, get_thread_messages

logger = logging.getLogger(__name__)

async def handle_escalate_command(ack, body, client, respond, logger):
    """
    Handle the /escalate slash command:
    
    1. Verify command is used in a thread
    2. Get parent message to verify it's a lead
    3. Create a private channel with a unique name
    4. Invite the requester and sales managers
    5. Post a canvas/thread summary of the lead conversation
    6. Update lead status in Supabase
    """
    await ack()  # Acknowledge the command request
    
    try:
        # Verify this is used in a thread
        if not await is_thread(body):
            await respond(
                text="⚠️ The `/escalate` command can only be used in a thread of a lead message.",
                response_type="ephemeral"
            )
            return
            
        # Get parent message to verify it's a lead thread
        parent_msg = await get_parent_message(client, body)
        
        if not parent_msg or "lead_id" not in parent_msg.get("text", ""):
            await respond(
                text="⚠️ This does not appear to be a lead thread. The `/escalate` command can only be used in lead threads.",
                response_type="ephemeral"
            )
            return
            
        # Get thread and channel info
        channel_id = body["channel_id"]
        thread_ts = body.get("thread_ts") or body["message"]["thread_ts"]
        user_id = body["user_id"]
        
        # Extract lead_id and information from parent message
        lead_id = await get_lead_id_from_message(parent_msg)
        if not lead_id:
            await respond(
                text="⚠️ Could not extract lead ID from the parent message.",
                response_type="ephemeral"
            )
            return
            
        # Get lead details from Supabase
        supabase = get_supabase()
        result = supabase.table("leads").select("*").eq("lead_id", lead_id).execute()
        
        if not result.data:
            await respond(
                text="⚠️ Could not find lead data in the database.",
                response_type="ephemeral"
            )
            return
            
        lead_data = result.data[0]
        lead_name = lead_data.get("name", "Unknown Lead")
        
        # Create a channel name based on lead name
        # Remove special characters and spaces, keep alphanumeric only
        lastname = lead_name.split()[-1] if len(lead_name.split()) > 0 else "unknown"
        lastname = re.sub(r'[^a-zA-Z0-9]', '', lastname).lower()
        
        # Generate a unique channel name
        # Slack channel names must be lowercase, up to 80 chars, and can include alphanumerics, hyphens, and underscores
        channel_name = f"deal-{lastname}-{lead_id[-4:]}"[:21]  # 21 char limit for readability
        
        # Create the private channel
        try:
            create_response = await client.conversations_create(
                name=channel_name,
                is_private=True
            )
            new_channel_id = create_response["channel"]["id"]
            
            # Post initial message
            await client.chat_postMessage(
                channel=new_channel_id,
                text=f"🔔 *Escalated Lead: {lead_name}* (ID: {lead_id})\n\nEscalated by <@{user_id}>"
            )
            
            # Invite the requester
            await client.conversations_invite(
                channel=new_channel_id,
                users=user_id
            )
            
            # Invite sales managers group
            # Assuming there's a user group for sales managers
            # In a real implementation, you'd likely fetch this ID from a configuration
            # For now we'll just invite a specific user or group
            try:
                # Try to invite the sales-managers user group
                # This would require the Slack app to have usergroups:read scope
                sales_managers_id = "@sales-managers"  # This should be the actual ID
                await client.conversations_invite(
                    channel=new_channel_id,
                    users=sales_managers_id
                )
            except SlackApiError as e:
                # Fallback to a message if the group invite fails
                logger.error(f"Error inviting sales managers group: {e}")
                await client.chat_postMessage(
                    channel=new_channel_id,
                    text="ℹ️ Please add relevant sales managers to this channel."
                )
            
            # Get thread messages
            thread_messages = await get_thread_messages(client, channel_id, thread_ts)
            
            # Create a summary of the thread
            summary = f"*Lead Thread Summary*\n\n"
            
            for msg in thread_messages:
                user = msg.get("user", "Unknown")
                text = msg.get("text", "")
                ts = msg.get("ts", "")
                
                # Try to get user info
                try:
                    user_info = await client.users_info(user=user)
                    user_name = user_info["user"]["real_name"]
                except:
                    user_name = f"<@{user}>"
                    
                # Format timestamp
                from datetime import datetime
                try:
                    msg_time = datetime.fromtimestamp(float(ts)).strftime("%Y-%m-%d %H:%M:%S")
                except:
                    msg_time = ts
                    
                summary += f"*{user_name}* ({msg_time}):\n{text}\n\n"
            
            # Post the summary to the new channel
            await client.chat_postMessage(
                channel=new_channel_id,
                text=summary
            )
            
            # Update lead status in Supabase
            update_data = {
                "status": "Escalated",
                "escalated_by": user_id,
                "escalated_at": "now()",
                "escalated_channel": new_channel_id,
                "last_activity": "now()"
            }
            
            supabase.table("leads").update(update_data).eq("lead_id", lead_id).execute()
            
            # Post confirmation in original thread
            await client.chat_postMessage(
                channel=channel_id,
                thread_ts=thread_ts,
                text=f"🔔 This lead has been escalated by <@{user_id}> to a private channel <#{new_channel_id}>"
            )
            
            logger.info(f"User {user_id} escalated lead {lead_id} to channel {new_channel_id}")
            
        except SlackApiError as e:
            logger.error(f"Error creating escalation channel: {e}")
            await respond(
                text=f"⚠️ Error creating escalation channel: {str(e)}",
                response_type="ephemeral"
            )
            
    except Exception as e:
        logger.exception(f"Error in handle_escalate_command: {e}")
        await respond(
            text=f"⚠️ An error occurred while processing the escalation: {str(e)}",
            response_type="ephemeral"
        )

def register(app):
    """Register the escalate command handler with the Slack app."""
    app.command("/escalate")(handle_escalate_command) 