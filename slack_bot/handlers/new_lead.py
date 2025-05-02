"""
Handler for processing new leads from SharpSpring.
Listens for messages in #leads-inbox with a JSON payload containing a "lead_id".
"""
import logging
import json
import os
import asyncio
from typing import Dict, Any

from slack_sdk.errors import SlackApiError
from ..utils.supabase_client import get_supabase

logger = logging.getLogger(__name__)

# Get the leads channel from environment variable or use default
LEADS_CHANNEL = os.environ.get("LEADS_CHANNEL", "#leads-inbox")

async def handle_new_lead(body: Dict[str, Any], client, say, logger):
    """
    Process a new lead message in the leads-inbox channel.
    
    1. Extracts lead information from the message
    2. Starts a thread on the message
    3. Adds a 🆕 reaction
    4. Inserts/merges the lead data in Supabase
    """
    try:
        # Extract message text and attempt to parse JSON
        message_text = body["event"]["text"]
        
        # Basic validation - is this a lead?
        if "lead_id" not in message_text:
            return
            
        # Try to parse lead data
        try:
            # Find JSON in message text
            lead_data = json.loads(message_text)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse lead data from message: {message_text[:100]}...")
            await say(
                text="⚠️ Failed to parse lead data. Please check the message format.",
                thread_ts=body["event"]["ts"]
            )
            return
            
        # Extract lead fields
        lead_id = lead_data.get("lead_id")
        first_name = lead_data.get("first_name", "")
        last_name = lead_data.get("last_name", "")
        full_name = f"{first_name} {last_name}".strip()
        if not full_name:
            full_name = lead_data.get("name", "Unknown Lead")
        
        email = lead_data.get("email", "")
        phone = lead_data.get("phone", "")
        city = lead_data.get("city", "")
        owner = lead_data.get("owner", "")
        product = lead_data.get("product", "Hot Tub")
        source = lead_data.get("source", "SharpSpring")

        # Start a thread with lead info
        message = (
            f"*New Lead*: {full_name}"
        )
        
        if city:
            message += f" from *{city}* 🏙️"
            
        message += f"\n📞 {phone}\n📧 {email}"
        
        if owner:
            message += f"\nAssigned to: {owner}"
        else:
            message += f"\nAssigned to: Unclaimed"
            
        message += f"\n\nUse `/claim` to take ownership of this lead."
        
        # Post message
        result = await say(
            text=message,
            thread_ts=body["event"]["ts"]
        )
        
        # Add 🆕 reaction
        try:
            await client.reactions_add(
                channel=body["event"]["channel"],
                timestamp=body["event"]["ts"],
                name="new"
            )
        except SlackApiError as e:
            logger.error(f"Error adding reaction: {e}")
            
        # Insert/merge to Supabase
        supabase = get_supabase()
        
        # Create complete lead record
        lead_record = {
            "lead_id": lead_id,
            "first_name": first_name,
            "last_name": last_name,
            "name": full_name,
            "email": email,
            "phone": phone,
            "city": city,
            "product": product,
            "source": source,
            "status": "New",
            "owner": owner,
            "created_at": "now()",
            "last_activity": "now()",
            "thread_ts": body["event"]["ts"],
            "channel_id": body["event"]["channel"]
        }
        
        # Upsert to Supabase
        supabase.table("leads").upsert(lead_record).execute()
        
        logger.info(f"Successfully processed new lead: {lead_id}")
            
    except Exception as e:
        logger.exception(f"Error in handle_new_lead: {e}")
        
def register(app):
    """Register the new lead handler with the Slack app."""
    # Listen for messages containing "lead_id" in the leads channel
    app.message({"text": "lead_id", "channel": LEADS_CHANNEL})(handle_new_lead)
    # TODO: Add webhook endpoint for direct SharpSpring integration 