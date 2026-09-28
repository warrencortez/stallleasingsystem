const dotenv = require('dotenv');
dotenv.config();

/**
 * PayMongo Payment Service
 * Handles Checkout Sessions, Payment Intents, and Verification
 */
class PayMongoService {
    constructor() {
        this.secretKey = process.env.PAYMONGO_SECRET_KEY || '';
        this.publicKey = process.env.PAYMONGO_PUBLIC_KEY || '';
        this.baseUrl = 'https://api.paymongo.com/v1';
        this.successUrl = process.env.PAYMONGO_SUCCESS_URL || 'http://localhost:5173/payments?payment_status=success';
        this.cancelUrl = process.env.PAYMONGO_CANCEL_URL || 'http://localhost:5173/payments?payment_status=cancelled';
    }

    /**
     * Get Base64 encoded Basic Auth header
     */
    getAuthHeader() {
        return 'Basic ' + Buffer.from(this.secretKey + ':').toString('base64');
    }

    /**
     * Create a PayMongo Checkout Session for a lease payment / bill
     * @param {Object} data - Payment details
     * @returns {Object} Checkout session details and checkout_url
     */
    async createCheckoutSession(data) {
        const {
            paymentId,
            amount,
            stallNumber,
            description,
            tenantName,
            tenantEmail,
            tenantPhone
        } = data;

        if (!this.secretKey) throw new Error('Online payments are not configured.');
        // PayMongo expects amount in centavos (e.g. 15000 PHP = 1500000 centavos)
        const amountInCentavos = Math.round(parseFloat(amount) * 100);
        const refNumber = `STALL-PAY-${paymentId.substring(0, 8).toUpperCase()}`;

        const payload = {
            data: {
                attributes: {
                    metadata: { invoice_id: paymentId },
                    billing: {
                        name: tenantName || 'Stall Tenant',
                        email: tenantEmail || 'tenant@stalllease.com',
                        phone: tenantPhone || '+639000000000'
                    },
                    send_email_receipt: true,
                    show_description: true,
                    show_line_items: true,
                    description: description || `Stall Lease Payment - ${stallNumber || 'Monthly Rent'}`,
                    line_items: [
                        {
                            amount: amountInCentavos,
                            currency: 'PHP',
                            name: `Lease Rent: ${stallNumber || 'Stall'}`,
                            quantity: 1,
                            description: description || 'Monthly stall rental fee'
                        }
                    ],
                    payment_method_types: ['gcash', 'paymaya', 'card', 'grab_pay', 'dob'],
                    reference_number: refNumber,
                    success_url: `${this.successUrl}&payment_id=${paymentId}&ref=${refNumber}`,
                    cancel_url: `${this.cancelUrl}&payment_id=${paymentId}`
                }
            }
        };

        try {
            // Attempt live call to PayMongo API
            const response = await fetch(`${this.baseUrl}/checkout_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.data) {
                return {
                    success: true,
                    checkoutId: result.data.id,
                    checkoutUrl: result.data.attributes.checkout_url,
                    referenceNumber: refNumber,
                    status: 'active',
                    isSimulated: false
                };
            } else {
                console.warn('PayMongo API response warning:', result.errors || result);
                throw new Error('Payment provider could not create checkout. Please try again.');
            }
        } catch (error) {
            console.error('PayMongo checkout failed:', error.message);
            throw new Error('Payment provider could not create checkout. Please try again.');
        }
    }

    /**
     * Retrieve checkout session details
     */
    async retrieveCheckoutSession(checkoutId) {
        if (!this.secretKey || !checkoutId || checkoutId.startsWith('cs_sim_')) return null;

        try {
            const response = await fetch(`${this.baseUrl}/checkout_sessions/${checkoutId}`, {
                method: 'GET',
                headers: {
                    'Authorization': this.getAuthHeader()
                }
            });
            const result = await response.json();
            return response.ok ? result.data : null;
        } catch (error) {
            console.error('Error fetching PayMongo checkout session:', error.message);
            return null;
        }
    }

}

module.exports = new PayMongoService();
