const amqp = require('amqplib');

let channel = null;

/**
 * Connect to RabbitMQ and create a channel.
 */
const connect = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URI || 'amqp://localhost');
    channel = await connection.createChannel();
    console.log('Connected to RabbitMQ');
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
  }
};

/**
 * Publish a message to a specific queue.
 * @param {string} queue - The name of the queue.
 * @param {Object} message - The message object to be published.
 */
const publish = async (queue, message) => {
  if (!channel) {
    console.error('RabbitMQ channel is not initialized');
    return;
  }
  try {
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
    console.log(`Message published to queue "${queue}"`);
  } catch (error) {
    console.error('Error publishing message:', error);
  }
};

/**
 * Subscribe to a specific queue and process incoming messages using the provided callback.
 * @param {string} queue - The name of the queue.
 * @param {Function} callback - Function to process each incoming message.
 */
const subscribe = async (queue, callback) => {
  if (!channel) {
    console.error('RabbitMQ channel is not initialized');
    return;
  }
  try {
    await channel.assertQueue(queue, { durable: true });
    channel.consume(queue, (msg) => {
      if (msg !== null) {
        const messageContent = JSON.parse(msg.content.toString());
        callback(messageContent);
        channel.ack(msg);
      }
    });
    console.log(`Subscribed to queue "${queue}"`);
  } catch (error) {
    console.error('Error subscribing to queue:', error);
  }
};

module.exports = {
  connect,
  publish,
  subscribe
};
