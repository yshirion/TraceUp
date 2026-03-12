/**
 * Isracard Password Change API Discovery Script
 * 
 * This script logs into Isracard with a visible browser and intercepts
 * all API calls to discover the password change endpoint.
 * 
 * Usage: node discover-password-api.js
 * 
 * You'll need to fill in your credentials below.
 * The browser will open — navigate to the password change page manually.
 * All API calls will be logged to the console.
 */

import puppeteer from 'puppeteer';

// === FILL IN YOUR CREDENTIALS ===
const CREDENTIALS = {
    id: '305444580',           // Your ID number
    card6Digits: '127037',  // Last 6 digits of card
    password: 'gakjozsuQfis9biqze'      // Your password
};

const BASE_URL = 'https://digital.isracard.co.il';
const SERVICES_URL = `${BASE_URL}/services/ProxyRequestHandler.ashx`;

async function discover() {
    console.log('🔍 Launching browser (visible mode)...\n');

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1200, height: 800 }
    });

    const page = await browser.newPage();

    // Intercept ALL network requests and log API calls
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        const url = request.url();

        // Log all ProxyRequestHandler calls (Isracard's internal API)
        if (url.includes('ProxyRequestHandler')) {
            const urlObj = new URL(url);
            const reqName = urlObj.searchParams.get('reqName');
            console.log(`\n📡 API REQUEST: ${request.method()} reqName=${reqName}`);
            console.log(`   URL: ${url}`);

            if (request.method() === 'POST') {
                const postData = request.postData();
                if (postData) {
                    try {
                        const parsed = JSON.parse(postData);
                        console.log('   POST body:', JSON.stringify(parsed, null, 2));
                    } catch {
                        console.log('   POST body (raw):', postData);
                    }
                }
            }
        }

        // Also log any other interesting API calls
        if (url.includes('ChangePassword') || url.includes('changepassword') ||
            url.includes('UpdatePassword') || url.includes('updatepassword') ||
            url.includes('ResetPassword') || url.includes('resetpassword')) {
            console.log(`\n🔑 PASSWORD-RELATED URL FOUND: ${url}`);
            console.log(`   Method: ${request.method()}`);
            if (request.postData()) {
                console.log('   POST body:', request.postData());
            }
        }

        request.continue();
    });

    // Also intercept responses to see success/failure
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('ProxyRequestHandler')) {
            const urlObj = new URL(url);
            const reqName = urlObj.searchParams.get('reqName');
            try {
                const body = await response.text();
                const parsed = JSON.parse(body);
                console.log(`\n📩 API RESPONSE: reqName=${reqName} status=${response.status()}`);
                console.log('   Response:', JSON.stringify(parsed, null, 2).substring(0, 500));
            } catch {
                // ignore non-JSON responses
            }
        }
    });

    console.log('🌐 Navigating to Isracard login page...');
    await page.goto(`${BASE_URL}/personalarea/Login`, { waitUntil: 'networkidle2' });

    console.log('\n' + '='.repeat(70));
    console.log('BROWSER IS OPEN — please do one of the following:');
    console.log('');
    console.log('  1. If you need to change password (forced by Isracard):');
    console.log('     → Log in with your credentials in the browser.');
    console.log('     → The password change form will appear automatically.');
    console.log('     → Fill in the new password and submit.');
    console.log('     → ALL API calls will be logged here in the console.');
    console.log('');
    console.log('  2. If you want to voluntarily change password:');
    console.log('     → Log in normally.');
    console.log('     → Navigate to Settings / Change Password.');
    console.log('     → Fill in old + new password and submit.');
    console.log('     → ALL API calls will be logged here in the console.');
    console.log('');
    console.log('  Look for lines with 📡 and 🔑 in the output.');
    console.log('  When done, press Ctrl+C to exit.');
    console.log('='.repeat(70) + '\n');

    // Keep the script running until user presses Ctrl+C
    await new Promise(() => { });
}

discover().catch(console.error);
