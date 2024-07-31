const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const { Redis } = require("ioredis");
import 'dotenv/config';

// Create WhatsApp client
const client = new Client();

// Redis connection setup
const redisUrl = process.env.REDIS_URL || 'redis://';
console.log(`Connecting to Redis at ${redisUrl}`);
const redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    connectTimeout: 10000,
});

// const testJob = {
//   user: { number: '+77085340835' },
//   apartment: { phoneNumber: '+77085340835', details: 'Test apartment details' }
// };


// Add the test job to the Redis queue
// redisConnection.rpush('phoneQueue', JSON.stringify(testJob));

// Generate QR code for WhatsApp Web
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// When WhatsApp client is ready
client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    processQueue();
});

// Function to process the queue
async function processQueue() {
    while (true) {
        try {
            // Pop a job from the Redis queue
            const job = await redisConnection.lpop('phoneQueue');
            
            if (job) {
                const { user, apartment } = JSON.parse(job);

                const landlordMessage = `Здравствуйте, это веб-приложение homespark, помогающее пользователям найти квартиры. Наш пользователь: ${user.surname} ${user.name}, заинтересовался вашей квартирой (${apartment.link}) и хотел бы ее посетить. 
                \nДанные пользователя: 
                \nИмя: ${user.name} ${user.surname}
                \nТелефон: ${user.phoneNumber}
                \nEmail: ${user.email}
                \nОписание: ${user.smallDescription}
                \nДля дальнейшего общения, пожалуйста, свяжитесь с ним по номеру: ${user.phoneNumber}`;

                const userMessage = `Ваше сообщение о интересе квартирой было отправлено по номеру: ${apartment.number} и ссылке: ${apartment.link}`;

                
                // Attempt to send message to Apartment.number
                const apartmentSuccess = await sendMessage(apartment.number, landlordMessage);
                
                if (apartmentSuccess) {
                    // If successful, send message to User.number
                    const userSuccess = await sendMessage(user.phoneNumber, userMessage);
                    
                    if (!userSuccess) {
                        // If user message fails, push job back to queue
                        console.log('User message failed')
                    }
                } else {
                    // If apartment message fails, push job back to queue
                    const userSuccess = await sendMessage(user.phoneNumber, `Сообщение не было отправлено арендодателю`);

                    console.log('Apartment message failed');
                    if(userSuccess) {
                        console.log('User message was sent(that it was failed)');
                    }
                }
            } else {
                // If queue is empty, wait for 500 seconds before checking again
                console.log('Queue is empty, waiting for 1800 seconds');
                await new Promise(resolve => setTimeout(resolve, 1800000));
            }
        } catch (error) {
            console.error('Error processing queue:', error);
        }
    }
}

// Function to send a WhatsApp message
async function sendMessage(number, message) {
    try {
      const chatId = number.substring(1) + "@c.us";
      await client.sendMessage(chatId, message);
      console.log(`Message sent to ${number}`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Add delay here
      return true;
    } catch (error) { // Explicitly type 'error' as 'Error'
      console.error(`Failed to send message to ${number}:`, error);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Add delay here
      return false;
    }
}

// Initialize WhatsApp client
client.initialize();