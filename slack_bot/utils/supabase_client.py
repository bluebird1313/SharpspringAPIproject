"""
Supabase client utility.
Provides a singleton instance of the Supabase client.
"""
import os
import logging
from typing import Optional

from supabase import create_client, Client

logger = logging.getLogger(__name__)

# Global client instance
_supabase_client: Optional[Client] = None

def get_supabase() -> Client:
    """
    Get a singleton instance of the Supabase client.
    
    Returns:
        Client: The Supabase client instance
        
    Raises:
        ValueError: If environment variables are not set
    """
    global _supabase_client
    
    if _supabase_client is not None:
        return _supabase_client
        
    # Get environment variables
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        error_msg = "Supabase environment variables are not set. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        logger.error(error_msg)
        raise ValueError(error_msg)
        
    try:
        # Initialize the client
        _supabase_client = create_client(supabase_url, supabase_key)
        logger.info("Supabase client initialized successfully")
        return _supabase_client
    except Exception as e:
        logger.exception(f"Error initializing Supabase client: {e}")
        raise 