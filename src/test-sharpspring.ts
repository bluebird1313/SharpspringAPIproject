// Simple test script for SharpSpring API connection
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const ACCOUNT_ID = process.env.SHARPSPRING_ACCOUNT_ID;
const SECRET_KEY = process.env.SHARPSPRING_SECRET_KEY;
const BASE_URL = 'https://api.sharpspring.com/pubapi/v1.2/';

async function testSharpSpringConnection() {
  console.log('=== SharpSpring API Connection Test ===');
  console.log(`Using Account ID: ${ACCOUNT_ID?.substring(0, 5)}***`);
  
  if (!ACCOUNT_ID || !SECRET_KEY) {
    console.error('ERROR: Missing SharpSpring credentials in .env file');
    return;
  }
  
  const url = `${BASE_URL}?accountID=${ACCOUNT_ID}&secretKey=${SECRET_KEY}`;
  
  try {
    // Try getLeads with a small limit first
    console.log('\n1. Testing getLeads with limit 3...');
    const leadsResult = await makeApiCall('getLeads', { 
      where: {}, 
      limit: 3,
      offset: 0 
    });
    
    console.log('API Response received');
    console.log('Response structure:', typeof leadsResult);
    console.log('Keys in response:', Object.keys(leadsResult));
    
    // Find where the actual lead array is in the response
    let leads: any[] | null = null;
    if (Array.isArray(leadsResult)) {
      leads = leadsResult;
      console.log('Leads found directly as array');
    } else if (leadsResult.lead && Array.isArray(leadsResult.lead)) {
      leads = leadsResult.lead;
      console.log('Leads found at leadsResult.lead');
    } else if (leadsResult.leads && Array.isArray(leadsResult.leads)) {
      leads = leadsResult.leads;
      console.log('Leads found at leadsResult.leads');
    } else {
      console.log('Could not identify lead array in response. Full response:', JSON.stringify(leadsResult, null, 2));
    }
    
    // If we found leads, log their structure
    if (leads && leads.length > 0) {
      console.log(`\nFound ${leads.length} leads. First lead structure:`);
      const firstLead = leads[0];
      console.log('Fields:', Object.keys(firstLead));
      console.log('\nExample lead data:');
      console.log(JSON.stringify(firstLead, null, 2));
    } else {
      console.log('No leads found in the response');
    }
    
    // Try getLead if we have an ID from the getLeads call
    if (leads && leads.length > 0 && leads[0].id) {
      const leadId = leads[0].id;
      console.log(`\n2. Testing getLead with ID ${leadId}...`);
      const leadResult = await makeApiCall('getLead', { id: leadId });
      console.log('Single lead result:', JSON.stringify(leadResult, null, 2));
    }
    
    console.log('\nTest completed successfully!');
  } catch (error: any) {
    console.error('Error testing SharpSpring API:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
  
  async function makeApiCall(method: string, params: any): Promise<any> {
    console.log(`Making API call: ${method} with params:`, JSON.stringify(params));
    const requestID = `test_${Date.now()}`;
    
    const response = await axios.post(url, {
      method,
      params,
      id: requestID
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const responseData = response.data as any;
    if (responseData && responseData.error) {
      const errorMessage = responseData.error.message || 'Unknown error';
      const errorCode = responseData.error.code || 'No code';
      throw new Error(`SharpSpring API Error: ${errorMessage} (Code: ${errorCode})`);
    }
    
    return responseData?.result;
  }
}

// Run the test
testSharpSpringConnection().catch(err => {
  console.error('Unhandled error in test script:', err);
}); 