import { useCallback } from 'react';
import { toFiniteNumber } from '../utils/entryHelpers';

const DEFAULT_CONFIG = Object.freeze({
  amountPerPoint: 1000,
  redemptionValuePerPoint: 10,
  minimumRedeemPoints: 1,
});

const normalizeConfig = (config = {}) => ({
  amountPerPoint: Math.max(1, toFiniteNumber(config.amountPerPoint, DEFAULT_CONFIG.amountPerPoint)),
  redemptionValuePerPoint: Math.max(0, toFiniteNumber(config.redemptionValuePerPoint, DEFAULT_CONFIG.redemptionValuePerPoint)),
  minimumRedeemPoints: Math.max(1, Math.trunc(toFiniteNumber(config.minimumRedeemPoints, DEFAULT_CONFIG.minimumRedeemPoints))),
});

export function useLoyalty(config = DEFAULT_CONFIG) {
  const safeConfig = normalizeConfig(config);

  const calculatePoints = useCallback((totalAmount) => {
    const total = Math.max(0, toFiniteNumber(totalAmount, 0));
    return Math.floor(total / safeConfig.amountPerPoint);
  }, [safeConfig.amountPerPoint]);

  const getRedeemInfo = useCallback((pointsToRedeem, availablePoints = pointsToRedeem) => {
    const requested = Math.max(0, Math.trunc(toFiniteNumber(pointsToRedeem, 0)));
    const available = Math.max(0, Math.trunc(toFiniteNumber(availablePoints, 0)));
    const redeemablePoints = requested < safeConfig.minimumRedeemPoints ? 0 : Math.min(requested, available);

    return {
      points: redeemablePoints,
      discountAmount: redeemablePoints * safeConfig.redemptionValuePerPoint,
    };
  }, [safeConfig.minimumRedeemPoints, safeConfig.redemptionValuePerPoint]);

  const redeemPoints = useCallback((pointsToRedeem, availablePoints = pointsToRedeem) => (
    getRedeemInfo(pointsToRedeem, availablePoints).discountAmount
  ), [getRedeemInfo]);

  return { calculatePoints, redeemPoints, getRedeemInfo, config: safeConfig };
}

export default useLoyalty;
