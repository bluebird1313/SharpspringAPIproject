"""
Handler for idle lead reminders.
Scheduled job that checks for leads with no activity in the last 48 hours.
"""
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List

from slack_sdk.errors import SlackApiError
from ..utils.supabase_client import get_supabase

logger = logging.getLogger(__name__)

async def send_idle_pings(app):
    """
    Scheduled job to check for idle leads and send reminders to owners.
    
    1. Query Supabase for leads with no activity in 48+ hours
    2. For each lead, send a DM to the owner
    3. Update reminder timestamp in Supabase
    """
    logger.info("Running idle lead reminder check")
    
    try:
        client = app.client
        supabase = get_supabase()
        
        # Query for idle leads (no activity in 48+ hours)
        # And not in terminal stages (Won/Lost)
        result = supabase.table("leads") \
            .select("*") \
            .not_is("owner", "null") \
            .not_in("status", ["Won", "Lost"]) \
            .lte("last_activity", "now() - interval '48 hours'") \
            .execute()
            
        idle_leads = result.data
        
        if not idle_leads:
            logger.info("No idle leads found")
            return
            
        logger.info(f"Found {len(idle_leads)} idle leads")
            
        # Process each idle lead
        for lead in idle_leads:
            try:
                owner_id = lead.get("owner")
                lead_id = lead.get("lead_id")
                lead_name = lead.get("name", "Unknown Lead")
                status = lead.get("status", "Unknown")
                channel_id = lead.get("channel_id")
                thread_ts = lead.get("thread_ts")
                
                if not owner_id or not lead_id:
                    logger.warning(f"Incomplete lead data: {lead}")
                    continue
                    
                # Format the last activity time
                last_activity = lead.get("last_activity")
                activity_display = "Unknown"
                
                if last_activity:
                    try:
                        # Parse ISO format timestamp
                        activity_time = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
                        # Calculate time difference
                        time_ago = datetime.now() - activity_time
                        days = time_ago.days
                        hours = time_ago.seconds // 3600
                        
                        if days > 0:
                            activity_display = f"{days} days, {hours} hours ago"
                        else:
                            activity_display = f"{hours} hours ago"
                    except Exception as e:
                        logger.error(f"Error parsing timestamp: {e}")
                
                # Create thread link
                thread_link = f"https://app.slack.com/client/{app.client.team_id}/{channel_id}/thread/{thread_ts}"
                
                # Send DM to owner
                message = (
                    f"🔔 *Reminder:* Lead *{lead_name}* (Status: {status}) has been inactive for {activity_display}.\n"
                    f"Please follow up or update the status.\n"
                    f"<{thread_link}|View Lead Thread>"
                )
                
                await client.chat_postMessage(
                    channel=owner_id,
                    text=message
                )
                
                logger.info(f"Sent reminder for lead {lead_id} to user {owner_id}")
                
                # Update the reminder timestamp
                supabase.table("leads") \
                    .update({"last_reminder": "now()"}) \
                    .eq("lead_id", lead_id) \
                    .execute()
                    
            except SlackApiError as e:
                logger.error(f"Error sending reminder DM: {e}")
            except Exception as e:
                logger.exception(f"Error processing lead {lead.get('lead_id')}: {e}")
    
    except Exception as e:
        logger.exception(f"Error in send_idle_pings: {e}")

def register(app):
    """No direct registration needed as this is a scheduled job."""
    pass 