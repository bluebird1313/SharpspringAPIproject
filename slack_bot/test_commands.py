#!/usr/bin/env python
"""
Test script for LeadBot functionality.
This script simulates lead data and tests basic interactions.
"""
import os
import asyncio
import json
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.slack_bot"))

from slack_sdk.web.async_client import AsyncWebClient
from utils.supabase_client import get_supabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get the leads channel from environment variable or use default
LEADS_CHANNEL = os.environ.get("LEADS_CHANNEL", "#leads-inbox")

async def test_post_lead():
    """Post a test lead to the leads-inbox channel."""
    try:
        # Initialize Slack client
        client = AsyncWebClient(token=os.environ["SLACK_BOT_TOKEN"])
        
        # Create sample lead data
        lead_data = {
            "lead_id": f"test-{int(asyncio.get_event_loop().time())}",
            "first_name": "Test",
            "last_name": "User",
            "name": "Test User",
            "email": "test@example.com",
            "phone": "555-123-4567",
            "product": "Hot Tub",
            "source": "Test Script"
        }
        
        # Use the channel from environment variable
        leads_channel = LEADS_CHANNEL
        
        # Post the lead data to the channel
        logger.info(f"Posting test lead to {leads_channel}...")
        response = await client.chat_postMessage(
            channel=leads_channel,
            text=json.dumps(lead_data)
        )
        
        logger.info(f"✅ Test lead posted, ts: {response['ts']}")
        return response
    
    except Exception as e:
        logger.exception(f"❌ Error posting test lead: {e}")
        return None

async def test_query_leads():
    """Query leads from Supabase to verify database connection."""
    try:
        supabase = get_supabase()
        
        # Query the most recent 5 leads
        logger.info("Querying recent leads from Supabase...")
        result = supabase.table("leads").select("*").order("created_at", desc=True).limit(5).execute()
        
        if result.data:
            logger.info(f"✅ Successfully queried {len(result.data)} leads")
            for lead in result.data:
                logger.info(f"  - {lead.get('name')} (ID: {lead.get('lead_id')}, Status: {lead.get('status')})")
        else:
            logger.info("No leads found in the database")
        
        return result.data
    
    except Exception as e:
        logger.exception(f"❌ Error querying Supabase: {e}")
        return None

async def main():
    """Run all tests."""
    logger.info("=== Starting LeadBot Tests ===")
    
    # Test Supabase connection
    logger.info("\nTesting Supabase connection...")
    leads = await test_query_leads()
    
    # Test posting a lead
    logger.info("\nTesting lead posting...")
    response = await test_post_lead()
    
    logger.info("\n=== Testing Complete ===")
    logger.info("""
Next steps to test manually:
1. Verify lead appears in #leads-inbox with 🆕 reaction
2. Use /claim in the thread to take ownership
3. Use /stage Contacted to update status (should add ☎️ reaction)
4. Try adding ✅ reaction to trigger the Won stage
5. Use /escalate to test private channel creation

Check README.md for more detailed testing instructions.
""")

if __name__ == "__main__":
    asyncio.run(main()) 