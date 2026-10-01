export const RAZORPAY_SERVICE = 'RAZORPAY_SERVICE';

export interface CreateOrderParams {
  amount: number; // in paise (e.g. 149900 = ₹1,499.00)
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  key_id: string;
}

export interface VerifyPaymentParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface IRazorpayService {
  createOrder(params: CreateOrderParams): Promise<RazorpayOrderResult>;
  verifyPaymentSignature(params: VerifyPaymentParams): boolean;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  getKeyId(): string;
}
