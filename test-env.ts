import * as dotenv from 'dotenv';
dotenv.config();

console.log('SLACK_WEBHOOK_URL exists:', Boolean(process.env.SLACK_WEBHOOK_URL));
console.log('SLACK_WEBHOOK_URL value:', process.env.SLACK_WEBHOOK_URL ? 'Has value' : 'Empty'); 