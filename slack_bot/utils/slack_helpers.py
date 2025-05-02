"""
Slack helper utilities.
Common functions for working with Slack conversations, threads, and messages.
"""
import logging
import json
import re
from typing import Dict, Any, List, Optional

from slack_sdk.errors import SlackApiError

logger = logging.getLogger(__name__)

async def is_thread(body: Dict[str, Any]) -> bool:
    """
    Check if a Slack event is in a thread.
    
    Args:
        body: The event body
        
    Returns:
        bool: True if in a thread, False otherwise
    """
    return "thread_ts" in body or "message" in body and "thread_ts" in body["message"]

async def get_parent_message(client, body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Get the parent message of a thread.
    
    Args:
        client: The Slack client
        body: The event body
        
    Returns:
        dict: The parent message or None if not found
    """
    try:
        channel_id = body["channel_id"]
        
        # If we're in a thread, get the parent ts
        if "thread_ts" in body:
            parent_ts = body["thread_ts"]
        elif "message" in body and "thread_ts" in body["message"]:
            parent_ts = body["message"]["thread_ts"]
        else:
            return None
            
        # Get the parent message
        result = await client.conversations_history(
            channel=channel_id,
            latest=parent_ts,
            inclusive=True,
            limit=1
        )
        
        if not result["messages"]:
            return None
            
        return result["messages"][0]
        
    except SlackApiError as e:
        logger.error(f"Error getting parent message: {e}")
        return None
    except Exception as e:
        logger.exception(f"Unexpected error in get_parent_message: {e}")
        return None

async def get_lead_id_from_message(message: Dict[str, Any]) -> Optional[str]:
    """
    Extract a lead_id from a message.
    
    Args:
        message: The Slack message
        
    Returns:
        str: The lead ID or None if not found
    """
    if not message:
        return None
        
    text = message.get("text", "")
    
    # Try JSON parsing first
    try:
        # Check if the entire message is valid JSON
        data = json.loads(text)
        if "lead_id" in data:
            return data["lead_id"]
    except json.JSONDecodeError:
        # If not valid JSON, try regex extraction
        pass
        
    # Fallback to regex extraction
    match = re.search(r'"lead_id"\s*:\s*"([^"]+)"', text)
    if match:
        return match.group(1)
        
    # Second fallback for different JSON format
    match = re.search(r'"lead_id"\s*:\s*(\w+)', text)
    if match:
        return match.group(1)
        
    return None

async def get_thread_messages(client, channel_id: str, thread_ts: str) -> List[Dict[str, Any]]:
    """
    Get all messages in a thread.
    
    Args:
        client: The Slack client
        channel_id: The channel ID
        thread_ts: The thread timestamp
        
    Returns:
        list: List of messages in the thread
    """
    try:
        result = await client.conversations_replies(
            channel=channel_id,
            ts=thread_ts
        )
        
        return result["messages"]
        
    except SlackApiError as e:
        logger.error(f"Error getting thread messages: {e}")
        return []
    except Exception as e:
        logger.exception(f"Unexpected error in get_thread_messages: {e}")
        return [] 