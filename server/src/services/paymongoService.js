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

    modeAllowed() {
        const mode = process.env.PAYMENT_MODE;
        if (mode === 'test') return this.secretKey.startsWith('sk_test_');
        if (mode && mode !== 'live') return false;
        return this.secretKey.startsWith('sk_live_') || (!mode && process.env.NODE_ENV !== 'production' && this.secretKey.startsWith('sk_test_'));
    }
    assertReady() {
        if(!this.modeAllowed()) throw new Error('Online payments are not ready. Please contact the HOA office.');
        for(const value of [this.successUrl,this.cancelUrl]) {
            const url=new URL(value);
            if(url.protocol!=='https:' || ['localhost','127.0.0.1','::1'].includes(url.hostname)) throw new Error('Online payments need public HTTPS return URLs. Please contact the HOA office.');
        }
        if(!process.env.PAYMONGO_WEBHOOK_SECRET) throw new Error('Online payment confirmation is not configured. Please contact the HOA office.');
    }
    returnUrl(base, paymentId) {
        const url=new URL(base);url.searchParams.set('payment_id',paymentId);return url.toString();
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
        this.assertReady();
        // PayMongo expects amount in centavos (e.g. 15000 PHP = 1500000 centavos)
        const amountInCentavos = Math.round(parseFloat(amount) * 100);
        const refNumber = `STALL-PAY-${paymentId.substring(0, 8).toUpperCase()}`;

        const payload = {
            data: {
                attributes: {
                    metadata: { invoice_id: paymentId },
                    billing: {
                        name: tenantName || 'Stall Tenant',
                        ...(tenantEmail ? {email:tenantEmail} : {}),
                        ...(tenantPhone ? {phone:tenantPhone} : {})
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
                    payment_method_types: (process.env.PAYMONGO_PAYMENT_METHODS || 'gcash,card').split(',').map(value=>value.trim()).filter(Boolean),
                    reference_number: refNumber,
                    success_url: this.returnUrl(this.successUrl, paymentId),
                    cancel_url: this.returnUrl(this.cancelUrl, paymentId)
                }
            }
        };

        try {
            // Attempt live call to PayMongo API
            const response = await fetch(`${this.baseUrl}/checkout_sessions`, {
                signal: AbortSignal.timeout(15000),
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
                signal: AbortSignal.timeout(15000),
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
