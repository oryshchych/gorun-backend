import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import paymentsService from '../services/payments.service';

/**
 * Check payment status from Monobank API (fallback)
 * GET /api/payments/:id/status
 */
export const checkPaymentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Payment ID is required',
    });
    return;
  }

  const status = await paymentsService.checkPaymentStatus(id);

  if (!status) {
    res.status(404).json({
      success: false,
      message: 'Payment status not found',
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: status,
  });
};

/**
 * Get receipt for a payment
 * GET /api/payments/:id/receipt
 */
export const getPaymentReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Payment ID is required',
    });
    return;
  }

  const receipt = await paymentsService.getReceipt(id);

  if (!receipt) {
    res.status(404).json({
      success: false,
      message: 'Receipt not found',
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: receipt,
  });
};
