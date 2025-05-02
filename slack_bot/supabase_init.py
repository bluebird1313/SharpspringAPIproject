#!/usr/bin/env python
"""
One-time initialization script for Supabase schema setup.
Run this once to create the necessary tables for the Slack bot.
"""
import os
import sys
import logging
from dotenv import load_dotenv

# Load environment variables from .env.slack_bot
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.slack_bot"))

# Import after env vars are loaded
from utils.supabase_client import get_supabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def initialize_schema():
    """Create the necessary tables in Supabase for the LeadBot."""
    try:
        supabase = get_supabase()
        
        # Create leads table
        logger.info("Creating leads table...")
        supabase.table("leads").execute()  # Check if table exists
        
        leads_table_sql = """
        create table if not exists leads (
          lead_id text primary key,
          first_name text,
          last_name text, 
          name text,
          email text,
          phone text,
          city text,
          product text,
          source text,
          status text default 'New',
          owner text,
          owner_name text,
          last_activity timestamptz default now(),
          last_reminder timestamptz,
          created_at timestamptz default now(),
          updated_by text,
          thread_ts text,
          channel_id text,
          escalated_by text,
          escalated_at timestamptz,
          escalated_channel text,
          value numeric
        );
        """
        
        # Create stage_changes table
        stage_changes_sql = """
        create table if not exists stage_changes (
          id bigint generated always as identity primary key,
          lead_id text references leads(lead_id),
          from_stage text,
          to_stage text,
          changed_at timestamptz default now(),
          changed_by text
        );
        """
        
        # Execute SQL commands
        result = supabase.rpc("supabase_sql", {"query": leads_table_sql}).execute()
        logger.info("Leads table created or already exists")
        
        result = supabase.rpc("supabase_sql", {"query": stage_changes_sql}).execute()
        logger.info("Stage changes table created or already exists")
        
        logger.info("Schema initialization complete!")
        return True
        
    except Exception as e:
        logger.exception(f"Error initializing schema: {e}")
        return False

if __name__ == "__main__":
    logger.info("Initializing Supabase schema...")
    success = initialize_schema()
    if success:
        logger.info("✅ Schema initialization successful")
        sys.exit(0)
    else:
        logger.error("❌ Schema initialization failed")
        sys.exit(1) 