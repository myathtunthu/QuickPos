/**
 * Customer Loyalty Points Calculator
 * 1000 MMK = 1 Point
 */
export function useLoyalty() {
  const calculatePoints = (totalAmount) => {
    return Math.floor(totalAmount / 1000);
  };

  const redeemPoints = (pointsToRedeem) => {
    // e.g., 100 points = 1000 MMK discount
    const discountAmount = pointsToRedeem * 10; 
    return discountAmount;
  };

  return { calculatePoints, redeemPoints };
}
