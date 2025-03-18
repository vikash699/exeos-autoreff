const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

function displayBanner() {
    const title = "Exeos Auto Reff - Airdrop Insiders";
    const line = "=".repeat(title.length + 10);
    console.log(line);
    console.log(`====  ${title}  ====`);
    console.log(line);
    console.log("");
}

class ExeosAutoReferral {
    constructor(referralCode, proxy = null) {
        this.referralCode = referralCode;
        this.proxy = proxy;
        
        const axiosConfig = {
            baseURL: 'https://api.exeos.network',
            headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Brave";v="134"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'sec-gpc': '1',
                'Referer': 'https://app.exeos.network/',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'User-Agent': this.generateRandomUserAgent(),
                'priority': 'u=1, i'
            },
            timeout: 30000
        };

        const tempMailConfig = {
            baseURL: 'https://api.mail.tm',
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': this.generateRandomUserAgent()
            },
            maxRedirects: 5
        };

        // Add proxy configuration if provided
        if (this.proxy) {
            const proxyAgent = this.createProxyAgent(this.proxy);
            if (proxyAgent) {
                axiosConfig.httpsAgent = proxyAgent;
                tempMailConfig.httpsAgent = proxyAgent;
            }
        }

        this.exeosApi = axios.create(axiosConfig);
        this.tempMailApi = axios.create(tempMailConfig);
    }

    createProxyAgent(proxyStr) {
        try {
            // Parse proxy string
            let proxyType, proxyHost, proxyPort, proxyAuth;
            
            // Handle different proxy formats
            if (proxyStr.startsWith('http://') || proxyStr.startsWith('https://')) {
                return new HttpsProxyAgent(proxyStr);
            } else if (proxyStr.startsWith('socks4://') || proxyStr.startsWith('socks5://') || proxyStr.startsWith('socks://')) {
                return new SocksProxyAgent(proxyStr);
            } else if (proxyStr.includes('@')) {
                // Format: username:password@host:port or host:port
                const parts = proxyStr.split('@');
                if (parts.length === 2) {
                    proxyAuth = parts[0];
                    const hostPort = parts[1].split(':');
                    proxyHost = hostPort[0];
                    proxyPort = hostPort[1];
                    return new HttpsProxyAgent(`http://${proxyAuth}@${proxyHost}:${proxyPort}`);
                }
            } else if (proxyStr.includes(':')) {
                // Format: host:port
                const parts = proxyStr.split(':');
                proxyHost = parts[0];
                proxyPort = parts[1];
                return new HttpsProxyAgent(`http://${proxyHost}:${proxyPort}`);
            }
            
            console.error('Invalid proxy format:', proxyStr);
            return null;
        } catch (error) {
            console.error('Error creating proxy agent:', error.message);
            return null;
        }
    }

    generateRandomUserAgent() {
        const browsers = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15'
        ];
        return browsers[Math.floor(Math.random() * browsers.length)];
    }

    generateRandomString(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    async createTempEmail() {
        const domain = 'indigobook.com';
        const random = crypto.randomBytes(8).toString('hex');
        const email = `${random}@${domain}`;
        const password = crypto.randomBytes(10).toString('hex');

        try {
            console.log(`Attempting to create email: ${email}`);
            await this.tempMailApi.post('/accounts', {
                address: email,
                password: password
            });

            const authResponse = await this.tempMailApi.post('/token', {
                address: email,
                password: password
            });

            console.log(`Temporary email created: ${email}`);
            return {
                email,
                password,
                token: authResponse.data.token
            };
        } catch (error) {
            console.error('Error creating email account:', error.response?.status || error.message, error.response?.data || '');
            throw error;
        }
    }

    decodeQuotedPrintable(text) {
        return text.replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                   .replace(/=3D/g, '=');
    }

    async getVerificationData(emailAccount, maxAttempts = 15) {
        console.log('Waiting for verification email...');

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await this.tempMailApi.get('/messages', {
                    headers: { Authorization: `Bearer ${emailAccount.token}` }
                });

                if (response.data['hydra:member'] && response.data['hydra:member'].length > 0) {
                    const email = response.data['hydra:member'][0];
                    console.log(`Email received: ${JSON.stringify({ from: email.from, subject: email.subject })}`);

                    const fromAddress = email.from && typeof email.from.address === 'string' ? email.from.address : '';
                    const subject = typeof email.subject === 'string' ? email.subject : '';
                    
                    if (!fromAddress.includes('exeos.network') || !subject.includes('Verify Your Email')) {
                        console.log(`Attempt ${attempt}/${maxAttempts} - Email found but not a verification email: ${subject}`);
                        await this.randomDelay(2000, 4000);
                        continue;
                    }

                    const messageResponse = await this.tempMailApi.get(`/messages/${email.id}`, {
                        headers: { Authorization: `Bearer ${emailAccount.token}` }
                    });

                    const content = this.decodeQuotedPrintable(messageResponse.data.text || messageResponse.data.html || '');

                    const verificationLinkRegex = /https:\/\/app\.exeos\.network\/validate-email\?token=([a-f0-9-]+)&userId=([a-f0-9-]+)/i;
                    const match = content.match(verificationLinkRegex);

                    if (match) {
                        console.log('✅ Verification data found: token=', match[1], 'userId=', match[2]);
                        return { token: match[1], userId: match[2] };
                    } else {
                        console.log('No token/userId found in email content');
                    }
                } else {
                    console.log(`Attempt ${attempt}/${maxAttempts} - No emails received yet...`);
                }

                await this.randomDelay(2000, 4000);
            } catch (error) {
                console.error('Error checking emails:', error.response?.status || error.message, error.response?.data || '');
                await this.randomDelay(2000, 4000);
            }
        }

        console.error('❌ No verification email received after maximum attempts');
        return null;
    }

    async verifyEmail(account, verificationData) {
        try {
            console.log(`Verifying email with token: ${verificationData.token} and userId: ${verificationData.userId}`);
            const response = await this.exeosApi.post('/account/web/email/validate', {
                token: verificationData.token,
                userId: verificationData.userId
            }, {
                headers: { 'authorization': `Bearer ${account.token}` }
            });

            console.log('Email verification response:', response.data);
            return response.data.status === 'success';
        } catch (error) {
            console.error('Error verifying email:', error.response?.status || error.message, error.response?.data || '');
            return false;
        }
    }

    generateRandomName() {
        const firstNames = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        return { firstName, lastName, fullName: `${firstName} ${lastName}` };
    }

    async randomDelay(min, max) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log(`Waiting ${delay}ms...`);
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    async registerAccount(emailAccount) {
        try {
            await this.randomDelay(1000, 3000);
            const randomName = this.generateRandomName();
            const username = `${randomName.firstName.toLowerCase()}${Math.floor(Math.random() * 1000)}`;

            console.log(`Using email: ${emailAccount.email}`);
            console.log(`Generated username: ${username}`);

            const registrationData = {
                email: emailAccount.email,
                password: emailAccount.password,
                username: username,
                referralCode: this.referralCode
            };

            console.log(`Registering with data: ${JSON.stringify({ ...registrationData, password: '********' })}`);
            const response = await this.exeosApi.post('/auth/web/email/register', registrationData);

            if (response.data?.status === 'success') {
                console.log('Registration successful:', response.data.status);
                return {
                    uid: response.data.data.uid,
                    token: response.data.data.token,
                    email: emailAccount.email,
                    password: emailAccount.password,
                    username: username,
                    personalReferralCode: response.data.data.user?.personalReferralCode || ''
                };
            }
            throw new Error('Registration failed: ' + JSON.stringify(response?.data || 'No response data'));
        } catch (error) {
            console.error('Error registering account:', error.response?.status || error.message, error.response?.data || '');
            throw error;
        }
    }

    async createReferral() {
        try {
            console.log('Creating temporary email...');
            const emailAccount = await this.createTempEmail();

            console.log(`Registering account with email: ${emailAccount.email}`);
            const account = await this.registerAccount(emailAccount);

            console.log('Waiting for verification data...');
            const verificationData = await this.getVerificationData(emailAccount);

            const result = {
                email: account.email,
                password: account.password,
                username: account.username,
                token: account.token,
                personalReferralCode: account.personalReferralCode,
                emailVerified: false,
                createdAt: new Date().toISOString()
            };

            if (verificationData) {
                const emailVerified = await this.verifyEmail(account, verificationData);
                result.emailVerified = emailVerified;

                if (emailVerified) {
                    console.log('✅ Referral created successfully!');
                } else {
                    console.log('⚠️ Referral created but email verification failed');
                }
            } else {
                console.log('⚠️ No verification data found');
            }

            console.log('Personal Referral Code:', account.personalReferralCode);
            return result;
        } catch (error) {
            console.error('Error in referral process:', error.message);
            throw error;
        }
    }
}

function readProxiesFromFile(filename) {
    try {
        if (fs.existsSync(filename)) {
            const content = fs.readFileSync(filename, 'utf8');
            const proxies = content.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
            
            console.log(`Loaded ${proxies.length} proxies from ${filename}`);
            return proxies;
        } else {
            console.log(`Proxy file ${filename} not found, will proceed without proxies`);
            return [];
        }
    } catch (error) {
        console.error(`Error reading proxy file ${filename}:`, error.message);
        return [];
    }
}

function saveAccountsToJson(accounts, filename) {
    try {
        let existingAccounts = [];
        if (fs.existsSync(filename)) {
            try {
                const content = fs.readFileSync(filename, 'utf8');
                existingAccounts = JSON.parse(content);
            } catch (error) {
                console.error(`Error parsing existing accounts from ${filename}:`, error.message);
            }
        }
        
        const allAccounts = [...existingAccounts, ...accounts];
        fs.writeFileSync(filename, JSON.stringify(allAccounts, null, 2), 'utf8');
        console.log(`Saved ${accounts.length} new accounts to ${filename}`);
    } catch (error) {
        console.error(`Error saving accounts to ${filename}:`, error.message);
    }
}

async function getUserInput(prompt) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(prompt, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function main() {
    displayBanner();
    
    let referralCode;
    try {
        referralCode = fs.existsSync('code.txt') ? fs.readFileSync('code.txt', 'utf8').trim() : '';
        if (!referralCode) {
            throw new Error('Referral code in code.txt is empty');
        }
        console.log(`Using referral code from code.txt: ${referralCode}`);
    } catch (error) {
        console.error('Error reading code.txt:', error.message);
        console.log('Falling back to default referral code: REFAVTANGCE');
        referralCode = 'REFAVTANGCE';
    }

    const proxies = readProxiesFromFile('proxies.txt');
    
    const referralCountInput = await getUserInput('Enter the number of accounts to create: ');
    const referralCount = parseInt(referralCountInput, 10) || 5;
    console.log(`Will create ${referralCount} accounts`);

    try {
        console.log(`Starting ExeosAutoReferral bot - Creating ${referralCount} referrals with code: ${referralCode}`);
        console.log(`Using ${proxies.length} proxies`);

        let successCount = 0;
        let createdAccounts = [];

        for (let i = 0; i < referralCount; i++) {
            console.log(`\n📝 Creating referral ${i + 1}/${referralCount}...`);
            
            let currentProxy = null;
            if (proxies.length > 0) {
                currentProxy = proxies[i % proxies.length];
                console.log(`Using proxy: ${currentProxy}`);
            }
            
            try {
                const bot = new ExeosAutoReferral(referralCode, currentProxy);
                const account = await bot.createReferral();
                
                createdAccounts.push(account);
                successCount++;
                
                if (i < referralCount - 1) {
                    await bot.randomDelay(5000, 15000);
                }
            } catch (error) {
                console.error(`Failed to create referral ${i + 1}: ${error.message}`);
                if (i < referralCount - 1) {
                    console.log('Delaying for longer period after error...');
                    await new Promise(resolve => setTimeout(resolve, 15000 + Math.random() * 10000));
                }
            }
        }

        saveAccountsToJson(createdAccounts, 'accounts.json');
        
        console.log(`\n🎉 Process completed! Successfully created ${successCount}/${referralCount} referrals.`);
        console.log('Results saved to accounts.json');
    } catch (error) {
        console.error('Main process error:', error.message);
    }
}

main();
