/**
 * Mock Services & Spies for Deterministic CI Testing
 */

export class MockMessagingClient {
  constructor(shouldFail = false) {
    this.shouldFail = shouldFail;
    this.sentMessages = [];
  }

  async sendMessage({ to, body }) {
    if (this.shouldFail) {
      const error = new Error("Messaging Service 503 Service Unavailable");
      error.status = 503;
      throw error;
    }
    const messageRecord = {
      messageId: `msg_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      to,
      body,
      status: "sent",
      timestamp: new Date().toISOString(),
    };
    this.sentMessages.push(messageRecord);
    return messageRecord;
  }
}

export class MockResendClient {
  constructor(shouldFail = false) {
    this.shouldFail = shouldFail;
    this.sentEmails = [];
  }

  async sendEmail({ to, subject, html }) {
    if (this.shouldFail) {
      const error = new Error("Resend API Rate Limit Exceeded");
      error.status = 429;
      throw error;
    }
    const emailRecord = {
      id: `re_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      to,
      subject,
      html,
      timestamp: new Date().toISOString(),
    };
    this.sentEmails.push(emailRecord);
    return emailRecord;
  }
}

export class MockGeocodeClient {
  async reverseGeocode(lat, lng) {
    return {
      formattedAddress: `Mock Address near (${lat.toFixed(4)}, ${lng.toFixed(4)}), DFW, TX`,
      city: "Dallas",
      state: "TX",
      zip: "75201",
    };
  }
}
